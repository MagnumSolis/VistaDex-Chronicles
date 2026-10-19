// Shared helpers for app-level tests. Each test loads a fresh module graph, so the edition, the router,
// telemetry and the session's reports all start clean.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, vi } from "vitest";

export async function loadApp({ edition = "public", hash = "", proxy = false }: { edition?: "public" | "pitch"; hash?: string; proxy?: boolean } = {}) {
  vi.resetModules();
  if (edition === "pitch") sessionStorage.setItem("vistadex.edition", "pitch");
  history.replaceState(null, "", `/${hash}`);
  const { CONFIG } = await import("@proto/config.js");
  CONFIG.PROXY_URL = proxy ? "https://proxy.test" : "";
  await import("@/boot"); // as in main.tsx: link fragments are captured before the router
  const tm = await import("@proto/ui/telemetry.js");
  const { App } = await import("@/App");
  const utils = render(<App />);
  return { tm, CONFIG, ...utils };
}

export const go = (path: string) => act(() => {
  location.hash = path;
  window.dispatchEvent(new HashChangeEvent("hashchange"));
});

/** Fills the required fields of the Screen an idea form. */
export const IDEA_FIELDS = { title: "Thing", pitch: "A thing for people who need things", problem: "We are building a thing.", solution: "No such thing exists." };
export function fillIdea(fields: Partial<typeof IDEA_FIELDS> = IDEA_FIELDS) {
  const label: Record<string, RegExp> = { title: /^Idea title/, pitch: /^One-line pitch/, problem: /^Problem/, solution: /^Solution/ };
  for (const [k, v] of Object.entries(fields)) fireEvent.change(screen.getByLabelText(label[k]), { target: { value: v } });
}

export const reportShown = () => waitFor(() => expect(screen.getByRole("heading", { name: "Your report" })).toBeTruthy(), { timeout: 10000 });

/** A minimal valid POST /screen response for proxy tests. */
export const PROXY_REPORT = {
  idea_text: "x",
  claims: [{ claim: "No such tool exists today", type: "novelty", status: "unverified", reasoning: "Only one source.", source_urls: ["https://a.example/1"] }],
  graveyard_matches: [],
  objections: [{ objection: "Incumbents could copy this.", severity: "medium" }],
};

export function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; body: string }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), body: typeof init?.body === "string" ? init.body : "" });
    return handler(String(url), init);
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });
