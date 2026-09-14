import { z } from 'zod';
import source from '@/content/symptom-safety.json';

const text = z.string().trim().min(1);
export const symptomContent = z.object({
  welcome: text, unavailableTitle: text, unavailable: text, serviceLabel: text,
  inputLabel: text, sendLabel: text, unverifiedStatus: text, reportLabel: text,
  logoutFailed: text, defaultUserName: text, pageTitle: text, title: text,
  downloadLabel: text, loadingLabel: text, placeholder: text,
}).strict().parse(source);
