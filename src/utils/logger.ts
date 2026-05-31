// --- src/utils/logger.ts ---
import * as SQLite from 'expo-sqlite';
import { LogColor, LogCategory, LogSeverity, SystemLogEntry } from '../types';

// Cola de logs temporal para cuando la DB aún no está inicializada
const logQueue: SystemLogEntry[] = [];
let dbInstance: SQLite.SQLiteDatabase | null = null;

// Vincula la DB al logger y procesa los pendientes
export const setLoggerDB = (db: SQLite.SQLiteDatabase) => {
  dbInstance = db;
  flushLogQueue();
};

const flushLogQueue = async () => {
  if (!dbInstance) return;
  while (logQueue.length > 0) {
    const entry = logQueue.shift();
    if (entry) await saveToDb(entry);
  }
};

const saveToDb = async (entry: SystemLogEntry) => {
  if (!dbInstance) return;
  try {
    await dbInstance.runAsync(
      "INSERT INTO system_logs (timestamp, timestamp_str, color, categoria, severidad, mensaje, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [entry.timestamp, entry.timestamp_str, entry.color, entry.categoria, entry.severidad, entry.mensaje, entry.metadata || null]
    );
  } catch (e) {
    // Aquí sí queremos un console.error real porque falló la propia auditoría
    console.error("❌ Fallo crítico al guardar log en DB de auditoría:", e);
  }
};

export const log = (
  color: LogColor,
  categoria: LogCategory,
  severidad: LogSeverity,
  mensaje: string,
  metadata?: any
) => {
  const now = new Date();
  const timestamp = now.getTime();
  const timestamp_str = now.toISOString();

  const entry: SystemLogEntry = {
    timestamp,
    timestamp_str,
    color,
    categoria,
    severidad,
    mensaje,
    metadata: metadata ? JSON.stringify(metadata, Object.getOwnPropertyNames(metadata)) : undefined
  };

  // Asignar el icono correspondiente al color
  let icon = '';
  switch (color) {
    case 'VERDE': icon = '🟢'; break;
    case 'AMARILLO': icon = '🟡'; break;
    case 'NARANJA': icon = '🟠'; break;
    case 'AZUL': icon = '🔵'; break;
    case 'BLANCO': icon = '⚪️'; break;
    case 'ROJO': icon = '🔴'; break;
  }

  // Imprimir en consola con la marca de tiempo (timestamp)
  const consoleMsg = `[${timestamp_str}] ${icon} [${categoria}] ${mensaje}`;

  // ✅ CORRECCIÓN: Evita la Pantalla Roja de Expo para eventos de auditoría (como borrar un registro).
  // Solo lanza un console.error si realmente estamos pasando un objeto de Error real al metadata.
  if (severidad === 'ERROR' && metadata instanceof Error) {
    console.error(consoleMsg, metadata);
  } else if (severidad === 'WARN') {
    console.warn(consoleMsg, metadata || '');
  } else {
    // Usamos console.log para todo lo demás, preservando tus colores e iconos, 
    // pero sin interrumpir el uso de la aplicación.
    console.log(consoleMsg, metadata || '');
  }

  // Guardar en la DB o mandar a la cola si la DB no está lista
  if (dbInstance) {
    saveToDb(entry);
  } else {
    logQueue.push(entry);
  }
};

