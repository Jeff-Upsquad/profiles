# Talent App — Test Handoff SOP

## Where to Test
- **iOS**: TestFlight → [App Store Connect](https://appstoreconnect.apple.com)
- **Android**: Internal Testing → [Google Play Console](https://play.google.com/console)
- **Web (live)**: https://squadhire.upsquadconnect.com/talent/* — already deployed via `scripts/deploy.sh`

## What Changed (Current Release — 1.1.17+27)
- **More tab → in-app WebView**: Every item under **More → Profile / Account** (Basic Profile, Job Profiles, My Clients, Settings, Training Program, Contact Support) now opens the responsive web page inside the app (`/talent/...?in_app=1`) instead of the native screens. Native routes are kept for deep-links but are hidden from the More list.
- **Auth bridge**: App appends `?app_token=`/`?app_refresh=`; web `AuthContext` consumes it and strips the query. `TalentLayout` hides outer chrome (`DashboardLayout`, top/bottom nav) when `?in_app=1`.
- **Fallback + extras**: `MoreWebViewScreen` injects token into `localStorage` if the page lands on `/login`, handles `mailto:`/`tel:`, back-stack inside WebView, refresh & "open in browser" actions, `webview_flutter` + `webBaseUrl` in `talent-app/lib/core/constants.dart`.

## How to Test

### 1. Web (already live on VPS)
No manual step — `scripts/deploy.sh` rebuilt frontend+backend and pm2 reloaded. Verify:
- `https://squadhire.upsquadconnect.com/talent/basic-profile?app_token=xxx&in_app=1` loads without login redirect and shows no outer sidebar.

### 2. Talent App Build & Release
```bash
cd talent-app

# Version already bumped to 1.1.17+27
flutter pub get

# iOS
flutter build ios --release
# Then archive in Xcode → Upload to App Store Connect

# Android
flutter build appbundle --release
# Then upload to Google Play Console
```

### 3. TestFlight / Internal Testing
1. Upload build to App Store Connect / Google Play Console
2. Add testers to TestFlight (iOS) or Internal Testing track (Android)
3. Testers install via TestFlight app (iOS) or Play Store (Android)

### 4. Key Flows to Test
- [ ] **More → Basic Profile**: tap → WebView opens `/talent/basic-profile` authenticated, edit & save works
- [ ] **More → Job Profiles**: lists role profiles, create/edit navigates inside WebView
- [ ] **More → My Clients**: shows client businesses, WhatsApp quit flow works
- [ ] **More → Settings / Training / Contact Support**: each loads the matching web page, in-app back goes back inside WebView before popping to More
- [ ] **Auth**: kill & relaunch → More items still auto-authenticated (no login screen in WebView)
- [ ] **External links**: `mailto:`/`tel:`/WhatsApp opens OS handler, not WebView

### 5. Production Release
- iOS: Submit for App Review → Release manually or automatically
- Android: Promote from Internal Testing to Production → Release

## Notes
- No Fastlane/CI/CD setup yet — manual builds required
- Firebase config files (`GoogleService-Info.plist`, `google-services.json`) must be present
- Version must be incremented before each release
