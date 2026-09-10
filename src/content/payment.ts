import { z } from 'zod';
import source from './payment.json';
const schema = z.object({
  unavailableTitle: z.string().min(1),
  loadingTitle: z.string().min(1),
  readinessDisclosure: z.string().min(1),
  succeededTitle: z.string().min(1),
  succeededDescription: z.string().min(1),
  processingTitle: z.string().min(1),
  processingDescription: z.string().min(1),
  actionTitle: z.string().min(1),
  actionDescription: z.string().min(1),
  unknownTitle: z.string().min(1),
  unknownDescription: z.string().min(1),
  failedTitle: z.string().min(1),
  failedDescription: z.string().min(1),
  termsVersion: z.string().min(1),
  termsPath: z.string().min(1),
  privacyPath: z.string().min(1),
  subscriptionPendingTitle: z.string().min(1),
  subscriptionPendingDescription: z.string().min(1),
  subscriptionActiveTitle: z.string().min(1),
  subscriptionActiveDescription: z.string().min(1),
  retentionDisclosure: z.string().min(1),
  cardPrivacy: z.string().min(1),
  totalAmount: z.string().min(1),
  payAmountTemplate: z.string().min(1),
}).strict();
export default schema.parse(source);
