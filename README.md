# LED Tracker v2.2 - Professional Inventory & Audit

A production-ready React Native (Expo) application for automated work shift tracking, payroll calculation, and data integrity auditing.

## 🏗️ System Architecture

The system follows a decoupled, layered architecture to ensure testability, maintainability, and production stability.

### 📂 Directory Structure & Responsibilities

- **`app/`**: UI Layer (Expo Router). Contains screen definitions and navigation.
- **`src/engine/`**: System Engine (Core Logic).
  - **`contracts/`**: Formal Event and State type definitions.
  - **`reducer/`**: Pure state transitions.
  - **`effects/`**: Side-effect management (DB, Location, Notifications).
  - **`selectors/`**: State extraction logic.
  - **`state/`**: Initial state configuration.
- **`src/runtime/`**: Hardware & Service Adapters. Decouples third-party dependencies (Expo, SQLite) from business logic.
- **`src/services/`**: Business Services. Location monitoring, Background tasks, and Report generation.
- **`src/database/`**: Persistence Layer. SQLite configuration with WAL (Write-Ahead Logging) and ACID transactions.
- **`src/components/`**: Reusable UI elements.
  - **`ui/`**: Foundation components (Buttons, Cards).
  - **`modals/`**: Flow-specific interaction overlays.
- **`src/utils/`**: Pure utility functions for payroll, date, and geolocation math.
- **`scripts/audit/`**: Automated Gold Master auditing system.

## ⚙️ System Engine

The **WorkTrackerEngine** implements a unidirectional data flow (Events → Reducer → Effects → Runtime).
- **Consistency**: Protected by a Redux-like pattern where only the reducer can modify state.
- **Concurrency**: Background tasks use an asynchronous mutex to prevent stale state usage.

## 📍 Geolocation & Background Flow

- **Hysteresis Monitoring**: The `LocationFSM` prevents GPS noise from triggering false check-ins by requiring 3 consecutive samples.
- **Failsafe System**: A background task periodically checks for persistent "EXIT" states to auto-close sessions if the user leaves the area without checking out.
- **Permissions**: Implements strict checks for Foreground and Background location permissions (GEO-005).

## 💰 Payroll & Business Logic

- **Precision**: Calculations are performed using integer minutes to avoid floating-point drift.
- **Rules**: Supports California-style overtime (>8h daily) and automatic lunch deductions (>6h shift).
- **Auditability**: Every critical action (GPS check-in, manual edit, auto-checkout) is recorded in an immutable `audit_logs` table.

## 🛡️ Security & Integrity

- **Sanitization**: Inputs are sanitized before storage and report generation.
- **Data Integrity**: WAL mode enabled for SQLite to prevent corruption during unexpected shutdowns.
- **Minimal Surface**: Permissions in `app.json` are restricted to the absolute minimum required for tracking.

## 🧪 Testing & Quality

- **Unit Testing**: Jest + Bun test suite with >95% coverage on core logic.
- **Gold Master**: Automated security and architectural scanner to ensure compliance with production standards.
- **Linting**: Strict ESLint configuration for React 19 and TypeScript.

---
**Maintained by**: Jules (Expert Software Engineer)
**License**: Proprietary - LEON'S ELECTRICAL DESIGN
