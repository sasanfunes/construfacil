/**
 * Ilustraciones de casas y terrenos. Son dibujos, no fotos: mientras no haya fotos reales
 * de obras, preferimos un dibujo honesto a una foto de banco que parezca nuestra.
 * Cada casa tiene su variante, elegida de forma estable a partir del slug.
 */

const WALLS = ["#f1e6d8", "#e9d6c1", "#dde5ee", "#efe3cf", "#e4ddd2"] as const;
const ROOFS = ["#c2512f", "#0e2749", "#8c5a44"] as const;
const GREEN = "#6f8f5e";
const INK = "#0e2749";

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function HouseIllustration({
  seed,
  floors = 1,
  withCarport = false,
  className,
  title,
}: {
  seed: string;
  floors?: number;
  withCarport?: boolean;
  className?: string;
  title?: string;
}) {
  const h = hash(seed);
  const wall = WALLS[h % WALLS.length]!;
  const roof = ROOFS[(h >> 3) % ROOFS.length]!;
  const roofStyle = (h >> 5) % 3; // 0 dos aguas, 1 cuatro aguas, 2 losa
  const twoStory = floors >= 2;
  const bodyX = withCarport ? 92 : 70;
  const bodyW = withCarport ? 160 : 180;
  const groundY = 176;
  const bodyH = twoStory ? 104 : 64;
  const bodyY = groundY - bodyH;

  return (
    <svg
      viewBox="0 0 320 200"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={className}
    >
      {title ? <title>{title}</title> : null}
      <rect width="320" height="200" fill="#f3ece1" />
      <circle cx={262} cy={42} r={18} fill="#f6d9a8" />
      <path
        d={`M0 ${groundY - 30} Q 80 ${groundY - 70} 160 ${groundY - 34} T 320 ${groundY - 40} V 200 H 0 Z`}
        fill="#e7ddcc"
      />
      <rect y={groundY} width="320" height={200 - groundY} fill="#d9cdb9" />

      {withCarport ? (
        <g>
          <rect x={24} y={groundY - 50} width={70} height={6} fill={roof} />
          <rect x={28} y={groundY - 44} width={4} height={44} fill={INK} />
          <rect x={86} y={groundY - 44} width={4} height={44} fill={INK} />
        </g>
      ) : null}

      <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} fill={wall} stroke={INK} strokeWidth={2} />
      {twoStory ? (
        <line x1={bodyX} x2={bodyX + bodyW} y1={bodyY + 50} y2={bodyY + 50} stroke={INK} strokeWidth={2} />
      ) : null}

      {roofStyle === 0 ? (
        <polygon
          points={`${bodyX - 12},${bodyY} ${bodyX + bodyW / 2},${bodyY - 44} ${bodyX + bodyW + 12},${bodyY}`}
          fill={roof}
          stroke={INK}
          strokeWidth={2}
        />
      ) : roofStyle === 1 ? (
        <polygon
          points={`${bodyX - 12},${bodyY} ${bodyX + 30},${bodyY - 34} ${bodyX + bodyW - 30},${bodyY - 34} ${bodyX + bodyW + 12},${bodyY}`}
          fill={roof}
          stroke={INK}
          strokeWidth={2}
        />
      ) : (
        <rect
          x={bodyX - 6}
          y={bodyY - 12}
          width={bodyW + 12}
          height={12}
          fill={roof}
          stroke={INK}
          strokeWidth={2}
        />
      )}

      {/* Puerta */}
      <rect x={bodyX + bodyW / 2 - 14} y={groundY - 44} width={28} height={44} fill={INK} />
      <circle cx={bodyX + bodyW / 2 + 8} cy={groundY - 22} r={2} fill="#f6d9a8" />
      {/* Ventanas de abajo */}
      {[bodyX + 22, bodyX + bodyW - 58].map((x) => (
        <g key={x}>
          <rect x={x} y={groundY - 44} width={36} height={26} fill="#ffffff" stroke={INK} strokeWidth={2} />
          <line x1={x + 18} x2={x + 18} y1={groundY - 44} y2={groundY - 18} stroke={INK} strokeWidth={1.5} />
        </g>
      ))}
      {/* Ventanas de arriba */}
      {twoStory
        ? [bodyX + 22, bodyX + bodyW / 2 - 18, bodyX + bodyW - 58].map((x) => (
            <rect
              key={x}
              x={x}
              y={bodyY + 14}
              width={36}
              height={24}
              fill="#ffffff"
              stroke={INK}
              strokeWidth={2}
            />
          ))
        : null}

      {/* Plantas */}
      <circle cx={bodyX - 22} cy={groundY - 12} r={14} fill={GREEN} />
      <circle cx={bodyX + bodyW + 26} cy={groundY - 16} r={18} fill={GREEN} />
      <rect x={bodyX + bodyW + 24} y={groundY - 6} width={4} height={6} fill="#8c5a44" />
    </svg>
  );
}

export function LotIllustration({
  seed,
  className,
  title,
}: {
  seed: string;
  className?: string;
  title?: string;
}) {
  const h = hash(seed);
  const hill = ["#e7ddcc", "#dfe6d6", "#e9dccb"][h % 3]!;
  const slope = (h >> 4) % 3;
  const groundY = 150 - slope * 8;

  return (
    <svg
      viewBox="0 0 320 200"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={className}
    >
      {title ? <title>{title}</title> : null}
      <rect width="320" height="200" fill="#f3ece1" />
      <path d="M0 110 Q 70 50 140 96 T 320 84 V 200 H 0 Z" fill={hill} />
      <path
        d={`M0 ${groundY} Q 160 ${groundY - 10 - slope * 6} 320 ${groundY - slope * 12} V 200 H 0 Z`}
        fill="#d9cdb9"
      />
      {/* Linderos del terreno con estacas */}
      <polygon
        points="70,178 250,178 228,132 96,132"
        fill="#e8dcc6"
        stroke={INK}
        strokeWidth={2}
        strokeDasharray="8 6"
      />
      {[
        [70, 178],
        [250, 178],
        [228, 132],
        [96, 132],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={(x ?? 0) - 2} y={(y ?? 0) - 14} width={4} height={14} fill="#c2512f" />
      ))}
      {/* Árboles */}
      <circle cx={36} cy={130} r={20} fill={GREEN} />
      <rect x={34} y={146} width={4} height={14} fill="#8c5a44" />
      <circle cx={286} cy={122} r={16} fill={GREEN} />
      <rect x={284} y={134} width={4} height={12} fill="#8c5a44" />
    </svg>
  );
}
