# WTracker v2.2 - Gold Master - Audit Report

Generated at: `2026-06-30T05:35:03.382Z`

## Summary

- Total: 3
- 🔴 Critical: 0
- 🟡 High: 0
- 🟢 Medium: 3
- 🔵 Low: 0
- ⚪️ Trace: 0

## security

### 🟢 SEC-001: Potential sensitive term detected: token

**Severity:** `medium`

**Description:** The term "token" was found in source code. This may be valid, but should be reviewed.

**Recommendation:** Verify that no secrets, tokens or sensitive credentials are hardcoded or logged.

**File:** `src/utils/__tests__/dateUtils.test.ts`

**Evidence:**

```text
token
```

### 🟢 SEC-001: Potential sensitive term detected: password

**Severity:** `medium`

**Description:** The term "password" was found in source code. This may be valid, but should be reviewed.

**Recommendation:** Verify that no secrets, tokens or sensitive credentials are hardcoded or logged.

**File:** `src/utils/i18n.ts`

**Evidence:**

```text
password
```

### 🟢 SEC-001: Potential sensitive term detected: password

**Severity:** `medium`

**Description:** The term "password" was found in source code. This may be valid, but should be reviewed.

**Recommendation:** Verify that no secrets, tokens or sensitive credentials are hardcoded or logged.

**File:** `app/(tabs)/settings.tsx`

**Evidence:**

```text
password
```
