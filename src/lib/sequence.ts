/**
 * Opening sequence timings, in seconds from the moment the hero cloud mounts.
 *
 * Shared by the loading panel and the shader so the progress bar and the
 * drone cannot drift apart — the bar finishing IS the drone departing.
 */
export const SEQ = {
  /** scattered particles gather into the drone */
  assembleEnd: 1.7,
  /** drone holds station while the bar fills */
  scanEnd: 3.9,
  /** drone flies out of frame toward the subject's position */
  flyEnd: 4.9,
  /** particles burst and resolve into the figure */
  morphEnd: 6.8,
} as const;

export const SEQ_TOTAL = SEQ.morphEnd;

/** Progress bar window. */
export const SCAN_START = SEQ.assembleEnd;
export const SCAN_DURATION = SEQ.scanEnd - SEQ.assembleEnd;
