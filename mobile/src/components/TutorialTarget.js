// Registry of on-screen elements the tutorial can spotlight (tab buttons,
// sub-tabs, key actions). Any interactive element attaches a callback ref
// from `useTutorialRef(id)`; the overlay looks the id up and measures its
// window rect to cut a highlight hole + anchor a coach-mark bubble.
//
// Ids are stable strings: "tab:War", "subtab:explore", "action:collect".
// The overlay tries the most specific candidate first (a sub-tab is only
// measurable when its screen is mounted, so its presence doubles as "the
// user is already on the right screen").
import React, { createContext, useCallback, useContext, useRef } from "react";

const TutorialTargetContext = createContext(null);

export function TutorialTargetProvider({ children }) {
  const nodes = useRef(new Map());
  const refCache = useRef(new Map());

  const register = useCallback((id, node) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  }, []);

  // Stable callback ref per id (so re-renders don't churn the registry).
  const refFor = useCallback(
    (id) => {
      if (!refCache.current.has(id)) {
        refCache.current.set(id, (node) => register(id, node));
      }
      return refCache.current.get(id);
    },
    [register]
  );

  const measure = useCallback(
    (id) =>
      new Promise((resolve) => {
        const node = nodes.current.get(id);
        if (!node || typeof node.measureInWindow !== "function") return resolve(null);
        try {
          node.measureInWindow((x, y, w, h) => {
            if ([x, y, w, h].every(Number.isFinite) && w > 0 && h > 0) resolve({ x, y, w, h });
            else resolve(null);
          });
        } catch (_) {
          resolve(null);
        }
      }),
    []
  );

  const value = { refFor, measure };
  return <TutorialTargetContext.Provider value={value}>{children}</TutorialTargetContext.Provider>;
}

export function useTutorialRegistry() {
  return useContext(TutorialTargetContext);
}

// Callback ref to tag an element as tutorial target `id`. No-op if the
// provider isn't mounted (e.g. in isolated tests).
export function useTutorialRef(id) {
  const reg = useContext(TutorialTargetContext);
  return reg && id ? reg.refFor(id) : undefined;
}
