// Synthetic EU motor and private-health claim decisions for the demo. No real people, policies or insurers.
import { AS_OF, type Scenario } from "./synthetic";
import type { AiInvolvement, ClaimDecisionInput, ClaimLine, EuMemberState, ProposedAction, RepudiationGround } from "./types";

const AS_OF_MS = Date.parse(AS_OF);
const DAY = 24 * 60 * 60 * 1000;
const daysBefore = (d: number) => new Date(AS_OF_MS - d * DAY).toISOString();

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const INSURERS = ["Demo EU Insurer A", "Demo EU Insurer B", "Demo EU Health Insurer C"];
const VENDORS = ["Demo Claims Automation Vendor", "Demo Medical Coding Vendor"];

export function generateEuSyntheticDecisions(count = 240, seed = 20261004): ClaimDecisionInput[] {
  const rnd = mulberry32(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const between = (lo: number, hi: number) => Math.round(lo + rnd() * (hi - lo));
  const out: ClaimDecisionInput[] = [];

  for (let n = 1; n <= count; n++) {
    const state: EuMemberState = pick(["DE", "DE", "DE", "FR", "NL"] as const);
    const line: ClaimLine = rnd() < 0.5 ? "EU_MOTOR" : "EU_HEALTH";
    const action: ProposedAction = pick(["APPROVE_FULL", "APPROVE_FULL", "APPROVE_FULL", "APPROVE_PARTIAL", "REPUDIATE", "PENDING", "PENDING"] as const);
    const ai: AiInvolvement = rnd() < 0.75 ? pick(["ASSISTED", "AI_RECOMMENDED", "AI_RECOMMENDED", "AUTOMATED"] as const) : "NONE";
    const adverse = action === "REPUDIATE" || action === "APPROVE_PARTIAL";
    const ground: RepudiationGround | null = action === "REPUDIATE" ? pick(["FRAUD", "NON_DISCLOSURE", "POLICY_EXCLUSION", "POLICY_EXCLUSION", "NOT_COVERED"] as const) : null;
    const amount = line === "EU_HEALTH" ? between(300, 18000) : between(700, 25000);
    const noticeAgo = between(3, 60);
    const vendor = ai !== "NONE" && rnd() < 0.5 ? pick(VENDORS) : null;

    const timeline: ClaimDecisionInput["timeline"] = { intimatedAt: daysBefore(noticeAgo) };
    if (action === "APPROVE_FULL" || action === "APPROVE_PARTIAL") {
      const acceptedAgo = between(1, Math.max(2, noticeAgo - 2));
      timeline.acceptedAt = daysBefore(acceptedAgo);
      if (rnd() < 0.85) timeline.paidAt = daysBefore(Math.max(0, acceptedAgo - between(0, 7)));
    }
    const reviewed = adverse && ai !== "AUTOMATED" && rnd() < 0.72;

    out.push({
      jurisdiction: "EU",
      state,
      decisionId: `EUD-${String(n).padStart(5, "0")}`,
      claimId: `CLM-${state}-${line === "EU_HEALTH" ? "KV" : "KF"}-${String(400000 + n * 43).slice(-6)}`,
      insurer: pick(INSURERS),
      line,
      proposedAction: action,
      aiInvolvement: ai,
      modelId: ai === "NONE" ? null : line === "EU_HEALTH" ? "health-invoice-checker" : "motor-damage-assessor",
      modelVersion: ai === "NONE" || rnd() < 0.07 ? null : pick(["3.2.0", "3.3.1", "4.0.0"]),
      modelVendor: vendor,
      vendorAssessmentRef: vendor && rnd() < 0.75 ? `TPR-${between(100, 999)}` : null,
      humanReview: reviewed
        ? { reviewerId: `SB-${between(100, 999)}`, role: line === "EU_HEALTH" && rnd() < 0.5 ? "MEDICAL_OFFICER" : "CLAIMS_HANDLER", reviewedAt: daysBefore(between(0, 3)), rationale: "Reviewed the claim file and policy terms." }
        : null,
      repudiationGround: ground,
      exclusionClauseRef: adverse && rnd() < 0.82 ? `AVB § ${between(1, 12)} Abs. ${between(1, 4)}` : null,
      denialFactualBasis: adverse && rnd() < 0.85 ? "Treatment not medically necessary per the submitted findings." : null,
      fraudInvestigationRef: ground === "FRAUD" && rnd() < 0.5 ? `FRD-${between(1000, 9999)}` : null,
      misrepresentationType: ground === "NON_DISCLOSURE" ? pick(["DELIBERATE_OR_RECKLESS", "CARELESS", "CARELESS"] as const) : null,
      automatedSafeguardsNotified: ai === "AUTOMATED" ? rnd() < 0.5 : false,
      explicitConsentAutomated: ai === "AUTOMATED" && line === "EU_HEALTH" ? rnd() < 0.6 : false,
      aiActRiskClass: ai === "NONE" ? null : rnd() < 0.9 ? "NOT_HIGH_RISK" : null,
      advancePaymentOffered: rnd() < 0.5,
      decisiveFactors: adverse ? (rnd() < 0.1 ? [] : rnd() < 0.06 ? ["INVOICE_CODES", "POSTCODE"] : ["INVOICE_CODES", "TARIFF_LIMIT"]) : [],
      monthsContinuousCoverage: between(1, 130),
      claimAmount: amount,
      approvedAmount: action === "APPROVE_PARTIAL" ? Math.round(amount * (0.4 + rnd() * 0.5)) : action === "APPROVE_FULL" ? amount : null,
      dataPurposes: ["CLAIM_ASSESSMENT"],
      timeline,
      evaluatedAt: AS_OF,
    });
  }
  return out;
}

const handler = { reviewerId: "SB-214", role: "CLAIMS_HANDLER" as const, reviewedAt: daysBefore(0), rationale: "Reviewed the claim file and policy terms." };

const base = (id: string, patch: Partial<ClaimDecisionInput>): ClaimDecisionInput => ({
  jurisdiction: "EU",
  state: "DE",
  decisionId: id,
  claimId: `CLM-EU-DEMO-${id.slice(-3)}`,
  insurer: "Demo EU Insurer A",
  line: "EU_MOTOR",
  proposedAction: "APPROVE_FULL",
  aiInvolvement: "AI_RECOMMENDED",
  modelId: "motor-damage-assessor",
  modelVersion: "4.0.0",
  modelVendor: null,
  vendorAssessmentRef: null,
  humanReview: null,
  repudiationGround: null,
  exclusionClauseRef: null,
  denialFactualBasis: null,
  fraudInvestigationRef: null,
  misrepresentationType: null,
  automatedSafeguardsNotified: false,
  explicitConsentAutomated: false,
  aiActRiskClass: "NOT_HIGH_RISK",
  advancePaymentOffered: false,
  decisiveFactors: [],
  monthsContinuousCoverage: 30,
  claimAmount: 7200,
  approvedAmount: null,
  dataPurposes: ["CLAIM_ASSESSMENT"],
  timeline: { intimatedAt: daysBefore(10) },
  evaluatedAt: AS_OF,
  ...patch,
});

const refusal = {
  proposedAction: "REPUDIATE" as const,
  repudiationGround: "POLICY_EXCLUSION" as const,
  exclusionClauseRef: "AKB A.2.9.1",
  denialFactualBasis: "Damage caused by wear and tear, which the policy excludes.",
  decisiveFactors: ["DAMAGE_PATTERN"],
};

const health = { line: "EU_HEALTH" as const, modelId: "health-invoice-checker", insurer: "Demo EU Health Insurer C", claimAmount: 4800 };

export const EU_SCENARIOS: Scenario[] = [
  {
    id: "e1",
    label: "German motor claim refused on an AI score, no human review",
    expected: "ESCALATE",
    input: base("EUC-001", { ...refusal }),
  },
  {
    id: "e2",
    label: "Fully automated health-claim refusal without explicit consent",
    expected: "BLOCK",
    input: base("EUC-002", {
      ...refusal,
      ...health,
      aiInvolvement: "AUTOMATED",
      automatedSafeguardsNotified: true,
      exclusionClauseRef: "MB/KK § 5 Abs. 2",
      denialFactualBasis: "Treatment not medically necessary per the submitted findings.",
      decisiveFactors: ["INVOICE_CODES"],
    }),
  },
  {
    id: "e3",
    label: "French motor refusal with no main factors recorded",
    expected: "ESCALATE",
    input: base("EUC-003", { ...refusal, state: "FR", exclusionClauseRef: "Conditions générales, art. 7", humanReview: handler, decisiveFactors: [] }),
  },
  {
    id: "e4",
    label: "German health claim refused for non-disclosure 7 years after contract",
    expected: "BLOCK",
    input: base("EUC-004", {
      ...refusal,
      ...health,
      repudiationGround: "NON_DISCLOSURE",
      misrepresentationType: "CARELESS",
      monthsContinuousCoverage: 84,
      exclusionClauseRef: "VVG § 19; Antrag, Gesundheitsfragen",
      denialFactualBasis: "Prior back treatment not declared in the application.",
      humanReview: { ...handler, role: "MEDICAL_OFFICER" },
      decisiveFactors: ["PRIOR_TREATMENT"],
    }),
  },
  {
    id: "e5",
    label: "German claim still under investigation after six weeks, no advance",
    expected: "ESCALATE",
    input: base("EUC-005", { proposedAction: "PENDING", timeline: { intimatedAt: daysBefore(42) } }),
  },
  {
    id: "e6",
    label: "Dutch health reduction where sex was a decisive factor",
    expected: "BLOCK",
    input: base("EUC-006", {
      ...health,
      state: "NL",
      proposedAction: "APPROVE_PARTIAL",
      approvedAmount: 2900,
      humanReview: handler,
      exclusionClauseRef: "Polisvoorwaarden art. 12",
      denialFactualBasis: "Amount above the reasonable tariff for this treatment.",
      decisiveFactors: ["TARIFF_LIMIT", "SEX"],
    }),
  },
  {
    id: "e7",
    label: "AI model with no AI Act classification recorded",
    expected: "ESCALATE",
    input: base("EUC-007", { aiInvolvement: "ASSISTED", aiActRiskClass: null, approvedAmount: 7200, timeline: { intimatedAt: daysBefore(10), acceptedAt: daysBefore(4), paidAt: daysBefore(2) } }),
  },
  {
    id: "e8",
    label: "Clean AI-assisted German motor approval",
    expected: "APPROVE",
    input: base("EUC-008", { aiInvolvement: "ASSISTED", approvedAmount: 7200, timeline: { intimatedAt: daysBefore(10), acceptedAt: daysBefore(4), paidAt: daysBefore(2) } }),
  },
];
