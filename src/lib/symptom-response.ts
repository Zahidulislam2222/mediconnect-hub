import { z } from 'zod';

// This validates the current response contract, not medical correctness.
const symptomResponse = z.object({
  success: z.literal(true),
  status: z.literal('available'),
  analysis: z.object({
    risk: z.enum(['Low', 'Medium', 'High', 'Critical', 'Unknown']),
    reason: z.string().trim().min(1),
  }),
  provider: z.string().trim().min(1).optional(),
  pdfBase64: z.string().min(1).optional(),
});

export function parseSymptomResponse(value: unknown) {
  return symptomResponse.parse(value);
}
