import { z } from 'zod';
import { cmsApi } from '@/lib/api';
import { optionalCmsUrl } from '@/config/env';
import { cmsContent } from '@/config/cms';
import { CMS_UPLOAD_PATH_PREFIX, CMS_WEB_LINK_PROTOCOLS } from '@/lib/cms-protocol';

export type CmsNode = { type: string; text?: string; children?: CmsNode[]; bold?: boolean; italic?: boolean;
  underline?: boolean; strikethrough?: boolean; code?: boolean; level?: number; format?: string; url?: string;
  image?: { url?: string; alternativeText?: string } };
const node: z.ZodType<CmsNode, z.ZodTypeDef, unknown> = z.lazy(() => z.object({
  type: z.enum(['text', 'paragraph', 'heading', 'list', 'list-item', 'link', 'quote', 'code', 'image']),
  text: z.string().optional(), children: z.array(node).optional(),
  bold: z.boolean().optional(), italic: z.boolean().optional(), underline: z.boolean().optional(),
  strikethrough: z.boolean().optional(), code: z.boolean().optional(), level: z.number().int().min(1).max(6).optional(),
  format: z.enum(['ordered', 'unordered']).optional(), url: z.string().optional(),
  image: z.object({ url: z.string(), alternativeText: z.string().nullable().optional() }).optional(),
}).passthrough().refine(value => value.type !== 'text' || typeof value.text === 'string')
  .refine(value => value.type !== 'image' || !!value.image?.url)
  .refine(value => value.type !== 'link' || !!value.url)
  .transform(value => ({ ...value, type: value.type })));
const document = z.object({
  documentId: z.string().regex(/^[A-Za-z0-9_-]+$/), title: z.string().trim().min(1),
  category: z.string().nullable().optional(), content: z.array(node),
  publishedAt: z.string().datetime({ offset: true }),
  coverImage: z.array(z.object({ url: z.string() }).passthrough()).nullable().optional(),
}).passthrough();
const pageEnvelope = z.object({ data: z.array(document), meta: z.object({ pagination: z.object({
  page: z.number().int().positive(), pageCount: z.number().int().nonnegative(),
}).passthrough() }).passthrough() });

function mediaUrl(raw: string, base: string): string {
  const decoded = decodeURIComponent(raw.split('?')[0]);
  if (decoded.includes('\\') || decoded.split('/').some(part => part === '..' || part === '.')) throw new Error('INVALID_CMS_MEDIA');
  const url = new URL(raw, base);
  if (url.origin !== new URL(base).origin || url.username || url.password || !url.pathname.startsWith(CMS_UPLOAD_PATH_PREFIX)) throw new Error('INVALID_CMS_MEDIA');
  return url.href;
}
function normalizeNode(value: CmsNode, base: string): CmsNode {
  const normalized = { ...value, children: value.children?.map(child => normalizeNode(child, base)) };
  if (value.image?.url) normalized.image = { ...value.image, url: mediaUrl(value.image.url, base) };
  if (value.type === 'link') {
    const url = new URL(value.url, base);
    if (!CMS_WEB_LINK_PROTOCOLS.some(protocol => protocol === url.protocol) || url.username || url.password) throw new Error('INVALID_CMS_LINK');
    normalized.url = url.href;
  }
  return normalized;
}
function normalize(item: z.infer<typeof document>, base: string) {
  const content = item.content.map(value => normalizeNode(value, base));
  const coverImages: string[] = [];
  let unavailableCoverCount = 0;
  for (const value of item.coverImage ?? []) {
    try { coverImages.push(mediaUrl(value.url, base)); }
    catch { unavailableCoverCount++; }
  }
  return {
    id: cmsContent.idPrefix + item.documentId, title: item.title, description: item.title,
    category: item.category || cmsContent.fallbackCategory,
    legacyData: { category: item.category || cmsContent.fallbackCategory, content },
    content, coverImage: coverImages[0] ?? null, coverImages, unavailableCoverCount,
    date: item.publishedAt, _sourceCms: true as const, _sourceRegion: 'CMS',
  };
}
export async function fetchCmsArticles(signal?: AbortSignal) {
  const base = optionalCmsUrl();
  if (!base) return [];
  const found: ReturnType<typeof normalize>[] = [];
  const ids = new Set<string>();
  let pages = 1;
  for (let page = 1; page <= pages; page++) {
    const query = new URLSearchParams({ status: 'published', 'populate[coverImage][fields][0]': 'url',
      'pagination[page]': String(page), 'pagination[pageSize]': String(cmsContent.pageSize) });
    const result = pageEnvelope.parse(await cmsApi.get(cmsContent.collectionPath + '?' + query.toString(), { signal }));
    const pagination = result.meta.pagination;
    if (pagination.page !== page || pagination.pageCount > cmsContent.maxPages ||
        (page > 1 && pagination.pageCount !== pages) || (!pagination.pageCount && result.data.length)) throw new Error('INVALID_CMS_PAGINATION');
    pages = pagination.pageCount;
    for (const item of result.data) {
      if (ids.has(item.documentId)) throw new Error('DUPLICATE_CMS_DOCUMENT');
      ids.add(item.documentId); found.push(normalize(item, base));
    }
  }
  return found;
}
export async function fetchCmsArticle(id: string, signal?: AbortSignal) {
  const base = optionalCmsUrl();
  if (!base || !id.startsWith(cmsContent.idPrefix)) throw new Error('INVALID_CMS_DOCUMENT');
  const documentId = id.slice(cmsContent.idPrefix.length);
  if (!/^[A-Za-z0-9_-]+$/.test(documentId)) throw new Error('INVALID_CMS_DOCUMENT');
  const query = new URLSearchParams({ status: 'published', 'populate[coverImage][fields][0]': 'url' });
  const result = z.object({ data: document }).parse(await cmsApi.get(cmsContent.collectionPath + '/' + encodeURIComponent(documentId) + '?' + query.toString(), { signal }));
  if (result.data.documentId !== documentId) throw new Error('CMS_DOCUMENT_MISMATCH');
  return normalize(result.data, base);
}
