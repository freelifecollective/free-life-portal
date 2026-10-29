/** A picture guide for iPhone and iPad, where Apple does not allow a one-tap install button. */
export function AppSteps() {
  const steps = [
    { n: 1, t: "Open the portal in Safari", d: "Tap the Share button at the bottom of the screen.", art: (
      <svg viewBox="0 0 160 220" role="img" aria-label="A phone with the Share button highlighted at the bottom">
        <rect x="8" y="4" width="144" height="212" rx="20" fill="#fff" stroke="#E3DED6" strokeWidth="3" />
        <rect x="24" y="26" width="112" height="14" rx="7" fill="#EFE9E3" /><rect x="24" y="52" width="112" height="70" rx="8" fill="#F6F5F1" />
        <rect x="8" y="170" width="144" height="46" rx="0" fill="#F6F5F1" />
        <circle cx="80" cy="193" r="19" fill="#AB9080" />
        <path d="M80 203v-17m0 0l-6 6m6-6l6 6M72 196h-3v10h22v-10h-3" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>) },
    { n: 2, t: "Tap View More, then Add to Home Screen", d: "In the menu that appears, tap View More (the down arrow above the list), then tap Add to Home Screen.", art: (
      <svg viewBox="0 0 160 220" role="img" aria-label="A list of options with Add to Home Screen highlighted">
        <rect x="8" y="4" width="144" height="212" rx="20" fill="#fff" stroke="#E3DED6" strokeWidth="3" />
        <rect x="20" y="30" width="120" height="26" rx="8" fill="#F6F5F1" />
        <circle cx="80" cy="76" r="13" fill="#AB9080" /><path d="M72 73l8 8 8-8" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <text x="80" y="104" textAnchor="middle" fontSize="9" fill="#756A64" fontFamily="sans-serif">View More</text>
        <rect x="20" y="116" width="120" height="34" rx="8" fill="#AB9080" /><text x="80" y="138" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff" fontFamily="sans-serif">Add to Home Screen</text>
        <rect x="20" y="158" width="120" height="26" rx="8" fill="#F6F5F1" />
      </svg>) },
    { n: 3, t: "Tap Add", d: "The FLC icon now sits on your home screen. Tap it any time to open the portal.", art: (
      <svg viewBox="0 0 160 220" role="img" aria-label="A home screen with the FLC icon">
        <rect x="8" y="4" width="144" height="212" rx="20" fill="#fff" stroke="#E3DED6" strokeWidth="3" />
        <circle cx="44" cy="52" r="14" fill="#EFE9E3" /><circle cx="80" cy="52" r="14" fill="#EFE9E3" /><circle cx="116" cy="52" r="14" fill="#EFE9E3" />
        <circle cx="44" cy="100" r="14" fill="#EFE9E3" /><circle cx="80" cy="100" r="14" fill="#EFE9E3" />
        <circle cx="116" cy="100" r="17" fill="#AB9080" stroke="#2B2522" strokeWidth="2" /><text x="116" y="105" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff" fontFamily="serif">FLC</text>
        <text x="116" y="128" textAnchor="middle" fontSize="10" fill="#2B2522" fontFamily="sans-serif">FLC</text>
      </svg>) },
  ];
  return (
    <section className="card-s">
      <h2 className="qh" style={{ marginTop: 0 }}>On an iPhone or iPad</h2>
      <p className="when" style={{ margin: "0 0 14px" }}>Apple does not allow a one-tap button, so it is three quick taps in Safari.</p>
      <ol className="app-steps">
        {steps.map((s) => (
          <li key={s.n}>
            <div className="app-art">{s.art}</div>
            <strong>{s.n}. {s.t}</strong>
            <span>{s.d}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
