// graveyard-live.js — adapt the exported Atlas snapshot to the pipeline's
// graveyard shape (adds stable ids for deterministic tie-breaking in sorts).
let counter = 0;
const seen = new Map();
export function withIds(entries) {
  return entries.map(e => {
    if (e.id) return e;
    if (!seen.has(e.company_name)) seen.set(e.company_name, `live-${++counter}`);
    return { ...e, id: seen.get(e.company_name) };
  });
}
