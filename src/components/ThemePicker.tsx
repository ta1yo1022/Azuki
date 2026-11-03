import {useI18n} from '../lib/i18n';
import { DECK_THEMES, type DeckTheme } from '../../shared/deckThemes';
export function ThemePicker({value,onChange,disabled=false}:{value?:DeckTheme;onChange:(theme:DeckTheme)=>void;disabled?:boolean}){
 const t=useI18n();
 return <fieldset className="theme-picker" disabled={disabled}><legend>{t("単語帳の色")}</legend><div>{DECK_THEMES.map(theme=><button type="button" key={theme.id} aria-label={t(theme.name)} aria-pressed={value===theme.id} title={t(theme.name)} onClick={()=>onChange(theme.id)} style={{background:theme.paper,color:theme.ink,borderColor:value===theme.id?theme.ink:'transparent'}}>Aa<span>{t(theme.name)}</span></button>)}</div></fieldset>;
}
