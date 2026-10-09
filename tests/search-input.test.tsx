// @vitest-environment happy-dom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { SearchInput } from '../src/components/SearchInput';

it('defers search until IME composition ends and follows external clears', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const search = vi.fn();
  function Harness() {
    const [value, setValue] = useState('');
    return <><SearchInput aria-label="検索" value={value} onValueChange={next => { search(next); setValue(next); }} /><button onClick={() => setValue('')}>クリア</button></>;
  }
  try {
    await act(async () => root.render(<Harness />));
    const input = container.querySelector('input')!;
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles:true })));
    for (const value of ['n', 'な']) {
      await act(async () => {
        setValue.call(input, value);
        input.dispatchEvent(new InputEvent('input', { bubbles:true, isComposing:true, data:value }));
      });
      expect(search).not.toHaveBeenCalled();
      expect(input.value).toBe(value);
    }
    await act(async () => input.dispatchEvent(new CompositionEvent('compositionend', { bubbles:true, data:'な' })));
    expect(search).toHaveBeenCalledExactlyOnceWith('な');
    expect(input.value).toBe('な');
    await act(async () => container.querySelector('button')!.click());
    expect(input.value).toBe('');
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
