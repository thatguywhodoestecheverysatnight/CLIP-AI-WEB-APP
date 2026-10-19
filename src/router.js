import { useEffect, useState, useCallback } from 'react';

function parse() {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  return { name: parts[0] || '', id: parts[1] || null, query: new URLSearchParams(qs || '') };
}

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const go = (to) => {
  const target = `#/${to.replace(/^[#/]+/, '')}`;
  if (window.location.hash !== target) window.location.hash = target;
};

export const back = (fallback = 'home') => {
  if (window.history.length > 1) window.history.back();
  else go(fallback);
};

export function useNav() {
  return useCallback(go, []);
}
