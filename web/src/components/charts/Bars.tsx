// Horizontal bar chart in ink (not a status colour): label, bar and count on each row; a visually hidden
// table carries the same numbers.
import { useId } from "react";

export function Bars({ rows, caption }: { rows: { label: string; value: number }[]; caption: string }) {
  const id = useId();
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <figure className="min-w-0">
      <div role="img" aria-labelledby={`${id}-cap`} className="space-y-2">
        {rows.map(r => (
          <div key={r.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="h-3 rounded-sm bg-muted"><span className="block h-3 rounded-sm bg-foreground" style={{ width: `${(100 * r.value) / max}%` }} /></span>
            <span className="text-right font-mono">{r.value}</span>
          </div>
        ))}
      </div>
      <figcaption id={`${id}-cap`} className="sr-only">{caption}</figcaption>
      <div className="sr-only"><table>
        <caption>{caption}</caption>
        <tbody>{rows.map(r => <tr key={r.label}><th scope="row">{r.label}</th><td>{r.value}</td></tr>)}</tbody>
      </table></div>
    </figure>
  );
}
