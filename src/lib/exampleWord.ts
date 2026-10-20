const irregular:Record<string,string[]>={be:['am','is','are','was','were','been','being'],have:['has','had','having'],do:['does','did','done','doing'],go:['goes','went','gone','going'],say:['says','said'],make:['made','making'],take:['took','taken','taking'],get:['gets','got','gotten','getting'],see:['saw','seen','seeing'],come:['came','coming'],run:['ran','running'],write:['wrote','written','writing'],read:['reads','reading'],eat:['ate','eaten','eating'],buy:['bought'],think:['thought'],know:['knew','known'],give:['gave','given','giving'],find:['found'],leave:['left','leaving'],feel:['felt'],bring:['brought'],teach:['taught'],speak:['spoke','spoken'],tell:['told'],meet:['met'],understand:['understood']};
export function exampleWordParts(sentence:string,headword:string){
 const forms=new Set<string>();
 const exact=headword.split('/').map(word=>word.trim()).filter(Boolean);
 for(const raw of headword.split('/')){
  const word=raw.trim();if(!word)continue;forms.add(word);
  if(/^[a-z]+$/i.test(word)){
   const lower=word.toLowerCase();
   for(const form of irregular[lower]??[])forms.add(form);
   forms.add(word+'s');forms.add(word+'es');
   if(/[^aeiou]y$/i.test(word)){forms.add(word.slice(0,-1)+'ies');forms.add(word.slice(0,-1)+'ied');}
   forms.add(word.endsWith('e')?word+'d':word+'ed');
   forms.add(/ie$/i.test(word)?word.slice(0,-2)+'ying':/[^e]e$/i.test(word)?word.slice(0,-1)+'ing':word+'ing');
   if(/[^aeiou][aeiou][^aeiouwxy]$/i.test(word)&&word.length<=5){forms.add(word+word.at(-1)+'ing');forms.add(word+word.at(-1)+'ed');}
  }
 }
 if(!forms.size)return [{text:sentence,match:false}];
 const escape=(form:string)=>form.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const exactPattern=exact.map(escape).join('|');
 const exactFound=exactPattern&&new RegExp(`(?<![\\p{L}\\p{N}_])(?:${exactPattern})(?![\\p{L}\\p{N}_])`,'iu').test(sentence);
 const escaped=(exactFound?exact:[...forms]).sort((a,b)=>b.length-a.length).map(form=>form.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
 const re=new RegExp(`(?<![\\p{L}\\p{N}_])(?:${escaped.join('|')})(?![\\p{L}\\p{N}_])`,'giu');
 const parts:{text:string;match:boolean}[]=[];let start=0;
 for(const hit of sentence.matchAll(re)){if(hit.index>start)parts.push({text:sentence.slice(start,hit.index),match:false});parts.push({text:hit[0],match:true});start=hit.index+hit[0].length;}
 if(start<sentence.length)parts.push({text:sentence.slice(start),match:false});
 return parts;
}
