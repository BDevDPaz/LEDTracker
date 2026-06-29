import { z } from 'zod';

export const dailySetupSchema = z.object({
  address: z.string().trim().min(5, { message: 'Dirección muy corta' }),
  client: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const lunchSchema = z.object({
  minutes: z.coerce.number().int().min(0).max(480, { message: 'Duración inválida' }),
});

export const historyEditSchema = z.object({
  timeIn: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Formato HH:MM requerido' }),
  timeOut: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Formato HH:MM requerido' }).optional().or(z.literal('')),
  note: z.string().trim().min(3, { message: 'La nota es obligatoria para auditoría' }),
}).refine((data) => {
  if (!data.timeOut) return true;
  const [hIn, mIn] = data.timeIn.split(':').map(Number);
  const [hOut, mOut] = data.timeOut.split(':').map(Number);
  const totalIn = hIn * 60 + mIn;
  const totalOut = hOut * 60 + mOut;
  return totalOut > totalIn;
}, {
  message: 'La hora de salida debe ser después de la entrada',
  path: ['timeOut'],
});

export type DailySetupInput = z.infer<typeof dailySetupSchema>;
export type LunchInput = z.infer<typeof lunchSchema>;
export type HistoryEditInput = z.infer<typeof historyEditSchema>;
