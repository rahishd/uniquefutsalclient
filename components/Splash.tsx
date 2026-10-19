// Splash screen shown when the site is opened (typing the address, a new tab, the installed app), on phones and desktops.
// Pure HTML and CSS (see .uf-splash in globals.css): it is in the first HTML the server sends, so it shows before any script
// runs, plays for about 5 seconds and fades out by itself. It plays on every full page load (opening the site, refreshing);
// moving between pages inside the app does not reload the page, so it does not replay then. "Reduce motion" gets a short, still version.
// Dark blue screen: the white player lights up from the feet to the head, then kicks the ball. The ball flies up and fills
// as the progress to opening the home screen, comes back to the player's foot and spins with a loading ring until the splash ends.
const NAME = "UNIQUE FUTSAL";

function Ball({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <circle cx="12" cy="12" r="11.5" fill="#ffffff" />
      <path d="M12 7.2 l4 2.9 -1.5 4.7 h-5 L8 10.1 z" fill="#121264" />
      <path d="M12 0.5 v6.7 M16 10.1 l7 -2.3 M14.5 14.8 l4 5.6 M9.5 14.8 l-4 5.6 M8 10.1 l-7 -2.3" stroke="#121264" strokeWidth="1.3" />
    </svg>
  );
}

export default function Splash() {
  return (
    // uf-keep: dark mode must not invert the splash colours
    <div className="uf-splash uf-keep" aria-hidden="true">
      <div className="uf-splash-center">
        <div className="uf-splash-logo">
          <span className="uf-splash-fig uf-splash-fig-dim" />
          <span className="uf-splash-fig uf-splash-fig-fill" />

          {/* the ball drawn in the picture is covered, so this one can take its place and fly */}
          <span className="uf-splash-ballcover" />
          <span className="uf-ball-pos">
            <span className="uf-ball-x">
              <span className="uf-ball-y">
                <svg viewBox="0 0 40 40" className="uf-ball-ring">
                  <circle cx="20" cy="20" r="18" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="28 90" />
                </svg>
                <Ball className="uf-ball-svg uf-ball-dim" />
                <Ball className="uf-ball-svg uf-ball-fill" />
              </span>
            </span>
          </span>
        </div>

        <p className="uf-splash-name">
          {NAME.split("").map((ch, i) => (
            <span key={i} style={{ animationDelay: `${1.4 + i * 0.045}s` }}>{ch === " " ? " " : ch}</span>
          ))}
        </p>
        <p className="uf-splash-motto">Connecting Players. Contributing Fitness</p>
      </div>
    </div>
  );
}
