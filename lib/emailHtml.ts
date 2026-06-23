const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

export function escapeHtmlAttribute(value: unknown) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

export function textToHtmlBreaks(value: unknown) {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, "<br/>");
}

export function textToHtmlParagraphs(value: unknown) {
  return String(value ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => escapeHtml(line))
    .map(
      (line) =>
        `<p style="margin:0 0 14px;font-size:16px;line-height:1.7;color:#344054;">${line}</p>`
    )
    .join("");
}
