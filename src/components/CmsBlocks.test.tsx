import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CmsBlocks } from './CmsBlocks';
vi.mock('@/components/CmsImage', () => ({ CmsImage: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
afterEach(cleanup);
it('renders nested blocks, list semantics, formatting, safe text and validated media', () => {
  const view = render(<CmsBlocks content={[
    { type: 'quote', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'First paragraph.', bold: true }] },
      { type: 'paragraph', children: [{ type: 'text', text: 'Second paragraph.', italic: true }] }] },
    { type: 'heading', level: 3, children: [{ type: 'text', text: 'Fixture heading' }] },
    { type: 'list', format: 'ordered', children: [{ type: 'list-item', children: [{ type: 'text', text: 'Fixture item' }] }] },
    { type: 'code', children: [{ type: 'text', text: '<script>safe fixture</script>' }] },
    { type: 'image', image: { url: 'https://cms.example.test/uploads/test.png', alternativeText: 'Fixture image' } },
  ]} />);
  expect(view.container.querySelectorAll('blockquote p')).toHaveLength(2); expect(view.container.querySelector('strong')).toHaveTextContent('First paragraph.');
  expect(view.container.querySelector('em')).toHaveTextContent('Second paragraph.'); expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
  expect(view.container.querySelector('ol li')).toHaveTextContent('Fixture item'); expect(view.container.querySelector('pre code')).toHaveTextContent('<script>safe fixture</script>');
  expect(view.container.querySelector('script')).toBeNull(); expect(screen.getByRole('img', { name: 'Fixture image' })).toBeInTheDocument();
});
