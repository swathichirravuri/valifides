import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { money, LINE_LABEL, PageHeader, RuleResultList, VerdictBadge } from "@/components/valifides/shared";
import { useValifides, type EvidenceEntry } from "@/context/ValifidesContext";
import { evaluate } from "@/engine/evaluate";
import type { AiInvolvement, ClaimDecisionInput, ClaimLine, ProposedAction, RepudiationGround, ReviewerRole, UsState } from "@/engine/types";
import { Play } from "lucide-react";

const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
const label = "text-[11px] font-medium text-muted-foreground";

function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <select className={field} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

const MODE_EFFECT = {
  SHADOW: "Shadow mode: logged only. The insurer's decision goes ahead unchanged.",
  ADVISORY: "Advisory mode: verdict returned to the insurer's system, which decides whether to act on it.",
  ENFORCE: "Enforce mode: the decision only executes if the verdict is APPROVE.",
};

export default function GatewayPage() {
  const { mode, evaluateAndLog, jurisdiction, pack, scenarios } = useValifides();
  const US = jurisdiction === "US";
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const [input, setInput] = useState<ClaimDecisionInput>(scenarios[0].input);
  const [json, setJson] = useState(JSON.stringify(scenarios[0].input, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [entry, setEntry] = useState<EvidenceEntry | null>(null);
  const [avgMs, setAvgMs] = useState<number | null>(null);

  const loadScenario = (id: string) => {
    const s = scenarios.find((x) => x.id === id) ?? scenarios[0];
    setScenarioId(s.id);
    setInput(s.input);
    setJson(JSON.stringify(s.input, null, 2));
    setEntry(null);
  };

  // Switching jurisdiction loads that jurisdiction's first scenario.
  useEffect(() => {
    loadScenario(scenarios[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jurisdiction]);

  const update = (patch: Partial<ClaimDecisionInput>) => {
    const next = { ...input, ...patch };
    setInput(next);
    setJson(JSON.stringify(next, null, 2));
  };

  const applyJson = () => {
    try {
      setInput(JSON.parse(json));
      setJsonError(null);
    } catch (e) {
      setJsonError((e as Error).message);
    }
  };

  const run = async () => {
    setEntry(await evaluateAndLog(input));
    // Single runs are below the browser timer's resolution, so report an average.
    const runs = 1000;
    const t0 = performance.now();
    for (let k = 0; k < runs; k++) evaluate(input, mode);
    setAvgMs((performance.now() - t0) / runs);
  };

  const hasReview = !!input.humanReview;
  const purposesCrossSell = input.dataPurposes.includes("CROSS_SELL_MODEL_TRAINING");
  const zipDecisive = (input.decisiveFactors ?? []).includes("ZIP_CODE");
  const lineOptions = pack.lines.map((l) => [l, LINE_LABEL[l]] as [ClaimLine, string]);
  const roleOptions: [ReviewerRole, string][] = US
    ? [["LICENSED_ADJUSTER", "Licensed adjuster"], ["CLAIMS_MANAGER", "Claims manager"], ["CLAIMS_OFFICER", "Claims officer (unlicensed)"]]
    : [["CLAIMS_OFFICER", "Claims officer"], ["MEDICAL_OFFICER", "Medical officer"], ["SURVEYOR", "Surveyor"], ["CLAIMS_REVIEW_COMMITTEE", "Claims Review Committee"]];
  const groundOptions: [RepudiationGround | "", string][] = US
    ? [["", "—"], ["FRAUD", "Fraud"], ["POLICY_EXCLUSION", "Policy exclusion"], ["NOT_COVERED", "Loss not covered"], ["POLICY_LAPSED", "Policy lapsed"], ["OTHER", "Other"]]
    : [["", "—"], ["FRAUD", "Fraud"], ["NON_DISCLOSURE", "Non-disclosure"], ["POLICY_EXCLUSION", "Policy exclusion"], ["POLICY_LAPSED", "Policy lapsed"], ["OTHER", "Other"]];

  return (
    <AppLayout>
      <div className="section-gap-sm max-w-[1400px]">
        <PageHeader
          title="Decision Gateway"
          subtitle={`Send a claim decision through the ${pack.name} rule pack before it takes effect. Pick a scenario, adjust the fields, and evaluate. Every evaluation is written to the Evidence Log.`}
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          {/* Input */}
          <div className="prod-card-padded space-y-4">
            <div className="space-y-1.5">
              <p className={label}>Scenario</p>
              <select className={field} value={scenarioId} onChange={(e) => loadScenario(e.target.value)}>
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {US && (
                <div className="space-y-1.5">
                  <p className={label}>State</p>
                  <Select<UsState>
                    value={(input.state ?? "CA") as UsState}
                    onChange={(v) => update({ state: v })}
                    options={[["CA", "California"], ["TX", "Texas"], ["FL", "Florida (homeowners rules)"]]}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <p className={label}>Claim line</p>
                <Select<ClaimLine> value={input.line} onChange={(v) => update({ line: v })} options={lineOptions} />
              </div>
              <div className="space-y-1.5">
                <p className={label}>Proposed action</p>
                <Select<ProposedAction>
                  value={input.proposedAction}
                  onChange={(v) => update({ proposedAction: v })}
                  options={[
                    ["APPROVE_FULL", "Approve in full"],
                    ["APPROVE_PARTIAL", US ? "Pay partially" : "Approve partially"],
                    ["REPUDIATE", US ? "Deny" : "Repudiate"],
                    ["QUERY_DOCUMENTS", US ? "Request information" : "Query documents"],
                    ["PENDING", "Pending"],
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <p className={label}>AI involvement</p>
                <Select<AiInvolvement>
                  value={input.aiInvolvement}
                  onChange={(v) => update({ aiInvolvement: v })}
                  options={[
                    ["NONE", "None"],
                    ["ASSISTED", "AI-assisted"],
                    ["AI_RECOMMENDED", "AI recommended the action"],
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <p className={label}>{US ? "Denial ground" : "Repudiation ground"}</p>
                <Select<RepudiationGround | "">
                  value={(input.repudiationGround ?? "") as RepudiationGround | ""}
                  onChange={(v) => update({ repudiationGround: v === "" ? null : v })}
                  options={groundOptions}
                />
              </div>
              <div className="space-y-1.5">
                <p className={label}>{US ? "Policy provision cited" : "Exclusion clause cited"}</p>
                <input className={field} value={input.exclusionClauseRef ?? ""} placeholder={US ? "e.g. Part D, Exclusion 4" : "e.g. Sch. 2.4"} onChange={(e) => update({ exclusionClauseRef: e.target.value || null })} />
              </div>
              <div className="space-y-1.5">
                <p className={label}>{US ? "SIU investigation ref" : "Fraud investigation ref"}</p>
                <input className={field} value={input.fraudInvestigationRef ?? ""} placeholder={US ? "e.g. SIU-4821" : "e.g. INV-4821"} onChange={(e) => update({ fraudInvestigationRef: e.target.value || null })} />
              </div>
              {US ? (
                <>
                  <div className="space-y-1.5">
                    <p className={label}>AI vendor (if third-party)</p>
                    <input className={field} value={input.modelVendor ?? ""} placeholder="e.g. Demo Estimating Vendor" onChange={(e) => update({ modelVendor: e.target.value || null })} />
                  </div>
                  <div className="space-y-1.5">
                    <p className={label}>Vendor assessment ref</p>
                    <input className={field} value={input.vendorAssessmentRef ?? ""} placeholder="e.g. VDD-301" onChange={(e) => update({ vendorAssessmentRef: e.target.value || null })} />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <p className={label}>Factual basis stated in the denial</p>
                    <input className={field} value={input.denialFactualBasis ?? ""} placeholder="e.g. Damage predates the policy period per inspection photos." onChange={(e) => update({ denialFactualBasis: e.target.value || null })} />
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <p className={label}>Months of continuous cover</p>
                  <input type="number" min={0} className={field} value={input.monthsContinuousCoverage} onChange={(e) => update({ monthsContinuousCoverage: Number(e.target.value) })} />
                </div>
              )}
              <div className="space-y-1.5">
                <p className={label}>Claim amount ({pack.currency === "USD" ? "$" : "₹"})</p>
                <input type="number" min={0} className={field} value={input.claimAmount} onChange={(e) => update({ claimAmount: Number(e.target.value) })} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
              <label className="flex items-center gap-2 text-[13px] text-foreground">
                <input
                  type="checkbox"
                  checked={hasReview}
                  onChange={(e) =>
                    update({
                      humanReview: e.target.checked
                        ? { reviewerId: US ? "ADJ-100" : "REV-100", role: roleOptions[0][0], reviewedAt: input.evaluatedAt, rationale: "Reviewed claim file." }
                        : null,
                    })
                  }
                />
                {US ? "Adjuster review recorded" : "Human review recorded"}
              </label>
              {hasReview && (
                <Select<ReviewerRole> value={input.humanReview!.role} onChange={(v) => update({ humanReview: { ...input.humanReview!, role: v } })} options={roleOptions} />
              )}
              {US ? (
                <label className="flex items-center gap-2 text-[13px] text-foreground">
                  <input
                    type="checkbox"
                    checked={zipDecisive}
                    onChange={(e) => {
                      const f = (input.decisiveFactors ?? []).filter((x) => x !== "ZIP_CODE");
                      update({ decisiveFactors: e.target.checked ? [...f, "ZIP_CODE"] : f });
                    }}
                  />
                  ZIP code was a decisive factor
                </label>
              ) : (
                <label className="flex items-center gap-2 text-[13px] text-foreground">
                  <input
                    type="checkbox"
                    checked={purposesCrossSell}
                    onChange={(e) =>
                      update({
                        dataPurposes: e.target.checked
                          ? [...input.dataPurposes, "CROSS_SELL_MODEL_TRAINING"]
                          : input.dataPurposes.filter((p) => p !== "CROSS_SELL_MODEL_TRAINING"),
                      })
                    }
                  />
                  Claim data also sent to a cross-sell model
                </label>
              )}
            </div>

            <details className="rounded-lg border border-border">
              <summary className="cursor-pointer px-3 py-2 text-[12px] text-muted-foreground">Full decision payload (JSON, editable)</summary>
              <div className="space-y-2 p-3 pt-0">
                <textarea className={`${field} h-64 font-mono text-[11px]`} value={json} onChange={(e) => setJson(e.target.value)} />
                <div className="flex items-center gap-3">
                  <button onClick={applyJson} className="rounded-lg border border-border px-3 py-1.5 text-[12px] text-foreground hover:bg-accent">
                    Apply JSON
                  </button>
                  {jsonError && <span className="text-[11px] text-critical">{jsonError}</span>}
                </div>
              </div>
            </details>

            <button onClick={run} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90">
              <Play className="h-4 w-4" /> Evaluate decision
            </button>
          </div>

          {/* Result */}
          <div className="space-y-4">
            {!entry ? (
              <div className="prod-card-padded flex h-full min-h-[300px] items-center justify-center text-center">
                <p className="text-sm text-muted-foreground max-w-sm">
                  Evaluate a decision to see the verdict, which rules fired, and the evidence record.
                </p>
              </div>
            ) : (
              <>
                <div className={`verdict-banner verdict-${entry.result.verdict === "APPROVE" ? "approved" : entry.result.verdict === "ESCALATE" ? "escalated" : "blocked"}`}>
                  <div>
                    <p className="text-label">Verdict</p>
                    <p className="mt-1 text-3xl font-bold tracking-tight">{entry.result.verdict}</p>
                    <p className="mt-2 text-[12px] text-foreground/80">{MODE_EFFECT[entry.result.mode]}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-label">Execution</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{entry.result.executionPermitted ? "Permitted" : "Stopped"}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">{avgMs !== null && <>Engine time {avgMs < 0.001 ? "< 0.001" : avgMs.toFixed(3)} ms<br />average of 1,000 runs in your browser</>}</p>
                  </div>
                </div>

                <div className="prod-card-padded">
                  <div className="flex items-center justify-between">
                    <h2>Rules evaluated</h2>
                    <span className="text-meta">
                      {entry.input.decisionId} · {entry.input.state ? `${entry.input.state} · ` : ""}{LINE_LABEL[entry.input.line]} · {money(entry.input.claimAmount, pack.currency)}
                    </span>
                  </div>
                  <RuleResultList results={entry.result.results} />
                </div>

                <div className="prod-card-padded space-y-1">
                  <h2>Evidence record</h2>
                  <p className="text-meta">SHA-256 of the decision payload and rule results. Recomputing it from the same record gives the same value, so any later change is detectable.</p>
                  <p className="break-all font-mono text-[11px] text-foreground">{entry.hash}</p>
                  <p className="text-meta">
                    Log entry #{entry.seq} · rule pack {entry.result.rulePackId} v{entry.result.rulePackVersion} · <VerdictBadge verdict={entry.result.verdict} />
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
