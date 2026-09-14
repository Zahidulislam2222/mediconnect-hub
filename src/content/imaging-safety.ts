import { z } from 'zod';
import data from './imaging-safety.json';

const text = z.string().trim().min(1);
const schema = z.object({
  unavailableTitle: text, unavailableDescription: text, draftTitle: text,
  draftDescription: text, draftBadge: text, uploadDescription: text,
  emptyDescription: text, prompt: text,
  downloadLabel: text, downloadTitle: text, downloadDescription: text,
  downloadFilenamePrefix: z.string().regex(/^[A-Za-z0-9_-]+$/),
}).strict();

export default schema.parse(data);
