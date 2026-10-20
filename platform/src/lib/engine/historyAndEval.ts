/**
 * Storico iscritti e validazione post-voto (port da modello_fn_v3_2.py).
 * Re-esporta i moduli esistenti e aggiunge copertura forbice sondaggio regionale.
 */
export {
  parseHistory,
  type HistoryMonthEntry,
} from "./parseHistory";

export {
  evaluatePostVote,
  type PostVoteResult,
  type PostVoteValidation,
  type ScenarioRowWithVote,
} from "./evaluatePostVote";

import { computeRegionalPoll, DEFAULT_POLL_CONFIG, type RegionalPollConfig } from "./regionalPoll";
import { evaluatePostVote, type PostVoteResult, type ScenarioRowWithVote } from "./evaluatePostVote";
import type { ScenarioResult } from "./types";

export type ScenarioRowWithVoteExtended = ScenarioRowWithVote & {
  in_forbice_sondaggio?: boolean;
  in_sensibilita_pesi?: boolean;
};

export interface PostVoteResultExtended extends PostVoteResult {
  validazione_predittiva: PostVoteResult["validazione_predittiva"] & {
    copertura_forbice_sondaggio?: number;
  };
  righe: ScenarioRowWithVoteExtended[];
}

export function evaluatePostVoteWithPoll(
  snapshot: ScenarioResult,
  csvContent: string,
  pollConfig: RegionalPollConfig = DEFAULT_POLL_CONFIG,
): PostVoteResultExtended {
  const base = evaluatePostVote(snapshot, csvContent);
  const poll = computeRegionalPoll(snapshot, pollConfig);
  const pollMap = Object.fromEntries(poll.map((p) => [p.regione, p]));

  let covPoll = 0;
  const righe: ScenarioRowWithVoteExtended[] = base.righe.map((row) => {
    const pr = pollMap[row.regione];
    const inPoll =
      pr != null &&
      row.voto_osservato != null &&
      row.voto_osservato >= pr.icLow &&
      row.voto_osservato <= pr.icHigh;
    const inSens =
      row.voto_osservato != null &&
      row.voto_osservato >= row.lo10 &&
      row.voto_osservato <= row.hi90;
    if (inPoll) covPoll += 1;
    return {
      ...row,
      in_forbice_sondaggio: inPoll,
      in_sensibilita_pesi: inSens,
    };
  });

  return {
    validazione_predittiva: {
      ...base.validazione_predittiva,
      copertura_forbice_sondaggio: covPoll / 20,
    },
    righe,
  };
}
