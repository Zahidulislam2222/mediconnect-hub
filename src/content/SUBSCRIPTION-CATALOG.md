# Subscription display catalog

`subscription-plans.json` owns maintained plan names, displayed prices, advertised discounts, feature copy and highlight flags. `subscription-plans.ts` validates it before use; the page, plan cards, checkout and current-plan name share that catalog. Feature placeholders use `{discountPercent}` so discount text follows the numeric field.

The server remains authoritative for actual charges, entitlements and current subscription discounts. This is display configuration; changing it does not configure server pricing. Existing paid prices and terms were preserved by the extraction. Payment/error/consent content remains owned by `payment.json`; remaining inline presentation copy is tracked in the broader configuration backlog.

`lib/subscription-protocol.ts` owns stable API plan IDs. Every catalog must contain each ID exactly once; the free protocol plan has zero price. Numeric values are finite, prices nonnegative, percentages within the mathematical0–100 range; empty display strings and unknown feature placeholders are rejected. Unknown server plan names use the maintained unknown-plan label instead of throwing or pretending to be free.

No new environment variables or credentials were introduced. No billing provider request is needed to validate or preview catalog content.
