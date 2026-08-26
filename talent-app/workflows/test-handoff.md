# Talent App — Test Handoff SOP

## Where to Test
- **iOS**: TestFlight → [App Store Connect](https://appstoreconnect.apple.com)
- **Android**: Internal Testing → [Google Play Console](https://play.google.com/console)

## What Changed (Current Release)
- **Bidding module** added to Offers screen — 4th tab showing active bids with status badges
- **Job card styling** updated with tinted top strip, description, badge chips
- **Subscription detail** shows current bid, bids remaining, match chips, additional requirements

## How to Test

### 1. Build & Release
```bash
cd talent-app

# Bump version in pubspec.yaml (version: X.Y.Z+N)
# Increment build number (+N) for each release

# Build for iOS
flutter build ios --release
# Then archive in Xcode → Upload to App Store Connect

# Build for Android
flutter build appbundle --release
# Then upload to Google Play Console
```

### 2. TestFlight / Internal Testing
1. Upload build to App Store Connect / Google Play Console
2. Add testers to TestFlight (iOS) or Internal Testing track (Android)
3. Testers install via TestFlight app (iOS) or Play Store (Android)

### 3. Key Flows to Test
- [ ] **Offers → Bidding tab**: Pull to refresh, verify bids load with status badges
- [ ] **Subscription detail**: Tap a card, verify match chips, additional requirements section
- [ ] **Job cards**: Verify tinted header, description, badge chips (package, joining date)
- [ ] **Bid actions**: Withdraw/accept/decline on existing offers
- [ ] **Pull-to-refresh**: All tabs refresh correctly

### 4. Production Release
- iOS: Submit for App Review → Release manually or automatically
- Android: Promote from Internal Testing to Production → Release

## Notes
- No Fastlane/CI/CD setup yet — manual builds required
- Firebase config files (`GoogleService-Info.plist`, `google-services.json`) must be present
- Version must be incremented before each release
