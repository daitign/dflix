package com.daitign.stream

import android.annotation.SuppressLint
import android.content.pm.ApplicationInfo
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.ConsoleMessage
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
import android.net.http.SslError
import android.widget.Button
import android.widget.FrameLayout
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

class MainActivity : ComponentActivity() {
    companion object {
        private const val TAG = "DAITIGN-TV"
        private const val APP_URL = "https://daiflix.vercel.app/?tv=1"
        private const val EXIT_INTERVAL_MS = 2_000L
        private const val LOAD_TIMEOUT_MS = 9_000L
        private const val TV_USER_AGENT = " DAITIGN-TV/2.0"
    }

    private lateinit var rootContainer: FrameLayout
    private lateinit var webViewContainer: FrameLayout
    private lateinit var customViewContainer: FrameLayout
    private lateinit var splashOverlay: View
    private lateinit var errorView: View
    private lateinit var errorTitle: TextView
    private lateinit var errorText: TextView
    private lateinit var retryButton: Button

    private val startupHandler = Handler(Looper.getMainLooper())
    private var browseWebView: WebView? = null
    private var playerWebView: WebView? = null
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var customViewOwner: WebView? = null
    private var lastBackAt = 0L
    private var pageStarted = false
    private var pageFinished = false
    private var pageRendered = false
    private var loadFailed = false
    private var rendererGone = false
    private var lastLoadError: String? = null
    private var lastHttpStatus: Int? = null

    private val startupTimeout = Runnable {
        if (!pageFinished || !pageRendered) {
            Log.e(TAG, "startup timeout after ${LOAD_TIMEOUT_MS}ms")
            lastLoadError = lastLoadError ?: if (pageFinished) {
                "Page finished but application content did not render"
            } else {
                "Page did not finish within ${LOAD_TIMEOUT_MS / 1_000} seconds"
            }
            showStartupFailure()
        }
    }

    @Volatile
    private var playerState = PlayerState.PLAYER_HIDDEN

    private val isDebugBuild: Boolean
        get() = applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0

    override fun onCreate(savedInstanceState: Bundle?) {
        Log.i(TAG, "MainActivity.onCreate")
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        enterImmersiveMode()
        setContentView(R.layout.activity_main)
        Log.i(TAG, "root layout created")

        rootContainer = findViewById(R.id.rootContainer)
        webViewContainer = findViewById(R.id.webViewContainer)
        customViewContainer = findViewById(R.id.customViewContainer)
        splashOverlay = findViewById(R.id.splashOverlay)
        errorView = findViewById(R.id.errorView)
        errorTitle = findViewById(R.id.errorTitle)
        errorText = findViewById(R.id.errorText)
        retryButton = findViewById(R.id.btnRetry)
        retryButton.setOnClickListener {
            Log.i(TAG, "Retry selected")
            loadBrowseApp()
        }

        installBackHandler()
        loadBrowseApp()
    }

    private fun enterImmersiveMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.run {
                hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                systemBarsBehavior = android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                )
        }
    }

    private fun loadBrowseApp() {
        startupHandler.removeCallbacks(startupTimeout)
        pageStarted = false
        pageFinished = false
        pageRendered = false
        loadFailed = false
        lastLoadError = null
        lastHttpStatus = null
        if (rendererGone) {
            browseWebView?.let {
                webViewContainer.removeView(it)
                it.removeJavascriptInterface("AndroidTVBridge")
                it.destroy()
            }
            browseWebView = null
            rendererGone = false
        }
        errorView.visibility = View.GONE
        splashOverlay.alpha = 1f
        splashOverlay.visibility = View.VISIBLE
        val webView = browseWebView ?: try {
            createBrowseWebView().also {
                browseWebView = it
                Log.i(TAG, "browse WebView created")
                webViewContainer.addView(
                    it,
                    0,
                    FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT,
                    ),
                )
                Log.i(TAG, "browse WebView attached")
                it.post { logViewState("browse WebView attached and laid out") }
            }
        } catch (error: Throwable) {
            lastLoadError = "WebView creation failed: ${error.message ?: error.javaClass.simpleName}"
            Log.e(TAG, "browse WebView creation failed", error)
            showStartupFailure()
            return
        }
        webView.visibility = View.VISIBLE
        webView.bringToFront()
        splashOverlay.bringToFront()
        logViewState("URL about to load")
        Log.i(TAG, "URL about to load: $APP_URL")
        startupHandler.postDelayed(startupTimeout, LOAD_TIMEOUT_MS)
        try {
            webView.loadUrl(APP_URL)
        } catch (error: Throwable) {
            startupHandler.removeCallbacks(startupTimeout)
            loadFailed = true
            lastLoadError = "loadUrl failed: ${error.message ?: error.javaClass.simpleName}"
            Log.e(TAG, "loadUrl failed for $APP_URL", error)
            showStartupFailure()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureCommon(webView: WebView) {
        webView.layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        )
        webView.setBackgroundColor(0xFF000000.toInt())
        webView.isFocusable = true
        webView.isFocusableInTouchMode = true
        webView.settings.run {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode = true
            useWideViewPort = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = (userAgentString ?: "Mozilla/5.0 (Linux; Android TV)") + TV_USER_AGENT
        }
        CookieManager.getInstance().run {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }
        Log.i(
            TAG,
            "settings applied: javaScriptEnabled=${webView.settings.javaScriptEnabled}, " +
                "domStorageEnabled=${webView.settings.domStorageEnabled}, " +
                "mediaPlaybackRequiresUserGesture=${webView.settings.mediaPlaybackRequiresUserGesture}, " +
                "layerType=${webView.layerType}",
        )
    }

    private fun createBrowseWebView(): WebView = WebView(this).also { webView ->
        configureCommon(webView)
        webView.setBackgroundColor(0xFF141414.toInt())
        webView.addJavascriptInterface(WebAppInterface(this), "AndroidTVBridge")
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                pageStarted = true
                pageFinished = false
                pageRendered = false
                Log.i(TAG, "onPageStarted: $url")
                errorView.visibility = View.GONE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                pageFinished = true
                Log.i(TAG, "onPageFinished: $url")
                logViewState("page finished")
                if (loadFailed) {
                    showStartupFailure()
                    return
                }
                view?.let { verifyBrowseContent(it, allowRetry = true) }
            }

            override fun onPageCommitVisible(view: WebView?, url: String?) {
                Log.i(TAG, "first WebView paint committed: $url")
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                val message = "${error?.errorCode ?: -1}: ${error?.description ?: "Unknown WebView error"}"
                Log.e(TAG, "onReceivedError: main=${request?.isForMainFrame}, url=${request?.url}, error=$message")
                if (request?.isForMainFrame == true) {
                    loadFailed = true
                    lastLoadError = message
                    showStartupFailure()
                }
            }

            @Suppress("DEPRECATION")
            @Deprecated("Legacy callback for Android 5.x WebView compatibility")
            override fun onReceivedError(
                view: WebView?,
                errorCode: Int,
                description: String?,
                failingUrl: String?,
            ) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) return
                val message = "$errorCode: ${description ?: "Unknown WebView error"}"
                Log.e(TAG, "onReceivedError: url=$failingUrl, error=$message")
                loadFailed = true
                lastLoadError = message
                showStartupFailure()
            }

            override fun onReceivedHttpError(
                view: WebView?,
                request: WebResourceRequest?,
                errorResponse: WebResourceResponse?,
            ) {
                val status = errorResponse?.statusCode ?: -1
                Log.e(TAG, "onReceivedHttpError: main=${request?.isForMainFrame}, url=${request?.url}, status=$status")
                if (request?.isForMainFrame == true) {
                    loadFailed = true
                    lastHttpStatus = status
                    lastLoadError = "HTTP $status ${errorResponse?.reasonPhrase.orEmpty()}".trim()
                    showStartupFailure()
                }
            }

            override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
                val message = "SSL ${error?.primaryError ?: -1} at ${error?.url ?: APP_URL}"
                Log.e(TAG, "SSL validation failed: $message")
                loadFailed = true
                lastLoadError = message
                handler?.cancel()
                showStartupFailure()
            }

            override fun onRenderProcessGone(view: WebView?, detail: RenderProcessGoneDetail?): Boolean {
                rendererGone = true
                loadFailed = true
                lastLoadError = "WebView renderer exited (crashed=${detail?.didCrash() == true})"
                Log.e(TAG, "onRenderProcessGone: $lastLoadError")
                showStartupFailure()
                return true
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                if (request?.isForMainFrame != true) return false
                val uri = request.url
                val isDaitign = uri.host.equals(Uri.parse(APP_URL).host, ignoreCase = true)
                Log.i(TAG, "shouldOverrideUrlLoading: url=$uri, allowInWebView=$isDaitign")
                if (isDaitign) return false
                return openExternal(uri)
            }
        }
        webView.webChromeClient = chromeClientFor(webView)
    }

    private fun verifyBrowseContent(webView: WebView, allowRetry: Boolean) {
        webView.evaluateJavascript(
            "(function(){var root=document.getElementById('root');return !!(root&&root.childElementCount);})()",
        ) { result ->
            val rendered = result == "true"
            Log.i(TAG, "browse render probe: rendered=$rendered, result=$result")
            if (rendered) {
                pageRendered = true
                startupHandler.removeCallbacks(startupTimeout)
                errorView.visibility = View.GONE
                splashOverlay.animate().alpha(0f).setDuration(260).withEndAction {
                    splashOverlay.visibility = View.GONE
                    splashOverlay.alpha = 1f
                    webView.requestFocus()
                    logViewState("browse visible after first paint")
                }
            } else if (allowRetry) {
                startupHandler.postDelayed(
                    { verifyBrowseContent(webView, allowRetry = false) },
                    1_200L,
                )
            } else {
                loadFailed = true
                lastLoadError = "Page finished but application content did not render"
                showStartupFailure()
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

            browseWebView?.evaluateJavascript("window.DAITIGN_TV?.saveBrowseState?.()", null)
            browseWebView?.visibility = View.INVISIBLE
            destroyPlayerWebView()

            playerState = PlayerState.PLAYER_HIDDEN
            Log.i(TAG, "creating player WebView after playback request")
            val player = createPlayerWebView()
            playerWebView = player
            webViewContainer.addView(player)
            player.bringToFront()
            player.requestFocus()
            logViewState("player WebView attached")
            player.loadUrl(uri.toString())
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createPlayerWebView(): WebView = WebView(this).also { webView ->
        configureCommon(webView)
        webView.settings.cacheMode = WebSettings.LOAD_NO_CACHE
        webView.addJavascriptInterface(PlayerBridge(this), "AndroidTVBridge")
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                playerState = PlayerState.PLAYER_HIDDEN
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                injectPlayerAdapter(view)
            }
        }
        webView.webChromeClient = chromeClientFor(webView)
    }

    private fun chromeClientFor(owner: WebView) = object : WebChromeClient() {
        override fun onConsoleMessage(message: ConsoleMessage?): Boolean {
            message ?: return false
            Log.d(
                TAG,
                "WebView console ${message.messageLevel()}: ${message.message()} " +
                    "(${message.sourceId()}:${message.lineNumber()})",
            )
            return true
        }

        override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
            if (view == null || callback == null) return
            if (customView != null) hideCustomView()
            customView = view
            customViewCallback = callback
            customViewOwner = owner
            owner.visibility = View.INVISIBLE
            customViewContainer.addView(view)
            customViewContainer.visibility = View.VISIBLE
            enterImmersiveMode()
        }

        override fun onHideCustomView() = hideCustomView()

        override fun onPermissionRequest(request: PermissionRequest?) {
            request?.grant(request.resources)
        }
    }

    private fun injectPlayerAdapter(webView: WebView?) {
        val script = assets.open("tv-player-controller.js").bufferedReader().use { it.readText() }
        webView?.evaluateJavascript(script, null)
    }

    fun setPlayerState(value: String) {
        playerState = runCatching { PlayerState.valueOf(value) }.getOrDefault(PlayerState.PLAYER_CONTROLS)
    }

    fun closeTvPlayer() {
        runOnUiThread {
            if (customView != null) hideCustomView()
            destroyPlayerWebView()
            playerState = PlayerState.PLAYER_HIDDEN
            browseWebView?.run {
                visibility = View.VISIBLE
                bringToFront()
                onResume()
                requestFocus()
                evaluateJavascript("window.DAITIGN_TV?.onPlayerClosed?.()", null)
            }
        }
    }

    private fun destroyPlayerWebView() {
        playerWebView?.run {
            stopLoading()
            loadUrl("about:blank")
            webViewContainer.removeView(this)
            removeJavascriptInterface("AndroidTVBridge")
            destroy()
        }
        playerWebView = null
        Log.i(TAG, "player WebView destroyed")
        logViewState("after player removal")
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
        enterImmersiveMode()
    }

    private fun sendPlayerKey(key: String, callback: ValueCallback<String>? = null) {
        playerWebView?.evaluateJavascript("window.DAITIGN_TV_PLAYER?.handle('$key') === true", callback)
    }

    private fun routePlayerKey(key: String) {
        when (playerState) {
            PlayerState.PLAYER_HIDDEN -> sendPlayerKey(key) // OK/arrows reveal controls; Play/Pause is selected.
            PlayerState.PLAYER_CONTROLS -> sendPlayerKey(key) // LEFT/RIGHT move between controls.
            PlayerState.PLAYER_TIMELINE -> sendPlayerKey(key) // LEFT/RIGHT seek only in this state.
            PlayerState.PLAYER_MENU -> sendPlayerKey(key) // D-pad remains inside the open menu.
        }
    }

    private fun handlePlayerBack() {
        if (customView != null) {
            hideCustomView()
            return
        }
        sendPlayerKey("BACK") { handled -> if (handled != "true") closeTvPlayer() }
    }

    private fun installBackHandler() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (playerWebView != null) {
                    handlePlayerBack()
                    return
                }
                if (customView != null) {
                    hideCustomView()
                    return
                }
                val browse = browseWebView
                if (browse == null) {
                    finish()
                    return
                }
                browse.evaluateJavascript("window.DAITIGN_TV?.handleBack?.() === true") { result ->
                    if (result == "true") return@evaluateJavascript
                    if (browse.canGoBack()) browse.goBack() else confirmExit()
                }
            }
        })
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

    private fun showStartupFailure() {
        startupHandler.removeCallbacks(startupTimeout)
        splashOverlay.visibility = View.GONE
        browseWebView?.visibility = View.VISIBLE
        errorTitle.text = if (isDebugBuild) {
            "DAITIGN TV failed to load"
        } else {
            getString(R.string.app_name)
        }
        errorText.text = if (isDebugBuild) {
            buildString {
                appendLine("URL: ${browseWebView?.url ?: APP_URL}")
                appendLine("WebView created: ${if (browseWebView != null) "yes" else "no"}")
                appendLine("Page started: ${if (pageStarted) "yes" else "no"}")
                appendLine("Page finished: ${if (pageFinished) "yes" else "no"}")
                appendLine("App rendered: ${if (pageRendered) "yes" else "no"}")
                appendLine("Last error: ${lastLoadError ?: "none"}")
                append("HTTP status: ${lastHttpStatus?.toString() ?: "none"}")
            }
        } else {
            getString(R.string.error_network)
        }
        errorView.visibility = View.VISIBLE
        errorView.bringToFront()
        retryButton.requestFocus()
        logViewState("startup failure visible")
    }

    private fun logViewState(event: String) {
        val browse = browseWebView
        val player = playerWebView
        Log.i(
            TAG,
            "$event: current URL=${browse?.url ?: "none"}, " +
                "browse visibility=${browse?.visibility ?: -1}, player visibility=${player?.visibility ?: -1}, " +
                "browse index=${browse?.let(webViewContainer::indexOfChild) ?: -1}, " +
                "player index=${player?.let(webViewContainer::indexOfChild) ?: -1}, " +
                "web container index=${rootContainer.indexOfChild(webViewContainer)}, " +
                "splash index=${rootContainer.indexOfChild(splashOverlay)}, " +
                "error index=${rootContainer.indexOfChild(errorView)}, " +
                "custom fullscreen visibility=${customViewContainer.visibility}, " +
                "hardwareAccelerated=${browse?.isHardwareAccelerated ?: false}, layerType=${browse?.layerType ?: -1}",
        )
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (playerWebView == null) return super.dispatchKeyEvent(event)
        val mapped = when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_LEFT -> "LEFT"
            KeyEvent.KEYCODE_DPAD_RIGHT -> "RIGHT"
            KeyEvent.KEYCODE_DPAD_UP -> "UP"
            KeyEvent.KEYCODE_DPAD_DOWN -> "DOWN"
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER,
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_MEDIA_PLAY,
            KeyEvent.KEYCODE_MEDIA_PAUSE -> "OK"
            KeyEvent.KEYCODE_BACK -> "BACK"
            else -> null
        } ?: return super.dispatchKeyEvent(event)

        if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
            if (mapped == "BACK") handlePlayerBack() else routePlayerKey(mapped)
        }
        return true
    }

    override fun onResume() {
        super.onResume()
        enterImmersiveMode()
        browseWebView?.onResume()
        playerWebView?.onResume()
    }

    override fun onPause() {
        browseWebView?.onPause()
        playerWebView?.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        startupHandler.removeCallbacks(startupTimeout)
        destroyPlayerWebView()
        browseWebView?.run {
            webViewContainer.removeView(this)
            removeJavascriptInterface("AndroidTVBridge")
            destroy()
        }
        browseWebView = null
        super.onDestroy()
    }
}
