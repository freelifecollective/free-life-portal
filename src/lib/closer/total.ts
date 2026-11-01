/** "40+" plus 3 new calls becomes "43+"; a figure that is not a number is shown as typed with the new calls noted. */
export function totalCalls(base: string | null, counted: number): string | null {
  const m = (base ?? "").match(/^\s*(\d[\d,]*)(.*)$/);
  if (m) return (Number(m[1].replace(/,/g, "")) + counted).toLocaleString("en-US") + m[2];
  if (base && base.trim()) return counted ? `${base} (+${counted})` : base;
  return counted ? String(counted) : null;
}
