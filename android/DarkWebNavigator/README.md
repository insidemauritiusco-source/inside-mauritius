# Dark Web Navigator v2.0 Pro

Independent Android companion for **official Tor Browser**. It is not itself a Tor browser and has no INTERNET permission, embedded WebView, tracking SDK or analytics.

## Five upgrades
1. Privacy & Security Center: Tor installed status, check.torproject.org shortcut, official Tor Security Level instructions, launcher recents off by default and local clear button.
2. Protected bookmarks: AES-256-GCM using Android Keystore and device PIN/password/fingerprint authentication. Existing plaintext v1.1 bookmarks are migrated and deleted from plaintext only after a successful device authentication and encryption. Access is locked on background/after authorization window; sensitive bookmark screen disables screenshots.
3. Search choices: DuckDuckGo / Brave Search / Startpage, with search text forwarded only as Tor Browser link intents.
4. New launcher logo, professional dark/light theme and redesigned tabs.
5. Mauritius official law/property research shortcuts: Registrar-General, government legal portal, Supreme Court e-Judiciary, and National Assembly Hansard.

Build using GitHub Actions in isolated feature branch and download debug APK from workflow artifact. Not a Google Play app. Build passing does not replace Android device or security tests.

## Compatibility
Android 8.0+ (min API 26). Device lock required for protected bookmarks. Native biometrics used on compatible phones; otherwise Android device credential prompt.

## Security boundaries
Encrypted bookmarks are *only* this app's saved links. Recent launcher links are opt-in and not encrypted; they do NOT represent the history inside Tor Browser. Deleting this app's data does not delete Tor Browser data. Uninstalling the app deletes the local vault and its decryption key. Android debug builds are signed with ephemeral keys, so installing over a previous APK may require uninstalling the old version first. This also loses old local bookmarks if they were not preserved manually. Use the original official Tor Browser for real Tor networking.

## Build verification
GitHub workflow executes Java URL validation smoke tests, checks no INTERNET permission, compiles the Android APK, and uploads it on success. Fingerprint/device credential and encrypted-vault runtime behaviour require device testing.
