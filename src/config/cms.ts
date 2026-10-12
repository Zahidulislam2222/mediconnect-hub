import { z } from 'zod';
import content from '@/content/cms-content.json';
export const cmsContent = z.object({
  collectionPath: z.string().regex(/^\/api\/[a-z-]+$/),
  idPrefix: z.string().regex(/^[a-z]+:$/),
  clinicalIdPrefix: z.string().regex(/^[a-z]+:$/),
  pageSize: z.number().int().positive(), maxPages: z.number().int().positive(),
  fallbackCategory: z.string().min(1), sourceLabel: z.string().min(1),
  authorName: z.string().min(1), authorRole: z.string().min(1),
  unavailableMediaLabel: z.string().min(1),
  mediaMimeTypes: z.array(z.string().regex(/^image\/[a-z0-9.+-]+$/)).min(1),
  mediaMaxBytes: z.number().int().positive(),
}).strict().refine(value => value.idPrefix !== value.clinicalIdPrefix).parse(content);
