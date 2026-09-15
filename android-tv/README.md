# DAITIGN Stream — Android TV / Google TV Application

This is the dedicated Android TV wrapper for **DAITIGN Stream**, configured specifically for Google TV devices (such as Sharp Google TV, Sony BRAVIA Google TV, Chromecast with Google TV, and Xiaomi TV Box).

---

## Key Features

- **Leanback Launcher Integration**: Declares `android.intent.category.LEANBACK_LAUNCHER` with a 16:9 banner (`tv_banner.png`) for native Google TV launcher placement.
- **D-Pad Spatial Navigation**: Full remote control navigation (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Enter`, `Back`) without requiring mouse or touchscreen.
- **Focus & Preview System**: Hover is translated into focus. Focusing a card triggers the Netflix-style preview after a ~500ms delay. Moving focus away immediately dismisses the preview.
- **Row & Carousel Auto-Scroll**: Horizontal D-pad navigation smoothly centers off-screen cards; vertical D-pad navigation preserves horizontal position between carousel rows.
- **HTML5 Fullscreen Video Overlay**: Native `WebChromeClient` (`onShowCustomView` / `onHideCustomView`) ensures VIDSTUCK and embedded players expand to native fullscreen.
- **Four-Tier Back-Button Hierarchy**:
  1. Fullscreen Video $\rightarrow$ Exits fullscreen video to page.
  2. Details Modal $\rightarrow$ Closes the modal and returns focus to the triggering card.
  3. Watch Page $\rightarrow$ Navigates back to the browse catalog (`/`).
  4. Root/Browse $\rightarrow$ Requires double-tap Back within 2 seconds to prevent accidental app exits.
- **Zero Secrets / Maximum Security**: No TMDB API keys or secrets are stored in the APK. All catalog queries and proxy services flow through the production web app (`https://daiflix.vercel.app`).

---

## Prerequisites for Building

1. **Java Development Kit (JDK)**: JDK 17 (recommended: OpenJDK 17).
   - On macOS: `brew install openjdk@17`
2. **Android SDK**: Android API 34 SDK and Android SDK Command-line Tools.
   - Set `ANDROID_HOME` or `ANDROID_SDK_ROOT` to your Android SDK directory (e.g., `~/Library/Android/sdk`).

---

## How to Build the APK

Navigate to the `android-tv` directory:

```bash
cd android-tv
```

### Build Debug APK (For Sideloading)
```bash
./gradlew assembleDebug
```
The output APK is generated at:
```
android-tv/app/build/outputs/apk/debug/app-debug.apk
```

### Build Release APK
```bash
./gradlew assembleRelease
```
The output APK is generated at:
```
android-tv/app/build/outputs/apk/release/app-release-unsigned.apk
```

---

## How to Sideload onto Sharp Google TV

### Method 1: Wireless ADB (Recommended & Fastest)

1. **Enable Developer Options on Sharp Google TV**:
   - On your TV, go to **Settings** $\rightarrow$ **System** $\rightarrow$ **About**.
   - Scroll down to **Android TV OS build** and click the **Center / Select** button 7 times until you see the message *"You are now a developer!"*.
2. **Enable USB & Network Debugging**:
   - Go to **Settings** $\rightarrow$ **System** $\rightarrow$ **Developer Options**.
   - Enable **USB Debugging** and **Wireless Debugging** (or Network Debugging).
3. **Find your TV's IP address**:
   - Go to **Settings** $\rightarrow$ **Network & Internet** $\rightarrow$ Click on your connected Wi-Fi network $\rightarrow$ Note the IP address (e.g., `192.168.1.50`).
4. **Connect and Install from your Mac/PC**:
   ```bash
   adb connect 192.168.1.50:5555
   ```
   *(Accept the "Allow USB Debugging?" prompt that pops up on your TV screen using your remote)*.
   ```bash
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```
5. **Launch**:
   DAITIGN Stream will now appear in your Google TV **Apps** row with the red curved DAITIGN banner!

---

### Method 2: "Send Files to TV" App (No Computer Cable Required)

1. On your Sharp Google TV, open the **Google Play Store**.
2. Search for and install **Send Files to TV (SFTV)** and **File Commander** (or any file manager).
3. Install **Send Files to TV** on your Android phone or PC.
4. Transfer `app-debug.apk` to your Sharp Google TV over Wi-Fi using the app.
5. In your TV's **Settings** $\rightarrow$ **Apps** $\rightarrow$ **Security & Restrictions** $\rightarrow$ **Unknown Sources**, allow File Commander.
6. Open File Commander on your TV, navigate to `Download`, and click `app-debug.apk` to install.

---

### Method 3: USB Flash Drive

1. Copy `app-debug.apk` onto a FAT32-formatted USB flash drive.
2. Plug the USB drive into the USB port of your Sharp Google TV.
3. Open a file manager (such as FX File Explorer or File Commander) on your TV.
4. Select `app-debug.apk` and confirm **Install**.

---

## TV Remote Navigation Reference

| Remote Button | Action |
| :--- | :--- |
| **D-Pad Up / Down** | Moves between carousel rows, hero billboard, and top navigation header while preserving horizontal position. |
| **D-Pad Left / Right** | Scrolls horizontally through media cards within a carousel row, automatically keeping the focused card in view. |
| **D-Pad Center / OK** | Opens details modal or starts video playback. |
| **Back Button** | 1st press: Exits fullscreen video (if active)<br>2nd press: Closes details modal (if open)<br>3rd press: Returns from watch view to browse catalog<br>Double-press: Exits app with confirmation toast. |

---

## VIDSTUCK Player Technical Notes

The primary video player is embedded via an `<iframe>` from `vidstuck.xyz`:
- **Cross-Origin Sandbox**: Due to browser cross-origin boundaries (`Same-Origin Policy`), JavaScript running in the outer DAITIGN application cannot directly simulate DOM clicks inside the third-party player iframe.
- **Fullscreen Handshake**: When the player triggers fullscreen mode, standard HTML5 Fullscreen API fires. The Android TV `WebChromeClient` intercepts `onShowCustomView`, promoting the player to a full-screen hardware-accelerated overlay where native media controls and TV remote input operate seamlessly.
