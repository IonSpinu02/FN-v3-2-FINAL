import { REGIONS, type Region } from "./constants";
import type {
  FabbisogniCatalogFile,
  MetadatiDato,
} from "./osservatorioTypes";

const REQUIRED_META: (keyof MetadatiDato)[] = [
  "fonte",
  "territorio",
  "popolazioneRiferimento",
  "periodoMisurato",
  "dataPubblicazione",
  "metodo",
  "naturaDato",
  "gradoConfrontabilita",
];

export function validateFabbisogniCatalog(
  catalog: FabbisogniCatalogFile,
): string[] {
  const errors: string[] = [];
  for (const region of REGIONS) {
    const block = catalog.regions[region as Region];
    if (!block) {
      errors.push(`Regione mancante: ${region}`);
      continue;
    }
    if (block.indicatori.length < 4) {
      errors.push(`${region}: servono almeno 4 indicatori`);
    }
    for (const ind of block.indicatori) {
      for (const key of REQUIRED_META) {
        const v = ind.metadati[key];
        if (v === undefined || v === null || String(v).trim() === "") {
          errors.push(`${region}/${ind.id}: metadati.${key} mancante`);
        }
      }
    }
  }
  return errors;
}
