import { z } from 'zod';
import raw from './public-site-routing.json';

const path = z.string().regex(/^\/[a-z0-9-]+$/);
export const publicSiteRoutingSchema = z.object({
  about: path, services: path, clinicians: path, help: path, contact: path,
}).strict().refine(routes => new Set(Object.values(routes)).size === Object.keys(routes).length);
export const publicSiteRoutes = publicSiteRoutingSchema.parse(raw);
