import {describe,it,expect} from 'vitest';
import {emailImageUrl,renderEmailBody} from '../shared/emailBody';
describe('email formatting',()=>{
 it('renders bold and preserves links, newlines, and readable plain text',()=>{
  const result=renderEmailBody('前 **大切な変更** 後\nhttps://example.com/\n\n次の段落');
  expect(result.html).toContain('>大切な変更</strong>');expect(result.html).toContain('<br>');expect(result.html).toContain('href="https://example.com/"');expect(result.text).toBe('前 大切な変更 後\nhttps://example.com/\n\n次の段落');
 });
 it('renders a standalone HTTPS image between paragraphs and escapes its description',()=>{
  const result=renderEmailBody('上の文章\n![画面 "説明"](https://example.com/screen.png)\n下の文章');
  expect(result.html).toContain('src="https://example.com/screen.png"');expect(result.html).toContain('alt="画面 &quot;説明&quot;"');expect(result.html).toContain('max-width:544px');expect(result.text).toContain('画面 "説明": https://example.com/screen.png');
 });
 it('never accepts active HTML, data URLs, or credential-bearing image URLs',()=>{
  for(const url of ['javascript:alert(1)','data:image/svg+xml,evil','http://example.com/a.png','https://user:secret@example.com/a.png']){
   expect(emailImageUrl(url)).toBeNull();expect(renderEmailBody(`![x](${url})`).html).not.toContain('<img');
  }
  const result=renderEmailBody('**<script>x</script>**\n<img src=x onerror=alert(1)>');expect(result.html).not.toContain('<script>');expect(result.html).not.toContain('<img');expect(result.html).toContain('&lt;script&gt;');
 });
 it('supports URLs with parentheses using encoded image syntax',()=>{
  const url=emailImageUrl('https://example.com/image(1).png');expect(url).toBe('https://example.com/image%281%29.png');expect(renderEmailBody(`![画像](${url})`).html).toContain('<img');
 });
});
