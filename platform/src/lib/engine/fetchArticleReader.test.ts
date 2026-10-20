import { describe, expect, it } from "vitest";
import {
  extractReadableArticleFromHtml,
  isPublicHttpUrl,
} from "./fetchArticleReader";

describe("fetchArticleReader", () => {
  it("isPublicHttpUrl rifiuta localhost", () => {
    expect(isPublicHttpUrl("https://www.ansa.it/a")).toBe(true);
    expect(isPublicHttpUrl("http://127.0.0.1/x")).toBe(false);
  });

  it("extractReadableArticleFromHtml prende paragrafi e og:description", () => {
    const html = `<!doctype html><html><head>
      <meta property="og:title" content="Titolo Test" />
      <meta property="og:description" content="Sommario social lungo abbastanza per superare la soglia minima di caratteri." />
      </head><body><article>
      <p>Primo paragrafo dell articolo con sufficiente testo per essere estratto dal parser.</p>
      <p>Secondo paragrafo con dettagli sul consiglio comunale e sulle elezioni locali.</p>
      </article></body></html>`;
    const { title, body } = extractReadableArticleFromHtml(html);
    expect(title).toContain("Titolo Test");
    expect(body).toContain("Primo paragrafo");
    expect(body).toContain("Secondo paragrafo");
  });
});
