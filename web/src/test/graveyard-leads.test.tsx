// Leads to check: the "no match" line counts the graveyard the run actually checked, and a live lead shows
// its closure sources, labelled as an automatic check (not as checked by the team).
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GraveyardLeads } from "@/components/report/GraveyardLeads";

afterEach(cleanup);
const lead = { company_name: "Fixr", what_they_tried: "Same-day hardware repair marketplace.", cause_of_death: "Could not keep technicians.", year_closed: 2019, similarity: 0.32 };

describe("GraveyardLeads", () => {
  it("no match: says how many shut-down startups the run checked", () => {
    render(<GraveyardLeads matches={[]} ideaText="x" entriesChecked={465} />);
    expect(screen.getByText(/No close matches among the 465 shut-down startups checked/)).toBeTruthy();
  });

  it("a live lead links its closure sources and says they were checked automatically", () => {
    render(<GraveyardLeads matches={[{ ...lead, source_urls: ["https://loot-drop.io/fixr", "https://techcrunch.com/2019/fixr"] }]} ideaText="repair marketplace" entriesChecked={465} />);
    expect(screen.getByText(/Shutdown stated in 2 independent sources \(automatic check\)/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /techcrunch\.com/ })).toBeTruthy();
    expect(screen.queryByText(/not yet checked by the team/)).toBe(null);
  });

  it("a lead without sources still says it is unchecked", () => {
    render(<GraveyardLeads matches={[{ ...lead, source_urls: [] }]} ideaText="repair" entriesChecked={18} />);
    expect(screen.getByText(/Closure source not yet checked by the team/)).toBeTruthy();
  });
});
