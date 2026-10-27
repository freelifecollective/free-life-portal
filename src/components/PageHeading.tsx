import type { ReactNode } from "react";

/** Every page heading uses this: same size, same position, left-aligned. */
export function PageHeading({ children, lede }: { children: ReactNode; lede?: ReactNode }) {
  return (
    <>
      <h1 className="page-heading" tabIndex={-1}>{children}</h1>
      {lede ? <p className="page-lede">{lede}</p> : null}
    </>
  );
}
