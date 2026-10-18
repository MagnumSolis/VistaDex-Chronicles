// Dev-only palette swatch (?swatch). Reads the live CSS tokens and shows WCAG contrast for the pairs the UI uses.
import { STATUS, STATUS_ORDER, SeverityTag, StatusTag } from "@/components/status";
import { cn } from "@/lib/utils";

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
function lum(hex: string) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

function Chip({ name, label, fg }: { name: string; label: string; fg?: string }) {
  const bg = css(name);
  return (
    <div className="overflow-hidden rounded-card bg-card shadow-card">
      <div className="h-20" style={{ background: bg }} />
      <div className="p-3">
        <div className="text-sm font-semibold">{label}</div>
        <div className="font-mono text-xs text-muted-foreground">--{name} {bg.toUpperCase()}</div>
        {fg && <div className="mt-1 font-mono text-xs text-muted-foreground">{ratio(css(fg), bg).toFixed(2)}:1 with --{fg}</div>}
      </div>
    </div>
  );
}

export function Swatch() {
  return (
    <div className="space-y-10">
      <h1 className="font-display text-[2.75rem] font-bold leading-none tracking-tight">Palette</h1>
      <section className="space-y-3">
        <h2 className="font-display text-2xl font-bold">Base and accent</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Chip name="background" label="Background" fg="foreground" />
          <Chip name="card" label="Card" fg="foreground" />
          <Chip name="foreground" label="Ink" fg="card" />
          <Chip name="muted-foreground" label="Muted text" fg="card" />
          <Chip name="primary" label="Accent (interactive)" fg="primary-foreground" />
          <Chip name="input" label="Field outline" fg="card" />
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-2xl font-bold">Status (only for status)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATUS_ORDER.map(st => {
            const Icon = STATUS[st].icon;
            const fg = css(`st-${st}`), tint = css(`st-${st}-bg`);
            return (
              <div key={st} className={cn("space-y-4 rounded-card p-5", STATUS[st].bg)}>
                <div className="flex items-center gap-2.5 font-semibold">
                  <span className="inline-flex size-9 items-center justify-center rounded-full bg-card"><Icon className={cn("size-5", STATUS[st].text)} /></span>
                  {STATUS[st].label}
                </div>
                <StatusTag status={st} />
                <div className="font-mono text-xs leading-relaxed">
                  {fg.toUpperCase()} on tint {tint.toUpperCase()}: {ratio(fg, tint).toFixed(2)}:1<br />
                  {fg.toUpperCase()} on white: {ratio(fg, "#ffffff").toFixed(2)}:1<br />
                  ink on tint: {ratio(css("foreground"), tint).toFixed(2)}:1
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-2xl font-bold">Severity (neutral, never status hues)</h2>
        <div className="flex flex-wrap gap-3 rounded-card bg-card p-5 shadow-card">
          <SeverityTag severity="high" /><SeverityTag severity="medium" /><SeverityTag severity="low" />
        </div>
      </section>
    </div>
  );
}
