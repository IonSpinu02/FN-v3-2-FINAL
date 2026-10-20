export function pct(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function pp(value: number, digits = 3): string {
  return `${value.toFixed(digits)} pp`;
}

export function num(value: number): string {
  return new Intl.NumberFormat("it-IT").format(Math.round(value));
}
