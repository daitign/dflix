package com.daitign.stream

import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback

enum class PlayerState {
    PLAYER_HIDDEN,
    PLAYER_CONTROLS,
    PLAYER_TIMELINE,
    PLAYER_MENU,
}

/** Native shell for the production TV browse WebView and top-level VIDSTUCK player. */
class MainActivity : ComponentActivity() {
    companion object {
        private const val TAG = "DAITIGN-TV"
        private const val APP_URL = "https://daiflix.vercel.app/?tv=1"
        private const val PLAYER_TEST_URL = "https://local.daitign.invalid/player-test"
        private const val TV_USER_AGENT = " DAITIGN-TV/3.0"
        private const val STARTUP_TIMEOUT_MS = 10_000L
        private const val EXIT_INTERVAL_MS = 2_000L

        private const val PLAYER_TEST_HTML = """
            <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
            <style>
              body{margin:0;background:#111;color:#fff;font:24px sans-serif;display:grid;place-items:center;height:100vh}
              .row{display:flex;gap:24px}.menu{display:none;position:fixed;inset:25% 30%;background:#222;padding:30px}
              .menu.open{display:flex;flex-direction:column;gap:16px}button{font-size:24px;padding:18px 28px}
            </style></head><body data-events="">
              <div class="row"><button aria-label="Play">Play</button><button aria-label="Subtitle">Subtitle</button>
              <button aria-label="Quality">Quality</button><button aria-label="Fullscreen">Fullscreen</button></div>
              <div class="menu" role="menu"><button role="menuitem">English</button><button role="menuitem">Spanish</button></div>
              <script>
                var events=[];var menu=document.querySelector('.menu');
                function record(value){events.push(value);document.body.dataset.events=events.join('>')}
                document.querySelectorAll('button').forEach(function(button){button.addEventListener('click',function(){
                  record(button.textContent.trim());
                  if(button.textContent.trim()==='Subtitle')menu.classList.add('open');
                  if(button.getAttribute('role')==='menuitem')menu.classList.remove('open');
                })});
              </script></body></html>
        """
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val playerHandler = Handler(Looper.getMainLooper())
    private lateinit var rootContainer: FrameLayout
    private lateinit var webViewContainer: FrameLayout
    private lateinit var customViewContainer: FrameLayout
    private lateinit var errorOverlay: LinearLayout
    private lateinit var errorText: TextView
    private lateinit var retryButton: Button

    private var browseWebView: WebView? = null
    private var playerWebView: WebView? = null
    private var customView: View? = null
    private var customViewOwner: WebView? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var browseReady = false
    private var browseRendererGone = false
    private var pendingPlayerUrl: String? = null
    private var runningSyntheticPlayerTest = false
    private var syntheticPlayerTestCompleted = false
    private var lastBackAt = 0L

    @Volatile
    private var playerState = PlayerState.PLAYER_HIDDEN

    private val startupWatchdog = Runnable {
        if (!browseReady) showBrowseFailure("Production page did not render within 10 seconds")
    }

    private val isDebugBuild: Boolean
        get() = applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.i(TAG, "MainActivity.onCreate")
        try {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            createNativeRoot()
            setContentView(rootContainer)
            enterImmersiveMode()
            Log.i(TAG, "stable programmatic root attached: ${lifecycle.currentState}")
            installBackHandler()
            loadBrowseApp()
        } catch (error: Throwable) {
            showFatalStartupError(error)
        }
    }

    private fun createNativeRoot() {
        rootContainer = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(20, 20, 20))
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        webViewContainer = FrameLayout(this).apply { setBackgroundColor(Color.rgb(20, 20, 20)) }
        customViewContainer = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
            visibility = View.GONE
        }
        val errorTitle = TextView(this).apply {
            text = "DAITIGN TV failed to load"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 30f)
            gravity = Gravity.CENTER
        }
        errorText = TextView(this).apply {
            setTextColor(Color.LTGRAY)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
            gravity = Gravity.CENTER
            setPadding(dp(24), dp(16), dp(24), dp(16))
        }
        retryButton = Button(this).apply {
            text = getString(R.string.retry)
            isFocusable = true
            setOnClickListener { loadBrowseApp() }
        }
        errorOverlay = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.rgb(20, 20, 20))
            visibility = View.GONE
            addView(errorTitle, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            addView(errorText, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            addView(retryButton, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        }
        rootContainer.addView(webViewContainer, matchParentParams())
        rootContainer.addView(customViewContainer, matchParentParams())
        rootContainer.addView(errorOverlay, matchParentParams())
    }

    private fun loadBrowseApp() {
        mainHandler.removeCallbacks(startupWatchdog)
        browseReady = false
        errorOverlay.visibility = View.GONE
        if (browseRendererGone) {
            destroyBrowseWebView()
            browseRendererGone = false
        }
        val browse = browseWebView ?: try {
            createBrowseWebView().also {
                browseWebView = it
                webViewContainer.addView(it, 0, matchParentParams())
                Log.i(TAG, "browse WebView created and attached")
            }
        } catch (error: Throwable) {
            showFatalStartupError(error)
            return
        }
        browse.visibility = View.VISIBLE
        browse.onResume()
        browse.resumeTimers()
        Log.i(TAG, "browse settings applied; loading $APP_URL")
        mainHandler.postDelayed(startupWatchdog, STARTUP_TIMEOUT_MS)
        browse.loadUrl(APP_URL)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView(webView: WebView) {
        webView.setBackgroundColor(Color.rgb(20, 20, 20))
        webView.isFocusable = true
        webView.isFocusableInTouchMode = true
        webView.settings.run {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode = true
            useWideViewPort = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = (userAgentString ?: "Mozilla/5.0 (Linux; Android TV)") + TV_USER_AGENT
        }
        CookieManager.getInstance().run {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }
        if (isDebugBuild) WebView.setWebContentsDebuggingEnabled(true)
        Log.i(
            TAG,
            "WebView settings: javaScript=${webView.settings.javaScriptEnabled}, " +
                "domStorage=${webView.settings.domStorageEnabled}, " +
                "mediaGesture=${webView.settings.mediaPlaybackRequiresUserGesture}, " +
                "hardware=${webView.isHardwareAccelerated}, layerType=${webView.layerType}",
        )
    }

    private fun createBrowseWebView(): WebView = WebView(this).also { webView ->
        configureWebView(webView)
        webView.addJavascriptInterface(WebAppInterface(this), "AndroidTVBridge")
        webView.webChromeClient = chromeClientFor(webView)
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                Log.i(TAG, "browse onPageStarted: $url")
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                Log.i(TAG, "browse onPageFinished: $url")
                view?.let { verifyBrowseRendered(it, allowRetry = true) }
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                Log.e(TAG, "browse onReceivedError main=${request?.isForMainFrame} url=${request?.url}: ${error?.description}")
                if (request?.isForMainFrame == true) showBrowseFailure(error?.description?.toString() ?: "WebView error")
            }

            override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, response: WebResourceResponse?) {
                Log.e(TAG, "browse onReceivedHttpError main=${request?.isForMainFrame} status=${response?.statusCode} url=${request?.url}")
                if (request?.isForMainFrame == true) showBrowseFailure("HTTP ${response?.statusCode ?: -1}")
            }

            override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
                Log.e(TAG, "browse SSL error ${error?.primaryError} at ${error?.url}")
                handler?.cancel()
                showBrowseFailure("SSL validation failed")
            }

            override fun onRenderProcessGone(view: WebView?, detail: RenderProcessGoneDetail?): Boolean {
                browseRendererGone = true
                Log.e(TAG, "browse renderer gone; crashed=${detail?.didCrash()}")
                showBrowseFailure("WebView renderer stopped")
                return true
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                if (request?.isForMainFrame != true) return false
                val uri = request.url
                if (uri.host.equals(Uri.parse(APP_URL).host, ignoreCase = true)) return false
                return openExternal(uri)
            }
        }
    }

    private fun verifyBrowseRendered(webView: WebView, allowRetry: Boolean) {
        webView.evaluateJavascript(
            "(function(){var root=document.getElementById('root');return !!(root&&root.childElementCount);})()",
        ) { result ->
            if (result == "true") {
                browseReady = true
                mainHandler.removeCallbacks(startupWatchdog)
                errorOverlay.visibility = View.GONE
                webView.visibility = View.VISIBLE
                webView.onResume()
                webView.resumeTimers()
                webView.requestFocus()
                Log.i(TAG, "browse rendered; visible=${webView.visibility}, focus=${webView.hasFocus()}")
            } else if (allowRetry) {
                mainHandler.postDelayed({ verifyBrowseRendered(webView, allowRetry = false) }, 1_200L)
            } else {
                showBrowseFailure("HTML loaded but DAITIGN did not render")
            }
        }
    }

    fun startTvPlayer(url: String, @Suppress("UNUSED_PARAMETER") stateJson: String) {
        runOnUiThread {
            val uri = Uri.parse(url)
            if (uri.scheme != "https" || uri.host != "vidstuck.xyz" || !uri.path.orEmpty().startsWith("/embed/")) {
                Toast.makeText(this, R.string.invalid_player_url, Toast.LENGTH_SHORT).show()
                return@runOnUiThread
            }
            Log.i(TAG, "startTvPlayer requested: ${uri.path}")
            browseWebView?.evaluateJavascript("window.DAITIGN_TV&&window.DAITIGN_TV.saveBrowseState&&window.DAITIGN_TV.saveBrowseState()", null)
            browseWebView?.clearFocus()
            pendingPlayerUrl = uri.toString()
            destroyPlayerWebView()

            val player = createPlayerWebView()
            playerWebView = player
            webViewContainer.addView(player, matchParentParams())
            player.bringToFront()
            player.isFocusable = true
            player.isFocusableInTouchMode = true
            player.requestFocus()
            Log.i(TAG, "player WebView attached; requestFocus=${player.hasFocus()}")
            player.post { Log.i(TAG, "player WebView focus after layout=${player.hasFocus()}, visibility=${player.visibility}") }

            if (!syntheticPlayerTestCompleted) {
                runningSyntheticPlayerTest = true
                player.alpha = 0.02f
                player.setBackgroundColor(Color.TRANSPARENT)
                player.loadDataWithBaseURL(PLAYER_TEST_URL, PLAYER_TEST_HTML, "text/html", "UTF-8", null)
            } else {
                loadPendingVidstuck()
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createPlayerWebView(): WebView = WebView(this).also { webView ->
        configureWebView(webView)
        webView.settings.cacheMode = WebSettings.LOAD_NO_CACHE
        webView.addJavascriptInterface(PlayerBridge(this), "AndroidTVBridge")
        webView.webChromeClient = chromeClientFor(webView)
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                playerState = PlayerState.PLAYER_HIDDEN
                Log.i(TAG, "player onPageStarted: $url")
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                Log.i(TAG, "player onPageFinished: $url")
                if (runningSyntheticPlayerTest && url?.startsWith(PLAYER_TEST_URL) == true) {
                    injectPlayerAdapter(view) { runSyntheticPlayerTest(view) }
                } else {
                    injectPlayerAdapter(view) {
                        view?.requestFocus()
                        playerHandler.postDelayed({ logPlayerInventory(view, "VIDSTUCK initial") }, 700L)
                    }
                }
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                Log.e(TAG, "player onReceivedError main=${request?.isForMainFrame} url=${request?.url}: ${error?.description}")
            }

            override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, response: WebResourceResponse?) {
                Log.e(TAG, "player onReceivedHttpError main=${request?.isForMainFrame} status=${response?.statusCode} url=${request?.url}")
            }
        }
    }

    private fun runSyntheticPlayerTest(webView: WebView?) {
        val player = webView ?: return loadPendingVidstuck()
        Log.i(TAG, "synthetic player-control test started")
        playerHandler.postDelayed({ sendPlayerKey("OK") }, 180L)
        playerHandler.postDelayed({ sendPlayerKey("RIGHT") }, 440L)
        playerHandler.postDelayed({ sendPlayerKey("OK") }, 620L)
        playerHandler.postDelayed({ sendPlayerKey("DOWN") }, 900L)
        playerHandler.postDelayed({ sendPlayerKey("OK") }, 1_080L)
        playerHandler.postDelayed({
            player.evaluateJavascript(
                "(function(){var snapshot=window.DAITIGN_TV_PLAYER&&window.DAITIGN_TV_PLAYER.snapshot();" +
                    "var events=document.body.dataset.events||'';return Boolean(snapshot&&" +
                    "snapshot.state==='PLAYER_CONTROLS'&&events==='Subtitle>Spanish');})()",
            ) { result -> Log.i(TAG, "synthetic player-control navigation: ${if (result == "true") "PASS" else "FAIL ($result)"}") }
            sendPlayerKey("BACK")
        }, 1_300L)
        playerHandler.postDelayed({
            player.evaluateJavascript(
                "Boolean(window.DAITIGN_TV_PLAYER&&window.DAITIGN_TV_PLAYER.getState()==='PLAYER_HIDDEN')",
            ) { result ->
                val passed = result == "true"
                Log.i(TAG, "synthetic player-control Back: ${if (passed) "PASS" else "FAIL ($result)"}")
                runningSyntheticPlayerTest = false
                syntheticPlayerTestCompleted = passed
                playerState = PlayerState.PLAYER_HIDDEN
                loadPendingVidstuck()
            }
        }, 1_520L)
    }

    private fun loadPendingVidstuck() {
        val player = playerWebView ?: return
        val url = pendingPlayerUrl ?: return
        runningSyntheticPlayerTest = false
        player.alpha = 1f
        player.setBackgroundColor(Color.BLACK)
        browseWebView?.visibility = View.INVISIBLE
        browseWebView?.clearFocus()
        player.visibility = View.VISIBLE
        player.onResume()
        player.resumeTimers()
        player.requestFocus()
        Log.i(TAG, "loading top-level VIDSTUCK; player focus=${player.hasFocus()}")
        player.loadUrl(url)
    }

    private fun injectPlayerAdapter(webView: WebView?, onInjected: (() -> Unit)? = null) {
        val script = assets.open("tv-player-controller.js").bufferedReader().use { it.readText() }
        if (webView == null) return
        webView.evaluateJavascript(script) {
            Log.i(TAG, "player controller injected")
            onInjected?.invoke()
        }
    }

    private fun logPlayerInventory(webView: WebView?, source: String) {
        webView?.evaluateJavascript(
            "JSON.stringify(window.DAITIGN_TV_PLAYER&&window.DAITIGN_TV_PLAYER.snapshot())",
        ) { result -> Log.i(TAG, "$source controls: $result") }
    }

    fun setPlayerState(value: String) {
        playerState = runCatching { PlayerState.valueOf(value) }.getOrDefault(PlayerState.PLAYER_CONTROLS)
        Log.i(TAG, "player state -> $playerState")
    }

    fun closeTvPlayer() {
        runOnUiThread {
            if (customView != null) hideCustomView()
            destroyPlayerWebView()
            pendingPlayerUrl = null
            playerState = PlayerState.PLAYER_HIDDEN
            browseWebView?.run {
                visibility = View.VISIBLE
                bringToFront()
                onResume()
                resumeTimers()
                requestFocus()
                evaluateJavascript("window.DAITIGN_TV&&window.DAITIGN_TV.onPlayerClosed&&window.DAITIGN_TV.onPlayerClosed()", null)
                Log.i(TAG, "browse restored without reload; focus=${hasFocus()}")
            }
        }
    }

    private fun destroyPlayerWebView() {
        playerHandler.removeCallbacksAndMessages(null)
        playerWebView?.run {
            stopLoading()
            webViewContainer.removeView(this)
            removeJavascriptInterface("AndroidTVBridge")
            destroy()
        }
        playerWebView = null
        runningSyntheticPlayerTest = false
    }

    private fun sendPlayerKey(key: String, callback: ValueCallback<String>? = null) {
        val player = playerWebView ?: return
        player.evaluateJavascript(
            "Boolean(window.DAITIGN_TV_PLAYER&&window.DAITIGN_TV_PLAYER.handle('$key'))",
        ) { handled ->
            Log.i(TAG, "player controller key=$key handled=$handled state=$playerState")
            playerHandler.postDelayed({ logPlayerInventory(player, "after $key") }, 260L)
            callback?.onReceiveValue(handled)
        }
    }

    private fun routePlayerKey(key: String) {
        if (playerState == PlayerState.PLAYER_HIDDEN && key != "OK") return
        sendPlayerKey(key)
    }

    private fun handlePlayerBack() {
        when (playerState) {
            PlayerState.PLAYER_MENU,
            PlayerState.PLAYER_CONTROLS,
            PlayerState.PLAYER_TIMELINE -> sendPlayerKey("BACK")
            PlayerState.PLAYER_HIDDEN -> {
                if (customView != null) hideCustomView() else closeTvPlayer()
            }
        }
    }

    private fun chromeClientFor(owner: WebView) = object : WebChromeClient() {
        override fun onConsoleMessage(message: ConsoleMessage?): Boolean {
            message ?: return false
            Log.d(TAG, "WebView console ${message.messageLevel()}: ${message.message()} (${message.sourceId()}:${message.lineNumber()})")
            return true
        }

        override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
            if (view == null || callback == null) return
            if (customView != null) hideCustomView()
            customView = view
            customViewOwner = owner
            customViewCallback = callback
            owner.visibility = View.INVISIBLE
            customViewContainer.addView(view, matchParentParams())
            customViewContainer.visibility = View.VISIBLE
            customViewContainer.bringToFront()
            enterImmersiveMode()
            Log.i(TAG, "HTML5 fullscreen entered")
        }

        override fun onHideCustomView() = hideCustomView()

        override fun onPermissionRequest(request: PermissionRequest?) {
            request?.grant(request.resources)
        }
    }

    private fun hideCustomView() {
        val view = customView ?: return
        customViewContainer.removeView(view)
        customViewContainer.visibility = View.GONE
        customViewCallback?.onCustomViewHidden()
        customView = null
        customViewCallback = null
        customViewOwner?.run {
            visibility = View.VISIBLE
            requestFocus()
        }
        customViewOwner = null
        Log.i(TAG, "HTML5 fullscreen exited")
    }

    private fun installBackHandler() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (playerWebView != null) return handlePlayerBack()
                val browse = browseWebView ?: return finish()
                browse.evaluateJavascript("Boolean(window.DAITIGN_TV&&window.DAITIGN_TV.handleBack&&window.DAITIGN_TV.handleBack())") { handled ->
                    if (handled == "true") return@evaluateJavascript
                    if (browse.canGoBack()) browse.goBack() else confirmExit()
                }
            }
        })
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (playerWebView == null) return super.dispatchKeyEvent(event)
        val pair = when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_CENTER -> "CENTER" to "OK"
            KeyEvent.KEYCODE_ENTER -> "ENTER" to "OK"
            KeyEvent.KEYCODE_DPAD_LEFT -> "LEFT" to "LEFT"
            KeyEvent.KEYCODE_DPAD_RIGHT -> "RIGHT" to "RIGHT"
            KeyEvent.KEYCODE_DPAD_UP -> "UP" to "UP"
            KeyEvent.KEYCODE_DPAD_DOWN -> "DOWN" to "DOWN"
            KeyEvent.KEYCODE_BACK -> "BACK" to "BACK"
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
            KeyEvent.KEYCODE_MEDIA_PLAY,
            KeyEvent.KEYCODE_MEDIA_PAUSE -> "MEDIA_PLAY_PAUSE" to "OK"
            else -> null
        } ?: return super.dispatchKeyEvent(event)

        if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
            Log.i(TAG, "[PLAYER KEY] ${pair.first}; state=$playerState focus=${playerWebView?.hasFocus()}")
            if (pair.second == "BACK") handlePlayerBack() else routePlayerKey(pair.second)
        }
        return true
    }

    private fun showBrowseFailure(reason: String) {
        mainHandler.removeCallbacks(startupWatchdog)
        errorText.text = if (isDebugBuild) "$reason\nURL: ${browseWebView?.url ?: APP_URL}" else reason
        errorOverlay.visibility = View.VISIBLE
        errorOverlay.bringToFront()
        retryButton.requestFocus()
        Log.e(TAG, "browse failure visible: $reason")
    }

    private fun showFatalStartupError(error: Throwable) {
        Log.e(TAG, "DAITIGN STARTUP ERROR", error)
        val fallback = TextView(this).apply {
            setBackgroundColor(Color.rgb(34, 34, 34))
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 30f)
            gravity = Gravity.CENTER
            text = "DAITIGN STARTUP ERROR\n${error.javaClass.name}\n${error.message ?: "No message"}"
        }
        runCatching { setContentView(fallback) }
    }

    private fun enterImmersiveMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.run {
                hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                systemBarsBehavior = android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        }
    }

    private fun confirmExit() {
        val now = System.currentTimeMillis()
        if (now - lastBackAt <= EXIT_INTERVAL_MS) finish()
        else {
            lastBackAt = now
            Toast.makeText(this, R.string.press_again_to_exit, Toast.LENGTH_SHORT).show()
        }
    }

    private fun openExternal(uri: Uri): Boolean = try {
        startActivity(Intent(Intent.ACTION_VIEW, uri))
        true
    } catch (_: Exception) {
        false
    }

    private fun destroyBrowseWebView() {
        browseWebView?.run {
            webViewContainer.removeView(this)
            removeJavascriptInterface("AndroidTVBridge")
            destroy()
        }
        browseWebView = null
    }

    private fun matchParentParams() = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
    )

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    override fun onResume() {
        super.onResume()
        browseWebView?.onResume()
        browseWebView?.resumeTimers()
        playerWebView?.onResume()
        playerWebView?.resumeTimers()
    }

    override fun onPause() {
        browseWebView?.onPause()
        playerWebView?.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        mainHandler.removeCallbacksAndMessages(null)
        playerHandler.removeCallbacksAndMessages(null)
        if (customView != null) hideCustomView()
        destroyPlayerWebView()
        destroyBrowseWebView()
        super.onDestroy()
    }
}
