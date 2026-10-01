import { packFor, runRules } from "./packs";
import type { ClaimDecisionInput, EnforcementMode, EvaluationResult, Verdict } from "./types";

const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

/** Deterministic: identical input and mode always give the identical verdict and rule results. */
export function evaluate(input: ClaimDecisionInput, mode: EnforcementMode): EvaluationResult {
  const t0 = now();
  const pack = packFor(input.jurisdiction);
  const results = runRules(input);
  const verdict: Verdict = results.some((r) => r.outcome === "BLOCK")
    ? "BLOCK"
    : results.some((r) => r.outcome === "ESCALATE")
      ? "ESCALATE"
      : "APPROVE";
  // Shadow and advisory never stop the customer's flow; only enforce does.
  const executionPermitted = mode === "ENFORCE" ? verdict === "APPROVE" : true;
  const engineLatencyMs = Math.round((now() - t0) * 1000) / 1000;
  return {
    decisionId: input.decisionId,
    claimId: input.claimId,
    verdict,
    executionPermitted,
    mode,
    results,
    rulePackId: pack.id,
    rulePackVersion: pack.version,
    evaluatedAt: input.evaluatedAt,
    engineLatencyMs,
  };
}

/** Stable JSON with sorted keys, so the evidence hash depends only on content. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(",")}}`;
}

/** Evidence payload excludes measured latency so the hash is reproducible. */
export function evidencePayload(input: ClaimDecisionInput, result: EvaluationResult) {
  const { engineLatencyMs: _latency, ...stable } = result;
  return { input, result: stable };
}
