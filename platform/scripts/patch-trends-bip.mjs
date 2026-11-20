import fs from "fs";

const p = new URL("../src/lib/googleTrendsIntelligence.ts", import.meta.url);
let s = fs.readFileSync(p, "utf8");
const start = s.indexOf("/** Template mirati");
const end = s.indexOf("];", start) + 2;
const ins = `/** Solo ricerche cittadine con soluzione B.I.P. (catalogo flagship). */
import { BIP_FLAGSHIP_TREND_TEMPLATES } from "./googleTrendsBipCatalog";

export const TRENDS_TOPIC_CLUSTERS: TrendTemplate[] = BIP_FLAGSHIP_TREND_TEMPLATES.map(
  (f) => ({
    slug: f.slug,
    cluster: f.cluster,
    exactQuery: f.exactQuery,
    queryType: f.queryType,
    category: f.category,
    datoBase: f.datoBase,
    piano: {
      causaRadice: f.causaRadice,
      soluzionePratica: f.soluzioneBip,
      enteCompetente: f.enteCompetente,
      tempiAttuazione: f.tempiAttuazione,
      azioneSulCampo48h: f.azioneSulCampo48h,
    },
  }),
);
`;
s = s.slice(0, start) + ins + s.slice(end);
fs.writeFileSync(p, s);
