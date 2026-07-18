**Providing task instructions**  
Voy a ofrecer una serie de instrucciones sobre cómo proceder con la escritura de texto, asegurándome de que sean concisas pero completas. Aquí están los pasos a seguir:  

1. **Definir el objetivo**: Clarifica el propósito del texto que se va a escribir.  
2. **Identificar la audiencia**: Considera quién leerá el texto y adapta el tono y el estilo en consecuencia.  
3. **Recopilar información**: Reúne datos relevantes y recursos que apoyen el contenido.  
4. **Estructurar el texto**: Organiza las ideas en una estructura lógica, como introducción, desarrollo y conclusión.  
5. **Redactar el borrador**: Escribe un primer borrador sin preocuparte demasiado por la perfección.  
6. **Revisar y editar**: Revisa el texto para corregir errores y mejorar la claridad y coherencia.  
7. **Obtener retroalimentación**: Si es posible, comparte el texto con otros para recibir comentarios.  
8. **Finalizar el texto**: Realiza los ajustes finales y asegúrate de que esté listo para su presentación o publicación.  

Estos pasos deberían guiar el proceso de escritura de manera efectiva.
Perfecto. Aquí tienes una versión más accionable, dividida en **Tareas** y **Pasos Lógicos**, pensada para dársela directamente a un agente de programación autónomo con autorización completa sobre el proyecto.

```md
# Instrucciones para Agente de Programación: Fase D - Runtime Resilience

Actúa como un agente de programación senior con autorización total para modificar, validar, auditar y cerrar esta fase del proyecto. Tu objetivo es implementar **Fase D: Runtime Resilience** sin romper la estabilidad alcanzada en fases anteriores.

La fase debe aplicarse con criterio de producción: cambios pequeños, validación frecuente, tests claros, auditoría estructurada y preservación total de la semántica ya existente de check-in/check-out.

No incluyas funciones fuera de alcance. No hagas refactors grandes si no son necesarios para completar esta fase.

---

# Objetivo General de Fase D

Implementar una capa runtime que permita a la app **recuperar y corregir su estado operacional** cuando:

- la app inicia,
- vuelve a foreground,
- el dashboard se refresca,
- corre una tarea background,
- se detecta entrada o salida tardía de geocerca.

La app debe reconciliar sesiones `pending_arrival` y `active` contra:

- ubicación actual,
- estado de monitoreo,
- storage,
- timestamps de salida,
- estado de app,
- geocercas,
- background tasks.

---

# Principios Técnicos Obligatorios

1. **Background task es best effort**
   - No trates las tareas background como reloj exacto.
   - El sistema operativo decide cuándo ejecutarlas.
   - El failsafe debe usar timestamps reales guardados previamente, no la hora tardía de ejecución de background.

2. **Foreground reconciliation es obligatoria**
   - Al volver de `background` o `inactive` a `active`, la app debe reconciliar estado.

3. **Dashboard refresh debe reconciliar**
   - El pull-to-refresh debe poder corregir una sesión `pending_arrival` que ya debería estar `active`.

4. **APP_INIT debe reconciliar**
   - El inicio de app debe cargar datos, asegurar monitoreo y reconciliar estado.

5. **No mover `TaskManager.defineTask`**
   - No coloques `TaskManager.defineTask` dentro del supervisor runtime ni dentro de lifecycle methods de React.
   - Debe permanecer en scope global del bundle.

6. **Preservar semánticas existentes**
   - `AUTO_CHECKIN_GPS` debe seguir existiendo.
   - `MANUAL_CHECKOUT` debe conservarse para checkout manual.
   - `AUTO_CHECKOUT_FAILSAFE` debe seguir separado de `AUTO_CHECKOUT_GPS`.
   - No convertir checkout manual en failsafe.

---

# Fuera de Alcance

No implementes todavía:

- lunch reminder completo,
- overtime flow completo,
- Sentry/PostHog,
- migraciones grandes de DB,
- location evidence persistente completo,
- rediseño grande de notificaciones laborales.

Si encuentras código relacionado, no lo amplíes salvo que sea estrictamente necesario para completar Runtime Resilience.

---

# Tarea 1: Preparar la Fase D

## Objetivo

Crear una base clara y documentada para la fase antes de modificar lógica runtime.

## Pasos Lógicos

1. Verifica que el proyecto esté en un estado limpio y validado.
2. Confirma que la validación general del proyecto pasa antes de iniciar.
3. Crea una rama de trabajo dedicada para Fase D usando la estrategia normal del repositorio.
4. No mezcles esta fase con cambios no relacionados.

## Entregable

Crear un documento interno:

```text
docs/phase-d-runtime-resilience.md
```

## Contenido mínimo sugerido

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

## Criterios de aceptación

- Existe documentación de alcance.
- Los objetivos y no objetivos están claros.
- No se ha tocado lógica funcional todavía.
- La base sigue validando correctamente.

---

# Tarea 2: Crear Runtime Supervisor

## Objetivo

Crear una capa central de coordinación runtime que pueda reconciliar el estado de la app desde distintos puntos de entrada.

## Archivo sugerido

```text
src/runtime/runtimeSupervisor.ts
```

## Responsabilidad del módulo

El supervisor debe coordinar, no contener toda la lógica pesada.

Debe orquestar:

- lectura de sesión actual,
- reconciliación de `pending_arrival`,
- reconciliación de sesión `active`,
- verificación de monitoreo,
- logs estructurados,
- manejo seguro de errores.

## API esperada

El módulo debe exponer una API equivalente a:

```ts
export type RuntimeReconcileSource =
  | 'APP_INIT'
  | 'FOREGROUND'
  | 'DASHBOARD_REFRESH'
  | 'BACKGROUND_TASK';

export async function reconcileRuntimeState(source: RuntimeReconcileSource) {
  // Orquestar reconciliación runtime
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

## Pasos Lógicos

1. Crear el archivo `runtimeSupervisor`.
2. Definir el tipo `RuntimeReconcileSource`.
3. Crear la función principal `reconcileRuntimeState`.
4. Crear wrappers semánticos:
   - `onAppStart`,
   - `onAppForeground`,
   - `onDashboardRefresh`,
   - `onBackgroundMaintenance`.
5. Conectar el supervisor con adapters o servicios existentes.
6. Evitar dependencias circulares.
7. Agregar protección básica contra fallos para que una reconciliación fallida no rompa la app.
8. Considerar protección contra reentrancia si existe riesgo de reconciliaciones simultáneas.

## Criterios de aceptación

- Existe `runtimeSupervisor.ts`.
- Existe `reconcileRuntimeState`.
- El supervisor tiene entradas claras para app init, foreground, dashboard refresh y background.
- No se movió `TaskManager.defineTask`.
- El módulo coordina, pero no concentra toda la lógica de DB, location, background y notificaciones.

---

# Tarea 3: Agregar Auditoría Runtime Estructurada

## Objetivo

Agregar eventos de logging/auditoría para diagnosticar reconciliaciones runtime en campo real.

## Archivo probable

```text
src/utils/logger.ts
```

o el módulo equivalente de auditoría/logs existente.

## Eventos Mínimos

Agregar soporte para:

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

## Metadata mínima cuando aplique

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

## Pasos Lógicos

1. Revisar cómo está estructurado actualmente el logger.
2. Agregar eventos nuevos siguiendo la convención existente.
3. Crear helpers si el proyecto ya usa funciones dedicadas para logs.
4. Asegurar que cada reconciliación tenga:
   - log de inicio,
   - log de completado,
   - log de skip con razón,
   - log de fallo con contexto.
5. Asegurar que GPS débil y GPS aceptado tengan eventos separados.
6. Asegurar que guardar timestamp y encontrar timestamp ya existente tengan eventos separados.

## Criterios de aceptación

- Todos los eventos mínimos existen.
- Los eventos tienen metadata útil.
- Los skips incluyen razón.
- Los errores quedan registrados sin romper el flujo principal.
- La taxonomía de logs se mantiene consistente con el proyecto.

---

# Tarea 4: Reconciliar Sesiones `pending_arrival`

## Objetivo

Resolver el caso en que el usuario ya llegó al destino, pero la app no registró Auto Check-in hasta reload, foreground o refresh manual.

## Regla Principal

Cuando se ejecute reconciliación desde:

```text
APP_INIT
FOREGROUND
DASHBOARD_REFRESH
BACKGROUND_TASK
```

y exista una sesión:

```text
status = pending_arrival
```

la app debe intentar reconciliarla contra ubicación actual.

## Pasos Lógicos

1. Buscar sesión actual `pending_arrival`.
2. Si no existe:
   - registrar skip con razón `NO_PENDING_ARRIVAL`.
3. Obtener ubicación actual para reconciliación.
4. Si no hay ubicación:
   - registrar skip con razón `NO_LOCATION_AVAILABLE`.
5. Validar precisión GPS.
6. Si `accuracy > 50m` o supera la constante equivalente existente:
   - no hacer check-in,
   - registrar `GPS_SAMPLE_REJECTED_WEAK_ACCURACY`.
7. Calcular distancia desde la ubicación actual al destino de la sesión.
8. Validar si está dentro del radio de llegada, incluyendo hysteresis si el proyecto ya la usa.
9. Si está fuera del radio:
   - no hacer check-in,
   - registrar skip con razón `OUTSIDE_TARGET_RADIUS`.
10. Si está dentro del radio:
   - registrar `AUTO_CHECKIN_GPS`,
   - cambiar sesión a `active`,
   - sincronizar estado de active session,
   - registrar `PENDING_ARRIVAL_RECONCILED_TO_ACTIVE`.
11. Asegurar que la transición sea idempotente.
12. Asegurar que no se registre check-in duplicado.

## Pseudoflujo

```ts
async function reconcilePendingArrival(source: RuntimeReconcileSource) {
  const session = await getPendingArrivalSession();

  if (!session) {
    logRuntimeSkipped('NO_PENDING_ARRIVAL', { source });
    return;
  }

  const location = await getCurrentLocationForReconciliation();

  if (!location) {
    logRuntimeSkipped('NO_LOCATION_AVAILABLE', {
      source,
      sessionId: session.id,
    });
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

## Archivos probables

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

## Criterios de aceptación

- `pending_arrival` puede pasar a `active` por APP_INIT.
- `pending_arrival` puede pasar a `active` por FOREGROUND.
- `pending_arrival` puede pasar a `active` por DASHBOARD_REFRESH.
- `pending_arrival` puede pasar a `active` por BACKGROUND_TASK si las condiciones son válidas.
- No se hace check-in con GPS débil.
- No se hace check-in fuera del radio.
- Se preserva `AUTO_CHECKIN_GPS`.

---

# Tarea 5: Conectar Runtime Reconciliation con APP_INIT

## Objetivo

Asegurar que la app reconcilie estado al iniciar.

## Flujo Esperado

```text
APP_INIT
-> cargar datos
-> asegurar monitoreo
-> reconcileRuntimeState('APP_INIT')
-> DATA_LOADED
```

## Archivo probable

```text
src/engine/effects/workTrackerEffects.ts
```

o donde se maneje actualmente `APP_INIT`.

## Pasos Lógicos

1. Localizar el flujo actual de `APP_INIT`.
2. Identificar dónde se cargan datos y se asegura monitoreo.
3. Insertar llamada única a `reconcileRuntimeState('APP_INIT')`.
4. Asegurar que errores de reconciliación no bloqueen el inicio de la app.
5. Registrar logs de inicio, final, skip o fallo.
6. Evitar duplicar lógica que ya exista en servicios.

## Criterios de aceptación

- `APP_INIT` ejecuta reconciliación runtime.
- Si hay `pending_arrival` y ubicación válida dentro del radio, pasa a `active`.
- Si no puede reconciliar, la app sigue cargando.
- `DATA_LOADED` sigue ocurriendo correctamente.
- No se rompe el flujo de inicialización existente.

---

# Tarea 6: Conectar Runtime Reconciliation con Foreground

## Objetivo

Ejecutar reconciliación cada vez que la app vuelve a foreground.

## Archivo sugerido

```text
src/runtime/useRuntimeSupervisor.ts
```

o integración en:

```text
app/_layout.tsx
```

si ese es el punto global adecuado.

## Pasos Lógicos

1. Crear o ubicar un hook global de runtime.
2. Usar `AppState` para observar cambios de estado.
3. Guardar el estado anterior.
4. Detectar transición desde:
   - `inactive` a `active`,
   - `background` a `active`.
5. Al detectar retorno a foreground, ejecutar:
   - `reconcileRuntimeState('FOREGROUND')`.
6. Limpiar el listener correctamente.
7. Asegurar que no se disparen reconciliaciones duplicadas innecesarias.
8. Manejar errores sin afectar la UI.

## Pseudoflujo

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

## Criterios de aceptación

- Al volver a foreground se ejecuta reconciliación.
- Si el usuario ya llegó al destino, puede registrarse `AUTO_CHECKIN_GPS`.
- No se generan loops.
- El listener se limpia correctamente.
- La UI no queda bloqueada.

---

# Tarea 7: Conectar Runtime Reconciliation con Dashboard Refresh

## Objetivo

Permitir que el pull-to-refresh del dashboard corrija estado runtime.

## Flujo Esperado

```text
pull-to-refresh
-> reload dashboard data
-> reconcileRuntimeState('DASHBOARD_REFRESH')
-> reload dashboard data otra vez si hubo cambios
```

## Archivo probable

```text
app/(tabs)/index.tsx
```

o el componente real del Dashboard.

## Pasos Lógicos

1. Localizar el handler actual de refresh.
2. Asegurar que active el estado visual de refreshing.
3. Ejecutar reconciliación con source `DASHBOARD_REFRESH`.
4. Recargar datos del dashboard después de reconciliar.
5. Si la reconciliación cambió el estado de sesión, reflejarlo en UI.
6. Manejar errores sin dejar el spinner activo.
7. Registrar logs runtime correspondientes.

## Pseudoflujo

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

## Criterios de aceptación

- Pull-to-refresh ejecuta runtime reconciliation.
- Si hay `pending_arrival` válido, pasa a `active`.
- El dashboard muestra el estado actualizado.
- El refresh termina incluso si ocurre error.
- No se duplica lógica de sesión en el componente UI.

---

# Tarea 8: Reconciliar Salida de Geocerca para Sesión `active`

## Objetivo

Resolver el caso en que el usuario sale del perímetro, pero la app no reacciona oportunamente.

## Regla Principal

Cuando exista una sesión:

```text
status = active
```

y se detecte:

```text
GEOFENCE_EXIT_DETECTED
```

la app debe:

1. Guardar `EXIT_TIMESTAMP_KEY` con timestamp real de salida.
2. Registrar `EXIT_TIMESTAMP_STORED`.
3. Notificar al usuario.
4. Mantener la sesión `active` mientras espera decisión.
5. Permitir checkout manual posterior como `MANUAL_CHECKOUT`.
6. Permitir failsafe posterior como `AUTO_CHECKOUT_FAILSAFE` si el usuario no responde.

## Pasos Lógicos

1. Localizar el flujo actual de salida de geocerca.
2. Confirmar cómo se detecta y valida una salida.
3. Al validar salida de sesión active, obtener timestamp real del evento.
4. Guardar `EXIT_TIMESTAMP_KEY` si no existe.
5. Si ya existe:
   - no sobrescribirlo,
   - registrar `EXIT_TIMESTAMP_ALREADY_PRESENT`.
6. Enviar o programar notificación de salida.
7. Registrar evento `ACTIVE_SESSION_EXIT_RECONCILED`.
8. Mantener la sesión en estado `active`.
9. Asegurar que el monitoreo siga en estado coherente.
10. Asegurar idempotencia para eventos repetidos.

## Logs esperados

```text
Geocerca: SALIDA validada para sesión
EXIT_TIMESTAMP_STORED
Notificación de salida programada/enviada
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

## Criterios de aceptación

- Salida de geocerca guarda `EXIT_TIMESTAMP_KEY`.
- La notificación se envía o programa.
- La sesión permanece `active`.
- No se cierra automáticamente solo por salir.
- No se sobrescribe timestamp existente.
- Checkout manual posterior sigue siendo `MANUAL_CHECKOUT`.

---

# Tarea 9: Ajustar Failsafe para Usar Timestamp Real de Salida

## Objetivo

Asegurar que el failsafe cierre usando la hora real de salida, no la hora tardía en que corrió background.

## Regla Principal

Si existe:

```text
active session
EXIT_TIMESTAMP_KEY
threshold cumplido
```

entonces cerrar con:

```text
AUTO_CHECKOUT_FAILSAFE
end_time = exitTimestamp
```

## Pasos Lógicos

1. Localizar la lógica actual de failsafe.
2. Separar claramente la hora de ejecución del background task del timestamp real de salida.
3. Leer `EXIT_TIMESTAMP_KEY`.
4. Si no existe:
   - no cerrar sesión,
   - registrar `BACKGROUND_FAILSAFE_SKIPPED_NO_EXIT_TIMESTAMP`.
5. Si existe pero el threshold no se cumplió:
   - no cerrar sesión,
   - registrar `BACKGROUND_FAILSAFE_SKIPPED_THRESHOLD_NOT_MET`.
6. Si el threshold se cumplió:
   - cerrar la sesión con `AUTO_CHECKOUT_FAILSAFE`,
   - usar `exitTimestamp` como `end_time`.
7. Si la sesión ya fue cerrada manualmente:
   - no ejecutar failsafe.
8. Verificar que el reporte conserve la semántica correcta.

## Logs esperados

```text
BACKGROUND_RUN_STARTED
BACKGROUND_FAILSAFE_CHECK_STARTED
BACKGROUND_FAILSAFE_SKIPPED_NO_EXIT_TIMESTAMP
BACKGROUND_FAILSAFE_SKIPPED_THRESHOLD_NOT_MET
BACKGROUND_FAILSAFE_COMPLETED
```

## Criterios de aceptación

- Failsafe usa `EXIT_TIMESTAMP_KEY`.
- Failsafe no usa la hora tardía de background como `end_time`.
- Failsafe no pisa checkout manual.
- `AUTO_CHECKOUT_FAILSAFE` sigue separado de `AUTO_CHECKOUT_GPS`.
- Si no hay timestamp real de salida, no se cierra sesión por failsafe.

---

# Tarea 10: Estructurar Background Maintenance

## Objetivo

Separar internamente las responsabilidades de background sin crear necesariamente nuevas tareas nativas.

## Archivo probable

```text
src/services/BackgroundTasks.ts
```

## Estructura sugerida

```ts
export async function runBackgroundMaintenance() {
  await runFailsafeCheck();
  await runPendingReportDeliveryCheck();
  await runWeeklyReportWindowCheck();
}
```

## Subrutinas esperadas

```ts
async function runFailsafeCheck() {}
async function runPendingReportDeliveryCheck() {}
async function runWeeklyReportWindowCheck() {}
async function runBackgroundMaintenance() {}
```

## Pasos Lógicos

1. Revisar la tarea background actual.
2. Mantener `TaskManager.defineTask` donde ya corresponde.
3. Crear o ajustar `runBackgroundMaintenance`.
4. Extraer failsafe a `runFailsafeCheck`.
5. Extraer retry de reportes pendientes a función dedicada.
6. Extraer revisión semanal a función dedicada.
7. Agregar logs por subrutina.
8. Asegurar que errores de una subrutina no oculten diagnósticos útiles.
9. Decidir si un fallo debe frenar toda la maintenance o solo registrarse, según patrón actual del proyecto.

## Logs esperados

```text
BACKGROUND_RUN_STARTED
BACKGROUND_RUN_COMPLETED
BACKGROUND_RUN_FAILED
BACKGROUND_FAILSAFE_COMPLETED
BACKGROUND_REPORT_CHECK_COMPLETED
BACKGROUND_PENDING_REPORT_RETRY_COMPLETED
```

## Criterios de aceptación

- Background maintenance queda organizada.
- Failsafe está separado.
- Report checks están separados.
- Logs son claros.
- No se crean nuevas tareas nativas innecesarias.
- No se mueve `TaskManager.defineTask` fuera de su lugar correcto.

---

# Tarea 11: Agregar Tests de Runtime Resilience

## Objetivo

Cubrir los flujos críticos de Fase D con tests deterministas.

## Tests mínimos obligatorios

### Test 1: Pending arrival en APP_INIT dentro del radio

```text
Given sesión pending_arrival
And source APP_INIT
And ubicación con accuracy válida dentro del radio
Then registra AUTO_CHECKIN_GPS
And cambia sesión a active
And loguea PENDING_ARRIVAL_RECONCILED_TO_ACTIVE
```

### Test 2: Pending arrival en FOREGROUND con GPS débil

```text
Given sesión pending_arrival
And source FOREGROUND
And ubicación con accuracy débil
Then no registra check-in
And no cambia sesión a active
And loguea GPS_SAMPLE_REJECTED_WEAK_ACCURACY
```

### Test 3: Pending arrival en DASHBOARD_REFRESH fuera del radio

```text
Given sesión pending_arrival
And source DASHBOARD_REFRESH
And ubicación válida pero fuera del radio
Then no registra check-in
And no cambia sesión a active
And loguea skip OUTSIDE_TARGET_RADIUS
```

### Test 4: Active session con geofence exit

```text
Given sesión active
When se detecta salida de geocerca
Then guarda EXIT_TIMESTAMP_KEY
And notifica salida
And mantiene sesión active
```

### Test 5: Active session con EXIT_TIMESTAMP_KEY y threshold cumplido

```text
Given sesión active
And EXIT_TIMESTAMP_KEY existe
And threshold está cumplido
When corre failsafe
Then cierra con AUTO_CHECKOUT_FAILSAFE
And usa exitTimestamp como end_time
```

### Test 6: Checkout manual después de exit timestamp

```text
Given sesión active
And EXIT_TIMESTAMP_KEY existe
When el usuario hace checkout manual
Then cierra con MANUAL_CHECKOUT
And no lo convierte en AUTO_CHECKOUT_FAILSAFE
```

## Archivos sugeridos

```text
src/runtime/__tests__/runtimeSupervisor.test.ts
src/services/__tests__/BackgroundTasks.runtime.test.ts
src/engine/__tests__/workTrackerEffects.runtime.test.ts
```

## Pasos Lógicos

1. Revisar estructura actual de tests.
2. Crear tests en los módulos más apropiados.
3. Mockear ubicación actual.
4. Mockear accuracy fuerte y débil.
5. Mockear distancia dentro y fuera del radio.
6. Mockear sesión `pending_arrival`.
7. Mockear sesión `active`.
8. Mockear storage de `EXIT_TIMESTAMP_KEY`.
9. Mockear notificaciones.
10. Verificar logs relevantes.
11. Verificar que no haya transiciones duplicadas.
12. Ejecutar toda la suite y corregir regresiones.

## Criterios de aceptación

- Los seis tests mínimos existen.
- Los tests son deterministas.
- No dependen de ubicación real.
- No dependen del reloj real sin control.
- Verifican semánticas críticas.
- Tests existentes siguen pasando.

---

# Tarea 12: Actualizar Auditoría Gold Master

## Objetivo

Proteger invariantes críticas de Fase D dentro del sistema de auditoría existente.

## Checks sugeridos

Agregar si el framework lo permite:

```text
runtimeSupervisor.ts existe
reconcileRuntimeState existe
eventos RUNTIME_* existen en logger
EXIT_TIMESTAMP_KEY sigue protegido
AUTO_CHECKOUT_FAILSAFE sigue separado de AUTO_CHECKOUT_GPS
AUTO_CHECKIN_GPS sigue existiendo
```

## Archivos probables

```text
scripts/audit/audits/logger.audit.ts
scripts/audit/audits/database.audit.ts
scripts/audit/gold-master.ts
```

## Pasos Lógicos

1. Revisar cómo funcionan las auditorías actuales.
2. Agregar checks estructurales de Fase D.
3. Evitar checks frágiles basados en formato cosmético.
4. Verificar que los checks protejan contratos reales.
5. Ejecutar auditoría completa.
6. Corregir cualquier falso positivo.

## Criterios de aceptación

- Gold Master valida invariantes runtime.
- Los checks no son frágiles.
- La auditoría protege semánticas críticas.
- La auditoría completa pasa.

---

# Tarea 13: Validar Manualmente Flujos de Campo

## Objetivo

Documentar y ejecutar pruebas manuales representativas de campo real.

---

## Caso A: Llegada sin reload

### Pasos

```text
1. Abrir app limpia.
2. Iniciar Start Shift o flujo equivalente.
3. Activar geocerca a destino real.
4. Llegar físicamente al sitio.
5. No hacer reload manual.
6. Abrir app o volverla a foreground si estaba en background.
7. Esperar reconciliación.
```

### Esperado

```text
RUNTIME_RECONCILE_STARTED source=FOREGROUND
GPS_SAMPLE_ACCEPTED_FOR_RECONCILIATION
PENDING_ARRIVAL_RECONCILED_TO_ACTIVE
Auto Check-in GPS registrado
```

---

## Caso B: Llegada con pull-to-refresh

### Pasos

```text
1. Crear sesión pending_arrival.
2. Llegar al destino.
3. Si no confirma sola, hacer pull-to-refresh.
```

### Esperado

```text
RUNTIME_RECONCILE_STARTED source=DASHBOARD_REFRESH
PENDING_ARRIVAL_RECONCILED_TO_ACTIVE
```

---

## Caso C: Salida del perímetro

### Pasos

```text
1. Tener sesión active.
2. Salir del perímetro.
3. Esperar evento de salida o reconciliación.
```

### Esperado

```text
Geocerca: SALIDA validada
EXIT_TIMESTAMP_STORED
Notificación enviada/programada
```

---

## Caso D: Checkout manual después de salida

### Pasos

```text
1. Salir del perímetro.
2. Confirmar que se guardó EXIT_TIMESTAMP_KEY.
3. Hacer Clock Out manual.
```

### Esperado

```text
STOP_SESSION_REQUEST
MANUAL_CHECKOUT
Monitoreo detenido
PDF muestra Check-out manual
```

---

## Caso E: Failsafe

### Pasos

```text
1. Salir del perímetro.
2. No responder.
3. Dejar que background/failsafe corra cuando el sistema lo permita.
```

### Esperado

```text
AUTO_CHECKOUT_FAILSAFE
end_time = timestamp real de salida
end_time no debe ser la hora tardía del background task
```

## Criterios de aceptación

- Todos los casos manuales tienen resultado esperado.
- Los logs permiten verificar cada transición.
- El reporte conserva la semántica de checkout.
- El comportamiento en campo coincide con el contrato de Fase D.

---

# Tarea 14: Validación Final de Cierre

## Objetivo

Confirmar que Fase D está lista para integración.

## Checklist Final

Antes de integrar, verificar:

```text
typecheck pasa
lint pasa
tests existentes pasan
tests nuevos pasan
audit Gold Master pasa
report PDF sigue funcionando
manual checkout sigue mostrando MANUAL_CHECKOUT
AUTO_CHECKIN_GPS sigue funcionando
salida guarda EXIT_TIMESTAMP_KEY
failsafe usa timestamp real de salida
foreground reconciliation funciona
dashboard refresh reconciliation funciona
APP_INIT reconciliation funciona
background task queda como best effort
no se introdujeron migraciones grandes
no se mezclaron lunch reminder u overtime flows completos
```

## Pasos Lógicos

1. Revisar cambios pendientes.
2. Revisar que no haya archivos temporales.
3. Ejecutar validación completa del proyecto.
4. Revisar manualmente los cambios críticos.
5. Confirmar que los tests cubren los flujos mínimos.
6. Confirmar que los logs son útiles.
7. Confirmar que los reportes no rompieron semántica.
8. Integrar a la rama principal usando el flujo estándar del repositorio.
9. Validar nuevamente después de integrar.
10. Crear marca/tag de cierre según convención del proyecto.

## Criterios de aceptación

- Validación completa pasa antes de integrar.
- Validación completa pasa después de integrar.
- No hay regresiones conocidas.
- Fase D queda documentada.
- La rama principal queda estable.

---

# Orden Lógico Recomendado de Trabajo

Ejecuta la fase en este orden:

```text
1. Documentar contrato de Fase D.
2. Crear runtimeSupervisor.
3. Agregar eventos de auditoría runtime.
4. Implementar reconciliación de pending_arrival.
5. Conectar APP_INIT.
6. Conectar foreground con AppState.
7. Conectar dashboard refresh.
8. Guardar EXIT_TIMESTAMP_KEY en salida de geocerca.
9. Ajustar failsafe para usar timestamp real.
10. Separar background maintenance.
11. Agregar tests obligatorios.
12. Agregar auditorías Gold Master.
13. Ejecutar pruebas manuales de campo.
14. Validar cierre e integrar.
```

---

# Estrategia de Commits

Divide los cambios en commits pequeños y verificables. Usa esta secuencia lógica:

```text
1. Document Phase D runtime resilience scope
2. Add runtime supervisor and reconciliation audit events
3. Reconcile pending arrival sessions from foreground location
4. Run runtime reconciliation during app init
5. Reconcile runtime state when app returns to foreground
6. Run runtime reconciliation from dashboard refresh
7. Store exit timestamp and notify on active session geofence exit
8. Use stored exit timestamp for background failsafe checkout
9. Structure background maintenance with dedicated audit logs
10. Add runtime resilience tests for arrival and exit reconciliation
11. Audit runtime resilience invariants in Gold Master
```

Después de cada bloque lógico, ejecuta las validaciones equivalentes del proyecto y corrige cualquier regresión antes de continuar.

---

# Definición Final de Fase D Completada

Considera Fase D cerrada solo cuando puedas afirmar:

```text
Si la sesión está pending_arrival y el usuario ya está en destino,
APP_INIT, foreground o dashboard refresh pueden convertirla en active.

Si la sesión está active y el usuario sale del perímetro,
la app guarda EXIT_TIMESTAMP_KEY y notifica.

Si el usuario hace checkout manual,
el reporte conserva MANUAL_CHECKOUT.

Si el usuario no responde,
failsafe cierra con AUTO_CHECKOUT_FAILSAFE usando timestamp real de salida.

Background task queda tratado como best effort, no como reloj exacto.

La validación Gold Master pasa completa en la rama de trabajo y después de integrar a main.
```

---

# Reglas Finales de Calidad

- No romper Fase C.
- No romper checkout manual.
- No mezclar `AUTO_CHECKOUT_FAILSAFE` con `AUTO_CHECKOUT_GPS`.
- No registrar auto check-in con GPS débil.
- No cerrar sesión automáticamente solo por salir de geocerca.
- No usar la hora del background task como hora real de salida.
- No introducir dependencias externas innecesarias.
- No hacer refactors grandes fuera del alcance.
- Mantener tests claros y deterministas.
- Mantener logs estructurados y útiles para diagnóstico en campo.
- Mantener Gold Master verde.
```
