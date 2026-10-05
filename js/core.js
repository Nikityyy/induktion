// © 2026 Nikita Berger
// Mathe-Kern: seed-basierter Zufall, exakte Brüche (BigInt) und kleine Polynome.

export function rng(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let a = h >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = () => next();
  r.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  r.pick = (arr) => arr[Math.floor(next() * arr.length)];
  r.chance = (p) => next() < p;
  return r;
}

export const newSeed = () => Math.random().toString(36).slice(2, 7).padEnd(5, "0");

// ---------- Brüche ----------
const babs = (x) => (x < 0n ? -x : x);
const bgcd = (a, b) => { a = babs(a); b = babs(b); while (b) [a, b] = [b, a % b]; return a; };
export const gcd = (a, b) => Number(bgcd(BigInt(a), BigInt(b)));

export class Fr {
  constructor(n, d = 1n) {
    n = BigInt(n); d = BigInt(d);
    if (d < 0n) { n = -n; d = -d; }
    const g = bgcd(n, d) || 1n;
    this.n = n / g; this.d = d / g;
  }
  add(o) { o = fr(o); return new Fr(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = fr(o); return new Fr(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = fr(o); return new Fr(this.n * o.n, this.d * o.d); }
  div(o) { o = fr(o); return new Fr(this.n * o.d, this.d * o.n); }
  pow(k) { let r = new Fr(1); for (let i = 0; i < k; i++) r = r.mul(this); return r; }
  cmp(o) { o = fr(o); const x = this.n * o.d - o.n * this.d; return x < 0n ? -1 : x > 0n ? 1 : 0; }
  eq(o) { return this.cmp(o) === 0; }
  get isInt() { return this.d === 1n; }
  get num() { return Number(this.n); }
  get den() { return Number(this.d); }
  toString() { return this.d === 1n ? `${this.n}` : `${this.n}/${this.d}`; }
}
export const fr = (x) => (x instanceof Fr ? x : new Fr(x));
export const fact = (n) => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return new Fr(r); };

// ---------- Polynome (Koeffizienten niedrig -> hoch, als Fr) ----------
export const poly = (...c) => c.map(fr);
export const padd = (p, q) => Array.from({ length: Math.max(p.length, q.length) }, (_, i) => fr(p[i] ?? 0).add(q[i] ?? 0));
export const pneg = (p) => p.map((c) => c.mul(-1));
export const pmul = (p, q) => {
  const r = Array.from({ length: p.length + q.length - 1 }, () => new Fr(0));
  p.forEach((a, i) => q.forEach((b, j) => (r[i + j] = r[i + j].add(a.mul(b)))));
  return r;
};
export const pscale = (p, s) => p.map((c) => c.mul(s));
export const peval = (p, x) => p.reduceRight((acc, c) => acc.mul(x).add(c), new Fr(0));
const trim = (p) => { const r = [...p]; while (r.length > 1 && r.at(-1).eq(0)) r.pop(); return r; };
export const peq = (p, q) => { p = trim(p); q = trim(q); return p.length === q.length && p.every((c, i) => c.eq(q[i])); };
// p(n) -> p(n+1)
export const pshift = (p) => p.reduce((acc, c, i) => padd(acc, pscale(Array.from({ length: i }, () => poly(1, 1)).reduce(pmul, poly(1)), c)), poly(0));

const lcm = (a, b) => (a / gcd(a, b)) * b;
// Polynom mit ganzzahligen Koeffizienten als TeX; v = Variable
export function polyTex(c, v = "n") {
  let s = "";
  for (let i = c.length - 1; i >= 0; i--) {
    const x = Number(c[i]);
    if (!x) continue;
    const a = Math.abs(x);
    const body = i === 0 ? `${a}` : `${a === 1 ? "" : a}${i === 1 ? v : `${v}^{${i}}`}`;
    s += x < 0 ? `-${body}` : s ? `+${body}` : body;
  }
  return s || "0";
}
// Polynom mit Bruch-Koeffizienten -> { den, ints, tex }
export function polyFrac(p) {
  p = trim(p);
  const den = p.reduce((d, c) => lcm(d, c.den), 1);
  const ints = p.map((c) => c.mul(den).num);
  return { den, ints, tex: den === 1 ? polyTex(ints) : `\\frac{${polyTex(ints)}}{${den}}` };
}

// ---------- kleine TeX-Helfer ----------
export const isNum = (v) => /^-?\d+$/.test(v);
export const cdot = (c, v) => (c === 1 ? v : isNum(v) ? `${c}\\cdot ${v}` : `${c}${v}`);
