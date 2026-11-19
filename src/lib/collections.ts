import {apiRequest} from './repository';
export type Collection={id:string;name:string;deckIds:string[]};
export const collectionsRepository={
 list:async()=>(await apiRequest<{collections:Collection[]}>('/collections')).collections,
 save:(value:Omit<Collection,'id'>&{id?:string})=>apiRequest<Collection>(value.id?`/collections/${encodeURIComponent(value.id)}`:'/collections',{method:value.id?'PUT':'POST',body:JSON.stringify(value)}),
 remove:(id:string)=>apiRequest(`/collections/${encodeURIComponent(id)}`,{method:'DELETE'}),
};
