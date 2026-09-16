package com.daitign.stream

import android.webkit.JavascriptInterface

class PlayerBridge(private val activity: MainActivity) {
    @JavascriptInterface fun setPlayerState(state: String) = activity.setPlayerState(state)
}
