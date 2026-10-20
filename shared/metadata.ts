export const SITE_ORIGIN = 'https://azuki.mame-app.com';
export const SITE_DESCRIPTION = '自分の英単語帳を作って、カードや本型の単語帳で学習。例文の編集、公開単語帳の検索・お気に入り・共有にも対応しています。';
export type MetadataDeck = {title:string;description:string;wordCount:number;textbookTags?:{name:string;edition?:string}[];visibility?:string};
export type PageMetadata = {title:string;description:string;url:string;image:string;robots:string;type:string};
export function pageMetadata(pathname:string,deck?:MetadataDeck):PageMetadata {
 const path=pathname.replace(/\/+$/,'')||'/';
 const shared=/^\/shared\/([a-zA-Z0-9-]{1,80})(?:\/(study|book))?$/.exec(path);
 let title='Azuki | 自分の単語帳で英語を覚える',description=SITE_DESCRIPTION,robots='index, follow',canonical=path;
 const pages:Record<string,[string,string]>={
  '/plans':['Azuki Pro — 月額480円','月額480円（税込）。単語・例文音声の新規生成の個人上限を解除し、本型の単語帳で学習できます。'],
  '/explore':['公開単語帳を探す — Azuki','CEFR-Jやテーマ別の英単語帳、みんなが公開した単語帳を検索。ログインせずにカード学習を試せます。本型の学習はProで利用できます。'],
  '/guide/create':['オリジナル英単語帳の作り方 — Azuki','AIで作った単語・意味・例文をJSONでまとめて登録。Azukiで自分の例文に編集して、単語帳を作る方法を紹介します。'],
  '/privacy':['プライバシーポリシー — Azuki','英単語帳アプリAzukiにおける個人情報、Cookie、アクセス解析などの取り扱いについて。'],
  '/commerce':['特定商取引法に基づく表記 — Azuki','Azuki Proの販売者情報、月額料金、支払い・提供時期、解約・返金条件について。'],
  '/terms':['利用規約 — Azuki','英単語帳アプリAzukiの利用条件、単語帳の公開・コピー・権利について。'],
  '/copyright':['著作権・権利侵害への対応 — Azuki','Azukiでの著作権の尊重、単語帳の公開時の注意、権利侵害の申告と対応について。'],
 };
 if(pages[path])[title,description]=pages[path];
 else if(shared){
  canonical=`/shared/${shared[1]}`;
  robots='noindex, follow';title='公開単語帳 — Azuki';description='公開されている英単語帳を、カードや本型の単語帳で学習できます。';
  if(deck && deck.visibility!=='private'){
   const tags=(deck.textbookTags??[]).map(tag=>[tag.name,tag.edition].filter(Boolean).join(' ')).join('・');
   title=`${deck.title}${shared[2]==='book'?' — 単語帳で学習':shared[2]==='study'?' — カードで学習':''} — Azuki`;
   description=[deck.description.trim(),`${deck.wordCount.toLocaleString('ja-JP')}語${tags?`・${tags}`:''}。Azukiでログインせずに閲覧・学習できます。`].filter(Boolean).join(' ').slice(0,240);
   robots=shared[2]?'noindex, follow':'index, follow';
  }
 }else if(path!=='/'){
  robots='noindex, nofollow';
  title=path.includes('/stats')?'学習統計 — Azuki':path.includes('/settings')?'設定 — Azuki':path.startsWith('/library')?'マイライブラリ — Azuki':'Azuki';
 }
 return {title,description,url:SITE_ORIGIN+canonical,image:SITE_ORIGIN+'/og-image.png',robots,type:'website'};
}
export function metadataTags(meta:PageMetadata){return [
 ['name','description',meta.description],['name','robots',meta.robots],
 ['property','og:site_name','Azuki'],['property','og:locale','ja_JP'],['property','og:type',meta.type],['property','og:title',meta.title],['property','og:description',meta.description],['property','og:url',meta.url],['property','og:image',meta.image],['property','og:image:width','1920'],['property','og:image:height','1080'],['property','og:image:alt','英単語帳アプリ Azuki'],
 ['name','twitter:card','summary_large_image'],['name','twitter:title',meta.title],['name','twitter:description',meta.description],['name','twitter:image',meta.image],['name','twitter:image:alt','英単語帳アプリ Azuki'],
 ];}
export function escapeMetadata(value:string){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));}
export function metadataMarkup(meta:PageMetadata){return `<title>${escapeMetadata(meta.title)}</title><link rel="canonical" href="${escapeMetadata(meta.url)}">`+metadataTags(meta).map(([attr,key,value])=>`<meta ${attr}="${key}" content="${escapeMetadata(value)}">`).join('');}
