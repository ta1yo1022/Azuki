import {afterEach,expect,it,vi} from 'vitest';
vi.mock('../src/lib/firebase',()=>({auth:{currentUser:{getIdToken:async()=>'test-token'}}}));
vi.mock('../shared/standardDecks',()=>({standardDeck:(id:string)=>id==='standard'?{id,title:'標準',description:'説明',wordCount:2,textbookTags:[]}:undefined}));
vi.mock('../src/lib/standardRepository',()=>({standardWords:async(_id:string,_q:string,cursor:number)=>({words:[{word:`word${cursor}`,meaning:'意味',example:'An example.',tags:[]}],nextCursor:cursor===0?1:null})}));
import {publicRepository} from '../src/lib/repository';
afterEach(()=>vi.unstubAllGlobals());
it('copies all standard pages through the existing fork API',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({decks:[]}))).mockResolvedValueOnce(new Response(JSON.stringify({deck:{id:'saved'}})));
 vi.stubGlobal('fetch',fetcher);
 expect(await publicRepository.save('standard')).toEqual({id:'saved'});
 expect(String(fetcher.mock.calls[1][0])).toContain('/decks/standard/fork');
 const input=JSON.parse(fetcher.mock.calls[1][1].body);
 expect(input.title).toBe('標準');expect(input.words.map((w:{word:string})=>w.word)).toEqual(['word0','word1']);
});
it('reuses an existing copy without another registration',async()=>{
 const existing={id:'existing',sourceDeck:{id:'standard'}};
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({decks:[existing]})));
 vi.stubGlobal('fetch',fetcher);
 expect(await publicRepository.save('standard')).toEqual(existing);
 expect(fetcher).toHaveBeenCalledTimes(1);
});
