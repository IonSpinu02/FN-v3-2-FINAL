/**
 * Disambiguazione contestuale titolo+snippet (anti falsi positivi keyword isolate).
 */

/**
 * Contesti abitativi/welfare: «sgombero» qui NON è sicurezza urbana.
 * Es. anziani/donne sfrattati, ordine religioso proprietario, emergenza alloggiativa.
 */
export const HOUSING_EVICTION_CONTEXT =
  /anzian|donne|famigl|sfratt|affitt|inquilin|proprietari[oa].{0,24}immobil|immobil.{0,24}propriet|case\s*popolar|\berp\b|emergenza\s*abitativ|mutuo|ordine\s*religios|curia|ributtat|senza\s*casa|allogg|stabile\s*interess|condomin|morosit/i;

/** Contesti in cui «sgombero/occupazione» resta SICUREZZA. */
export const SECURITY_EVICTION_CONTEXT =
  /campo\s*abusiv|centr[oi]\s*social|migrant|clandestin|spaccio|degrad|baby\s*gang|occupazion[ei]?\s*abusiv|racket|allacci\s*abusiv|criminalit|pusher|zona\s*rossa|daspo/i;

export function isHousingEvictionContext(blob: string): boolean {
  const t = blob.normalize("NFC");
  const evictionCue =
    /sgomber|sfratt|emergenza\s*abitativ|ributtat.{0,20}strada|inquilin|proprietari[oa].{0,24}immobil/i.test(
      t,
    );
  if (!evictionCue) return false;
  if (SECURITY_EVICTION_CONTEXT.test(t) && !HOUSING_EVICTION_CONTEXT.test(t)) {
    return false;
  }
  return HOUSING_EVICTION_CONTEXT.test(t);
}
