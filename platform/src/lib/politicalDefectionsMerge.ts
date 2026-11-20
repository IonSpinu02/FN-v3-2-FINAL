import {
  attachBeneficioIngressoFn,
  filterRassegnaExternalsOnly,
  isExcludedGuaranteePolitician,
  type TrackedPolitician,
} from "@/lib/politicalDefectionsEngine";
import {
  isTrueCameraGroupChange,
  latestCameraChangeBySurname,
  type CameraGroupChangeRow,
} from "@/lib/politicalDefectionsCameraSparql";

/** Match Nome Cognome vs Cognome Nome (token set). */
export function namesMatch(a: string, b: string): boolean {
  const na = a
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const nb = b
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (na === nb) return true;
  const ta = na.split(" ").filter((t) => t.length > 1).sort();
  const tb = nb.split(" ").filter((t) => t.length > 1).sort();
  if (ta.length >= 2 && tb.length >= 2 && ta.join(" ") === tb.join(" ")) return true;
  const ca = ta[ta.length - 1];
  const cb = tb[tb.length - 1];
  if (ca && cb && ca === cb && ca.length > 3) {
    const shared = ta.filter((t) => tb.includes(t));
    if (shared.length >= 2) return true;
  }
  return false;
}

function partitoFromGruppo(label: string): TrackedPolitician["partitoProvenienza"] {
  if (label === "Lega") return "Lega";
  if (label === "Fratelli d'Italia") return "Fratelli d'Italia";
  if (label === "Forza Italia") return "Forza Italia";
  if (label === "Gruppo Misto") return "Gruppo Misto";
  if (label === "Futuro Nazionale") return "Futuro Nazionale";
  return "Altri";
}

function statoAdesioneFromChange(
  da: string,
  a: string,
): TrackedPolitician["statoAdesioneFN"] {
  if (a === "Futuro Nazionale") return "Ufficiale in FN";
  if (a === "Gruppo Misto") return "Uscito nel Misto (Contendibile)";
  if (a === "Forza Italia" || a === "Lega" || a === "Fratelli d'Italia") {
    return "Transitato in altro gruppo CDX/Centro";
  }
  if (/vannacci|futuro/i.test(`${da} ${a}`)) return "Dialogo / Vicino a FN";
  return "Uscito nel Misto (Contendibile)";
}

function applyCameraChange(p: TrackedPolitician, ch: CameraGroupChangeRow): TrackedPolitician {
  if (!isTrueCameraGroupChange(ch)) return p;
  const statoDescrittivo = `Da ${ch.gruppoDaLabel} → ${ch.gruppoALabel} · Cambio gruppo ufficiale Camera`;
  return attachBeneficioIngressoFn({
    ...p,
    dataCambioPartito: ch.dataCambioIso,
    cambioGruppoDa: ch.gruppoDaLabel,
    cambioGruppoA: ch.gruppoALabel,
    cambioGruppoFonte: "Cambio gruppo ufficiale Camera",
    schedaCameraUrl: ch.schedaCameraUrl,
    statoAdesioneFN: statoAdesioneFromChange(ch.gruppoDaLabel, ch.gruppoALabel),
    fonteIstituzionale: {
      label: "Scheda Camera XIX Legislatura",
      url: ch.schedaCameraUrl,
      tipo: "Camera XIX Leg.",
    },
    statoDescrittivo,
    partitoProvenienza: partitoFromGruppo(ch.gruppoDaLabel),
    partitoDestinazione:
      ch.gruppoALabel === "Futuro Nazionale"
        ? "Futuro Nazionale"
        : ch.gruppoALabel === "Gruppo Misto"
          ? "Gruppo Misto"
          : ch.gruppoALabel === "Forza Italia"
            ? "Forza Italia"
            : "In carica (nessun passaggio FN)",
    ultimaNotizia: {
      ...p.ultimaNotizia,
      dataOra: ch.dataCambioIso,
      fonte: "Open Data Camera · SPARQL",
      url: ch.schedaCameraUrl,
    },
  });
}

/**
 * Unisce anagrafe verificata con estratti SPARQL Camera.
 * Nessuno stub auto-generato (evita «Collegio da verificare» e voti placeholder).
 * Pubblica solo record con fonti istituzionale + stampa e collegio reale.
 */
export function mergePoliticiansWithCameraLive(
  catalogPoliticians: TrackedPolitician[],
  cameraChanges: CameraGroupChangeRow[],
): TrackedPolitician[] {
  const trueChanges = cameraChanges.filter(isTrueCameraGroupChange);

  const eligible = catalogPoliticians.filter(
    (p) =>
      !isExcludedGuaranteePolitician(p.nome) &&
      p.stato !== "BACINO_CDX_IN_CARICA",
  );

  const merged = eligible.map((p) => {
    const withBeneficio = attachBeneficioIngressoFn(p);
    const ch = latestCameraChangeBySurname(trueChanges, p.nome);
    if (ch && p.stato !== "UFFICIALE_FN") {
      return applyCameraChange(withBeneficio, ch);
    }
    return withBeneficio;
  });

  const published = merged.filter((p) => {
    if (p.stato === "UFFICIALE_FN" || p.stato === "BACINO_CDX_IN_CARICA") return true;
    if (p.stato === "CAMBIO_GRUPPO_VERIFICATO") {
      const hasIst = Boolean(p.fonteIstituzionale?.url?.startsWith("http"));
      const hasPress = Boolean(p.fonteStampa?.url?.startsWith("http"));
      const collegioOk =
        Boolean(p.collegioDisplay?.trim()) &&
        !/collegio da verificare|collegio \(scheda/i.test(p.collegioDisplay);
      return hasIst && hasPress && collegioOk && p.doteVerified !== false;
    }
    return Boolean(p.fonteStampa?.url?.startsWith("http"));
  });

  published.sort((a, b) => {
    const da = a.dataCambioPartito ?? a.ultimaNotizia.dataOra;
    const db = b.dataCambioPartito ?? b.ultimaNotizia.dataOra;
    return new Date(db).getTime() - new Date(da).getTime();
  });

  return filterRassegnaExternalsOnly(published);
}
