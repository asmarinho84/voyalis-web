// Armazenamento local (localStorage do WebView do app; memória nos testes).
// Guarda: configurações (inclusive a chave da API), últimas pesquisas, alertas e histórico de preços.
// Fica na área privada do app (backup desativado no Android); é apagado ao desinstalar.
class MemoryStorage {
  #m = new Map();
  getItem(k) { return this.#m.has(k) ? this.#m.get(k) : null; }
  setItem(k, v) { this.#m.set(k, String(v)); }
  removeItem(k) { this.#m.delete(k); }
  get length() { return this.#m.size; }
  key(i) { return [...this.#m.keys()][i] ?? null; }
}

export class Store {
  constructor(storage, prefix = "vy:") {
    this.s = storage || globalThis.localStorage || new MemoryStorage();
    this.prefix = prefix;
  }
  get(key, def = null) {
    try {
      const v = this.s.getItem(this.prefix + key);
      return v == null ? def : JSON.parse(v);
    } catch {
      return def;
    }
  }
  set(key, value) {
    this.s.setItem(this.prefix + key, JSON.stringify(value));
  }
  del(key) {
    this.s.removeItem(this.prefix + key);
  }
  /** Apaga tudo o que o app guardou, menos as chaves listadas em `keep`. */
  clear(keep = []) {
    const all = [];
    for (let i = 0; i < this.s.length; i++) all.push(this.s.key(i));
    for (const k of all) if (k && k.startsWith(this.prefix) && !keep.includes(k.slice(this.prefix.length))) this.s.removeItem(k);
  }
  nextId() {
    const n = (this.get("seq", 0) || 0) + 1;
    this.set("seq", n);
    return n;
  }
}

export { MemoryStorage };
