// United States P&C claims rule pack (draft): personal auto physical damage and homeowners.
// States covered in this draft: California, Texas, Florida (Florida rules apply to homeowners).
// Deterministic. Sources are drafts compiled from statute texts and public summaries and MUST be
// verified by insurance counsel before any customer use. This is not legal advice.

import type { ClaimDecisionInput, Rule, RulePack, UsState } from "./types";

export const US_PACK_ID = "US-PC-CLAIMS";
export const US_PACK_VERSION = "0.1.0-draft";

const DAY = 24 * 60 * 60 * 1000;
const TX_PENALTY_RATE_PA = 0.18; // Tex. Ins. Code 542.060

const ms = (iso?: string | null) => (iso ? Date.parse(iso) : NaN);
const days = (from?: string | null, to?: string | null) => (ms(to) - ms(from)) / DAY;
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const isAdverse = (i: ClaimDecisionInput) => i.proposedAction === "REPUDIATE" || i.proposedAction === "APPROVE_PARTIAL";
const undecided = (i: ClaimDecisionInput) => i.proposedAction === "PENDING" || i.proposedAction === "QUERY_DOCUMENTS";

/** Weekdays after `from` up to and including `to` (public holidays not modelled). */
export function businessDaysBetween(from: string, to: string): number {
  const start = new Date(from);
  const end = new Date(to);
  let count = 0;
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  while (d.getTime() < last) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) count++;
  }
  return count;
}

const NA = (message = "Not applicable to this decision.") => ({ outcome: "NOT_APPLICABLE" as const, message });
const PASS = (message: string) => ({ outcome: "PASS" as const, message });
const US_LINES = ["US_AUTO_PHYSICAL_DAMAGE", "US_HOMEOWNERS"] as const;

const stateRuleApplies = (i: ClaimDecisionInput, states: UsState[], homeownersOnly: UsState[] = []) =>
  !!i.state && (states as string[]).includes(i.state) && (!(homeownersOnly as string[]).includes(i.state) || i.line === "US_HOMEOWNERS");

const ACK_LIMIT_DAYS: Record<UsState, number> = { CA: 15, TX: 15, FL: 7 };
const ACK_SOURCE = "CA 10 CCR 2695.5(e); TX Ins. Code 542.055; FL Stat. 627.70131(1)(a)";

const PROTECTED = ["RACE", "ETHNICITY", "RELIGION", "NATIONAL_ORIGIN", "SEX"];
const PROXIES = ["ZIP_CODE", "NEIGHBORHOOD", "PREFERRED_LANGUAGE"];

export const US_RULES: Rule[] = [
  {
    id: "US-CLM-01",
    title: "Licensed adjuster review before an AI-influenced adverse decision",
    appliesTo: [...US_LINES],
    onBreach: "ESCALATE",
    source: "NAIC Model Bulletin on the Use of AI Systems by Insurers (human oversight and accountability)",
    sourceStatus: "Valifides control (aligned to NAIC AI bulletin)",
    description: "A denial or partial payment influenced by AI must carry a recorded review by a licensed adjuster or claims manager before it takes effect.",
    check: (i, def) => {
      if (i.aiInvolvement === "NONE" || !isAdverse(i)) return NA();
      if (!i.humanReview)
        return { outcome: def.onBreach, message: "AI-influenced adverse decision has no recorded adjuster review.", remediation: "Route to a licensed adjuster; record reviewer, time and rationale." };
      if (!["LICENSED_ADJUSTER", "CLAIMS_MANAGER"].includes(i.humanReview.role))
        return { outcome: def.onBreach, message: `Reviewed by ${i.humanReview.role}, which is not an authorised role for this decision.`, remediation: "Have a licensed adjuster or claims manager review it." };
      return PASS(`Reviewed by ${i.humanReview.role} (${i.humanReview.reviewerId}).`);
    },
  },
  {
    id: "US-CLM-02",
    title: "Denial cites the policy provision and the facts relied on",
    appliesTo: [...US_LINES],
    onBreach: "BLOCK",
    source: "CA 10 CCR 2695.7(b)(1); FL Stat. 627.70131(7)(a); TX Ins. Code 542.056(c)",
    sourceStatus: "State law or regulation (verify with counsel)",
    description: "A full or partial denial must state the policy provision relied on and the factual basis, in writing.",
    check: (i, def) => {
      if (!isAdverse(i)) return NA();
      const missing = [!i.exclusionClauseRef && "policy provision", !(i.denialFactualBasis && i.denialFactualBasis.trim().length >= 10) && "factual basis"].filter(Boolean);
      if (missing.length)
        return { outcome: def.onBreach, message: `Denial letter is missing the ${missing.join(" and the ")}.`, remediation: "Cite the policy provision and explain how it applies to the facts before sending." };
      return PASS(`Cites ${i.exclusionClauseRef}; factual basis recorded.`);
    },
  },
  {
    id: "US-CLM-03",
    title: "Fraud denial needs a completed SIU investigation",
    appliesTo: [...US_LINES],
    onBreach: "BLOCK",
    source: "Valifides control; supports the NAIC bulletin's expectation that AI decisions are not arbitrary or unfairly discriminatory",
    sourceStatus: "Valifides control (aligned to NAIC AI bulletin)",
    description: "A fraud score alone cannot deny a claim; a special investigations unit (SIU) report must be referenced.",
    check: (i, def) => {
      if (i.proposedAction !== "REPUDIATE" || i.repudiationGround !== "FRAUD") return NA();
      if (!i.fraudInvestigationRef)
        return { outcome: def.onBreach, message: "Fraud ground recorded without an SIU investigation reference.", remediation: "Refer to SIU; deny only on a completed investigation." };
      return PASS(`SIU investigation ${i.fraudInvestigationRef} referenced.`);
    },
  },
  {
    id: "US-CLM-04",
    title: "Claim acknowledged within the state deadline",
    appliesTo: [...US_LINES],
    onBreach: "ESCALATE",
    source: ACK_SOURCE,
    sourceStatus: "State law or regulation (verify with counsel)",
    description: "Acknowledge the claim within 15 calendar days (CA, TX) or 7 calendar days (FL homeowners).",
    check: (i, def) => {
      if (!stateRuleApplies(i, ["CA", "TX", "FL"], ["FL"])) return NA("No acknowledgement deadline for this state and line in the draft pack.");
      const limit = ACK_LIMIT_DAYS[i.state as UsState];
      const end = i.timeline.acknowledgedAt ?? i.evaluatedAt;
      const d = days(i.timeline.intimatedAt, end);
      if (d > limit)
        return {
          outcome: def.onBreach,
          message: `${i.timeline.acknowledgedAt ? "Acknowledged" : "Not acknowledged"} after ${Math.floor(d)} days (${i.state} limit ${limit}).`,
          remediation: "Acknowledge now and record the date; review the intake queue.",
        };
      return PASS(`Acknowledgement within ${limit} days (${Math.floor(Math.max(0, d))} elapsed).`);
    },
  },
  {
    id: "US-CLM-05",
    title: "Accept or deny within the state deadline",
    appliesTo: [...US_LINES],
    onBreach: "ESCALATE",
    source: "CA 10 CCR 2695.7(b), (c)(1); TX Ins. Code 542.056; FL Stat. 627.70131(7)(a)",
    sourceStatus: "State law or regulation (verify with counsel)",
    description:
      "CA: 40 days after proof of claim, then written notice every 30 days. TX: 15 business days after all items, or up to 45 days after an extension notice. FL homeowners: 60 days after notice of claim.",
    check: (i, def) => {
      if (!undecided(i) || !stateRuleApplies(i, ["CA", "TX", "FL"], ["FL"])) return NA();
      const t = i.timeline;
      const notices = (t.delayNoticeDates ?? []).filter((n) => ms(n) <= ms(i.evaluatedAt)).sort();
      const lastNotice = notices.at(-1);
      if (i.state === "FL") {
        const d = days(t.intimatedAt, i.evaluatedAt);
        return d > 60
          ? { outcome: def.onBreach, message: `Undecided ${Math.floor(d)} days after notice (FL limit 60). Late payments carry statutory interest.`, remediation: "Pay or deny now with a written explanation." }
          : PASS(`Within FL 60-day limit (${Math.floor(d)} days).`);
      }
      if (!t.proofOfClaimAt) return NA("Clock starts when proof of claim or all requested items are received.");
      if (i.state === "CA") {
        const d = days(t.proofOfClaimAt, i.evaluatedAt);
        if (d <= 40) return PASS(`Within CA 40-day limit (${Math.floor(d)} days).`);
        if (lastNotice && days(lastNotice, i.evaluatedAt) <= 30 && ms(lastNotice) >= ms(t.proofOfClaimAt))
          return PASS(`Past 40 days, but a written status notice was sent within the last 30 days.`);
        return { outcome: def.onBreach, message: `Undecided ${Math.floor(d)} days after proof of claim with no status notice in the last 30 days (CA).`, remediation: "Decide, or send the written notice explaining what is still needed." };
      }
      // Texas
      const bd = businessDaysBetween(t.proofOfClaimAt, i.evaluatedAt);
      if (bd <= 15) return PASS(`Within TX 15-business-day limit (${bd} business days).`);
      if (lastNotice && ms(lastNotice) >= ms(t.proofOfClaimAt) && days(lastNotice, i.evaluatedAt) <= 45)
        return PASS(`Extension notice sent; within 45 days of it.`);
      return { outcome: def.onBreach, message: `Undecided ${bd} business days after all items were received (TX limit 15, or 45 days after an extension notice).`, remediation: "Accept or reject in writing now." };
    },
  },
  {
    id: "US-CLM-06",
    title: "Payment within the state deadline after acceptance",
    appliesTo: [...US_LINES],
    onBreach: "ESCALATE",
    source: "CA 10 CCR 2695.7(h); TX Ins. Code 542.057, 542.060 (18% a year); FL Stat. 627.70131(7)(a), (5)(a)",
    sourceStatus: "State law or regulation (verify with counsel)",
    description: "Pay within 30 days of acceptance (CA) or 5 business days (TX, 18% a year penalty interest after that). FL homeowners: payment after 60 days from notice bears interest.",
    check: (i, def) => {
      const t = i.timeline;
      if (!stateRuleApplies(i, ["CA", "TX", "FL"], ["FL"])) return NA();
      if (i.state === "FL") {
        if (!t.acceptedAt) return NA();
        const d = days(t.intimatedAt, t.paidAt ?? i.evaluatedAt);
        return d > 60
          ? { outcome: def.onBreach, message: `${t.paidAt ? "Paid" : "Unpaid"} ${Math.floor(d)} days after notice; statutory interest applies from the notice date.`, remediation: "Pay now with interest." }
          : PASS(`Paid or due within FL 60 days of notice.`);
      }
      if (!t.acceptedAt) return NA();
      const end = t.paidAt ?? i.evaluatedAt;
      if (i.state === "CA") {
        const d = days(t.acceptedAt, end);
        return d > 30
          ? { outcome: def.onBreach, message: `${t.paidAt ? "Paid" : "Unpaid"} ${Math.floor(d)} days after acceptance (CA limit 30).`, remediation: "Release payment now." }
          : PASS(`Paid or due within CA 30 days (${Math.floor(Math.max(0, d))} days).`);
      }
      const bd = businessDaysBetween(t.acceptedAt, end);
      if (bd <= 5) return PASS(`Paid or due within TX 5 business days (${bd}).`);
      const lateDays = days(t.acceptedAt, end) - 7; // 5 business days is about 7 calendar days
      const amount = i.approvedAmount ?? i.claimAmount;
      const interest = amount * TX_PENALTY_RATE_PA * (Math.max(0, lateDays) / 365);
      return {
        outcome: def.onBreach,
        message: `${t.paidAt ? "Paid" : "Unpaid"} ${bd} business days after acceptance (TX limit 5); penalty interest about ${usd(interest)} plus attorney fees exposure.`,
        remediation: "Pay now; add 18% a year interest.",
        penalInterest: Math.round(interest),
      };
    },
  },
  {
    id: "US-CLM-07",
    title: "AI involvement recorded with model version",
    appliesTo: [...US_LINES],
    onBreach: "ESCALATE",
    source: "NAIC Model Bulletin (documentation of AI systems used in claims)",
    sourceStatus: "Valifides control (aligned to NAIC AI bulletin)",
    description: "Where AI influenced a decision, record the model and version so the decision can be examined later.",
    check: (i, def) => {
      if (i.aiInvolvement === "NONE") return NA();
      if (!i.modelId || !i.modelVersion)
        return { outcome: def.onBreach, message: "AI involvement recorded without model ID and version.", remediation: "Record the model ID and version in the decision payload." };
      return PASS(`${i.modelId} v${i.modelVersion} recorded.`);
    },
  },
  {
    id: "US-CLM-08",
    title: "Third-party AI vendor has a due-diligence record",
    appliesTo: [...US_LINES],
    onBreach: "ESCALATE",
    source: "NAIC Model Bulletin (oversight of third-party AI systems and data)",
    sourceStatus: "Valifides control (aligned to NAIC AI bulletin)",
    description: "If a vendor supplied the model, the insurer's vendor assessment must be referenced.",
    check: (i, def) => {
      if (i.aiInvolvement === "NONE" || !i.modelVendor) return NA();
      if (!i.vendorAssessmentRef)
        return { outcome: def.onBreach, message: `Vendor model from ${i.modelVendor} used without a vendor assessment reference.`, remediation: "Link the vendor due-diligence record, or stop using the model for adverse decisions." };
      return PASS(`Vendor ${i.modelVendor} assessed (${i.vendorAssessmentRef}).`);
    },
  },
  {
    id: "US-CLM-09",
    title: "No protected traits or likely proxies decide the outcome",
    appliesTo: [...US_LINES],
    onBreach: "BLOCK",
    source: "NAIC Model Bulletin (unfairly discriminatory outcomes); state unfair discrimination laws",
    sourceStatus: "Valifides control (aligned to NAIC AI bulletin)",
    description: "Block if a protected trait decided the outcome; escalate for review if a likely proxy (such as ZIP code) did.",
    check: (i, def) => {
      const f = (i.decisiveFactors ?? []).map((x) => x.toUpperCase());
      if (f.length === 0) return NA("No decisive factors recorded.");
      const prot = f.filter((x) => PROTECTED.includes(x));
      if (prot.length) return { outcome: def.onBreach, message: `Protected trait among decisive factors: ${prot.join(", ")}.`, remediation: "Remove the factor and re-decide; notify compliance." };
      const prox = f.filter((x) => PROXIES.includes(x));
      if (prox.length) return { outcome: "ESCALATE" as const, message: `Likely proxy among decisive factors: ${prox.join(", ")}.`, remediation: "Compliance review for proxy discrimination before the decision takes effect." };
      return PASS("Decisive factors contain no protected traits or listed proxies.");
    },
  },
];

export const US_PACK: RulePack = {
  id: US_PACK_ID,
  version: US_PACK_VERSION,
  jurisdiction: "US",
  name: "United States P&C claims",
  currency: "USD",
  lines: [...US_LINES],
  rules: US_RULES,
};
