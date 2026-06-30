export const translations = {
  es: {
    // --- BOTONES GLOBALES ---
    btn_cancel: "CANCELAR",
    btn_save: "GUARDAR",
    btn_edit: "EDITAR",
    btn_delete: "ELIMINAR",
    btn_close: "CERRAR",
    btn_finished: "TERMINAR",
    btn_moving: "OTRO SITIO",

    // --- HEADER & HOME (Estados del Flujo Maestro) ---
    header_title: "WTracker",
    status_active: "ACTIVO",
    status_inactive: "FUERA DE SERVICIO",
    status_pending: "ESPERANDO LLEGADA", // ✅ Vital para Fase 1
    status_transit: "EN TRÁNSITO",       // ✅ Vital para Fase 4
    status_travel: "EN TRÁNSITO",        // (Compatibilidad)
    
    // --- TARJETA PRINCIPAL (HOME) ---
    label_location: "UBICACIÓN ACTUAL",
    label_destination: "DESTINO CONFIGURADO",
    hint_geofence_active: "Geocerca Activa • Check-in automático al llegar",
    no_activity: "No hay actividad registrada.",
    
    // --- ACCIONES PRINCIPALES ---
    btn_clock_out: "TERMINAR JORNADA",
    btn_new_job: "INICIAR JORNADA",
    
    // --- ESTADÍSTICAS ---
    stats_hours: "HORAS",
    stats_earnings: "GANANCIA EST.",
    
    // --- MODAL CONFIGURACIÓN (DAILY SETUP & TRÁNSITO) ---
    modal_title_start: "INICIAR JORNADA",
    modal_subtitle_start: "Configura tu primer ubicación del día",
    modal_title_transit: "NUEVO DESTINO",
    modal_subtitle_transit: "Rumbo al siguiente trabajo",
    
    // ✅ Inputs Nuevos (Requeridos por el nuevo Modal)
    input_address: "Dirección del trabajo",
    input_client: "Cliente (Opcional)",
    input_notes: "Notas (Opcional)",
    
    daily_placeholder: "Ej: 1234 Ejemplo Ave...", // (Compatibilidad)
    
    btn_activate_geofence: "ACTIVAR GEOCERCA",
    btn_start_transit: "INICIAR TRAYECTO",
    
    // --- MODAL ALMUERZO ---
    lunch_title: "¿TOMASTE ALMUERZO?",
    lunch_subtitle: "Deducción automática de tiempo",
    lunch_yes_30: "SÍ (30 MIN)",
    lunch_yes_60: "SÍ (60 MIN)",
    lunch_no: "NO TOMÉ",
    status_lunch_taken: "🍴 Almuerzo 🍴",
    
    // --- ALERTAS Y NOTIFICACIONES ---
    alert_exit_title: "📍 Saliste del Área",
    alert_exit_msg: "¿Terminaste tu jornada o vas a otro sitio?",
    alert_location_needed: "Se requiere ubicación precisa",
    alert_address_not_found: "Dirección no encontrada",
    
    toast_geofence_active: "Geocerca Activada. Ve al sitio.",
    toast_transit_started: "Tránsito iniciado.",
    toast_shift_ended: "Jornada finalizada.",
    toast_error_generic: "Ocurrió un error.",

    // --- REPORTES Y PDF (NUEVO) ---
    report_title: "REPORTE SEMANAL",
    report_subtitle: "NÓMINA Y AUDITORÍA",
    card_ready_title: "Listo para Generar",
    card_ready_desc: "Genera un PDF oficial con desglose de horas, clientes, notas y auditoría GPS.",
    btn_download_pdf: "DESCARGAR PDF",
    btn_send_email: "ENVIAR POR EMAIL",
    report_footer_note: "* Al enviar, se abrirá tu aplicación de correo predeterminada.",
    
    // --- HISTORIAL (COMPATIBILIDAD) ---
    history_title: "Historial",
    col_date: "Fecha",
    col_loc: "Ubicación",
    col_in: "Entrada",
    col_out: "Salida",
    
    // --- CONFIGURACIÓN & ADMIN (COMPATIBILIDAD) ---
    settings_title: "CONFIGURACIÓN",
    settings_general: "GENERAL",
    settings_save: "GUARDAR CAMBIOS",
    
    label_lang: "Idioma / Language",
    label_name: "Nombre Empleado",
    label_rate: "Tarifa por Hora ($)",
    label_start_time: "Hora Recordatorio Diario (HH:MM)",
    label_multiplier: "Multiplicador Tiempo Extra (x)",
    label_company_name: "Nombre Empresa",
    label_report_email: "Email Reportes",
    label_radius: "Radio Tolerancia (mts)",
    
    admin_zone: "ZONA ADMIN",
    admin_unlock: "Desbloquear",
    admin_pin_placeholder: "PIN de Acceso Admin",
    admin_locked_msg: "Configuración de empresa bloqueada.",
    err_pin_wrong: "PIN incorrecto",

    // --- AUDITORÍA PDF ---
    pdf_audit_title: "AUDITORÍA DE INTEGRIDAD DE DATOS",
    log_auto_exit: "Salida Automática por distancia",
    log_auto_entry: "Entrada Automática"
  },
  
  en: {
    // --- GLOBAL BUTTONS ---
    btn_cancel: "CANCEL",
    btn_save: "SAVE",
    btn_edit: "EDIT",
    btn_delete: "DELETE",
    btn_close: "CLOSE",
    btn_finished: "FINISHED",
    btn_moving: "MOVING",

    // --- HEADER & HOME ---
    header_title: "WTracker",
    status_active: "ACTIVE",
    status_inactive: "OFF DUTY",
    status_pending: "AWAITING ARRIVAL",
    status_transit: "IN TRANSIT",
    status_travel: "IN TRANSIT",
    
    // --- MAIN CARD ---
    label_location: "CURRENT LOCATION",
    label_destination: "TARGET DESTINATION",
    hint_geofence_active: "Geofence Active • Auto check-in on arrival",
    no_activity: "No active session.",
    
    // --- MAIN ACTIONS ---
    btn_clock_out: "CLOCK OUT",
    btn_new_job: "START SHIFT",
    
    // --- STATS ---
    stats_hours: "HOURS",
    stats_earnings: "EST. EARNINGS",
    
    // --- SETUP MODAL ---
    modal_title_start: "START SHIFT",
    modal_subtitle_start: "Set up your first location",
    modal_title_transit: "NEW DESTINATION",
    modal_subtitle_transit: "Heading to next job",
    
    input_address: "Job Address",
    input_client: "Client (Optional)",
    input_notes: "Notes (Optional)",
    
    daily_placeholder: "Ex: 1234 Example Ave...",
    
    btn_activate_geofence: "ACTIVATE GEOFENCE",
    btn_start_transit: "START TRANSIT",
    
    // --- LUNCH MODAL ---
    lunch_title: "DID YOU TAKE LUNCH?",
    lunch_subtitle: "Automatic time deduction",
    lunch_yes_30: "YES (30 MIN)",
    lunch_yes_60: "YES (60 MIN)",
    lunch_no: "NO LUNCH",
    status_lunch_taken: "🍴 Lunch Taken 🍴",
    
    // --- ALERTS ---
    alert_exit_title: "📍 Left Work Area",
    alert_exit_msg: "Did you finish your shift or are you moving?",
    alert_location_needed: "Precise location required",
    alert_address_not_found: "Address not found",
    
    toast_geofence_active: "Geofence Active. Go to site.",
    toast_transit_started: "Transit started.",
    toast_shift_ended: "Shift ended successfully.",
    toast_error_generic: "An error occurred.",

    // --- REPORTS ---
    report_title: "WEEKLY REPORT",
    report_subtitle: "PAYROLL & AUDIT",
    card_ready_title: "Ready to Generate",
    card_ready_desc: "Generate official PDF with hours breakdown, clients, notes, and GPS audit.",
    btn_download_pdf: "DOWNLOAD PDF",
    btn_send_email: "SEND BY EMAIL",
    report_footer_note: "* Sending will open your default email app.",
    
    // --- HISTORY ---
    history_title: "History",
    col_date: "Date",
    col_loc: "Location",
    col_in: "In",
    col_out: "Out",
    
    // --- SETTINGS & ADMIN ---
    settings_title: "SETTINGS",
    settings_general: "GENERAL",
    settings_save: "SAVE CHANGES",
    
    label_lang: "Language / Idioma",
    label_name: "Employee Name",
    label_rate: "Hourly Rate ($)",
    label_start_time: "Daily Reminder Time (HH:MM)",
    label_multiplier: "Overtime Multiplier (x)",
    label_company_name: "Company Name",
    label_report_email: "Report Email",
    label_radius: "Tolerance Radius (m)",
    
    admin_zone: "ADMIN ZONE",
    admin_unlock: "Unlock",
    admin_pin_placeholder: "Admin PIN",
    admin_locked_msg: "Company settings locked.",
    err_pin_wrong: "Incorrect PIN",

    // --- AUDIT PDF ---
    pdf_audit_title: "DATA INTEGRITY AUDIT LOG",
    log_auto_exit: "Auto-Checkout by distance",
    log_auto_entry: "Auto Check-in"
  }
};
