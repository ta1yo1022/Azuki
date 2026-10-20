export const DECK_THEMES = [
 {id:'azuki',name:'あずき',paper:'#f0d8d4',ink:'#972d31'},
 {id:'sand',name:'サンド',paper:'#eddbca',ink:'#895b40'},
 {id:'yellow',name:'イエロー',paper:'#f2e5bc',ink:'#876318'},
 {id:'blue',name:'ブルー',paper:'#dae8f4',ink:'#346793'},
 {id:'green',name:'グリーン',paper:'#dfe9d8',ink:'#4d7042'},
 {id:'purple',name:'ラベンダー',paper:'#e8dff1',ink:'#72528f'},
 {id:'pink',name:'ピンク',paper:'#f3dfe8',ink:'#9a4d6c'},
 {id:'gray',name:'グレー',paper:'#e3e5e7',ink:'#53616b'},
] as const;
export type DeckTheme = typeof DECK_THEMES[number]['id'];
export function isDeckTheme(value:unknown):value is DeckTheme{return DECK_THEMES.some(theme=>theme.id===value);}
export function deckThemeStyle(theme?:DeckTheme){const colors=DECK_THEMES.find(item=>item.id===theme);return colors?{'--deck-paper':colors.paper,'--deck-ink':colors.ink}:{};}
