// src/utils/i18n.ts
export const translations = {
  es: {
    // --- BOTONES Y GLOBAL ---
    btn_cancel: "Cancelar",
    btn_save: "Guardar",
    btn_edit: "Editar",
    btn_delete: "Eliminar",
    btn_close: "Cerrar",

    // --- HEADER & HOME ---
    header_title: "WorkTracker",
    status_active: "🟢 TRABAJANDO EN:",
    status_inactive: "🔴 FUERA DE SERVICIO",
    status_travel: "🚗 EN TRÁNSITO", // ✅ Nuevo
    no_activity: "No hay actividad registrada.",
    btn_clock_out: "MARCAR SALIDA",
    stats_hours: "Horas Hoy",
    stats_earnings: "Ganancia Est.",
    btn_new_job: "📍 NUEVO TRABAJO",

    // --- DAILY SETUP ---
    daily_title: "Configuración Diaria",
    daily_label: "¿Dónde trabajarás hoy?",
    daily_placeholder: "Ej: 5601 Balboa Blvd...",
    daily_btn_start: "Iniciar Jornada",

    // --- HISTORIAL & PDF ---
    history_title: "Historial",
    btn_pdf: "📄 PDF",
    pdf_title: "REPORTE DE HORAS",
    pdf_employee: "Empleado",
    col_date: "Fecha",
    col_loc: "Ubicación",
    col_in: "Entrada",
    col_out: "Salida",

    // --- SETTINGS & ADMIN ---
    settings_title: "Configuración",
    label_lang: "Idioma / Language",
    label_name: "Nombre Empleado",
    label_rate: "Tarifa por Hora ($)",
    label_start_time: "Hora Recordatorio Diario (HH:MM)", // ✅ Nuevo
    label_multiplier: "Multiplicador Tiempo Extra (x)",    // ✅ Nuevo
    admin_zone: "🔒 ZONA ADMIN",
    admin_unlock: "Desbloquear",
    admin_pass_placeholder: "Contraseña Admin",
    admin_locked_msg: "Configuración de empresa bloqueada.",
    label_company_name: "Nombre Empresa",
    label_report_email: "Email Reportes",
    label_radius: "Radio Tolerancia (mts)",

    // --- ERRORES & LOGS ---
    err_pass_wrong: "Contraseña incorrecta",
    err_out_of_range: "Fuera de Rango",
    msg_out_of_range: "Estás muy lejos del sitio.",
    log_auto_exit: "Salida Automática por distancia",
    log_auto_entry: "Entrada Automática",
    log_lunch_taken: "Deducción de almuerzo aplicada", // ✅ Nuevo

    // --- AUDITORÍA ---
    pdf_audit_title: "AUDITORÍA DE INTEGRIDAD DE DATOS",
    pdf_audit_msg: "A continuación se detallan las modificaciones o eliminaciones realizadas manualmente:",
    col_ts: "Timestamp",
    col_action: "Acción",
    col_details: "Detalles",

    // --- ALMUERZO ---
    lunch_title: "Hora de Almuerzo",
    lunch_msg: "¿Vas a tomar tu descanso hoy?",
    lunch_sub: "(Se descontará 1 hora del total)",
    lunch_yes: "SÍ, DESCONTAR",
    lunch_no: "NO",
    status_lunch_taken: "✅ Almuerzo (-1h)",

    // --- NUEVO PARA TRÁNSITO ---
    transit_msg: "Tránsito entre sitios",
    alert_exit_title: "Salida Detectada 🛑",
    alert_exit_msg: "¿Terminaste tu día o vas a otro sitio?",
    btn_finished: "Terminé por hoy",
    btn_moving: "Voy a otro sitio (Pagado)"
  },

  en: {
    // --- BUTTONS & GLOBAL ---
    btn_cancel: "Cancel",
    btn_save: "Save",
    btn_edit: "Edit",
    btn_delete: "Delete",
    btn_close: "Close",

    // --- HEADER & HOME ---
    header_title: "WorkTracker",
    status_active: "🟢 WORKING AT:",
    status_inactive: "🔴 OFF DUTY",
    status_travel: "🚗 IN TRANSIT", // ✅ Nuevo
    no_activity: "No active session.",
    btn_clock_out: "CLOCK OUT",
    stats_hours: "Hours Today",
    stats_earnings: "Est. Earnings",
    btn_new_job: "📍 NEW JOB",

    // --- DAILY SETUP ---
    daily_title: "Daily Setup",
    daily_label: "Where are you working today?",
    daily_placeholder: "Ex: 5601 Balboa Blvd...",
    daily_btn_start: "Start Work",

    // --- HISTORY & PDF ---
    history_title: "History",
    btn_pdf: "📄 PDF",
    pdf_title: "HOURS REPORT",
    pdf_employee: "Employee",
    col_date: "Date",
    col_loc: "Location",
    col_in: "In",
    col_out: "Out",

    // --- SETTINGS & ADMIN ---
    settings_title: "Settings",
    label_lang: "Language / Idioma",
    label_name: "Employee Name",
    label_rate: "Hourly Rate ($)",
    label_start_time: "Daily Reminder Time (HH:MM)", // ✅ Nuevo
    label_multiplier: "Overtime Multiplier (x)",      // ✅ Nuevo
    admin_zone: "🔒 ADMIN ZONE",
    admin_unlock: "Unlock",
    admin_pass_placeholder: "Admin Password",
    admin_locked_msg: "Company settings locked.",
    label_company_name: "Company Name",
    label_report_email: "Report Email",
    label_radius: "Tolerance Radius (m)",

    // --- ERRORS & LOGS ---
    err_pass_wrong: "Incorrect password",
    err_out_of_range: "Out of Range",
    msg_out_of_range: "You are too far from the site.",
    log_auto_exit: "Auto-Checkout by distance",
    log_auto_entry: "Auto Check-in",
    log_lunch_taken: "Lunch deduction applied", // ✅ Nuevo

    // --- AUDIT ---
    pdf_audit_title: "DATA INTEGRITY AUDIT LOG",
    pdf_audit_msg: "Below are manual modifications or deletions performed on the original records:",
    col_ts: "Timestamp",
    col_action: "Action",
    col_details: "Details",

    // --- LUNCH ---
    lunch_title: "Lunch Break",
    lunch_msg: "Are you taking your break today?",
    lunch_sub: "(1 hour will be deducted)",
    lunch_yes: "YES, DEDUCT",
    lunch_no: "NO",
    status_lunch_taken: "✅ Lunch Taken (-1h)",

    // --- TRANSIT ---
    transit_msg: "Transit between sites",
    alert_exit_title: "Exit Detected 🛑",
    alert_exit_msg: "Finished for the day or moving to another site?",
    btn_finished: "Finished today",
    btn_moving: "Going to another site (Paid)"
  }
};
