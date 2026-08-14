// Polyfills window.storage (Claude artifact storage API) using the browser's
// localStorage, so the app works identically when hosted outside Claude
// (e.g. on Vercel/Netlify). Data is saved per-device, in this browser only.
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key, _shared) {
      const raw = localStorage.getItem(key);
      if (raw === null) throw new Error("key not found");
      return { key, value: raw, shared: !!_shared };
    },
    async set(key, value, _shared) {
      localStorage.setItem(key, value);
      return { key, value, shared: !!_shared };
    },
    async delete(key, _shared) {
      localStorage.removeItem(key);
      return { key, deleted: true, shared: !!_shared };
    },
    async list(prefix, _shared) {
      const keys = Object.keys(localStorage).filter((k) => !prefix || k.startsWith(prefix));
      return { keys, prefix, shared: !!_shared };
    },
  };
}
