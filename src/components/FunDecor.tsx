/** Decoraciones alegres (pelota + cancha + chispas) sin assets externos. */

export function SoccerBall({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`fun-ball ${className}`}
      viewBox="0 0 64 64"
      width="48"
      height="48"
      aria-hidden
    >
      <defs>
        <radialGradient id="ballGlow" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#e8eef6" />
          <stop offset="100%" stopColor="#9fb0c8" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#ballGlow)" stroke="rgba(0,212,255,0.45)" strokeWidth="2" />
      <polygon points="32,18 38,28 32,26 26,28" fill="#0a0f18" opacity="0.85" />
      <path
        d="M32 26 L38 28 L44 36 L38 42 L26 42 L20 36 L26 28 Z"
        fill="none"
        stroke="#0a0f18"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M20 36 L12 30" stroke="#0a0f18" strokeWidth="2" fill="none" />
      <path d="M44 36 L52 30" stroke="#0a0f18" strokeWidth="2" fill="none" />
      <path d="M26 42 L22 52" stroke="#0a0f18" strokeWidth="2" fill="none" />
      <path d="M38 42 L42 52" stroke="#0a0f18" strokeWidth="2" fill="none" />
    </svg>
  );
}

export function MiniPitch({ className = "" }: { className?: string }) {
  return (
    <svg className={`fun-pitch ${className}`} viewBox="0 0 80 48" width="56" height="34" aria-hidden>
      <rect x="1" y="1" width="78" height="46" rx="4" fill="rgba(61,255,154,0.08)" stroke="rgba(61,255,154,0.45)" strokeWidth="1.5" />
      <line x1="40" y1="1" x2="40" y2="47" stroke="rgba(61,255,154,0.35)" strokeWidth="1.2" />
      <circle cx="40" cy="24" r="7" fill="none" stroke="rgba(0,212,255,0.45)" strokeWidth="1.2" />
      <rect x="1" y="14" width="10" height="20" fill="none" stroke="rgba(255,176,32,0.5)" strokeWidth="1.2" />
      <rect x="69" y="14" width="10" height="20" fill="none" stroke="rgba(58,160,255,0.55)" strokeWidth="1.2" />
    </svg>
  );
}

export function FunSparkles({ className = "" }: { className?: string }) {
  return (
    <span className={`fun-sparkles ${className}`} aria-hidden>
      <span className="fun-sparkle fun-sparkle--g">✦</span>
      <span className="fun-sparkle fun-sparkle--y">✧</span>
      <span className="fun-sparkle fun-sparkle--c">✦</span>
      <span className="fun-sparkle fun-sparkle--p">✧</span>
      <span className="fun-doodle fun-doodle--1">⚡</span>
      <span className="fun-doodle fun-doodle--2">〜</span>
    </span>
  );
}

const FOOTBALL_ICONS = ["⚽", "🏟️", "🏆", "🥅", "👟", "🎯"] as const;

export function PageCheer({
  quote,
  icon = "⚽",
}: {
  quote?: string;
  icon?: (typeof FOOTBALL_ICONS)[number] | string;
}) {
  return (
    <div className="page-cheer">
      <SoccerBall className="fun-ball--sm" />
      <MiniPitch />
      <span className="page-cheer__emoji" aria-hidden>
        {icon}
      </span>
      <FunSparkles />
      {quote ? <p className="page-cheer__quote">{quote}</p> : null}
      <span className="page-cheer__emoji" aria-hidden>
        🏟️
      </span>
      <SoccerBall className="fun-ball--sm fun-ball--flip" />
    </div>
  );
}

/** Franja de iconos futboleros bajo el título de cada solapa. */
export function FootballStrip({ items = FOOTBALL_ICONS }: { items?: readonly string[] }) {
  return (
    <div className="football-strip" aria-hidden>
      {items.map((it, i) => (
        <span key={`${it}-${i}`} className={`football-strip__item football-strip__item--${i % 4}`}>
          {it}
        </span>
      ))}
    </div>
  );
}
