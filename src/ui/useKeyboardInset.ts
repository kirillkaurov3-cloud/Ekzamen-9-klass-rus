import {useEffect} from 'react';

const textField = 'textarea, input:not([type]), input[type="text"], input[type="search"], input[type="number"]';

export function useKeyboardInset() {
 useEffect(() => {
  const viewport = window.visualViewport;
  if (!viewport) return;

  const root = document.documentElement;
  let frame = 0;
  function update() {
   cancelAnimationFrame(frame);
   frame = requestAnimationFrame(() => {
    const field = document.activeElement;
    const editing = field?.matches(textField) && !field.matches('[readonly], [disabled]');
    const atActualSize = Math.abs(viewport!.scale - 1) < 0.02;
    const inset = editing && atActualSize
     ? Math.max(0, window.innerHeight - viewport!.height - viewport!.offsetTop)
     : 0;
    root.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`);
   });
  }

  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  document.addEventListener('focusin', update);
  document.addEventListener('focusout', update);
  update();
  return () => {
   cancelAnimationFrame(frame);
   viewport.removeEventListener('resize', update);
   viewport.removeEventListener('scroll', update);
   document.removeEventListener('focusin', update);
   document.removeEventListener('focusout', update);
   root.style.removeProperty('--keyboard-inset');
  };
 }, []);
}
