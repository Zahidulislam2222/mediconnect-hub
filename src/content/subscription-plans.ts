import { z } from 'zod';
import source from './subscription-plans.json';
import { SUBSCRIPTION_PLAN_IDS, type PlanId } from '@/lib/subscription-protocol';

const text = z.string().trim().min(1);
const discountPlaceholder = '{discountPercent}';
const planSchema = z.object({
  id: z.enum(SUBSCRIPTION_PLAN_IDS),
  name: text,
  price: z.number().finite().nonnegative(),
  discountPercent: z.number().finite().min(0).max(100),
  features: z.array(text).min(1),
  highlighted: z.boolean().optional(),
}).strict();

export const subscriptionCatalogSchema = z.object({
  plans: z.array(planSchema).length(SUBSCRIPTION_PLAN_IDS.length),
  unknownPlanName: text,
}).strict().superRefine(({ plans }, context) => {
  if (plans.some(plan => plan.id === 'free' && plan.price !== 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['plans'], message: 'Free protocol plan cannot have a charge' });
  }
  const ids = new Set(plans.map(plan => plan.id));
  if (ids.size !== SUBSCRIPTION_PLAN_IDS.length || SUBSCRIPTION_PLAN_IDS.some(id => !ids.has(id))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['plans'], message: 'Catalog must contain every protocol plan exactly once' });
  }
  if (plans.some(plan => plan.features.some(feature => /[{}]/.test(feature.split(discountPlaceholder).join(''))))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['plans'], message: 'Unknown plan feature placeholder' });
  }
});

export type PlanDisplay = z.infer<typeof planSchema>;
export function loadSubscriptionCatalog(input: unknown): PlanDisplay[] {
  return subscriptionCatalogSchema.parse(input).plans.map(plan => ({ ...plan,
    features: plan.features.map(feature => feature.split(discountPlaceholder).join(String(plan.discountPercent))),
  }));
}
const catalog = subscriptionCatalogSchema.parse(source);
export const subscriptionPlans = loadSubscriptionCatalog(catalog);
export function subscriptionPlanName(planId: PlanId): string {
  return subscriptionPlans.find(plan => plan.id === planId)?.name ?? catalog.unknownPlanName;
}
