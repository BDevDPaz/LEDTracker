
// Definición de idiomas soportados
export type Language = 'es' | 'en';

// Definición de las rutas para Expo Router
export type RootTabParamList = {
  index: undefined;
  history: undefined;
  settings: undefined;
  report: undefined;
};

// Configuración de la App
export interface AppSettings {
  id: number;
  employee_name: string;
  employer_name: string;
  company_email: string;
  tolerance_radius: number;
  hourly_rate: number;
  language: Language;
  start_time: string;
  overtime_multiplier: number;
}

// ✅ CAMBIO: Agregamos 'pending_arrival'
export type SessionStatus = 'pending_arrival' | 'active' | 'travel' | 'completed' | 'deleted';

// Estructura de una Sesión de Trabajo
export interface WorkSession {
  id?: number;
  start_time: number;         // Hora de configuración (si es pending) o inicio
  actual_start_time?: number; // ✅ Hora real de llegada (Check-in GPS)
  end_time?: number;
  status: SessionStatus;

  // Coordenadas
  latitude: number;
  longitude: number;

  // Datos de Auditoría y Geocerca
  target_latitude?: number;   // Destino
  target_longitude?: number;  // Destino
  setup_latitude?: number;    // Donde se configuró
  setup_longitude?: number;   // Donde se configuró

  address: string;
  client_name?: string;       // ✅ Nuevo: Nombre del Cliente

  location_confirmed: number;
  is_manual_edit: number;
  manual_note?: string;       // ✅ Usado para "Notas"

  lunch_taken: number;
  lunch_start?: number;
  lunch_end?: number;
  date_string: string;
}

// Logs de Auditoría para el Reporte
export interface AuditLog {
  id?: number;
  session_id: number;
  action_type: string;
  details: string;
  timestamp: number;
}

// ======================================================
// W-TRACKER LOGGER - ESTÁNDAR OFICIAL DE TIPOS
// ======================================================

export type LogColor = 'VERDE' | 'AMARILLO' | 'NARANJA' | 'AZUL' | 'BLANCO' | 'ROJO';

export type LogCategory = 
  | 'OPERACION_EXITOSA' 
  | 'SERVICIOS_ACTIVOS' 
  | 'INTEGRIDAD_OK' 
  | 'ADVERTENCIA' 
  | 'CONFIG_MODIFICADA' 
  | 'GPS_DEBIL' 
  | 'EVENTO_GEOCERCA' 
  | 'REINICIO_MONITOREO' 
  | 'MODOS_ESPECIALES' 
  | 'PERMISOS_CONCEDIDOS' 
  | 'ESTADO_SISTEMA' 
  | 'BACKGROUND_TASK' 
  | 'SIN_CAMBIOS' 
  | 'ERROR_CRITICO' 
  | 'INTEGRIDAD_COMPROMETIDA' 
  | 'ACCION_DESTRUCTIVA' 
  | 'MONITOREO_DETENIDO';

export type LogSeverity = 'INFO' | 'WARN' | 'EVENT' | 'DEBUG' | 'ERROR';

export interface LogMetadata {
  sessionId?: number;
  userId?: string;
  duration?: number; // ms
  geoAccuracy?: number;
  errorCode?: string;
  stackTrace?: string;
  [key: string]: any;
}

export interface SystemLogEntry {
  id?: number;
  timestamp: number;
  timestamp_str: string;
  color: LogColor;
  categoria: LogCategory;
  severidad: LogSeverity;
  mensaje: string;
  metadata?: string;
}
