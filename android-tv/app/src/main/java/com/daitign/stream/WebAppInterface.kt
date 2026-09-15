package com.daitign.stream

import android.app.Activity
import android.webkit.JavascriptInterface
import android.widget.Toast

class WebAppInterface(private val activity: MainActivity) {

    @JavascriptInterface
    fun exitApp() {
        activity.runOnUiThread {
            activity.finish()
        }
    }

    @JavascriptInterface
    fun showToast(message: String) {
        activity.runOnUiThread {
            Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun getAppVersion(): String {
        return "1.0.0"
    }

    @JavascriptInterface
    fun isTV(): Boolean {
        return true
    }

    @JavascriptInterface
    fun startTvPlayer(vidstuckUrl: String, stateJson: String) {
        activity.startTvPlayer(vidstuckUrl, stateJson)
    }

    @JavascriptInterface
    fun closeTvPlayer() {
        activity.closeTvPlayer()
    }

    @JavascriptInterface
    fun setPlayerState(state: String) {
        activity.setPlayerStateFromJs(state)
    }
}
