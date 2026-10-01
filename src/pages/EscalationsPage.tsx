import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { actionLabel, fmtTime, LINE_LABEL, money, PageHeader, RuleResultList, VerdictBadge } from "@/components/valifides/shared";
import { useValifides, type EvidenceEntry } from "@/context/ValifidesContext";
import type { ReviewerRole } from "@/engine/types";

const field = "rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground";

function ReviewForm({ entry, onDone }: { entry: EvidenceEntry; onDone: (e: EvidenceEntry) => void }) {
  const { recordReview } = useValifides();
  const [reviewerId, setReviewerId] = useState("REV-");
  const US = entry.input.jurisdiction === "US";
  const [role, setRole] = useState<ReviewerRole>(US ? "LICENSED_ADJUSTER" : entry.input.line === "MOTOR_OWN_DAMAGE" ? "CLAIMS_OFFICER" : "MEDICAL_OFFICER");
  const [rationale, setRationale] = useState("");
  const valid = reviewerId.length > 4 && rationale.trim().length >= 10;

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
      <p className="text-[12px] text-muted-foreground">Record the reviewer's decision. Valifides re-evaluates the decision with the review attached and logs both.</p>
      <div className="grid gap-3 md:grid-cols-[160px_220px_1fr]">
        <input className={field} value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} placeholder="Reviewer ID" />
        <select className={field} value={role} onChange={(e) => setRole(e.target.value as ReviewerRole)}>
          {US ? (
            <>
              <option value="LICENSED_ADJUSTER">Licensed adjuster</option>
              <option value="CLAIMS_MANAGER">Claims manager</option>
              <option value="CLAIMS_OFFICER">Claims officer (unlicensed)</option>
            </>
          ) : (
            <>
              <option value="CLAIMS_OFFICER">Claims officer</option>
              <option value="MEDICAL_OFFICER">Medical officer</option>
              <option value="SURVEYOR">Surveyor</option>
              <option value="CLAIMS_REVIEW_COMMITTEE">Claims Review Committee</option>
            </>
          )}
        </select>
        <input className={field} value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Rationale (at least 10 characters)" />
      </div>
      <button
        disabled={!valid}
        onClick={async () => onDone(await recordReview(entry, { reviewerId, role, rationale, reviewedAt: new Date().toISOString() }))}
        className="rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-40"
      >
        Record review and re-evaluate
      </button>
    </div>
  );
}

export default function EscalationsPage() {
  const { log, replayEntries, resolvedSeqs, scenarios } = useValifides();
  const [source, setSource] = useState<"LIVE" | "REPLAY">("LIVE");
  const [openSeq, setOpenSeq] = useState<number | null>(null);
  const [outcomes, setOutcomes] = useState<Record<number, EvidenceEntry>>({});

  const live = log.filter((e) => e.result.verdict === "ESCALATE" && e.source !== "REVIEW");
  const replay = replayEntries.filter((e) => e.result.verdict === "ESCALATE");
  const list = (source === "LIVE" ? live : replay).filter((e) => !resolvedSeqs.has(e.seq) || outcomes[e.seq]);

  const tab = (v: typeof source, label: string, n: number) => (
    <button onClick={() => setSource(v)} className={`rounded-md px-3 py-1.5 text-[12px] font-medium ${source === v ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
      {label} ({n})
    </button>
  );

  return (
    <AppLayout>
      <div className="section-gap-sm max-w-[1400px]">
        <PageHeader
          title="Escalation Queue"
          subtitle="Decisions that need an authorised human before they take effect, or that are close to a regulatory deadline. Recording a review re-runs the rules; time-limit escalations clear only when the claim moves, not with a sign-off."
        />
        <div className="flex gap-1 rounded-lg border border-border p-1 w-fit">
          {tab("LIVE", "From Decision Gateway", live.filter((e) => !resolvedSeqs.has(e.seq)).length)}
          {tab("REPLAY", "From shadow replay", replay.filter((e) => !resolvedSeqs.has(e.seq)).length)}
        </div>

        {list.length === 0 ? (
          <div className="prod-card-padded text-center text-sm text-muted-foreground">
            {source === "LIVE" ? `No open escalations. Evaluate a decision in the Decision Gateway, for example “${scenarios[0].label}”.` : "Loading replay…"}
          </div>
        ) : (
          <div className="space-y-3">
            {list.slice(0, 50).map((e) => {
              const reasons = e.result.results.filter((r) => r.outcome === "ESCALATE");
              const done = outcomes[e.seq];
              return (
                <div key={e.seq} className="prod-card-padded">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-[12px] text-foreground">{e.input.decisionId}</span>
                    <span className="text-[12px] text-muted-foreground">{e.input.state ? `${e.input.state} · ` : ""}{LINE_LABEL[e.input.line]} · {actionLabel(e.input.proposedAction, e.input.jurisdiction)} · {money(e.input.claimAmount, e.input.jurisdiction === "US" ? "USD" : "INR")}</span>
                    <span className="text-[11px] text-muted-foreground">{fmtTime(e.input.evaluatedAt, e.input.jurisdiction)}</span>
                    <span className="ml-auto">{done ? <span className="flex items-center gap-2 text-[12px] text-muted-foreground">After review <VerdictBadge verdict={done.result.verdict} /></span> : <VerdictBadge verdict="ESCALATE" />}</span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {reasons.map((r) => (
                      <li key={r.ruleId} className="text-[13px] text-foreground/90"><span className="font-mono text-[11px] text-warning mr-2">{r.ruleId}</span>{r.message}</li>
                    ))}
                  </ul>
                  {done ? (
                    <div className="mt-3 rounded-lg border border-border p-3">
                      <p className="text-[12px] text-muted-foreground">Re-evaluated as log entry #{done.seq}. Evidence hash <span className="font-mono">{done.hash.slice(0, 16)}…</span></p>
                      <RuleResultList results={done.result.results} />
                    </div>
                  ) : openSeq === e.seq ? (
                    <ReviewForm entry={e} onDone={(r) => { setOutcomes((o) => ({ ...o, [e.seq]: r })); setOpenSeq(null); }} />
                  ) : (
                    <button onClick={() => setOpenSeq(e.seq)} className="mt-3 rounded-lg border border-border px-3 py-1.5 text-[12px] text-foreground hover:bg-accent">
                      Review this decision
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
