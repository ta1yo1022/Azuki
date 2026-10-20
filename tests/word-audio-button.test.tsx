// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {WordAudioButton} from '../src/components/WordAudioButton';
const mocks=vi.hoisted(()=>({play:vi.fn(),stop:vi.fn()}));
vi.mock('../src/lib/wordAudio',()=>({playWordAudio:mocks.play,stopWordAudio:mocks.stop}));
let root:Root,container:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);mocks.play.mockReset().mockImplementation((_deck,_word,_public,notify)=>{notify('playing');return 3;});mocks.stop.mockReset();container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
it('plays the source word from an example card without triggering its parent',async()=>{
 const flip=vi.fn();await act(async()=>root.render(<div onClick={flip}><WordAudioButton deckId="deck" wordId="word:example:2" word="hello" isPublic/></div>));
 await act(async()=>container.querySelector('button')!.click());
 expect(mocks.play).toHaveBeenCalledWith('deck','word',true,expect.any(Function),expect.any(Function));
 expect(flip).not.toHaveBeenCalled();expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('helloを停止する');
 await act(async()=>container.querySelector('button')!.click());expect(mocks.stop).toHaveBeenCalledWith(3);
});
it('cancels playback on navigation and shows a retryable error',async()=>{
 mocks.play.mockImplementation((_deck,_word,_public,notify,onError)=>{notify('idle');onError('音声の準備中です');return 4;});
 await act(async()=>root.render(<WordAudioButton deckId="deck" wordId="word" word="hello"/>));
 await act(async()=>container.querySelector('button')!.click());expect(container.querySelector('[role="alert"]')?.textContent).toBe('音声の準備中です');
 expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('helloを読み上げる');
 await act(async()=>root.render(<WordAudioButton deckId="deck" wordId="next" word="world"/>));expect(mocks.stop).toHaveBeenCalledWith(4);
});
