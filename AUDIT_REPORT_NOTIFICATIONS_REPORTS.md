# INFORME TÉCNICO: AUDITORÍA DE NOTIFICACIONES Y REPORTES - WTRACKER

## 1. INVENTARIO Y AUDITORÍA DEL SISTEMA DE NOTIFICACIONES

### 1.1. Notificaciones Programadas
*   **Recordatorio Diario (Morning):**
    *   **Hora:** Configurable (Default: 06:30 AM).
    *   **Archivo:** `src/services/Notifications.ts` (`scheduleDailyReminder`).
    *   **Lógica:** Se reprograma al iniciar la app o actualizar ajustes. Cancela todas las previas antes de agendar la nueva.
    *   **Acción:** `OPEN_DAILY_SETUP`.

### 1.2. Notificaciones por Eventos (Triggers)
| Evento | Trigger | Canal (Android) | Acción |
| :--- | :--- | :--- | :--- |
| **Auto Check-in** | `LocationFSM` -> `ENTERED` | `geofence_events` | `GENERATE_REPORT_PROMPT` |
| **Salida Geocerca** | `LocationFSM` -> `EXITED` | `failsafe_alerts` | `CHECKOUT_DECISION` |
| **Failsafe Checkout**| `runFailsafeCheck` (45 min) | `failsafe_alerts` | `OPEN_DAILY_SETUP` |
| **Reporte Listo** | `BackgroundTasks` (Semanal) | `reports` | `GENERATE_REPORT_PROMPT` |

### 1.3. Canales de Notificación (Android)
Se implementan 4 canales con prioridades diferenciadas:
1.  **Recordatorio Diario:** Importancia ALTA.
2.  **Eventos de Ubicación:** Importancia MÁXIMA (Bypass DND).
3.  **Reportes:** Importancia ALTA.
4.  **Alertas de Seguridad (Failsafe):** Importancia MÁXIMA.

### 1.4. Manejo de Respuestas (Handlers)
*   **Global:** `app/_layout.tsx` centraliza `handleNotificationAction`.
*   **Modales:** `CHECKOUT_DECISION` y `OPEN_DAILY_SETUP` disparan navegación a Inicio con parámetros que abren modales reactivamente.

---

## 2. INVENTARIO Y AUDITORÍA DEL SISTEMA DE REPORTES

### 2.1. Generación de PDF
*   **Motor:** `expo-print` transformando plantillas HTML/CSS.
*   **Contenido:**
    *   Encabezado corporativo (WTracker).
    *   Resumen de nómina (Horas totales, OT, Pago estimado).
    *   Tabla de actividades detallada (con badges de GPS y Edición Manual).
    *   **Auditoría Crítica:** Sección dedicada a logs de GPS para transparencia ante el empleador.
*   **Integridad:** Generación de un `integrityHash` (ID de reporte) para evitar alteraciones.

### 2.2. Automatización Semanal
*   **Ventana de Tiempo:** Domingo > 20:00, Lunes o Martes.
*   **Mecanismo:**
    *   **Background:** `APP_BACKGROUND_SERVICES` verifica si el `weekId` actual ya fue reportado.
    *   **Foreground:** `ensureWeeklyReportExists` (en `app/_layout.tsx`) actúa como fallback al abrir la app.
*   **Persistencia:** `LAST_REPORT_WEEK_ID` en AsyncStorage evita duplicidad.

### 2.3. Sistema de Entrega Garantizada (Email)
*   **Cola de Pendientes:** `PENDING_REPORTS_KEY` en AsyncStorage.
*   **Reintentos:** Hasta 5 intentos con intervalo de 6 horas.
*   **Fallback:** Si `MailComposer` no está disponible, se utiliza el diálogo nativo de `Sharing`.

---

## 3. DIAGRAMAS DE FLUJO

### 3.1. Ciclo de Notificaciones Diarias
1.  **06:30 AM:** Notificación Programada -> Usuario toca -> Abre `DailySetupModal`.
2.  **Entrada a Sitio:** Geocerca dispara -> Notificación "Llegaste" -> Auto Check-in.
3.  **Salida de Sitio:** Geocerca dispara -> Notificación "Saliste" (Checkout Decision).
4.  **45 min Inactividad:** Background Task -> Failsafe Checkout -> Notificación "Jornada Finalizada".

### 3.2. Generación y Envío de Reportes
1.  **Detección:** Background Task detecta ventana semanal (Domingo noche).
2.  **Creación:** `generateWeeklyReport` crea PDF -> Almacena URI.
3.  **Registro:** `trackPendingReport` añade a la cola de reintentos.
4.  **Notificación:** Usuario recibe alerta "Reporte Listo".
5.  **Envío:** Usuario abre app -> Pantalla de Reporte -> `sendReportByEmail`.
6.  **Limpieza:** Éxito en envío -> Elimina de cola de pendientes.

---

## 4. MATRIZ DE RESPONSABILIDADES

| Módulo | Responsabilidad | Capa |
| :--- | :--- | :--- |
| `Notifications.ts` | Configuración de canales, specs y agenda. | Servicios / Infra |
| `ReportGenerator.ts` | Lógica de HTML, PDF y cola de reintentos. | Negocio / Adaptador |
| `BackgroundTasks.ts`| Orquestación de fondo (Failsafe + Ventana Semanal). | Orquestador |
| `workTrackerEffects.ts`| Reacción a eventos del sistema (Sync, Stop). | Motor (Engine) |
| `app/_layout.tsx` | Routing de notificaciones y triggers de fallback. | UI / Routing |
| `report.tsx` | Interfaz de usuario para acciones manuales. | UI / View |

---

## 5. CASOS EXTREMOS Y MITIGACIONES

| Escenario Crítico | Impacto | Mitigación Implementada / Propuesta |
| :--- | :--- | :--- |
| **Permisos Denegados** | Silencio total del sistema. | `requestAndConfigureNotifications` verifica estado y loguea advertencias. **Propuesta:** Modal persistente de "Permisos Requeridos" en Inicio. |
| **Background Task Kill** | Fallo en Failsafe y Reporte Semanal. | Fallback en `AppState` (Foreground) que ejecuta las mismas verificaciones al abrir la app. |
| **Error en PDF** | El usuario no puede cobrar. | Try-catch con logging ROJO. **Propuesta:** Botón de "Regenerar" en historial. |
| **Email Bloqueado** | No llega la nómina. | Sistema de reintentos (5 veces) y Fallback automático a `Sharing.shareAsync`. |
| **Notif. Duplicadas** | Ruido excesivo/Molestia. | `cancelAllScheduledNotificationsAsync` antes de cada reprogramación diaria. |

---

## 6. PROPUESTAS DE OPTIMIZACIÓN

1.  **Manejo de Colas:** Migrar `PENDING_REPORTS_KEY` a una tabla SQLite dedicada (`report_queue`) para mayor atomicidad y evitar pérdida por corrupción de JSON en AsyncStorage.
2.  **Integridad de PDF:** Implementar una marca de agua dinámica o QR con el hash de integridad para verificación offline.
3.  **Auditoría:** Expandir los logs de auditoría para incluir el estado de la batería y la precisión del GPS en el momento de la notificación.
4.  **UX de Notificaciones:** Implementar notificaciones "Sticky" (ongoing) mientras hay una sesión activa para evitar que el sistema las mate en segundo plano.

---

## 7. ANEXO: HALLAZGOS CRÍTICOS

*   **Riesgo:** El intervalo de 15 min de Background Task es el mínimo teórico en iOS/Android, pero puede ser mayor según la optimización de batería del dispositivo. El sistema de fallback en Foreground es vital.
*   **Estilo:** Se mantiene el estándar de colores (VERDE/ROJO/AZUL) en logs para facilitar el debugging remoto.
*   **Seguridad:** Los URIs de los reportes se manejan internamente y no se exponen a galerías públicas hasta que el usuario decide compartir expresamente.


---

## 8. MAPEO DE DEPENDENCIAS Y FUNCIONES CLAVE

### 8.1. Funciones Principales
| Función | Módulo | Entrada | Salida | Efecto Secundario |
| :--- | :--- | :--- | :--- | :--- |
| `scheduleDailyReminder` | `Notifications` | `timeString` | `Promise<void>` | Cancela notif. previas y agenda nueva diaria. |
| `generateWeeklyReport` | `ReportGenerator` | `isPreview` | `Promise<string>` | Consulta SQLite, genera PDF vía `expo-print`. |
| `runFailsafeCheck` | `BackgroundTasks` | N/A | `Promise<boolean>` | Cierra sesiones activas si exceden umbral fuera de sitio. |
| `checkAndDeliverPendingReports` | `ReportGenerator` | N/A | `Promise<void>` | Itera cola en AsyncStorage e intenta envío email. |
| `handleNotificationAction` | `app/_layout` | `data` | `void` | Navega y dispara parámetros de apertura de modales. |

### 8.2. Grafo de Dependencias (Crítico)
*   **ReportGenerator** depends on: `expo-print`, `expo-mail-composer`, `expo-sharing`, `SQLite (db.ts)`, `dayjs`, `AsyncStorage`.
*   **Notifications** depends on: `expo-notifications`, `db.ts`, `logger.ts`.
*   **BackgroundTasks** depends on: `expo-task-manager`, `expo-background-task`, `Notifications`, `ReportGenerator`, `db.ts`, `AsyncLock`.
*   **LocationManager** depends on: `LocationFSM`, `Notifications`, `db.ts`, `AsyncStorage`.

### 8.3. Acoplamientos y Puntos Frágiles
*   **Acoplamiento Crítico:** `BackgroundTasks` y `ReportGenerator` comparten el acceso a la cola de reportes. Un error en el parseo de JSON en AsyncStorage bloquea ambos.
*   **Punto Frágil:** La dependencia de `expo-print` requiere que el motor de renderizado web esté disponible; en dispositivos con recursos extremos o versiones de Android "Go", esto puede fallar.

---

## 9. ANÁLISIS PROFUNDO DE CASOS EXTREMOS Y RIESGOS (R-00X)

### 9.1. Geofence Hysteresis y Ruido de Señal (R-001)
*   **Riesgo:** El GPS puede "saltar" dentro y fuera del área rápidamente.
*   **Mitigación:** `LocationFSM` requiere 3 muestras consecutivas para confirmar el cambio de estado.
*   **Acción de Mejora:** Ajustar dinámicamente el `MIN_ACCURACY_METERS` basado en la velocidad detectada.

### 9.2. Carrera de Estados en Fondo (R-002)
*   **Riesgo:** Una tarea de fondo intenta cerrar una sesión mientras el usuario la está editando en primer plano.
*   **Mitigación:** Uso de `AsyncLock` en `BackgroundTasks.ts` para serializar el acceso a la DB.
*   **Acción de Mejora:** Implementar un flag `locked_by_ui` en la tabla `work_sessions`.

### 9.3. Persistencia Volátil de AsyncStorage (R-003)
*   **Riesgo:** Los datos en AsyncStorage pueden ser borrados por el SO en condiciones de poco espacio en disco.
*   **Mitigación:** Mapeo de fallbacks en `app/_layout.tsx` que reconstruyen estados críticos desde SQLite.
*   **Acción de Mejora:** Migrar el tracking de reportes pendientes a SQLite (ver Propuesta 1).

### 9.4. Desbordamiento de Logs (R-004)
*   **Riesgo:** La tabla `system_logs` puede crecer indefinidamente, degradando el rendimiento de las consultas de reportes.
*   **Mitigación:** El sistema actual no tiene limpieza automática.
*   **Acción de Mejora:** Implementar una tarea de "Purge" semanal que mantenga solo los últimos 30 días de logs.

### 9.5. Cambio de Zona Horaria (R-005)
*   **Riesgo:** Notificaciones diarias disparadas a horas incorrectas tras un viaje.
*   **Mitigación:** Uso de `dayjs` centralizado.
*   **Acción de Mejora:** Escuchar el evento `TIMEZONE_CHANGED` del SO para reprogramar notificaciones inmediatamente.

---

## 10. PROPUESTAS DE OPTIMIZACIÓN Y RECOMENDACIONES (P-00X)

### 10.1. Centralización de Triggers (P-001)
*   **Problema:** Los triggers de notificaciones están dispersos entre `LocationManager`, `BackgroundTasks` y `ReportGenerator`.
*   **Propuesta:** Crear un `NotificationDispatcher` que reciba eventos semánticos (e.g., `ON_WEEKLY_REPORT_READY`) y resuelva el canal y spec apropiado, centralizando la lógica de "Throttle" (evitar notificaciones repetidas).

### 10.2. Optimización de Renderizado PDF (P-002)
*   **Problema:** La plantilla HTML es un string largo embebido en el código.
*   **Propuesta:** Mover las plantillas a archivos `.html` en `assets/` y usar un motor de interpolación simple para mejorar la mantenibilidad del diseño sin tocar la lógica de negocio.

### 10.3. Monitoreo de Salud de Background Tasks (P-003)
*   **Problema:** No hay visibilidad de cuántas veces falló la tarea de fondo en producción.
*   **Propuesta:** Registrar el tiempo de ejecución y el resultado de cada ciclo de `APP_BACKGROUND_SERVICES` en la tabla `audit_logs` con una categoría específica `SYSTEM_HEALTH`.

### 10.4. Mejora en la Experiencia de Configuración (P-004)
*   **Problema:** Si el usuario no abre la app, no se entera si los permisos de notificaciones fueron revocados.
*   **Propuesta:** Implementar un "Foreground Service" (Android) o "Live Activities" (iOS) opcional para mostrar el estado del seguimiento GPS en tiempo real en la barra de notificaciones, lo que garantiza que el sistema no mate el proceso.
