// LinkedIn and X build link previews from Open Graph / Twitter card tags: title, description and an absolute
// image URL for a 1200 x 630 card that the build ships.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
const meta = (attr: string, key: string) => html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]+)"`))?.[1];

describe("link preview", () => {
  it("has Open Graph and Twitter card tags", () => {
    expect(meta("property", "og:title")).toBeTruthy();
    expect(meta("property", "og:description")).toBeTruthy();
    expect(meta("property", "og:url")).toBe("https://vistadex-app.pages.dev/");
    expect(meta("property", "og:image")).toBe("https://vistadex-app.pages.dev/og-card.png");
    expect(meta("property", "og:image:width")).toBe("1200");
    expect(meta("property", "og:image:height")).toBe("630");
    expect(meta("name", "twitter:card")).toBe("summary_large_image");
    expect(meta("name", "twitter:image")).toBe("https://vistadex-app.pages.dev/og-card.png");
    expect(meta("property", "og:image:alt")).toBeTruthy();
  });
  it("ships the card image at 1200 x 630", () => {
    const png = resolve(process.cwd(), "public/og-card.png");
    expect(existsSync(png)).toBe(true);
    const b = readFileSync(png);
    expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([1200, 630]);
  });
});
