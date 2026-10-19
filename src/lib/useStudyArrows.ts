import { useEffect } from 'react';

/** Keep page navigation available after clicking controls, without stealing editing keys. */
export function useStudyArrows(enabled: boolean, previous: () => void, next: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const navigate = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"], [role="combobox"], dialog[open]')) return;
      event.preventDefault();
      if (!event.repeat) (event.key === 'ArrowLeft' ? previous : next)();
    };
    window.addEventListener('keydown', navigate);
    return () => window.removeEventListener('keydown', navigate);
  }, [enabled, previous, next]);
}
