# DAITIGN Stream for Android TV / Google TV

The TV app is a native shell around the existing DAITIGN browse application. It does not fork the catalog or duplicate the desktop/mobile UI.

## Architecture

- `MainActivity` creates a programmatic native root and one browse WebView immediately. There is no opaque startup splash.
- Browse loads `https://daiflix.vercel.app/?tv=1` with the `DAITIGN-TV/3.0` user-agent marker.
- The web app adds `html.daitign-tv` and enables explicit `data-tv-focusable="true"` navigation.
- Startup retains a ten-second render watchdog, an on-screen failure message, and a focusable Retry action.
- Play keeps the browse WebView alive, validates the generated VIDSTUCK URL, then opens it at the top level in a dedicated player WebView.
- The player uses VIDSTUCK's original UI. DAITIGN adds no playback toolbar.
- Before the first VIDSTUCK load in a process, the same WebView/controller runs a short local synthetic-control test and logs its result.
- `tv-player-controller.js` discovers visible controls by semantics and screen geometry and reports the active player state to Kotlin.
- Closing playback destroys only the player WebView; the browse DOM, route, scroll positions, and focused card remain in memory.

## Player remote states

| State | Remote behavior |
| --- | --- |
| `PLAYER_HIDDEN` | OK reveals the original player controls and selects Play/Pause. Back returns to browse. |
| `PLAYER_CONTROLS` | Left/Right moves between visible controls; Up/Down moves to the nearest control in another row. |
| `PLAYER_TIMELINE` | Left/Right seeks only while the discovered timeline is selected. |
| `PLAYER_MENU` | Up/Down navigates the open Subtitle, Quality, Server, Settings, or related menu. |

Back closes the innermost layer in order: player menu/controls, HTML5 fullscreen, player, browse modal/history, then app exit confirmation.

## Build

Requirements:

- JDK 17
- Android SDK Platform 34
- a local Android SDK path through `ANDROID_HOME`, `ANDROID_SDK_ROOT`, or an untracked `local.properties`

```bash
cd android-tv
./gradlew clean assembleDebug
```

Debug APK:

```text
android-tv/app/build/outputs/apk/debug/app-debug.apk
```

## Diagnostics

Native startup, WebView lifecycle, preview console messages, player focus, D-pad keys, state transitions, control inventory, and synthetic-control results use one Logcat tag:

```bash
adb logcat -s DAITIGN-TV
```

The failure panel is hidden during healthy startup. A caught initialization exception replaces the window with a visible `DAITIGN STARTUP ERROR` message.

## Device validation

Validate at 1280×720, 1920×1080, and 3840×2160. On the Sharp TV, confirm previews reach the logged `PLAYING` state (audible first, muted fallback when blocked), then confirm the original VIDSTUCK controls respond to OK/D-pad and Back restores the same browse state without a reload.
