import { z } from 'zod';

const response = z.object({ analysis: z.string().trim().min(1), pdfBase64: z.unknown().optional() });

// Checks the transport encoding and PDF envelope, not document safety or clinical correctness.
export function imagingPdf(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  try {
    const bytes = atob(value);
    if (btoa(bytes) !== value || !bytes.startsWith('%PDF-') || !bytes.trimEnd().endsWith('%%EOF')) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

export function parseImagingResponse(value: unknown) {
  const data = response.parse(value);
  return { diagnosis: data.analysis, pdfData: imagingPdf(data.pdfBase64) };
}
