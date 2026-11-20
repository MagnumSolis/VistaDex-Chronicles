import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { GraveyardCounter } from "@/components/GraveyardCounter";

const realMatchMedia = window.matchMedia;
const reducedMotion = (on: boolean) => {
  window.matchMedia = ((q: string) => ({ matches: on && q.includes("reduce"), media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
};
afterEach(() => { cleanup(); window.matchMedia = realMatchMedia; });
const load = async () => ({ confirmed: 924, updated_at: new Date(Date.now() - 3 * 3600_000).toISOString() });

describe("Home graveyard counter", () => {
  it("shows the live number at once under reduced motion; screen readers get the final number only", async () => {
    reducedMotion(true);
    render(<GraveyardCounter load={load} />);
    const el = await screen.findByTestId("graveyard-counter");
    expect(el.querySelector(".sr-only")?.textContent).toBe("924 shut-down startups in the graveyard, each confirmed by two independent sources. Updated 3 h ago.");
    await waitFor(() => expect(el.querySelector("[aria-hidden].tabular-nums")?.textContent).toBe("924"));
  });

  it("otherwise counts up from below the target", async () => {
    reducedMotion(false);
    render(<GraveyardCounter load={load} />);
    const el = await screen.findByTestId("graveyard-counter");
    expect(Number(el.querySelector("[aria-hidden].tabular-nums")?.textContent?.replace(/,/g, ""))).toBeLessThan(924);
  });

  it("shows nothing without a number (mock build or a failed request)", async () => {
    const { container } = render(<GraveyardCounter load={async () => null} />);
    await new Promise(r => setTimeout(r, 20));
    expect(container.textContent).toBe("");
  });
});
