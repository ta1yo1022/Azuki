import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
export type ActionItem = {label:string;description?:string;disabled?:boolean;onSelect:()=>void};
export function ActionMenu({label,primary=false,items}:{label:string;primary?:boolean;items:ActionItem[]}) {
  const [open,setOpen]=useState(false),id=useId();
  const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}};
    const blur=(event:FocusEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false);};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);document.addEventListener('focusin',blur);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);document.removeEventListener('focusin',blur);};
  },[open]);
  return <div className="deck-action-menu" ref={root}>
    <button ref={trigger} className={`button ${primary?'primary':'secondary'}`} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}>{label}<ChevronDown size={17}/></button>
    {open&&<div className="deck-action-options" id={id} role="group" aria-label={label}>{items.map(item=><button key={item.label} disabled={item.disabled} onClick={()=>{setOpen(false);trigger.current?.focus();item.onSelect();}}><strong>{item.label}</strong>{item.description&&<span>{item.description}</span>}</button>)}</div>}
  </div>;
}
