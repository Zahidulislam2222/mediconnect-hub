import { expect, it } from 'vitest';
import { articleRouteSource, clinicalArticleRouteId } from './article-identity';
it('preserves ordinary clinician routes and unambiguously escapes every reserved prefix', () => {
  for (const id of ['test-clinical', 'cms:test-document', 'clinical:cms:test-document']) {
    expect(articleRouteSource(clinicalArticleRouteId(id))).toEqual({ source: 'clinical', id });
  }
  expect(clinicalArticleRouteId('test-clinical')).toBe('test-clinical');
  expect(articleRouteSource('cms:test-document')).toEqual({ source: 'cms', id: 'cms:test-document' });
});
