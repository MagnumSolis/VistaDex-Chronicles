// Where a visitor came from (participant_registered.source): a utm_source link wins; otherwise the referrer
// is mapped to a channel, including the link wrappers LinkedIn (lnkd.in) and X (t.co) put on shared links.
import { afterEach, describe, expect, it } from "vitest";
import { captureSource, visitSource, clearSource, sourceChangedThisLoad } from "@/lib/source";

const visit = (search: string, referrer: string) => {
  clearSource();
  history.replaceState(null, "", `/${search}`);
  Object.defineProperty(document, "referrer", { value: referrer, configurable: true });
  captureSource();
  return visitSource();
};
// A later visit in the same browser, without clearing what an earlier visit stored.
const revisit = (search: string, referrer: string) => {
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
  it("the LinkedIn post's redirect page counts as LinkedIn, even if extra query text dropped the tag", () => {
    expect(visit("?trk=feed", "https://vistadex-study.github.io/")).toBe("linkedin");
    expect(visit("?utm_source=x", "https://vistadex-study.github.io/")).toBe("x");
  });
  it("a tagged link replaces what an earlier visit stored (someone who came direct, then from the post)", () => {
    expect(visit("", "")).toBe("direct");
    expect(revisit("?utm_source=linkedin", "")).toBe("linkedin");
    expect(revisit("?utm_source=whatsapp", "")).toBe("whatsapp");
  });
  it("a LinkedIn or X referrer replaces an earlier direct, but not an earlier tagged channel", () => {
    expect(visit("", "")).toBe("direct");
    expect(revisit("", "https://lnkd.in/abc")).toBe("linkedin");
    expect(visit("?utm_source=whatsapp", "")).toBe("whatsapp");
    expect(revisit("", "https://t.co/xyz")).toBe("whatsapp");
  });
  it("an untagged return visit keeps the channel (reloads and typed addresses do not erase it)", () => {
    expect(visit("?utm_source=x", "")).toBe("x");
    expect(revisit("", "")).toBe("x");
    expect(revisit("", "https://www.producthunt.com/")).toBe("x");
  });
  it("flags a changed channel (so a consented visitor registers again), not a first visit", () => {
    visit("?utm_source=linkedin", "");
    expect(sourceChangedThisLoad()).toBe(false);
    visit("", "");
    revisit("?utm_source=linkedin", "");
    expect(sourceChangedThisLoad()).toBe(true);
  });
});
