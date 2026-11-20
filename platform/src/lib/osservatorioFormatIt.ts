/** Formattazione numeri percentuali in stile italiano (virgola decimale, punto migliaia). */
export function fmtPctIt(value: number, digits = 2): string {
  return `${value.toLocaleString("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function fmtNumIt(n: number): string {
  return Math.round(n).toLocaleString("it-IT");
}

export function fmtIndexIt(n: number): string {
  return n.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
