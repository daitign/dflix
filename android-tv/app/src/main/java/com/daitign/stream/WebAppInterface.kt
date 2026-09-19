package com.daitign.stream

import android.webkit.JavascriptInterface

class WebAppInterface(private val activity: MainActivity) {
    @JavascriptInterface fun isTV(): Boolean = true
    @JavascriptInterface fun getPlatform(): String = activity.getTvPlatformName()
    @JavascriptInterface fun getAppVersion(): String = BuildConfig.VERSION_NAME
    @JavascriptInterface fun logPreviewEvent(message: String) = activity.logPreviewEvent(message)
    @JavascriptInterface fun startTvPlayer(url: String, stateJson: String) = activity.startTvPlayer(url, stateJson)
    @JavascriptInterface fun closeTvPlayer() = activity.closeTvPlayer()
    @JavascriptInterface fun setPlayerState(state: String) = activity.setPlayerState(state)
    @JavascriptInterface fun exitApp() = activity.runOnUiThread { activity.finish() }
}
