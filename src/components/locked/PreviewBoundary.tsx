"use client";

import { Component, type ReactNode } from "react";

/** If the real page cannot be drawn for any reason, the rough outline is shown instead. */
export class PreviewBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
