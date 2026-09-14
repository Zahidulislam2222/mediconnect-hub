import { z } from 'zod';
import source from './legal.json';

const pageSchema = z.object({
  title: z.string().min(1),
  sections: z.array(z.object({ title: z.string().min(1), body: z.string().min(1) })).min(1),
  sources: z.array(z.object({ label: z.string().min(1), url: z.string().url().startsWith('https://') })),
});
export const legalContent = z.object({
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  brand: z.string().min(1),
  backLabel: z.string().min(1),
  notice: z.string().min(1),
  pages: z.object({ privacy: pageSchema, security: pageSchema, terms: pageSchema }),
}).parse(source);
