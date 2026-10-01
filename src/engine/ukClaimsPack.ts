// United Kingdom general-insurance claims rule pack (draft): consumer motor and home.
// Deterministic. Sources are drafts compiled from the FCA Handbook, statutes and public summaries
// and MUST be verified by UK insurance counsel before any customer use. This is not legal advice.

import type { ClaimDecisionInput, Rule, RulePack } from "./types";

export const UK_PACK_ID = "UK-CLAIMS";
export const UK_PACK_VERSION = "0.1.0-draft";

const DAY = 24 * 60 * 60 * 1000;
/** Valifides default for "settle promptly once terms are agreed"; configurable per insurer. */
export const UK_SETTLEMENT_THRESHOLD_DAYS = 14;

const ms = (iso?: string | null) => (iso ? Date.parse(iso) : NaN);
const days = (from?: string | null, to?: string | null) => (ms(to) - ms(from)) / DAY;
const isAdverse = (i: ClaimDecisionInput) => i.proposedAction === "REPUDIATE" || i.proposedAction === "APPROVE_PARTIAL";
const aiUsed = (i: ClaimDecisionInput) => i.aiInvolvement !== "NONE";

const NA = (message = "Not applicable to this decision.") => ({ outcome: "NOT_APPLICABLE" as const, message });
const PASS = (message: string) => ({ outcome: "PASS" as const, message });
const UK_LINES = ["UK_MOTOR", "UK_HOME"] as const;

const PROTECTED = ["RACE", "ETHNICITY", "NATIONALITY", "RELIGION", "SEX", "DISABILITY", "SEXUAL_ORIENTATION", "PREGNANCY"];
const PROXIES = ["POSTCODE", "PREFERRED_LANGUAGE"];

export const UK_RULES: Rule[] = [
  {
    id: "UK-CLM-01",
    title: "Claims-handler review before an AI-influenced decline",
    appliesTo: [...UK_LINES],
    onBreach: "ESCALATE",
    source: "FCA Consumer Duty, PRIN 2A (consumer support outcome); FCA 2026 priorities (monitor outcomes where AI is used in claims)",
    sourceStatus: "Valifides control (aligned to FCA Consumer Duty)",
    description: "A decline or partial settlement influenced by AI must carry a recorded review by an authorised claims handler or claims manager before it takes effect.",
    check: (i, def) => {
      if (!aiUsed(i) || !isAdverse(i)) return NA();
      if (!i.humanReview)
        return { outcome: def.onBreach, message: "AI-influenced decline has no recorded claims-handler review.", remediation: "Route to an authorised claims handler; record reviewer, time and rationale." };
      if (!["CLAIMS_HANDLER", "CLAIMS_MANAGER"].includes(i.humanReview.role))
        return { outcome: def.onBreach, message: `Reviewed by ${i.humanReview.role}, which is not an authorised role for this decision.`, remediation: "Have an authorised claims handler or claims manager review it." };
      return PASS(`Reviewed by ${i.humanReview.role} (${i.humanReview.reviewerId}).`);
    },
  },
  {
    id: "UK-CLM-02",
    title: "Decline explains the reason and the policy term",
    appliesTo: [...UK_LINES],
    onBreach: "BLOCK",
    source: "FCA ICOBS 8.1.1R (handle claims fairly; not unreasonably reject); PRIN 2A.5 (consumer understanding outcome)",
    sourceStatus: "FCA rule or UK statute (verify with counsel)",
    description: "A decline or partial settlement must name the policy term relied on and explain, in plain language, how it applies.",
    check: (i, def) => {
      if (!isAdverse(i)) return NA();
      const missing = [!i.exclusionClauseRef && "policy term", !(i.denialFactualBasis && i.denialFactualBasis.trim().length >= 10) && "explanation"].filter(Boolean);
      if (missing.length)
        return { outcome: def.onBreach, message: `Decline letter is missing the ${missing.join(" and the ")}.`, remediation: "Name the policy term and explain how it applies to the facts before sending." };
      return PASS(`Cites ${i.exclusionClauseRef}; explanation recorded.`);
    },
  },
  {
    id: "UK-CLM-03",
    title: "Misrepresentation decline follows the CIDRA remedies",
    appliesTo: [...UK_LINES],
    onBreach: "BLOCK",
    source: "Consumer Insurance (Disclosure and Representations) Act 2012 ss.4–5 and Sch. 1; ICOBS 8.1.2R–8.1.3R",
    sourceStatus: "FCA rule or UK statute (verify with counsel)",
    description:
      "A claim may be refused for misrepresentation only if it was a qualifying misrepresentation: deliberate or reckless allows avoidance; careless allows only a proportionate remedy; innocent allows none.",
    check: (i, def) => {
      if (!isAdverse(i) || i.repudiationGround !== "NON_DISCLOSURE") return NA();
      if (!i.misrepresentationType)
        return { outcome: def.onBreach, message: "Misrepresentation ground recorded without classifying it as deliberate or reckless, careless, or innocent.", remediation: "Classify the misrepresentation before deciding the remedy." };
      if (i.misrepresentationType === "INNOCENT")
        return { outcome: def.onBreach, message: "Innocent misrepresentation is not a qualifying misrepresentation; the claim cannot be refused on this ground.", remediation: "Settle the claim; correct the policy record going forward." };
      if (i.misrepresentationType === "CARELESS")
        return { outcome: "ESCALATE" as const, message: "Careless misrepresentation: only a proportionate remedy is allowed (what the insurer would have done had it known).", remediation: "Underwriting to confirm the counterfactual terms; apply the proportionate remedy, not an automatic refusal." };
      return PASS("Deliberate or reckless misrepresentation recorded; avoidance is available, subject to evidence.");
    },
  },
  {
    id: "UK-CLM-04",
    title: "Fraud decline needs a completed investigation",
    appliesTo: [...UK_LINES],
    onBreach: "BLOCK",
    source: "Insurance Act 2015 s.12 (remedies for fraudulent claims); Valifides control",
    sourceStatus: "Valifides control (aligned to FCA Consumer Duty)",
    description: "A fraud score alone cannot decline a claim; a counter-fraud investigation must be referenced.",
    check: (i, def) => {
      if (i.proposedAction !== "REPUDIATE" || i.repudiationGround !== "FRAUD") return NA();
      if (!i.fraudInvestigationRef)
        return { outcome: def.onBreach, message: "Fraud ground recorded without a counter-fraud investigation reference.", remediation: "Refer to the counter-fraud team; decline only on a completed investigation." };
      return PASS(`Investigation ${i.fraudInvestigationRef} referenced.`);
    },
  },
  {
    id: "UK-CLM-05",
    title: "Automated decline comes with the UK GDPR safeguards",
    appliesTo: [...UK_LINES],
    onBreach: "ESCALATE",
    source: "UK GDPR Arts 22A–22D, as inserted by the Data (Use and Access) Act 2025 (in force 5 Feb 2026)",
    sourceStatus: "FCA rule or UK statute (verify with counsel)",
    description: "A significant decision taken solely by automation must tell the customer, and let them make representations, obtain human intervention and contest it.",
    check: (i, def) => {
      if (i.aiInvolvement !== "AUTOMATED" || !isAdverse(i)) return NA();
      if (!i.automatedSafeguardsNotified)
        return { outcome: def.onBreach, message: "Solely automated decline without notice of the right to human intervention and to contest.", remediation: "Send the automated-decision notice, or route the decision to a claims handler." };
      return PASS("Customer notified of the automated decision and the route to human review.");
    },
  },
  {
    id: "UK-CLM-06",
    title: "Vulnerable customer: senior review of an AI-influenced decline",
    appliesTo: [...UK_LINES],
    onBreach: "ESCALATE",
    source: "FCA FG21/1 (fair treatment of vulnerable customers); Consumer Duty, PRIN 2A",
    sourceStatus: "Valifides control (aligned to FCA Consumer Duty)",
    description: "Where the customer shows characteristics of vulnerability, an AI-influenced decline or partial settlement needs a claims manager's review.",
    check: (i, def) => {
      if (!i.vulnerableCustomer || !aiUsed(i) || !isAdverse(i)) return NA();
      if (i.humanReview?.role !== "CLAIMS_MANAGER")
        return { outcome: def.onBreach, message: "Vulnerable customer and an AI-influenced decline without a claims manager's review.", remediation: "Claims manager to review the outcome and the support offered." };
      return PASS(`Claims manager review recorded (${i.humanReview.reviewerId}).`);
    },
  },
  {
    id: "UK-CLM-07",
    title: "Settlement paid promptly once agreed",
    appliesTo: [...UK_LINES],
    onBreach: "ESCALATE",
    source: "FCA ICOBS 8.1.1R(4); Insurance Act 2015 s.13A (payment within a reasonable time)",
    sourceStatus: "FCA rule or UK statute (verify with counsel)",
    description: `Pay promptly once settlement is agreed. The rule has no fixed number of days; Valifides flags anything unpaid after ${UK_SETTLEMENT_THRESHOLD_DAYS} days (configurable).`,
    check: (i, def) => {
      const t = i.timeline;
      if (!t.acceptedAt) return NA();
      const d = days(t.acceptedAt, t.paidAt ?? i.evaluatedAt);
      if (d > UK_SETTLEMENT_THRESHOLD_DAYS)
        return {
          outcome: def.onBreach,
          message: `${t.paidAt ? "Paid" : "Unpaid"} ${Math.floor(d)} days after settlement was agreed (threshold ${UK_SETTLEMENT_THRESHOLD_DAYS}); exposure to damages for late payment.`,
          remediation: "Release payment now and record the reason for the delay.",
        };
      return PASS(`Paid or due within ${UK_SETTLEMENT_THRESHOLD_DAYS} days of agreement (${Math.floor(Math.max(0, d))} days).`);
    },
  },
  {
    id: "UK-CLM-08",
    title: "Outsourced or vendor AI has an oversight record",
    appliesTo: [...UK_LINES],
    onBreach: "ESCALATE",
    source: "FCA 2026 priorities (oversight of outsourced and delegated claims); SYSC 8 (outsourcing)",
    sourceStatus: "Valifides control (aligned to FCA Consumer Duty)",
    description: "If a vendor or delegated authority supplied the model, the insurer's oversight assessment must be referenced.",
    check: (i, def) => {
      if (!aiUsed(i) || !i.modelVendor) return NA();
      if (!i.vendorAssessmentRef)
        return { outcome: def.onBreach, message: `Vendor model from ${i.modelVendor} used without an oversight assessment reference.`, remediation: "Link the outsourcing oversight record, or stop using the model for declines." };
      return PASS(`Vendor ${i.modelVendor} assessed (${i.vendorAssessmentRef}).`);
    },
  },
  {
    id: "UK-CLM-09",
    title: "AI involvement recorded with model version",
    appliesTo: [...UK_LINES],
    onBreach: "ESCALATE",
    source: "Consumer Duty, PRIN 2A.9 (monitoring outcomes); FCA 2026 priorities on AI",
    sourceStatus: "Valifides control (aligned to FCA Consumer Duty)",
    description: "Where AI influenced a decision, record the model and version so outcomes can be monitored and the decision examined later.",
    check: (i, def) => {
      if (!aiUsed(i)) return NA();
      if (!i.modelId || !i.modelVersion)
        return { outcome: def.onBreach, message: "AI involvement recorded without model ID and version.", remediation: "Record the model ID and version in the decision payload." };
      return PASS(`${i.modelId} v${i.modelVersion} recorded.`);
    },
  },
  {
    id: "UK-CLM-10",
    title: "No protected characteristics or likely proxies decide the outcome",
    appliesTo: [...UK_LINES],
    onBreach: "BLOCK",
    source: "Equality Act 2010; Consumer Duty (outcomes for different groups of customers)",
    sourceStatus: "Valifides control (aligned to FCA Consumer Duty)",
    description: "Block if a protected characteristic decided the outcome; escalate for review if a likely proxy (such as postcode) did.",
    check: (i, def) => {
      const f = (i.decisiveFactors ?? []).map((x) => x.toUpperCase());
      if (f.length === 0) return NA("No decisive factors recorded.");
      const prot = f.filter((x) => PROTECTED.includes(x));
      if (prot.length) return { outcome: def.onBreach, message: `Protected characteristic among decisive factors: ${prot.join(", ")}.`, remediation: "Remove the factor and re-decide; notify compliance." };
      const prox = f.filter((x) => PROXIES.includes(x));
      if (prox.length) return { outcome: "ESCALATE" as const, message: `Likely proxy among decisive factors: ${prox.join(", ")}.`, remediation: "Compliance review for indirect discrimination before the decision takes effect." };
      return PASS("Decisive factors contain no protected characteristics or listed proxies.");
    },
  },
];

export const UK_PACK: RulePack = {
  id: UK_PACK_ID,
  version: UK_PACK_VERSION,
  jurisdiction: "UK",
  name: "United Kingdom motor and home claims",
  currency: "GBP",
  lines: [...UK_LINES],
  rules: UK_RULES,
};
