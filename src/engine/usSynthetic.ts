// Synthetic US P&C claim decisions for the demo. No real people, policies or insurers.
import { AS_OF, type Scenario } from "./synthetic";
import type { ClaimDecisionInput, ClaimLine, ProposedAction, RepudiationGround, UsState } from "./types";

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

const CARRIERS = ["Demo P&C Carrier A", "Demo P&C Carrier B"];
const VENDORS = ["Demo Estimating Vendor", "Demo Fraud Analytics Vendor"];

export function generateUsSyntheticDecisions(count = 240, seed = 20261002): ClaimDecisionInput[] {
  const rnd = mulberry32(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const between = (lo: number, hi: number) => Math.round(lo + rnd() * (hi - lo));
  const out: ClaimDecisionInput[] = [];

  for (let n = 1; n <= count; n++) {
    const state: UsState = pick(["CA", "CA", "TX", "TX", "FL"] as const);
    const line: ClaimLine = state === "FL" || rnd() < 0.35 ? "US_HOMEOWNERS" : "US_AUTO_PHYSICAL_DAMAGE";
    const action: ProposedAction = pick(["APPROVE_FULL", "APPROVE_FULL", "APPROVE_FULL", "APPROVE_PARTIAL", "REPUDIATE", "PENDING", "PENDING"] as const);
    const ai = rnd() < 0.75 ? (rnd() < 0.5 ? "AI_RECOMMENDED" : "ASSISTED") : "NONE";
    const adverse = action === "REPUDIATE" || action === "APPROVE_PARTIAL";
    const ground: RepudiationGround | null = action === "REPUDIATE" ? pick(["FRAUD", "POLICY_EXCLUSION", "POLICY_EXCLUSION", "NOT_COVERED", "POLICY_LAPSED"] as const) : null;
    const amount = line === "US_HOMEOWNERS" ? between(3000, 85000) : between(1500, 28000);
    const noticeAgo = between(3, 75);
    const vendor = ai !== "NONE" && rnd() < 0.6 ? pick(VENDORS) : null;

    const timeline: ClaimDecisionInput["timeline"] = { intimatedAt: daysBefore(noticeAgo) };
    if (rnd() < 0.96) timeline.acknowledgedAt = daysBefore(Math.max(0, noticeAgo - (rnd() < 0.93 ? between(1, 6) : between(9, 25))));
    if (rnd() < 0.85) timeline.proofOfClaimAt = daysBefore(Math.max(0, noticeAgo - between(2, 12)));
    if (action === "PENDING" && rnd() < 0.35 && timeline.proofOfClaimAt) timeline.delayNoticeDates = [daysBefore(between(1, 40))];
    if (action === "APPROVE_FULL" || action === "APPROVE_PARTIAL") {
      const acceptedAgo = between(1, Math.max(2, noticeAgo - 2));
      timeline.acceptedAt = daysBefore(acceptedAgo);
      if (rnd() < 0.8) timeline.paidAt = daysBefore(Math.max(0, acceptedAgo - (rnd() < 0.82 ? between(0, 4) : between(8, 30))));
    }
    const factors = rnd() < 0.06 ? ["ESTIMATE_GAP", "ZIP_CODE"] : ["ESTIMATE_GAP", "PRIOR_CLAIMS"];

    out.push({
      jurisdiction: "US",
      state,
      decisionId: `USD-${String(n).padStart(5, "0")}`,
      claimId: `CLM-${state}-${line === "US_HOMEOWNERS" ? "HO" : "AU"}-${String(200000 + n * 41).slice(-6)}`,
      insurer: pick(CARRIERS),
      line,
      proposedAction: action,
      aiInvolvement: ai,
      modelId: ai === "NONE" ? null : line === "US_HOMEOWNERS" ? "property-damage-estimator" : "auto-damage-estimator",
      modelVersion: ai === "NONE" || rnd() < 0.07 ? null : pick(["2.4.0", "2.5.1", "3.0.0"]),
      modelVendor: vendor,
      vendorAssessmentRef: vendor && rnd() < 0.75 ? `VDD-${between(100, 999)}` : null,
      humanReview:
        adverse && rnd() < 0.72
          ? { reviewerId: `ADJ-${between(100, 999)}`, role: rnd() < 0.1 ? "CLAIMS_OFFICER" : "LICENSED_ADJUSTER", reviewedAt: daysBefore(between(0, 3)), rationale: "Reviewed estimate, photos and policy." }
          : null,
      repudiationGround: ground,
      exclusionClauseRef: adverse && rnd() < 0.8 ? `Section ${pick(["I", "II"])}, Exclusion ${between(1, 12)}` : null,
      denialFactualBasis: adverse && rnd() < 0.85 ? "Damage predates the policy period per inspection photos." : null,
      fraudInvestigationRef: ground === "FRAUD" && rnd() < 0.5 ? `SIU-${between(1000, 9999)}` : null,
      decisiveFactors: adverse ? factors : [],
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

const review = { reviewerId: "ADJ-214", role: "LICENSED_ADJUSTER" as const, reviewedAt: daysBefore(0), rationale: "Reviewed estimate, photos and policy." };

const base = (id: string, patch: Partial<ClaimDecisionInput>): ClaimDecisionInput => ({
  jurisdiction: "US",
  state: "CA",
  decisionId: id,
  claimId: `CLM-US-DEMO-${id.slice(-3)}`,
  insurer: "Demo P&C Carrier A",
  line: "US_AUTO_PHYSICAL_DAMAGE",
  proposedAction: "APPROVE_FULL",
  aiInvolvement: "AI_RECOMMENDED",
  modelId: "auto-damage-estimator",
  modelVersion: "3.0.0",
  modelVendor: null,
  vendorAssessmentRef: null,
  humanReview: null,
  repudiationGround: null,
  exclusionClauseRef: null,
  denialFactualBasis: null,
  fraudInvestigationRef: null,
  decisiveFactors: [],
  monthsContinuousCoverage: 24,
  claimAmount: 9800,
  approvedAmount: null,
  dataPurposes: ["CLAIM_ASSESSMENT"],
  timeline: { intimatedAt: daysBefore(12), acknowledgedAt: daysBefore(10), proofOfClaimAt: daysBefore(8) },
  evaluatedAt: AS_OF,
  ...patch,
});

export const US_SCENARIOS: Scenario[] = [
  {
    id: "u1",
    label: "AI denies an auto claim in California, no adjuster review",
    expected: "ESCALATE",
    input: base("USC-001", { proposedAction: "REPUDIATE", repudiationGround: "POLICY_EXCLUSION", exclusionClauseRef: "Part D, Exclusion 4", denialFactualBasis: "Damage from racing activity per telematics data." }),
  },
  {
    id: "u2",
    label: "Texas denial that cites no policy provision",
    expected: "BLOCK",
    input: base("USC-002", { state: "TX", proposedAction: "REPUDIATE", repudiationGround: "NOT_COVERED", humanReview: review }),
  },
  {
    id: "u3",
    label: "Florida homeowners denial on a fraud score alone",
    expected: "BLOCK",
    input: base("USC-003", {
      state: "FL",
      line: "US_HOMEOWNERS",
      modelId: "fraud-score",
      claimAmount: 42000,
      proposedAction: "REPUDIATE",
      repudiationGround: "FRAUD",
      exclusionClauseRef: "Section I, Conditions, Concealment or Fraud",
      denialFactualBasis: "Fraud score 0.93 on claim pattern.",
      humanReview: review,
      timeline: { intimatedAt: daysBefore(20), acknowledgedAt: daysBefore(18) },
    }),
  },
  {
    id: "u4",
    label: "California claim undecided 48 days after proof, no status notice",
    expected: "ESCALATE",
    input: base("USC-004", { proposedAction: "PENDING", timeline: { intimatedAt: daysBefore(55), acknowledgedAt: daysBefore(53), proofOfClaimAt: daysBefore(48) } }),
  },
  {
    id: "u5",
    label: "Texas accepted claim unpaid for three weeks",
    expected: "ESCALATE",
    input: base("USC-005", {
      state: "TX",
      approvedAmount: 14500,
      claimAmount: 14500,
      timeline: { intimatedAt: daysBefore(40), acknowledgedAt: daysBefore(38), proofOfClaimAt: daysBefore(32), acceptedAt: daysBefore(21) },
    }),
  },
  {
    id: "u6",
    label: "Vendor AI model used with no vendor due-diligence record",
    expected: "ESCALATE",
    input: base("USC-006", { modelVendor: "Demo Estimating Vendor", approvedAmount: 9800, timeline: { intimatedAt: daysBefore(12), acknowledgedAt: daysBefore(10), proofOfClaimAt: daysBefore(8), acceptedAt: daysBefore(3), paidAt: daysBefore(1) } }),
  },
  {
    id: "u7",
    label: "Partial payment where ZIP code drove the outcome",
    expected: "ESCALATE",
    input: base("USC-007", {
      proposedAction: "APPROVE_PARTIAL",
      approvedAmount: 6100,
      humanReview: review,
      exclusionClauseRef: "Part D, Limit of Liability",
      denialFactualBasis: "Repair estimate exceeds prevailing local labour rates.",
      decisiveFactors: ["ESTIMATE_GAP", "ZIP_CODE"],
    }),
  },
  {
    id: "u8",
    label: "Clean AI-assisted approval, paid on time (California)",
    expected: "APPROVE",
    input: base("USC-008", {
      aiInvolvement: "ASSISTED",
      approvedAmount: 9800,
      timeline: { intimatedAt: daysBefore(12), acknowledgedAt: daysBefore(10), proofOfClaimAt: daysBefore(8), acceptedAt: daysBefore(4), paidAt: daysBefore(2) },
    }),
  },
];
