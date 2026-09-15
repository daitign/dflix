package com.daitign.stream

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
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
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback

enum class PlayerState {
    BROWSE,
    PLAYER_CONTROLS,
    PLAYER_TIMELINE,
    PLAYER_MENU
}

class MainActivity : ComponentActivity() {

    companion object {
        const val TAG = "DAITIGN-TV"
        const val PRODUCTION_URL = "https://daiflix.vercel.app?tv=1"
        private const val BACK_PRESS_INTERVAL_MS = 2000L
    }

    private var browseWebView: WebView? = null
    private var playerWebView: WebView? = null
    var playerState: PlayerState = PlayerState.BROWSE

    private lateinit var webViewContainer: FrameLayout
    private lateinit var customViewContainer: FrameLayout
    private lateinit var splashOverlay: View
    private lateinit var errorView: View
    private lateinit var errorTitle: TextView
    private lateinit var errorText: TextView
    private lateinit var btnRetry: Button

    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var lastBackPressTime = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        val previousHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Log.e(TAG, "[FATAL UNCAUGHT EXCEPTION] Thread: ${thread.name} - ${throwable.message}", throwable)
            previousHandler?.uncaughtException(thread, throwable)
        }

        Log.i(TAG, "==================================================")
        Log.i(TAG, "[MainActivity.onCreate] DAITIGN Stream starting up")
        Log.i(TAG, "[MainActivity.onCreate] Manufacturer: ${Build.MANUFACTURER}, Model: ${Build.MODEL}, Device: ${Build.DEVICE}")
        Log.i(TAG, "[MainActivity.onCreate] Android SDK: ${Build.VERSION.SDK_INT} (${Build.VERSION.RELEASE})")
        Log.i(TAG, "==================================================")

        super.onCreate(savedInstanceState)

        try {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            Log.d(TAG, "[MainActivity.onCreate] FLAG_KEEP_SCREEN_ON applied")
        } catch (t: Throwable) {
            Log.w(TAG, "[MainActivity.onCreate] Warning applying FLAG_KEEP_SCREEN_ON", t)
        }

        setupFullscreenMode()

        try {
            setContentView(R.layout.activity_main)
            Log.d(TAG, "[MainActivity.onCreate] Base layout inflated successfully")
        } catch (t: Throwable) {
            Log.e(TAG, "[MainActivity.onCreate] FATAL: Layout inflation failed", t)
            throw t
        }

        webViewContainer = findViewById(R.id.webViewContainer)
        customViewContainer = findViewById(R.id.customViewContainer)
        splashOverlay = findViewById(R.id.splashOverlay)
        errorView = findViewById(R.id.errorView)
        errorTitle = findViewById(R.id.errorTitle)
        errorText = findViewById(R.id.errorText)
        btnRetry = findViewById(R.id.btnRetry)

        btnRetry.setOnClickListener {
            Log.d(TAG, "[Retry] User triggered reload attempt")
            errorView.visibility = View.GONE
            splashOverlay.alpha = 1f
            splashOverlay.visibility = View.VISIBLE
            val wv = browseWebView
            if (wv != null) {
                wv.reload()
            } else {
                initAndLoadBrowseWebView()
            }
        }

        setupBackNavigation()
        initAndLoadBrowseWebView()
    }

    private fun setupFullscreenMode() {
        Log.d(TAG, "[fullscreen setup] Configuring immersive fullscreen flags...")
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.setDecorFitsSystemWindows(false)
                window.insetsController?.let { controller ->
                    controller.hide(
                        android.view.WindowInsets.Type.statusBars() or
                            android.view.WindowInsets.Type.navigationBars()
                    )
                    controller.systemBarsBehavior =
                        android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    Log.d(TAG, "[fullscreen setup] WindowInsetsController flags applied")
                }
            } else {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_FULLSCREEN
                )
                Log.d(TAG, "[fullscreen setup] Legacy systemUiVisibility flags applied")
            }
            Log.d(TAG, "[fullscreen setup] Fullscreen setup complete")
        } catch (t: Throwable) {
            Log.w(TAG, "[fullscreen setup] Warning configuring fullscreen flags", t)
        }
    }

    private fun initAndLoadBrowseWebView() {
        Log.d(TAG, "[Browse WebView] Initializing DAITIGN Stream browse view...")
        splashOverlay.alpha = 1f
        splashOverlay.visibility = View.VISIBLE
        errorView.visibility = View.GONE

        val newWebView = try {
            WebView(this).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                isFocusable = true
                isFocusableInTouchMode = true
                setBackgroundColor(0xFF141414.toInt())
            }
        } catch (t: Throwable) {
            Log.e(TAG, "[Browse WebView] FATAL: Android System WebView failed to instantiate", t)
            splashOverlay.visibility = View.GONE
            errorView.visibility = View.VISIBLE
            errorTitle.text = getString(R.string.app_name)
            errorText.text = "Android System WebView is not available or is currently updating on this TV.\n\nError: ${t.message}\n\nPlease check the Google Play Store for Android System WebView updates."
            return
        }

        browseWebView = newWebView
        webViewContainer.removeAllViews()
        webViewContainer.addView(newWebView)
        Log.d(TAG, "[Browse WebView] Created and mounted")

        configureBrowseWebView(newWebView)

        Log.d(TAG, "[Browse WebView] Loading DAITIGN: $PRODUCTION_URL")
        try {
            newWebView.loadUrl(PRODUCTION_URL)
        } catch (t: Throwable) {
            Log.e(TAG, "[Browse WebView] Failed to load URL: $PRODUCTION_URL", t)
            showNetworkError("Failed to initiate connection to DAITIGN Stream: ${t.message}")
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureBrowseWebView(wv: WebView) {
        val settings = wv.settings

        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        Log.i(TAG, "[WebView media settings] javaScriptEnabled=${settings.javaScriptEnabled}, domStorageEnabled=${settings.domStorageEnabled}, mediaPlaybackRequiresUserGesture=${settings.mediaPlaybackRequiresUserGesture}")

        try {
            val baseUA = settings.userAgentString ?: ""
            settings.userAgentString = if (baseUA.isNotBlank()) {
                "$baseUA DAITIGN-TV/1.0"
            } else {
                "Mozilla/5.0 (Linux; Android TV) DAITIGN-TV/1.0"
            }
        } catch (t: Throwable) {
            Log.w(TAG, "[Browse WebView] Warning setting User-Agent", t)
        }

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(wv, true)

        wv.addJavascriptInterface(WebAppInterface(this), "AndroidTVBridge")
        wv.requestFocus()

        wv.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                Log.d(TAG, "[Browse WebView.onPageStarted] $url")
                errorView.visibility = View.GONE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                Log.d(TAG, "[Browse WebView.onPageFinished] $url")
                if (splashOverlay.visibility == View.VISIBLE) {
                    splashOverlay.animate()
                        .alpha(0f)
                        .setDuration(450)
                        .withEndAction {
                            splashOverlay.visibility = View.GONE
                            splashOverlay.alpha = 1f
                        }
                }
                view?.evaluateJavascript(
                    "(function() { if (window.initTVMode) { window.initTVMode(); } else { document.documentElement.classList.add('daitign-tv'); } })();",
                    null
                )
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                val isMain = request?.isForMainFrame == true
                val errCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) error?.errorCode ?: -1 else -1
                val errDesc = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) error?.description ?: "Unknown" else "Unknown"
                Log.w(TAG, "[Browse WebView.onReceivedError] Main: $isMain, Code: $errCode, Desc: $errDesc, URL: ${request?.url}")

                if (isMain) {
                    splashOverlay.visibility = View.GONE
                    showNetworkError("Connection error ($errDesc). Please check your internet connection.")
                }
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                if (request != null && !request.isForMainFrame) {
                    return false
                }

                val url = request?.url ?: return false
                val path = url.path ?: ""
                Log.d(TAG, "[Browse WebView] Navigation requested: $url")

                // Intercept watch routes to launch native VIDSTUCK player directly (PART A)
                val movieMatch = Regex("^/watch/movie/(\\d+)").find(path)
                val tvMatch = Regex("^/watch/tv/(\\d+)/(\\d+)/(\\d+)").find(path)
                if (movieMatch != null) {
                    val tmdbId = movieMatch.groupValues[1].toIntOrNull() ?: 0
                    val vidstuckUrl = "https://vidstuck.xyz/embed/movie/$tmdbId?branding=DAITIGN&subtitle=english&overlay=true&color=e50914"
                    startTvPlayer(vidstuckUrl, "{\"tmdbId\":$tmdbId,\"type\":\"movie\"}")
                    return true
                } else if (tvMatch != null) {
                    val tmdbId = tvMatch.groupValues[1].toIntOrNull() ?: 0
                    val season = tvMatch.groupValues[2].toIntOrNull() ?: 1
                    val episode = tvMatch.groupValues[3].toIntOrNull() ?: 1
                    val vidstuckUrl = "https://vidstuck.xyz/embed/tv/$tmdbId/$season/$episode?branding=DAITIGN&subtitle=english&overlay=true&color=e50914"
                    startTvPlayer(vidstuckUrl, "{\"tmdbId\":$tmdbId,\"season\":$season,\"episode\":$episode,\"type\":\"tv\"}")
                    return true
                }

                val host = url.host ?: ""
                if (host.contains("daiflix.vercel.app") ||
                    host.contains("vidstuck.xyz") ||
                    host.contains("youtube.com") ||
                    host.contains("youtube-nocookie.com") ||
                    host.contains("youtu.be") ||
                    host.contains("googlevideo.com") ||
                    host.contains("ytimg.com")
                ) {
                    return false
                }

                return try {
                    val intent = Intent(Intent.ACTION_VIEW, url)
                    startActivity(intent)
                    true
                } catch (e: Exception) {
                    Log.w(TAG, "[Browse WebView] No activity for $url", e)
                    false
                }
            }
        }

        wv.webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                Log.i(TAG, "[HTML5 Fullscreen] Requested in browse view")
                if (customView != null) {
                    onHideCustomView()
                    return
                }

                customView = view
                customViewCallback = callback
                wv.visibility = View.GONE
                customViewContainer.addView(view)
                customViewContainer.visibility = View.VISIBLE
                setupFullscreenMode()
            }

            override fun onHideCustomView() {
                Log.i(TAG, "[HTML5 Fullscreen] Exiting")
                if (customView == null) return

                customViewContainer.visibility = View.GONE
                customViewContainer.removeView(customView)
                customView = null
                customViewCallback?.onCustomViewHidden()
                customViewCallback = null
                wv.visibility = View.VISIBLE
                wv.requestFocus()
                setupFullscreenMode()
            }

            override fun onPermissionRequest(request: android.webkit.PermissionRequest?) {
                Log.i(TAG, "[Browse WebChromeClient.onPermissionRequest] Resources: ${request?.resources?.joinToString()}")
                try {
                    request?.grant(request.resources)
                } catch (t: Throwable) {
                    Log.w(TAG, "[Browse WebChromeClient.onPermissionRequest] Failed to grant permissions", t)
                }
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                val msg = consoleMessage?.message() ?: ""
                val line = consoleMessage?.lineNumber() ?: 0
                val source = consoleMessage?.sourceId() ?: ""
                Log.d(TAG, "[Browse Console] [$source:$line] $msg")
                return super.onConsoleMessage(consoleMessage)
            }
        }
    }

    // ==========================================================================
    // Native TV Player Mode (PART A - PART F & PART L)
    // ==========================================================================

    fun startTvPlayer(vidstuckUrl: String, stateJson: String) {
        runOnUiThread {
            Log.i(TAG, "==================================================")
            Log.i(TAG, "[startTvPlayer] Entering native player mode")
            Log.i(TAG, "[startTvPlayer] VIDSTUCK URL: $vidstuckUrl")
            Log.i(TAG, "[startTvPlayer] Browse State: $stateJson")
            Log.i(TAG, "==================================================")

            playerState = PlayerState.PLAYER_CONTROLS

            // Save browse state in JS before hiding
            browseWebView?.evaluateJavascript(
                "(function() { if (window.DAITIGN_TV && window.DAITIGN_TV.saveBrowseState) { window.DAITIGN_TV.saveBrowseState(); } })();",
                null
            )

            // Keep browseWebView alive in memory! Use INVISIBLE to preserve hardware compositor surface:
            browseWebView?.visibility = View.INVISIBLE

            // Create or reuse playerWebView
            val pwv = playerWebView ?: createPlayerWebView().also {
                playerWebView = it
                webViewContainer.addView(it)
            }

            pwv.visibility = View.VISIBLE
            pwv.bringToFront()
            pwv.requestFocus()
            pwv.loadUrl(vidstuckUrl)
        }
    }

    fun closeTvPlayer() {
        runOnUiThread {
            Log.i(TAG, "[closeTvPlayer] Exiting native player, returning to DAITIGN browse in memory")
            playerState = PlayerState.BROWSE

            // Tear down playerWebView cleanly
            playerWebView?.let { pwv ->
                pwv.stopLoading()
                pwv.loadUrl("about:blank")
                webViewContainer.removeView(pwv)
                pwv.destroy()
            }
            playerWebView = null

            // Reveal browseWebView - exact scroll position, exact DOM preserved in memory!
            browseWebView?.let { bwv ->
                bwv.visibility = View.VISIBLE
                bwv.bringToFront()
                bwv.onResume()
                bwv.requestLayout()
                bwv.invalidate()
                bwv.requestFocus()
                bwv.evaluateJavascript(
                    """(function() {
                        if (window.DAITIGN_TV) {
                            if (window.DAITIGN_TV.restoreBrowseState) {
                                window.DAITIGN_TV.restoreBrowseState();
                            }
                            if (window.DAITIGN_TV.onPlayerClosed) {
                                window.DAITIGN_TV.onPlayerClosed();
                            }
                        }
                    })();""".trimIndent(),
                    null
                )
            }
        }
    }

    fun setPlayerStateFromJs(state: String) {
        playerState = when (state) {
            "PLAYER_TIMELINE" -> PlayerState.PLAYER_TIMELINE
            "PLAYER_MENU" -> PlayerState.PLAYER_MENU
            else -> PlayerState.PLAYER_CONTROLS
        }
        Log.d(TAG, "[Player State Updated] New state: $playerState (from JS: $state)")
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createPlayerWebView(): WebView {
        Log.d(TAG, "[Player WebView] Creating dedicated VIDSTUCK WebView...")
        val pwv = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            isFocusable = true
            isFocusableInTouchMode = true
            setBackgroundColor(0xFF000000.toInt())
        }

        val settings = pwv.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.cacheMode = WebSettings.LOAD_NO_CACHE
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        try {
            settings.userAgentString = "Mozilla/5.0 (Linux; Android TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 DAITIGN-TV/1.0"
        } catch (t: Throwable) {
            Log.w(TAG, "[Player WebView] Warning setting User-Agent", t)
        }

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(pwv, true)

        pwv.addJavascriptInterface(WebAppInterface(this), "AndroidTVBridge")

        pwv.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                Log.i(TAG, "[Player WebView.onPageFinished] Loaded: $url. Injecting TV Focus Controller...")
                injectTvPlayerFocusController(view)
            }
        }

        pwv.webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                Log.i(TAG, "[Player HTML5 Fullscreen] Requested in player view")
                if (customView != null) {
                    onHideCustomView()
                    return
                }

                customView = view
                customViewCallback = callback
                pwv.visibility = View.GONE
                customViewContainer.addView(view)
                customViewContainer.visibility = View.VISIBLE
                setupFullscreenMode()
            }

            override fun onHideCustomView() {
                Log.i(TAG, "[Player HTML5 Fullscreen] Exiting")
                if (customView == null) return

                customViewContainer.visibility = View.GONE
                customViewContainer.removeView(customView)
                customView = null
                customViewCallback?.onCustomViewHidden()
                customViewCallback = null
                pwv.visibility = View.VISIBLE
                pwv.requestFocus()
                setupFullscreenMode()
            }

            override fun onPermissionRequest(request: android.webkit.PermissionRequest?) {
                Log.i(TAG, "[Player WebChromeClient.onPermissionRequest] Resources: ${request?.resources?.joinToString()}")
                try {
                    request?.grant(request.resources)
                } catch (t: Throwable) {
                    Log.w(TAG, "[Player WebChromeClient.onPermissionRequest] Failed to grant permissions", t)
                }
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                val msg = consoleMessage?.message() ?: ""
                val line = consoleMessage?.lineNumber() ?: 0
                val source = consoleMessage?.sourceId() ?: ""
                Log.d(TAG, "[VIDSTUCK Console] [$source:$line] $msg")
                return super.onConsoleMessage(consoleMessage)
            }
        }

        return pwv
    }

    private fun injectTvPlayerFocusController(view: WebView?) {
        val script = """
            (function initDaitignTvPlayer() {
                if (window.__daitignTvPlayerInitialized) {
                    if (window.daitignTvPlayer && window.daitignTvPlayer.ensureDefaultFocus) {
                        window.daitignTvPlayer.ensureDefaultFocus();
                    }
                    return;
                }
                window.__daitignTvPlayerInitialized = true;

                console.log('[DAITIGN TV Player] Initializing TV Focus Controller inside VIDSTUCK...');

                // Borderless focus visual style with subtle scale, brightness, and halo glow
                var style = document.getElementById('daitign-tv-player-style');
                if (!style) {
                    style = document.createElement('style');
                    style.id = 'daitign-tv-player-style';
                    style.textContent = `
                        .daitign-tv-selected {
                            outline: none !important;
                            border: none !important;
                            border-color: transparent !important;
                            transform: scale(1.10) !important;
                            filter: brightness(1.25) drop-shadow(0 0 10px rgba(255, 255, 255, 0.45)) drop-shadow(0 0 6px rgba(229, 9, 20, 0.55)) !important;
                            box-shadow: none !important;
                            transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), filter 0.15s cubic-bezier(0.16, 1, 0.3, 1) !important;
                            z-index: 999999 !important;
                        }
                        .daitign-tv-selected-timeline {
                            outline: none !important;
                            border: none !important;
                            border-color: transparent !important;
                            filter: brightness(1.35) drop-shadow(0 0 12px rgba(229, 9, 20, 0.85)) drop-shadow(0 0 4px rgba(255, 255, 255, 0.6)) !important;
                            transform: scaleY(1.45) !important;
                            transition: transform 0.15s ease, filter 0.15s ease !important;
                            z-index: 999999 !important;
                        }
                        *:focus {
                            outline: none !important;
                        }
                    `;
                    document.head.appendChild(style);
                }

                var selectedElement = null;
                var lastOpenedButton = null;
                var lastSelectedBottomControl = null;
                var lastSelectedTopRightControl = null;
                var currentState = 'PLAYER_CONTROLS';

                function isVisible(el) {
                    if (!el || !el.isConnected) return false;
                    var rect = el.getBoundingClientRect();
                    if (rect.width <= 0 || rect.height <= 0) return false;
                    var s = window.getComputedStyle(el);
                    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
                    return rect.bottom >= 0 && rect.top <= window.innerHeight && rect.right >= 0 && rect.left <= window.innerWidth;
                }

                function getOpenMenu() {
                    var menuSelectors = [
                        '[data-slot="drawer-content"]',
                        '[data-slot="drawer-viewport"]',
                        '[data-slot="drawer-popup"]',
                        '[data-slot="popover-content"]',
                        '.shadow-2xl[class*="overflow-hidden"]',
                        '[role="menu"]',
                        '[role="dialog"]',
                        '[role="listbox"]',
                        '.art-settings-list',
                        '.art-setting-panel',
                        '.art-contextmenu',
                        '.art-layer-subtitle',
                        '.art-settings',
                        '.vjs-menu:not([style*="display: none"])',
                        '.vjs-menu-content',
                        '.settings-menu',
                        '.server-list',
                        '.subtitle-list',
                        '.quality-list',
                        '.dropdown-menu',
                        '.popup:not([style*="display: none"])',
                        '.modal:not([style*="display: none"])'
                    ];
                    for (var i = 0; i < menuSelectors.length; i++) {
                        var menus = document.querySelectorAll(menuSelectors[i]);
                        for (var j = 0; j < menus.length; j++) {
                            if (isVisible(menus[j])) return menus[j];
                        }
                    }
                    return null;
                }

                function discoverControls() {
                    var activeMenu = getOpenMenu();
                    if (activeMenu) {
                        var items = Array.from(activeMenu.querySelectorAll(
                            'button, [role="button"], [role="menuitem"], [role="option"], [data-slot="drawer-close"], a, input, select'
                        )).filter(function(el) {
                            return isVisible(el) && el.tagName.toLowerCase() !== 'ul';
                        });
                        if (items.length > 0) {
                            items.sort(function(a, b) {
                                var ra = a.getBoundingClientRect();
                                var rb = b.getBoundingClientRect();
                                if (Math.abs(ra.top - rb.top) > 10) return ra.top - rb.top;
                                return ra.left - rb.left;
                            });
                            return { type: 'menu', elements: items, container: activeMenu };
                        }
                    }

                    // 1. Discover Timeline (VIDSTUCK progress bar scrubber)
                    var timeline = null;
                    var timelineCandidate = document.querySelector(
                        'div.cursor-pointer.touch-none, [class*="cursor-pointer"][class*="touch-none"], .group > div.cursor-pointer'
                    );
                    if (timelineCandidate && isVisible(timelineCandidate)) {
                        timeline = timelineCandidate;
                    } else {
                        var allDivs = document.querySelectorAll('div');
                        for (var i = 0; i < allDivs.length; i++) {
                            var d = allDivs[i];
                            var cls = (d.className || '').toString();
                            if (cls.includes('cursor-pointer') && (cls.includes('touch-none') || cls.includes('h-6') || cls.includes('h-1.5'))) {
                                if (isVisible(d)) {
                                    timeline = d;
                                    break;
                                }
                            }
                        }
                    }

                    // 2. Discover interactive controls
                    var candidates = Array.from(document.querySelectorAll(
                        'button, [role="button"], a[href], [tabindex]:not([tabindex="-1"]), [aria-label], [title], .control'
                    )).filter(function(el) {
                        if (!isVisible(el)) return false;
                        var tag = el.tagName.toLowerCase();
                        if (tag === 'video') return false;
                        var rect = el.getBoundingClientRect();
                        if (rect.width > window.innerWidth * 0.75 && rect.height > window.innerHeight * 0.75) return false;
                        if (timeline && (el === timeline || timeline.contains(el))) return false;
                        return true;
                    });

                    // 3. Partition into Top-Right and Bottom controls
                    var winHeight = window.innerHeight;
                    var winWidth = window.innerWidth;
                    var midY = winHeight * 0.5;

                    var topRightButtons = [];
                    var bottomButtons = [];

                    for (var j = 0; j < candidates.length; j++) {
                        var btn = candidates[j];
                        var r = btn.getBoundingClientRect();
                        if (r.top < midY && r.left > winWidth * 0.3) {
                            topRightButtons.push(btn);
                        } else if (r.top >= midY) {
                            bottomButtons.push(btn);
                        }
                    }

                    // Sort Top-Right horizontally left-to-right
                    topRightButtons.sort(function(a, b) {
                        return a.getBoundingClientRect().left - b.getBoundingClientRect().left;
                    });

                    // Sort Bottom buttons horizontally left-to-right
                    bottomButtons.sort(function(a, b) {
                        return a.getBoundingClientRect().left - b.getBoundingClientRect().left;
                    });

                    return {
                        type: 'controls',
                        topRight: topRightButtons,
                        timeline: timeline,
                        bottom: bottomButtons,
                        all: candidates
                    };
                }

                function updateSelection(newEl) {
                    if (selectedElement) {
                        selectedElement.classList.remove('daitign-tv-selected');
                        selectedElement.classList.remove('daitign-tv-selected-timeline');
                    }
                    selectedElement = newEl;
                    if (selectedElement) {
                        var activeMenu = getOpenMenu();
                        if (activeMenu) {
                            currentState = 'PLAYER_MENU';
                            selectedElement.classList.add('daitign-tv-selected');
                        } else {
                            var controls = discoverControls();
                            var isTimeline = Boolean(controls.timeline && (selectedElement === controls.timeline || controls.timeline.contains(selectedElement)));
                            if (isTimeline) {
                                currentState = 'PLAYER_TIMELINE';
                                selectedElement.classList.add('daitign-tv-selected-timeline');
                            } else {
                                currentState = 'PLAYER_CONTROLS';
                                selectedElement.classList.add('daitign-tv-selected');
                                var r = selectedElement.getBoundingClientRect();
                                if (r.top >= window.innerHeight * 0.5) {
                                    lastSelectedBottomControl = selectedElement;
                                } else {
                                    lastSelectedTopRightControl = selectedElement;
                                }
                            }
                        }

                        try { selectedElement.focus({ preventScroll: true }); } catch (e) {}
                    } else {
                        currentState = 'PLAYER_CONTROLS';
                    }

                    if (window.AndroidTVBridge && window.AndroidTVBridge.setPlayerState) {
                        window.AndroidTVBridge.setPlayerState(currentState);
                    }
                }

                function getVideo() {
                    return document.querySelector('video');
                }

                function keepControlsVisible() {
                    var evt = new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: window.innerWidth / 2, clientY: window.innerHeight - 50 });
                    document.dispatchEvent(evt);
                    var backdrop = document.querySelector('div.absolute.inset-0, .art-video-player, video');
                    if (backdrop) backdrop.dispatchEvent(evt);
                    var controlsWrap = document.querySelector('div.z-30, .art-bottom, .art-controls');
                    if (controlsWrap) {
                        controlsWrap.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
                    }
                }

                var controlsVisible = true;
                var controlsFadeTimer = null;

                function showControls() {
                    controlsVisible = true;
                    keepControlsVisible();
                    if (controlsFadeTimer) clearTimeout(controlsFadeTimer);
                    controlsFadeTimer = setTimeout(function() {
                        if (currentState !== 'PLAYER_MENU') {
                            controlsVisible = false;
                        }
                    }, 4500);
                }

                function hideControls() {
                    controlsVisible = false;
                    if (controlsFadeTimer) clearTimeout(controlsFadeTimer);
                    if (selectedElement) {
                        selectedElement.classList.remove('daitign-tv-selected');
                        selectedElement.classList.remove('daitign-tv-selected-timeline');
                        try { selectedElement.blur(); } catch (e) {}
                        selectedElement = null;
                    }
                    var evt = new MouseEvent('mouseleave', { bubbles: true, cancelable: true, clientX: 0, clientY: 0 });
                    document.dispatchEvent(evt);
                    var controlsWrap = document.querySelector('div.z-30, .art-bottom, .art-controls');
                    if (controlsWrap) {
                        controlsWrap.dispatchEvent(evt);
                    }
                }

                // Intercept capture phase to stop VIDSTUCK from executing default seeking unless on timeline!
                function captureKey(e) {
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                        if (currentState !== 'PLAYER_TIMELINE') {
                            e.stopImmediatePropagation();
                            e.preventDefault();
                        }
                    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        e.stopImmediatePropagation();
                        e.preventDefault();
                    }
                }
                window.addEventListener('keydown', captureKey, true);
                document.addEventListener('keydown', captureKey, true);

                window.daitignTvPlayer = {
                    getState: function() { return currentState; },
                    handleKey: function(key) {
                        console.log('[DAITIGN TV Player] handleKey:', key, 'currentState:', currentState, 'controlsVisible:', controlsVisible);

                        var activeMenu = getOpenMenu();

                        // 1. Menu hierarchy: if open, navigate or close on BACK
                        if (activeMenu) {
                            showControls();
                            var controls = discoverControls();
                            if (controls.type === 'menu') {
                                currentState = 'PLAYER_MENU';
                                var items = controls.elements;
                                if (items.length === 0) return true;

                                var currentIndex = items.indexOf(selectedElement);
                                if (currentIndex === -1) currentIndex = 0;

                                if (key === 'UP') {
                                    updateSelection(items[Math.max(0, currentIndex - 1)]);
                                    return true;
                                } else if (key === 'DOWN') {
                                    updateSelection(items[Math.min(items.length - 1, currentIndex + 1)]);
                                    return true;
                                } else if (key === 'CENTER' || key === 'ENTER') {
                                    if (selectedElement) {
                                        selectedElement.click();
                                        setTimeout(function() {
                                            var m = getOpenMenu();
                                            if (m) {
                                                var nc = discoverControls();
                                                if (nc.type === 'menu' && nc.elements.length > 0) {
                                                    updateSelection(nc.elements[0]);
                                                    return;
                                                }
                                            }
                                            if (lastOpenedButton && isVisible(lastOpenedButton)) {
                                                updateSelection(lastOpenedButton);
                                            } else {
                                                window.daitignTvPlayer.ensureDefaultFocus();
                                            }
                                        }, 200);
                                    }
                                    return true;
                                } else if (key === 'BACK') {
                                    var closeBtn = activeMenu.querySelector('button.close, [data-slot="drawer-close"], [aria-label*="Close" i], .close');
                                    if (closeBtn) {
                                        closeBtn.click();
                                    } else {
                                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
                                    }
                                    setTimeout(function() {
                                        if (lastOpenedButton && isVisible(lastOpenedButton)) {
                                            updateSelection(lastOpenedButton);
                                        } else {
                                            window.daitignTvPlayer.ensureDefaultFocus();
                                        }
                                    }, 150);
                                    return true;
                                }
                                return true;
                            }
                        }

                        // 2. If controls are not visible / dismissed
                        if (!controlsVisible || !selectedElement || !selectedElement.isConnected || !isVisible(selectedElement)) {
                            if (key === 'BACK') {
                                // Controls already hidden: check fullscreen or exit player
                                if (document.fullscreenElement || document.webkitFullscreenElement) {
                                    if (document.exitFullscreen) document.exitFullscreen();
                                    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                                    return true;
                                }
                                return false; // Exit player back to browse
                            }

                            // Pressing ENTER / CENTER or Arrows when controls are hidden wakes controls & focuses Play/Pause
                            showControls();
                            this.ensureDefaultFocus();
                            return true;
                        }

                        // 3. Controls are visible and user pressed BACK: hide controls first
                        if (key === 'BACK') {
                            hideControls();
                            return true;
                        }

                        // 4. Normal controls navigation
                        showControls();
                        var controls = discoverControls();
                        var bottom = controls.bottom || [];
                        var topRight = controls.topRight || [];
                        var timeline = controls.timeline;

                        if (currentState === 'PLAYER_TIMELINE') {
                            if (key === 'LEFT') {
                                var v = getVideo();
                                if (v) {
                                    v.currentTime = Math.max(0, v.currentTime - 10);
                                    console.log('[DAITIGN TV Player] Seek backward 10s to ' + Math.round(v.currentTime));
                                }
                                return true;
                            } else if (key === 'RIGHT') {
                                var v = getVideo();
                                if (v) {
                                    var dur = v.duration || 999999;
                                    v.currentTime = Math.min(dur, v.currentTime + 10);
                                    console.log('[DAITIGN TV Player] Seek forward 10s to ' + Math.round(v.currentTime));
                                }
                                return true;
                            } else if (key === 'DOWN') {
                                if (bottom.length > 0) {
                                    updateSelection(lastSelectedBottomControl || bottom[0]);
                                }
                                return true;
                            } else if (key === 'UP') {
                                if (topRight.length > 0) {
                                    updateSelection(lastSelectedTopRightControl || topRight[0]);
                                }
                                return true;
                            } else if (key === 'CENTER' || key === 'ENTER') {
                                var v = getVideo();
                                if (v) {
                                    if (v.paused) v.play(); else v.pause();
                                }
                                return true;
                            }
                            return true;
                        }

                        // currentState === 'PLAYER_CONTROLS'
                        var isBottom = bottom.indexOf(selectedElement) !== -1;
                        var isTopRight = topRight.indexOf(selectedElement) !== -1;

                        if (isBottom) {
                            var bIdx = bottom.indexOf(selectedElement);
                            if (key === 'LEFT') {
                                updateSelection(bottom[Math.max(0, bIdx - 1)]);
                                return true;
                            } else if (key === 'RIGHT') {
                                updateSelection(bottom[Math.min(bottom.length - 1, bIdx + 1)]);
                                return true;
                            } else if (key === 'UP') {
                                if (timeline) {
                                    updateSelection(timeline);
                                } else if (topRight.length > 0) {
                                    updateSelection(lastSelectedTopRightControl || topRight[0]);
                                }
                                return true;
                            } else if (key === 'DOWN') {
                                return true; // Stay in bottom controls
                            } else if (key === 'CENTER' || key === 'ENTER') {
                                lastOpenedButton = selectedElement;
                                selectedElement.click();
                                selectedElement.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                setTimeout(function() {
                                    var menu = getOpenMenu();
                                    if (menu) {
                                        var menuControls = discoverControls();
                                        if (menuControls.type === 'menu' && menuControls.elements.length > 0) {
                                            updateSelection(menuControls.elements[0]);
                                        }
                                    }
                                }, 180);
                                return true;
                            }
                        } else if (isTopRight) {
                            var tIdx = topRight.indexOf(selectedElement);
                            if (key === 'LEFT') {
                                updateSelection(topRight[Math.max(0, tIdx - 1)]);
                                return true;
                            } else if (key === 'RIGHT') {
                                updateSelection(topRight[Math.min(topRight.length - 1, tIdx + 1)]);
                                return true;
                            } else if (key === 'DOWN') {
                                if (timeline) {
                                    updateSelection(timeline);
                                } else if (bottom.length > 0) {
                                    updateSelection(lastSelectedBottomControl || bottom[0]);
                                }
                                return true;
                            } else if (key === 'UP') {
                                return true; // Stay in top-right controls
                            } else if (key === 'CENTER' || key === 'ENTER') {
                                lastOpenedButton = selectedElement;
                                selectedElement.click();
                                selectedElement.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                setTimeout(function() {
                                    var menu = getOpenMenu();
                                    if (menu) {
                                        var menuControls = discoverControls();
                                        if (menuControls.type === 'menu' && menuControls.elements.length > 0) {
                                            updateSelection(menuControls.elements[0]);
                                        }
                                    }
                                }, 180);
                                return true;
                            }
                        }

                        return true;
                    },
                    ensureDefaultFocus: function() {
                        showControls();
                        var controls = discoverControls();
                        console.log('[DAITIGN TV Player] Discovered controls:', {
                            type: controls.type,
                            topRightCount: controls.topRight ? controls.topRight.length : 0,
                            bottomCount: controls.bottom ? controls.bottom.length : 0,
                            timelineFound: Boolean(controls.timeline)
                        });
                        if (controls.type === 'menu' && controls.elements.length > 0) {
                            updateSelection(controls.elements[0]);
                            return;
                        }
                        if (controls.bottom && controls.bottom.length > 0) {
                            if (lastSelectedBottomControl && controls.bottom.indexOf(lastSelectedBottomControl) !== -1) {
                                updateSelection(lastSelectedBottomControl);
                                return;
                            }
                            var playBtn = controls.bottom.find(function(b) {
                                var a = (b.getAttribute('aria-label') || '').toLowerCase();
                                var cls = (b.className || '').toLowerCase();
                                return a.includes('play') || a.includes('pause') || cls.includes('play');
                            }) || controls.bottom[0];
                            updateSelection(playBtn);
                        }
                    }
                };

                // Periodic check for initial mount of React controls
                var mountAttempts = 0;
                var mountInterval = setInterval(function() {
                    mountAttempts++;
                    var controls = discoverControls();
                    var found = Boolean((controls.bottom && controls.bottom.length > 0) || (controls.type === 'menu'));
                    if (found) {
                        window.daitignTvPlayer.ensureDefaultFocus();
                        clearInterval(mountInterval);
                    } else if (mountAttempts > 20) {
                        clearInterval(mountInterval);
                    }
                }, 300);
            })();
        """.trimIndent()

        view?.evaluateJavascript(script, null)
    }

    // ==========================================================================
    // Back Navigation (App-level + Player-level)
    // ==========================================================================

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                Log.d(TAG, "[Back Button] Pressed, playerState=$playerState")

                // If in native player mode:
                if (playerState != PlayerState.BROWSE) {
                    if (customView != null) {
                        (playerWebView?.webChromeClient ?: browseWebView?.webChromeClient)?.onHideCustomView()
                        return
                    }
                    playerWebView?.evaluateJavascript(
                        "(function() { return window.daitignTvPlayer ? window.daitignTvPlayer.handleKey('BACK') : false; })()",
                        ValueCallback { res ->
                            val handledInJs = res != null && res.trim() == "true"
                            if (!handledInJs) {
                                closeTvPlayer()
                            }
                        }
                    )
                    return
                }

                // Layer 1: HTML5 Fullscreen Video active -> exit fullscreen
                if (customView != null) {
                    Log.d(TAG, "[Back Button] Layer 1: Exiting fullscreen custom view")
                    browseWebView?.webChromeClient?.onHideCustomView()
                    return
                }

                // Layer 2: Ask Web App if it can handle back (e.g. Details Modal)
                val wv = browseWebView
                if (wv != null) {
                    wv.evaluateJavascript(
                        "(function() { return !!(window.DAITIGN_TV && window.DAITIGN_TV.handleBack && window.DAITIGN_TV.handleBack()); })()",
                        ValueCallback { result ->
                            val handledByWeb = result != null && result.trim() == "true"
                            Log.d(TAG, "[Back Button] Layer 2: Web handleBack result = $handledByWeb")
                            if (handledByWeb) return@ValueCallback

                            if (wv.canGoBack()) {
                                Log.d(TAG, "[Back Button] Layer 3: Navigating webView.goBack()")
                                wv.goBack()
                                return@ValueCallback
                            }

                            handleAppExit()
                        }
                    )
                } else {
                    handleAppExit()
                }
            }
        })
    }

    private fun handleAppExit() {
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastBackPressTime < BACK_PRESS_INTERVAL_MS) {
            Log.i(TAG, "[Back Button] Layer 4: Double back pressed within interval. Exiting application.")
            finish()
        } else {
            lastBackPressTime = currentTime
            Log.d(TAG, "[Back Button] Layer 4: First back press at root, showing exit toast.")
            Toast.makeText(
                this@MainActivity,
                getString(R.string.press_again_to_exit),
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    private fun showNetworkError(message: String) {
        splashOverlay.visibility = View.GONE
        errorView.visibility = View.VISIBLE
        errorTitle.text = getString(R.string.app_name)
        errorText.text = message
    }

    override fun onResume() {
        super.onResume()
        setupFullscreenMode()
        browseWebView?.onResume()
        playerWebView?.onResume()
    }

    override fun onPause() {
        super.onPause()
        browseWebView?.onPause()
        playerWebView?.onPause()
    }

    override fun onDestroy() {
        Log.i(TAG, "[MainActivity.onDestroy] Destroying Activity and WebViews")
        try {
            playerWebView?.let { pwv ->
                webViewContainer.removeView(pwv)
                pwv.destroy()
            }
            playerWebView = null

            browseWebView?.let { bwv ->
                webViewContainer.removeView(bwv)
                bwv.destroy()
            }
            browseWebView = null
        } catch (t: Throwable) {
            Log.w(TAG, "[MainActivity.onDestroy] Exception during WebView destroy", t)
        }
        super.onDestroy()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        // If in native player mode: intercept and route D-pad keys to player focus controller!
        if (playerState != PlayerState.BROWSE) {
            val pwv = playerWebView
            if (pwv != null) {
                if (event.action == KeyEvent.ACTION_DOWN) {
                    when (event.keyCode) {
                        KeyEvent.KEYCODE_DPAD_LEFT -> {
                            pwv.evaluateJavascript("window.daitignTvPlayer && window.daitignTvPlayer.handleKey('LEFT')", null)
                            return true
                        }
                        KeyEvent.KEYCODE_DPAD_RIGHT -> {
                            pwv.evaluateJavascript("window.daitignTvPlayer && window.daitignTvPlayer.handleKey('RIGHT')", null)
                            return true
                        }
                        KeyEvent.KEYCODE_DPAD_UP -> {
                            pwv.evaluateJavascript("window.daitignTvPlayer && window.daitignTvPlayer.handleKey('UP')", null)
                            return true
                        }
                        KeyEvent.KEYCODE_DPAD_DOWN -> {
                            pwv.evaluateJavascript("window.daitignTvPlayer && window.daitignTvPlayer.handleKey('DOWN')", null)
                            return true
                        }
                        KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                            pwv.evaluateJavascript("window.daitignTvPlayer && window.daitignTvPlayer.handleKey('CENTER')", null)
                            return true
                        }
                        KeyEvent.KEYCODE_BACK -> {
                            if (customView != null) {
                                (playerWebView?.webChromeClient ?: browseWebView?.webChromeClient)?.onHideCustomView()
                                return true
                            }
                            pwv.evaluateJavascript(
                                "(function() { return window.daitignTvPlayer ? window.daitignTvPlayer.handleKey('BACK') : false; })()",
                                ValueCallback { res ->
                                    val handledInJs = res != null && res.trim() == "true"
                                    if (!handledInJs) {
                                        closeTvPlayer()
                                    }
                                }
                            )
                            return true
                        }
                        KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_MEDIA_PLAY, KeyEvent.KEYCODE_MEDIA_PAUSE -> {
                            pwv.evaluateJavascript("window.daitignTvPlayer && window.daitignTvPlayer.handleKey('CENTER')", null)
                            return true
                        }
                    }
                } else if (event.action == KeyEvent.ACTION_UP) {
                    when (event.keyCode) {
                        KeyEvent.KEYCODE_DPAD_LEFT,
                        KeyEvent.KEYCODE_DPAD_RIGHT,
                        KeyEvent.KEYCODE_DPAD_UP,
                        KeyEvent.KEYCODE_DPAD_DOWN,
                        KeyEvent.KEYCODE_DPAD_CENTER,
                        KeyEvent.KEYCODE_ENTER,
                        KeyEvent.KEYCODE_BACK,
                        KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
                        KeyEvent.KEYCODE_MEDIA_PLAY,
                        KeyEvent.KEYCODE_MEDIA_PAUSE -> return true
                    }
                }
            }
        }

        return super.dispatchKeyEvent(event)
    }
}
