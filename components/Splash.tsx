// Splash screen shown when the site is opened (typing the address, a new tab, the installed app), on phones and desktops.
// Pure HTML and CSS (see .uf-splash in globals.css): it is in the first HTML the server sends, so it shows before any script
// runs, plays for about 2.6 seconds and fades out by itself. It plays on every full page load (opening the site, refreshing);
// moving between pages inside the app does not reload the page, so it does not replay then. "Reduce motion" gets a short, still version.
const NAME = "UNIQUE FUTSAL";

export default function Splash() {
  return (
    <div className="uf-splash" aria-hidden="true">
      <span className="uf-splash-blob uf-splash-blob-a" />
      <span className="uf-splash-blob uf-splash-blob-b" />

      <div className="uf-splash-center">
        {/* the logo: pops in, a glow pulses behind it and a football runs round it */}
        <div className="uf-splash-logo-wrap">
          <span className="uf-splash-glow" />
          <span className="uf-splash-ring" />
          <span className="uf-splash-orbit">
            <svg viewBox="0 0 24 24" className="uf-splash-ball">
              <circle cx="12" cy="12" r="11" fill="#ffffff" stroke="#0c0b5d" strokeWidth="1.5" />
              <path d="M12 7.2 l4 2.9 -1.5 4.7 h-5 L8 10.1 z" fill="#0c0b5d" />
              <path d="M12 1.5 v5.7 M16 10.1 l5.4 -1.8 M14.5 14.8 l3.3 4.6 M9.5 14.8 l-3.3 4.6 M8 10.1 l-5.4 -1.8" stroke="#0c0b5d" strokeWidth="1.2" />
            </svg>
          </span>
          <span className="uf-splash-logo uf-keep" />
        </div>

        <p className="uf-splash-name">
          {NAME.split("").map((ch, i) => (
            <span key={i} style={{ animationDelay: `${0.55 + i * 0.045}s` }}>{ch === " " ? " " : ch}</span>
          ))}
        </p>
        <p className="uf-splash-motto">1st Fully Tech Driven Futsal In Nepal</p>

        <span className="uf-splash-bar"><span /></span>
      </div>
    </div>
  );
}
