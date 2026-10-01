// Synthetic UK motor and home claim decisions for the demo. No real people, policies or insurers.
import { AS_OF, type Scenario } from "./synthetic";
import type { AiInvolvement, ClaimDecisionInput, ClaimLine, ProposedAction, RepudiationGround } from "./types";

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

const INSURERS = ["Demo UK Insurer A", "Demo UK Insurer B"];
const VENDORS = ["Demo Claims Triage Vendor", "Demo Counter-Fraud Vendor"];

export function generateUkSyntheticDecisions(count = 240, seed = 20261003): ClaimDecisionInput[] {
  const rnd = mulberry32(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const between = (lo: number, hi: number) => Math.round(lo + rnd() * (hi - lo));
  const out: ClaimDecisionInput[] = [];

  for (let n = 1; n <= count; n++) {
    const line: ClaimLine = rnd() < 0.55 ? "UK_MOTOR" : "UK_HOME";
    const action: ProposedAction = pick(["APPROVE_FULL", "APPROVE_FULL", "APPROVE_FULL", "APPROVE_PARTIAL", "REPUDIATE", "PENDING", "PENDING"] as const);
    const ai: AiInvolvement = rnd() < 0.75 ? pick(["ASSISTED", "AI_RECOMMENDED", "AI_RECOMMENDED", "AUTOMATED"] as const) : "NONE";
    const adverse = action === "REPUDIATE" || action === "APPROVE_PARTIAL";
    const ground: RepudiationGround | null = action === "REPUDIATE" ? pick(["FRAUD", "NON_DISCLOSURE", "POLICY_EXCLUSION", "POLICY_EXCLUSION", "NOT_COVERED"] as const) : null;
    const amount = line === "UK_HOME" ? between(800, 45000) : between(600, 22000);
    const noticeAgo = between(3, 60);
    const vendor = ai !== "NONE" && rnd() < 0.5 ? pick(VENDORS) : null;
    const vulnerable = rnd() < 0.12;

    const timeline: ClaimDecisionInput["timeline"] = { intimatedAt: daysBefore(noticeAgo) };
    if (action === "APPROVE_FULL" || action === "APPROVE_PARTIAL") {
      const acceptedAgo = between(1, Math.max(2, noticeAgo - 2));
      timeline.acceptedAt = daysBefore(acceptedAgo);
      if (rnd() < 0.8) timeline.paidAt = daysBefore(Math.max(0, acceptedAgo - (rnd() < 0.85 ? between(0, 7) : between(16, 30))));
    }
    const reviewed = adverse && ai !== "AUTOMATED" && rnd() < 0.72;

    out.push({
      jurisdiction: "UK",
      state: null,
      decisionId: `UKD-${String(n).padStart(5, "0")}`,
      claimId: `CLM-UK-${line === "UK_HOME" ? "HM" : "MT"}-${String(300000 + n * 37).slice(-6)}`,
      insurer: pick(INSURERS),
      line,
      proposedAction: action,
      aiInvolvement: ai,
      modelId: ai === "NONE" ? null : line === "UK_HOME" ? "home-claims-triage" : "motor-claims-triage",
      modelVersion: ai === "NONE" || rnd() < 0.07 ? null : pick(["1.8.0", "2.0.2", "2.1.0"]),
      modelVendor: vendor,
      vendorAssessmentRef: vendor && rnd() < 0.75 ? `OSR-${between(100, 999)}` : null,
      humanReview: reviewed
        ? { reviewerId: `CH-${between(100, 999)}`, role: vulnerable && rnd() < 0.5 ? "CLAIMS_MANAGER" : "CLAIMS_HANDLER", reviewedAt: daysBefore(between(0, 3)), rationale: "Reviewed the claim file and policy wording." }
        : null,
      repudiationGround: ground,
      exclusionClauseRef: adverse && rnd() < 0.82 ? `Section ${between(1, 6)}, Exclusion ${between(1, 9)}` : null,
      denialFactualBasis: adverse && rnd() < 0.85 ? "Damage caused by gradual wear and tear, which the policy excludes." : null,
      fraudInvestigationRef: ground === "FRAUD" && rnd() < 0.5 ? `CFU-${between(1000, 9999)}` : null,
      misrepresentationType: ground === "NON_DISCLOSURE" ? pick(["DELIBERATE_OR_RECKLESS", "CARELESS", "CARELESS", "INNOCENT"] as const) : null,
      vulnerableCustomer: vulnerable,
      automatedSafeguardsNotified: ai === "AUTOMATED" ? rnd() < 0.6 : false,
      decisiveFactors: adverse ? (rnd() < 0.07 ? ["REPAIR_COST", "POSTCODE"] : ["REPAIR_COST", "CLAIM_HISTORY"]) : [],
      monthsContinuousCoverage: between(1, 120),
      claimAmount: amount,
      approvedAmount: action === "APPROVE_PARTIAL" ? Math.round(amount * (0.4 + rnd() * 0.5)) : action === "APPROVE_FULL" ? amount : null,
      dataPurposes: ["CLAIM_ASSESSMENT"],
      timeline,
      evaluatedAt: AS_OF,
    });
  }
  return out;
}

const handler = { reviewerId: "CH-214", role: "CLAIMS_HANDLER" as const, reviewedAt: daysBefore(0), rationale: "Reviewed the claim file and policy wording." };

const base = (id: string, patch: Partial<ClaimDecisionInput>): ClaimDecisionInput => ({
  jurisdiction: "UK",
  state: null,
  decisionId: id,
  claimId: `CLM-UK-DEMO-${id.slice(-3)}`,
  insurer: "Demo UK Insurer A",
  line: "UK_MOTOR",
  proposedAction: "APPROVE_FULL",
  aiInvolvement: "AI_RECOMMENDED",
  modelId: "motor-claims-triage",
  modelVersion: "2.1.0",
  modelVendor: null,
  vendorAssessmentRef: null,
  humanReview: null,
  repudiationGround: null,
  exclusionClauseRef: null,
  denialFactualBasis: null,
  fraudInvestigationRef: null,
  misrepresentationType: null,
  vulnerableCustomer: false,
  automatedSafeguardsNotified: false,
  decisiveFactors: [],
  monthsContinuousCoverage: 30,
  claimAmount: 6400,
  approvedAmount: null,
  dataPurposes: ["CLAIM_ASSESSMENT"],
  timeline: { intimatedAt: daysBefore(10) },
  evaluatedAt: AS_OF,
  ...patch,
});

const decline = {
  proposedAction: "REPUDIATE" as const,
  repudiationGround: "POLICY_EXCLUSION" as const,
  exclusionClauseRef: "Section 2, Exclusion 3",
  denialFactualBasis: "Vehicle used for commuting outside the declared social use.",
  decisiveFactors: ["TELEMATICS_MILEAGE"],
};

export const UK_SCENARIOS: Scenario[] = [
  {
    id: "k1",
    label: "AI declines a motor claim with no claims-handler review",
    expected: "ESCALATE",
    input: base("UKC-001", { ...decline }),
  },
  {
    id: "k2",
    label: "Home claim refused for an innocent misrepresentation",
    expected: "BLOCK",
    input: base("UKC-002", {
      ...decline,
      line: "UK_HOME",
      modelId: "home-claims-triage",
      repudiationGround: "NON_DISCLOSURE",
      misrepresentationType: "INNOCENT",
      exclusionClauseRef: "General Conditions, Your Duty to Take Care",
      denialFactualBasis: "Previous subsidence not declared at inception.",
      humanReview: handler,
    }),
  },
  {
    id: "k3",
    label: "Home claim declined on a fraud score alone",
    expected: "BLOCK",
    input: base("UKC-003", {
      ...decline,
      line: "UK_HOME",
      modelId: "counter-fraud-score",
      repudiationGround: "FRAUD",
      exclusionClauseRef: "General Conditions, Fraud",
      denialFactualBasis: "Fraud score 0.91 on claim pattern.",
      humanReview: handler,
    }),
  },
  {
    id: "k4",
    label: "Fully automated decline, customer not told of right to human review",
    expected: "ESCALATE",
    input: base("UKC-004", { ...decline, aiInvolvement: "AUTOMATED" }),
  },
  {
    id: "k5",
    label: "Vulnerable customer, AI-recommended partial settlement",
    expected: "ESCALATE",
    input: base("UKC-005", {
      proposedAction: "APPROVE_PARTIAL",
      approvedAmount: 3900,
      vulnerableCustomer: true,
      humanReview: handler,
      exclusionClauseRef: "Section 1, Limit of Cover",
      denialFactualBasis: "Repair estimate above the vehicle's market value.",
      decisiveFactors: ["REPAIR_COST"],
    }),
  },
  {
    id: "k6",
    label: "Agreed settlement still unpaid after three weeks",
    expected: "ESCALATE",
    input: base("UKC-006", { approvedAmount: 6400, timeline: { intimatedAt: daysBefore(35), acceptedAt: daysBefore(21) } }),
  },
  {
    id: "k7",
    label: "Partial settlement where postcode drove the outcome",
    expected: "ESCALATE",
    input: base("UKC-007", {
      proposedAction: "APPROVE_PARTIAL",
      approvedAmount: 4100,
      humanReview: handler,
      exclusionClauseRef: "Section 1, Limit of Cover",
      denialFactualBasis: "Repair estimate exceeds approved repairer rates.",
      decisiveFactors: ["REPAIR_COST", "POSTCODE"],
    }),
  },
  {
    id: "k8",
    label: "Clean AI-assisted motor approval, paid promptly",
    expected: "APPROVE",
    input: base("UKC-008", { aiInvolvement: "ASSISTED", approvedAmount: 6400, timeline: { intimatedAt: daysBefore(10), acceptedAt: daysBefore(5), paidAt: daysBefore(3) } }),
  },
];
