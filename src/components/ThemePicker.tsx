import { DECK_THEMES, type DeckTheme } from '../../shared/deckThemes';
export function ThemePicker({value,onChange,disabled=false}:{value?:DeckTheme;onChange:(theme:DeckTheme)=>void;disabled?:boolean}){
 return <fieldset className="theme-picker" disabled={disabled}><legend>単語帳の色</legend><div>{DECK_THEMES.map(theme=><button type="button" key={theme.id} aria-label={theme.name} aria-pressed={value===theme.id} title={theme.name} onClick={()=>onChange(theme.id)} style={{background:theme.paper,color:theme.ink,borderColor:value===theme.id?theme.ink:'transparent'}}>Aa<span>{theme.name}</span></button>)}</div></fieldset>;
}
