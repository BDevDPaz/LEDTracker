## 2025-05-01 - [Remove hardcoded admin password]
**Vulnerability:** A hardcoded admin password (`const ADMIN_PASSWORD = "admin123";`) was found in `app/(tabs)/settings.tsx`, allowing local bypass or leaking credentials to source control.
**Learning:** Hardcoded credentials are a CRITICAL vulnerability as they are permanently baked into the app bundle. Using `process.env` allows managing credentials per-environment.
**Prevention:** Always use environment variables (`process.env.EXPO_PUBLIC_*` for Expo or securely handled via a remote config/API) for administrative access codes instead of plain strings in component files.
## 2025-05-02 - [Prevent XSS in HTML Report Generator]
**Vulnerability:** Unsanitized user inputs (`client_name`, `address`, `manual_note`) and settings were interpolated directly into the HTML string used by `expo-print` in `src/services/ReportGenerator.ts`, allowing XSS and HTML injection.
**Learning:** Even though the app generates a PDF, rendering malicious HTML/JavaScript strings via a Webview (which `expo-print` relies on) can expose the app or the generated document to script execution and content spoofing.
**Prevention:** Always use an HTML escaping utility (like `escape-html`) to sanitize any dynamically generated content originating from user inputs or database records before injecting them into HTML template literals.
