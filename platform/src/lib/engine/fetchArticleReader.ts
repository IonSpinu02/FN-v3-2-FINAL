/** Estrae testo leggibile da HTML di articolo (RSS / pagina testata). */

export function isPublicHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".local") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(html: string): string {
  return decodeBasicEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function metaContent(html: string, prop: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re);
  if (m?.[1]) return stripTags(m[1]);
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
    "i",
  );
  const m2 = html.match(re2);
  return m2?.[1] ? stripTags(m2[1]) : "";
}

function extractParagraphs(html: string): string[] {
  const paras: string[] = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const t = stripTags(m[1]!);
    if (t.length >= 40) paras.push(t);
  }
  return paras;
}

function extractArticleBlock(html: string): string {
  const art = html.match(/<article[\s\S]*?<\/article>/i);
  if (art) return art[0]!;
  const main = html.match(/<main[\s\S]*?<\/main>/i);
  if (main) return main[0]!;
  return html;
}

export function extractReadableArticleFromHtml(
  html: string,
  fallbackTitle = "",
): { title: string; body: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title =
    metaContent(html, "og:title") ||
    (titleMatch ? stripTags(titleMatch[1]!) : "") ||
    fallbackTitle;

  const ogDesc = metaContent(html, "og:description");
  const block = extractArticleBlock(html);
  const paragraphs = extractParagraphs(block);

  let body = paragraphs.join("\n\n");
  if (body.length < 120 && ogDesc.length >= 40) {
    body = ogDesc + (body ? `\n\n${body}` : "");
  }
  if (body.length < 80) {
    body = stripTags(block).slice(0, 12000);
  }

  return { title: title || fallbackTitle, body: body.trim() };
}

export async function fetchArticleReadableText(
  url: string,
  timeoutMs = 9000,
): Promise<{ title: string; body: string; sourceUrl: string }> {
  if (!isPublicHttpUrl(url)) {
    throw new Error("URL non consentito");
  }

  const signal =
    typeof AbortSignal !== "undefined" &&
    "timeout" in AbortSignal &&
    typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(timeoutMs)
      : undefined;

  const res = await fetch(url, {
    signal,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent":
        "FuturoNazionale-RSS-Reader/1.0 (+https://futuronazionale.it; editorial review)",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const html = await res.text();
  const { title, body } = extractReadableArticleFromHtml(html, "");
  return { title, body, sourceUrl: url };
}
