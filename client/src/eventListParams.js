const defaults = { q: "", location: "", date: "", category: "", pricing: "all", status: "upcoming", page: "1", page_size: "12" };

export function readEventListParams(params) {
  // Keep malformed URL values intact so the API can return a useful error.
  return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, params.get(key) ?? value]));
}

export function changeEventListParams(current, changes, { resetPage = true } = {}) {
  const next = new URLSearchParams(current);
  if (resetPage) next.delete("page");
  for (const [key, raw] of Object.entries(changes)) {
    const value = String(raw);
    if (value === defaults[key] || value === "") next.delete(key);
    else next.set(key, value);
  }
  return next;
}
