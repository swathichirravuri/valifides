// European Union claims rule pack (draft): motor and private health.
// EU-wide rules (GDPR, AI Act, EIOPA AI Opinion) apply in every member state. National rules are
// drafted for Germany only (VVG); France and the Netherlands get the EU-wide rules alone.
// Deterministic. Sources are drafts compiled from legislation, case law and public summaries and
// MUST be verified by counsel in each member state before any customer use. This is not legal advice.

import type { ClaimDecisionInput, Rule, RulePack } from "./types";

export const EU_PACK_ID = "EU-CLAIMS";
export const EU_PACK_VERSION = "0.1.0-draft";

const DAY = 24 * 60 * 60 * 1000;
const ms = (iso?: string | null) => (iso ? Date.parse(iso) : NaN);
const days = (from?: string | null, to?: string | null) => (ms(to) - ms(from)) / DAY;
const isAdverse = (i: ClaimDecisionInput) => i.proposedAction === "REPUDIATE" || i.proposedAction === "APPROVE_PARTIAL";
const undecided = (i: ClaimDecisionInput) => i.proposedAction === "PENDING" || i.proposedAction === "QUERY_DOCUMENTS";
const aiUsed = (i: ClaimDecisionInput) => i.aiInvolvement !== "NONE";

const NA = (message = "Not applicable to this decision.") => ({ outcome: "NOT_APPLICABLE" as const, message });
const PASS = (message: string) => ({ outcome: "PASS" as const, message });
const EU_LINES = ["EU_MOTOR", "EU_HEALTH"] as const;
const REVIEWERS = ["CLAIMS_HANDLER", "CLAIMS_MANAGER", "MEDICAL_OFFICER"];

const PROTECTED = ["RACE", "ETHNICITY", "NATIONALITY", "RELIGION", "SEX", "DISABILITY", "SEXUAL_ORIENTATION", "AGE"];
const PROXIES = ["POSTCODE", "PREFERRED_LANGUAGE"];

export const EU_RULES: Rule[] = [
  {
    id: "EU-CLM-01",
    title: "Adverse AI decision is not left solely to automation",
    appliesTo: [...EU_LINES],
    onBreach: "ESCALATE",
    source: "GDPR Art. 22(1), (3); CJEU C-634/21 SCHUFA (7 Dec 2023): a score that plays a determining role counts as an automated decision",
    sourceStatus: "EU regulation or case law (verify with counsel)",
    description: "Where an AI decided or determined a refusal or reduction, a qualified person must review it, or the GDPR Art. 22 exception and safeguards must be in place.",
    check: (i, def) => {
      if (!isAdverse(i) || !["AUTOMATED", "AI_RECOMMENDED"].includes(i.aiInvolvement)) return NA();
      if (i.humanReview && REVIEWERS.includes(i.humanReview.role)) return PASS(`Reviewed by ${i.humanReview.role} (${i.humanReview.reviewerId}).`);
      if (i.aiInvolvement === "AUTOMATED" && i.automatedSafeguardsNotified)
        return PASS("Solely automated, with the customer told of the right to human intervention and to contest.");
      return {
        outcome: def.onBreach,
        message: i.humanReview
          ? `Reviewed by ${i.humanReview.role}, which is not a qualified role for this decision.`
          : "AI determined the refusal or reduction with no qualified human review and no Art. 22 safeguards recorded.",
        remediation: "Route to a qualified claims handler, or record the Art. 22(2) basis and notify the customer of the right to human intervention.",
      };
    },
  },
  {
    id: "EU-CLM-02",
    title: "Automated health-claim decision needs explicit consent",
    appliesTo: ["EU_HEALTH"],
    onBreach: "BLOCK",
    source: "GDPR Art. 22(4) with Art. 9(2)(a) (special category data in automated decisions)",
    sourceStatus: "EU regulation or case law (verify with counsel)",
    description: "A solely automated refusal or reduction based on health data is allowed only with the customer's explicit consent (or substantial public interest under law).",
    check: (i, def) => {
      if (i.aiInvolvement !== "AUTOMATED" || !isAdverse(i)) return NA();
      if (!i.explicitConsentAutomated)
        return { outcome: def.onBreach, message: "Solely automated health-claim decision without explicit consent to automated processing of health data.", remediation: "Have a medical officer or claims handler decide, or obtain explicit consent first." };
      return PASS("Explicit consent to automated decisions on health data recorded.");
    },
  },
  {
    id: "EU-CLM-03",
    title: "Main factors recorded so the decision can be explained",
    appliesTo: [...EU_LINES],
    onBreach: "ESCALATE",
    source: "GDPR Art. 15(1)(h); CJEU C-203/22 Dun & Bradstreet Austria (27 Feb 2025): right to an explanation of the procedure and principles applied",
    sourceStatus: "EU regulation or case law (verify with counsel)",
    description: "For an AI-influenced refusal or reduction, record the factors that decided it so the insurer can answer an access request with a meaningful explanation.",
    check: (i, def) => {
      if (!aiUsed(i) || !isAdverse(i)) return NA();
      if (!(i.decisiveFactors ?? []).length)
        return { outcome: def.onBreach, message: "No decisive factors recorded for an AI-influenced refusal or reduction.", remediation: "Record the main factors and their effect on the outcome." };
      return PASS(`Decisive factors recorded: ${(i.decisiveFactors ?? []).join(", ")}.`);
    },
  },
  {
    id: "EU-CLM-04",
    title: "Refusal states the policy term and the facts",
    appliesTo: [...EU_LINES],
    onBreach: "BLOCK",
    source: "EIOPA Opinion on AI governance and risk management (6 Aug 2025): transparency and explainability to customers; national insurance contract law",
    sourceStatus: "Valifides control (aligned to EIOPA AI Opinion)",
    description: "A refusal or reduction must name the policy term relied on and the facts, so the customer can understand and challenge it.",
    check: (i, def) => {
      if (!isAdverse(i)) return NA();
      const missing = [!i.exclusionClauseRef && "policy term", !(i.denialFactualBasis && i.denialFactualBasis.trim().length >= 10) && "factual basis"].filter(Boolean);
      if (missing.length)
        return { outcome: def.onBreach, message: `Refusal letter is missing the ${missing.join(" and the ")}.`, remediation: "Name the policy term and explain how it applies to the facts before sending." };
      return PASS(`Cites ${i.exclusionClauseRef}; factual basis recorded.`);
    },
  },
  {
    id: "EU-CLM-05",
    title: "Fraud refusal needs a completed investigation",
    appliesTo: [...EU_LINES],
    onBreach: "BLOCK",
    source: "EIOPA AI Opinion (fairness; human oversight); Valifides control",
    sourceStatus: "Valifides control (aligned to EIOPA AI Opinion)",
    description: "A fraud score alone cannot refuse a claim; a fraud investigation must be referenced.",
    check: (i, def) => {
      if (i.proposedAction !== "REPUDIATE" || i.repudiationGround !== "FRAUD") return NA();
      if (!i.fraudInvestigationRef)
        return { outcome: def.onBreach, message: "Fraud ground recorded without an investigation reference.", remediation: "Refer to the fraud unit; refuse only on a completed investigation." };
      return PASS(`Investigation ${i.fraudInvestigationRef} referenced.`);
    },
  },
  {
    id: "EU-CLM-06",
    title: "AI Act classification recorded for the model",
    appliesTo: [...EU_LINES],
    onBreach: "ESCALATE",
    source: "EU AI Act (Reg. 2024/1689) Art. 6 and Annex III 5(c); high-risk duties apply from 2 Dec 2027 (Digital Omnibus on AI)",
    sourceStatus: "EU regulation or case law (verify with counsel)",
    description: "Record whether the model is high-risk under the AI Act. Claims models are usually not; life and health risk assessment and pricing models are.",
    check: (i, def) => {
      if (!aiUsed(i)) return NA();
      if (!i.aiActRiskClass)
        return { outcome: def.onBreach, message: "AI used with no AI Act risk classification recorded for the model.", remediation: "Classify the model and record it in the AI inventory." };
      return PASS(`AI Act classification: ${i.aiActRiskClass === "HIGH_RISK" ? "high-risk" : "not high-risk"}.`);
    },
  },
  {
    id: "EU-CLM-07",
    title: "No protected characteristics or likely proxies decide the outcome",
    appliesTo: [...EU_LINES],
    onBreach: "BLOCK",
    source: "EU Charter Art. 21; Directive 2004/113/EC and CJEU C-236/09 Test-Achats (no sex-based differences in benefits); EIOPA AI Opinion (fairness)",
    sourceStatus: "EU regulation or case law (verify with counsel)",
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
  {
    id: "EU-CLM-08",
    title: "Third-party AI vendor has an oversight record",
    appliesTo: [...EU_LINES],
    onBreach: "ESCALATE",
    source: "DORA (Reg. 2022/2554) Art. 28 (ICT third-party risk); EIOPA AI Opinion",
    sourceStatus: "Valifides control (aligned to EIOPA AI Opinion)",
    description: "If a vendor supplied the model, the insurer's third-party assessment must be referenced.",
    check: (i, def) => {
      if (!aiUsed(i) || !i.modelVendor) return NA();
      if (!i.vendorAssessmentRef)
        return { outcome: def.onBreach, message: `Vendor model from ${i.modelVendor} used without a third-party assessment reference.`, remediation: "Link the ICT third-party assessment, or stop using the model for refusals." };
      return PASS(`Vendor ${i.modelVendor} assessed (${i.vendorAssessmentRef}).`);
    },
  },
  {
    id: "EU-CLM-09",
    title: "AI involvement recorded with model version",
    appliesTo: [...EU_LINES],
    onBreach: "ESCALATE",
    source: "EIOPA AI Opinion (documentation and record-keeping)",
    sourceStatus: "Valifides control (aligned to EIOPA AI Opinion)",
    description: "Where AI influenced a decision, record the model and version so the decision can be examined later.",
    check: (i, def) => {
      if (!aiUsed(i)) return NA();
      if (!i.modelId || !i.modelVersion)
        return { outcome: def.onBreach, message: "AI involvement recorded without model ID and version.", remediation: "Record the model ID and version in the decision payload." };
      return PASS(`${i.modelId} v${i.modelVersion} recorded.`);
    },
  },
  {
    id: "EU-CLM-10",
    title: "Germany: advance payment once investigations pass one month",
    appliesTo: [...EU_LINES],
    onBreach: "ESCALATE",
    source: "Germany, VVG s.14(2) (Abschlagszahlung)",
    sourceStatus: "German statute (verify with counsel)",
    description: "If investigations are not finished one month after the claim was notified, the policyholder may demand an advance of the minimum amount the insurer expects to pay.",
    check: (i, def) => {
      if (i.state !== "DE") return NA(i.state ? `National rules for ${i.state} are not in this draft.` : "No member state recorded.");
      if (!undecided(i)) return NA();
      const d = days(i.timeline.intimatedAt, i.evaluatedAt);
      if (d <= 30) return PASS(`Within one month of notification (${Math.floor(d)} days).`);
      if (i.advancePaymentOffered) return PASS("Investigations past one month; advance payment offered.");
      return { outcome: def.onBreach, message: `Investigations still open ${Math.floor(d)} days after notification, with no advance payment offered.`, remediation: "Offer an advance of the minimum amount expected to be payable." };
    },
  },
  {
    id: "EU-CLM-11",
    title: "Germany: non-disclosure refusal within the time limit",
    appliesTo: [...EU_LINES],
    onBreach: "BLOCK",
    source: "Germany, VVG s.21(3) (insurer's rights under s.19 lapse after 5 years; 10 years if intentional or fraudulent)",
    sourceStatus: "German statute (verify with counsel)",
    description: "A refusal for breach of the pre-contractual disclosure duty is barred for losses after 5 years from contract (10 years if the breach was intentional or fraudulent).",
    check: (i, def) => {
      if (i.state !== "DE") return NA(i.state ? `National rules for ${i.state} are not in this draft.` : "No member state recorded.");
      if (!isAdverse(i) || i.repudiationGround !== "NON_DISCLOSURE") return NA();
      const intentional = i.misrepresentationType === "DELIBERATE_OR_RECKLESS";
      const limit = intentional ? 120 : 60;
      if (i.monthsContinuousCoverage >= limit)
        return {
          outcome: def.onBreach,
          message: `Loss ${i.monthsContinuousCoverage} months after contract; the ${intentional ? "10-year" : "5-year"} limit for non-disclosure has passed.`,
          remediation: "Assess the claim on its merits; non-disclosure is no longer available as a ground.",
        };
      return PASS(`${i.monthsContinuousCoverage} months after contract, within the ${intentional ? "10-year" : "5-year"} limit.`);
    },
  },
];

export const EU_PACK: RulePack = {
  id: EU_PACK_ID,
  version: EU_PACK_VERSION,
  jurisdiction: "EU",
  name: "European Union motor and health claims",
  currency: "EUR",
  lines: [...EU_LINES],
  rules: EU_RULES,
};
