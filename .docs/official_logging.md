# Estándar de Logging — W‑Tracker

| Color | Categoría | Severidad | Descripción | Ejemplos |
|-------|-----------|-----------|-------------|----------|
| 🟢 Verde | Operación exitosa | INFO | Acción completada correctamente | [Registro guardado con éxito](ca://s?q=Registro_guardado_con_exito), [Auto‑Checkin registrado](ca://s?q=Auto_Checkin_registrado) |
| 🟢 Verde | Servicios activos | INFO | Servicios iniciados sin errores | [Servicios de fondo registrados](ca://s?q=Servicios_fondo_registrados) |
| 🟢 Verde | Integridad OK | INFO | Auditoría sin anomalías | [Integridad verificada](ca://s?q=Integridad_verificada) |
| 🟡 Amarillo | Advertencia | WARN | Algo requiere atención | [Jornada incompleta detectada](ca://s?q=Jornada_incompleta_detectada) |
| 🟡 Amarillo | Configuración modificada | WARN | Cambios en zonas o ajustes | [Zona ADMIN modificada](ca://s?q=Zona_ADMIN_modificada) |
| 🟡 Amarillo | GPS débil | WARN | Precisión insuficiente | [Señal GPS débil](ca://s?q=Senal_GPS_debil) |
| 🟠 Naranja | Evento de geocerca | EVENT | Entrada/salida detectada | [Geocerca ENTRADA](ca://s?q=Geocerca_entrada), [Geocerca SALIDA](ca://s?q=Geocerca_salida) |
| 🟠 Naranja | Reinicio de monitoreo | EVENT | Reinicio automático | [Monitoreo reiniciado](ca://s?q=Monitoreo_reiniciado) |
| 🟠 Naranja | Modos especiales | EVENT | Travel/Lunch Mode | [Travel Mode iniciado](ca://s?q=Travel_mode_iniciado) |
| 🔵 Azul | Permisos concedidos | INFO | Confirmación de permisos | [Permisos de ubicación concedidos](ca://s?q=Permisos_ubicacion_concedidos) |
| 🔵 Azul | Estado del sistema | INFO | Sistema listo | [Sistema listo](ca://s?q=Sistema_listo) |
| ⚪️ Blanco | Background Task | DEBUG/INFO | Procesos silenciosos | [Background iniciada](ca://s?q=Background_iniciada) |
| ⚪️ Blanco | Sin cambios | DEBUG | No hubo acciones | [Background sin cambios](ca://s?q=Background_sin_cambios) |
| 🔴 Rojo | Error crítico | ERROR | Fallas graves | [DB error crítico](ca://s?q=DB_error_critico) |
| 🔴 Rojo | Integridad comprometida | ERROR | Manipulación detectada | [Integridad comprometida](ca://s?q=Integridad_comprometida) |
| 🔴 Rojo | Acción destructiva | ERROR | Eliminación manual | [Registro eliminado](ca://s?q=Registro_eliminado) |
| 🔴 Rojo | Monitoreo detenido | ERROR | Rastreo detenido | [Monitoreo detenido](ca://s?q=Monitoreo_detenido) |

# PSEUDOCODIGO (Propuesta)

// ======================================================
//  W‑TRACKER LOGGER — PSEUDOCÓDIGO OFICIAL
//  Basado en el estándar de colores, categorías y severidades
// ======================================================

DEFINE ENUM Color {
    VERDE,
    AMARILLO,
    NARANJA,
    AZUL,
    BLANCO,
    ROJO
}

DEFINE ENUM Categoria {
    OPERACION_EXITOSA,
    SERVICIOS_ACTIVOS,
    INTEGRIDAD_OK,
    ADVERTENCIA,
    CONFIG_MODIFICADA,
    GPS_DEBIL,
    EVENTO_GEOCERCA,
    REINICIO_MONITOREO,
    MODOS_ESPECIALES,
    PERMISOS_CONCEDIDOS,
    ESTADO_SISTEMA,
    BACKGROUND_TASK,
    SIN_CAMBIOS,
    ERROR_CRITICO,
    INTEGRIDAD_COMPROMETIDA,
    ACCION_DESTRUCTIVA,
    MONITOREO_DETENIDO
}

DEFINE ENUM Severidad {
    INFO,
    WARN,
    EVENT,
    DEBUG,
    ERROR
}

// ======================================================
//  ESTRUCTURA DEL LOG
// ======================================================

STRUCT LogEntry {
    timestamp: DateTime
    color: Color
    categoria: Categoria
    severidad: Severidad
    mensaje: String
    metadata: Map<String, Any> (opcional)
}

// ======================================================
//  FUNCIÓN PRINCIPAL DE LOGGING
// ======================================================

FUNCTION log(color, categoria, severidad, mensaje, metadata = null):

    entry = NEW LogEntry()
    entry.timestamp = NOW()
    entry.color = color
    entry.categoria = categoria
    entry.severidad = severidad
    entry.mensaje = mensaje
    entry.metadata = metadata

    // 1. Mostrar en consola
    PRINT formatConsole(entry)

    // 2. Guardar en base de datos (auditoría)
    SAVE_TO_DB(entry)

    // 3. Si es ERROR, activar mecanismos de seguridad
    IF severidad == ERROR:
        triggerSafetyProtocol(entry)

END FUNCTION

// ======================================================
//  FORMATEO DE CONSOLA
// ======================================================

FUNCTION formatConsole(entry):

    SWITCH entry.color:
        CASE VERDE: icon = "🟢"
        CASE AMARILLO: icon = "🟡"
        CASE NARANJA: icon = "🟠"
        CASE AZUL: icon = "🔵"
        CASE BLANCO: icon = "⚪️"
        CASE ROJO: icon = "🔴"

    RETURN icon + " " + entry.mensaje

END FUNCTION

// ======================================================
//  PROTOCOLO DE SEGURIDAD PARA ERRORES
// ======================================================

FUNCTION triggerSafetyProtocol(entry):

    IF entry.categoria == INTEGRIDAD_COMPROMETIDA:
        LOCK_HISTORY_TABLE()
        FLAG_RECORD_FOR_REVIEW()

    IF entry.categoria == MONITOREO_DETENIDO:
        NOTIFY_USER("El monitoreo se detuvo inesperadamente.")

    IF entry.categoria == ERROR_CRITICO:
        WRITE_TO_CRASH_LOG(entry)

END FUNCTION

// ======================================================
//  EJEMPLOS DE USO (SEGÚN TU ESTÁNDAR)
// ======================================================

// Inicio del sistema
log(VERDE, SERVICIOS_ACTIVOS, INFO, "DB Inicializada de forma segura")
log(AZUL, PERMISOS_CONCEDIDOS, INFO, "Permisos de ubicación concedidos")

// Evento de geocerca
log(NARANJA, EVENTO_GEOCERCA, EVENT, "Geocerca: ENTRADA detectada")
log(VERDE, OPERACION_EXITOSA, INFO, "Auto‑Checkin registrado")

// Advertencia
log(AMARILLO, GPS_DEBIL, WARN, "Señal GPS débil")

// Error crítico
log(ROJO, ERROR_CRITICO, ERROR, "DB error crítico")

// Integridad comprometida
log(ROJO, INTEGRIDAD_COMPROMETIDA, ERROR, "Checksum mismatch detectado")

// Acción manual
log(AMARILLO, CONFIG_MODIFICADA, WARN, "Registro modificado manualmente")
log(ROJO, ACCION_DESTRUCTIVA, ERROR, "Registro eliminado manualmente")

# SCHEMA (Propuesta) = PENDIENTE
