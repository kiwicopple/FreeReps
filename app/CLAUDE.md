# iOS App

- Open `app/FreeReps.xcodeproj` in Xcode
- Requires physical device (HealthKit unavailable in Simulator)
- Bundle ID: `com.meltforce.freereps`

## Local build verification

GitHub Actions is disabled for this fork. For iOS changes, run the unsigned
build locally with full Xcode installed:

```bash
xcodebuild build -project app/FreeReps.xcodeproj -scheme FreeReps \
  -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO
```

Run from the repository root. This checks compilation; HealthKit behavior still
requires a physical device. The dashboard verification script does not build iOS.
