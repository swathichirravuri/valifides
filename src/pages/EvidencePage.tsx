import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { actionLabel, download, fmtTime, LINE_LABEL, PageHeader, VerdictBadge } from "@/components/valifides/shared";
import { useValifides, type EvidenceEntry } from "@/context/ValifidesContext";
import { evidencePayload } from "@/engine/evaluate";
import { sha256Hex } from "@/engine/hash";
import { Download, ShieldCheck, ShieldAlert } from "lucide-react";

export default function EvidencePage() {
  const { log, replayEntries } = useValifides();
  const [includeReplay, setIncludeReplay] = useState(false);
  const [checks, setChecks] = useState<Record<number, boolean>>({});
  const [limit, setLimit] = useState(50);

  const entries: EvidenceEntry[] = includeReplay ? [...log, ...replayEntries] : log;

  const verify = async (e: EvidenceEntry) => {
    const recomputed = await sha256Hex(evidencePayload(e.input, e.result));
    setChecks((c) => ({ ...c, [e.seq]: recomputed === e.hash }));
  };

  const exportJson = () =>
    download(
      `valifides-evidence-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(entries.map((e) => ({ seq: e.seq, source: e.source, resolves: e.resolves ?? null, hash: e.hash, ...evidencePayload(e.input, e.result) })), null, 2),
      "application/json",
    );

  const exportCsv = () => {
    const head = ["seq", "source", "jurisdiction", "state", "decision_id", "claim_id", "line", "proposed_action", "ai_involvement", "verdict", "mode", "rules_fired", "evaluated_at", "sha256"];
    const rows = entries.map((e) =>
      [
        e.seq, e.source, e.input.jurisdiction, e.input.state ?? "", e.input.decisionId, e.input.claimId, e.input.line, e.input.proposedAction, e.input.aiInvolvement,
        e.result.verdict, e.result.mode,
        e.result.results.filter((r) => r.outcome === "BLOCK" || r.outcome === "ESCALATE").map((r) => r.ruleId).join(" "),
        e.input.evaluatedAt, e.hash,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    );
    download(`valifides-evidence-${new Date().toISOString().slice(0, 10)}.csv`, [head.join(","), ...rows].join("\n"), "text/csv");
  };

  const btn = "flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] text-foreground hover:bg-accent";

  return (
    <AppLayout>
      <div className="section-gap-sm max-w-[1400px]">
        <PageHeader
          title="Evidence Log"
          subtitle="Every evaluation, with the decision payload, the rule results and a SHA-256 hash of both. Verify recomputes the hash from the stored record; a mismatch means the record was changed. Export for an auditor or regulator."
          right={
            <div className="flex gap-2">
              <button className={btn} onClick={exportJson}><Download className="h-3.5 w-3.5" /> JSON</button>
              <button className={btn} onClick={exportCsv}><Download className="h-3.5 w-3.5" /> CSV</button>
            </div>
          }
        />

        <label className="flex items-center gap-2 text-[13px] text-foreground">
          <input type="checkbox" checked={includeReplay} onChange={(e) => setIncludeReplay(e.target.checked)} />
          Include the {replayEntries.length} shadow-replay records
        </label>

        <div className="prod-card overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                {["#", "Source", "Evaluated", "Decision", "Line", "Action", "Mode", "Verdict", "Evidence hash", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">No evaluations yet. Use the Decision Gateway, or include the shadow-replay records.</td></tr>
              )}
              {entries.slice(0, limit).map((e) => (
                <tr key={e.seq} className="border-t border-border">
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">{e.seq}</td>
                  <td className="px-4 py-2.5">{e.source === "REVIEW" ? `Review of #${e.resolves}` : e.source.charAt(0) + e.source.slice(1).toLowerCase()}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{fmtTime(e.input.evaluatedAt, e.input.jurisdiction)}</td>
                  <td className="px-4 py-2.5 font-mono">{e.input.decisionId}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{e.input.state ? `${e.input.state} · ` : ""}{LINE_LABEL[e.input.line]}</td>
                  <td className="px-4 py-2.5">{actionLabel(e.input.proposedAction, e.input.jurisdiction)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.result.mode.toLowerCase()}</td>
                  <td className="px-4 py-2.5"><VerdictBadge verdict={e.result.verdict} /></td>
                  <td className="px-4 py-2.5 font-mono text-muted-foreground" title={e.hash}>{e.hash.slice(0, 16)}…</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {checks[e.seq] === undefined ? (
                      <button onClick={() => verify(e)} className="text-primary hover:underline">Verify</button>
                    ) : checks[e.seq] ? (
                      <span className="flex items-center gap-1 text-success"><ShieldCheck className="h-3.5 w-3.5" /> Intact</span>
                    ) : (
                      <span className="flex items-center gap-1 text-critical"><ShieldAlert className="h-3.5 w-3.5" /> Altered</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length > limit && (
            <button onClick={() => setLimit(limit + 50)} className="w-full border-t border-border py-3 text-[12px] text-primary hover:bg-accent/50">
              Show more ({entries.length - limit} remaining)
            </button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
