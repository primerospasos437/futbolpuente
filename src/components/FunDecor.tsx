/** Decoraciones alegres (pelota + camisetas) sin assets externos. */

let ballIdSeq = 0;

/** Pelota clásica blanca/negra (fácil de reconocer). */
export function SoccerBall({ className = "" }: { className?: string }) {
  ballIdSeq += 1;
  const gid = `ballGrad-${ballIdSeq}`;
  return (
    <svg
      className={`fun-ball ${className}`}
      viewBox="0 0 64 64"
      width="48"
      height="48"
      aria-hidden
    >
      <defs>
        <radialGradient id={gid} cx="32%" cy="28%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#f2f4f7" />
          <stop offset="100%" stopColor="#c5ced9" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill={`url(#${gid})`} stroke="#2a3340" strokeWidth="1.5" />
      <polygon points="32,20 40,26 37,36 27,36 24,26" fill="#1a1f28" />
      <path
        d="M32 20 L40 26 L48 20 L44 12 L32 12 Z"
        fill="none"
        stroke="#1a1f28"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M40 26 L37 36 L46 42 L52 34 L48 20 Z"
        fill="none"
        stroke="#1a1f28"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M37 36 L27 36 L22 46 L32 52 L46 42 Z"
        fill="none"
        stroke="#1a1f28"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M27 36 L24 26 L16 20 L12 30 L22 46 Z"
        fill="none"
        stroke="#1a1f28"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M24 26 L32 20 L32 12 L20 12 L16 20 Z"
        fill="none"
        stroke="#1a1f28"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <polygon points="48,20 52,28 48,34 44,26" fill="#1a1f28" opacity="0.9" />
      <polygon points="16,20 20,26 16,34 12,28" fill="#1a1f28" opacity="0.9" />
      <polygon points="28,48 36,48 34,54 30,54" fill="#1a1f28" opacity="0.85" />
    </svg>
  );
}

export type JerseyVariant =
  | "river"
  | "boca"
  | "racing"
  | "independiente"
  | "argentina"
  | "claros"
  | "oscuros";

const JERSEY_COLORS: Record<
  JerseyVariant,
  { body: string; stripe?: string; sleeves: string; collar: string; number?: string }
> = {
  river: { body: "#f5f7fa", stripe: "#e11d2e", sleeves: "#f5f7fa", collar: "#e11d2e", number: "#e11d2e" },
  boca: { body: "#003b8e", stripe: "#f5c518", sleeves: "#003b8e", collar: "#f5c518", number: "#f5c518" },
  racing: { body: "#9fd4f0", sleeves: "#9fd4f0", collar: "#1a5f9e", number: "#1a5f9e" },
  independiente: { body: "#c8102e", sleeves: "#c8102e", collar: "#ffffff", number: "#ffffff" },
  argentina: { body: "#74acdf", stripe: "#ffffff", sleeves: "#74acdf", collar: "#ffffff", number: "#1a3a6b" },
  claros: { body: "#ffe8a8", sleeves: "#ffe8a8", collar: "#c48a12", number: "#8a5a08" },
  oscuros: { body: "#1e3a5f", sleeves: "#1e3a5f", collar: "#3aa0ff", number: "#7ec8ff" },
};

/** Camiseta de fútbol (silueta simple, colores de cuadro). */
export function FootballJersey({
  variant = "argentina",
  className = "",
  number = "10",
}: {
  variant?: JerseyVariant;
  className?: string;
  number?: string;
}) {
  const c = JERSEY_COLORS[variant];
  return (
    <svg
      className={`fun-jersey ${className}`}
      viewBox="0 0 56 64"
      width="42"
      height="48"
      aria-hidden
    >
      {/* Mangas */}
      <path d="M6 16 L2 28 L14 32 L18 18 Z" fill={c.sleeves} stroke="#1a1f28" strokeWidth="1.2" />
      <path d="M50 16 L54 28 L42 32 L38 18 Z" fill={c.sleeves} stroke="#1a1f28" strokeWidth="1.2" />
      {/* Cuerpo */}
      <path
        d="M18 14 L22 8 L28 11 L34 8 L38 14 L42 18 L42 56 L14 56 L14 18 Z"
        fill={c.body}
        stroke="#1a1f28"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* Franja diagonal / vertical según cuadro */}
      {variant === "river" || variant === "independiente" ? (
        <path d="M22 14 L36 56 L30 56 L16 14 Z" fill={c.stripe ?? c.collar} opacity="0.95" />
      ) : null}
      {variant === "boca" || variant === "argentina" ? (
        <>
          <rect x="14" y="28" width="28" height="7" fill={c.stripe ?? "#fff"} opacity="0.95" />
          <rect x="14" y="38" width="28" height="7" fill={c.stripe ?? "#fff"} opacity="0.55" />
        </>
      ) : null}
      {/* Cuello */}
      <path d="M22 8 L28 14 L34 8" fill="none" stroke={c.collar} strokeWidth="2.2" strokeLinecap="round" />
      {/* Número */}
      <text
        x="28"
        y="42"
        textAnchor="middle"
        fontSize="14"
        fontWeight="800"
        fill={c.number ?? "#1a1f28"}
        fontFamily="system-ui, sans-serif"
      >
        {number}
      </text>
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
      <FootballJersey variant="argentina" number="10" className="fun-jersey--sm" />
      <span className="page-cheer__emoji" aria-hidden>
        {icon}
      </span>
      <FunSparkles />
      {quote ? <p className="page-cheer__quote">{quote}</p> : null}
      <FootballJersey variant="claros" number="7" className="fun-jersey--sm fun-jersey--tilt" />
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

/** Decoración fija en los costados: pelotas + camisetas de varios cuadros. */
export function PageSideDecor() {
  return (
    <div className="page-side-decor" aria-hidden>
      <div className="page-side-decor__col page-side-decor__col--left">
        <SoccerBall className="fun-ball--sm page-side-decor__ball" />
        <FootballJersey variant="river" number="9" className="fun-jersey--tilt-l" />
        <FootballJersey variant="boca" number="10" className="fun-jersey--tilt" />
        <SoccerBall className="fun-ball--sm page-side-decor__ball page-side-decor__ball--delay" />
        <FootballJersey variant="argentina" number="10" className="fun-jersey--tilt-l" />
      </div>
      <div className="page-side-decor__col page-side-decor__col--right">
        <FootballJersey variant="racing" number="5" className="fun-jersey--tilt" />
        <SoccerBall className="fun-ball--sm fun-ball--flip page-side-decor__ball" />
        <FootballJersey variant="independiente" number="7" className="fun-jersey--tilt-l" />
        <FootballJersey variant="oscuros" number="11" className="fun-jersey--tilt" />
        <SoccerBall className="fun-ball--sm fun-ball--flip page-side-decor__ball page-side-decor__ball--delay" />
      </div>
    </div>
  );
}
