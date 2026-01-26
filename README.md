# LEDTracker V2.1 (Gold Master) 🛡️📍

Aplicación profesional de rastreo de horas laborales y ubicación GPS para Android, diseñada con estándares de auditoría forense y lógica multi-sitio.

## 🚀 Características Principales

### 1. Rastreo GPS de Alta Precisión
- **Auto Check-Out:** Detección automática de salida del perímetro laboral (Geofencing inverso).
- **Background Tracking:** Rastreo persistente en segundo plano optimizado para batería.

### 2. Gestión de Nómina y Tiempo
- **Cálculo de Overtime:** Soporte configurable para multiplicadores de horas extra (1.5x, 2.0x).
- **Modo Tránsito (Travel Time):** Registro de tiempos de traslado entre sitios como horas pagadas.
- **Deducción de Almuerzo:** Lógica automática de descuento (-1h) con confirmación del usuario.

### 3. Sistema de Auditoría Forense (Anti-Fraude) 🕵️‍♂️
- **Logs Inmutables:** Cada edición, borrado o modificación manual queda registrada en una base de datos de auditoría.
- **Reportes PDF Certificados:** Generación de reportes semanales que incluyen una sección de "Integridad de Datos" mostrando cualquier manipulación manual.

### 4. Experiencia de Usuario (UX)
- **Recordatorios Inteligentes:** Notificaciones diarias con opción de "Posponer" (Snooze).
- **Interfaz Nativa:** Iconos adaptativos y Splash Screen personalizada.
- **Multi-Idioma:** Soporte completo Español/Inglés en tiempo real.

## 🛠️ Stack Tecnológico
- **Core:** React Native (Expo SDK 52)
- **Lenguaje:** TypeScript (Strict Mode)
- **Base de Datos:** SQLite (Modo WAL para alto rendimiento)
- **Servicios:** Expo Location, Expo TaskManager, Expo Notifications.

## 📱 Compilación
Este proyecto está optimizado para EAS Build (Android).

```bash
eas build -p android --profile preview
```

---
**Desarrollado por:** Byron De Paz (BDevDPaz)
**Licencia:** Privada / Propietaria
