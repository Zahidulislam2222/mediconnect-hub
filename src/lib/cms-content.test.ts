import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn(), base: vi.fn(() => 'https://cms.example.test') }));
vi.mock('@/lib/api', () => ({ cmsApi: { get: mocks.get } }));
vi.mock('@/config/env', () => ({ optionalCmsUrl: mocks.base }));
import { fetchCmsArticles, fetchCmsArticle } from './cms-content';
const article = (id = 'test-document') => ({ documentId: id, title: 'Editorial fixture', category: 'Wellness',
  content: [{ type: 'paragraph', children: [{ type: 'text', text: '<script>fixture text</script>' }] }],
  coverImage: [{ url: '/uploads/test-cover.png' }], publishedAt: '2025-01-01T00:00:00.000Z' });
beforeEach(() => { vi.clearAllMocks(); mocks.base.mockReturnValue('https://cms.example.test'); mocks.get.mockResolvedValue({ data: [article()], meta: { pagination: { page: 1, pageCount: 1 } } }); });
it('namespaces published editorial IDs and uses only configured local media', async () => {
  const [item] = await fetchCmsArticles();
  expect(item.id).toBe('cms:test-document'); expect(item.coverImage).toBe('https://cms.example.test/uploads/test-cover.png');
  expect(item.legacyData.content[0].children[0].text).toBe('<script>fixture text</script>'); expect(item._sourceCms).toBe(true);
  expect(mocks.get.mock.calls[0][0]).toContain('status=published');
});
it('makes no request when CMS is unconfigured', async () => { mocks.base.mockReturnValue(undefined as unknown as string); expect(await fetchCmsArticles()).toEqual([]); expect(mocks.get).not.toHaveBeenCalled(); });
it('rejects drafts, malformed IDs and foreign or traversal media', async () => {
  for (const change of [{ publishedAt: null }, { documentId: '../other' }]) {
    mocks.get.mockResolvedValue({ data: [{ ...article(), ...change }], meta: { pagination: { page: 1, pageCount: 1 } } });
    await expect(fetchCmsArticles()).rejects.toThrow();
  }
});
it('rejects unavailable or foreign covers individually while preserving the article and valid local media', async () => {
  mocks.get.mockResolvedValue({ data: [{ ...article(), coverImage: [{ url: '/uploads/test-cover.png' },
    { url: 'https://foreign.example.test/a.png' }, { url: '/uploads/../private' }] }], meta: { pagination: { page: 1, pageCount: 1 } } });
  const [item] = await fetchCmsArticles();
  expect(item.title).toBe('Editorial fixture');
  expect(item.coverImages).toEqual(['https://cms.example.test/uploads/test-cover.png']);
  expect(item.unavailableCoverCount).toBe(2);
});
it('reads every declared page and never returns a truncated success after page failure', async () => {
  mocks.get.mockResolvedValueOnce({ data: [article('test-first')], meta: { pagination: { page: 1, pageCount: 2 } } })
    .mockResolvedValueOnce({ data: [article('test-second')], meta: { pagination: { page: 2, pageCount: 2 } } });
  expect((await fetchCmsArticles()).map(item => item.id)).toEqual(['cms:test-first', 'cms:test-second']);
  mocks.get.mockResolvedValueOnce({ data: [article()], meta: { pagination: { page: 1, pageCount: 2 } } }).mockRejectedValueOnce(new Error('test CMS unavailable'));
  await expect(fetchCmsArticles()).rejects.toThrow();
});
it('detail reads a namespaced CMS ID only and carries cancellation through transport', async () => {
  mocks.get.mockResolvedValue({ data: article() }); const controller = new AbortController();
  expect((await fetchCmsArticle('cms:test-document', controller.signal)).id).toBe('cms:test-document');
  expect(mocks.get.mock.calls[0][1]).toEqual({ signal: controller.signal });
  await expect(fetchCmsArticle('doctor-document')).rejects.toThrow();
});
it('preserves supported blocks, formatting, nested paragraphs and every validated image', async () => {
  const content = [{ type: 'quote', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'First', bold: true }] },
    { type: 'paragraph', children: [{ type: 'text', text: 'Second', italic: true }] }] },
    { type: 'list', format: 'ordered', children: [{ type: 'list-item', children: [{ type: 'text', text: 'List item' }] }] },
    { type: 'image', image: { url: '/uploads/test-inline.png', alternativeText: 'Inline fixture' }, children: [{ type: 'text', text: '' }] }];
  mocks.get.mockResolvedValue({ data: { ...article(), content, coverImage: [{ url: '/uploads/test-first.png' }, { url: '/uploads/test-second.png' }] } });
  const item = await fetchCmsArticle('cms:test-document');
  expect(item.content[0].type).toBe('quote'); expect(item.content[0].children[0].children[0].bold).toBe(true);
  expect(item.content[0].children[1].children[0].italic).toBe(true); expect(item.content[1].format).toBe('ordered');
  expect(item.content[2].image.url).toBe('https://cms.example.test/uploads/test-inline.png'); expect(item.coverImages).toHaveLength(2);
});
it('rejects duplicate IDs, excessive pagination and executable links', async () => {
  for (const response of [
    { data: [article(), article()], meta: { pagination: { page: 1, pageCount: 1 } } },
    { data: [article()], meta: { pagination: { page: 1, pageCount: 9999 } } },
    { data: [{ ...article(), content: [{ type: 'link', url: 'javascript:alert(1)', children: [{ type: 'text', text: 'Test link' }] }] }], meta: { pagination: { page: 1, pageCount: 1 } } },
  ]) { mocks.get.mockResolvedValue(response); await expect(fetchCmsArticles()).rejects.toThrow(); }
});
