import { INDIA_PACK } from "./indiaClaimsPack";
import { US_PACK } from "./usClaimsPack";
import { UK_PACK } from "./ukClaimsPack";
import { EU_PACK } from "./euClaimsPack";
import type { ClaimDecisionInput, Jurisdiction, RulePack, RuleResult } from "./types";

export const PACKS: Record<Jurisdiction, RulePack> = { IN: INDIA_PACK, US: US_PACK, UK: UK_PACK, EU: EU_PACK };

export function packFor(jurisdiction: Jurisdiction | undefined): RulePack {
  return PACKS[jurisdiction ?? "IN"] ?? INDIA_PACK;
}

export function runRules(input: ClaimDecisionInput): RuleResult[] {
  const pack = packFor(input.jurisdiction);
  return pack.rules.map((rule) => {
    const base = { ruleId: rule.id, title: rule.title, source: rule.source, sourceStatus: rule.sourceStatus };
    if (!rule.appliesTo.includes(input.line)) return { ...base, outcome: "NOT_APPLICABLE" as const, message: "Not applicable to this claim line." };
    return { ...base, ...rule.check(input, rule) };
  });
}
