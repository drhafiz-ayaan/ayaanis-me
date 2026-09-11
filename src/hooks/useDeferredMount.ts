"use client";

import { useEffect, useState } from "react";

/**
 * Hold a heavy subtree back until the browser is idle.
 *
 * The WebGL scenes were being imported the moment the page mounted, which put
 * three.js on the critical path and cost ~240ms of blocking time on mobile.
 * Deferring to idle keeps first paint to text and lets the 3D arrive after.
 */
export function useDeferredMount(fallbackDelay = 900) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // requestIdleCallback is still missing on older Safari. Check the function
    // itself rather than using `in`, which narrows window to never in the
    // else branch because lib.dom always declares it.
    const ric =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback.bind(window)
        : null;

    if (ric) {
      const id = ric(() => setReady(true), { timeout: fallbackDelay });
      return () => window.cancelIdleCallback?.(id);
    }

    const t = window.setTimeout(() => setReady(true), fallbackDelay);
    return () => window.clearTimeout(t);
  }, [fallbackDelay]);

  return ready;
}
