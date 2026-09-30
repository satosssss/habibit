import { useEffect, useRef } from 'react';

/**
 * Slice D R9: adds `visible` to the returned element when it scrolls into view
 * (skill threshold 0.12), then stops observing. Environments without
 * IntersectionObserver (jsdom) — and elements already in view — reveal
 * immediately, so content can never stay hidden.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('visible');
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}
