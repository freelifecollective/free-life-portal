/** The logo with soft rings spreading out like ripples on water, then the name. Used on the loading screen and the login screen. */
export function SplashMark() {
  return (
    <>
      <div className="splash-mark">
        <span className="splash-ring" />
        <span className="splash-ring r2" />
        <span className="splash-ring r3" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={96} height={96} />
      </div>
      <p className="splash-name">Free Life Collective</p>
    </>
  );
}
