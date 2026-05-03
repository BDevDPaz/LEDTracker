## 2025-05-01 - [Remove hardcoded admin password]
**Vulnerability:** A hardcoded admin password (`const ADMIN_PASSWORD = "admin123";`) was found in `app/(tabs)/settings.tsx`, allowing local bypass or leaking credentials to source control.
**Learning:** Hardcoded credentials are a CRITICAL vulnerability as they are permanently baked into the app bundle. Using `process.env` allows managing credentials per-environment.
**Prevention:** Always use environment variables (`process.env.EXPO_PUBLIC_*` for Expo or securely handled via a remote config/API) for administrative access codes instead of plain strings in component files.

## 2025-05-02 - [Fix XSS in PDF Generation]
**Vulnerability:** User-provided inputs (employee name, employer name, client, address, notes, logs details) were directly interpolated into HTML strings in `src/services/ReportGenerator.ts` without sanitization, leading to a Cross-Site Scripting (XSS) / HTML injection vulnerability when rendering PDFs via `expo-print`.
**Learning:** Generating HTML templates for PDFs is vulnerable to XSS if user inputs are not properly escaped. Libraries like `escape-html` must be used to sanitize dynamic text data before embedding it in HTML.
**Prevention:** Always use an HTML escaping function (e.g. `escape-html`) for all untrusted string inputs when constructing HTML strings dynamically for PDF generation or similar tasks.
