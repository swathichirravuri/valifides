// Synthetic claim decisions for the demo. No real people, policies or insurers.
import type { ClaimDecisionInput, ClaimLine, DataPurpose, ProposedAction, RepudiationGround } from "./types";

export const AS_OF = "2026-10-01T10:00:00+05:30";
const AS_OF_MS = Date.parse(AS_OF);
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const iso = (msValue: number) => new Date(msValue).toISOString();
const before = (minutes: number) => iso(AS_OF_MS - minutes * MIN);
const daysBefore = (days: number) => iso(AS_OF_MS - days * DAY);

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

const INSURERS = ["Demo General Insurer A", "Demo Health Insurer B", "Demo Motor Insurer C"];

export function generateSyntheticDecisions(count = 240, seed = 20261001): ClaimDecisionInput[] {
  const rnd = mulberry32(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const between = (lo: number, hi: number) => Math.round(lo + rnd() * (hi - lo));
  const out: ClaimDecisionInput[] = [];

  for (let n = 1; n <= count; n++) {
    const line: ClaimLine = pick(["HEALTH_CASHLESS", "HEALTH_CASHLESS", "HEALTH_REIMBURSEMENT", "MOTOR_OWN_DAMAGE", "MOTOR_OWN_DAMAGE"] as const);
    const action: ProposedAction = pick(["APPROVE_FULL", "APPROVE_FULL", "APPROVE_FULL", "APPROVE_PARTIAL", "REPUDIATE", "PENDING", "PENDING"] as const);
    const ai = rnd() < 0.7 ? (rnd() < 0.5 ? "AI_RECOMMENDED" : "ASSISTED") : "NONE";
    const adverse = action === "REPUDIATE" || action === "APPROVE_PARTIAL";
    const reviewed = !adverse || rnd() < 0.72;
    const ground: RepudiationGround | null =
      action === "REPUDIATE" ? pick(["FRAUD", "NON_DISCLOSURE", "POLICY_EXCLUSION", "POLICY_EXCLUSION", "POLICY_LAPSED", "OTHER"] as const) : null;
    const months = between(3, 110);
    const amount = line === "MOTOR_OWN_DAMAGE" ? between(15000, 300000) : between(30000, 600000);
    const intimatedDaysAgo = between(1, 40);
    const purposes: DataPurpose[] = rnd() < 0.06 ? ["CLAIM_ASSESSMENT", "CROSS_SELL_MODEL_TRAINING"] : rnd() < 0.3 ? ["CLAIM_ASSESSMENT", "FRAUD_PREVENTION"] : ["CLAIM_ASSESSMENT"];

    const timeline: ClaimDecisionInput["timeline"] = { intimatedAt: daysBefore(intimatedDaysAgo) };
    if (line === "HEALTH_CASHLESS" && action === "PENDING") {
      if (rnd() < 0.5) timeline.cashlessRequestedAt = before(between(10, 130));
      else timeline.dischargeRequestedAt = before(between(30, 300));
    }
    if (line === "MOTOR_OWN_DAMAGE") {
      const appointed = Math.min(intimatedDaysAgo, between(1, 30));
      timeline.surveyorAppointedAt = daysBefore(appointed);
      if (rnd() < 0.75 || action !== "PENDING") timeline.surveyReportAt = daysBefore(Math.max(0, appointed - between(3, 18)));
    }
    if (rnd() < 0.35) {
      timeline.documentQueryDates = [daysBefore(Math.max(0, intimatedDaysAgo - between(2, 10)))];
      if (rnd() < 0.3) timeline.documentQueryDates.push(daysBefore(Math.max(0, intimatedDaysAgo - between(16, 30))));
    }
    if (action === "APPROVE_FULL" || action === "APPROVE_PARTIAL") {
      const acceptedAgo = between(1, Math.max(2, intimatedDaysAgo));
      timeline.acceptedAt = daysBefore(acceptedAgo);
      if (rnd() < 0.8) timeline.paidAt = daysBefore(Math.max(0, acceptedAgo - between(2, 22)));
    }

    out.push({
      jurisdiction: "IN",
      decisionId: `DEC-${String(n).padStart(5, "0")}`,
      claimId: `CLM-${line === "MOTOR_OWN_DAMAGE" ? "MOT" : "HLT"}-${String(100000 + n * 37).slice(-6)}`,
      insurer: line === "MOTOR_OWN_DAMAGE" ? pick([INSURERS[0], INSURERS[2]]) : pick([INSURERS[0], INSURERS[1]]),
      line,
      proposedAction: action,
      aiInvolvement: ai,
      modelId: ai === "NONE" ? null : line === "MOTOR_OWN_DAMAGE" ? "damage-estimator" : "claims-triage",
      modelVersion: ai === "NONE" || rnd() < 0.08 ? null : pick(["3.2.0", "3.2.1", "4.0.0"]),
      humanReview:
        adverse && reviewed
          ? {
              reviewerId: `REV-${between(100, 999)}`,
              role: rnd() < 0.1 ? "SURVEYOR" : line === "MOTOR_OWN_DAMAGE" ? "CLAIMS_OFFICER" : "MEDICAL_OFFICER",
              reviewedAt: before(between(5, 600)),
              rationale: "Reviewed claim file and AI recommendation.",
            }
          : null,
      repudiationGround: ground,
      exclusionClauseRef: ground === "POLICY_EXCLUSION" && rnd() < 0.7 ? `Sch. ${between(1, 4)}.${between(1, 12)}` : null,
      fraudInvestigationRef: ground === "FRAUD" && rnd() < 0.5 ? `INV-${between(1000, 9999)}` : null,
      monthsContinuousCoverage: months,
      claimAmount: amount,
      approvedAmount: action === "APPROVE_PARTIAL" ? Math.round(amount * (0.4 + rnd() * 0.5)) : action === "APPROVE_FULL" ? amount : null,
      dataPurposes: purposes,
      timeline,
      evaluatedAt: AS_OF,
    });
  }
  return out;
}

const base = (id: string, patch: Partial<ClaimDecisionInput>): ClaimDecisionInput => ({
  jurisdiction: "IN",
  decisionId: id,
  claimId: `CLM-DEMO-${id.slice(-3)}`,
  insurer: "Demo General Insurer A",
  line: "MOTOR_OWN_DAMAGE",
  proposedAction: "APPROVE_FULL",
  aiInvolvement: "AI_RECOMMENDED",
  modelId: "damage-estimator",
  modelVersion: "4.0.0",
  humanReview: null,
  repudiationGround: null,
  exclusionClauseRef: null,
  fraudInvestigationRef: null,
  monthsContinuousCoverage: 24,
  claimAmount: 85000,
  approvedAmount: null,
  dataPurposes: ["CLAIM_ASSESSMENT"],
  timeline: { intimatedAt: daysBefore(6), surveyorAppointedAt: daysBefore(6), surveyReportAt: daysBefore(2) },
  evaluatedAt: AS_OF,
  ...patch,
});

export interface Scenario {
  id: string;
  label: string;
  expected: string;
  input: ClaimDecisionInput;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "s1",
    label: "AI repudiates a motor claim, no human review",
    expected: "ESCALATE",
    input: base("SCN-001", { proposedAction: "REPUDIATE", repudiationGround: "POLICY_EXCLUSION", exclusionClauseRef: "Sch. 2.4" }),
  },
  {
    id: "s2",
    label: "Health repudiation for non-disclosure after 72 months",
    expected: "BLOCK",
    input: base("SCN-002", {
      line: "HEALTH_REIMBURSEMENT",
      insurer: "Demo Health Insurer B",
      modelId: "claims-triage",
      proposedAction: "REPUDIATE",
      repudiationGround: "NON_DISCLOSURE",
      monthsContinuousCoverage: 72,
      claimAmount: 240000,
      humanReview: { reviewerId: "REV-311", role: "MEDICAL_OFFICER", reviewedAt: before(40), rationale: "Agreed with AI flag on pre-existing condition." },
      timeline: { intimatedAt: daysBefore(9) },
    }),
  },
  {
    id: "s3",
    label: "Fraud repudiation on a fraud score alone",
    expected: "BLOCK",
    input: base("SCN-003", {
      proposedAction: "REPUDIATE",
      repudiationGround: "FRAUD",
      humanReview: { reviewerId: "REV-208", role: "CLAIMS_OFFICER", reviewedAt: before(15), rationale: "Fraud score 0.91." },
    }),
  },
  {
    id: "s4",
    label: "Cashless pre-authorisation pending 95 minutes",
    expected: "ESCALATE",
    input: base("SCN-004", {
      line: "HEALTH_CASHLESS",
      insurer: "Demo Health Insurer B",
      modelId: "claims-triage",
      proposedAction: "PENDING",
      claimAmount: 180000,
      timeline: { intimatedAt: before(95), cashlessRequestedAt: before(95) },
    }),
  },
  {
    id: "s5",
    label: "Clean AI-assisted approval, paid on time",
    expected: "APPROVE",
    input: base("SCN-005", {
      aiInvolvement: "ASSISTED",
      approvedAmount: 85000,
      timeline: { intimatedAt: daysBefore(8), surveyorAppointedAt: daysBefore(8), surveyReportAt: daysBefore(4), acceptedAt: daysBefore(3), paidAt: daysBefore(1) },
    }),
  },
  {
    id: "s6",
    label: "Claim data sent to a cross-sell model",
    expected: "BLOCK",
    input: base("SCN-006", { dataPurposes: ["CLAIM_ASSESSMENT", "CROSS_SELL_MODEL_TRAINING"], approvedAmount: 85000 }),
  },
  {
    id: "s7",
    label: "Accepted claim unpaid after 28 days",
    expected: "ESCALATE",
    input: base("SCN-007", {
      approvedAmount: 120000,
      claimAmount: 120000,
      timeline: { intimatedAt: daysBefore(40), surveyorAppointedAt: daysBefore(39), surveyReportAt: daysBefore(31), acceptedAt: daysBefore(28) },
    }),
  },
];
