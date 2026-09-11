"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Isolates a WebGL scene from the rest of the app.
 *
 * Without this, a throw inside <Canvas> — no WebGL context, a driver refusing
 * a shader, a headless/GPU-less environment — propagates to the React root and
 * unmounts the entire page. The 3D here is decoration; losing it must never
 * cost the visitor the content.
 */
export class SceneBoundary extends Component<
  { children: ReactNode; label?: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[SceneBoundary] ${this.props.label ?? "scene"} failed; continuing without it.`,
        error,
        info.componentStack
      );
    }
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
