La idea central de Fase D es esta:

```text
La app debe recuperar y corregir su estado operacional cada vez que:
- inicia,
- vuelve a foreground,
- se refresca el dashboard,
- corre background task,
- detecta salida o entrada tardía de geocerca.
```

Expo BackgroundTask debe tratarse como trabajo diferible, porque la documentación indica que el sistema decide cuándo ejecutarlo y que no corre necesariamente de inmediato; en Android usa WorkManager y en iOS BGTaskScheduler. [1](https://docs.expo.dev/versions/latest/sdk/background-task/)  
Expo Location permite leer ubicación actual, hacer polling o suscribirse a eventos de ubicación, y también tiene configuración de background location y foreground service en Android mediante config plugin. [2](https://docs.expo.dev/versions/latest/sdk/location/)  
React Native AppState permite detectar si la app está en foreground o background y escuchar cambios de estado, lo cual encaja con la reconciliación al volver a foreground. [3](https://reactnative.dev/docs/appstate)

---

# Fase D: Runtime Resilience

## Objetivo oficial

```text
Implementar una capa runtime que reconcilie sesiones pending_arrival y active
contra ubicación actual, monitoreo, storage, timestamps de salida y estado de app,
para que Auto Check-in y Auto Check-out sean más predecibles en campo real.
```

## Alcance incluido

```text
✅ runtimeSupervisor
✅ reconcileRuntimeState
✅ foreground reconciliation
✅ APP_INIT reconciliation
✅ dashboard refresh reconciliation
✅ pending_arrival → AUTO_CHECKIN_GPS si ya está dentro del perímetro
✅ active → detectar salida, guardar EXIT_TIMESTAMP_KEY y notificar
✅ background failsafe usando timestamp real de salida
✅ auditoría runtime estructurada
✅ tests de flujos críticos
✅ npm run gm verde
```

## Fuera de alcance para Fase D

No meter todavía:

```text
❌ lunch reminder completo
❌ overtime flow completo
❌ Sentry/PostHog
❌ migraciones grandes de DB
❌ location evidence persistente completo
❌ rediseño grande de notificaciones laborales
```

Eso queda mejor para fases posteriores.

---

# 0. Preparación Git

Desde `main` limpio:

```bash
git checkout main
git pull origin main
git status
npm run gm
```

Crear rama:

```bash
git checkout -b feature/runtime-resilience-phase-d
```

---

# 1. Crear contrato de Fase D ✅️ TAREA FINALIZADA Y APROBADA ✅️

Antes de tocar lógica, crea una nota interna o checklist, por ejemplo:

```text
docs/phase-d-runtime-resilience.md
```

Contenido sugerido:

```md
# Phase D: Runtime Resilience

## Goals

- Reconcile pending_arrival sessions on APP_INIT, foreground and dashboard refresh.
- Reconcile active sessions after geofence exit.
- Store real geofence exit timestamp.
- Use EXIT_TIMESTAMP_KEY for failsafe auto checkout.
- Add structured runtime audit logs.
- Keep Gold Master green.

## Non-goals

- Lunch reminder engine.
- Overtime flow.
- External observability.
- Large DB migrations.
```

Commit opcional:

```bash
git add docs/phase-d-runtime-resilience.md
git commit -m "Document Phase D runtime resilience scope"
```

---

# 2. Crear `runtimeSupervisor` ✅️ TAREA FINALIZADA Y APROBADA ✅️

Archivo sugerido:

```text
src/runtime/runtimeSupervisor.ts
```

Responsabilidad: coordinar, no meter toda la lógica ahí.

Debe exponer funciones como:

```ts
export type RuntimeReconcileSource =
  | 'APP_INIT'
  | 'FOREGROUND'
  | 'DASHBOARD_REFRESH'
  | 'BACKGROUND_TASK';

export async function reconcileRuntimeState(source: RuntimeReconcileSource) {
  // load current session
  // check pending_arrival
  // check active session
  // verify monitoring
  // log result
}

export async function onAppStart() {
  return reconcileRuntimeState('APP_INIT');
}

export async function onAppForeground() {
  return reconcileRuntimeState('FOREGROUND');
}

export async function onDashboardRefresh() {
  return reconcileRuntimeState('DASHBOARD_REFRESH');
}

export async function onBackgroundMaintenance() {
  return reconcileRuntimeState('BACKGROUND_TASK');
}
```

## Regla importante

No mover `TaskManager.defineTask` dentro del supervisor. Expo TaskManager documenta que `defineTask` debe llamarse en el scope global del bundle, no dentro de lifecycle methods de React. [4](https://docs.expo.dev/versions/latest/sdk/task-manager/)

---

# 3. Agregar eventos de logger para Runtime Resilience ✅️ TAREA FINALIZADA Y APROBADA ✅️

En `src/utils/logger.ts`, agrega eventos o categorías claras.

Eventos mínimos:

```text
RUNTIME_RECONCILE_STARTED
RUNTIME_RECONCILE_COMPLETED
RUNTIME_RECONCILE_SKIPPED
RUNTIME_RECONCILE_FAILED
PENDING_ARRIVAL_RECONCILED_TO_ACTIVE
ACTIVE_SESSION_EXIT_RECONCILED
MONITORING_RESTARTED
MONITORING_ALREADY_ACTIVE
EXIT_TIMESTAMP_STORED
EXIT_TIMESTAMP_ALREADY_PRESENT
GPS_SAMPLE_ACCEPTED_FOR_RECONCILIATION
GPS_SAMPLE_REJECTED_WEAK_ACCURACY
```

Metadata mínima:

```ts
{
  source,
  sessionId,
  sessionStatus,
  accuracy,
  distanceToTarget,
  thresholdMeters,
  decision,
}
```

Primer commit funcional sugerido:

```bash
git add src/runtime/runtimeSupervisor.ts src/utils/logger.ts
git commit -m "Add runtime supervisor and reconciliation audit events"
npm run gm
```

---

# 4. Reconciliar `pending_arrival` ✅️ TAREA FINALIZADA Y APROBADA ✅️

Este es el punto más importante de Fase D, porque ataca el problema real que viste:

```text
Llegaste al destino, pero la app tardó en confirmar Auto Check-in
hasta reload/refresh.
```

## Regla nueva

Cuando ocurra:

```text
APP_INIT
FOREGROUND
DASHBOARD_REFRESH
BACKGROUND_TASK
```

Si hay sesión:

```text
status = pending_arrival
```

Entonces:

```text
1. Obtener ubicación actual.
2. Validar accuracy <= 50m.
3. Calcular distancia al destino.
4. Validar radio + hysteresis.
5. Si cumple:
   - registrar AUTO_CHECKIN_GPS
   - cambiar sesión a active
   - sincronizar active session
   - registrar evento PENDING_ARRIVAL_RECONCILED_TO_ACTIVE
6. Si no cumple:
   - registrar por qué no hizo check-in
```

Pseudoflujo:

```ts
async function reconcilePendingArrival(source: RuntimeReconcileSource) {
  const session = await getPendingArrivalSession();

  if (!session) {
    logRuntimeSkipped('NO_PENDING_ARRIVAL', { source });
    return;
  }

  const location = await getCurrentLocationForReconciliation();

  if (!location) {
    logRuntimeSkipped('NO_LOCATION_AVAILABLE', { source, sessionId: session.id });
    return;
  }

  if (location.accuracy > ACCEPTED_ACCURACY_M) {
    logGpsRejectedWeakAccuracy({
      source,
      sessionId: session.id,
      accuracy: location.accuracy,
      thresholdMeters: ACCEPTED_ACCURACY_M,
    });
    return;
  }

  const distance = calculateDistanceToTarget(location, session.destination);

  if (!isInsideArrivalRadius(distance)) {
    logRuntimeSkipped('OUTSIDE_TARGET_RADIUS', {
      source,
      sessionId: session.id,
      distanceToTarget: distance,
    });
    return;
  }

  await registerAutoCheckinGps(session.id, {
    source,
    location,
    distanceToTarget: distance,
  });

  logPendingArrivalReconciledToActive({
    source,
    sessionId: session.id,
    accuracy: location.accuracy,
    distanceToTarget: distance,
  });
}
```

## Archivos probables a tocar

```text
src/runtime/runtimeSupervisor.ts
src/services/LocationFSM.ts
src/services/LocationManager.ts
src/engine/effects/workTrackerEffects.ts
src/runtime/sessionStoreAdapter.ts
src/database/db.ts
src/utils/geoUtils.ts
src/utils/logger.ts
```

Commit sugerido:

```bash
git add .
git commit -m "Reconcile pending arrival sessions from foreground location"
npm run gm
```

---

# 5. Conectar `APP_INIT` con `runtimeSupervisor` TAREA FINALIZADA Y APROBADA ✅️

Actualmente tus logs muestran:

```text
Engine Dispatch: APP_INIT
GPS Warm-up completed
Monitoreando 1 sitios...
DATA_LOADED
```

Ahora `APP_INIT` debe hacer algo más formal:

```text
APP_INIT
→ cargar datos
→ asegurar monitoreo
→ reconcileRuntimeState('APP_INIT')
→ DATA_LOADED
```

## Dónde conectarlo

Probablemente en:

```text
src/engine/effects/workTrackerEffects.ts
```

o donde actualmente se maneja:

```text
APP_INIT
```

La meta no es duplicar lógica, sino que APP_INIT llame una sola función:

```ts
await reconcileRuntimeState('APP_INIT');
```

Commit:

```bash
git add .
git commit -m "Run runtime reconciliation during app init"
npm run gm
```

---

# 6. Conectar foreground con `AppState` TAREA FINALIZADA Y APROBADA ✅️

Crear o ajustar un hook:

```text
src/runtime/useRuntimeSupervisor.ts
```

o integrarlo donde ya tienes inicialización de app, posiblemente:

```text
app/_layout.tsx
```

Regla:

```text
Cuando AppState cambia de background/inactive a active:
  reconcileRuntimeState('FOREGROUND')
```

React Native AppState documenta el estado `active` para foreground, `background` para segundo plano y el evento `change` para escuchar cambios de estado. [3](https://reactnative.dev/docs/appstate)

Pseudoflujo:

```ts
useEffect(() => {
  let previousState = AppState.currentState;

  const subscription = AppState.addEventListener('change', async nextState => {
    const returningToForeground =
      previousState.match(/inactive|background/) && nextState === 'active';

    previousState = nextState;

    if (returningToForeground) {
      await reconcileRuntimeState('FOREGROUND');
    }
  });

  return () => subscription.remove();
}, []);
```

Commit:

```bash
git add .
git commit -m "Reconcile runtime state when app returns to foreground"
npm run gm
```
Estado de Fase D - Tarea 6.1
estado de la tarea extra: TAREA FINALIZADA Y APROBADA ✅️
Fase D - Tarea 6.1
SQLite Runtime Concurrency Protection
Estado: VALIDADA EN RUNTIME
✅ dbWorkQueue global funcionando
✅ ui-load-stats protegido
✅ app-init protegido
✅ foreground reconciliation estable
✅ no NativeDatabase.prepareAsync error
✅ geofence/check-in estable
✅ checkout manual estable
✅ PDF estable

---

# 7. Conectar pull-to-refresh del Dashboard TAREA FINALIZADA Y APROBADA ✅️

Cuando el usuario haga refresh manual, debe pasar esto:

```text
pull-to-refresh
→ reload dashboard data
→ reconcileRuntimeState('DASHBOARD_REFRESH')
→ reload dashboard data otra vez si hubo cambios
```

Esto ataca exactamente el hallazgo de campo:

```text
jalé hacia abajo la pantalla del dashboard para que se refrescara
```

## Archivo probable

```text
app/(tabs)/index.tsx
```

o donde esté tu Dashboard.

Pseudoflujo:

```ts
const onRefresh = async () => {
  setRefreshing(true);

  try {
    await reconcileRuntimeState('DASHBOARD_REFRESH');
    await reloadDashboardData();
  } finally {
    setRefreshing(false);
  }
};
```

Commit:

```bash
git add .
git commit -m "Run runtime reconciliation from dashboard refresh"
npm run gm
```

---

# 8. Reconciliar salida de geocerca para sesión `active` ✅️ TAREA FINALIZADA Y APROBADA ✅️

Este es el segundo hallazgo de campo real:

```text
Me retiré del sitio y pasó mucho tiempo, pero la app no notificó ni reaccionó.
```

## Regla nueva

Cuando sesión está:

```text
status = active
```

y se detecta salida:

```text
GEOFENCE_EXIT_DETECTED
```

la app debe:

```text
1. Guardar EXIT_TIMESTAMP_KEY con timestamp real de salida.
2. Registrar evento EXIT_TIMESTAMP_STORED.
3. Notificar al usuario.
4. Mantener sesión active mientras espera decisión.
5. Si el usuario hace checkout manual, usar MANUAL_CHECKOUT.
6. Si no responde y el failsafe aplica, cerrar con AUTO_CHECKOUT_FAILSAFE usando exit timestamp real.
```

## Evento esperado en logs

```text
LOG [..] 🟠 [EVENTO_GEOCERCA] Geocerca: SALIDA validada para sesión #2
LOG [..] ⚪️ [ESTADO_SISTEMA] EXIT_TIMESTAMP_STORED
LOG [..] 🟢 [OPERACION_EXITOSA] Notificación de salida programada/enviada
```

## Archivos probables

```text
src/services/LocationFSM.ts
src/services/BackgroundTasks.ts
src/services/Notifications.ts
src/runtime/sessionStoreAdapter.ts
src/engine/effects/workTrackerEffects.ts
src/utils/logger.ts
```

Commit:

```bash
git add .
git commit -m "Store exit timestamp and notify on active session geofence exit"
npm run gm
```

---

# 9. Ajustar failsafe para usar timestamp real de salida ✅️ TAREA FINALIZADA Y APROBADA ✅️

El failsafe no debe cerrar con la hora tardía de ejecución del background task. Debe cerrar con:

```text
EXIT_TIMESTAMP_KEY
```

Regla:

```text
si active session
y existe EXIT_TIMESTAMP_KEY
y threshold ya se cumplió:
  cerrar sesión con AUTO_CHECKOUT_FAILSAFE
  end_time = exitTimestamp
```

El punto importante es que BackgroundTask no es reloj exacto, porque la documentación dice que la tarea puede ejecutarse después del intervalo mínimo si el sistema lo decide y si se cumplen condiciones. [1](https://docs.expo.dev/versions/latest/sdk/background-task/)

## Logs esperados

```text
BACKGROUND_RUN_STARTED
BACKGROUND_FAILSAFE_CHECK_STARTED
BACKGROUND_FAILSAFE_SKIPPED_NO_EXIT_TIMESTAMP
BACKGROUND_FAILSAFE_SKIPPED_THRESHOLD_NOT_MET
BACKGROUND_FAILSAFE_COMPLETED
```

Commit:

```bash
git add .
git commit -m "Use stored exit timestamp for background failsafe checkout"
npm run gm
```

---

# 10. Separar internamente la background task ✅️ TAREA FINALIZADA Y APROBADA ✅️

No necesariamente crear nuevas tareas nativas. Solo separar funciones internas:

```ts
export async function runBackgroundMaintenance() {
  await runFailsafeCheck();
  await runPendingReportDeliveryCheck();
  await runWeeklyReportCheck();
}
```

Estructura sugerida:

```text
src/services/BackgroundTasks.ts
```

Funciones:

```ts
async function runFailsafeCheck() {}
async function runPendingReportDeliveryCheck() {}
async function runWeeklyReportWindowCheck() {}
async function runBackgroundMaintenance() {}
```

Logs:

```text
BACKGROUND_RUN_STARTED
BACKGROUND_RUN_COMPLETED
BACKGROUND_RUN_FAILED
BACKGROUND_FAILSAFE_COMPLETED
BACKGROUND_REPORT_CHECK_COMPLETED
BACKGROUND_PENDING_REPORT_RETRY_COMPLETED
```

Commit:

```bash
git add .
git commit -m "Structure background maintenance with dedicated audit logs"
npm run gm
```

---

# 11. Tests obligatorios para Fase D ✅️ TAREA FINALIZADA Y APROBADA ✅️

Agregar tests antes de cerrar.

## Tests mínimos

```text
1. pending_arrival + APP_INIT + ubicación dentro del radio
   → registra AUTO_CHECKIN_GPS

2. pending_arrival + FOREGROUND + GPS weak
   → no registra check-in
   → log GPS_SAMPLE_REJECTED_WEAK_ACCURACY

3. pending_arrival + DASHBOARD_REFRESH + fuera del radio
   → no registra check-in

4. active + geofence exit
   → guarda EXIT_TIMESTAMP_KEY
   → notifica salida

5. active + EXIT_TIMESTAMP_KEY + threshold cumplido
   → cierra con AUTO_CHECKOUT_FAILSAFE
   → usa timestamp real de salida

6. active + checkout manual después de exit timestamp
   → cierra con MANUAL_CHECKOUT
   → no lo convierte en AUTO_CHECKOUT_FAILSAFE
```

## Archivos de tests sugeridos

```text
src/runtime/__tests__/runtimeSupervisor.test.ts
src/services/__tests__/BackgroundTasks.runtime.test.ts
src/engine/__tests__/workTrackerEffects.runtime.test.ts
```

Commit:

```bash
git add .
git commit -m "Add runtime resilience tests for arrival and exit reconciliation"
npm run gm
```

---

# 12. Actualizar Gold Master audit si aplica ✅️ TAREA FINALIZADA Y APROBADA ✅️

Como en Fase C ya tienes auditorías para DB/logger, Fase D debería auditar que no se pierdan piezas críticas.

Agregar checks si tu audit framework lo permite:

```text
- runtimeSupervisor.ts existe
- reconcileRuntimeState existe
- eventos RUNTIME_* existen en logger
- EXIT_TIMESTAMP_KEY sigue protegido
- AUTO_CHECKOUT_FAILSAFE sigue separado de AUTO_CHECKOUT_GPS
- AUTO_CHECKIN_GPS sigue existiendo
```

Archivos probables:

```text
scripts/audit/audits/logger.audit.ts
scripts/audit/audits/database.audit.ts
scripts/audit/gold-master.ts
```

Commit:

```bash
git add .
git commit -m "Audit runtime resilience invariants in Gold Master"
npm run gm
```

---

# 13. Prueba manual de campo

Esta prueba debe ser más precisa que la anterior.

## Caso A: llegada sin reload

```text
1. Abrir app limpia.
2. Start Shift o flujo equivalente.
3. Activate Geofence a destino real.
4. Conducir al sitio.
5. No hacer reload.
6. Abrir app o hacer foreground si estaba background.
7. Esperar reconciliación.
```

Esperado:

```text
RUNTIME_RECONCILE_STARTED source=FOREGROUND
GPS_SAMPLE_ACCEPTED_FOR_RECONCILIATION
PENDING_ARRIVAL_RECONCILED_TO_ACTIVE
Auto Check-in (GPS) registrado
```

## Caso B: llegada con pull-to-refresh

```text
1. Crear pending_arrival.
2. Llegar al destino.
3. Si no confirma solo, hacer pull-to-refresh.
```

Esperado:

```text
RUNTIME_RECONCILE_STARTED source=DASHBOARD_REFRESH
PENDING_ARRIVAL_RECONCILED_TO_ACTIVE
```

## Caso C: salida del perímetro

```text
1. Tener sesión active.
2. Salir del perímetro.
3. Esperar evento de salida o reconciliación.
```

Esperado:

```text
Geocerca: SALIDA validada
EXIT_TIMESTAMP_STORED
Notificación enviada/programada
```

## Caso D: checkout manual después de salida

```text
1. Salir del perímetro.
2. Confirmar que se guardó EXIT_TIMESTAMP_KEY.
3. Hacer Clock Out manual.
```

Esperado:

```text
STOP_SESSION_REQUEST
MANUAL_CHECKOUT
Monitoreo detenido
PDF muestra Check-out manual
```

## Caso E: failsafe

```text
1. Salir del perímetro.
2. No responder.
3. Dejar que background/failsafe corra cuando el sistema lo permita.
```

Esperado:

```text
AUTO_CHECKOUT_FAILSAFE
end_time = timestamp real de salida
no end_time = hora tardía del background task
```

---

# 14. Checklist de cierre de Fase D

Antes de mergear:

```bash
git status
npm run gm
```

Debe estar:

```text
✅ typecheck pass
✅ lint pass
✅ 44+ tests pass
✅ audit:gm pass
✅ report PDF sigue funcionando
✅ manual checkout sigue mostrando MANUAL_CHECKOUT
✅ AUTO_CHECKIN_GPS sigue funcionando
✅ salida guarda EXIT_TIMESTAMP_KEY
✅ failsafe usa timestamp real de salida
✅ foreground reconciliation funciona
✅ dashboard refresh reconciliation funciona
```

---

# 15. Merge y tag de cierre

Cuando todo esté verde:

```bash
git checkout main
git pull origin main
git merge feature/runtime-resilience-phase-d
npm run gm
git push origin main
```

Crear tag:

```bash
git tag phase-d-runtime-resilience-complete
git push origin phase-d-runtime-resilience-complete
```

---

# Orden recomendado de commits

Puedes seguir esta secuencia exacta:

```bash
git checkout main
git pull origin main
git checkout -b feature/runtime-resilience-phase-d

# 1
git add docs/phase-d-runtime-resilience.md
git commit -m "Document Phase D runtime resilience scope"
npm run gm

# 2
git add src/runtime/runtimeSupervisor.ts src/utils/logger.ts
git commit -m "Add runtime supervisor and reconciliation audit events"
npm run gm

# 3
git add .
git commit -m "Reconcile pending arrival sessions from foreground location"
npm run gm

# 4
git add .
git commit -m "Run runtime reconciliation during app init"
npm run gm

# 5
git add .
git commit -m "Reconcile runtime state when app returns to foreground"
npm run gm

# 6
git add .
git commit -m "Run runtime reconciliation from dashboard refresh"
npm run gm

# 7
git add .
git commit -m "Store exit timestamp and notify on active session geofence exit"
npm run gm

# 8
git add .
git commit -m "Use stored exit timestamp for background failsafe checkout"
npm run gm

# 9
git add .
git commit -m "Structure background maintenance with dedicated audit logs"
npm run gm

# 10
git add .
git commit -m "Add runtime resilience tests for arrival and exit reconciliation"
npm run gm

# 11
git add .
git commit -m "Audit runtime resilience invariants in Gold Master"
npm run gm
```

---

# Definición final de “Fase D completada”

Yo consideraría Fase D cerrada solo cuando puedas decir:

```text
✅ Si la sesión está pending_arrival y el usuario ya está en destino,
   APP_INIT, foreground o dashboard refresh pueden convertirla en active.

✅ Si la sesión está active y el usuario sale del perímetro,
   la app guarda EXIT_TIMESTAMP_KEY y notifica.

✅ Si el usuario hace checkout manual,
   el reporte conserva MANUAL_CHECKOUT.

✅ Si el usuario no responde,
   failsafe cierra con AUTO_CHECKOUT_FAILSAFE usando timestamp real de salida.

✅ Background task queda tratado como best effort, no como reloj exacto.

✅ npm run gm pasa completo en rama y en main.
```
