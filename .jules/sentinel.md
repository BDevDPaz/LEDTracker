## 2025-05-01 - [Remove hardcoded admin password]
**Vulnerability:** A hardcoded admin password (`const ADMIN_PASSWORD = "admin123";`) was found in `app/(tabs)/settings.tsx`, allowing local bypass or leaking credentials to source control.
**Learning:** Hardcoded credentials are a CRITICAL vulnerability as they are permanently baked into the app bundle. Using `process.env` allows managing credentials per-environment.
**Prevention:** Always use environment variables (`process.env.EXPO_PUBLIC_*` for Expo or securely handled via a remote config/API) for administrative access codes instead of plain strings in component files.
