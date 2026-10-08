import { z } from 'zod';
import raw from './public-site.json';

const text = z.string().trim().min(1);
export const publicPageId = z.enum(['about', 'services', 'clinicians', 'help', 'contact']);
const page = z.object({
  eyebrow: text, title: text, intro: text,
  sections: z.array(z.object({ title: text, body: text }).strict()).min(1),
  related: publicPageId, actionLabel: text,
}).strict();
export const publicSiteSchema = z.object({
  status: text, navigationLabel: text, footerLabel: text, homeLabel: text,
  accountLabel: text, backLabel: text, learnLabel: text, contactLabel: text,
  privacyLabel: text, termsLabel: text, securityLabel: text,
  navigation: z.array(z.object({ id: publicPageId, label: text }).strict()).min(1)
    .refine(items => new Set(items.map(item => item.id)).size === items.length),
  pages: z.object({ about: page, services: page, clinicians: page, help: page, contact: page }).strict(),
}).strict();
export const publicSite = publicSiteSchema.parse(raw);
export type PublicPageId = z.infer<typeof publicPageId>;
