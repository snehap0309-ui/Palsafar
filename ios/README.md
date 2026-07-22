# PalSafar iOS Setup

Cross-platform React Native **0.81.5** (New Architecture + Hermes). Android remains the primary CI target on Windows; iOS builds require **macOS + Xcode 15+**.

## Bundle identity

| Key | Value |
|-----|-------|
| Display name | PalSafar |
| Bundle ID | `com.palsasafar` |
| Module name | `PalSafar` (must match `app.json`) |
| Min iOS | 15.1 |

## One-time Mac setup

```bash
# From repo root
npm install
npm run ios:setup          # bundle install + pod install + font assets
open ios/PalSafar.xcworkspace
```

1. **Signing** — Xcode → Target PalSafar → Signing & Capabilities → select Team (`DEVELOPMENT_TEAM` placeholder is empty).
2. **Firebase** — Download `GoogleService-Info.plist` for iOS app `com.palsasafar` and place at:
   `ios/PalSafar/GoogleService-Info.plist`
   Then add it to the Xcode target **Copy Bundle Resources** (drag into the PalSafar group if not auto-detected).
3. **APNs** — Apple Developer → Keys → APNs `.p8` → upload to Firebase → Project settings → Cloud Messaging.
4. **Push capability** — Entitlements file already enables Push + Associated Domains (`palsafar.com`). Switch `aps-environment` to `production` for App Store / TestFlight archives.
5. **Sentry dSYMs** — see `ios-sentry.setup.txt` and `sentry.properties`.
6. **AdMob** — Info.plist `GADApplicationIdentifier` currently uses Google’s **sample** iOS app id; replace before App Store submission (same as Android).

## Pods of note

Autolinked via CocoaPods after `pod install`:

- `@react-native-firebase/app` + `messaging`
- `@sentry/react-native`
- `react-native-maps` N/A (WebView Leaflet)
- `react-native-video`, `image-picker`, `geolocation-service`, `fast-image`, `permissions`, `google-mobile-ads`, `vector-icons` fonts, etc.

Podfile uses `$RNFirebaseAsStaticFramework = true` and `use_frameworks! :linkage => :static`.

## Notifications parity

| State | Android | iOS |
|-------|---------|-----|
| Permission | POST_NOTIFICATIONS + FCM | UNUserNotification via Firebase `requestPermission` |
| Foreground | `onMessage` → Alert | same JS path |
| Background / killed | `setBackgroundMessageHandler` in `index.js` | same + `UIBackgroundModes` remote-notification |
| Tap open | `onNotificationOpenedApp` / `getInitialNotification` | same |
| Token sync | `notificationsApi.registerToken` platform `android`/`ios` | same |

Badge categories: not customized yet (OS default). Deep link scheme `palsafar://` is registered in Info.plist.

## Crash reporting

JS `initMonitoring()` in `index.js` wraps both platforms. Native iOS crashes require:

1. Valid `SENTRY_DSN` / `monitoring.local.ts`
2. `pod install` (RNSentry)
3. Archive dSYM upload via sentry-cli (see `ios-sentry.setup.txt`)

## Verify builds

```bash
# Debug device / simulator
npm run ios

# Release compile (no signing export)
npm run build:ios
```

Android must still build:

```bash
npm run android
# or
npm run build:android
```

## App Store blockers (external)

- Real `GoogleService-Info.plist` + APNs key
- Production AdMob app id
- App icon assets in `Images.xcassets/AppIcon.appiconset`
- Privacy Nutrition Labels / App Privacy details
- Apple Developer Program membership + provisioning
- Sentry auth token for release symbolication
