package com.daitign.stream

import android.webkit.JavascriptInterface

class PlayerBridge(private val activity: MainActivity) {
    @JavascriptInterface fun getPlatform(): String = activity.getTvPlatformName()
    @JavascriptInterface fun setPlayerState(state: String) = activity.setPlayerState(state)
}
