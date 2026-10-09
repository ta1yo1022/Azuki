// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { CookieConsent } from '../src/components/CookieConsent';

it('opens the privacy policy from the cookie notice without a modal or consent change', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  let path = '';
  function Probe() { path = useLocation().pathname; return null; }
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={['/explore']}><Probe /><CookieConsent /></MemoryRouter>));
    const link = host.querySelector<HTMLAnchorElement>('a[href="/privacy"]')!;
    expect(link.textContent).toBe('詳しくはプライバシーポリシーへ');
    await act(async () => link.click());
    expect(path).toBe('/privacy');
    expect(host.querySelector('dialog')).toBeNull();
    expect(localStorage.getItem('azuki.cookie-choice.v1')).toBeNull();
  } finally { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.unstubAllGlobals(); }
});
