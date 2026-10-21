import { configure } from "@testing-library/dom";

// App tests load a fresh module graph each time; give findBy* queries room on a busy machine.
configure({ asyncUtilTimeout: 5000 });

// jsdom gaps used by the app and Radix dialogs.
globalThis.requestAnimationFrame ??= (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0) as unknown as number;
globalThis.cancelAnimationFrame ??= (id: number) => clearTimeout(id);
Element.prototype.scrollIntoView ??= function () {};
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
window.scrollTo = (() => {}) as typeof window.scrollTo;
window.matchMedia ??= ((q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;

// Network guard (../tests/setup/network-guard.js, loaded first): name the current test in its errors, and
// fail any test whose code sent a request off localhost, even if the app caught the error.
import { afterEach, expect } from "vitest";
(globalThis as { __vistadexCurrentTest?: () => string | undefined }).__vistadexCurrentTest = () => expect.getState().currentTestName;
afterEach(() => {
  const blocked = (globalThis as { __vistadexBlocked?: string[] }).__vistadexBlocked?.splice(0) ?? [];
  if (blocked.length) throw new Error(blocked.join("\n"));
});
