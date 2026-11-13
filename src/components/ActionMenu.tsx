import {useI18n} from '../lib/i18n';
import { useEffect, useLayoutEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
export type ActionItem = {label:string;description?:string;disabled?:boolean;onSelect:()=>void};
export function ActionMenu({label,primary=false,items}:{label:string;primary?:boolean;items:ActionItem[]}) {
 const t=useI18n();
  const [open,setOpen]=useState(false),id=useId();
  const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const menu=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    if(!open)return;
    const fit=()=>{const panel=menu.current;if(!panel)return;panel.style.setProperty('--menu-shift','0px');const box=panel.getBoundingClientRect(),width=document.documentElement.clientWidth||window.innerWidth;const shift=box.right>width-16?width-16-box.right:box.left<16?16-box.left:0;panel.style.setProperty('--menu-shift',`${shift}px`);};
    fit();window.addEventListener('resize',fit);return()=>window.removeEventListener('resize',fit);
  },[open,t]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}};
    const blur=(event:FocusEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false);};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);document.addEventListener('focusin',blur);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);document.removeEventListener('focusin',blur);};
  },[open]);
  return <div className="deck-action-menu" ref={root}>
    <button ref={trigger} className={`button ${primary?'primary':'secondary'}`} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}>{t(label)}<ChevronDown size={17}/></button>
    {open&&<div ref={menu} className="deck-action-options" id={id} role="group" aria-label={t(label)}>{items.map(item=><button key={t(item.label)} disabled={item.disabled} onClick={()=>{setOpen(false);trigger.current?.focus();item.onSelect();}}><strong>{t(item.label)}</strong>{item.description&&<span>{t(item.description)}</span>}</button>)}</div>}
  </div>;
}
