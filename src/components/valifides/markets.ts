// Per-market presentation settings for the console. The rules themselves live in src/engine.
import { generateEuSyntheticDecisions, EU_SCENARIOS } from "@/engine/euSynthetic";
import { generateSyntheticDecisions, SCENARIOS, type Scenario } from "@/engine/synthetic";
import { generateUkSyntheticDecisions, UK_SCENARIOS } from "@/engine/ukSynthetic";
import { generateUsSyntheticDecisions, US_SCENARIOS } from "@/engine/usSynthetic";
import type { ClaimDecisionInput, Jurisdiction, Region, RepudiationGround, ReviewerRole } from "@/engine/types";

export interface WatchItem {
  what: string;
  when: string;
  why: string;
}

export interface Market {
  label: string;
  locale: string;
  timeZone: string;
  /** What the market calls a full refusal of a claim. */
  refuseWord: string;
  partialWord: string;
  regionLabel?: string;
  regions?: [Region, string][];
  roles: [ReviewerRole, string][];
  grounds: [RepudiationGround | "", string][];
  provisionLabel: string;
  provisionPlaceholder: string;
  fraudRefLabel: string;
  fraudRefPlaceholder: string;
  reviewerPrefix: string;
  /** A decisive factor the console lets you toggle, to show the discrimination check. */
  flagFactor?: { code: string; label: string };
  scenarios: Scenario[];
  generate: () => ClaimDecisionInput[];
  seqOffset: number;
  replayNote: string;
  penaltyNote: string;
  overview: string;
  watch: WatchItem[];
  categories: [string, string][];
}

const REFUSAL_GROUNDS = (nonDisclosure: string): [RepudiationGround | "", string][] => [
  ["", "—"],
  ["FRAUD", "Fraud"],
  ["NON_DISCLOSURE", nonDisclosure],
  ["POLICY_EXCLUSION", "Policy exclusion"],
  ["NOT_COVERED", "Loss not covered"],
  ["POLICY_LAPSED", "Policy lapsed"],
  ["OTHER", "Other"],
];

export const MARKETS: Record<Jurisdiction, Market> = {
  IN: {
    label: "India",
    locale: "en-IN",
    timeZone: "Asia/Kolkata",
    refuseWord: "Repudiate",
    partialWord: "Approve partially",
    roles: [["CLAIMS_OFFICER", "Claims officer"], ["MEDICAL_OFFICER", "Medical officer"], ["SURVEYOR", "Surveyor"], ["CLAIMS_REVIEW_COMMITTEE", "Claims Review Committee"]],
    grounds: REFUSAL_GROUNDS("Non-disclosure").filter(([g]) => g !== "NOT_COVERED"),
    provisionLabel: "Exclusion clause cited",
    provisionPlaceholder: "e.g. Sch. 2.4",
    fraudRefLabel: "Fraud investigation ref",
    fraudRefPlaceholder: "e.g. INV-4821",
    reviewerPrefix: "REV",
    scenarios: SCENARIOS,
    generate: generateSyntheticDecisions,
    seqOffset: 100000,
    replayNote: "Synthetic health and motor claims",
    penaltyNote: "Late payments after acceptance (draft 8.5% p.a.)",
    overview: "It checks each AI-influenced decision against Indian claim rules before it takes effect, routes risky ones to an authorised human, and keeps a tamper-evident record for IRDAI, auditors and courts.",
    watch: [
      { what: "IRDAI AI working group", when: "Formed June 2026; recommendations due about September 2026", why: "First formal AI governance framework for insurers; claims and fraud detection named as priorities." },
      { what: "DPDP Act core obligations", when: "13 May 2027", why: "Notice, purpose limitation, security safeguards and breach reporting for personal data, including claim files." },
      { what: "IRDAI claim timelines", when: "In force (2024 regulations and health master circular)", why: "Cashless 1 hour / discharge 3 hours, survey 15 days, decision 7 days, payment 15 days. Draft rules, to be verified with counsel." },
    ],
    categories: [
      ["IRDAI requirement (verify with counsel)", "Drawn from IRDAI regulations or circulars as publicly summarised."],
      ["Statute (in force from 13 May 2027)", "DPDP Act obligations that apply once the core rules take effect."],
      ["Valifides control (anticipates IRDAI AI framework)", "Good-practice controls built ahead of IRDAI's AI framework, not yet a legal requirement."],
    ],
  },
  US: {
    label: "United States",
    locale: "en-US",
    timeZone: "America/New_York",
    refuseWord: "Deny",
    partialWord: "Pay partially",
    regionLabel: "State",
    regions: [["CA", "California"], ["TX", "Texas"], ["FL", "Florida (homeowners rules)"]],
    roles: [["LICENSED_ADJUSTER", "Licensed adjuster"], ["CLAIMS_MANAGER", "Claims manager"], ["CLAIMS_OFFICER", "Claims officer (unlicensed)"]],
    grounds: REFUSAL_GROUNDS("Misrepresentation").filter(([g]) => g !== "NON_DISCLOSURE"),
    provisionLabel: "Policy provision cited",
    provisionPlaceholder: "e.g. Part D, Exclusion 4",
    fraudRefLabel: "SIU investigation ref",
    fraudRefPlaceholder: "e.g. SIU-4821",
    reviewerPrefix: "ADJ",
    flagFactor: { code: "ZIP_CODE", label: "ZIP code was a decisive factor" },
    scenarios: US_SCENARIOS,
    generate: generateUsSyntheticDecisions,
    seqOffset: 200000,
    replayNote: "Synthetic auto and homeowners claims, CA/TX/FL",
    penaltyNote: "Texas late payments at 18% a year (draft)",
    overview: "It checks each AI-influenced decision against state claim rules and the NAIC AI bulletin before it takes effect, routes risky ones to a licensed adjuster, and keeps a tamper-evident record for examiners, auditors and courts.",
    watch: [
      { what: "NAIC AI Model Bulletin", when: "Adopted by 26 of 51 jurisdictions (NAIC map, 31 Aug 2026)", why: "Insurers must govern AI used in claims: oversight, documentation, testing for unfair discrimination, third-party vendor oversight." },
      { what: "State claims-handling laws", when: "In force", why: "CA 10 CCR 2695 (acknowledge 15 days, decide 40 days, pay 30 days); TX Ins. Code ch. 542 (18% penalty interest); FL 627.70131 (60 days). Draft rules, to be verified with counsel." },
      { what: "AI-only denial bills", when: "Watch: Florida HB 527 passed the House 108–0 and died in the Senate (March 2026)", why: "Similar bills could return; seven states already restrict AI-only denials in health insurance." },
    ],
    categories: [
      ["State law or regulation (verify with counsel)", "Drawn from state claims-handling statutes and regulations: California, Texas, Florida in this draft."],
      ["Valifides control (aligned to NAIC AI bulletin)", "Controls that put the NAIC AI Model Bulletin's expectations into practice at decision time; the bulletin itself is guidance adopted state by state."],
    ],
  },
  UK: {
    label: "United Kingdom",
    locale: "en-GB",
    timeZone: "Europe/London",
    refuseWord: "Decline",
    partialWord: "Settle partially",
    roles: [["CLAIMS_HANDLER", "Claims handler"], ["CLAIMS_MANAGER", "Claims manager"], ["CLAIMS_OFFICER", "Unauthorised staff"]],
    grounds: REFUSAL_GROUNDS("Misrepresentation"),
    provisionLabel: "Policy term cited",
    provisionPlaceholder: "e.g. Section 2, Exclusion 3",
    fraudRefLabel: "Counter-fraud investigation ref",
    fraudRefPlaceholder: "e.g. CFU-4821",
    reviewerPrefix: "CH",
    flagFactor: { code: "POSTCODE", label: "Postcode was a decisive factor" },
    scenarios: UK_SCENARIOS,
    generate: generateUkSyntheticDecisions,
    seqOffset: 300000,
    replayNote: "Synthetic motor and home claims",
    penaltyNote: "No statutory interest modelled in the UK draft",
    overview: "It checks each AI-influenced decision against FCA claims rules, the Consumer Duty and UK GDPR before it takes effect, routes risky ones to an authorised claims handler, and keeps a tamper-evident record for the FCA, the Financial Ombudsman and auditors.",
    watch: [
      { what: "FCA 2026 regulatory priorities", when: "Published 24 Feb 2026", why: "Claims must be handled promptly, fairly and transparently; supervisory and enforcement work in home and travel; review of oversight of outsourced and delegated claims; firms using AI must monitor outcomes." },
      { what: "UK GDPR automated decisions (DUAA 2025)", when: "In force 5 Feb 2026", why: "Solely automated significant decisions need safeguards: information, representations, human intervention and the right to contest." },
      { what: "Consumer Duty", when: "In force since 31 Jul 2023", why: "Consumer support and consumer understanding outcomes apply to claims; firms must monitor outcomes, including for vulnerable customers." },
    ],
    categories: [
      ["FCA rule or UK statute (verify with counsel)", "Drawn from the FCA Handbook (ICOBS 8), CIDRA 2012, the Insurance Act 2015 and UK GDPR as amended."],
      ["Valifides control (aligned to FCA Consumer Duty)", "Controls that put the Consumer Duty and FCA expectations on AI into practice at decision time."],
    ],
  },
  EU: {
    label: "European Union",
    locale: "en-IE",
    timeZone: "Europe/Berlin",
    refuseWord: "Refuse",
    partialWord: "Pay partially",
    regionLabel: "Member state",
    regions: [["DE", "Germany (national rules)"], ["FR", "France (EU-wide rules only)"], ["NL", "Netherlands (EU-wide rules only)"]],
    roles: [["CLAIMS_HANDLER", "Claims handler"], ["MEDICAL_OFFICER", "Medical officer"], ["CLAIMS_MANAGER", "Claims manager"], ["CLAIMS_OFFICER", "Unqualified staff"]],
    grounds: REFUSAL_GROUNDS("Non-disclosure"),
    provisionLabel: "Policy term cited",
    provisionPlaceholder: "e.g. AKB A.2.9.1",
    fraudRefLabel: "Fraud investigation ref",
    fraudRefPlaceholder: "e.g. FRD-4821",
    reviewerPrefix: "SB",
    flagFactor: { code: "SEX", label: "Sex was a decisive factor" },
    scenarios: EU_SCENARIOS,
    generate: generateEuSyntheticDecisions,
    seqOffset: 400000,
    replayNote: "Synthetic motor and private health claims, DE/FR/NL",
    penaltyNote: "No statutory interest modelled in the EU draft",
    overview: "It checks each AI-influenced decision against GDPR, the AI Act, EIOPA's AI expectations and national claim law before it takes effect, routes risky ones to a qualified claims handler, and keeps a tamper-evident record for supervisors, data protection authorities and auditors.",
    watch: [
      { what: "EU AI Act high-risk duties", when: "2 Dec 2027 (Digital Omnibus on AI, in force 27 Jul 2026)", why: "Life and health insurance risk assessment and pricing are high-risk; claims models usually are not, but must be classified and documented." },
      { what: "EIOPA Opinion on AI governance", when: "Published 6 Aug 2025", why: "Fairness, data governance, documentation, explainability and human oversight expected for AI outside the high-risk list, including claims." },
      { what: "GDPR Art. 22 and recent case law", when: "In force; CJEU SCHUFA (2023), Dun & Bradstreet (2025)", why: "A score that plays a determining role is an automated decision; customers are owed a meaningful explanation of how it was reached." },
    ],
    categories: [
      ["EU regulation or case law (verify with counsel)", "GDPR, the AI Act, the Gender Directive and CJEU rulings that apply in every member state."],
      ["German statute (verify with counsel)", "National insurance contract law (VVG). Drafted for Germany only; France and the Netherlands get EU-wide rules alone."],
      ["Valifides control (aligned to EIOPA AI Opinion)", "Controls that put EIOPA's expectations for AI governance into practice at decision time."],
    ],
  },
};

export const JURISDICTIONS = Object.keys(MARKETS) as Jurisdiction[];
