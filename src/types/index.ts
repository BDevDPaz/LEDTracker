// src/types/index.ts

// Idiomas permitidos
export type Language = 'es' | 'en';

// ✅ Configuración de la App (incluye nuevos campos)
export interface AppSettings {
  id: number;
  employee_name: string;       // Nombre del empleado
  employer_name: string;       // Nombre de la empresa
  company_email: string;       // Email para reportes
  tolerance_radius: number;    // Radio en metros
  hourly_rate: number;         // Tarifa por hora
  language: Language;          // Idioma seleccionado
  start_time: string;          // ⏰ Hora alarma (Ej: "06:00")
  overtime_multiplier: number; // 💰 Multiplicador (1.0, 1.5, 2.0)
}

// ✅ Estructura de una sesión de trabajo
export interface WorkSession {
  id?: number; // Opcional porque al crearla aún no tiene ID
  start_time: number; // Timestamp de inicio
  end_time?: number;  // Timestamp de fin (opcional)
  status: 'active' | 'completed' | 'deleted' | 'travel'; // 🚗 Agregamos 'travel'
  latitude: number;
  longitude: number;
  address: string;
  location_confirmed: 0 | 1; // SQLite usa 0/1 para booleanos
  is_manual_edit: 0 | 1;
  manual_note?: string;
  lunch_taken: 0 | 1; // Indica si se tomó almuerzo
  date_string: string; // Para agrupar por día (YYYY-MM-DD)
}

// ✅ Estructura del log de auditoría
export interface AuditLog {
  id?: number;
  session_id: number;
  action_type: string; // Ej: 'CREATED', 'MODIFIED', 'DELETED'
  details: string;     // Detalles de la acción
  timestamp: number;   // Timestamp del evento
}
