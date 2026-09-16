package com.daitign.stream

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
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
        private const val APP_URL = "https://daiflix.vercel.app?tv=1"
        private const val EXIT_INTERVAL_MS = 2_000L
        private const val TV_USER_AGENT = " DAITIGN-TV/2.0"
    }

    private lateinit var webViewContainer: FrameLayout
    private lateinit var customViewContainer: FrameLayout
    private lateinit var splashOverlay: View
    private lateinit var errorView: View
    private lateinit var errorText: TextView
    private lateinit var retryButton: Button

    private var browseWebView: WebView? = null
    private var playerWebView: WebView? = null
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var customViewOwner: WebView? = null
    private var lastBackAt = 0L

    @Volatile
    private var playerState = PlayerState.PLAYER_HIDDEN

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        enterImmersiveMode()
        setContentView(R.layout.activity_main)

        webViewContainer = findViewById(R.id.webViewContainer)
        customViewContainer = findViewById(R.id.customViewContainer)
        splashOverlay = findViewById(R.id.splashOverlay)
        errorView = findViewById(R.id.errorView)
        errorText = findViewById(R.id.errorText)
        retryButton = findViewById(R.id.btnRetry)
        retryButton.setOnClickListener { loadBrowseApp() }

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
            @Suppress("DEPRECATION")
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
        errorView.visibility = View.GONE
        splashOverlay.alpha = 1f
        splashOverlay.visibility = View.VISIBLE
        val webView = browseWebView ?: createBrowseWebView().also {
            browseWebView = it
            webViewContainer.addView(it)
        }
        webView.visibility = View.VISIBLE
        webView.loadUrl(APP_URL)
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
    }

    private fun createBrowseWebView(): WebView = WebView(this).also { webView ->
        configureCommon(webView)
        webView.setBackgroundColor(0xFF141414.toInt())
        webView.addJavascriptInterface(WebAppInterface(this), "AndroidTVBridge")
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                errorView.visibility = View.GONE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                splashOverlay.animate().alpha(0f).setDuration(260).withEndAction {
                    splashOverlay.visibility = View.GONE
                    splashOverlay.alpha = 1f
                    view?.requestFocus()
                }
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) showNetworkError(error?.description?.toString())
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                if (request?.isForMainFrame != true) return false
                val uri = request.url
                if (uri.host == Uri.parse(APP_URL).host) return false
                return openExternal(uri)
            }
        }
        webView.webChromeClient = chromeClientFor(webView)
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
            val player = createPlayerWebView()
            playerWebView = player
            webViewContainer.addView(player)
            player.bringToFront()
            player.requestFocus()
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

    private fun showNetworkError(reason: String?) {
        splashOverlay.visibility = View.GONE
        errorView.visibility = View.VISIBLE
        errorText.text = reason?.takeIf { it.isNotBlank() } ?: getString(R.string.error_network)
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
