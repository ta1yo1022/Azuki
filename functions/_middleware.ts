import { pageMetadata, metadataMarkup, type MetadataDeck } from '../shared/metadata';
import { standardDeck } from '../shared/standardDecks';
const PUBLIC_API='https://azuki-api.mizuno-taiyo-sub.workers.dev/api/public/decks/';
export const onRequest:PagesFunction = async context => {
 const url=new URL(context.request.url);
 const response=await context.next();
 if(!response.headers.get('content-type')?.includes('text/html'))return response;
 const path=url.pathname;
 const shared=/^\/shared\/([a-zA-Z0-9-]{1,80})(?:\/(study|book))?\/?$/.exec(path);
 let deck:MetadataDeck|undefined,missing=false,unavailable=false;
 if(shared){
  deck=standardDeck(shared[1]);
  if(!deck)try{
   const result=await fetch(PUBLIC_API+encodeURIComponent(shared[1]),{signal:AbortSignal.timeout(3000)});
   if(result.status===404)missing=true;
   else if(result.ok){const body=await result.json() as {deck?:MetadataDeck};const value=body.deck;if(value&&value.visibility==='public'&&typeof value.title==='string'&&typeof value.description==='string'&&Number.isFinite(value.wordCount))deck=value;else unavailable=true;}
   else unavailable=true;
  }catch{unavailable=true;}
 }
 const metadata=pageMetadata(path,deck);
 const headers=new Headers(response.headers);
 headers.delete('ETag');headers.delete('Last-Modified');headers.delete('Content-Length');
 headers.set('Cache-Control','no-store');
 headers.set('X-Robots-Tag',metadata.robots);
 const output=new Response(response.body,{status:missing?404:unavailable?503:response.status,headers});
 return new HTMLRewriter()
  .on('title, meta[name="description"], meta[name="robots"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"]',{element(element){element.remove();}})
  .on('head',{element(element){element.append(metadataMarkup(metadata),{html:true});}})
  .transform(output);
};
