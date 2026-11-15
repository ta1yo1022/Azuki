import {useNavigate,useSearchParams} from 'react-router-dom';
import {SettingsPage} from './SettingsPage';
export function studySettingsUrl(path:string){return `/settings/review?returnTo=${encodeURIComponent(path)}`;}
export function safeStudyReturn(value:string|null){
 return value&&value.length<=2000&&/^\/(?:library\/decks|shared)\/[^/?#]+\/study(?:\?[^#]*)?$/.test(value)?value:null;
}
export function ReviewSettingsPage(){
 const navigate=useNavigate(),[params]=useSearchParams();
 const target=safeStudyReturn(params.get('returnTo'));
 const back=()=>navigate(target??'/library',target?{state:{resumeStudy:true}}:undefined);
 return <SettingsPage reviewOnly onClose={back} onSaved={back}/>;
}
