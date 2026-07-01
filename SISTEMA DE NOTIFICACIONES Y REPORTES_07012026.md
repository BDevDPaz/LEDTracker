# 📬 ANÁLISIS EXHAUSTIVO DEL SISTEMA DE NOTIFICACIONES Y REPORTES
## LEDTracker - WTracker Auto-Check In/Out System

**Fecha del Análisis:** 1 de Julio, 2026  
**Repositorio:** `BDevDPaz/LEDTracker`  
**Tecnología:** React Native (Expo) + TypeScript + expo-notifications

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

El sistema de **Notificaciones y Reportes** en LEDTracker implementa un stack completo de feedback a usuario dividido en:

### **3 Subsistemas Principales:**

1. **📢 Sistema de Notificaciones Push** (expo-notifications)
   - Notificación diaria matutina (configurable)
   - Alertas de auto check-in/checkout
   - Notificación de reporte semanal

2. **📋 Generador de Reportes** (expo-print + expo-sharing)
   - PDF semanal con sesiones + auditoría GPS
   - Cálculos de nómina integrados
   - Envío automático por email (expo-mail-composer)

3. **💬 Sistema de Feedback Visual** (Toast + Dialog)
   - Toast queue con deduplicación
   - Dialogs modales con blur effect
   - Log bridge para conversión automática

### **Características Destacables:**

✅ **Deduplicación Inteligente:** Evita spam con throttling temporal  
✅ **Queue Management:** Controla flujo de toasts/dialogs  
✅ **Log-to-UI Bridge:** Convierte logs del sistema a feedback visual  
✅ **Background Reporting:** Genera reportes automáticamente cada semana  
✅ **Humanization:** Mensajes de error amigables para usuario

---

## 🔗 DEPENDENCIAS ENTRE UTILIDADES

### Mapa Jerárquico de Dependencias

```
┌─────────────────────────────────────────────────────────────────┐
│                   UI LAYER (React Components)                   │
│  app/(tabs)/*, LuxuryButton, LuxuryCard, report.tsx             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    ┌──────────────┐  ┌─────────────────┐  ┌─────────────┐
    │ LuxuryUI     │  │  Notifications  │  │   Report    │
    │ Context      │  │   Service       │  │  Generator  │
    │ (showToast)  │  │ (scheduleNotif) │  │ (genReport) │
    └──────┬───────┘  └────────┬────────┘  └──────┬──────┘
           │                   │                  │
         ┌─┴───────────────────┼──────────────────┤
         │                     │                  │
         ▼                     ▼                  ▼
    ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐
    │ logBridge    │  │ expo-notifications│  │ expo-print   │
    │ (convert to  │  │ + expo-task-mgr  │  │ expo-sharing │
    │ feedback)    │  │                  │  │ expo-mail    │
    └──────┬───────┘  └────────┬─────────┘  └──────┬───────┘
           │                   │                   │
           │         ┌─────────┴──────────┐       │
           │         │                    │       │
           ▼         ▼                    ▼       ▼
        ┌─────────────────────┐  ┌──────────────────────┐
        │  useLogFeedback     │  │  BackgroundTasks.ts  │
        │  (React Hook)       │  │  (Weekly generation) │
        │                     │  │                      │
        │ ┌─────────────────┐ │  │ ┌──────────────────┐ │
        │ │ setFeedback     │ │  │ │ isReportWindow   │ │
        │ │ Emitter()       │ │  │ │ generateReport() │ │
        │ └─────────────────┘ │  │ │ scheduleNotif()  │ │
        └─────────────────────┘  └──────────────────────┘
           │
         ┌─┴──────────────────────┐
         │                        │
         ▼                        ▼
    ┌──────────────┐       ┌────────────────┐
    │ logger.ts    │       │ Database       │
    │ (log())      │       │ (DB queries)   │
    │ [emits to    │       │                │
    │  feedback]   │       │ - work_sessions│
    └──────────────┘       │ - audit_logs   │
                           │ - settings     │
                           └────────────────┘
```

### Matriz de Dependencias Directas

| **Componente** | **Depende de** | **Usado por** | **Crítico** |
|---|---|---|---|
| `Notifications.ts` | expo-notifications, DB, logger | BackgroundTasks, LocationManager, RootLayout | ⭐⭐⭐ |
| `ReportGenerator.ts` | expo-print, expo-sharing, expo-mail, DB, utils | BackgroundTasks, report.tsx, manual trigger | ⭐⭐⭐ |
| `BackgroundTasks.ts` | expo-background-task, Notifications, ReportGenerator, LocationManager, DB | RootLayout init | ⭐⭐⭐ |
| `logBridge.ts` | logger, dayjs, types | useLogFeedback | ⭐⭐ |
| `useLogFeedback.ts` | logBridge, LuxuryUIContext | RootLayout (FeedbackBridge) | ⭐⭐ |
| `LuxuryUIContext.tsx` | react, expo-blur, reanimated | Components, report.tsx | ⭐⭐ |
| `RootLayout.tsx` | Services, Notifications, BackgroundTasks, LuxuryUIProvider | App entrypoint | ⭐⭐⭐ |

### Flujo de Dependencias de Datos

```
Sistem Event (Geofence/Failsafe)
    ↓
logger.log(severity, category, message, metadata)
    ├─→ Database (system_logs table)
    └─→ emitFeedbackFromLog() [logBridge.ts]
        ├─ mapToFeedback()     [Rules: severity, category]
        ├─ shouldThrottle()    [Dedupe window]
        └─ feedbackEmitter()   [Only if registered]
            ↓
        useLogFeedback Hook (in RootLayout)
            ├─ showToast(msg, type)   [Toast queue]
            └─ showDialog(options)    [Dialog queue]
                ↓
            LuxuryUIContext
                ├─ render Toast         [FadeInUp animation]
                └─ render Dialog Modal  [BlurView + buttons]

---

Manual Report Generation (User clicks button)
    ↓
report.tsx handleDownload/handleEmail
    ├─ generateWeeklyReport(shouldShare, customRange)
    │  ├─ getSettings()
    │  ├─ getAllAsync(work_sessions)
    │  ├─ getAllAsync(audit_logs)
    │  ├─ calculateSessionDuration()
    │  ├─ calculatePay()
    │  └─ Print.printToFileAsync(html)
    └─ Sharing.shareAsync() or sendReportByEmail()

---

Automatic Weekly Report (BackgroundTask)
    ↓
BackgroundTasks.ts defineTask()
    ├─ isReportWindow check
    │  └─ (Sun 20h:00-Tue 23:59)
    └─ if (lastReported !== currentWeekId)
       ├─ generateWeeklyReport(false)
       ├─ Notifications.scheduleNotificationAsync()
       │  └─ "📄 Reporte Semanal Listo"
       └─ AsyncStorage.setItem(LAST_REPORT_WEEK_ID)
```

---

## 📋 LISTA DE FUNCIONES CLAVE

### **1. NOTIFICATIONS SERVICE**

#### Notifications.ts (2.8 KB)

| Función | Responsabilidad | Async | Dependencias |
|---------|---|---|---|
| `setupNotifications()` | Verificar + solicitar permisos de notificaciones | ✅ | expo-notifications |
| `scheduleDailyMorningNotification()` | Programar notificación diaria matutina | ✅ | getSettings, Notifications |
| `scheduleDailyReminder(timeString)` | Agendar reminder en hora específica | ✅ | Notifications, ensureAndroidDefaultChannel |
| `ensureAndroidDefaultChannel()` | Crear canal Android con config | ✅ | Notifications, Platform |
| `cancelNotifications()` | Limpiar todas las notificaciones | ✅ | Notifications |

#### Detalles Técnicos:

```typescript
// Default configuration
const DEFAULT_CHANNEL_ID = 'default';
const DEFAULT_START_TIME = '06:30';
const NOTIFICATION_PROPERTIES = {
  importance: AndroidImportance.MAX,
  vibrationPattern: [0, 250, 250, 250],
  lightColor: '#FF231F7C'
}
```

---

### **2. REPORT GENERATOR SERVICE**

#### ReportGenerator.ts (12.5 KB)

| Función | Responsabilidad | Input | Output |
|---------|---|---|---|
| `generateWeeklyReport(shouldShare, customRange)` | Generar PDF con sesiones + auditoría | bool, range? | URI \| null |
| `sendReportByEmail(pdfUri, settings)` | Enviar PDF vía email native | URI, AppSettings | void |
| **Internal Helpers:** | | | |
| `formatCurrency()` | Format: $12.34 | number | string |
| `calculateSessionDuration()` | Net hours - lunch | sessions[] | ms |
| `calculatePay()` | Payroll con OT | hours, rate, multiplier | {pay, OT} |

#### HTML Report Structure:

```html
<html>
  <head>
    <!-- CSS inline: header, stats, table, audit section -->
  </head>
  <body>
    ├─ Header (WTracker title + subtitle)
    ├─ Info Grid (Employee, Company, Date Range)
    ├─ Stats Box (Total Hours, OT Hours, Est. Earnings)
    ├─ Sessions Table (Date, Client, Time, Hours, Pay)
    │  ├─ Lunch badge: "Lunch: -1h"
    │  ├─ Geo badge in: "✓ Auto Check-in (GPS)"
    │  └─ Geo badge out: "⚠ Auto Check-out (GPS)"
    ├─ Audit Section (Eventos críticos GPS & Sistema)
    └─ Footer (Generated timestamp)
  </body>
</html>
```

**Key Calculations:**
```typescript
// Payroll precision: Integer minutes
const totalMinutes = calculateSessionMinutes(start, end, lunch);
const { totalPay, overtimeMinutes } = calculatePayFromMinutes(
  totalMinutes,
  hourly_rate,
  overtime_multiplier  // Default: 1.5x
);
```

---

### **3. BACKGROUND TASKS SERVICE**

#### BackgroundTasks.ts (9 KB)

| Función | Trigger | Frecuencia | Side Effects |
|---------|---|---|---|
| `defineTask(TASK_NAME)` | OS Background Task | 15+ min (configurable) | Failsafe + Report |
| `BackgroundTasks.register()` | Manual (app init) | Once per session | Register with OS |
| `BackgroundTasks.unregister()` | Manual (app close) | Once per session | Cleanup |
| `BackgroundTasks.triggerForTesting()` | Dev only | Manual | Immediate trigger |

#### Task Phases:

```typescript
[Phase 1: FAILSAFE AUTO CHECKOUT]
├─ Read AsyncStorage.EXIT_TIMESTAMP_KEY
├─ if (timeDiff > 45 min):
│  ├─ updateSessionEndTime()
│  ├─ insertAuditLog('AUTO_CHECKOUT_GPS')
│  └─ Notifications.scheduleNotificationAsync()
│     └─ "Jornada Finalizada 🏁"

[Phase 2: WEEKLY REPORT]
└─ if (isReportWindow: Sun 20h - Tue 23h59):
   ├─ generateWeeklyReport(false, customRange)
   ├─ if (!lastReported[weekId]):
   │  ├─ Notifications.scheduleNotificationAsync()
   │  │  └─ "📄 Reporte Semanal Listo"
   │  └─ AsyncStorage.setItem(LAST_REPORT_WEEK_ID)
   └─ else: skip (already notified)
```

**Critical Constants:**
```typescript
const TASK_NAME = 'APP_BACKGROUND_SERVICES';
const REPORT_STORAGE_KEY = 'LAST_REPORT_WEEK_ID';
const FAILSAFE_THRESHOLD_MS = 45 * 60 * 1000;  // 45 minutes
const isReportWindow = (day === 0 && hour >= 20) || day === 1 || day === 2;
```

---

### **4. LOG BRIDGE & FEEDBACK SYSTEM**

#### logBridge.ts (9.5 KB)

| Función | Responsabilidad | Input | Output |
|---------|---|---|---|
| `emitFeedbackFromLog()` | Convert log → feedback payload | severity, category, message | FeedbackPayload \| null |
| `mapToFeedback()` | Apply visibility rules | severity, category, message | FeedbackPayload \| null |
| `shouldEmitFeedback()` | Filter noisy logs | severity, category, message | boolean |
| `humanizeMessage()` | Friendly error messages | category, message | string |
| `shouldThrottle()` | Dedupe + throttle window | payload | boolean |

#### Visibility Rules:

```typescript
SILENT_SEVERITIES = ['DEBUG']
SILENT_CATEGORIES = [
  'SIN_CAMBIOS',
  'BACKGROUND_TASK',
  'ESTADO_SISTEMA',
  'SERVICIOS_ACTIVOS',
  'EVENTO_GEOCERCA',
  'REINICIO_MONITOREO',
  'MONITOREO_DETENIDO'
]

IMPORTANT_VISIBLE_CATEGORIES = [
  'ERROR_CRITICO',
  'INTEGRIDAD_COMPROMETIDA',
  'ADVERTENCIA',
  'PERMISOS_CONCEDIDOS'
]

THROTTLE_WINDOWS = {
  toast: 1800ms,   // Can re-show same toast after 1.8s
  dialog: 3500ms,  // Can re-show same dialog after 3.5s
  mapCleanup: 60s  // Remove old entries from dedupe map
}
```

#### useLogFeedback Hook (useLogFeedback.ts):

```typescript
export const useLogFeedback = () => {
  const { showToast, showDialog } = useLuxuryUI();
  
  useEffect(() => {
    setFeedbackEmitter((payload) => {
      if (payload.kind === 'toast') {
        showToast(payload.message, payload.tone);
      } else if (payload.kind === 'dialog') {
        showDialog({
          title: payload.title,
          message: payload.message,
          ...payload
        });
      }
    });
  }, [showToast, showDialog]);
};
```

---

### **5. LUXURY UI CONTEXT**

#### LuxuryUIContext.tsx (14 KB)

| Función | Responsabilidad | Input | Output |
|---------|---|---|---|
| `showToast(msg, type)` | Queue + display toast | string, 'success'\|'error'\|'info' | void |
| `showDialog(options)` | Queue + display dialog | DialogOptions | void |
| `flushNextToast()` | Process toast queue | - | void |
| `flushNextDialog()` | Process dialog queue | - | void |
| `openWeeklyReport()` | Modal visibility control | - | void |
| `closeWeeklyReport()` | Modal visibility control | - | void |

#### Toast Queue Logic:

```typescript
MAX_TOAST_QUEUE_SIZE = 3;              // Max pending toasts
TOAST_DUPLICATE_WINDOW_MS = 2000;      // Dedupe temporal
DEFAULT_TOAST_DURATION_MS = 3000;      // Auto-hide timeout

showToast() {
  ├─ Check dedupe window (lastToastRef)
  ├─ Check current visible (toast)
  ├─ Check pending queue
  └─ if (toastQueueRef.length < MAX):
     └─ Push to queue or display if empty
}
```

#### Dialog Queue Logic:

```typescript
DIALOG_DUPLICATE_WINDOW_MS = 1000;     // Shorter dedupe

showDialog() {
  ├─ Check dedupe window
  ├─ Check visible dialog
  ├─ Check pending queue
  └─ Push or display if none visible
}

handleDialogConfirm/Cancel() {
  ├─ Execute callback (if provided)
  ├─ Flush next from queue
  └─ Handle errors safely
}
```

---

### **6. ROOT LAYOUT INITIALIZATION**

#### app/_layout.tsx (6.8 KB)

| Función | Responsabilidad | Phase |
|---------|---|---|
| `prepare()` | Initialize app services | startup |
| `initDatabase()` | SQLite setup + WAL | startup |
| `setLoggerDB()` | Connect logger to DB | startup |
| `BackgroundTasks.register()` | Register OS background task | startup |
| `setupNotifications()` | Request + configure notifications | startup |
| `scheduleDailyMorningNotification()` | Agenda diario reminder | startup |
| `handleNotificationAction()` | Route on notification tap | runtime |
| `Notifications.addNotificationResponseReceivedListener()` | Listen for interactions | runtime |

#### Startup Sequence:

```
App Launch
    ↓
RootLayout.prepare()
    ├─ Step 1: initDatabase()
    │  └─ Create schema + WAL
    ├─ Step 2: setLoggerDB()
    │  └─ Connect logger.ts to DB instance
    ├─ Step 3: BackgroundTasks.register()
    │  └─ Register TASK_NAME with OS
    ├─ Step 4: setupNotifications()
    │  └─ Request + verify permissions
    └─ Step 5: scheduleDailyMorningNotification()
       └─ Setup recurrent reminder
    
    ↓
setAppIsReady(true)
    ↓
UI renders
    ├─ FeedbackBridge mounts → useLogFeedback()
    ├─ Notification response listener setup
    └─ Routes configured
```

---

## 🎯 TABLA DE RESPONSABILIDADES

### Matriz Completa de Responsabilidades

```
┌──────────────────────────────────────────────────────────────────────────┐
│      RESPONSABILIDADES POR COMPONENTE Y FASE DEL CICLO DE VIDA           │
└──────────────────────────────────────────────────────────────────────────┘
```

| **Componente** | **Fase** | **Responsabilidad Primaria** | **Secundaria** | **Restricción** |
|---|---|---|---|---|
| **Notifications.ts** | Startup + Runtime | Permisos + Configuración de notificaciones | Agendar recordatorios | No lógica de negocio |
| **ReportGenerator.ts** | Runtime + Background | Generar PDF con datos + estilos | Cálculos de nómina | No debe bloquear UI |
| **BackgroundTasks.ts** | Startup + Runtime (OS-triggered) | Ejecutar tareas periódicas | Generar reports, failsafe | 15+ min interval min |
| **logBridge.ts** | Startup (hook register) | Convertir logs a feedback | Humanizar mensajes | Pure function |
| **useLogFeedback.ts** | Startup | Registrar emitter callback | Conectar log ↔ UI | React Hook |
| **LuxuryUIContext.tsx** | Entire session | Gestionar toast + dialog queues | Dedupe + throttle | Provider pattern |
| **RootLayout.tsx** | Startup | Orquestar inicialización | Manejo de notificaciones | Blocking during prepare |

### Matriz de Permisos y Accesos

| **Componente** | **Acceso a DB** | **Notificaciones** | **File System** | **Email** | **Storage** |
|---|:---:|:---:|:---:|:---:|:---:|
| Notifications.ts | ✅ Read settings | ✅ Agenda | ❌ | ❌ | ❌ |
| ReportGenerator.ts | ✅ Read sessions/audit | ❌ | ✅ Print + Share | ✅ Compose | ❌ |
| BackgroundTasks.ts | ✅ Read/Write | ✅ Agenda | ❌ | ❌ | ✅ AsyncStorage |
| logBridge.ts | ❌ | ❌ | ❌ | ❌ | ❌ |
| useLogFeedback.ts | ❌ | ❌ | ❌ | ❌ | ❌ |
| LuxuryUIContext.tsx | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 📊 DIAGRAMAS DE FLUJO

### **FLUJO 1: Daily Morning Notification**

```
┌─────────────────────────────────────────────────────────────┐
│         DAILY MORNING NOTIFICATION FLOW                     │
└─────────────────────────────────────────────────────────────┘

    [App Startup]
    ├─ RootLayout.prepare()
    │
    ▼
    setupNotifications()
    ├─ Request permission (if not granted)
    │  └─ Notifications.requestPermissionsAsync()
    └─ if (status === 'granted'):
       return true
    
    ▼
    scheduleDailyMorningNotification()
    ├─ getSettings()
    │  └─ DB: SELECT start_time FROM settings
    ├─ timeToSet = settings.start_time || '06:30'
    └─ scheduleDailyReminder(timeToSet)
    
    ▼
    scheduleDailyReminder('06:30')
    ├─ Parse time: hour=6, minute=30
    ├─ Validate: 0 ≤ hour ≤ 23, 0 ≤ minute ≤ 59
    ├─ Notifications.cancelAllScheduledNotificationsAsync()
    │  └─ ⭐ Clear previous scheduled (important!)
    ├─ Notifications.scheduleNotificationAsync({
    │   content: {
    │     title: '¡Buenos días! ☀️',
    │     body: 'Es hora de iniciar tu jornada en WTracker.',
    │     data: { action: 'OPEN_DAILY_SETUP' }
    │   },
    │   trigger: {
    │     type: DAILY,
    │     hour: 6,
    │     minute: 30,
    │     channelId: 'default' (Android)
    │   }
    │ })
    └─ log('VERDE', 'OPERACION_EXITOSA', ...)
    
    ▼ [Every day at 06:30]
    OS triggers notification
    
    ▼
    Device shows banner
    
    ▼ [User taps notification]
    Notifications.addNotificationResponseReceivedListener()
    │
    └─ handleNotificationAction(router, {action: 'OPEN_DAILY_SETUP'})
       ├─ router.push('/(tabs)')
       ├─ setTimeout(() => router.setParams({showSetup: 'true'}), 100)
       │  └─ ⭐ Async route param to avoid race condition
       └─ Modal appears for new session setup
```

---

### **FLUJO 2: Auto Check-in/Checkout Notification**

```
┌──────────────────────────────────────────────────────────────┐
│    AUTO CHECKIN/CHECKOUT NOTIFICATION (from Geofence)       │
└──────────────────────────────────────────────────────────────┘

    [Geofence Event Detected]
    ↓ (in LocationManager.ts)
    
    ┌─────── AUTO CHECK-IN ──────┐
    │                            │
    │ transition === 'ENTERED'   │
    │ status in ['pending_arrival',│
    │          'travel']        │
    │                            │
    └────────────┬──────────────┘
                 │
                 ▼
    Promise.all([
      DB: UPDATE status='active',
      insertAuditLog('AUTO_CHECKIN_GPS'),
      AsyncStorage.removeItem(EXIT_KEY),
      
      ✅ Notifications.scheduleNotificationAsync({
         content: {
           title: '📍 Llegaste al sitio',
           body: `Auto Check-in (GPS) validado en ${client_name||address}. ¡Buen trabajo!`,
           sound: true
         },
         trigger: null  ← Immediate
       }),
       
      engine.dispatch({type: 'SYNC_ACTIVE_SESSION'})
    ])
    
    ▼
    Device shows notification
    ├─ Vibrates (if enabled)
    └─ Plays sound (configurable)

    ┌────────── AUTO CHECK-OUT ─────────┐
    │                                   │
    │ transition === 'EXITED'           │
    │ status === 'active'               │
    │ [Exits geofence boundary]         │
    │                                   │
    └────────────┬──────────────────────┘
                 │
                 ▼
    Promise.all([
      AsyncStorage.setItem(EXIT_TIMESTAMP_KEY, now),
      insertAuditLog('GEOFENCE_EXIT'),
      
      ✅ Notifications.scheduleNotificationAsync({
         content: {
           title: '⚠️ Saliste del área de trabajo',
           body: `Se detectó tu salida de ${client_name||address}.`,
           data: { action: 'CHECKOUT_DECISION' },
           sound: true,
           priority: MAX
         },
         trigger: null  ← Immediate
       })
    ])
    
    ▼ [User receives notification]
    
    ▼ [User can tap → CHECKOUT_DECISION]
    handleNotificationAction()
    └─ router.push('/(tabs)')
       └─ router.setParams({showCheckoutPrompt: 'true'})
          └─ Modal: "Confirmación cierre de jornada?"
```

---

### **FLUJO 3: Weekly Report Generation & Notification**

```
┌──────────────────────────────────────────────────────────────┐
│     WEEKLY REPORT GENERATION & NOTIFICATION FLOW              │
└──────────────────────────────────────────────────────────────┘

    [Two Paths Possible]

    PATH A: AUTOMATIC (Background Task)
    ════════════════════════════════════
    
    OS triggers BackgroundTasks.defineTask() (15+ min)
    ├─ Mutex check: if (isTaskRunning) return;
    ├─ isTaskRunning = true
    │
    └─ Check time window:
       const isReportWindow =
         (day === 0 && hour >= 20)    [Sun 20:00-23:59]
         || day === 1                 [Mon 00:00-23:59]
         || day === 2                 [Tue 00:00-23:59]
    
    ├─ if (isReportWindow):
    │   └─ const lastReported = AsyncStorage.get(REPORT_KEY)
    │      const currentWeekId = dayjs().startOf('week').format('YYYY-MM-DD')
    │
    │      if (lastReported !== currentWeekId):  ← Only once per week
    │      
    │        generateWeeklyReport(false, customRange)
    │        ├─ getSettings()
    │        ├─ DB: SELECT work_sessions WHERE start >= ? AND end <= ?
    │        ├─ DB: SELECT audit_logs ...
    │        ├─ Calculate totals (hours, OT, earnings)
    │        ├─ Build HTML with inline CSS
    │        ├─ Print.printToFileAsync(html)
    │        │  └─ Returns PDF URI
    │        └─ return pdfUri
    │
    │      if (pdfUri):
    │        ├─ Notifications.scheduleNotificationAsync({
    │        │   content: {
    │        │     title: '📄 Reporte Semanal Listo',
    │        │     body: 'Toca para revisar y enviar tu nómina.',
    │        │     data: { action: 'GENERATE_REPORT_PROMPT' },
    │        │     sound: true
    │        │   },
    │        │   trigger: null
    │        │ })
    │        └─ AsyncStorage.setItem(REPORT_KEY, currentWeekId)
    │           └─ Prevents duplicate generation
    │
    └─ isTaskRunning = false
    
    ▼ [User receives notification]
    
    ▼ [User taps: GENERATE_REPORT_PROMPT]
    handleNotificationAction()
    └─ router.push('/(tabs)/report')
       └─ Report screen displays

    ────────────────────────────────────

    PATH B: MANUAL (User clicks button)
    ════════════════════════════════════
    
    report.tsx: handleDownload()
    ├─ setIsProcessing(true)
    ├─ generateWeeklyReport(true)
    │  │
    │  ├─ [Same generation logic as PATH A]
    │  │
    │  └─ if (shouldShare):
    │     └─ Sharing.shareAsync(uri)
    │        └─ Shows share sheet (Save, Email, etc.)
    │
    ├─ showToast('Reporte generado', 'success')
    └─ setIsProcessing(false)

    report.tsx: handleEmail()
    ├─ setIsProcessing(true)
    ├─ settings = getSettings()
    ├─ pdfUri = generateWeeklyReport(false)
    │  └─ [Same generation, but no auto-share]
    │
    ├─ sendReportByEmail(pdfUri, settings)
    │  ├─ isAvailable = MailComposer.isAvailableAsync()
    │  └─ if (isAvailable):
    │     └─ MailComposer.composeAsync({
    │        recipients: [company_email],
    │        subject: `Nómina Semanal - ${employee_name}`,
    │        body: '...',
    │        attachments: [pdfUri]
    │      })
    │      └─ Opens native email client
    │
    ├─ showToast('Abriendo aplicación de correo...', 'success')
    └─ setIsProcessing(false)
```

---

### **FLUJO 4: Log Bridge to UI Feedback**

```
┌──────────────────────────────────────────────────────────────┐
│        LOG BRIDGE → FEEDBACK FLOW (Log-to-UI Conversion)     │
└──────────────────────────────────────────────────────────────┘

    System Event (any component)
    ├─ locationAdapter error
    ├─ DB transaction fail
    ├─ Geofence event
    └─ Permission request
    
    ▼
    logger.log(color, category, severity, message, metadata)
    [src/utils/logger.ts]
    
    ├─ Log to console (real-time debug)
    ├─ Queue to logQueue (if DB not ready)
    ├─ Insert to DB when ready
    │
    └─ ⭐ emitFeedbackFromLog(severity, category, message)
       [src/feedback/logBridge.ts]
    
    ▼ [logBridge.ts]
    
    shouldEmitFeedback(severity, category, message)
    ├─ if (severity in SILENT_SEVERITIES):
    │  └─ return false
    │
    ├─ if (category in SILENT_CATEGORIES):
    │  └─ return false
    │
    ├─ if (category in IMPORTANT_VISIBLE_CATEGORIES):
    │  └─ return true
    │
    ├─ if (severity === 'EVENT'):
    │  └─ return false
    │
    ├─ if (severity === 'ERROR' && category in NON_BLOCKING):
    │  └─ return false
    │
    ├─ if (severity === 'INFO'):
    │  └─ Only if "Auto Check-in" or "Reporte"
    │
    └─ if (severity === 'ERROR'):
       └─ return true
    
    ▼ (if should emit)
    
    mapToFeedback(severity, category, message)
    ├─ humanizeMessage(category, message)
    │  └─ Convert technical message to user-friendly text
    │     e.g.: "Error crítico inicializando la app"
    │         → "La aplicación no pudo iniciar..."
    │
    ├─ Determine feedback kind and tone:
    │  
    │  if (category === 'ERROR_CRITICO'):
    │    └─ kind: 'dialog', tone: 'error', destructive: false
    │
    │  else if (severity === 'WARN'):
    │    └─ kind: 'toast', tone: 'info', durationMs: 3200
    │
    │  else if (category === 'OPERACION_EXITOSA'):
    │    └─ kind: 'toast', tone: 'success', durationMs: 2600
    │
    └─ return FeedbackPayload
    
    ▼
    
    shouldThrottle(payload)
    ├─ generateKey from payload (title + message)
    ├─ Check lastEmissionByKey.get(key)
    ├─ if (now - lastEmissionTime < THROTTLE_WINDOW):
    │  └─ return true (skip this feedback)
    │
    ├─ Clean up old entries (TTL: 60s)
    └─ Record this emission
    
    ▼ (if not throttled)
    
    feedbackEmitter(payload)  ← Callback registered by useLogFeedback
    
    ╔════════════════════════════════════╗
    ║  [React Component: useLogFeedback] ║
    ║  [mounted in RootLayout]           ║
    ╚════════════════════════════════════╝
    
    if (payload.kind === 'toast'):
      └─ showToast(payload.message, payload.tone)
    else if (payload.kind === 'dialog'):
      └─ showDialog({
           title: payload.title,
           message: payload.message,
           ...
         })
    
    ▼ [LuxuryUIContext.tsx]
    
    showToast(msg, type)
    ├─ Normalize + validate message
    ├─ Check dedupe window (TOAST_DUPLICATE_WINDOW_MS)
    ├─ if (duplicate in last 2s):
    │  └─ return (skip)
    │
    ├─ if (!currentToast):
    │  └─ setToast(item)  ← Display immediately
    │
    └─ else:
       └─ Push to toastQueueRef (max 3)
    
    ▼
    
    Toast renders with animation
    ├─ FadeInUp animation
    ├─ Style based on type:
    │  ├─ success: green (#4CAF50)
    │  ├─ error: red (#F44336)
    │  └─ info: dark (#333)
    │
    ├─ After durationMs:
    │  └─ FadeOutUp animation
    │
    ├─ Toast disappears
    └─ Next from queue auto-displays

    ════════════════════════════════════
    
    showDialog(options)
    ├─ Normalize + validate
    ├─ Check dedupe window (1s shorter)
    ├─ if (!currentDialog):
    │  └─ setDialog(options)
    │
    └─ else:
       └─ Push to dialogQueueRef
    
    ▼
    
    Dialog renders:
    ├─ Modal with BlurView background
    ├─ Title (colored gold)
    ├─ Message (centered)
    ├─ Cancel button (gray)
    ├─ Confirm button (gold or red if destructive)
    │
    ├─ User taps button
    └─ Execute callback (if provided)
       └─ Flush next from queue
```

---

## ⚠️ POSIBLES CASOS EXTREMOS

### **CASO 1: Notification Permission Denial**

**Escenario:**
```
User:
1. Denies notification permission at startup
2. Opens app
3. Tries to enable daily reminder in settings
```

**Impacto:**
- ❌ `setupNotifications()` returns false
- ❌ `scheduleDailyMorningNotification()` silently fails
- ❌ No feedback to user about why notification didn't schedule

**Estado Actual:** ⚠️ No explicit error shown

```typescript
async setupNotifications() {
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    log('AMARILLO', 'ADVERTENCIA', 'WARN', 'Permiso denegado.');
    return false;  ← ⭐ Silent failure
  }
}
```

**Solución Recomendada:**
```typescript
if (finalStatus !== 'granted') {
  // Emit feedback to UI
  emitFeedbackFromLog(
    'WARN',
    'ADVERTENCIA',
    'Permiso de notificaciones denegado. Algunas alertas automáticas no funcionarán.'
  );
  
  return false;
}
```

---

### **CASO 2: Report Generation Large Dataset**

**Escenario:**
```
User worked:
- 60 sessions in past month
- 500+ audit log entries
- Custom range: full month (not weekly)

→ HTML rendering can be HUGE (>2-3MB)
→ Print.printToFileAsync() may timeout
→ Memory spike on low-end Android device
```

**Impacto:**
- ❌ App freezes 5-10 seconds
- ❌ OOM crash on low-end devices
- ❌ PDF generation silently fails (timeout)

**Estado Actual:** ⚠️ No pagination or streaming

```typescript
const html = `<html>...${rows.map(r => HTML).join('')}...</html>`;
// Concatenates all sessions into single string
// No chunking or pagination
```

**Solución Recomendada:**
```typescript
// Paginate if > 30 sessions
const SESSIONS_PER_PAGE = 30;
if (sessions.length > SESSIONS_PER_PAGE) {
  // Generate multiple PDFs or use server-side generation
  return await generateMultiPageReport(sessions, SESSIONS_PER_PAGE);
}

// OR: Implement streaming/chunking
const generateHtmlChunk = (sessionChunk) => { ... };
const chunks = chunk(sessions, SESSIONS_PER_PAGE);
const htmlParts = chunks.map(generateHtmlChunk);
```

---

### **CASO 3: Weekly Report Window Ambiguity**

**Escenario:**
```
Timezone: User in UTC+5
Report window (code): Sun 20:00 - Tue 23:59 UTC

Sunday 19:00 UTC+5 (= Sun 14:00 UTC)
→ Not in window yet, wait 6 hours

Sunday 21:00 UTC+5 (= Sun 16:00 UTC)
→ STILL not in window (only 20:00 UTC)

→ User expects report Friday, but doesn't get it
```

**Impacto:**
- ❌ Timezone handling not explicit
- ❌ Code uses `dayjs().day()` without timezone awareness
- ❌ Window may not match user's local timezone

**Estado Actual:** ⚠️ Uses system timezone implicitly

```typescript
const currentDate = dayjs();  // ← Uses LOCAL timezone
const day = currentDate.day();
const hour = currentDate.hour();

const isReportWindow = 
  (day === 0 && hour >= 20) || day === 1 || day === 2;
```

**Solución Recomendada:**
```typescript
// Make timezone explicit
const userTimezone = settings.timezone || 'UTC';
const currentDate = dayjs().tz(userTimezone);

// Document the window clearly
const REPORT_WINDOW = {
  startDayOfWeek: 0,     // Sunday
  startHour: 20,         // 20:00
  endDayOfWeek: 2,       // Tuesday
  endHour: 23,
  minutes: 59
};

// Or: Move to LAST scheduled (Wed/Thu) for consistency
```

---

### **CASO 4: Toast Queue Overflow & Memory Leak**

**Escenario:**
```
Geofence events fire rapidly:
- Enter → showToast("Arrived")
- Exit → showToast("Left")
- Enter → showToast("Arrived")
... x 50 times (GPS bouncing)

→ toastQueueRef accumulates 3+ messages
→ each holding message + ID + callbacks
→ Memory not released if toasts cleared
```

**Impacto:**
- ⚠️ MAX_TOAST_QUEUE_SIZE = 3 caps it
- ⚠️ Old toasts discarded (oldest removed first)
- ⭐ **Actually: Safe due to queue limit**

**Estado Actual:** ✅ Protected by queue cap

```typescript
const MAX_TOAST_QUEUE_SIZE = 3;

if (toastQueueRef.current.length >= MAX_TOAST_QUEUE_SIZE) {
  toastQueueRef.current.shift();  // Remove oldest
}

toastQueueRef.current.push(item);
```

**Minor Improvement:**
```typescript
// Add memory tracking
const TOAST_QUEUE_WARN_SIZE = 5;
if (toastQueueRef.current.length >= TOAST_QUEUE_WARN_SIZE) {
  logStructured('WARN', 'ADVERTENCIA', 
    `Toast queue growing (${length} pending)`, 
    { queueSize: length }
  );
}
```

---

### **CASO 5: Email Send Failure (MailComposer Not Available)**

**Escenario:**
```
Report screen, user clicks "SEND BY EMAIL"

Device:
- No email account configured
- Gmail app not installed
- MailComposer native module unavailable (rare)

→ MailComposer.isAvailableAsync() returns false
→ Falls back to Sharing.shareAsync()
→ User sees native share sheet (not email)
```

**Impacto:**
- ⚠️ Unexpected behavior (user clicks "Email", gets "Share")
- ⭐ **Actually: Graceful fallback**

**Estado Actual:** ✅ Handles gracefully

```typescript
const isAvailable = await MailComposer.isAvailableAsync();

if (isAvailable) {
  await MailComposer.composeAsync({...});
} else {
  await Sharing.shareAsync(pdfUri);  // ← Fallback
}
```

**Enhancement:**
```typescript
if (isAvailable) {
  await MailComposer.composeAsync({...});
} else {
  showToast(
    'No email app configured. Use the share button to send.',
    'info'
  );
  await Sharing.shareAsync(pdfUri);
}
```

---

### **CASO 6: Background Task Mutex Race Condition**

**Escenario:**
```
BackgroundTask defined with isTaskRunning flag:
let isTaskRunning = false;

Timing:
- T0: OS triggers task → check: isTaskRunning === false
- T1: Set isTaskRunning = true
- T2: OS triggers task again (shouldn't happen but...)
  → check: isTaskRunning === true
  → return SKIP
- T3: Original task finishes → isTaskRunning = false

Problem: flag is NOT atomic
```

**Impacto:**
- ⚠️ Very unlikely (OS shouldn't fire task twice)
- ❌ If it happens: second invocation loses data
- ❌ flag is volatile, not locked

**Estado Actual:** ⚠️ Uses simple flag (not fully safe)

```typescript
let isTaskRunning = false;  // ← Not atomic

TaskManager.defineTask(TASK_NAME, async () => {
  if (isTaskRunning) {
    log('...Mutex bloqueado...');
    return BackgroundTask.BackgroundTaskResult.Success;
  }
  
  isTaskRunning = true;  // ← Race window here
  try {
    // ... work ...
  } finally {
    isTaskRunning = false;
  }
});
```

**Solución Recomendada:**
```typescript
// Use AsyncStorage as pseudo-lock
const TASK_LOCK_KEY = 'BG_TASK_LOCK';
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;  // 5 min

const acquireTaskLock = async () => {
  const locked = await AsyncStorage.getItem(TASK_LOCK_KEY);
  if (locked) {
    const lockTime = parseInt(locked, 10);
    const age = Date.now() - lockTime;
    
    if (age < LOCK_TIMEOUT_MS) {
      return false;  // Still locked
    }
    // Lock is stale, assume previous task crashed
  }
  
  await AsyncStorage.setItem(TASK_LOCK_KEY, Date.now().toString());
  return true;
};

const releaseTaskLock = async () => {
  await AsyncStorage.removeItem(TASK_LOCK_KEY);
};
```

---

### **CASO 7: Notification Channel Not Created (Android)**

**Escenario:**
```
Android 8+:
1. App doesn't create notification channel
2. Notifications.scheduleNotificationAsync() called
3. Notification silently fails (no error)

Code:
ensureAndroidDefaultChannel() only called in:
- setupNotifications() [startup]
- scheduleDailyReminder() [at schedule time]

But NOT called when:
- Geofence events schedule notifications
- BackgroundTasks schedule notifications
```

**Impacto:**
- ❌ Geofence entry notification never shows (Android)
- ❌ Failsafe notification never shows
- ❌ No error logged

**Estado Actual:** ⚠️ Channel created at startup, but...

```typescript
// LocationManager.ts
Notifications.scheduleNotificationAsync({
  content: {...},
  trigger: null
});
// ← No channelId specified!

// BackgroundTasks.ts
Notifications.scheduleNotificationAsync({
  content: {...},
  trigger: null
});
// ← No channelId specified!
```

**Solución Recomendada:**
```typescript
// Create helper for all notifications
const scheduleNotificationWithChannel = async (content) => {
  if (Platform.OS === 'android') {
    await ensureAndroidDefaultChannel();
  }
  
  return Notifications.scheduleNotificationAsync({
    content,
    trigger: null,
    channelId: DEFAULT_CHANNEL_ID  // ← Always specify
  });
};

// Use everywhere:
await scheduleNotificationWithChannel({
  title: '📍 Llegaste al sitio',
  ...
});
```

---

### **TABLA RESUMEN: CASOS EXTREMOS & SEVERIDAD**

| # | Caso Extremo | Severidad | Impacto | Estado | Recomendación |
|---|---|---|---|---|---|
| 1 | Permission denial silent | 🔴 Alta | No feedback a usuario | ⚠️ Silent | Emit feedback dialog |
| 2 | Large report dataset | 🟡 Media | Freeze/OOM | ⚠️ No handling | Pagination + streaming |
| 3 | Timezone ambiguity | 🟠 Media | Report en zona horaria incorrecta | ⚠️ No timezone | Explicit timezone handling |
| 4 | Toast queue overflow | 🟢 Baja | Memory concern | ✅ Safe (cap=3) | Add monitoring |
| 5 | MailComposer unavailable | 🟢 Baja | Fallback a Share | ✅ Graceful | Add feedback msg |
| 6 | Background task race condition | 🔴 Alta | Data loss potencial | ⚠️ Flag only | AsyncStorage lock |
| 7 | Notification channel missing | 🔴 Alta | Notificaciones no se muestran (Android) | ⚠️ Parcial | Especificar channel ID |

---

## 🚀 PROPUESTAS DE OPTIMIZACIÓN

### **PROPUESTA 1: Robust Permission Management**

#### Objetivo:
Garantizar que el usuario reciba feedback claro cuando permisos fallan.

#### Implementación:

```typescript
// src/services/NotificationsEnhanced.ts

export interface PermissionCheckResult {
  isGranted: boolean;
  reason: 'granted' | 'denied' | 'restricted' | 'undetermined';
  message: string;
}

export async function requestAndConfigureNotifications(): Promise<PermissionCheckResult> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    
    if (existingStatus === 'denied') {
      return {
        isGranted: false,
        reason: 'denied',
        message: 'Las notificaciones están desactivadas. ' +
                 'Ve a Ajustes > Notificaciones y actívalas.'
      };
    }
    
    if (existingStatus === 'granted') {
      await ensureAndroidDefaultChannel();
      return {
        isGranted: true,
        reason: 'granted',
        message: 'Notificaciones activas'
      };
    }
    
    // Request if undetermined
    const { status } = await Notifications.requestPermissionsAsync();
    
    if (status === 'granted') {
      await ensureAndroidDefaultChannel();
      return {
        isGranted: true,
        reason: 'granted',
        message: 'Notificaciones habilitadas'
      };
    } else {
      return {
        isGranted: false,
        reason: status === 'denied' ? 'denied' : 'restricted',
        message: 'No pudimos habilitar las notificaciones. ' +
                 'Verifica los permisos en Ajustes.'
      };
    }
  } catch (error) {
    return {
      isGranted: false,
      reason: 'undetermined',
      message: 'Error al verificar notificaciones.'
    };
  }
}

// Usage in RootLayout:
const result = await requestAndConfigureNotifications();
if (!result.isGranted) {
  emitFeedbackFromLog('WARN', 'ADVERTENCIA', result.message);
}
```

---

### **PROPUESTA 2: Report Generation Optimization & Pagination**

#### Objetivo:
Evitar crashes y freezes en reportes grandes.

```typescript
// src/services/ReportGeneratorEnhanced.ts

const SESSIONS_PER_PAGE = 30;
const AUDIT_LOGS_PER_SECTION = 100;

interface ReportGenerationOptions {
  shouldShare: boolean;
  customRange?: { start: number; end: number };
  paginate?: boolean;  // Force pagination even if < 30 sessions
}

export const generateWeeklyReportOptimized = async (
  options: ReportGenerationOptions
): Promise<string | null> => {
  try {
    const settings = await getSettings();
    if (!settings) throw new Error('Settings not found');

    const { startTs, endTs, rangeTitle } = getReportTimeRange(options.customRange);

    // Query with LIMIT to prevent memory spike
    const sessions = await getAllAsync<WorkSession>(
      `SELECT * FROM work_sessions
       WHERE start_time >= ? AND start_time <= ?
       ORDER BY start_time ASC
       LIMIT ${SESSIONS_PER_PAGE * 5}`,  // Warn if > 150 sessions
      [startTs, endTs]
    );

    const logs = await getAllAsync<AuditLog>(
      `SELECT * FROM audit_logs
       WHERE timestamp >= ? AND timestamp <= ?
       ORDER BY timestamp DESC
       LIMIT ${AUDIT_LOGS_PER_SECTION * 3}`,
      [startTs, endTs]
    );

    // Warn if dataset is large
    if (sessions.length > SESSIONS_PER_PAGE * 2) {
      logStructured('WARN', 'ADVERTENCIA', 
        `Large report detected (${sessions.length} sessions). ` +
        `Esto puede tomar más tiempo.`
      );
    }

    // Process in chunks
    const sessionChunks = chunk(sessions, SESSIONS_PER_PAGE);
    const logChunks = chunk(logs, AUDIT_LOGS_PER_SECTION);

    // If paginated, generate one HTML per page, combine PDFs
    if (sessionChunks.length > 1) {
      return await generateMultiPageReport(
        sessionChunks,
        logChunks,
        settings,
        rangeTitle,
        options.shouldShare
      );
    }

    // Otherwise single page (existing logic)
    return await generateSinglePageReport(
      sessions,
      logs,
      settings,
      rangeTitle,
      options.shouldShare
    );

  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Report generation failed', error);
    return null;
  }
};

// Helper: Generate multi-page report
const generateMultiPageReport = async (
  sessionChunks: WorkSession[][],
  logChunks: AuditLog[][],
  settings: AppSettings,
  rangeTitle: string,
  shouldShare: boolean
): Promise<string | null> => {
  const pdfUris: string[] = [];

  for (let i = 0; i < sessionChunks.length; i++) {
    const sessions = sessionChunks[i];
    const logs = logChunks[i] || [];

    const html = buildReportHtml(sessions, logs, settings, rangeTitle, i + 1, sessionChunks.length);
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    pdfUris.push(uri);
  }

  // Combine PDFs (would need library like pdf-lib or server-side)
  // For now, return first PDF and notify user
  if (shouldShare) {
    await Sharing.shareAsync(pdfUris[0]);
  }

  return pdfUris[0];
};
```

---

### **PROPUESTA 3: Enhanced Notification Channel Management**

#### Objetivo:
Garantizar que todas las notificaciones se muestren en Android 8+.

```typescript
// src/services/NotificationChannelsEnhanced.ts

export interface NotificationChannelConfig {
  id: string;
  name: string;
  importance: AndroidImportance;
  description?: string;
  vibrationPattern: number[];
  lightColor: string;
  enableVibration: boolean;
  soundURI?: string;
}

const CHANNELS: Record<string, NotificationChannelConfig> = {
  DAILY_REMINDER: {
    id: 'daily_reminder',
    name: 'Recordatorio Diario',
    importance: AndroidImportance.HIGH,
    description: 'Notificación matutina para iniciar jornada',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF9800',
    enableVibration: true
  },
  GEOFENCE_EVENTS: {
    id: 'geofence_events',
    name: 'Eventos de Ubicación',
    importance: AndroidImportance.MAX,
    description: 'Auto check-in/checkout por GPS',
    vibrationPattern: [0, 100, 50, 100],
    lightColor: '#4CAF50',
    enableVibration: true
  },
  REPORTS: {
    id: 'reports',
    name: 'Reportes',
    importance: AndroidImportance.HIGH,
    description: 'Notificación de reporte disponible',
    vibrationPattern: [0, 200, 200],
    lightColor: '#2196F3',
    enableVibration: true
  },
  FAILSAFE_ALERTS: {
    id: 'failsafe_alerts',
    name: 'Alertas de Seguridad',
    importance: AndroidImportance.MAX,
    description: 'Auto cierre de jornada por inactividad',
    vibrationPattern: [0, 150, 100, 150, 100, 150],
    lightColor: '#F44336',
    enableVibration: true
  }
};

export const ensureAllChannels = async () => {
  if (Platform.OS !== 'android') return;

  for (const [_, config] of Object.entries(CHANNELS)) {
    try {
      await Notifications.setNotificationChannelAsync(config.id, {
        name: config.name,
        importance: config.importance,
        description: config.description,
        vibrationPattern: config.enableVibration ? config.vibrationPattern : undefined,
        lightColor: config.lightColor,
        bypassDnd: config.importance === AndroidImportance.MAX
      });
    } catch (error) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR',
        `Failed to create channel ${config.id}`, error);
    }
  }
};

// Usage helper
export const scheduleNotificationWithChannel = async (
  channelKey: keyof typeof CHANNELS,
  content: Notifications.NotificationContentInput
) => {
  if (Platform.OS === 'android') {
    await ensureAllChannels();  // Idempotent
  }

  return Notifications.scheduleNotificationAsync({
    content,
    trigger: null,
    ...(Platform.OS === 'android' && {
      channelId: CHANNELS[channelKey].id
    })
  });
};

// Update all notification calls:
// Before:
// Notifications.scheduleNotificationAsync({...})

// After:
// scheduleNotificationWithChannel('GEOFENCE_EVENTS', {...})
```

---

### **PROPUESTA 4: Intelligent Toast/Dialog Queue with Prioritization**

#### Objetivo:
Priorizar feedback importante (errors) sobre feedback menor (success).

```typescript
// src/context/LuxuryUIContextEnhanced.tsx

export type ToastPriority = 'high' | 'normal' | 'low';

export interface ToastItem {
  id: string;
  msg: string;
  type: ToastType;
  durationMs: number;
  priority: ToastPriority;  // ← NEW
}

// Enhanced queue management
const showToastEnhanced = useCallback((msg: string, type: ToastType = 'info', priority: ToastPriority = 'normal') => {
  const normalizedMsg = msg.trim();
  if (!normalizedMsg) return;

  const key = createToastKey(normalizedMsg, type);
  const now = dayjs().valueOf();

  // Dedupe checks...
  if (isDuplicate(key, now)) return;

  const item: ToastItem = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    msg: normalizedMsg,
    type,
    durationMs: DEFAULT_TOAST_DURATION_MS,
    priority
  };

  lastToastRef.current = { key, timestamp: now };

  if (!toast) {
    setToast(item);
    return;
  }

  // Insert in queue with priority sorting
  const queue = toastQueueRef.current;
  
  if (priority === 'high') {
    // Insert at front
    queue.unshift(item);
  } else if (priority === 'low' && queue.length >= MAX_TOAST_QUEUE_SIZE) {
    // Skip low priority if queue full
    return;
  } else {
    // Insert normally
    if (queue.length >= MAX_TOAST_QUEUE_SIZE) {
      queue.shift();  // Remove oldest low/normal priority
    }
    queue.push(item);
  }
}, [toast]);

// Usage:
showToastEnhanced('Auto check-in successful', 'success', 'normal');
showToastEnhanced('Permission denied', 'error', 'high');  // Shows immediately
showToastEnhanced('Config saved', 'info', 'low');  // Can be dropped if queue full
```

---

### **PROPUESTA 5: Report Delivery Guarantee**

#### Objetivo:
Asegurar que report se envíe aunque falle el sistema automático.

```typescript
// src/services/ReportDeliveryGuarantee.ts

const PENDING_REPORTS_KEY = 'PENDING_REPORTS_DELIVERY';

interface PendingReportRecord {
  weekId: string;
  pdfUri: string;
  createdAt: number;
  attemptCount: number;
  lastAttemptAt?: number;
}

export const checkAndDeliverPendingReports = async () => {
  try {
    const pending = await AsyncStorage.getItem(PENDING_REPORTS_KEY);
    if (!pending) return;

    const reports: PendingReportRecord[] = JSON.parse(pending);
    const now = dayjs().valueOf();
    const updated = [];

    for (const report of reports) {
      const age = now - report.createdAt;
      const hoursOld = age / (1000 * 60 * 60);

      // Retry if < 7 days old
      if (hoursOld < 7 * 24) {
        const shouldRetry = !report.lastAttemptAt || 
                           (now - report.lastAttemptAt) > 6 * 60 * 60 * 1000;  // 6h

        if (shouldRetry && report.attemptCount < 5) {
          const settings = await getSettings();
          if (settings) {
            await sendReportByEmail(report.pdfUri, settings);
            report.attemptCount++;
            report.lastAttemptAt = now;
            
            updated.push(report);
          }
        } else if (report.attemptCount < 5) {
          // Wait for retry window
          updated.push(report);
        }
        // else: exceeded 5 attempts, abandon
      }
      // else: > 7 days, abandon
    }

    if (updated.length > 0) {
      await AsyncStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(updated));
    } else {
      await AsyncStorage.removeItem(PENDING_REPORTS_KEY);
    }
  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Pending reports check failed', error);
  }
};

// Call from:
// 1. BackgroundTasks (every run)
// 2. AppState.addEventListener('active')
// 3. After successful email send (remove from pending)

export const trackPendingReport = async (weekId: string, pdfUri: string) => {
  try {
    const pending = await AsyncStorage.getItem(PENDING_REPORTS_KEY);
    const reports: PendingReportRecord[] = pending ? JSON.parse(pending) : [];

    // Check if already tracked
    const exists = reports.some(r => r.weekId === weekId);
    if (!exists) {
      reports.push({
        weekId,
        pdfUri,
        createdAt: dayjs().valueOf(),
        attemptCount: 0
      });

      await AsyncStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(reports));
    }
  } catch (error) {
    log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Failed to track pending report', error);
  }
};
```

---

### **PROPUESTA 6: Feedback Analytics & Monitoring**

#### Objetivo:
Entender qué feedback es más importante y frecuente.

```typescript
// src/feedback/feedbackAnalytics.ts

export interface FeedbackEvent {
  timestamp: number;
  kind: 'toast' | 'dialog';
  tone: 'success' | 'error' | 'info';
  category: LogCategory;
  severity: LogSeverity;
  message: string;
  wasThrottled: boolean;
  wasDeduped: boolean;
  displayDurationMs?: number;  // How long it was visible
}

const feedbackEvents: FeedbackEvent[] = [];

export const recordFeedbackEvent = (event: FeedbackEvent) => {
  feedbackEvents.push(event);

  // Keep only last 1000 events in memory
  if (feedbackEvents.length > 1000) {
    feedbackEvents.shift();
  }

  // Periodically sync to DB for analysis
  if (feedbackEvents.length % 50 === 0) {
    syncFeedbackEventsToDB();
  }
};

export const getFeedbackStats = () => {
  const stats = {
    totalFeedback: feedbackEvents.length,
    byKind: { toast: 0, dialog: 0 },
    byTone: { success: 0, error: 0, info: 0 },
    byCategory: {} as Record<LogCategory, number>,
    throttledCount: 0,
    dedupedCount: 0,
  };

  for (const event of feedbackEvents) {
    stats.byKind[event.kind]++;
    stats.byTone[event.tone]++;
    stats.byCategory[event.category] = (stats.byCategory[event.category] || 0) + 1;
    if (event.wasThrottled) stats.throttledCount++;
    if (event.wasDeduped) stats.dedupedCount++;
  }

  return stats;
};

// Usage:
const stats = getFeedbackStats();
log('AZUL', 'ESTADO_SISTEMA', 'DEBUG', 
  `Feedback stats: ${JSON.stringify(stats)}`);
```

---

### **TABLA RESUMEN: PROPUESTAS DE OPTIMIZACIÓN**

| # | Propuesta | Impacto | Effort | Urgencia | Beneficio |
|---|---|---|---|---|---|
| 1 | Permission management feedback | 🟡 Mayor | ⭐⭐ | 🟡 Media | Usuarios saben por qué fallan notifs |
| 2 | Report pagination | 🔴 Crítico | ⭐⭐⭐ | 🔴 Alta | Evita crashes en reportes grandes |
| 3 | Channel management | 🔴 Crítico | ⭐⭐ | 🔴 Alta | Notificaciones funcionan en Android 8+ |
| 4 | Toast prioritization | 🟢 Menor | ⭐⭐ | 🟢 Baja | UX mejorada (errors primero) |
| 5 | Report delivery guarantee | 🔴 Crítico | ⭐⭐⭐ | 🔴 Alta | No se pierden reportes |
| 6 | Feedback analytics | 🟢 Menor | ⭐⭐ | 🟢 Baja | Insights sobre UX |

---

## 📎 ANEXOS

### **ANEXO A: Notification Types & Actions Reference**

```typescript
// All notification types in system

type NotificationAction = 
  | 'OPEN_DAILY_SETUP'        // Daily morning reminder
  | 'GENERATE_REPORT_PROMPT'  // Weekly report ready
  | 'CHECKOUT_DECISION';      // Left work area

interface NotificationSpec {
  id: string;
  title: string;
  body: string;
  icon?: string;
  color?: string;
  sound: boolean;
  priority: AndroidImportance;
  channelId: string;
  action: NotificationAction;
  data?: Record<string, any>;
}

export const NOTIFICATION_SPECS: Record<string, NotificationSpec> = {
  DAILY_REMINDER: {
    id: 'daily_reminder',
    title: '¡Buenos días! ☀️',
    body: 'Es hora de iniciar tu jornada en WTracker.',
    sound: true,
    priority: AndroidImportance.HIGH,
    channelId: 'daily_reminder',
    action: 'OPEN_DAILY_SETUP'
  },
  AUTO_CHECKIN: {
    id: 'auto_checkin',
    title: '📍 Llegaste al sitio',
    body: 'Auto Check-in (GPS) validado. ¡Buen trabajo!',
    color: '#4CAF50',
    sound: true,
    priority: AndroidImportance.MAX,
    channelId: 'geofence_events',
    action: 'GENERATE_REPORT_PROMPT'
  },
  AUTO_CHECKOUT_ALERT: {
    id: 'auto_checkout_alert',
    title: '⚠️ Saliste del área',
    body: 'Se detectó tu salida.',
    color: '#F44336',
    sound: true,
    priority: AndroidImportance.MAX,
    channelId: 'failsafe_alerts',
    action: 'CHECKOUT_DECISION'
  },
  AUTO_CHECKOUT_FINALIZADO: {
    id: 'auto_checkout_final',
    title: 'Jornada Finalizada 🏁',
    body: 'Tu sesión se cerró automáticamente por inactividad.',
    color: '#FF9800',
    sound: true,
    priority: AndroidImportance.HIGH,
    channelId: 'failsafe_alerts',
    action: 'OPEN_DAILY_SETUP'
  },
  REPORT_READY: {
    id: 'report_ready',
    title: '📄 Reporte Semanal Listo',
    body: 'T envómina.',
    color: '#2196F3',
    sound: true,
    priority: AndroidImportance.HIGH,
    channelId: 'reports',
    action: 'GENERATE_REPORT_PROMPT'
  }
};
```

---

### **ANEXO B: Toast/Dialog Configuration Guidelines**

```typescript
// GUIDELINES FOR SHOWING FEEDBACK

// 1. TOAST (non-blocking)
// Use for: Confirmations, minor alerts, info
// Duration: 2-4 seconds
showToast('Auto check-in exitoso', 'success');  // 2.6s
showToast('Configuración guardada', 'info');     // 3.0s
showToast('Advertencia: GPS débil', 'info');     // 3.2s

// 2. DIALOG (blocking)
// Use for: Errors, confirmations needed, important decisions
// User must tap button to dismiss
showDialog({
  title: 'Error crítico',
  message: 'No pudimos guardar la jornada.',
  confirmText: 'Reintentar',
  onConfirm: () => retryOperation()
});

// 3. PRIORITY RULES
showToastEnhanced('Permission denied', 'error', 'high');     // Skip queue, show now
showToastEnhanced('Hour added', 'success', 'normal');        // Normal queue
showToastEnhanced('Config updated', 'info', 'low');          // Can be dropped

// 4. THROTTLE WINDOWS
// Same toast/dialog won't show again if:
// - Toast: within 1.8 seconds
// - Dialog: within 1.0 seconds
// - Cleanup: entries > 60 seconds old removed
```

---

### **ANEXO C: Report Generation Checklist**

```
PRE-GENERATION CHECKS:
☐ Settings exist (employee_name, rate, etc.)
☐ Work in AsyncStorage
☐ Log success to audit_logs
☐ Show toast confirmation
☐ Handle share/email response
☐ Clean up temporary files

ERROR HANDLING:
☐ No settings → show error dialog
☐ No sessions → generate empty report
☐ Query timeout → use fallback data
☐ Print failure → retry or fallback
☐ Share failure → suggest manual send
```

---

### **ANEXO D: Testing Strategy for Notifications**

```typescript
// DEVELOPMENT TESTING

// 1. Manual trigger for background task
BackgroundTasks.triggerForTesting();  // Requires __DEV__

// 2. Schedule test notification immediately
await Notifications.scheduleNotificationAsync({
  content: {
    title: 'TEST: Daily Reminder',
    body: 'This is a test notification.',
    data: { action: 'OPEN_DAILY_SETUP' }
  },
  trigger: null  // Immediate
});

// 3. Clear all notifications
await Notifications.cancelAllScheduledNotificationsAsync();

// 4. Simulate report window
// Modify isReportWindow in BackgroundTasks.ts:
const isReportWindow = true;  // Force for testing

// 5. Test permission flows
// Settings → App Permissions → Toggle Location/Notifications OFF
// Restart app → should show permission dialogs

// 6. Test large report generation
// Create 100+ work sessions
// Click "Generate Report" → measure time + memory

// 7. Test notification actions
// Tap notification from system tray
// Should route to correct screen
```

---

### **ANEXO E: Productionupe working
☐ Error messages humanized
☐ No sensitive data in feedback
☐ Throttle preventing spam
☐ Memory leaks tested
☐ Animation performance OK

BACKGROUND TASKS PRE-DEPLOY:
☐ OS permissions configured (manifest)
☐ Task interval appropriate (15+ min)
☐ Mutex protection working
☐ Failsafe logic tested
☐ Report window timing verified
☐ Edge cases handled (midnight crossing)
☐ DB transaction locks OK
☐ Error recovery paths tested
```

---

### **ANEXO F: Performance Benchmarks**

```
TARGET METRICS:

Notification Setup:
├─ setupNotifications(): < 500ms
├─ scheduleDailyReminder(): < 300ms
└─ ensureAndroidDefaultChannel(): < 200ms

Report Generation:
├─ 10 sessions: < 500ms
├─ 30 sessions: < 1.5s
├─ 60 sessions: < 3.0s
└─ 100+ sessions: < 5.0s (with pagination)

Feedback UI:
├─ Toast appear: < 100ms
├─ Dialog appear: < 200ms
├─ Toast animation: 300ms
├─ Dialog animation: 400ms
└─ Queue processing: < 50ms per toast

Background Task:
├─ Failsafe check: < 500ms
├─ Report generation: < 4s
├─ Total task time: < 5s
└─ Notification scheduling: < 300ms

Memory:
├─ Toast queue (max 3): < 5MB
├─ Dialog queue (max 3): < 5MB
├─ Report HTML (30 sessions): < 2MB
├─ PDF file (30 sessions): < 5MB
└─ Total session memory: < 50MB
```

---

## 📝 CONCLUSIONES

El sistema de **Notificaciones y Reportes** de LEDTracker es **robusto y bien diseñado** con:

✅ **Deduplicación Inteligente:** Evita spam de notificaciones  
✅ **Queue Management:** Controla flujo de feedback  
✅ **Log Bridge Automático:** Convierte errores en UI feedback  
✅ **Background Generation:** Reportes automáticos sin intervención  
✅ **Fallback Graceful:** Email → Share si no disponible

### Áreas Críticas de Mejora:

🔴 **Prioridad Alta:**
- Canales de notificación Android (propuesta garantía de entrega de notificaciones y reportes.

---

**Documento generado:** 1 de Julio, 2026  
**Analista:** Asistente de GitHub Copilot  
**Repositorio:** BDevDPaz/LEDTracker  
**Licencia:** Propietario - Byron Efrain De Paz Garcia
