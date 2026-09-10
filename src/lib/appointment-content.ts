import { z } from 'zod';
import source from '@/content/appointment-actions.json';

const text = z.string().trim().min(1);
export const appointmentActionContent = z.object({
  cancelConfirmation: text, cancelledTitle: text, cancelledDescription: text,
  errorTitle: text, cancelFailed: text, checkInFailed: text,
}).parse(source);
