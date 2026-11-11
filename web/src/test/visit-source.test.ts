// Where a visitor came from (participant_registered.source): a utm_source link wins; otherwise the referrer
// is mapped to a channel, including the link wrappers LinkedIn (lnkd.in) and X (t.co) put on shared links.
import { afterEach, describe, expect, it } from "vitest";
import { captureSource, visitSource, clearSource } from "@/lib/source";

const visit = (search: string, referrer: string) => {
  clearSource();
  history.replaceState(null, "", `/${search}`);
  Object.defineProperty(document, "referrer", { value: referrer, configurable: true });
  captureSource();
  return visitSource();
};
afterEach(() => { clearSource(); history.replaceState(null, "", "/"); });

describe("visit source", () => {
  it("utm_source wins", () => expect(visit("?utm_source=LinkedIn", "https://t.co/abc")).toBe("linkedin"));
  it("LinkedIn referrers", () => {
    expect(visit("", "https://www.linkedin.com/feed/")).toBe("linkedin");
    expect(visit("", "https://lnkd.in/abc")).toBe("linkedin");
  });
  it("X referrers", () => {
    expect(visit("", "https://t.co/xyz")).toBe("x");
    expect(visit("", "https://x.com/someone")).toBe("x");
    expect(visit("", "https://twitter.com/someone")).toBe("x");
  });
  it("other sites keep their name, without www", () => expect(visit("", "https://www.producthunt.com/posts/x")).toBe("ref:producthunt"));
  it("no referrer is direct", () => expect(visit("", "")).toBe("direct"));
});
