import { expect, it } from 'vitest';
import { imagingPdf, parseImagingResponse } from '@/lib/imaging-response';

it.each([null, {}, '', ' ', { analysis: null }, { analysis: {} }])('rejects missing or malformed analysis %j', value => {
  expect(() => parseImagingResponse(value)).toThrow();
});
it.each([undefined, {}, '', 'not-base64', btoa('not a PDF'), btoa('%PDF-1.4\ntruncated')])('rejects invalid PDF transport/envelope %j', value => {
  expect(imagingPdf(value)).toBeUndefined();
});
it('retains exact bytes with a valid PDF envelope without claiming clinical validation', () => {
  const pdf = btoa('%PDF-1.4\nSynthetic envelope fixture, not a clinical document\n%%EOF');
  expect(imagingPdf(pdf)).toBe(pdf);
  expect(parseImagingResponse({ analysis: '  Synthetic draft  ', pdfBase64: pdf })).toEqual({ diagnosis: 'Synthetic draft', pdfData: pdf });
});
