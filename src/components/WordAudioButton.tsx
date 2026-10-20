import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Square, Volume2 } from 'lucide-react';
import { playWordAudio, stopWordAudio } from '../lib/wordAudio';
export function WordAudioButton({deckId,wordId,word,isPublic=false}:{deckId:string;wordId:string;word:string;isPublic?:boolean}){
 const [state,setState]=useState<'idle'|'loading'|'playing'>('idle'),[error,setError]=useState('');
 const playback=useRef<number|undefined>(undefined);
 useEffect(()=>{setError('');return()=>{if(playback.current!==undefined)stopWordAudio(playback.current);};},[deckId,wordId]);
 return <span className="word-audio-control"><button type="button" data-book-audio className={`word-audio-button${state==='playing'?' is-playing':''}`} aria-label={`${word}を${state==='idle'?'読み上げる':state==='loading'?'準備中・キャンセル':'停止する'}`} aria-busy={state==='loading'} title={state==='idle'?'英単語を読み上げる':state==='loading'?'音声を準備しています':'再生を停止する'} onPointerDown={event=>event.stopPropagation()} onKeyDown={event=>{if(event.key==='Enter'||event.key===' ')event.stopPropagation();}} onClick={event=>{event.preventDefault();event.stopPropagation();if(state!=='idle'){stopWordAudio(playback.current);return;}setError('');playback.current=playWordAudio(deckId,wordId.split(':example:')[0],isPublic,setState,setError);}}>
  {state==='loading'?<LoaderCircle size={17} className="word-audio-spinner"/>:state==='playing'?<Square size={15}/>:<Volume2 size={18}/>}
 </button>{error&&<span className="word-audio-error" role="alert">{error}</span>}</span>;
}
