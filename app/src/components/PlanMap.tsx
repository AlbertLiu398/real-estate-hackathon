"use client";
import { baguaName, roomColor, type Unit } from "@/lib/data";
import { useLang } from "./I18n";

type Props = {
  unit: Unit;
  highlight?: { rooms: string[]; openings: string[]; tone: "good" | "bad" | "neutral"; cell?: string } | null;
  showBagua?: boolean;
  compact?: boolean;
};

/** The unit's floorplan.json drawn to scale, with the Black Hat Bagua grid and finding highlights. */
export function PlanMap({ unit, highlight, showBagua = true, compact }: Props) {
  const { zh } = useLang();
  const fp = unit.floorplan!;
  const fs = unit.fengshui!;
  const xs = fp.outline.map((p) => p[0]);
  const ys = fp.outline.map((p) => p[1]);
  const pad = compact ? 0.6 : 1.4;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const w = Math.max(...xs) - Math.min(...xs) + pad * 2;
  const h = Math.max(...ys) - Math.min(...ys) + pad * 2;
  const outline = fp.outline.map((p) => p.join(",")).join(" ");
  const tone = highlight?.tone === "good" ? "var(--jade)" : highlight?.tone === "bad" ? "var(--cinnabar)" : "var(--gold)";
  const hiRooms = new Set(highlight?.rooms ?? []);
  const hiOpen = new Set(highlight?.openings ?? []);
  const fsz = Math.max(w, h) / 46;
  // north: page-up points to north_deg true, so true north is at -north_deg on the page
  const nx = minX + w - fsz * 4.2;
  const ny = minY + fsz * 3.6;

  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} className="h-full w-full" role="img" aria-label={`${unit.key} Feng Shui plan`}>
      <defs>
        <clipPath id={`clip-${unit.key}`}>
          <polygon points={outline} />
        </clipPath>
        <pattern id="hatch" width="0.35" height="0.35" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="0.35" stroke="var(--cinnabar)" strokeWidth="0.06" opacity="0.6" />
        </pattern>
      </defs>

      {/* floor */}
      <polygon points={outline} fill="#fff" />
      <g clipPath={`url(#clip-${unit.key})`}>
        {fp.rooms.map((r) => (
          <rect
            key={r.id}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill={hiRooms.has(r.id) ? tone : roomColor[r.type] ?? "#eee"}
            fillOpacity={hiRooms.has(r.id) ? 0.45 : highlight ? 0.45 : 0.9}
            stroke="#fff"
            strokeWidth={0.05}
            style={{ transition: "fill .25s, fill-opacity .25s" }}
          />
        ))}
      </g>

      {/* bagua */}
      {showBagua &&
        fs.bagua.map((b) => {
          const [x0, y0, x1, y1] = b.rect;
          const key = `${b.row}-${b.col}`;
          const missing = b.coverage < 0.5;
          const on = highlight?.cell === key;
          return (
            <g key={key}>
              {missing && <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="url(#hatch)" />}
              <rect
                x={x0}
                y={y0}
                width={x1 - x0}
                height={y1 - y0}
                fill={on ? tone : "none"}
                fillOpacity={0.12}
                stroke={on ? tone : "var(--ink)"}
                strokeOpacity={on ? 1 : 0.22}
                strokeWidth={on ? 0.08 : 0.035}
                strokeDasharray={on ? undefined : "0.18 0.14"}
              />
              {!compact && (
                <text x={x0 + fsz * 0.45} y={y0 + fsz * 1.2} fontSize={fsz * 0.72} fill={missing ? "var(--cinnabar)" : "var(--muted)"} letterSpacing={0.02}>
                  {baguaName(b.area, zh)} <tspan opacity={0.75}>{Math.round(b.coverage * 100)}%</tspan>
                </text>
              )}
            </g>
          );
        })}

      {/* walls */}
      <polygon points={outline} fill="none" stroke="var(--ink)" strokeWidth={0.16} strokeLinejoin="round" />

      {/* openings */}
      {fp.openings.map((o) => {
        const half = o.width / 2;
        const [x1, y1, x2, y2] = o.axis === "h" ? [o.x - half, o.y, o.x + half, o.y] : [o.x, o.y - half, o.x, o.y + half];
        const on = hiOpen.has(o.id);
        if (o.type === "window")
          return <line key={o.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? tone : "#8fb8cf"} strokeWidth={on ? 0.22 : 0.14} strokeLinecap="butt" />;
        if (o.type === "entrance")
          return (
            <g key={o.id}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeWidth={0.26} />
              <circle cx={o.x} cy={o.y} r={on ? 0.42 : 0.3} fill="var(--cinnabar)" stroke="#fff" strokeWidth={0.06} />
              {!compact && (
                <text x={o.x} y={o.y + fsz * 0.33} fontSize={fsz * 0.8} textAnchor="middle" fill="#fff" fontWeight={700}>
                  {zh ? "门" : "IN"}
                </text>
              )}
            </g>
          );
        return <line key={o.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? tone : "var(--ink-2)"} strokeWidth={on ? 0.16 : 0.07} opacity={on ? 1 : 0.55} />;
      })}

      {/* room labels */}
      {!compact &&
        fp.rooms.map((r) => (
          <text key={r.id} x={r.x + r.w / 2} y={r.y + r.h / 2 + fsz * 0.3} fontSize={fsz * 0.85} textAnchor="middle" fill="var(--ink)" fontWeight={500} opacity={0.85}>
            {roomZh(r.label, zh)}
          </text>
        ))}

      {/* north arrow: page-up is north_deg true, so north sits at -north_deg on the page */}
      {!compact && (
        <g transform={`translate(${nx} ${ny})`}>
          <circle r={fsz * 1.9} fill="var(--card)" stroke="var(--line)" strokeWidth={0.04} />
          <g transform={`rotate(${-fp.north_deg})`}>
            <path d={`M0 ${-fsz * 1.45} L${fsz * 0.5} ${fsz * 0.7} L0 ${fsz * 0.3} L${-fsz * 0.5} ${fsz * 0.7} Z`} fill="var(--cinnabar)" />
          </g>
          <text
            x={Math.sin((-fp.north_deg * Math.PI) / 180) * fsz * 2.6}
            y={-Math.cos((-fp.north_deg * Math.PI) / 180) * fsz * 2.6 + fsz * 0.35}
            fontSize={fsz * 0.95}
            textAnchor="middle"
            fill="var(--cinnabar)"
            fontWeight={700}
          >
            {zh ? "北" : "N"}
          </text>
        </g>
      )}
    </svg>
  );
}

const roomMap: Record<string, string> = { Bath: "浴室", Kitchen: "厨房", "Living/Dining": "客餐厅", Bedroom: "卧室", "Bedroom 1": "卧室 1", "Bedroom 2": "卧室 2", "Shower Room": "淋浴间", Ensuite: "套内卫浴" };
const roomZh = (l: string, zh: boolean) => (zh ? roomMap[l] ?? l : l);
