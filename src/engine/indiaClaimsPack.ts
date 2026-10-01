// India insurance claims rule pack (draft).
// Every rule is deterministic: the same input always produces the same result.
// Sources are drafts compiled from public summaries and MUST be verified by
// insurance counsel before any customer use. This is not legal advice.

import type { ClaimDecisionInput, Rule, RulePack } from "./types";

export const RULE_PACK_ID = "IN-CLAIMS";
export const RULE_PACK_VERSION = "0.1.0-draft";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const PENAL_RATE_PA = 0.085; // bank rate + 2% as reported for 2024 norms; verify

const ms = (iso?: string | null) => (iso ? Date.parse(iso) : NaN);
const elapsed = (from?: string | null, to?: string | null) => ms(to) - ms(from);
const isAdverse = (i: ClaimDecisionInput) =>
  i.proposedAction === "REPUDIATE" || i.proposedAction === "APPROVE_PARTIAL";
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const NA = { outcome: "NOT_APPLICABLE" as const, message: "Not applicable to this decision." };
const PASS = (message: string) => ({ outcome: "PASS" as const, message });

const ALL_LINES = ["HEALTH_CASHLESS", "HEALTH_REIMBURSEMENT", "MOTOR_OWN_DAMAGE"] as const;
const HEALTH = ["HEALTH_CASHLESS", "HEALTH_REIMBURSEMENT"] as const;

export const RULES: Rule[] = [
  {
    id: "IN-CLM-01",
    title: "Human review before an AI-influenced adverse decision",
    appliesTo: [...ALL_LINES],
    onBreach: "ESCALATE",
    source: "Valifides control; IRDAI AI working group (June 2026) names claims processing as a priority area",
    sourceStatus: "Valifides control (anticipates IRDAI AI framework)",
    description:
      "A repudiation or partial settlement influenced by AI must carry a recorded review by an authorised claims or medical officer before it takes effect.",
    check: (i, def) => {
      if (i.aiInvolvement === "NONE" || !isAdverse(i)) return NA;
      if (!i.humanReview)
        return {
          outcome: def.onBreach,
          message: "AI-influenced adverse decision has no recorded human review.",
          remediation: "Route to a claims or medical officer; record reviewer, time and rationale.",
        };
      const allowed = ["CLAIMS_OFFICER", "MEDICAL_OFFICER", "CLAIMS_REVIEW_COMMITTEE"];
      if (i.proposedAction === "REPUDIATE" && !allowed.includes(i.humanReview.role))
        return {
          outcome: def.onBreach,
          message: `Repudiation reviewed by ${i.humanReview.role}, which is not an authorised role for repudiation.`,
          remediation: "Repudiations need a claims officer, medical officer or Claims Review Committee.",
        };
      return PASS(`Reviewed by ${i.humanReview.role} (${i.humanReview.reviewerId}).`);
    },
  },
  {
    id: "IN-CLM-02",
    title: "Repudiation only on a permitted ground",
    appliesTo: [...ALL_LINES],
    onBreach: "BLOCK",
    source: "IRDAI (Protection of Policyholders' Interests) Regulations, 2024 — as reported",
    sourceStatus: "IRDAI requirement (verify with counsel)",
    description:
      "Repudiation must rest on fraud, material non-disclosure, a listed policy exclusion, or policy lapse on the date of loss.",
    check: (i, def) => {
      if (i.proposedAction !== "REPUDIATE") return NA;
      if (!i.repudiationGround || i.repudiationGround === "OTHER")
        return {
          outcome: def.onBreach,
          message: "Repudiation has no permitted ground recorded.",
          remediation: "Record one of: fraud, non-disclosure, policy exclusion, policy lapsed.",
        };
      return PASS(`Ground recorded: ${i.repudiationGround}.`);
    },
  },
  {
    id: "IN-CLM-03",
    title: "Moratorium: no non-disclosure repudiation after 60 months",
    appliesTo: [...HEALTH],
    onBreach: "BLOCK",
    source: "IRDAI Master Circular on Health Insurance Business, 2024 — as reported",
    sourceStatus: "IRDAI requirement (verify with counsel)",
    description:
      "After 60 months of continuous cover, a health claim cannot be contested for non-disclosure; only proven fraud or a permanent exclusion remains.",
    check: (i, def) => {
      if (i.proposedAction !== "REPUDIATE" || !HEALTH.includes(i.line as never)) return NA;
      if (i.monthsContinuousCoverage >= 60 && i.repudiationGround === "NON_DISCLOSURE")
        return {
          outcome: def.onBreach,
          message: `Policy has ${i.monthsContinuousCoverage} months of continuous cover; non-disclosure is not a valid ground.`,
          remediation: "Withdraw the repudiation or document proven fraud.",
        };
      return PASS(`${i.monthsContinuousCoverage} months of cover; moratorium check passed.`);
    },
  },
  {
    id: "IN-CLM-04",
    title: "Exclusion repudiation cites the policy clause",
    appliesTo: [...ALL_LINES],
    onBreach: "BLOCK",
    source: "IRDAI policyholder-protection norms (reasons in writing, exclusions in policy schedule) — as reported",
    sourceStatus: "IRDAI requirement (verify with counsel)",
    description: "A repudiation on an exclusion must reference the specific clause in the policy schedule.",
    check: (i, def) => {
      if (i.proposedAction !== "REPUDIATE" || i.repudiationGround !== "POLICY_EXCLUSION") return NA;
      if (!i.exclusionClauseRef)
        return {
          outcome: def.onBreach,
          message: "Exclusion-based repudiation does not cite a policy clause.",
          remediation: "Add the schedule clause reference to the decision and the customer letter.",
        };
      return PASS(`Cites clause ${i.exclusionClauseRef}.`);
    },
  },
  {
    id: "IN-CLM-05",
    title: "Fraud repudiation needs an investigation record",
    appliesTo: [...ALL_LINES],
    onBreach: "BLOCK",
    source: "Valifides control; supports IRDAI fraud-ground requirement",
    sourceStatus: "Valifides control (anticipates IRDAI AI framework)",
    description: "A fraud score alone cannot repudiate a claim; a completed investigation must be referenced.",
    check: (i, def) => {
      if (i.proposedAction !== "REPUDIATE" || i.repudiationGround !== "FRAUD") return NA;
      if (!i.fraudInvestigationRef)
        return {
          outcome: def.onBreach,
          message: "Fraud ground recorded without an investigation reference.",
          remediation: "Refer to the investigation unit; attach the report reference before repudiating.",
        };
      return PASS(`Investigation ${i.fraudInvestigationRef} referenced.`);
    },
  },
  {
    id: "IN-CLM-06",
    title: "Cashless pre-authorisation decided within 1 hour",
    appliesTo: ["HEALTH_CASHLESS"],
    onBreach: "ESCALATE",
    source: "IRDAI Master Circular on Health Insurance Business, 2024 — as reported",
    sourceStatus: "IRDAI requirement (verify with counsel)",
    description: "A cashless pre-authorisation request should be decided within 1 hour of receipt.",
    check: (i, def) => {
      if (i.line !== "HEALTH_CASHLESS" || !i.timeline.cashlessRequestedAt || i.timeline.dischargeRequestedAt) return NA;
      const mins = elapsed(i.timeline.cashlessRequestedAt, i.evaluatedAt) / 60000;
      if (i.proposedAction === "PENDING" && mins > 60)
        return {
          outcome: def.onBreach,
          message: `Pre-authorisation pending for ${Math.round(mins)} minutes (limit 60).`,
          remediation: "Escalate to the on-duty medical officer now.",
        };
      return PASS(`Pre-authorisation within limit (${Math.max(0, Math.round(mins))} min elapsed).`);
    },
  },
  {
    id: "IN-CLM-07",
    title: "Discharge authorisation within 3 hours",
    appliesTo: ["HEALTH_CASHLESS"],
    onBreach: "ESCALATE",
    source: "IRDAI Master Circular on Health Insurance Business, 2024 — as reported",
    sourceStatus: "IRDAI requirement (verify with counsel)",
    description:
      "Final authorisation at discharge should be given within 3 hours of the hospital's request; extra hospital charges from delay fall on the insurer.",
    check: (i, def) => {
      if (i.line !== "HEALTH_CASHLESS" || !i.timeline.dischargeRequestedAt) return NA;
      const mins = elapsed(i.timeline.dischargeRequestedAt, i.evaluatedAt) / 60000;
      if (i.proposedAction === "PENDING" && mins > 180)
        return {
          outcome: def.onBreach,
          message: `Discharge authorisation pending for ${Math.round(mins)} minutes (limit 180). Extra charges fall on the insurer.`,
          remediation: "Authorise or escalate immediately.",
        };
      return PASS(`Discharge authorisation within limit (${Math.max(0, Math.round(mins))} min elapsed).`);
    },
  },
  {
    id: "IN-CLM-08",
    title: "Surveyor report within 15 days",
    appliesTo: ["MOTOR_OWN_DAMAGE"],
    onBreach: "ESCALATE",
    source: "IRDAI (Protection of Policyholders' Interests) Regulations, 2024 — as reported",
    sourceStatus: "IRDAI requirement (verify with counsel)",
    description: "The surveyor's report is due within 15 days of appointment; otherwise a second surveyor is appointed at the insurer's cost.",
    check: (i, def) => {
      if (i.line !== "MOTOR_OWN_DAMAGE" || !i.timeline.surveyorAppointedAt || i.timeline.surveyReportAt) return NA;
      const days = elapsed(i.timeline.surveyorAppointedAt, i.evaluatedAt) / DAY;
      if (days > 15)
        return {
          outcome: def.onBreach,
          message: `Survey report outstanding ${Math.floor(days)} days after appointment (limit 15).`,
          remediation: "Appoint a second surveyor at the insurer's cost.",
        };
      return PASS(`Survey in progress (${Math.floor(days)} days).`);
    },
  },
  {
    id: "IN-CLM-09",
    title: "Decision within 7 days of the survey report",
    appliesTo: ["MOTOR_OWN_DAMAGE"],
    onBreach: "ESCALATE",
    source: "IRDAI (Protection of Policyholders' Interests) Regulations, 2024 — as reported",
    sourceStatus: "IRDAI requirement (verify with counsel)",
    description: "The insurer should decide the claim within 7 days of receiving the survey report.",
    check: (i, def) => {
      if (i.line !== "MOTOR_OWN_DAMAGE" || !i.timeline.surveyReportAt) return NA;
      const days = elapsed(i.timeline.surveyReportAt, i.evaluatedAt) / DAY;
      if (i.proposedAction === "PENDING" && days > 7)
        return {
          outcome: def.onBreach,
          message: `No decision ${Math.floor(days)} days after the survey report (limit 7).`,
          remediation: "Decide now; penal interest risk is building.",
        };
      return PASS("Decision timeline within limit.");
    },
  },
  {
    id: "IN-CLM-10",
    title: "Document requests raised upfront (within 15 days)",
    appliesTo: [...ALL_LINES],
    onBreach: "ESCALATE",
    source: "IRDAI (Protection of Policyholders' Interests) Regulations, 2024 — as reported",
    sourceStatus: "IRDAI requirement (verify with counsel)",
    description: "Additional documents should be requested together, within 15 days of intimation, not piecemeal.",
    check: (i, def) => {
      const qs = i.timeline.documentQueryDates ?? [];
      if (qs.length === 0) return NA;
      const late = qs.filter((q) => elapsed(i.timeline.intimatedAt, q) / DAY > 15);
      if (late.length > 0 || qs.length > 1)
        return {
          outcome: def.onBreach,
          message: `${qs.length} document request(s); ${late.length} raised after day 15.`,
          remediation: "Consolidate requests; document why any later request could not be anticipated.",
        };
      return PASS("Single document request within 15 days.");
    },
  },
  {
    id: "IN-CLM-11",
    title: "Payment within 15 days of acceptance (penal interest)",
    appliesTo: [...ALL_LINES],
    onBreach: "ESCALATE",
    source: "IRDAI (Protection of Policyholders' Interests) Regulations, 2024 — as reported (bank rate + 2%)",
    sourceStatus: "IRDAI requirement (verify with counsel)",
    description: "Accepted claims should be paid within 15 days; after that, penal interest accrues automatically.",
    check: (i, def) => {
      if (!i.timeline.acceptedAt) return NA;
      const end = i.timeline.paidAt ?? i.evaluatedAt;
      const days = elapsed(i.timeline.acceptedAt, end) / DAY;
      if (days <= 15) return PASS(`Paid or due within limit (${Math.floor(days)} days).`);
      const overdueDays = days - 15;
      const amount = i.approvedAmount ?? i.claimAmount;
      const interest = amount * PENAL_RATE_PA * (overdueDays / 365);
      return {
        outcome: def.onBreach,
        message: `${i.timeline.paidAt ? "Paid" : "Unpaid"} ${Math.floor(days)} days after acceptance; penal interest about ${inr(interest)}.`,
        remediation: "Release payment and add penal interest without waiting for a customer request.",
        penalInterest: Math.round(interest),
      };
    },
  },
  {
    id: "IN-CLM-12",
    title: "Claim data used only for claim purposes",
    appliesTo: [...ALL_LINES],
    onBreach: "BLOCK",
    source: "Digital Personal Data Protection Act, 2023 (purpose limitation); DPDP Rules 2025 core obligations from 13 May 2027",
    sourceStatus: "Statute (in force from 13 May 2027)",
    description: "Personal data collected for a claim may not feed marketing or cross-sell models without a separate lawful basis.",
    check: (i, def) => {
      const allowed = ["CLAIM_ASSESSMENT", "FRAUD_PREVENTION", "REGULATORY_REPORTING"];
      const bad = i.dataPurposes.filter((p) => !allowed.includes(p));
      if (bad.length)
        return {
          outcome: def.onBreach,
          message: `Claim data flagged for out-of-scope use: ${bad.join(", ")}.`,
          remediation: "Remove the purpose, or obtain and record a separate consent.",
        };
      return PASS("Data use limited to claim purposes.");
    },
  },
  {
    id: "IN-CLM-13",
    title: "AI involvement recorded with model version",
    appliesTo: [...ALL_LINES],
    onBreach: "ESCALATE",
    source: "Valifides control; supports audit expectations in the IRDAI AI working group's mandate",
    sourceStatus: "Valifides control (anticipates IRDAI AI framework)",
    description: "Where AI influenced a decision, the model and version must be recorded so the decision can be audited later.",
    check: (i, def) => {
      if (i.aiInvolvement === "NONE") return NA;
      if (!i.modelId || !i.modelVersion)
        return {
          outcome: def.onBreach,
          message: "AI involvement recorded without model ID and version.",
          remediation: "Record the model ID and version in the decision payload.",
        };
      return PASS(`${i.modelId} v${i.modelVersion} recorded.`);
    },
  },
];

export const INDIA_PACK: RulePack = {
  id: RULE_PACK_ID,
  version: RULE_PACK_VERSION,
  jurisdiction: "IN",
  name: "India claims",
  currency: "INR",
  lines: [...ALL_LINES],
  rules: RULES,
};
