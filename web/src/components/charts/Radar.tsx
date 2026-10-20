// Radar ("spider") chart of the report's profile axes. Accessible: a role="img" SVG with a caption and
// a visually hidden table of the same numbers. Axes without enough data are drawn as a dashed spoke
// marked "n/a" and left out of the shape — never plotted as 0. Labels are wrapped and the viewBox is
// padded so nothing is clipped at 360px.
import { useId } from "react";

export interface RadarAxis { id: string; label: string; value: number | null; note?: string }

const R = 78;          // radius of the 100-ring
const LABEL_R = 98;    // where axis labels start
const VIEW = { x: -186, y: -132, w: 372, h: 270 };

const point = (i: number, n: number, r: number) => {
  const a = (-Math.PI / 2) + (2 * Math.PI * i) / n;
  return [r * Math.cos(a), r * Math.sin(a)] as const;
};
// Two short lines at most: "Graveyard distance" → "Graveyard" / "distance".
const wrap = (s: string) => (s.length > 10 && s.includes(" ") ? [s.slice(0, s.indexOf(" ")), s.slice(s.indexOf(" ") + 1)] : [s]);

export function Radar({ axes, caption }: { axes: RadarAxis[]; caption: string }) {
  const id = useId();
  const n = axes.length;
  const shape = axes.map((a, i) => (a.value === null ? null : point(i, n, (R * a.value) / 100)));
  const drawn = shape.filter((p): p is readonly [number, number] => p !== null);
  return (
    <figure className="min-w-0">
      <svg viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} role="img" aria-labelledby={`${id}-cap`} className="mx-auto block w-full max-w-[26rem] overflow-visible">
        {[25, 50, 75, 100].map(level => (
          <polygon key={level} points={axes.map((_, i) => point(i, n, (R * level) / 100).join(",")).join(" ")}
            fill="none" stroke="var(--border-strong)" strokeWidth={level === 100 ? 1.25 : 0.75} />
        ))}
        {axes.map((a, i) => {
          const [x, y] = point(i, n, R);
          return <line key={a.id} x1={0} y1={0} x2={x} y2={y} stroke="var(--border-strong)" strokeWidth={0.75} strokeDasharray={a.value === null ? "3 3" : undefined} />;
        })}
        {drawn.length >= 3 && (
          <polygon points={drawn.map(p => p.join(",")).join(" ")} fill="var(--lime)" fillOpacity={0.55} stroke="var(--foreground)" strokeWidth={2} strokeLinejoin="round" />
        )}
        {drawn.length === 2 && (
          <line x1={drawn[0][0]} y1={drawn[0][1]} x2={drawn[1][0]} y2={drawn[1][1]} stroke="var(--foreground)" strokeWidth={2} />
        )}
        {shape.map((p, i) => p && <circle key={axes[i].id} cx={p[0]} cy={p[1]} r={4} fill="var(--foreground)" stroke="var(--background)" strokeWidth={1.5} />)}
        {axes.map((a, i) => {
          const [x, y] = point(i, n, LABEL_R);
          const anchor = Math.abs(x) < 8 ? "middle" : x > 0 ? "start" : "end";
          const lines = wrap(a.label);
          const dy = y < -20 ? -(lines.length) * 15 + 6 : y > 20 ? 8 : -((lines.length - 1) * 15) / 2;
          return (
            <text key={a.id} x={x} y={y + dy} textAnchor={anchor} fontSize={14} fill="var(--foreground)">
              {lines.map((l, k) => <tspan key={k} x={x} dy={k ? 15 : 0}>{l}</tspan>)}
              <tspan x={x} dy={15} fontFamily="var(--font-mono)" fontWeight={600}>{a.value === null ? "n/a" : a.value}</tspan>
            </text>
          );
        })}
      </svg>
      <figcaption id={`${id}-cap`} className="mt-2 text-center text-sm text-muted-foreground">{caption}</figcaption>
      <div className="sr-only"><table>
        <caption>{caption}</caption>
        <thead><tr><th scope="col">Axis</th><th scope="col">Value out of 100</th></tr></thead>
        <tbody>{axes.map(a => <tr key={a.id}><th scope="row">{a.label}</th><td>{a.value === null ? "Not enough data" : a.value}{a.note ? `. ${a.note}` : ""}</td></tr>)}</tbody>
      </table></div>
    </figure>
  );
}
