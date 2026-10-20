// @vitest-environment happy-dom
import {afterEach,expect,it} from 'vitest';
import {pageMetadata,metadataMarkup,SITE_ORIGIN} from '../shared/metadata';
import {applyPageMetadata} from '../src/components/PageMetadata';
afterEach(()=>{document.head.innerHTML='';});
const deck={title:'旅の英単語',description:'旅先で使う表現。',wordCount:500,visibility:'public',textbookTags:[{name:'旅行',edition:'第2版'}]};
it('uses the public deck metadata for sharing and normalizes study URLs',()=>{
 const detail=pageMetadata('/shared/travel',deck);
 expect(detail.title).toBe('旅の英単語 — Azuki');expect(detail.description).toContain('500語・旅行 第2版');expect(detail.robots).toBe('index, follow');
 for(const mode of ['book','study']){const meta=pageMetadata(`/shared/travel/${mode}`,deck);expect(meta.url).toBe(SITE_ORIGIN+'/shared/travel');expect(meta.robots).toBe('noindex, follow');expect(meta.title).toContain('旅の英単語');}
});
it('does not expose missing or private deck metadata',()=>{
 for(const data of [undefined,{...deck,visibility:'private'}]){const meta=pageMetadata('/shared/travel',data);expect(meta.title).not.toContain(deck.title);expect(meta.description).not.toContain(deck.description);expect(meta.robots).toContain('noindex');}
 for(const path of ['/library','/library/decks/secret','/admin/emails','/library/stats'])expect(pageMetadata(path).robots).toBe('noindex, nofollow');
});
it('escapes untrusted HTML in shared titles and descriptions',()=>{
 const markup=metadataMarkup(pageMetadata('/shared/test',{...deck,title:'<script>" & bad</script>',description:'"><img src=x onerror=bad>'}));
 expect(markup).not.toContain('<script>');expect(markup).not.toContain('<img');expect(markup).toContain('&lt;script&gt;&quot; &amp;');
});
it('updates metadata without duplicates and clears the previous deck when navigating',()=>{
 applyPageMetadata(pageMetadata('/shared/travel',deck));applyPageMetadata(pageMetadata('/shared/travel',deck));
 expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1);
 expect(document.head.querySelector('meta[name="twitter:title"]')?.getAttribute('content')).toBe(deck.title+' — Azuki');
 applyPageMetadata(pageMetadata('/explore'));
 expect(document.title).toBe('公開単語帳を探す — Azuki');
 expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(SITE_ORIGIN+'/explore');
 expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).not.toContain(deck.description);
});

it('keeps the private deck tab title owned by its screen while sharing no private data',()=>{
 document.title='自分の単語帳 — Azuki';applyPageMetadata(pageMetadata('/library/decks/secret/book'),false);
 expect(document.title).toBe('自分の単語帳 — Azuki');
 expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('マイライブラリ — Azuki');
});
