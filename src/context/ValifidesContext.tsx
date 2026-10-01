import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { evaluate, evidencePayload } from "@/engine/evaluate";
import { sha256Hex } from "@/engine/hash";
import { packFor } from "@/engine/packs";
import { generateSyntheticDecisions, SCENARIOS, type Scenario } from "@/engine/synthetic";
import { generateUsSyntheticDecisions, US_SCENARIOS } from "@/engine/usSynthetic";
import type { ClaimDecisionInput, EnforcementMode, EvaluationResult, HumanReview, Jurisdiction, RulePack } from "@/engine/types";

export type EntrySource = "GATEWAY" | "REVIEW" | "REPLAY";

export interface EvidenceEntry {
  seq: number;
  input: ClaimDecisionInput;
  result: EvaluationResult;
  hash: string;
  source: EntrySource;
  /** For a REVIEW entry: the sequence number of the escalated entry it resolves. */
  resolves?: number;
}

interface Ctx {
  jurisdiction: Jurisdiction;
  setJurisdiction: (j: Jurisdiction) => void;
  pack: RulePack;
  scenarios: Scenario[];
  mode: EnforcementMode;
  setMode: (m: EnforcementMode) => void;
  replay: { input: ClaimDecisionInput; result: EvaluationResult }[];
  log: EvidenceEntry[];
  replayEntries: EvidenceEntry[];
  evaluateAndLog: (input: ClaimDecisionInput, source?: EntrySource, resolves?: number) => Promise<EvidenceEntry>;
  resolvedSeqs: Set<number>;
  recordReview: (entry: EvidenceEntry, review: HumanReview) => Promise<EvidenceEntry>;
}

const ValifidesContext = createContext<Ctx | null>(null);

export function ValifidesProvider({ children }: { children: React.ReactNode }) {
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("IN");
  const [mode, setMode] = useState<EnforcementMode>("SHADOW");
  const [fullLog, setLog] = useState<EvidenceEntry[]>([]);
  const pack = packFor(jurisdiction);
  const scenarios = jurisdiction === "US" ? US_SCENARIOS : SCENARIOS;
  // Each jurisdiction keeps its own log view.
  const log = useMemo(() => fullLog.filter((e) => e.input.jurisdiction === jurisdiction), [fullLog, jurisdiction]);
  const seqRef = useRef(1);
  const [replayEntries, setReplayEntries] = useState<EvidenceEntry[]>([]);

  // Shadow replay: always evaluated in SHADOW, independent of the live mode.
  const replay = useMemo(
    () =>
      (jurisdiction === "US" ? generateUsSyntheticDecisions() : generateSyntheticDecisions()).map((input) => ({
        input,
        result: evaluate(input, "SHADOW"),
      })),
    [jurisdiction],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      replay.map(async ({ input, result }, i) => ({
        seq: (jurisdiction === "US" ? 200000 : 100000) + i,
        input,
        result,
        hash: await sha256Hex(evidencePayload(input, result)),
        source: "REPLAY" as const,
      })),
    ).then((entries) => !cancelled && setReplayEntries(entries));
    return () => {
      cancelled = true;
    };
  }, [replay, jurisdiction]);

  const evaluateAndLog = useCallback(
    async (input: ClaimDecisionInput, source: EntrySource = "GATEWAY", resolves?: number) => {
      const result = evaluate(input, mode);
      const hash = await sha256Hex(evidencePayload(input, result));
      const entry: EvidenceEntry = { seq: seqRef.current++, input, result, hash, source, resolves };
      setLog((l) => [entry, ...l]);
      return entry;
    },
    [mode],
  );

  const resolvedSeqs = useMemo(
    () => new Set(fullLog.filter((e) => e.resolves !== undefined).map((e) => e.resolves as number)),
    [fullLog],
  );

  const recordReview = useCallback(
    (entry: EvidenceEntry, review: HumanReview) =>
      evaluateAndLog(
        {
          ...entry.input,
          decisionId: `${entry.input.decisionId}-R`,
          humanReview: review,
          evaluatedAt: review.reviewedAt,
        },
        "REVIEW",
        entry.seq,
      ),
    [evaluateAndLog],
  );

  return (
    <ValifidesContext.Provider
      value={{ jurisdiction, setJurisdiction, pack, scenarios, mode, setMode, replay, log, replayEntries, evaluateAndLog, resolvedSeqs, recordReview }}
    >
      {children}
    </ValifidesContext.Provider>
  );
}

export function useValifides() {
  const ctx = useContext(ValifidesContext);
  if (!ctx) throw new Error("useValifides must be used inside ValifidesProvider");
  return ctx;
}
