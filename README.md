# Valifides — decision-level governance for AI in insurance claims (India and US)

Prototype. Synthetic data only. Rules are drafts compiled from public summaries and must be reviewed by insurance counsel before any real use. Not legal advice.

Valifides sits between an insurer's AI and the claim decision. It checks each AI-influenced decision against the claim rules of the selected market before it takes effect, routes risky ones to an authorised human, and keeps a tamper-evident record.

## How it works

- **Fixed rules, no AI in the verdict.** `src/engine/` evaluates a claim decision against a rule pack chosen by `jurisdiction`:
  - `IN-CLAIMS` (`indiaClaimsPack.ts`, 13 rules): health cashless/reimbursement and motor own-damage, IRDAI and DPDP.
  - `US-PC-CLAIMS` (`usClaimsPack.ts`, 9 rules): auto physical damage and homeowners in CA, TX, FL, plus controls aligned to the NAIC AI Model Bulletin.

   The same input always produces the same verdict.
- **Three modes.** Shadow (log only), Advisory (return a verdict), Enforce (only APPROVE executes).
- **Evidence.** Each evaluation is hashed (SHA-256 over canonical JSON of the decision and rule results), so later changes are detectable.

## Screens

A Market switch (India / United States) in the header changes rules, scenarios, currency and evidence log.

Overview · Decision Gateway · Shadow Replay (240 synthetic decisions per market) · Escalation Queue · Evidence Log · Rule Pack

## API

`POST /api/evaluate` with `{ "mode": "SHADOW" | "ADVISORY" | "ENFORCE", "decision": { ...ClaimDecisionInput } }`.
Returns the verdict, per-rule results and `evidenceHash`. No data is stored. See `src/engine/types.ts` for the input shape and `src/engine/synthetic.ts` and `src/engine/usSynthetic.ts` for examples.

## Develop

```
npm install
npm run dev     # local app
npm test        # engine tests (determinism, scenarios, hashing, modes)
```

## Documents

`docs/` holds the business plan, PRD, GTM strategy, validation kit, buyer map, go/no-go memo, buyer tracker and pitch script.
