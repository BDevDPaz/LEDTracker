# 📊 ANÁLISIS EXHAUSTIVO DEL SISTEMA DE GEOLOCALIZACIÓN Y GEOFENCING
## LEDTracker - WTracker Auto-Check In/Out System

**Fecha del Análisis:** Julio 1, 2026  
**Repositorio:** `BDevDPaz/LEDTracker`  
**Tecnología:** React Native (Expo) + TypeScript + SQLite

---

## 📑 TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Dependencias entre Utilidades](#dependencias-entre-utilidades)
3. [Lista de Funciones Clave](#lista-de-funciones-clave)
4. [Tabla de Responsabilidades](#tabla-de-responsabilidades)
5. [Diagramas de Flujo](#diagramas-de-flujo)
6. [Posibles Casos Extremos](#posibles-casos-extremos)
7. [Propuestas de Optimización](#propuestas-de-optimización)
8. [Anexos](#anexos)

---

## 🎯 RESUMEN EJECUTIVO

El sistema **LEDTracker** implementa un tracker de jornadas laborales con detección automática de llegada y salida mediante **geofencing basado en GPS**. La arquitectura sigue un patrón **unidireccional (Redux-like)** con separación clara entre lógica de negocio, adapters de runtime y servicios.

### Características Principales:
- ✅ **Auto Check-in GPS:** Detección automática de entrada a geocerca
- ✅ **Auto Check-out GPS:** Detección automática de salida con failsafe a 45 min
- ✅ **Hysteresis Filtering:** Requiere 3 muestras consecutivas para validar cambio
- ✅ **Background Tasks:** Monitoreo en segundo plano sin necesidad de app abierta
- ✅ **Cálculo de Nómina:** Horas regulares, overtime (California-style) y almuerzo automático
- ✅ **Reportes PDF Semanales:** Generación y envío automático de reportes
- ✅ **Auditoría Inmutable:** Registro detallado de todos los eventos GPS

---

## 🔗 DEPENDENCIAS ENTRE UTILIDADES

### Mapa de Dependencias Jerárquico

```
┌─────────────────────────────────────────────────────────────┐
│                    UI LAYER (Expo Router)                    │
│                      app/(tabs)/*.tsx                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
    │  Components │  │    Context   │  │   Engine     │
    │  UI Widgets │  │   Provider   │  │   Container  │
    └─────────────┘  └──────────────┘  └──────┬───────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
                    ▼                         ▼                         ▼
          ┌──────────────────┐      ┌─────────────────┐      ┌──────────────┐
          │  workTrackerEngine│      │   Reducer       │      │   Effects    │
          │  (State Manager)  │      │   (Pure)        │      │  (Async)     │
          └─────────┬────────┘      └────────────────┘      └──────┬───────┘
                    │                                               │
        ┌───────────┴───────────┐                   ┌───────────────┴────────────┐
        │                       │                   │                            │
        ▼                       ▼                   ▼                            ▼
    ┌────────────┐      ┌──────────────┐     ┌────────────┐         ┌──────────────────┐
    │  Services  │      │  Runtime     │     │  Database  │         │  LocationService │
    │  (Business │      │  Adapters    │     │  (SQLite)  │         │  (Background)    │
    │   Logic)   │      │  (Expo APIs) │     └────────────┘         └──────┬───────────┘
    └────────┬───┘      └──────┬───────┘                                    │
             │                 │                    ┌────────────────────────┤
             │                 │                    │                        │
    ┌────────▼─────┐  ┌────────▼──────┐   ┌────────▼────┐      ┌───────────▼─────┐
    │LocationManager│  │LocationAdapter│   │  Geofence  │      │  Background     │
    │(Geofencing)  │  │(expo-location)│   │    Task    │      │  Tasks          │
    └────────┬─────┘  │                │   │ (TaskMgr)  │      │(expo-background)│
             │        └────────────────┘   └────┬───────┘      └────────┬────────┘
             │                                   │                      │
    ┌────────▼────────────┐      ┌──────────────▼────┐      ┌──────────▼────┐
    │  LocationFSM        │      │  LocationRegion   │      │  Failsafe     │
    │  (Hysteresis FSM)   │      │  (Expo Location)  │      │  Auto-Checkout│
    └─────────────────────┘      └───────────────────┘      └───────────────┘

    │
    ├─ UTILS ─────────────────────┐
    │                              │
    ├─ geoUtils (Haversine)       │
    ├─ payrollUtils (Nómina)      │
    ├─ dateUtils (Fechas)         │
    ├─ logger (Auditoría)         │
    └─ validation (Sanitización)  │
```

### Matriz de Dependencias

| **Componente** | **Depende de** | **Usado por** | **Crítico** |
|---|---|---|---|
| `workTrackerEngine` | Reducer, Effects, State | Context, Components | ⭐⭐⭐ |
| `workTrackerReducer` | initialState, contracts | Engine | ⭐⭐⭐ |
| `workTrackerEffects` | DB, LocationService, Security | Engine | ⭐⭐⭐ |
| `LocationManager` | LocationAdapter, LocationFSM, DB, Engine | Effects | ⭐⭐⭐ |
| `LocationFSM` | AsyncStorage, Mutex | LocationManager | ⭐⭐⭐ |
| `BackgroundTasks` | DB, Notifications, AsyncStorage, Engine | TaskManager | ⭐⭐⭐ |
| `locationAdapter` | expo-location, expo-task-manager | LocationManager | ⭐⭐⭐ |
| `ReportGenerator` | DB, payrollUtils, dateUtils, Sharing | Services | ⭐⭐ |
| `payrollUtils` | Constants | ReportGenerator, DB | ⭐⭐ |
| `geoUtils` | Math (Haversine) | Validation, Utils | ⭐ |
| `logger` | Expo-sqlite, dayjs | All | ⭐⭐ |
| `securityAdapter` | Zod validation | Effects (sanitización) | ⭐⭐ |

---

## 📋 LISTA DE FUNCIONES CLAVE

### **1. GEOFENCING & LOCATION TRACKING**

#### LocationManager.ts (8 KB)
| Función | Responsabilidad | Async | Dependencias |
|---------|-----------------|-------|--------------|
| `LocationService.requestPermissions()` | Solicitar permisos de ubicación (FG + BG) | ✅ | locationAdapter |
| `LocationService.startMonitoringArrival()` | Iniciar monitoreo de múltiples geocercas | ✅ | locationAdapter, LocationFSM, DB, Engine |
| `LocationService.stopMonitoring()` | Detener monitoreo global y limpiar FSM | ✅ | AsyncStorage, LocationFSM, locationAdapter |
| `LocationService.getCoordsFromAddress()` | Geocodificar dirección a coordenadas | ✅ | locationAdapter |
| `GEOFENCE_TASK` callback | Procesar eventos de entrada/salida de geocerca | ✅ | LocationFSM, DB, Engine, Notifications |

#### LocationFSM.ts (3.5 KB)
| Función | Responsabilidad | Estados | Samples Requeridas |
|---------|-----------------|--------|--------------------|
| `LocationFSM.update()` | Transición de estado con hysteresis | OUTSIDE → ENTERING → INSIDE → EXITING | 3 |
| `LocationFSM.reset()` | Limpiar estado de una o todas las geocercas | - | - |
| `acquireMutex()` | Proteger contra race conditions en updates | - | - |

### **2. BACKGROUND TASKS & AUTO-CHECKOUT**

#### BackgroundTasks.ts (8 KB)
| Función | Responsabilidad | Trigger | Threshold |
|---------|-----------------|---------|-----------|
| `APP_BACKGROUND_SERVICES` | Tarea periódica de sistema | Cada 15+ min (SO) | - |
| **Failsafe Auto Checkout** | Detectar salida persistente y auto-cerrar sesión | Existe EXIT_TIMESTAMP_KEY | 45 min |
| **Weekly Report** | Generar y notificar reporte semanal | Domingo 20h-Martes 23h59 | Semanal |
| `BackgroundTasks.register()` | Registrar tarea en SO | Manual (app init) | - |
| `BackgroundTasks.unregister()` | Desregistrar tarea | Manual (app exit) | - |

### **3. DATABASE & PERSISTENCE**

#### db.ts (12 KB)
| Función | Responsabilidad | TX-Safe | Critical Path |
|---------|-----------------|---------|---------------|
| `initDatabase()` | Crear esquema SQLite con WAL | ✅ | ⭐⭐⭐ |
| `insertWorkSession()` | Crear sesión y audit log | ✅ | ✅ |
| `updateSessionStatus()` | Cerrar sesión con almuerzo | ✅ | ✅ |
| `updateSessionEndTime()` | Auto-checkout automático | ✅ | ✅ |
| `getTotalDurationMs()` | Calcular horas totales (SQL) | ✅ | ✅ |
| `getActiveSession()` | Obtener sesión en progreso | ❌ | ✅ |
| `getAllAsync()`, `getFirstAsync()` | Queries genéricas | ❌ | - |
| `checkSessionOverlap()` | Validar sin solapamiento | ❌ | ✅ |

### **4. REPORTS & PAYROLL**

#### ReportGenerator.ts (12 KB)
| Función | Responsabilidad | Format | Output |
|---------|-----------------|--------|--------|
| `generateWeeklyReport()` | Generar PDF con sesiones + auditoría | HTML → PDF | Uri (share/email) |
| `sendReportByEmail()` | Enviar reporte por mail | PDF Attachment | Email via MailComposer |
| Cálculos integrados | Hours, OT, Pay, Audit logs | Tabular | HTML styling |

#### payrollUtils.ts (4 KB)
| Función | Responsabilidad | Precision | Formula |
|---------|-----------------|-----------|---------|
| `calculateSessionMinutes()` | Duración neta en minutos | ✅ Enteros | (endMin - startMin) - lunch |
| `calculateDuration()` | Cruzar medianoche | ✅ | (1440 - start) + end if end<start |
| `calculatePayFromMinutes()` | Nómina con OT | ✅ Centavos | (min * rate * 100 / 60) |
| `calculatePay()` | Legacy wrapper | ⚠️ Horas → min | Deprecated |

### **5. RUNTIME ADAPTERS**

#### locationAdapter.ts (2 KB)
| Función | Responsabilidad | Expo API | Error Handling |
|---------|-----------------|----------|---|
| `requestPermissions()` | FG + BG permissions | Location | Boolean return |
| `getCurrentLocation()` | GPS actual con accuracy | Location.getCurrentPositionAsync | null |
| `geocodeAddress()` | Dirección → coords | Location.geocodeAsync | null |
| `startGeofencing()` | Iniciar monitoreo | Location.startGeofencingAsync | Async throw |
| `stopGeofencing()` | Detener monitoreo | Location.stopGeofencingAsync | Task check |

#### securityAdapter.ts
| Función | Input | Output | Protection |
|---------|-------|--------|------------|
| `sanitizeInput()` | User string | HTML-safe string | escape-html + Zod |

### **6. UTILITY FUNCTIONS**

#### geoUtils.ts
```typescript
getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) // Haversine formula
```

#### logger.ts
- `log(color, category, severity, message, metadata?)`
- Color-coded console + DB persistence

#### dateUtils.ts
- `formatDate()`, `formatTime()` wrappers

---

## 🎯 TABLA DE RESPONSABILIDADES

### **Matrix de Responsabilidades por Componente**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    RESPONSABILIDADES POR CAPA ARQUITECTÓNICA                 │
├──────────────────────────────────────────────────────────────────────────────┤
```

| **Capa** | **Componente** | **Responsabilidad Primaria** | **Secundaria** | **Restricción** |
|----------|---|---|---|---|
| **State** | EngineState | Contener estado único de app | - | Immutable |
| **State** | initialState | Defaults de estado | - | Read-only |
| **State Mgmt** | workTrackerEngine | Mutex, dispatch, listeners | Lifecycle | Single instance |
| **State Mgmt** | workTrackerReducer | Pure state transitions | Validación | No side effects |
| **Side Effects** | workTrackerEffects | Orquestar DB + Services | Logging | After reducer |
| **Services** | LocationManager | Geofencing orchestration | FSM control | Foreground + Background |
| **Services** | LocationFSM | Hysteresis state machine | Mutex-protected | 3-sample window |
| **Services** | BackgroundTasks | Periodic monitoring en BG | Failsafe, Reports | OS-triggered |
| **Services** | ReportGenerator | PDF generation | Email sending | Weekly schedule |
| **Persistence** | Database (db.ts) | ACID transactions | Audit logging | WAL + Mutex |
| **Runtime** | locationAdapter | Expo API abstraction | Decoupling | Zero logic |
| **Runtime** | securityAdapter | Input sanitization | Zod validation | HTML escape |
| **Utils** | payrollUtils | Cálculos de nómina | Precision integers | California rules |
| **Utils** | geoUtils | Distancia Haversine | Coordinate math | Accuracy ±20m |
| **Utils** | logger | Colorized logging | DB persistence | Real-time + Archive |

### **Matriz de Permisos y Accesos**

| **Componente** | **Lee DB** | **Escribe DB** | **Accede GPS** | **BG Task** | **Notifications** | **Storage** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| LocationManager | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| LocationFSM | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| BackgroundTasks | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| ReportGenerator | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Effects | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Reducer | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 📊 DIAGRAMAS DE FLUJO

### **1. FLUJO DE AUTO CHECK-IN (GPS Entry)**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AUTO CHECK-IN FLOW (GPS Entry)                   │
└─────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │   GEOFENCE   │
    │  Event Enter │
    └──────┬───────┘
           │
           ▼
    ┌────────────────────────────────────┐
    │  GEOFENCE_TASK Callback Fired      │
    │  (Expo TaskManager + Location)     │
    └────────┬─────────────────────────┬─┘
             │                         │
             ▼                         ▼
    ┌──────────────────┐     ┌─────────────────────┐
    │ Check region.id  │     │ Validate Session   │
    │ exists (Type     │     │ (site_id → session) │
    │ narrowing)       │     └────────┬────────────┘
    └──────┬───────────┘              │ ❌ Not found?
           │ ❌ Missing?              ▼  Return with WARN
           │ ↓ Return                  
           ▼
    ┌─────────────────────────────────┐
    │  LocationFSM.update('Enter')    │
    │  [Acquire Mutex]                │
    │  ┌─────────────────────────────┐│
    │  │ Current: OUTSIDE/EXITING   ││ Sample 1
    │  │ → ENTERING (samples=1)     ││ (transition=STAY)
    │  └─────────────────────────────┘│
    │  ┌─────────────────────────────┐│
    │  │ Current: ENTERING          ││ Sample 2
    │  │ → ENTERING (samples=2)     ││ (transition=STAY)
    │  └─────────────────────────────┘│
    │  ┌─────────────────────────────┐│
    │  │ Current: ENTERING          ││ Sample 3
    │  │ → INSIDE (samples=0) ✅    ││ (transition=ENTERED) ✅
    │  └─────────────────────────────┘│
    │  [Release Mutex]                │
    └─────────┬───────────────────────┘
              │
              ▼
    ┌──────────────────────────────────────┐
    │  if (transition === 'ENTERED')       │
    └────────┬─────────────────────────────┘
             │
    ┌────────▼──────────────────────────────────────────┐
    │  if (session.status === 'pending_arrival' ||      │
    │      session.status === 'travel')                 │
    └──────┬───────────────────────────────────────────┘
           │
           ▼
    ┌────────────────────────────────────────┐
    │  Promise.all([                         │
    │    DB: UPDATE status='active',         │
    │         actual_start_time=now          │
    │    insertAuditLog('AUTO_CHECKIN_GPS')  │
    │    AsyncStorage.removeItem(EXIT_KEY)   │
    │    Notification: "Llegaste al sitio"   │
    │    engine.dispatch(SYNC_ACTIVE_SESSION)│
    │  ])                                    │
    └────────┬───────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  ✅ AUTO CHECK-IN SUCCESS       │
    │  - Session now ACTIVE           │
    │  - Audit logged                 │
    │  - User notified                │
    │  - Engine re-synced             │
    └─────────────────────────────────┘
```

### **2. FLUJO DE AUTO CHECK-OUT (Failsafe GPS Exit)**

```
┌─────────────────────────────────────────────────────────────────────┐
│         AUTO CHECK-OUT FLOW (Failsafe GPS Exit + 45 min)            │
└─────────────────────────────────────────────────────────────────────┘

    [PRIMARY: Geofence Event Exit]
    ┌──────────────────────┐
    │ GEOFENCE_TASK        │
    │ Callback (eventType  │
    │ === 'Exit')          │
    └──────┬───────────────┘
           │
           ▼
    ┌────────────────────────────┐
    │ LocationFSM.update('Exit') │
    │ Requires 3 consecutive     │
    │ Exit samples to transition │
    │ INSIDE → OUTSIDE           │
    │ (transition='EXITED')      │
    └──────┬─────────────────────┘
           │
           ▼
    ┌───────────────────────────────────────────┐
    │ if (transition === 'EXITED')              │
    │   AsyncStorage.setItem(EXIT_TIMESTAMP)    │
    │   insertAuditLog('GEOFENCE_EXIT')         │
    │   Notification: "Saliste del área"        │
    └───────┬───────────────────────────────────┘
            │
            ▼ (ESPERA 45 MINUTOS)

    [SECONDARY: Background Task Failsafe]
    ┌────────────────────────────────────────┐
    │ BackgroundTasks.TASK_NAME triggers     │
    │ (every 15+ min, OS-controlled)         │
    └────────┬─────────────────────────────┬─┘
             │                             │
             ▼                             ▼
    ┌───────────────────┐      ┌──────────────────────┐
    │ Read AsyncStorage │      │ Check isTaskRunning  │
    │ EXIT_TIMESTAMP_KEY│      │ (Prevent concurrency)│
    └───────┬───────────┘      └──────┬───────────────┘
            │                          │ ❌ Already running?
            ▼                          ▼  Return SKIP
    ┌──────────────────────────────────────────┐
    │ if (lastExitStr exists):                 │
    │   const timeDiff = now - exitTime        │
    │   if (timeDiff > 45 * 60 * 1000 ms):    │
    │     ✅ TRIGGER FAILSAFE                  │
    └────────┬─────────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────────┐
    │ Find active session (status='active')│
    │ ORDER BY actual_start_time DESC      │
    │ LIMIT 1                              │
    └────────┬─────────────────────────────┘
             │ ❌ No session?
             ▼  AsyncStorage.removeItem
    ┌──────────────────────────────────────┐
    │ updateSessionEndTime(                │
    │   session.id,                        │
    │   exitTime  ← ⭐ Preserva hora real  │
    │ )                                    │
    │ ┌────────────────────────────────┐  │
    │ │ UPDATE work_sessions           │  │
    │ │ SET end_time=exitTime,         │  │
    │ │     status='completed'         │  │
    │ └────────────────────────────────┘  │
    │ ┌────────────────────────────────┐  │
    │ │ insertAuditLog(                │  │
    │ │   'AUTO_CHECKOUT_GPS',         │  │
    │ │   `tras 45 min fuera del área` │  │
    │ │ )                              │  │
    │ └────────────────────────────────┘  │
    └────────┬─────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Promise.all([                │
    │  AsyncStorage.removeItem()   │
    │  Notification: "Jornada ✅"   │
    │  engine.dispatch(TIMEOUT_EVT)│
    │ ])                           │
    └────────┬─────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────┐
    │ ✅ AUTO CHECK-OUT COMPLETE          │
    │ - Session COMPLETED (end_time set)  │
    │ - Audit logged with EXIT_TIME       │
    │ - User notified                     │
    │ - Geofence keeps monitoring         │
    │   (allows re-entry or new session)  │
    └─────────────────────────────────────┘
```

### **3. FLUJO DE INICIALIZACIÓN (APP_INIT)**

```
┌──────────────────────────────────────────────────────────────┐
│              APP INITIALIZATION FLOW (APP_INIT)              │
└──────────────────────────────────────────────────────────────┘

    ┌──────────────────────────┐
    │  App Mounts / Resumes    │
    │  (AppProvider Context)   │
    └──────┬───────────────────┘
           │
           ▼
    ┌──────────────────────────────────────────┐
    │  engine.dispatch({ type: 'APP_INIT' })   │
    └──────┬───────────────────────────────────┘
           │
           ▼ REDUCER PHASE
    ┌──────────────────────────────────────────┐
    │  workTrackerReducer():                   │
    │  return { ...state, isLoading: true }    │
    └──────┬───────────────────────────────────┘
           │
           ▼ EFFECTS PHASE
    ┌──────────────────────────────────────────┐
    │  workTrackerEffects(event, state, disp)  │
    │  [Inside switch 'APP_INIT']              │
    └──────┬───────────────────────────────────┘
           │
    ┌──────▼──────────────────────────────────┐
    │ Promise.all([                            │
    │   getActiveSession(),                    │
    │   getSettings()                          │
    │ ])                                       │
    └──────┬───────────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────────────────────┐
    │ Query: SELECT * FROM work_sessions               │
    │        WHERE status='pending_arrival'            │
    │        AND date_string=TODAY                     │
    └──────┬───────────────────────────────────────────┘
           │
    ┌──────▼─────────────────────────────────────┐
    │ if (pendingSessions.length > 0):           │
    │   Map to { id, latitude, longitude }[]     │
    │   radius = settings.tolerance_radius       │
    │   LocationService.startMonitoringArrival() │
    │   ↓ locationAdapter.startGeofencing()      │
    └──────┬──────────────────────────────────────┘
           │
           ▼
    ┌───────────────────────────────────────────┐
    │ Dispatch DATA_LOADED event:               │
    │ {                                         │
    │   activeSession: session || null,         │
    │   settings: settings || null,             │
    │   isLoading: false,                       │
    │   lastUpdated: now                        │
    │ }                                         │
    └───────────────────────────────────────────┘
           │
           ▼
    ┌───────────────────────────────────────────┐
    │ ✅ APP READY FOR USE                      │
    │ - DB initialized + WAL enabled            │
    │ - Geofencing active for pending sessions  │
    │ - UI reflects current state                │
    │ - Background tasks registered             │
    └───────────────────────────────────────────┘
```

### **4. FLUJO DE LOCATION FSM (Hysteresis)**

```
┌──────────────────────────────────────────────────────────────┐
│          LOCATION FSM STATE MACHINE (Hysteresis)             │
│       Requiere 3 muestras consecutivas para transición       │
└──────────────────────────────────────────────────────────────┘

EVENT: Enter   │EVENT: Exit
───────────────┼──────────────
               │
    ┌──────────▼──────────┐
    │   OUTSIDE           │◄─────────────────┐
    │ (samples=0)         │                   │
    └────────┬─────────────┘                   │
             │ Event 'Enter'                   │
             ▼                                 │
    ┌──────────────────┐                      │
    │   ENTERING       │                      │
    │ (samples=1)      │                      │
    └────────┬─────────┘                      │
             │                                 │
             ├─ Event 'Enter' (count++)        │
             │  samples=2                      │
             ▼                                 │
    ┌──────────────────┐                      │
    │   ENTERING       │                      │
    │ (samples=2)      │                      │
    └────────┬─────────┘                      │
             │                                 │
             ├─ Event 'Enter' (count++)        │
             │  samples=3 ✅                   │
             ▼                                 │
    ┌──────────────────┐                      │
    │   INSIDE         │  ◄─── transition     │
    │ (samples=0)      │      ='ENTERED'      │
    └────────┬─────────┘                      │
             │                                 │
             ├─ Event 'Exit'                  │
             │  samples=1                      │
             ▼                                 │
    ┌──────────────────┐                      │
    │   EXITING        │                      │
    │ (samples=1)      │                      │
    └────────┬─────────┘                      │
             │                                 │
             ├─ Event 'Exit' (count++)         │
             │  samples=2                      │
             ▼                                 │
    ┌──────────────────┐                      │
    │   EXITING        │                      │
    │ (samples=2)      │                      │
    └────────┬─────────┘                      │
             │                                 │
             ├─ Event 'Exit' (count++)         │
             │  samples=3 ✅                   │
             ▼                                 │
    ┌──────────────────┐                      │
    │   OUTSIDE        │────────────────────┘
    │ (samples=0)      │  transition='EXITED'
    └──────────────────┘

KEY PROPERTIES:
├─ Prevents GPS noise from triggering false events
├─ Requires 3 consecutive identical events
├─ State stored in AsyncStorage per site
├─ Mutex-protected for thread safety
├─ Reset on session end or monitoring stop
└─ Total sample window ≈ 2-3 min (each geofence event ~30-60s)
```

---

## ⚠️ POSIBLES CASOS EXTREMOS

### **1. RACE CONDITIONS & CONCURRENCY**

#### Problema A: Múltiples geofence events en rápida sucesión

**Escenario:**
```
GPS pulsa: Enter → Exit → Enter en < 5 segundos
(Causado por límite de precisión GPS ±20m en zona fronteriza)
```

**Impacto:**
- ❌ Sin mutex: FSM podría pasar de OUTSIDE→ENTERING→INSIDE→EXITING sin validar samples
- ✅ Con mutex actual: LocationFSM adquiere lock, procesa secuencial

**Solución Actual:** ✅ `LocationFSM.acquireMutex()` en `update()`

**Mejora Sugerida:**
```typescript
// Añadir debounce en LocationManager callback
const GEOFENCE_DEBOUNCE_MS = 5000;
let lastEventTime = 0;

if (Date.now() - lastEventTime < GEOFENCE_DEBOUNCE_MS) return;
lastEventTime = Date.now();
```

---

#### Problema B: Engine dispatch durante effects

**Escenario:**
```
Effects dispara engine.dispatch() → 
  Nueva transición reducida →
    Listeners notificados mientras viejo listener aún activo
```

**Impacto:**
- ⚠️ State inconsistency si listener intenta leer `engine.state`
- Possible infinite loops

**Solución Actual:** ✅ `workTrackerEngine.dispatch()` libera mutex ANTES de effects

```typescript
release(); // ⭐ Critical: Release BEFORE effects

try {
  await workTrackerEffects(event, this.state, this.dispatch.bind(this));
}
```

---

#### Problema C: BackgroundTask corre mientras app abierta

**Escenario:**
```
User abre app + BackgroundTask dispara simultáneamente
→ Ambos leen/escriben `work_sessions` en paralelo
```

**Impacto:**
- ❌ SQLite concurrency issues (no es thread-safe para múltiples writers)
- Data corruption

**Solución Actual:** ⚠️ Flag `isTaskRunning` (no es suficiente)

```typescript
let isTaskRunning = false;  // ⚠️ Volatile, race-condition-prone

if (isTaskRunning) return;  // ← Puede fallar si timing es justo
```

**Mejora Recomendada:**
```typescript
// Usar AsyncLock en lugar de flag
import AsyncLock from 'async-lock';
const bgTaskLock = new AsyncLock();

bgTaskLock.acquire('bg-work', async () => {
  // garantizado exclusivo
});
```

---

### **2. LOCATION & GPS EDGE CASES**

#### Problema A: GPS Denied/Never Granted Permissions

**Escenario:**
```
User revoca permisos en Settings → 
  startGeofencingAsync falla silenciosamente →
    Geofence nunca se inicia
```

**Impacto:**
- ❌ Auto check-in completamente roto
- ❌ User sin notificación de por qué no funciona

**Solución Actual:** ⚠️ `locationAdapter.requestPermissions()` sin retry

**Mejora Recomendada:**
```typescript
if (!permissionsGranted) {
  // Dispatch event para mostrar modal en UI
  dispatch({ 
    type: 'PERMISSIONS_DENIED', 
    requiredPermissions: ['LOCATION_BG'] 
  });
  // No silenciar el error
}
```

---

#### Problema B: Geocoding Falla (Dirección Inválida)

**Escenario:**
```
User introduce: "Edificio sin número, zona muy rural"
geocodeAddress() retorna []
```

**Impacto:**
- ❌ Session se crea sin coords
- ❌ Geofence no se puede iniciar
- ⚠️ Silent failure

**Solución Actual:** ⚠️ Solo retorna `null`, no valida

```typescript
export const START_SESSION_REQUEST: {
  const coords = await LocationService.getCoordsFromAddress(sanitizedAddress);
  if (!coords) {
    dispatch({ type: 'ERROR_OCCURRED', error: 'Address not found' });
    return;  // ✅ Valida
  }
}
```

**Mejora:**
```typescript
// Mostrar sugerencias de Expo Location.geocodeAsync
// Permitir user confirmar coordenadas manualmente
```

---

#### Problema C: GPS Drift Durante Shift

**Escenario:**
```
Day: User en edificio. GPS=±20m
→ Bounces entre INSIDE/EXITING/INSIDE constantemente
→ FSM con hysteresis = OK, pero user experi...

Ya 4 horas después, GPS acumula error → jumps 100m away
→ De repente EXITED (sample 1) → user fuera de geofence
→ Failsafe NO dispara si luego vuelve (< 45 min)
```

**Impacto:**
- ❌ Auto check-out puede dispararse sin user saberlo
- ❌ Falsa salida registrada en auditoría

**Solución Actual:** Hysteresis mitiga, pero no es 100%

**Mejora Recomendada:**
```typescript
// Combinar GPS con velocidad (si user se mueve >20 mph, es salida real)
// Usar Kalman filter para suavizar drift
// Threshold de radius aumenta con edad de sesión (4h → 300m tolerance)
```

---

### **3. DATABASE & DATA INTEGRITY**

#### Problema A: WAL Corruption en Crash

**Escenario:**
```
updateSessionEndTime() en transacción
→ App crashes DURANTE COMMIT
→ WAL file corrupted, -shm files left
```

**Impacto:**
- ❌ DB unreadable on next startup
- ❌ Horas perdidas

**Solución Actual:** ✅ WAL mode + PRAGMA synchronous=NORMAL + transactions

```typescript
await database.execAsync('BEGIN IMMEDIATE TRANSACTION');
const result = await work(database);
await database.execAsync('COMMIT');  // ← Crash aquí = ?
```

**Mejora:**
```typescript
// Usar PRAGMA journal_mode=PERSIST en lugar de WAL
// o implementar checkpoint() periódicamente
await database.execAsync('PRAGMA wal_checkpoint(PASSIVE)');
```

---

#### Problema B: Duplicate Sessions en Race

**Escenario:**
```
User rápidamente:
1. START_SESSION_REQUEST
2. Geofence Enter (auto check-in)
3. START_SESSION_REQUEST nuevamente

→ insertWorkSession() x2 sin constraint único
```

**Impacto:**
- ❌ 2 sesiones en DB para mismo cliente
- ❌ Payroll calcula el doble

**Solución Actual:** ⚠️ No hay UNIQUE constraint en (date_string, client_name, status)

**Mejora:**
```sql
-- Añadir a schema:
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_session_per_day
ON work_sessions(date_string, status)
WHERE status IN ('pending_arrival', 'active');
```

---

#### Problema C: Circular Dependency en Transactions

**Escenario:**
```
Effects dispara updateSessionStatus() [TRANSACTION]
→ Inside: insertAuditLog() que intenta leer de work_sessions
→ Stale lock scenario
```

**Impacto:**
- ⚠️ Possible deadlock (DB locked esperando)

**Solución Actual:** Transacciones atomícas evitan esto, pero no es óptimo

---

### **4. BACKGROUND TASKS & OS INTEGRATION**

#### Problema A: Failsafe Trigger Frequency Inconsistent

**Escenario:**
```
BackgroundTasks.register(minimumInterval: 15 min)

Pero OS puede ignorar:
- Low battery
- Thermal throttling
- Too much foreground activity
```

**Impacto:**
- ❌ User leaves at 17:00
- ❌ Failsafe configured para 45 min
- ❌ pero BG task no dispara hasta 18:30
- ❌ Auto checkout con 1.5h de delay

**Solución Actual:** ⚠️ Confía en OS scheduling

**Mejora Recomendada:**
```typescript
// Usar expo-task-manager con higher priority
// o combinar con AppState listener + timer como backup

import { AppState } from 'react-native';

AppState.addEventListener('change', (status) => {
  if (status === 'background') {
    // Schedule failsafe check via setTimeout en web, 
    // BackgroundTimer en native
  }
});
```

---

#### Problema B: Report Generation Skipped

**Escenario:**
```
Weekly report window: Sun 20h - Tues 23h
User nunca abre app en esa ventana
→ Report never generated
```

**Impacto:**
- ❌ Employer espera nómina, no llega

**Solución Actual:** ⚠️ Depende de app abierta o BG task dispare

**Mejora:**
```typescript
// Usar Firebase Cloud Messaging para notificación forzada
// o verificar MISSING reports al abrir app
if (dayIsAfterReportWindow && noReportThisWeek) {
  generateWeeklyReport(true); // Forzar now
}
```

---

### **5. SECURITY & VALIDATION**

#### Problema A: Injection en Audit Logs

**Escenario:**
```javascript
const note = "'; DROP TABLE work_sessions; --";
insertAuditLog(id, action, note);
```

**Impacto:**
- ❌ SQL injection (aunque prepared statements en db.ts protegen)

**Solución Actual:** ✅ Prepared statements en DB

```typescript
await database.runAsync(
  "INSERT INTO audit_logs ... VALUES (?, ?, ?)",
  [sessionId, actionType, details]  // ← Parámetros separados
);
```

**Mejora:**
```typescript
// Ya implementado en securityAdapter.sanitizeInput()
const sanitized = securityAdapter.sanitizeInput(note);
```

---

#### Problema B: Location Spoofing

**Escenario:**
```
User instala app de mock GPS
→ Falsifica entrada a geocerca desde casa
→ Auto check-in en sitio remoto
```

**Impacto:**
- ❌ Fraude de hours
- ❌ Payroll inflado

**Solución Actual:** ❌ No hay validación

**Mejora Recomendada:**
```typescript
// Validar consistencia:
// 1. GPS accuracy < 50m (Location.Accuracy.Balanced)
// 2. Distance traveled < (time_delta * max_speed)
// 3. Geofence solo válido si accuracy buena

if (position.coords.accuracy > 50) {
  log('AMARILLO', 'GPS_DEBIL', 'WARN', 
    `Accuracy ${accuracy}m - geofence event ignored`);
  return;
}
```

---

### **6. PAYROLL EDGE CASES**

#### Problema A: Lunch Deduction con Hora Inválida

**Escenario:**
```javascript
calculateSessionMinutes(
  startTime: 10:00,
  endTime: 18:00,
  lunchTaken: true,
  lunchStart: 13:00,
  lunchEnd: 12:00  // ← Antes que lunchStart!
);
```

**Impacto:**
- ⚠️ Negative minutes possible
- Payroll bajo

**Solución Actual:** ✅ Validación en payrollUtils.ts

```typescript
if (lStartMin >= startMin && lEndMin <= endMin && lEndMin >= lStartMin) {
  totalMinutes -= (lEndMin - lStartMin);
}
// Si no pasa validación, aplica default 60 min
```

---

#### Problema B: California OT Rules Ambiguous

**Escenario:**
```
Turno: 09:00 - 18:30 (9.5 horas)
Con almuerzo: 9.5 - 1 = 8.5 horas

¿Cómo se calcula OT?
- 8 horas regulares + 0.5 OT? ✅ (Actual)
- o 8.5 sin OT? ❌
```

**Impacto:**
- ⚠️ Confusión si empleador espera regla distinta

**Solución Actual:** ✅ Implementado correctamente

```typescript
const REGULAR_HOURS_THRESHOLD_MINUTES = 480; // 8h
if (regularMinutes > REGULAR_HOURS_THRESHOLD_MINUTES) {
  overtimeMinutes = regularMinutes - 480;
}
```

---

### **TABLA RESUMEN: CASOS EXTREMOS & SEVERIDAD**

| # | Caso Extremo | Severidad | Impacto | Estado Actual | Recomendación |
|---|---|---|---|---|---|
| 1 | Múltiple geofence enter/exit rápido | 🔴 Alta | False check-in/out | ✅ Mutex | Añadir debounce |
| 2 | Engine dispatch durante effects | 🟡 Media | State inconsistency | ✅ Mutex release timing | Documentar orden |
| 3 | BG task + foreground concurrency | 🔴 Alta | Data corruption | ⚠️ Flag `isTaskRunning` | AsyncLock library |
| 4 | Permisos GPS revocados | 🟡 Media | Silent failure | ⚠️ No retry | Modal + re-request |
| 5 | Geocoding dirección inválida | 🟡 Media | Silent failure | ✅ Valida | Sugerencias de dirección |
| 6 | GPS drift durante turno | 🟠 Media-Alta | False exit | ⚠️ Hysteresis solo | Validar accuracy + velocidad |
| 7 | WAL corruption en crash | 🔴 Alta | DB unreadable | ✅ WAL+TX | Checkpoints periódicos |
| 8 | Duplicate sessions race | 🔴 Alta | Payroll x2 | ❌ Sin constraint | UNIQUE index |
| 9 | Failsafe trigger delay | 🟡 Media | Hora exit incorrecta | ⚠️ OS scheduling | AppState backup |
| 10 | Report generation missed | 🟡 Media | Employer sin nómina | ⚠️ BG depend | Check missed on open |
| 11 | Location spoofing | 🔴 Alta | Fraude de hours | ❌ Sin validación | Accuracy + speed check |
| 12 | Lunch deduction inválida | 🟢 Baja | Payroll incorrecto | ✅ Validado | OK |
| 13 | OT rules ambiguidad | 🟠 Media | Disputes | ✅ California rules | Documentar |

---

## 🚀 PROPUESTAS DE OPTIMIZACIÓN

### **PROPUESTA 1: Mejorar Concurrency Management**

#### Objetivo:
Eliminar race conditions entre foreground, background tasks y events.

#### Cambios Recomendados:

**A. Reemplazar flag `isTaskRunning` con AsyncLock**

```typescript
// src/services/BackgroundTasks.ts

import AsyncLock from 'async-lock';

const bgLock = new AsyncLock();

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    await bgLock.acquire('bg-database-work', async () => {
      // Código actual aquí
      // Garantizado: no hay racing condition
    });
  } catch (e) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'BG task failed', e);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
```

**B. Sincronizar Engine Dispatch con Storage Access**

```typescript
// src/engine/workTrackerEngine.ts
// Ya implementado, pero añadir documentación

/**
 * IMPORTANTE: El mutex se libera ANTES de effects.
 * Esto previene deadlocks cuando effects disparan nuevos eventos.
 * 
 * Orden crítico:
 * 1. Acquire mutex
 * 2. Run reducer (actualiza state)
 * 3. Notify listeners
 * 4. Release mutex ← AQUÍ
 * 5. Run effects (pueden dispatchear nuevos eventos)
 */
```

---

### **PROPUESTA 2: Enhanced GPS Validation & Accuracy**

#### Objetivo:
Prevenir spoofing y false positives de geofence.

#### Implementación:

```typescript
// src/services/LocationManager.ts - ENHANCE geofence callback

const GEOFENCE_TASK = 'GEOFENCE_TRACKING_TASK';
const MIN_ACCURACY_METERS = 50;
const MAX_SPEED_MPS = 35; // ~127 km/h

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) return;

  const { eventType, region } = data;
  const siteId = region?.identifier;

  if (!siteId) return;

  // ✅ NEW: Validate GPS accuracy
  const currentPos = await locationAdapter.getCurrentLocation();
  
  if (!currentPos) {
    log('AMARILLO', 'GPS_DEBIL', 'WARN', 'No GPS signal, ignoring geofence');
    return;
  }

  if (currentPos.accuracy && currentPos.accuracy > MIN_ACCURACY_METERS) {
    log('AMARILLO', 'GPS_DEBIL', 'WARN', 
      `GPS accuracy ${currentPos.accuracy}m > ${MIN_ACCURACY_METERS}m, ignoring`);
    return;
  }

  // ✅ NEW: Validate speed consistency
  const db = await ensureDbReady();
  const session = await db.getFirstAsync<WorkSession>(
    "SELECT * FROM work_sessions WHERE id = ?",
    [parseInt(siteId, 10)]
  );

  if (!session) return;

  if (session.latitude && session.longitude) {
    const distanceM = getDistanceFromLatLonInMeters(
      session.latitude, session.longitude,
      currentPos.latitude, currentPos.longitude
    );
    
    // If last GPS reading < 5 sec ago
    const timeDeltaSec = 5;
    const maxDistanceM = MAX_SPEED_MPS * timeDeltaSec;
    
    if (distanceM > maxDistanceM) {
      log('ROJO', 'EVENTO_GEOCERCA', 'WARN',
        `Impossible speed: ${(distanceM/timeDeltaSec).toFixed(1)} m/s`);
      // Suspicious, log but don't ignore (user might have used transport)
    }
  }

  // Proceed with FSM logic...
  const { transition } = await fsm.update(eventType, siteId);
  // ...
});
```

---

### **PROPUESTA 3: Robust Failsafe with AppState Backup**

#### Objetivo:
Garantizar auto-checkout aún si OS no dispara background task.

```typescript
// src/services/BackgroundTasks.ts + app/_layout.tsx

// Option A: Usar AppState como backup trigger
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_FAILSAFE_CHECK_KEY = 'LAST_FAILSAFE_CHECK';

export const setupAppStateListener = () => {
  AppState.addEventListener('change', async (status) => {
    if (status === 'active') {
      // App became active - check if failsafe needs trigger
      const lastCheck = await AsyncStorage.getItem(LAST_FAILSAFE_CHECK_KEY);
      const now = Date.now();
      const lastCheckTime = lastCheck ? parseInt(lastCheck, 10) : 0;
      
      // If > 1 hour since last check, run failsafe logic
      if (now - lastCheckTime > 60 * 60 * 1000) {
        await runFailsafeCheck();
        await AsyncStorage.setItem(LAST_FAILSAFE_CHECK_KEY, now.toString());
      }
    }
  });
};

const runFailsafeCheck = async () => {
  try {
    const db = await ensureDbReady();
    const lastExitStr = await AsyncStorage.getItem(EXIT_TIMESTAMP_KEY);

    if (lastExitStr) {
      const exitTime = parseInt(lastExitStr, 10);
      const now = Date.now();
      const timeDiff = now - exitTime;

      if (timeDiff > FAILSAFE_THRESHOLD_MS) {
        const session = await db.getFirstAsync<WorkSession>(
          "SELECT * FROM work_sessions WHERE status = 'active' ORDER BY actual_start_time DESC LIMIT 1"
        );

        if (session?.id) {
          log('AMARILLO', 'ADVERTENCIA', 'WARN', 
            `Failsafe triggered on app resume (${Math.round(timeDiff/60000)} min delay)`);
          
          await updateSessionEndTime(session.id, exitTime);
          await insertAuditLog(session.id, 'AUTO_CHECKOUT_GPS', '...');
          await AsyncStorage.removeItem(EXIT_TIMESTAMP_KEY);
          engine.dispatch({ type: 'BACKGROUND_SESSION_TIMEOUT' });
        }
      }
    }
  } catch (e) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Failsafe check failed', e);
  }
};
```

---

### **PROPUESTA 4: Structured Logging & Analytics**

#### Objetivo:
Mejorar debugging y auditoría con telemetría estructurada.

```typescript
// src/utils/logger.ts - ENHANCED

export interface LogMetadata {
  sessionId?: number;
  userId?: string;
  duration?: number; // ms
  geoAccuracy?: number;
  errorCode?: string;
  stackTrace?: string;
}

export const logStructured = async (
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
  category: LogCategory,
  message: string,
  metadata?: LogMetadata
) => {
  const entry: SystemLogEntry = {
    timestamp: dayjs().valueOf(),
    timestamp_str: dayjs().format('YYYY-MM-DD HH:mm:ss.SSS'),
    color: levelToColor(level),
    categoria: category,
    severidad: level,
    mensaje: message,
    metadata: metadata ? JSON.stringify(metadata) : undefined
  };

  // Log to console
  console.log(`[${entry.timestamp_str}] [${level}] ${category}: ${message}`, metadata);

  // Log to DB for analysis
  const db = await ensureDbReady();
  await db.runAsync(
    `INSERT INTO system_logs (timestamp, timestamp_str, color, categoria, severidad, mensaje, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [entry.timestamp, entry.timestamp_str, entry.color, entry.categoria, 
     entry.severidad, entry.mensaje, entry.metadata]
  );
};

// Usage:
logStructured('INFO', 'EVENTO_GEOCERCA', 'Auto check-in triggered', {
  sessionId: 42,
  geoAccuracy: 18.5,
  duration: 150000
});
```

---

### **PROPUESTA 5: Enhanced Report Generation & Scheduling**

#### Objetivo:
Garantizar reportes semanales sin depender completamente de BG tasks.

```typescript
// src/services/ReportGenerator.ts - ENHANCED

const LAST_SUCCESSFUL_REPORT = 'LAST_SUCCESSFUL_REPORT_TIMESTAMP';

export const ensureWeeklyReportExists = async () => {
  const lastReport = await AsyncStorage.getItem(LAST_SUCCESSFUL_REPORT);
  const now = dayjs();
  
  const lastReportDate = lastReport ? dayjs(parseInt(lastReport, 10)) : null;
  
  // If no report this week, generate it
  if (!lastReportDate || !lastReportDate.isSame(now, 'week')) {
    const pdfUri = await generateWeeklyReport(false);
    
    if (pdfUri) {
      await AsyncStorage.setItem(LAST_SUCCESSFUL_REPORT, now.valueOf().toString());
      
      // Schedule notification to actually send it
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📄 Reporte Semanal Pendiente',
          body: 'Toca para enviar tu nómina por correo.',
          data: { action: 'SHOW_REPORT_PROMPT', pdfUri },
          sound: true,
        },
        trigger: { seconds: 10 },
      });
    }
  }
};

// Call from:
// 1. AppState 'active'
// 2. Every 24 hours (via BackgroundTask)
// 3. Manual "Generate Now" button in UI
```

---

### **PROPUESTA 6: Database Query Optimization**

#### Objetivo:
Reducir latencia de queries complejas.

```typescript
// src/database/db.ts - ENHANCED with indexes

export async function initDatabase() {
  const database = await openDbOnce();
  await configureDatabase(database);

  await database.execAsync(`
    -- Existing tables...
    
    -- ✅ NEW: Performance indexes
    CREATE INDEX IF NOT EXISTS idx_sessions_by_date 
      ON work_sessions(date_string, status);
    
    CREATE INDEX IF NOT EXISTS idx_sessions_active 
      ON work_sessions(status) 
      WHERE status IN ('active', 'pending_arrival');
    
    CREATE INDEX IF NOT EXISTS idx_audit_logs_by_session 
      ON audit_logs(session_id, timestamp);
    
    CREATE INDEX IF NOT EXISTS idx_audit_logs_by_timestamp 
      ON audit_logs(timestamp);
    
    CREATE INDEX IF NOT EXISTS idx_system_logs_by_time 
      ON system_logs(timestamp DESC);
  `);
}

// ✅ Use EXPLAIN QUERY PLAN to validate
// SELECT * FROM work_sessions WHERE status='active' AND date_string='2026-07-01';
//   → Should show: "SEARCH work_sessions USING idx_sessions_active"
```

---

### **PROPUESTA 7: Type-Safe Location Region Management**

#### Objetivo:
Prevenir errores de identificador de región.

```typescript
// src/types/index.ts - NEW

export interface GeofenceRegion {
  siteId: string;  // Must match session.id
  latitude: number;
  longitude: number;
  radius: number;  // Meters
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
}

// src/services/LocationManager.ts - REFACTOR

export const LocationService = {
  startMonitoringArrival: async (
    sites: { id: string; latitude: number; longitude: number }[],
    radius: number = 200
  ) => {
    try {
      // Type guard
      const regions: GeofenceRegion[] = sites.map((site) => {
        if (!site.id || Number.isNaN(site.latitude) || Number.isNaN(site.longitude)) {
          throw new Error(`Invalid site: ${JSON.stringify(site)}`);
        }
        return {
          siteId: site.id,
          latitude: site.latitude,
          longitude: site.longitude,
          radius,
          notifyOnEnter: true,
          notifyOnExit: true,
        };
      });

      const expoRegions: Location.LocationRegion[] = regions.map(r => ({
        identifier: r.siteId,
        latitude: r.latitude,
        longitude: r.longitude,
        radius: r.radius,
        notifyOnEnter: r.notifyOnEnter,
        notifyOnExit: r.notifyOnExit,
      }));

      await locationAdapter.startGeofencing(GEOFENCE_TASK, expoRegions);
      
      log('VERDE', 'SERVICIOS_ACTIVOS', 'INFO', 
        `Monitoring ${regions.length} sites with validated regions`);

      return true;
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error starting monitoring', e);
      return false;
    }
  },
};
```

---

### **TABLA RESUMEN: PROPUESTAS DE OPTIMIZACIÓN**

| # | Propuesta | Impacto | Effort | Urgencia | Beneficio |
|---|---|---|---|---|---|
| 1 | AsyncLock para concurrency | 🔴 Crítico | ⭐⭐ | 🔴 Alta | Elimina race conditions |
| 2 | GPS accuracy + speed validation | 🔴 Crítico | ⭐⭐⭐ | 🔴 Alta | Previene spoofing |
| 3 | AppState failsafe backup | 🟡 Mayor | ⭐⭐ | 🟡 Media | Garantiza checkout |
| 4 | Structured logging | 🟢 Menor | ⭐⭐ | 🟢 Baja | Mejor debugging |
| 5 | Report check on app open | 🟡 Mayor | ⭐⭐ | 🟡 Media | No missed reports |
| 6 | Database indexes | 🟡 Mayor | ⭐ | 🟡 Media | Query performance |
| 7 | Type-safe region management | 🟢 Menor | ⭐⭐ | 🟢 Baja | Fewer bugs |

---

## 📎 ANEXOS

### **ANEXO A: Arquitectura de Capas Detallada**

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: UI & Navigation (Expo Router)                     │
│  ├─ app/(tabs)/index.tsx       (Check-in screen)           │
│  ├─ app/(tabs)/history.tsx     (Sessions list)             │
│  ├─ app/(tabs)/settings.tsx    (Configuration)             │
│  └─ app/(tabs)/report.tsx      (Generate/send reports)     │
│                                                               │
│  LAYER 2: State Management (Redux-like)                     │
│  ├─ workTrackerEngine          (Mutex-protected dispatcher) │
│  ├─ workTrackerReducer         (Pure state transitions)     │
│  ├─ workTrackerEffects         (Async side effects)        │
│  └─ EngineState contracts      (Type definitions)          │
│                                                               │
│  LAYER 3: Business Services                                 │
│  ├─ LocationManager            (Geofencing orchestration)   │
│  ├─ LocationFSM                (Hysteresis state machine)   │
│  ├─ BackgroundTasks            (Periodic monitoring)        │
│  ├─ ReportGenerator            (PDF generation)            │
│  └─ Notifications              (User alerts)               │
│                                                               │
│  LAYER 4: Runtime Adapters (3rd party APIs)                │
│  ├─ locationAdapter            (expo-location wrapper)      │
│  ├─ securityAdapter            (Input sanitization)         │
│  ├─ sessionStoreAdapter         (AsyncStorage wrapper)       │
│  └─ reportsAdapter             (expo-print/sharing)        │
│                                                               │
│  LAYER 5: Data Access (SQLite + AsyncStorage)              │
│  ├─ Database                   (SQL transactions)           │
│  │  ├─ work_sessions table      (Core entity)              │
│  │  ├─ audit_logs table         (Immutable logs)           │
│  │  ├─ settings table           (Configuration)           │
│  │  └─ system_logs table        (Debugging)               │
│  └─ AsyncStorage               (Key-value store)          │
│     └─ EXIT_TIMESTAMP_KEY      (Failsafe marker)          │
│     └─ GEOFENCE_STATE_KEY      (FSM state)                │
│                                                               │
│  LAYER 6: Utilities (Pure functions)                        │
│  ├─ payrollUtils               (Nómina calculations)       │
│  ├─ geoUtils                   (Haversine distance)        │
│  ├─ dateUtils                  (Date formatting)           │
│  ├─ logger                     (Structured logging)        │
│  └─ validation                 (Input validation)          │
└─────────────────────────────────────────────────────────────┘
```

---

### **ANEXO B: Flujo de Datos Unidireccional**

```
User Action (UI) 
    ↓
engine.dispatch(EngineEvent)
    ↓ [Mutex acquire]
workTrackerReducer(state, event)
    → Pure state transition
    ↓ [Listeners notified]
    ↓ [Mutex release]
workTrackerEffects(event, state, dispatch)
    → Async operations (DB, Location, Notifications)
    → May dispatch new events (re-enter mutex)
    ↓
[Effects complete]
    → UI listeners updated
    → Listeners call setState() in React
    → Components re-render
```

---

### **ANEXO C: Permission Matrix**

```
FOREGROUND PERMISSIONS (Needed immediately):
├─ LOCATION (fine): For GPS positioning
├─ NOTIFICATIONS: For user alerts
└─ FILE_SYSTEM: For PDF generation

BACKGROUND PERMISSIONS (Requested after):
├─ LOCATION (background): For geofencing while app closed
├─ BACKGROUND_TASK: For periodic monitoring
└─ DEVICE_ACTIVITY: For idle detection (future)

OPTIONAL PERMISSIONS:
├─ CAMERA: Not used (removed for minimal surface)
├─ CALENDAR: Not used
└─ HEALTH: Not used
```

---

### **ANEXO D: Test Coverage Map**

```
CRITICAL PATH TESTS:
┌─ sessionWorkflow ─────────────────────────────────────┐
│  ├─ test_createSession_creates_pending_arrival        │
│  ├─ test_geofence_enter_3_samples_triggers_checkin    │
│  ├─ test_geofence_exit_3_samples_triggers_exit_marker │
│  ├─ test_failsafe_45min_triggers_checkout             │
│  └─ test_payroll_calculation_with_lunch_deduction     │
│                                                        │
├─ payrollWorkflow ────────────────────────────────────┤
│  ├─ test_calculateSessionMinutes_handles_lunch       │
│  ├─ test_calculatePay_california_ot_rules            │
│  └─ test_weeklyReport_aggregates_correctly           │
│                                                        │
├─ backgroundTasks ─────────────────────────────────────┤
│  ├─ test_failsafe_does_not_trigger_under_45min       │
│  ├─ test_failsafe_uses_exit_time_not_current_time     │
│  ├─ test_report_generation_window_accuracy           │
│  └─ test_mutex_prevents_concurrent_execution         │
│                                                        │
├─ locationFSM ─────────────────────────────────────────┤
│  ├─ test_fsm_stays_outside_with_single_enter         │
│  ├─ test_fsm_enters_inside_with_3_samples            │
│  ├─ test_fsm_stays_inside_with_exit_1sample          │
│  ├─ test_fsm_exits_outside_with_3_exit_samples       │
│  └─ test_mutex_protects_concurrent_updates           │
│                                                        │
├─ security ────────────────────────────────────────────┤
│  ├─ test_sql_injection_prevented_by_prepared_stmt     │
│  ├─ test_xss_prevented_by_sanitizeInput              │
│  ├─ test_gps_accuracy_validation_rejects_poor        │
│  └─ test_speed_validation_detects_impossible_speed    │
│                                                        │
└─ edge_cases ──────────────────────────────────────────┘
   ├─ test_midnight_crossing_shift
   ├─ test_daylight_saving_time_transition
   ├─ test_database_corruption_recovery
   └─ test_location_permission_revoked_mid_shift
```

---

### **ANEXO E: Database Schema Reference**

```sql
-- TABLES & CONSTRAINTS

CREATE TABLE work_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Timing
  start_time INTEGER NOT NULL,           -- Configured time
  actual_start_time INTEGER,             -- GPS check-in time
  end_time INTEGER,                      -- Actual end time
  
  -- Status
  status TEXT NOT NULL,                  -- pending_arrival|active|travel|completed|deleted
  
  -- Location
  latitude REAL,
  longitude REAL,
  target_latitude REAL,                  -- Destination
  target_longitude REAL,
  setup_latitude REAL,                   -- Where configured
  setup_longitude REAL,
  
  -- Metadata
  address TEXT,
  client_name TEXT,
  location_confirmed INTEGER DEFAULT 0,
  is_manual_edit INTEGER DEFAULT 0,
  manual_note TEXT,
  
  -- Lunch
  lunch_taken INTEGER DEFAULT 0,
  lunch_start INTEGER,
  lunch_end INTEGER,
  
  -- Audit
  date_string TEXT                       -- YYYY-MM-DD for quick filtering
);

CREATE UNIQUE INDEX idx_active_session
  ON work_sessions(date_string, status)
  WHERE status IN ('pending_arrival', 'active');

---

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  action_type TEXT NOT NULL,             -- AUTO_CHECKIN_GPS|AUTO_CHECKOUT_GPS|...
  details TEXT,
  timestamp INTEGER NOT NULL
);

CREATE INDEX idx_audit_by_session ON audit_logs(session_id, timestamp);
CREATE INDEX idx_audit_by_timestamp ON audit_logs(timestamp DESC);

---

CREATE TABLE settings (
  id INTEGER PRIMARY KEY NOT NULL,       -- Always 1 (singleton)
  employee_name TEXT,
  employer_name TEXT,
  company_email TEXT,
  tolerance_radius INTEGER DEFAULT 200,  -- Geofence radius in meters
  hourly_rate REAL DEFAULT 0,
  language TEXT DEFAULT 'es',
  start_time TEXT DEFAULT '08:00',
  overtime_multiplier REAL DEFAULT 1.5
);

---

CREATE TABLE system_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  timestamp_str TEXT NOT NULL,           -- YYYY-MM-DD HH:mm:ss.SSS
  color TEXT,                            -- VERDE|AMARILLO|ROJO|...
  categoria TEXT,                        -- OPERACION_EXITOSA|ERROR_CRITICO|...
  severidad TEXT,                        -- INFO|WARN|EVENT|ERROR|DEBUG
  mensaje TEXT,
  metadata TEXT                          -- JSON string
);
```

---

### **ANEXO F: Configuration & Constants**

```typescript
// Core Config
export const GEOFENCE_TASK = 'GEOFENCE_TRACKING_TASK';
export const EXIT_TIMESTAMP_KEY = 'LAST_GEOFENCE_EXIT_TIMESTAMP';
export const GEOFENCE_STATE_KEY = 'GEOFENCE_HYSTERESIS_STATE';
export const GEOFENCE_SAMPLES_KEY = 'GEOFENCE_HYSTERESIS_SAMPLES';
export const REQUIRED_SAMPLES = 3;

// Timeouts
export const FAILSAFE_THRESHOLD_MS = 45 * 60 * 1000;      // 45 min
export const BG_TASK_MINIMUM_INTERVAL = 15;               // min
export const GEOFENCE_DEBOUNCE_MS = 5000;                 // 5 sec

// Payroll
export const MS_PER_MINUTE = 60000;
export const LUNCH_THRESHOLD_MINUTES = 360;               // 6h
export const DEFAULT_LUNCH_MINUTES = 60;                  // 1h auto
export const REGULAR_HOURS_THRESHOLD_MINUTES = 480;       // 8h (California)

// Location
export const DEFAULT_TOLERANCE_RADIUS = 200;              // meters
export const MIN_ACCURACY_METERS = 50;
export const MAX_SPEED_MPS = 35;                          // ~127 km/h

// Reporting
export const REPORT_WINDOW_START = dayOfWeek(0);          // Sunday
export const REPORT_WINDOW_HOUR_START = 20;               // 20:00 UTC
export const REPORT_WINDOW_END = dayOfWeek(3);            // Wednesday
export const REPORT_WINDOW_HOUR_END = 23;                 // 23:59 UTC
```

---

### **ANEXO G: Recomendaciones de Despliegue**

```
PRE-PRODUCTION CHECKLIST:

☐ Security Audit
  ├─ Run: npm run audit:security
  ├─ Verify no hardcoded credentials
  ├─ Review: export const DB_NAME = 'wtracker_v1.db'
  └─ Encrypt AsyncStorage (EAS Build config)

☐ Performance
  ├─ Run: npm run test -- --coverage
  ├─ Target: >95% coverage on engine/* utils/*
  ├─ Profile: LocationFSM.update() < 50ms
  └─ Profile: payroll calculations < 100ms

☐ Location
  ├─ Test on real device (Android + iOS)
  ├─ Verify background geofencing works with app killed
  ├─ Test with GPS toggle on/off
  └─ Test permission revocation scenarios

☐ Background Tasks
  ├─ Verify failsafe triggers at 45min mark
  ├─ Verify report generation window (Sun-Tue)
  ├─ Test with app in background >1 hour
  └─ Test OS memory pressure scenarios

☐ Database
  ├─ Backup existing DB before deploy
  ├─ Test restore from WAL
  ├─ Run: PRAGMA integrity_check;
  └─ Verify no orphaned audit_logs

☐ Analytics & Monitoring
  ├─ Enable structured logging
  ├─ Monitor error rates
  ├─ Set up alerts for critical events
  └─ Weekly review of audit logs

EAS BUILD CONFIGURATION:
  ├─ Enable: "android.permissions" + "ios.permissions"
  ├─ Runtime: Expo 54.0.34+
  ├─ Target: Android 10+, iOS 14+
  └─ Track: Version in package.json
```

---

### **ANEXO H: Debugging & Troubleshooting**

```
COMMON ISSUES & SOLUTIONS:

Issue: Auto check-in not triggering
├─ Check: LocationManager.startMonitoringArrival() returned true?
├─ Check: Permission status (FG + BG)
├─ Check: LocationFSM state in AsyncStorage
├─ Check: Geofence region identifier matches session.id
└─ Fix: __DEV__ build + manual geofence event via TaskManager

Issue: Auto check-out not triggering
├─ Check: EXIT_TIMESTAMP_KEY is set in AsyncStorage
├─ Check: BackgroundTasks.register() was called
├─ Check: OS has not restricted app background activity
├─ Check: 45+ minutes have truly elapsed
└─ Fix: Manually trigger BackgroundTasks.triggerForTesting()

Issue: Payroll calculation wrong
├─ Check: lunch_taken flag (0 or 1)
├─ Check: lunch_start/end if provided
├─ Check: end_time is after actual_start_time
├─ Check: No negative duration
└─ Fix: Use payrollUtils.calculateSessionMinutes() directly

Issue: Report PDF missing data
├─ Check: getTotalDurationMs() query (verify in DB browser)
├─ Check: Audit logs exist for period
├─ Check: ReportGenerator uses correct timestamp range
└─ Fix: Manually call generateWeeklyReport(false)

DEBUG COMMANDS:
  npm run audit:geo        ← Geofencing audit
  npm run audit:db         ← Database integrity check
  npm run audit:logs       ← Logger configuration
  npm run test             ← Full test suite
  npm run typecheck        ← TypeScript verification
```

---

### **ANEXO I: Glossario de Términos**

| Término | Significado | Contexto |
|---|---|---|
| **Geofence** | Zona circular definida por (lat, long, radius) | Location |
| **Hysteresis** | Filtro que requiere 3 muestras idénticas | LocationFSM |
| **Auto Check-in** | Entrada automática detectada por GPS | Geofence Entry |
| **Auto Check-out** | Salida automática tras 45 min fuera | Failsafe |
| **Failsafe** | Mecanismo de seguridad para evitar sesiones eternas | BackgroundTask |
| **Mutex** | Mutual exclusion lock para evitar race conditions | Concurrency |
| **Reducer** | Función pura que transiciona estado | State Mgmt |
| **Effects** | Operaciones asincrónicas (DB, API, etc.) | Side Effects |
| **FSM** | Finite State Machine | LocationFSM |
| **WAL** | Write-Ahead Logging (SQLite durability) | Database |
| **OT** | Overtime (Horas Extra) | Payroll |
| **Tolerance Radius** | Rango de precisión GPS permitido | Geofence |
| **Audit Log** | Registro inmutable de todas las acciones | Integrity |

---

## 📝 CONCLUSIONES

El sistema **LEDTracker** es una arquitectura robusta y bien diseñada para tracking automático de jornadas laborales. Implementa patrones profesionales como:

✅ **State Management**: Redux-like con mutex protection  
✅ **Geofencing**: Hysteresis FSM para eliminar ruido GPS  
✅ **Persistence**: ACID transactions con WAL  
✅ **Auditoria**: Logs inmutables de todas las acciones  
✅ **Payroll**: Cálculos precisos en minutos enteros

### Áreas de Mejora Identificadas:

🔴 **Críticas:**
- Async locking (flag `isTaskRunning` no es suficiente)
- GPS validation (spoofing prevention)
- Duplicate session prevention

🟡 **Importantes:**
- Failsafe backup via AppState
- Report generation redundancy
- Database performance indexes

🟢 **Menores:**
- Structured logging enhancement
- Type-safe region management

Con las propuestas implementadas, el sistema alcanzará niveles de confiabilidad y seguridad **production-grade** apropiados para aplicaciones de nómina críticas.

---

**Documento generado:** 1 de Julio, 2026  
**Analista:** Asistente de GitHub Copilot  
**Repositorio:** BDevDPaz/LEDTracker  
**Licencia:** Propietaria - Byron Efrain De Paz Garcia
