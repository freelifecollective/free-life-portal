/** The red, pulsing "we are live" dot. Use it anywhere a call is happening right now. */
export function LiveDot({ size = 10 }: { size?: number }) {
  return <span className="live-dot" style={{ width: size, height: size }} role="img" aria-label="Live now" />;
}

export function LiveBadge({ children = "LIVE" }: { children?: React.ReactNode }) {
  return <span className="live-badge"><LiveDot size={9} />{children}</span>;
}
