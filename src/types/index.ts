// src/types/index.ts

export interface AppSettings {
  id: number;
  employee_name: string;
  employer_name: string;
  company_email: string;
  tolerance_radius: number;
  hourly_rate: number;
  language: 'es' | 'en';
  start_time: string;
  overtime_multiplier: number;
}

export interface WorkSession {
  id?: number;
  start_time: number;
  end_time?: number;
  status: 'active' | 'completed' | 'travel' | 'deleted';
  latitude: number;
  longitude: number;
  address: string;
  location_confirmed: number;
  is_manual_edit: number;
  manual_note?: string;
  // ✅ CAMPOS ACTUALIZADOS
  lunch_taken: number; // 0 o 1 (Retrocompatibilidad)
  lunch_start?: number; // Timestamp inicio almuerzo
  lunch_end?: number;   // Timestamp fin almuerzo
  date_string: string;
}

export interface AuditLog {
  id?: number;
  session_id: number;
  action_type: string;
  details: string;
  timestamp: number;
}
