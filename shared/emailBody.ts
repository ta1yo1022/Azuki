export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function emailImageUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.href.replace(/\(/g,'%28').replace(/\)/g,'%29');
  } catch { return null; }
}
function inline(value: string): string {
  // A deliberately small format: bold and automatic links, never arbitrary HTML.
  return value.split(/(\*\*[^*\n]+\*\*|https?:\/\/[^\s<>"'*]+)/g).map(part => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
      return `<strong style="font-weight:700;color:#282521">${inline(part.slice(2,-2))}</strong>`;
    if (!/^https?:\/\//.test(part)) return escapeHtml(part);
    const match=/^(.*?)([。、，．！？）》」』.,!?;:]*)$/.exec(part)!;
    const url=match[1];
    try { const parsed=new URL(url); if(!['http:','https:'].includes(parsed.protocol))throw new Error(); }
    catch { return escapeHtml(part); }
    return `<a href="${escapeHtml(url)}" style="color:#972d31;text-decoration:underline;word-break:break-all">${escapeHtml(url)}</a>${escapeHtml(match[2])}`;
  }).join('');
}
export function renderEmailBody(body: string) {
  const blocks: string[] = [], plain: string[] = [], lines: string[] = [];
  function flush() {
    if (!lines.length) return;
    blocks.push(`<p style="margin:0 0 22px;font-size:16px;line-height:1.9;color:#514a44;overflow-wrap:anywhere;word-break:break-word">${lines.map(inline).join('<br>')}</p>`);
    plain.push(lines.join('\n').replace(/\*\*([^*\n]+)\*\*/g,'$1')); lines.length=0;
  }
  for (const line of body.replace(/\r\n?/g,'\n').split('\n')) {
    const match=/^!\[([^\]\r\n]*)\]\((https:\/\/[^\s()]+)\)$/.exec(line.trim());
    const url=match ? emailImageUrl(match[2]) : null;
    if (match && url) {
      flush();
      blocks.push(`<p style="margin:0 0 22px"><img src="${escapeHtml(url)}" alt="${escapeHtml(match[1])}" width="544" style="display:block;width:100%;max-width:544px;height:auto;border:0;border-radius:12px" referrerpolicy="no-referrer"></p>`);
      plain.push(`${match[1] || '画像'}: ${url}`);
    } else if (!line.trim()) flush();
    else lines.push(line);
  }
  flush();
  return {html:blocks.join(''),text:plain.join('\n\n')};
}
