import { describe, expect, it } from "vitest";
import { evaluate, evidencePayload } from "./evaluate";
import { sha256Hex } from "./hash";
import { generateSyntheticDecisions, SCENARIOS } from "./synthetic";
import { businessDaysBetween } from "./usClaimsPack";
import { generateUsSyntheticDecisions, US_SCENARIOS } from "./usSynthetic";
import { generateUkSyntheticDecisions, UK_SCENARIOS } from "./ukSynthetic";
import { EU_SCENARIOS, generateEuSyntheticDecisions } from "./euSynthetic";
import type { Scenario } from "./synthetic";

describe("India claims rule pack", () => {
  for (const s of SCENARIOS) {
    it(`scenario "${s.label}" gives ${s.expected}`, () => {
      expect(evaluate(s.input, "ENFORCE").verdict).toBe(s.expected);
    });
  }

  it("is deterministic: same input, same verdict and results", () => {
    const input = SCENARIOS[0].input;
    const a = evaluate(input, "ENFORCE");
    const b = evaluate(input, "ENFORCE");
    expect(a.verdict).toBe(b.verdict);
    expect(a.results).toEqual(b.results);
  });

  it("produces the same evidence hash for the same decision", async () => {
    const input = SCENARIOS[1].input;
    const h1 = await sha256Hex(evidencePayload(input, evaluate(input, "SHADOW")));
    const h2 = await sha256Hex(evidencePayload(input, evaluate(input, "SHADOW")));
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never stops execution in shadow or advisory mode", () => {
    const blocked = SCENARIOS[2].input;
    expect(evaluate(blocked, "SHADOW").executionPermitted).toBe(true);
    expect(evaluate(blocked, "ADVISORY").executionPermitted).toBe(true);
    expect(evaluate(blocked, "ENFORCE").executionPermitted).toBe(false);
  });

  it("generates a stable synthetic dataset with unique decision IDs", () => {
    const a = generateSyntheticDecisions();
    const b = generateSyntheticDecisions();
    expect(a).toEqual(b);
    expect(new Set(a.map((d) => d.decisionId)).size).toBe(a.length);
  });
});

describe("US P&C claims rule pack", () => {
  for (const s of US_SCENARIOS) {
    it(`scenario "${s.label}" gives ${s.expected}`, () => {
      const r = evaluate(s.input, "ENFORCE");
      expect(r.verdict).toBe(s.expected);
      expect(r.rulePackId).toBe("US-PC-CLAIMS");
    });
  }

  it("counts business days, skipping weekends", () => {
    // Fri 2 Oct 2026 -> Fri 9 Oct 2026 = 5 business days
    expect(businessDaysBetween("2026-10-02T10:00:00Z", "2026-10-09T10:00:00Z")).toBe(5);
    // Fri -> Mon = 1 business day
    expect(businessDaysBetween("2026-10-02T10:00:00Z", "2026-10-05T10:00:00Z")).toBe(1);
  });

  it("computes Texas penalty interest on late payment", () => {
    const r = evaluate(US_SCENARIOS[4].input, "SHADOW");
    const pay = r.results.find((x) => x.ruleId === "US-CLM-06")!;
    expect(pay.outcome).toBe("ESCALATE");
    expect(pay.penalInterest).toBeGreaterThan(0);
  });

  it("generates a stable US dataset with unique decision IDs", () => {
    const a = generateUsSyntheticDecisions();
    expect(a).toEqual(generateUsSyntheticDecisions());
    expect(new Set(a.map((d) => d.decisionId)).size).toBe(a.length);
  });

  it("does not apply India rules to US decisions", () => {
    const r = evaluate(US_SCENARIOS[0].input, "SHADOW");
    expect(r.results.every((x) => x.ruleId.startsWith("US-"))).toBe(true);
  });
});

describe.each([
  ["UK", "UK-CLAIMS", "UK-", UK_SCENARIOS, generateUkSyntheticDecisions],
  ["EU", "EU-CLAIMS", "EU-", EU_SCENARIOS, generateEuSyntheticDecisions],
] as [string, string, string, Scenario[], () => ReturnType<typeof generateUkSyntheticDecisions>][])("%s claims rule pack", (_j, packId, prefix, scenarios, generate) => {
  for (const s of scenarios) {
    it(`scenario "${s.label}" gives ${s.expected}`, () => {
      const r = evaluate(s.input, "ENFORCE");
      expect(r.verdict).toBe(s.expected);
      expect(r.rulePackId).toBe(packId);
      expect(r.results.every((x) => x.ruleId.startsWith(prefix))).toBe(true);
    });
  }

  it("generates a stable dataset with unique decision IDs and a mix of verdicts", () => {
    const a = generate();
    expect(a).toEqual(generate());
    expect(new Set(a.map((d) => d.decisionId)).size).toBe(a.length);
    const verdicts = new Set(a.map((d) => evaluate(d, "SHADOW").verdict));
    expect(verdicts).toEqual(new Set(["APPROVE", "ESCALATE", "BLOCK"]));
  });
});

describe("EU member-state rules", () => {
  it("applies German VVG rules only to Germany", () => {
    const de = EU_SCENARIOS.find((s) => s.id === "e4")!.input;
    const fr = { ...de, state: "FR" as const };
    expect(evaluate(de, "SHADOW").results.find((r) => r.ruleId === "EU-CLM-11")!.outcome).toBe("BLOCK");
    expect(evaluate(fr, "SHADOW").results.find((r) => r.ruleId === "EU-CLM-11")!.outcome).toBe("NOT_APPLICABLE");
  });

  it("extends the German non-disclosure limit to 10 years for intentional breaches", () => {
    const de = { ...EU_SCENARIOS.find((s) => s.id === "e4")!.input, misrepresentationType: "DELIBERATE_OR_RECKLESS" as const };
    expect(evaluate(de, "SHADOW").results.find((r) => r.ruleId === "EU-CLM-11")!.outcome).toBe("PASS");
  });
});
