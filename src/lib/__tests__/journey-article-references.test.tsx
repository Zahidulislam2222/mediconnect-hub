import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import Workspace from '@/components/journey/Workspace';
import { journey } from '@/content/journey';

vi.mock('@/content/journey', async importOriginal => {
  const original = await importOriginal<{ journey: typeof journey }>();
  const content = structuredClone(original.journey);
  content.workspace.coordinationArticleSlug = 'renamed-coordination';
  content.workspace.preparationArticleSlug = 'renamed-preparation';
  content.articles = content.articles.map(article => (
    article.slug === 'care-team-coordination'
      ? { ...article, slug: 'renamed-coordination', title: 'Configured coordination' }
      : article.slug === 'prepare-for-your-visit'
        ? { ...article, slug: 'renamed-preparation' } : article
  ));
  return { ...original, journey: content };
});

afterEach(cleanup);

it.each([
  ['staff', 'renamed-coordination'],
  ['patient', 'renamed-preparation'],
  ['doctor', 'renamed-preparation'],
])('renders %s article links from maintained content', (role, slug) => {
  render(<MemoryRouter initialEntries={[`/demo/${role}`]}>
    <Routes><Route path="/demo/:role" element={<Workspace
      state={{ slot: journey.sample.defaultSlot, ready: false, note: journey.sample.note }}
      change={vi.fn()} reset={vi.fn()}
    />} /></Routes>
  </MemoryRouter>);
  expect(screen.getByRole('link', { name: journey.library.read }))
    .toHaveAttribute('href', `/knowledge/${slug}`);
  if (role === 'staff') expect(screen.getByRole('heading', { name: 'Configured coordination' })).toBeVisible();
});
