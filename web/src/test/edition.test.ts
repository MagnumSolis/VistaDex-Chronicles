import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { captureEdition, featuresFor } from "@/edition";

const fakeHistory = () => ({ state: null, calls: [] as string[], replaceState(_s: unknown, _t: string, url: string) { this.calls.push(url); } });

describe("edition features", () => {
  it("public: welcome, walkthrough, telemetry, feedback; no dashboard; only the latest report", () => {
    expect(featuresFor("public")).toMatchObject({
      home: "welcome", welcome: true, walkthrough: true, telemetry: true, feedback: true,
      dashboard: false, reportHistory: false, badge: null, nav: ["screen", "graveyard", "how"],
    });
  });
  it("pitch: dashboard home, every report, a badge, and telemetry fully off", () => {
    expect(featuresFor("pitch")).toMatchObject({
      home: "dashboard", welcome: false, walkthrough: false, telemetry: false, feedback: false,
      dashboard: true, reportHistory: true, badge: "Pitch edition", nav: ["dashboard", "screen", "graveyard", "how"],
    });
  });
});

describe("edition from the link fragment", () => {
  it("#edition=pitch&code=… unlocks pitch, keeps code= for access.js and scrubs edition=", () => {
    sessionStorage.clear();
    const hist = fakeHistory();
    expect(captureEdition({ pathname: "/VistaDex/", search: "", hash: "#edition=pitch&code=K7Q2" }, hist)).toBe("pitch");
    expect(hist.calls).toEqual(["/VistaDex/#code=K7Q2"]);
    // Remembered for the tab: later route fragments keep the edition.
    expect(captureEdition({ pathname: "/VistaDex/", search: "", hash: "#/screen" }, fakeHistory())).toBe("pitch");
  });
  it("defaults to public; any other value is public", () => {
    sessionStorage.clear();
    expect(captureEdition({ pathname: "/", search: "", hash: "" }, fakeHistory())).toBe("public");
    expect(captureEdition({ pathname: "/", search: "", hash: "#edition=PITCHX" }, fakeHistory())).toBe("public");
  });
});

// "No edition checks scattered through components": only edition.ts may name an edition or read it.
describe("edition checks live only in edition.ts", () => {
  const root = resolve(process.cwd(), "src");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !p.includes(`${join("src", "test")}`)) files.push(p);
    }
  };
  walk(root);
  it("no other source file mentions the pitch/public edition names or imports `edition`", () => {
    const offenders = files.filter(f => !f.endsWith("edition.ts")).filter(f => {
      const src = readFileSync(f, "utf8");
      return /["'`](pitch|public)["'`]/.test(src) || /import\s*\{[^}]*\b(edition|Edition|featuresFor)\b[^}]*\}\s*from\s*["']@\/edition["']/.test(src);
    }).map(f => relative(root, f));
    expect(offenders).toEqual([]);
  });
});
