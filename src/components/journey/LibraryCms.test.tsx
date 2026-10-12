import { cleanup, render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), media: vi.fn() }));
vi.mock('@/lib/cms-content', () => ({ fetchCmsArticles: mocks.list, fetchCmsArticle: mocks.detail }));
vi.mock('@/lib/api', () => ({ cmsApi: { media: mocks.media } }));
import Library from './Library';
import { journey } from '@/content/journey';
import { JourneyRoutingContext } from './Routing';
import { journeyRouting } from '@/config/journey-routing';
import { cmsContent } from '@/config/cms';
const article = { id: 'cms:editorial-fixture', title: 'Public CMS editorial fixture', category: 'Editorial',
  description: 'Public CMS editorial fixture', date: '2026-01-01T00:00:00.000Z', coverImages: [], coverImage: null,
  content: [{ type: 'paragraph', children: [{ type: 'text', text: '<script>Public editorial body</script>', bold: true }] }], _sourceCms: true };
function mount(path = journeyRouting.application.knowledge, kind: 'knowledge' | 'blog' = 'knowledge') {
  const route = journeyRouting.application[kind];
  return render(<MemoryRouter initialEntries={[path]}><JourneyRoutingContext.Provider value={journeyRouting.application}><Routes>
    <Route path={route} element={<Library kind={kind} />} />
    <Route path={route + '/:slug'} element={<Library kind={kind} />} />
  </Routes></JourneyRoutingContext.Provider></MemoryRouter>);
}
beforeEach(() => { vi.clearAllMocks(); mocks.list.mockResolvedValue([article]); mocks.detail.mockResolvedValue(article); });
afterEach(cleanup);
it('shows valid article text and an honest notice when optional cover images were rejected', async () => {
  mocks.detail.mockResolvedValue({ ...article, unavailableCoverCount: 2 });
  mount('/guides/cms%3Aeditorial-fixture');
  expect(await screen.findByText('<script>Public editorial body</script>')).toBeVisible();
  expect(screen.getByText(cmsContent.unavailableMediaLabel)).toBeVisible();
  expect(mocks.media).not.toHaveBeenCalled();
});
it('wires public knowledge list and detail with curated guides preserved and escaped rich blocks', async () => {
  const view = mount();
  expect(await screen.findByRole('heading', { name: article.title })).toBeVisible();
  expect(screen.getByRole('heading', { name: journey.articles.find(item => item.kind === 'knowledge')!.title })).toBeVisible();
  fireEvent.click(screen.getByRole('heading', { name: article.title }));
  expect(await screen.findByText('<script>Public editorial body</script>')).toBeVisible();
  expect(view.container.querySelector('strong')).toHaveTextContent('Public editorial body');
  expect(view.container.querySelector('script')).toBeNull();
  expect(mocks.detail).toHaveBeenCalledWith(article.id, expect.any(AbortSignal));
});
it('loads a direct published detail without requesting the collection', async () => {
  const view = mount('/guides/cms%3Aeditorial-fixture');
  expect(await screen.findByRole('heading', { name: article.title })).toBeVisible();
  expect(mocks.list).not.toHaveBeenCalled();
  const signal = mocks.detail.mock.calls[0][1] as AbortSignal; view.unmount(); expect(signal.aborted).toBe(true);
});
it('preserves curated guides on CMS outage and avoids CMS entirely for curated details and blog', async () => {
  mocks.list.mockRejectedValue(new Error('test CMS outage')); const list = mount();
  expect(await screen.findByRole('heading', { name: journey.articles.find(item => item.kind === 'knowledge')!.title })).toBeVisible();
  await vi.waitFor(() => expect(mocks.list).toHaveBeenCalled()); list.unmount(); vi.clearAllMocks();
  const curated = journey.articles.find(item => item.kind === 'knowledge')!;
  const detail = mount('/guides/' + curated.slug); expect(screen.getByRole('heading', { name: curated.title })).toBeVisible();
  expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.detail).not.toHaveBeenCalled(); detail.unmount();
  mount('/blog', 'blog'); expect(screen.getByRole('heading', { name: journey.articles.find(item => item.kind === 'blog')!.title })).toBeVisible();
  expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.detail).not.toHaveBeenCalled();
});
it('ignores a late detail response after navigation to a curated article', async () => {
  let resolve!: (value: typeof article) => void; mocks.detail.mockImplementation(() => new Promise(done => { resolve = done; }));
  const curated = journey.articles.find(item => item.kind === 'knowledge')!;
  render(<MemoryRouter initialEntries={['/guides/cms%3Aeditorial-fixture']}><Routes>
    <Route path="/guides/:slug" element={<><Link to={'/guides/' + curated.slug}>Fixture navigation</Link><Library kind="knowledge" /></>} />
  </Routes></MemoryRouter>);
  await vi.waitFor(() => expect(mocks.detail).toHaveBeenCalled());
  const signal = mocks.detail.mock.calls[0][1] as AbortSignal;
  fireEvent.click(screen.getByRole('link', { name: 'Fixture navigation' }));
  expect(signal.aborted).toBe(true);
  await act(async () => resolve(article));
  expect(screen.getByRole('heading', { name: curated.title })).toBeVisible();
  expect(screen.queryByRole('heading', { name: article.title })).toBeNull();
});
it('shows loading while retrying A after failed A and an interrupted B request', async () => {
  let completeRetry!: (value: typeof article) => void;
  mocks.detail.mockRejectedValueOnce(new Error('test A unavailable'))
    .mockImplementationOnce(() => new Promise(() => {}))
    .mockImplementationOnce(() => new Promise(done => { completeRetry = done; }));
  const view = render(<MemoryRouter initialEntries={['/guides/cms%3Aeditorial-fixture']}>
    <JourneyRoutingContext.Provider value={journeyRouting.application}><Routes>
      <Route path="/guides/:slug" element={<>
        <Link to="/guides/cms%3Asecond-fixture">Go B</Link>
        <Link to="/guides/cms%3Aeditorial-fixture">Retry A</Link><Library kind="knowledge" />
      </>} />
    </Routes></JourneyRoutingContext.Provider></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: journey.footer.notFound })).toBeVisible();
  fireEvent.click(screen.getByRole('link', { name: 'Go B' }));
  await vi.waitFor(() => expect(mocks.detail).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole('link', { name: 'Retry A' }));
  await vi.waitFor(() => expect(mocks.detail).toHaveBeenCalledTimes(3));
  expect(screen.queryByRole('heading', { name: journey.footer.notFound })).toBeNull();
  expect(view.container.querySelector('[aria-busy="true"]')).toBeVisible();
  await act(async () => completeRetry(article));
  expect(await screen.findByRole('heading', { name: article.title })).toBeVisible();
});
