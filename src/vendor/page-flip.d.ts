/** Pinned StPageFlip 2.0.7 surface used by the animation adapter. */
type Point = {x:number;y:number};
export class PageFlip {
  constructor(element:HTMLElement, settings:Record<string,number|string|boolean>);
  loadFromHTML(pages:HTMLElement[]):void;
  startUserTouch(point:Point):void;
  userMove(point:Point,isTouch:boolean):void;
  userStop(point:Point,isSwipe?:boolean):void;
  getCurrentPageIndex():number;
  getFlipController(): {
    getCalculation():{getPosition():Point;getCorner():string}|null;
    /** Internal API pinned to 2.0.7: settle from the current fold without restarting it. */
    animateFlippingTo(start:Point,end:Point,turned:boolean):void;
  };
  on(name:string, callback:(event:{data:unknown})=>void):void;
  destroy():void;
}
