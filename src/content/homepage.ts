import { z } from 'zod';
import raw from './homepage.json';
const text = z.string().trim().min(1);
const intro = { eyebrow: text, title: text, body: text };
const item = z.object({ title: text, body: text }).strict();
export const homepageSchema = z.object({
  steps: z.object({ ...intro, items: z.array(item).length(3) }).strict(),
  services: z.object({ ...intro, action: text }).strict(),
  clinicians: z.object({ ...intro, action: text }).strict(),
  trust: z.object({ ...intro, items: z.array(item).length(3), privacyAction: text, securityAction: text }).strict(),
  faq: z.object({ eyebrow: text, title: text, items: z.array(z.object({ question: text, answer: text }).strict()).min(4)
    .refine(items => new Set(items.map(item => item.question)).size === items.length) }).strict(),
  closing: z.object({ ...intro, primaryAction: text, secondaryAction: text }).strict(),
}).strict();
export const homepage = homepageSchema.parse(raw);
