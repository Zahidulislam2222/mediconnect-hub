import { cmsContent } from '@/config/cms';

/** Preserve existing clinician routes; escape only reserved source prefixes. */
export function clinicalArticleRouteId(id: string): string {
  return id.startsWith(cmsContent.idPrefix) || id.startsWith(cmsContent.clinicalIdPrefix)
    ? cmsContent.clinicalIdPrefix + id : id;
}

export function articleRouteSource(id: string): { source: 'clinical' | 'cms'; id: string } {
  if (id.startsWith(cmsContent.clinicalIdPrefix)) return { source: 'clinical', id: id.slice(cmsContent.clinicalIdPrefix.length) };
  return { source: id.startsWith(cmsContent.idPrefix) ? 'cms' : 'clinical', id };
}
