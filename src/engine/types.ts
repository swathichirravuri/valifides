// Valifides decision engine — shared types.
// Imports inside src/engine must stay relative (no "@/" alias) so the
// Vercel API function in /api can bundle the same engine.

export type Jurisdiction = "IN" | "US" | "UK" | "EU";
export type UsState = "CA" | "TX" | "FL";
export type EuMemberState = "DE" | "FR" | "NL";
/** US state or EU member state whose local rules apply. */
export type Region = UsState | EuMemberState;
export type Currency = "INR" | "USD" | "GBP" | "EUR";

export type ClaimLine =
  | "HEALTH_CASHLESS"
  | "HEALTH_REIMBURSEMENT"
  | "MOTOR_OWN_DAMAGE"
  | "US_AUTO_PHYSICAL_DAMAGE"
  | "US_HOMEOWNERS"
  | "UK_MOTOR"
  | "UK_HOME"
  | "EU_MOTOR"
  | "EU_HEALTH";

export type ProposedAction =
  | "APPROVE_FULL"
  | "APPROVE_PARTIAL"
  | "REPUDIATE" // shown as "Deny" in the US pack
  | "QUERY_DOCUMENTS"
  | "PENDING";

/** AUTOMATED = the AI decided with no person involved in the decision (straight-through). */
export type AiInvolvement = "NONE" | "ASSISTED" | "AI_RECOMMENDED" | "AUTOMATED";

export type ReviewerRole =
  | "CLAIMS_OFFICER"
  | "MEDICAL_OFFICER"
  | "SURVEYOR"
  | "CLAIMS_REVIEW_COMMITTEE"
  | "LICENSED_ADJUSTER"
  | "CLAIMS_MANAGER"
  | "CLAIMS_HANDLER";

export type RepudiationGround =
  | "FRAUD"
  | "NON_DISCLOSURE"
  | "POLICY_EXCLUSION"
  | "POLICY_LAPSED"
  | "NOT_COVERED"
  | "OTHER";

export type DataPurpose =
  | "CLAIM_ASSESSMENT"
  | "FRAUD_PREVENTION"
  | "REGULATORY_REPORTING"
  | "MARKETING"
  | "CROSS_SELL_MODEL_TRAINING";

export interface HumanReview {
  reviewerId: string;
  role: ReviewerRole;
  reviewedAt: string; // ISO timestamp
  rationale: string;
}

export interface ClaimTimeline {
  /** When the insurer received notice of the claim (India: intimation). */
  intimatedAt: string;
  acknowledgedAt?: string | null;
  /** US: proof of claim / all requested items received. */
  proofOfClaimAt?: string | null;
  /** US: written delay or extension notices sent to the claimant. */
  delayNoticeDates?: string[];
  cashlessRequestedAt?: string | null;
  dischargeRequestedAt?: string | null;
  surveyorAppointedAt?: string | null;
  surveyReportAt?: string | null;
  acceptedAt?: string | null;
  paidAt?: string | null;
  documentQueryDates?: string[];
}

export interface ClaimDecisionInput {
  jurisdiction: Jurisdiction;
  /** US: the state; EU: the member state whose national rules apply. */
  state?: Region | null;
  decisionId: string;
  claimId: string;
  insurer: string;
  line: ClaimLine;
  proposedAction: ProposedAction;
  aiInvolvement: AiInvolvement;
  modelId?: string | null;
  modelVersion?: string | null;
  /** US: third-party vendor that supplied the model, if any. */
  modelVendor?: string | null;
  /** US: reference to the insurer's due-diligence record for that vendor. */
  vendorAssessmentRef?: string | null;
  humanReview?: HumanReview | null;
  repudiationGround?: RepudiationGround | null;
  /** India: exclusion clause in the policy schedule. US: policy provision cited in the denial. */
  exclusionClauseRef?: string | null;
  /** US: factual basis stated in the denial letter. */
  denialFactualBasis?: string | null;
  fraudInvestigationRef?: string | null;
  /** US: the factors that decided the outcome (used for the unfair-discrimination check). */
  decisiveFactors?: string[];
  /** UK/EU: how the policyholder's misrepresentation is classified (CIDRA 2012; VVG s.19). */
  misrepresentationType?: "DELIBERATE_OR_RECKLESS" | "CARELESS" | "INNOCENT" | null;
  /** UK: customer flagged as showing characteristics of vulnerability (FCA FG21/1). */
  vulnerableCustomer?: boolean;
  /** UK/EU: customer told of the automated decision and how to get human review and contest it. */
  automatedSafeguardsNotified?: boolean;
  /** EU: explicit consent to automated decisions using health data (GDPR Art. 22(4), 9(2)(a)). */
  explicitConsentAutomated?: boolean;
  /** EU: the insurer's AI Act classification of the model. */
  aiActRiskClass?: "HIGH_RISK" | "NOT_HIGH_RISK" | null;
  /** Germany: advance payment offered while investigations continue (VVG s.14(2)). */
  advancePaymentOffered?: boolean;
  monthsContinuousCoverage: number;
  claimAmount: number;
  approvedAmount?: number | null;
  dataPurposes: DataPurpose[];
  timeline: ClaimTimeline;
  /** The moment the decision is evaluated. Passed in so results are reproducible. */
  evaluatedAt: string;
}

export type RuleOutcome = "PASS" | "ESCALATE" | "BLOCK" | "NOT_APPLICABLE";

export type SourceStatus =
  | "IRDAI requirement (verify with counsel)"
  | "Statute (in force from 13 May 2027)"
  | "Valifides control (anticipates IRDAI AI framework)"
  | "State law or regulation (verify with counsel)"
  | "Valifides control (aligned to NAIC AI bulletin)"
  | "FCA rule or UK statute (verify with counsel)"
  | "Valifides control (aligned to FCA Consumer Duty)"
  | "EU regulation or case law (verify with counsel)"
  | "German statute (verify with counsel)"
  | "Valifides control (aligned to EIOPA AI Opinion)";

export interface RuleDefinition {
  id: string;
  title: string;
  appliesTo: ClaimLine[];
  onBreach: "ESCALATE" | "BLOCK";
  source: string;
  sourceStatus: SourceStatus;
  description: string;
}

export interface RuleResult {
  ruleId: string;
  title: string;
  outcome: RuleOutcome;
  message: string;
  remediation?: string;
  source: string;
  sourceStatus: SourceStatus;
  /** Penalty interest accrued, in the pack's currency, where the rule computes it. */
  penalInterest?: number;
}

export type Verdict = "APPROVE" | "ESCALATE" | "BLOCK";
export type EnforcementMode = "SHADOW" | "ADVISORY" | "ENFORCE";

export interface EvaluationResult {
  decisionId: string;
  claimId: string;
  verdict: Verdict;
  /** Whether the proposed action may execute, given the enforcement mode. */
  executionPermitted: boolean;
  mode: EnforcementMode;
  results: RuleResult[];
  rulePackId: string;
  rulePackVersion: string;
  evaluatedAt: string;
  /** Measured engine time for this evaluation, in milliseconds. */
  engineLatencyMs: number;
}

export type Check = (
  input: ClaimDecisionInput,
  def: RuleDefinition,
) => Omit<RuleResult, "ruleId" | "title" | "source" | "sourceStatus">;

export interface Rule extends RuleDefinition {
  check: Check;
}

export interface RulePack {
  id: string;
  version: string;
  jurisdiction: Jurisdiction;
  name: string;
  currency: Currency;
  lines: ClaimLine[];
  rules: Rule[];
}
