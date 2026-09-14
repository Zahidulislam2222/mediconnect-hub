import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import source from '@/content/subscription-plans.json';
import { loadSubscriptionCatalog, subscriptionCatalogSchema, subscriptionPlanName } from '@/content/subscription-plans';

describe('Subscription catalog configuration ownership', () => {
  it('keeps maintained plan prices and names out of transport and state source', () => {
    for (const name of ['src/lib/subscription.ts', 'src/context/SubscriptionContext.tsx']) {
      const moduleSource = readFileSync(path.resolve(process.cwd(), name), 'utf8');
      expect(moduleSource).not.toMatch(/\bprice:\s*\d/);
      for (const plan of source.plans.filter(plan => plan.id !== 'free')) {
        expect(moduleSource).not.toContain(plan.name);
      }
    }
  });
});

describe('Subscription catalog validation', () => {
  it.each([
    ['missing plan', (value: any) => value.plans.pop()],
    ['duplicate plan', (value: any) => { value.plans[1].id = value.plans[0].id; }],
    ['unknown protocol plan', (value: any) => { value.plans[1].id = 'test-unsupported'; }],
    ['negative price', (value: any) => { value.plans[1].price = -1; }],
    ['non-finite price', (value: any) => { value.plans[1].price = Infinity; }],
    ['coerced price', (value: any) => { value.plans[1].price = '23'; }],
    ['free plan charge', (value: any) => { value.plans[0].price = 1; }],
    ['excess discount', (value: any) => { value.plans[1].discountPercent = 101; }],
    ['empty name', (value: any) => { value.plans[1].name = '   '; }],
    ['empty features', (value: any) => { value.plans[1].features = []; }],
    ['unknown field', (value: any) => { value.plans[1].testUnknown = true; }],
    ['unknown placeholder', (value: any) => { value.plans[1].features = ['{testUnknown}']; }],
    ['unclosed placeholder', (value: any) => { value.plans[1].features = ['{discountPercent']; }],
  ])('rejects %s', (_name, mutate) => {
    const value = structuredClone(source); mutate(value);
    expect(subscriptionCatalogSchema.safeParse(value).success).toBe(false);
  });
  it('derives marketed percentages from the same numeric discount field', () => {
    const value = structuredClone(source); value.plans[1].discountPercent = 27;
    const plan = loadSubscriptionCatalog(value)[1];
    expect(plan.features).toContain('27% discount on all visits');
    expect(plan.features).not.toContain('20% discount on all visits');
  });
  it('does not crash or mislabel an unknown runtime server plan as free', () => {
    expect(subscriptionPlanName('test-unknown' as never)).toBe(source.unknownPlanName);
  });
});
