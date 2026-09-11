/**
 * Opening sequence timings, in seconds from the moment the landing mounts.
 *
 * Five beats, in this order:
 *
 *   1. assemble  scattered particles gather into a single survey drone.
 *                Nothing else is on screen — no name, no copy, no buttons.
 *   2. scan      the drone holds station while the telemetry bar fills.
 *   3. depart    the drone banks away and leaves frame. As it goes, the
 *                command-center HUD draws itself and the details are revealed.
 *   4. swarm     a formation of drones flies in from off-screen.
 *   5. resolve   the swarm breaks apart and the particles settle into the
 *                three-dimensional figure.
 *
 * Shared by the shader, the loading panel and the reveal, so the three cannot
 * drift apart: the bar finishing IS the drone leaving IS the details arriving.
 *
 * The budget is deliberately tight. Everything above the fold is hidden until
 * `detailsAt`, so that number is the floor on Largest Contentful Paint — every
 * extra beat of cinematic is paid for directly in the page's core web vitals.
 * 1.9s buys the whole first act and still leaves headroom under the 2.5s
 * "good" threshold on a warm connection.
 */
export const SEQ = {
  /** scattered particles -> one drone */
  assembleEnd: 0.9,
  /** drone holds station, bar fills */
  scanEnd: 1.9,
  /** drone banks away and leaves frame */
  departEnd: 2.6,
  /** swarm formation flies in from off-screen */
  swarmEnd: 3.8,
  /** swarm dissolves into the figure */
  resolveEnd: 5.4,
} as const;

/** The whole cinematic. */
export const SEQ_TOTAL = SEQ.resolveEnd;

/** When the HUD draws and the landing copy is revealed — the LCP floor. */
export const DETAILS_AT = SEQ.scanEnd;

/** Progress-bar window: the bar tracks the scan, not the whole sequence. */
export const SCAN_START = SEQ.assembleEnd;
export const SCAN_DURATION = SEQ.scanEnd - SEQ.assembleEnd;
