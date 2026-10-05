/** Tiny, safe markdown for chat bubbles: paragraphs, bullet lists, **bold**, *italic*, `code`, links. */

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

function inline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(
    /\[([^\]]+)\]\(((?:https?:\/\/|mailto:|\/|#)[^\s)]*)\)/g,
    (_m, label: string, url: string) =>
      /^https?:/.test(url) ? `<a href="${url}" target="_blank" rel="noopener">${label}</a>` : `<a href="${url}">${label}</a>`,
  );
  out = out.replace(/(^|[\s(])([\w.+-]+@[\w-]+\.[\w.-]*\w)(?=$|[\s).,!?;:])/g, '$1<a href="mailto:$2">$2</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  return out;
}

export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r/g, '').replace(/\s*—\s*/g, ', ').split('\n');
  const html: string[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (para.length) html.push(`<p>${para.map(inline).join('<br>')}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list.length) html.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
    list = [];
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      flushPara();
      list.push(bullet[1]);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return html.join('');
}
