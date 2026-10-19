import {PageFlip} from '../vendor/page-flip';

/** Visual-only copies: React keeps ownership of the accessible, interactive pages. */
export class BookPageCurl {
  private engine:PageFlip;
  private layer:HTMLDivElement;
  private width:number;
  private height:number;
  private current:number;
  readonly direction:number;
  private cornerY:number;
  private last={x:0,y:0};
  private disposed=false;
  private settling=false;
  constructor(private spread:HTMLElement, sources:HTMLElement[], wide:boolean, direction:number, y:number, private done:(turned:boolean)=>void) {
    this.width=spread.clientWidth/(wide?2:1);
    this.height=spread.clientHeight;
    this.current=wide?2:1;
    this.direction=direction;
    this.cornerY=y<this.height/2?1:this.height-1;
    this.layer=document.createElement('div');
    this.layer.className='book-curl-layer';
    this.layer.setAttribute('aria-hidden','true');
    this.layer.inert=true;
    const host=document.createElement('div');
    host.className='book-curl-host';
    this.layer.appendChild(host);
    spread.appendChild(this.layer);
    const pages=sources.map(source=>{
      const wrapper=document.createElement('div');
      wrapper.className='book-curl-paper';
      wrapper.dataset.density='soft';
      const copy=source.cloneNode(true) as HTMLElement;
      copy.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
      wrapper.appendChild(copy);
      return wrapper;
    });
    this.engine=new PageFlip(host,{width:this.width,height:this.height,size:'fixed',startPage:this.current,usePortrait:!wide,autoSize:false,drawShadow:true,maxShadowOpacity:.24,flippingTime:620,useMouseEvents:false,showPageCorners:false,showCover:false});
    this.engine.loadFromHTML(pages);
    // Preserve scroll positions in the page snapshots, including a long example.
    sources.forEach((source,index)=>{
      const original=source.querySelector('.book-leaf-content');
      const copy=pages[index].querySelector('.book-leaf-content');
      if(original && copy) copy.scrollTop=original.scrollTop;
    });
    this.engine.on('changeState',event=>{
      if(event.data==='read' && this.settling && !this.disposed) {
        const turned=this.engine.getCurrentPageIndex()!==this.current;
        this.done(turned);
        // A committed turn is removed by the owner's layout effect only after
        // the matching readable DOM is ready. Removing it here exposes old text.
        if(!turned)this.destroy();
      }
    });
    spread.classList.add('is-curling');
    this.last={x:direction===1?spread.clientWidth-2:2,y:this.cornerY};
    this.engine.startUserTouch(this.last);
    // Lock the folding direction at the outer edge before applying the first
    // drag delta. A fast swipe can otherwise cross the direction-detection zone.
    this.last={x:this.last.x+(direction===1?-8:8),y:this.cornerY};
    this.engine.userMove(this.last,true);
  }
  move(dx:number,dy:number) {
    if(this.disposed || this.settling)return;
    const extent=this.spread.clientWidth;
    // Start at the paper's outer edge, even when dragging from a word in the middle.
    const x=this.direction===1?extent-2-Math.max(6,-dx):2+Math.max(6,dx);
    const y=Math.max(1,Math.min(this.height-1,this.cornerY+dy));
    this.last={x,y};
    this.engine.userMove(this.last,true);
  }
  finish(commit:boolean) {
    if(this.disposed || this.settling)return;
    const controller=this.engine.getFlipController();
    const calculation=controller.getCalculation();
    if(!calculation){this.done(false);this.destroy();return;}
    this.settling=true;
    this.engine.userStop(this.last,true);
    controller.animateFlippingTo(calculation.getPosition(),{x:commit?-this.width:this.width,y:calculation.getCorner()==='bottom'?this.height:0},commit);
  }
  destroy() {
    if(this.disposed)return;
    this.disposed=true;
    this.engine.destroy();
    this.layer.remove();
    this.spread.classList.remove('is-curling');
  }
}

import {wordExamples,type Word} from '../../shared/model';
/** Adjacent pages use textContent only: vocabulary is never interpreted as HTML. */
export function bookLeafSnapshot(words:Word[],page:number,hideMeanings:boolean,hideEnglish=false):HTMLElement {
  const node=(tag:string,className:string,text?:string)=>{
    const element=document.createElement(tag);element.className=className;
    if(text!==undefined)element.textContent=text;
    return element;
  };
  const append=(parent:HTMLElement,...children:HTMLElement[])=>children.forEach(child=>parent.appendChild(child));
  const leaf=node('section','book-leaf');
  const content=node('div','book-leaf-content');
  const list=node('ol','book-entries');
  for(const word of words) {
    const entry=node('li','book-entry');
    const label=node('div','book-entry-word');
    append(label,node('small','',String(word.ordinal+1).padStart(3,'0')),node('h2',hideEnglish?'book-english-content is-blurred':'',word.word));
    if(word.tags.length) append(label,node('p','',word.tags.join(' · ')));
    const meaning=node('div','book-entry-meaning');
    const text=node('div',`book-meaning-content${hideMeanings?' is-blurred':''}`);
    append(text,node('p','book-primary-meaning',word.meaning));
    if(word.otherMeanings?.length) {
      const other=node('div','book-other-meanings'),items=node('ul','');
      word.otherMeanings.forEach(value=>append(items,node('li','',value)));
      append(other,node('small','','その他の意味'),items);append(text,other);
    }
    if(word.usageNote)append(text,node('p','book-usage-note',word.usageNote));
    append(meaning,text);
    const example=node('div','book-entry-example');
    append(example,node('span','book-mobile-label','例文'));
    const examples=wordExamples(word);
    if(examples.length) {
      const items=node('ol','word-examples');
      examples.forEach((sentence,index)=>{
        const item=node('li','');
        if(examples.length>1)append(item,node('span','word-example-number',`例文 ${index+1}`));
        append(item,node('p',hideEnglish?'book-english-content is-blurred':'',sentence.text));
        if(sentence.translation)append(item,node('p',`word-example-translation${hideMeanings?' is-blurred':''}`,sentence.translation));
        append(items,item);
      });
      append(example,items);
    } else append(example,node('p','','例文はまだ登録されていません。'));
    append(entry,label,meaning,example);append(list,entry);
  }
  append(content,list);append(leaf,content,node('div','book-page-number',page>0?String(page):''));
  return leaf;
}
