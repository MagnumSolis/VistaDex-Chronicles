// Pie chart for categories (industry mix). Colours: a lightness ramp of brand greens (--cat-1…6), never the
// status hues; slices are outlined in ink and every slice is named with its count and share in the legend,
// so it reads without colour. A visually hidden table carries the same numbers.
import { useId } from "react";

const CATS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)"];
const arc = (r: number, a0: number, a1: number) => {
  const p = (a: number) => `${r * Math.cos(a - Math.PI / 2)} ${r * Math.sin(a - Math.PI / 2)}`;
  return `M0 0 L${p(a0)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)} Z`;
};

export function Pie({ slices, caption }: { slices: { name: string; count: number }[]; caption: string }) {
  const id = useId();
  const total = slices.reduce((s, x) => s + x.count, 0);
  let a = 0;
  return (
    <figure className="min-w-0">
      <div className="flex flex-col items-center gap-3">
        <svg viewBox="-52 -52 104 104" role="img" aria-labelledby={`${id}-cap`} className="size-32 shrink-0">
          {total === 0 ? <circle r={50} fill="var(--muted)" stroke="var(--foreground)" strokeWidth={1} />
            : slices.length === 1 ? <circle r={50} fill={CATS[0]} stroke="var(--foreground)" strokeWidth={1} />
              : slices.map((s, i) => {
                const a0 = a; a += (2 * Math.PI * s.count) / total;
                return <path key={s.name} d={arc(50, a0, a)} fill={CATS[i % CATS.length]} stroke="var(--foreground)" strokeWidth={1} strokeLinejoin="round" />;
              })}
        </svg>
        <ul aria-hidden className="w-full space-y-1 text-sm">
          {slices.map((s, i) => (
            <li key={s.name} className="flex items-center gap-2">
              <span className="size-3.5 shrink-0 rounded-[3px] border border-foreground" style={{ background: CATS[i % CATS.length] }} />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className="font-mono">{s.count}</span>
              <span className="w-10 text-right font-mono text-muted-foreground">{total ? Math.round((100 * s.count) / total) : 0}%</span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption id={`${id}-cap`} className="mt-2 text-sm text-muted-foreground">{caption}</figcaption>
      <div className="sr-only"><table>
        <caption>{caption}</caption>
        <tbody>{slices.map(s => <tr key={s.name}><th scope="row">{s.name}</th><td>{s.count}</td></tr>)}</tbody>
      </table></div>
    </figure>
  );
}
