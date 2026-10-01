// POST /api/evaluate — deterministic claim-decision evaluation (demo).
// Same engine as the console. No AI model is called; no data is stored.
import { createHash } from "node:crypto";
import { canonicalJson, evaluate, evidencePayload } from "../src/engine/evaluate";
import type { ClaimDecisionInput, EnforcementMode } from "../src/engine/types";

const MODES: EnforcementMode[] = ["SHADOW", "ADVISORY", "ENFORCE"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
  const input = body.decision as ClaimDecisionInput | undefined;
  const mode: EnforcementMode = MODES.includes(body.mode) ? body.mode : "SHADOW";

  const missing = ["jurisdiction", "decisionId", "claimId", "line", "proposedAction", "aiInvolvement", "evaluatedAt", "timeline"].filter(
    (k) => !input || (input as unknown as Record<string, unknown>)[k] === undefined,
  );
  if (missing.length) return res.status(400).json({ error: `Missing fields in "decision": ${missing.join(", ")}` });

  const decision: ClaimDecisionInput = { dataPurposes: ["CLAIM_ASSESSMENT"], monthsContinuousCoverage: 0, claimAmount: 0, ...input! };
  const result = evaluate(decision, mode);
  const evidenceHash = createHash("sha256").update(canonicalJson(evidencePayload(decision, result))).digest("hex");
  return res.status(200).json({ ...result, evidenceHash });
}
