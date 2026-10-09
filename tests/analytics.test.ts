// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { analyticsPage } from '../src/lib/analytics';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); document.getElementById('azuki-analytics')?.remove(); localStorage.clear(); });
it('groups private and public books without sending IDs or arbitrary paths', () => {
  expect(analyticsPage('/library/decks/private-id/study')).toEqual({path:'/library/decks/book/study', title:'カード学習'});
  expect(analyticsPage('/shared/private-name')).toEqual({path:'/shared/book', title:'公開単語帳'});
  expect(analyticsPage('/unknown/personal-information')).toEqual({path:'/not-found', title:'ページが見つかりません'});
});
it('sends one page view per navigation only on the production host', async () => {
  vi.resetModules();
  localStorage.setItem('azuki.cookie-choice.v1', 'accepted');
  vi.stubEnv('PROD', true);
  vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST123');
  const fakeWindow = { location: {hostname:'localhost'}, dataLayer: [] as unknown[], gtag: undefined };
  vi.stubGlobal('window', fakeWindow);
  const {trackPage} = await import('../src/lib/analytics');
  trackPage('/library');
  expect(fakeWindow.dataLayer).toHaveLength(0);
  expect(document.getElementById('azuki-analytics')).toBeNull();
  const append = document.head.appendChild.bind(document.head);
  vi.spyOn(document.head, 'appendChild').mockImplementation(node => {
    if (node instanceof HTMLScriptElement) node.type = 'application/json';
    return append(node);
  });
  fakeWindow.location.hostname = 'azuki.mame-app.com';
  trackPage('/library');
  trackPage('/library');
  trackPage('/library/decks/secret-id');
  trackPage('/library');
  const commands = fakeWindow.dataLayer.map(command => Array.from(command as ArrayLike<unknown>));
  const views = commands.filter(command => command[0] === 'event');
  expect(views).toHaveLength(3);
  expect(JSON.stringify(commands)).not.toContain('secret-id');
  expect(views[1][2]).toMatchObject({ page_location:'https://azuki.mame-app.com/library/decks/book',page_referrer:'https://azuki.mame-app.com/library' });
  expect(document.querySelectorAll('#azuki-analytics')).toHaveLength(1);
});

it('never loads analytics before consent, stops on withdrawal, and clears only GA cookies', async () => {
  vi.resetModules();
  localStorage.clear();
  vi.stubEnv('PROD', true);
  vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST123');
  const fakeWindow = { location: {hostname:'azuki.mame-app.com'}, dataLayer: [] as unknown[], gtag: undefined };
  vi.stubGlobal('window', fakeWindow);
  const { trackPage } = await import('../src/lib/analytics');
  const { saveCookieChoice } = await import('../src/lib/cookieConsent');
  trackPage('/explore');
  expect(fakeWindow.dataLayer).toHaveLength(0);
  expect(document.getElementById('azuki-analytics')).toBeNull();
  const append = document.head.appendChild.bind(document.head);
  vi.spyOn(document.head, 'appendChild').mockImplementation(node => {
    if (node instanceof HTMLScriptElement) node.type = 'application/json';
    return append(node);
  });
  saveCookieChoice('accepted');
  trackPage('/explore');
  expect(document.getElementById('azuki-analytics')).not.toBeNull();
  const count = fakeWindow.dataLayer.length;
  document.cookie = '_ga=test; Path=/';
  document.cookie = 'azuki-test=keep; Path=/';
  saveCookieChoice('declined');
  trackPage('/library');
  expect(fakeWindow.dataLayer).toHaveLength(count);
  expect((fakeWindow as Record<string, unknown>)['ga-disable-G-TEST123']).toBe(true);
  expect(document.cookie).not.toContain('_ga=');
  expect(document.cookie).toContain('azuki-test=keep');
  document.cookie = 'azuki-test=; Max-Age=0; Path=/';
});
