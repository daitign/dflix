# DAITIGN Stream for Android TV / Google TV

The TV app is a native shell around the existing DAITIGN browse application. It does not fork the catalog or duplicate web features.

## Architecture

- `MainActivity` keeps one browse WebView alive for the lifetime of the activity.
- Browse loads with both `?tv=1` and the `DAITIGN-TV/2.0` user-agent marker.
- The web app adds `html.daitign-tv` and enables explicit `data-tv-focusable="true"` navigation.
- Play saves browse state and opens the generated VIDSTUCK URL at the top level in a dedicated player WebView.
- The player uses VIDSTUCK's original UI. DAITIGN adds no playback toolbar.
- `tv-player-controller.js` discovers visible controls by semantics and position and reports the active player state to Kotlin.
- Closing playback destroys only the player WebView; the browse DOM, route, scroll positions, and focus remain in memory.

## Player remote states

| State | Remote behavior |
| --- | --- |
| `PLAYER_HIDDEN` | OK or a direction reveals controls and selects Play/Pause. Back returns to browse. |
| `PLAYER_CONTROLS` | Left/Right moves between visible controls; Up/Down moves between control rows. |
| `PLAYER_TIMELINE` | Left/Right dispatches seeking only while the timeline is selected. |
| `PLAYER_MENU` | D-pad stays inside the open Subtitle, Quality, Server, Settings, or related menu. |

Back closes the innermost layer in order: player menu, controls, HTML5 fullscreen, player, browse modal/history, then the app exit confirmation.

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

## Startup diagnostics

Native startup and WebView lifecycle messages use one Logcat tag:

```bash
adb logcat -s DAITIGN-TV
```

The debug APK replaces an unresolved splash after nine seconds with an on-screen
status panel and Retry action. Release builds show the same recovery action without
the detailed URL/error diagnostics.

`local.properties`, Gradle caches, APKs, and build output are ignored and must not be committed.

## Device validation

Validate at 1280×720, 1920×1080, and 3840×2160. Confirm the Home viewport shows the compact hero and complete Top 10 row, that only explicit controls receive focus, and that returning from playback restores the same focused media card and row position without reloading the catalog.
