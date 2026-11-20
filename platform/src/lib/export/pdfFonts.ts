import path from "node:path";
import { Font } from "@react-pdf/renderer";

let registered = false;

/**
 * Registra Inter (TTF locale) per UTF-8 e disabilita la sillabazione inglese
 * che spezza parole italiane (Gov-erno, Famil-iare, …).
 */
export function ensureDossierPdfFonts(): void {
  if (registered) return;
  const dir = path.join(process.cwd(), "public", "fonts");
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(dir, "Inter-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "Inter-Medium.ttf"), fontWeight: 500 },
      { src: path.join(dir, "Inter-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(dir, "Inter-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
