// © 2026 Nikita Berger
// Aufgaben-Generatoren für vollständige Induktion. Jede Aufgabe entsteht aus einem Seed,
// enthält Lösungsweg (blocks) und eine Wahrheitsprüfung (holds) für den Selbsttest.
import { rng, newSeed, Fr, fr, fact, gcd, poly, padd, pneg, pmul, pscale, peval, peq, pshift, polyTex, polyFrac, cdot, isNum } from "./core.js";

const T = String.raw;
const NN = T`\mathbb{N}`;
const L = (rel, tex, note, v) => ({ rel, tex, note, v });
const sum = (lo, hi, f) => { let s = new Fr(0); for (let k = lo; k <= hi; k++) s = s.add(f(k)); return s; };
const prod = (lo, hi, f) => { let s = new Fr(1); for (let k = lo; k <= hi; k++) s = s.mul(f(k)); return s; };
const sgn = (n) => (n % 2 === 1 ? 1 : -1); // (-1)^(n+1)
const binom = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };

const domTex = (r, n0) => (n0 === 1 ? T`n\in${NN}` : n0 >= 2 && r.chance(0.5) ? `n>${n0 - 1}` : T`n\ge ${n0}`);

// Standard-Beweisgerüst: Anfang, Annahme, Schritt, Schluss
function blocks({ n0, dom, anfang, An, An1, chain, afterStep = [], annahme }) {
  return [
    { h: "Induktionsanfang", items: anfang },
    { h: "Induktionsannahme", items: [{ t: "text", s: annahme ?? T`Die Aussage gelte für ein festes (aber beliebiges) $n\ge ${n0}$:` }, { t: "eq", tex: An }] },
    { h: "Induktionsschritt", items: [{ t: "text", s: "Für dieses $n$ ist zu zeigen:" }, { t: "eq", tex: An1 }, { t: "chain", ...chain }, ...afterStep] },
    { h: "Schluss", items: [{ t: "text", s: `Nach dem Prinzip der vollständigen Induktion gilt die Behauptung für alle $${dom}$.` }] },
  ];
}
const hints = (n0, An1, strategy) => [
  { s: `Startwert: Für welches kleinste $n$ soll die Aussage gelten? Setze es im Induktionsanfang ein und prüfe beide Seiten getrennt.` },
  { s: "Schreibe $A(n+1)$ sauber auf: ersetze überall $n$ stur durch $(n+1)$ und setze Klammern.", eq: An1 },
  { s: strategy },
];

// ---------- Summen mit Polynomen ----------
const autoTex = (f) => (v) => {
  let s = "";
  for (let i = f.length - 1; i >= 0; i--) {
    const c = f[i].num;
    if (!c) continue;
    const a = Math.abs(c);
    const pw = i === 1 ? v : `${v}^{${i}}`;
    const body = i === 0 ? `${a}` : a === 1 ? pw : isNum(v) ? T`${a}\cdot ${pw}` : `${a}${pw}`;
    s += c < 0 ? `-${body}` : s ? `+${body}` : body;
  }
  return s;
};

function polySum({ f, F, ftex }) {
  const fP = f.map(fr);
  ftex ??= autoTex(fP);
  let coef = fr(F.coef);
  const fac = F.factors.map(([p, q]) => { const g = gcd(p, q) || 1; coef = coef.mul(g); return [p / g, q / g]; });
  const Fp = fac.reduce((acc, [p, q]) => pmul(acc, poly(q, p)), [coef]);
  if (!peq(padd(pshift(Fp), pneg(Fp)), pshift(fP)) || !peval(Fp, 0).eq(0)) throw new Error("Summenformel inkonsistent");
  const facTex = (sh) => {
    const groups = [];
    for (const [p, q0] of fac) {
      const q = q0 + p * sh;
      const g = groups.find((x) => x[0] === p && x[1] === q);
      g ? g[2]++ : groups.push([p, q, 1]);
    }
    return groups.map(([p, q, e]) => { const b = p === 1 && q === 0 ? "n" : `(${polyTex([q, p])})`; return e > 1 ? `${b}^{${e}}` : b; }).join("");
  };
  const numTex = (sh) => `${coef.num === 1 ? "" : coef.num}${facTex(sh)}`;
  const closed = (sh) => (coef.den === 1 ? numTex(sh) : T`\frac{${numTex(sh)}}{${coef.den}}`);
  const Pn = padd(Fp, pshift(fP));
  const Pf = polyFrac(Pn);
  const probeInts = pscale(pshift(Fp), coef.den).map((c) => c.num);
  const v1 = fr(peval(fP, 1));
  const facVals = fac.map(([p, q]) => p + q);
  const rhs1 = T`${coef.den === 1 ? "" : "\\frac{"}${coef.num === 1 ? "" : coef.num + "\\cdot "}${facVals.join("\\cdot ")}${coef.den === 1 ? "" : `}{${coef.den}}`}`;
  const vTot = (n) => peval(Fp, n + 1);
  // Summand mit Plus/Minus auf oberster Ebene braucht Klammern: \sum (6k-2), nicht \sum 6k-2
  const topSign = (x) => { let d = 0; for (let i = 1; i < x.length; i++) { const c = x[i]; if ("({[".includes(c)) d++; else if (")}]".includes(c)) d--; else if (!d && (c === "+" || c === "-")) return true; } return false; };
  const body = topSign(ftex("k")) ? `(${ftex("k")})` : ftex("k");
  const sumTex = (hi) => T`\sum_{k=1}^{${hi}} ${body}`;
  const An = T`${sumTex("n")} = ${closed(0)}`;
  const An1 = T`${sumTex("n+1")} = ${closed(1)}`;
  const chain = {
    start: sumTex("n+1"),
    v0: (n) => sum(1, n + 1, (k) => peval(fP, k)),
    lines: [
      L("=", T`\left(${sumTex("n")}\right) + ${ftex("(n+1)")}`, "Letzten Summanden abspalten: $k$ stur durch $(n+1)$ ersetzen.", vTot),
      L("=", T`${closed(0)} + ${ftex("(n+1)")}`, "Induktionsannahme für die Summe bis $n$ einsetzen.", vTot),
      L("=", Pf.tex, "Auf den Hauptnenner bringen, ausmultiplizieren, zusammenfassen. Noch nicht raten, wohin es geht, erst ausrechnen.", vTot),
      L("=", closed(1), `Wo wollen wir hin? Zu ${"$"}${closed(1)}${"$"}. Probe: Zähler ausmultiplizieren: $${numTex(1)} = ${polyTex(probeInts)}$. Das passt.`, vTot),
    ],
  };
  const n0 = 1;
  return {
    n0, claim: An, holds: (n) => sum(1, n, (k) => peval(fP, k)).eq(peval(Fp, n)),
    hints: hints(n0, An1, T`Letzten Summanden abspalten, Induktionsannahme einsetzen, dann ausrechnen und mit dem Ziel $${closed(1)}$ vergleichen (ausklammern!).`),
    blocks: blocks({
      n0, dom: T`n\in${NN}`, An, An1, chain,
      anfang: [
        { t: "text", s: "Startwert $n_0=1$. Beide Seiten einzeln ausrechnen:" },
        { t: "eq", tex: T`${sumTex("1")} = ${ftex("1")} = ${v1}` },
        { t: "eq", tex: T`${rhs1} = ${v1}` },
        { t: "text", s: "Beide Seiten sind gleich, der Induktionsanfang gilt." },
      ],
    }),
  };
}

const sumArith = (r) => {
  const a = r.int(2, 9), b = r.chance(0.2) ? 0 : r.int(-6, 6);
  return polySum({ f: [b, a], F: b === 0 ? { coef: new Fr(a, 2), factors: [[1, 0], [1, 1]] } : { coef: new Fr(1, 2), factors: [[1, 0], [a, a + 2 * b]] } });
};
const sumPoly = (r) => {
  const c = r.int(2, 6);
  return r.pick([
    () => polySum({ f: [0, 0, 1], ftex: (v) => `${v}^{2}`, F: { coef: new Fr(1, 6), factors: [[1, 0], [1, 1], [2, 1]] } }),
    () => polySum({ f: [0, 0, 0, 1], ftex: (v) => `${v}^{3}`, F: { coef: new Fr(1, 4), factors: [[1, 0], [1, 0], [1, 1], [1, 1]] } }),
    () => polySum({ f: [1, -4, 4], ftex: (v) => T`(${cdot(2, v)}-1)^{2}`, F: { coef: new Fr(1, 3), factors: [[1, 0], [2, -1], [2, 1]] } }),
    () => polySum({ f: [0, 1, 1], ftex: (v) => T`${v}(${v}+1)`, F: { coef: new Fr(1, 3), factors: [[1, 0], [1, 1], [1, 2]] } }),
    () => polySum({ f: [0, 0.5, 0.5].map((x) => new Fr(x * 2, 2)), ftex: (v) => T`\frac{${v}(${v}+1)}{2}`, F: { coef: new Fr(1, 6), factors: [[1, 0], [1, 1], [1, 2]] } }),
    () => polySum({ f: [0, c, 1], ftex: (v) => T`${v}(${v}+${c})`, F: { coef: new Fr(1, 6), factors: [[1, 0], [1, 1], [2, 1 + 3 * c]] } }),
  ])();
};
const sumHard = (r) => r.pick([
  () => polySum({ f: [0, 2, 3, 1], ftex: (v) => T`${v}(${v}+1)(${v}+2)`, F: { coef: new Fr(1, 4), factors: [[1, 0], [1, 1], [1, 2], [1, 3]] } }),
  () => polySum({ f: [1, -3, 3], F: { coef: new Fr(1), factors: [[1, 0], [1, 0], [1, 0]] } }),
])();

// ---------- Geometrische Summe ----------
function sumGeo(r) {
  const q = r.int(2, 5), c = r.pick([1, 1, 2, 3, q - 1, q - 1]);
  const t = c % (q - 1) === 0 ? c / (q - 1) : null;
  const numer = (e) => (c === 1 ? T`${q}^{${e}}-1` : T`${c}(${q}^{${e}}-1)`);
  const G = (e) => (t !== null ? (t === 1 ? T`${q}^{${e}}-1` : T`${t}(${q}^{${e}}-1)`) : T`\frac{${numer(e)}}{${q - 1}}`);
  const term = (k) => (c === 1 ? `${q}^{${k}}` : T`${c}\cdot ${q}^{${k}}`);
  const cq = new Fr(c), Q = new Fr(q);
  const Gv = (n) => cq.mul(Q.pow(n).sub(1)).div(q - 1);
  const An = T`\sum_{k=1}^{n} ${term("k-1")} = ${G("n")}`;
  const An1 = T`\sum_{k=1}^{n+1} ${term("k-1")} = ${G("n+1")}`;
  const w = c * (q - 1);
  const lines = [
    L("=", T`\left(\sum_{k=1}^{n} ${term("k-1")}\right) + ${term("(n+1)-1")}`, "Letzten Summanden abspalten, $k$ durch $(n+1)$ ersetzen.", (n) => Gv(n + 1)),
    L("=", T`${G("n")} + ${term("n")}`, "Induktionsannahme einsetzen; $(n+1)-1=n$.", (n) => Gv(n + 1)),
    L("=", T`\frac{${numer("n")} + ${w}\cdot ${q}^{n}}{${q - 1}}`, `Auf den Hauptnenner $${q - 1}$ bringen.`, (n) => Gv(n + 1)),
    L("=", T`\frac{${numer("n+1")}}{${q - 1}}`, `Zähler: $${c === 1 ? "" : c + "\\cdot "}${q}^{n}$ und $-${c === 1 ? "" : c + "\\cdot "}${q}^{n}$ heben sich weg, denn $${q - 1}\\cdot ${q}^{n}=${q}^{n+1}-${q}^{n}$.`, (n) => Gv(n + 1)),
  ];
  if (t !== null) lines.push(L("=", G("n+1"), `Kürzen: $\\frac{${c}}{${q - 1}}=${t}$. Das ist die rechte Seite für $n+1$.`, (n) => Gv(n + 1)));
  const n0 = 1;
  return {
    n0, claim: An, holds: (n) => sum(1, n, (k) => cq.mul(Q.pow(k - 1))).eq(Gv(n)),
    hints: hints(n0, An1, T`Letzten Summanden abspalten, Induktionsannahme einsetzen, auf den Hauptnenner $${q - 1}$ bringen. Dann fällt $${q}^{n}$ weg.`),
    blocks: blocks({
      n0, dom: T`n\in${NN}`, An, An1,
      chain: { start: T`\sum_{k=1}^{n+1} ${term("k-1")}`, v0: (n) => sum(1, n + 1, (k) => cq.mul(Q.pow(k - 1))), lines },
      anfang: [
        { t: "text", s: "Startwert $n_0=1$." },
        { t: "eq", tex: T`\sum_{k=1}^{1} ${term("k-1")} = ${term("0")} = ${c}` },
        { t: "eq", tex: T`${G("1")} = ${c}` },
        { t: "text", s: "Beide Seiten sind gleich, der Induktionsanfang gilt." },
      ],
    }),
  };
}

// ---------- Teleskopsummen ----------
function sumTele(r) {
  const a = r.int(1, 5);
  const first = (k) => (a === 1 ? k : k === "(n+1)" ? T`${a}(n+1)-${a - 1}` : T`${a}${k}-${a - 1}`);
  const second = (k) => (k === "(n+1)" ? T`${a === 1 ? "" : a}(n+1)+1` : T`${a === 1 ? "" : a}${k}+1`);
  const A1 = a === 1 ? "n+1" : `${a}n+1`, A2 = `${a === 1 ? "" : a}n+${a + 1}`;
  const f = (k) => T`\frac{1}{(${first(k)})(${second(k)})}`;
  const fv = (k) => new Fr(1, (a * k - a + 1) * (a * k + 1));
  const R = (n) => new Fr(n, a * n + 1);
  const An = T`\sum_{k=1}^{n} ${f("k")} = \frac{n}{${A1}}`;
  const An1 = T`\sum_{k=1}^{n+1} ${f("k")} = \frac{n+1}{${a === 1 ? "(n+1)+1" : T`${a}(n+1)+1`}}`;
  const vv = (n) => R(n + 1);
  const n0 = 1;
  return {
    n0, claim: An, holds: (n) => sum(1, n, fv).eq(R(n)),
    hints: hints(n0, An1, T`Teleskop-Idee: Nach Induktionsannahme steht da $\frac{n}{${A1}}$, dazu kommt ein einziger Bruch. Auf den Hauptnenner bringen und den Zähler in Faktoren zerlegen.`),
    blocks: blocks({
      n0, dom: T`n\in${NN}`, An, An1,
      chain: {
        start: T`\sum_{k=1}^{n+1} ${f("k")}`, v0: (n) => sum(1, n + 1, fv),
        lines: [
          L("=", T`\left(\sum_{k=1}^{n} ${f("k")}\right) + ${f("(n+1)")}`, "Letzten Summanden abspalten.", vv),
          L("=", T`\frac{n}{${A1}} + ${f("(n+1)")}`, "Induktionsannahme einsetzen.", vv),
          L("=", T`\frac{n}{${A1}} + \frac{1}{(${A1})(${A2})}`, `Klammern vereinfachen: $${first("(n+1)")}=${A1}$ und $${second("(n+1)")}=${A2}$.`, vv),
          L("=", T`\frac{n(${A2})+1}{(${A1})(${A2})}`, `Auf den Hauptnenner $(${A1})(${A2})$ bringen.`, vv),
          L("=", T`\frac{(${A1})(n+1)}{(${A1})(${A2})}`, `Wo wollen wir hin? Der Zähler soll den Faktor $(${A1})$ enthalten. Probe: $(${A1})(n+1)=${polyTex([1, a + 1, a])}$ und $n(${A2})+1=${polyTex([1, a + 1, a])}$. Passt.`, vv),
          L("=", T`\frac{n+1}{${A2}}`, `Mit $(${A1})$ kürzen. Das ist die rechte Seite für $n+1$.`, vv),
        ],
      },
      anfang: [
        { t: "text", s: "Startwert $n_0=1$." },
        { t: "eq", tex: T`\sum_{k=1}^{1} ${f("k")} = ${f("1")} = \frac{1}{${1 * (a + 1)}}` },
        { t: "eq", tex: T`\frac{1}{${a}\cdot 1+1} = \frac{1}{${a + 1}}` },
        { t: "text", s: "Beide Seiten sind gleich, der Induktionsanfang gilt." },
      ],
    }),
  };
}

function sumTele3() {
  const f = (k) => T`\frac{1}{${k}(${k}+1)(${k}+2)}`;
  const fv = (k) => new Fr(1, k * (k + 1) * (k + 2));
  const R = (n) => new Fr(n * (n + 3), 4 * (n + 1) * (n + 2));
  const An = T`\sum_{k=1}^{n} ${f("k")} = \frac{n(n+3)}{4(n+1)(n+2)}`;
  const An1 = T`\sum_{k=1}^{n+1} ${f("k")} = \frac{(n+1)((n+1)+3)}{4((n+1)+1)((n+1)+2)}`;
  const vv = (n) => R(n + 1);
  const n0 = 1;
  return {
    n0, claim: An, holds: (n) => sum(1, n, fv).eq(R(n)),
    hints: hints(n0, An1, T`Nach Abspalten und Einsetzen brauchst du den Hauptnenner $4(n+1)(n+2)(n+3)$. Der Zähler wird ein Polynom dritten Grades: suche den Faktor $(n+1)$.`),
    blocks: blocks({
      n0, dom: T`n\in${NN}`, An, An1,
      chain: {
        start: T`\sum_{k=1}^{n+1} ${f("k")}`, v0: (n) => sum(1, n + 1, fv),
        lines: [
          L("=", T`\left(\sum_{k=1}^{n} ${f("k")}\right) + ${f("(n+1)")}`, "Letzten Summanden abspalten.", vv),
          L("=", T`\frac{n(n+3)}{4(n+1)(n+2)} + \frac{1}{(n+1)(n+2)(n+3)}`, "Induktionsannahme einsetzen, $(n+1)+1=n+2$ und $(n+1)+2=n+3$.", vv),
          L("=", T`\frac{n(n+3)^2+4}{4(n+1)(n+2)(n+3)}`, "Auf den Hauptnenner $4(n+1)(n+2)(n+3)$ bringen: der erste Bruch wird mit $(n+3)$, der zweite mit $4$ erweitert.", vv),
          L("=", T`\frac{(n+1)^2(n+4)}{4(n+1)(n+2)(n+3)}`, "Wo wollen wir hin? Im Ziel steht $(n+1)$ im Zähler. Probe: $n(n+3)^2+4=n^3+6n^2+9n+4=(n+1)^2(n+4)$.", vv),
          L("=", T`\frac{(n+1)(n+4)}{4(n+2)(n+3)}`, "Mit $(n+1)$ kürzen. Das ist die rechte Seite für $n+1$.", vv),
        ],
      },
      anfang: [
        { t: "text", s: "Startwert $n_0=1$." },
        { t: "eq", tex: T`\sum_{k=1}^{1} ${f("k")} = \frac{1}{1\cdot 2\cdot 3} = \frac{1}{6}` },
        { t: "eq", tex: T`\frac{1\cdot(1+3)}{4\cdot 2\cdot 3} = \frac{4}{24} = \frac{1}{6}` },
        { t: "text", s: "Beide Seiten sind gleich, der Induktionsanfang gilt." },
      ],
    }),
  };
}

function sumAlt() {
  const f = (k) => T`(-1)^{${k}+1}${k === "k" ? "k" : k}^{2}`;
  const fv = (k) => new Fr(sgn(k) * k * k);
  const R = (n) => new Fr(sgn(n) * n * (n + 1), 2);
  const An = T`\sum_{k=1}^{n} (-1)^{k+1}k^{2} = (-1)^{n+1}\frac{n(n+1)}{2}`;
  const An1 = T`\sum_{k=1}^{n+1} (-1)^{k+1}k^{2} = (-1)^{(n+1)+1}\frac{(n+1)(n+2)}{2}`;
  const vv = (n) => R(n + 1);
  const n0 = 1;
  return {
    n0, claim: An, holds: (n) => sum(1, n, fv).eq(R(n)),
    hints: hints(n0, An1, T`Vorzeichen beachten: $(-1)^{n+1}=-(-1)^{n+2}$. Klammere $(-1)^{n+2}$ aus, dann bleibt eine Rechnung ohne Vorzeichen.`),
    blocks: blocks({
      n0, dom: T`n\in${NN}`, An, An1,
      chain: {
        start: T`\sum_{k=1}^{n+1} (-1)^{k+1}k^{2}`, v0: (n) => sum(1, n + 1, fv),
        lines: [
          L("=", T`\left(\sum_{k=1}^{n} (-1)^{k+1}k^{2}\right) + (-1)^{(n+1)+1}(n+1)^{2}`, "Letzten Summanden abspalten.", vv),
          L("=", T`(-1)^{n+1}\frac{n(n+1)}{2} + (-1)^{n+2}(n+1)^{2}`, "Induktionsannahme einsetzen, $(n+1)+1=n+2$.", vv),
          L("=", T`(-1)^{n+2}\left(-\frac{n(n+1)}{2} + (n+1)^{2}\right)`, "$(-1)^{n+2}$ ausklammern. Wegen $(-1)^{n+1}=-(-1)^{n+2}$ wechselt im ersten Term das Vorzeichen.", vv),
          L("=", T`(-1)^{n+2}\frac{(n+1)\bigl(-n+2(n+1)\bigr)}{2}`, "Auf den Hauptnenner $2$ bringen und $(n+1)$ ausklammern.", vv),
          L("=", T`(-1)^{n+2}\frac{(n+1)(n+2)}{2}`, "$-n+2n+2=n+2$. Das ist die rechte Seite für $n+1$.", vv),
        ],
      },
      anfang: [
        { t: "text", s: "Startwert $n_0=1$." },
        { t: "eq", tex: T`\sum_{k=1}^{1} (-1)^{k+1}k^{2} = (-1)^{2}\cdot 1^{2} = 1` },
        { t: "eq", tex: T`(-1)^{2}\frac{1\cdot 2}{2} = 1` },
        { t: "text", s: "Beide Seiten sind gleich, der Induktionsanfang gilt." },
      ],
    }),
  };
}

function sumFact() {
  const fv = (k) => fact(k).mul(k);
  const R = (n) => fact(n + 1).sub(1);
  const An = T`\sum_{k=1}^{n} k\cdot k! = (n+1)! - 1`;
  const An1 = T`\sum_{k=1}^{n+1} k\cdot k! = ((n+1)+1)! - 1 = (n+2)! - 1`;
  const vv = (n) => R(n + 1);
  const n0 = 1;
  return {
    n0, claim: An, holds: (n) => sum(1, n, fv).eq(R(n)),
    hints: hints(n0, An1, T`Nach dem Einsetzen kommt $(n+1)!$ in beiden Summanden vor: ausklammern. Dann $(n+2)\,(n+1)!=(n+2)!$.`),
    blocks: blocks({
      n0, dom: T`n\in${NN}`, An, An1,
      chain: {
        start: T`\sum_{k=1}^{n+1} k\cdot k!`, v0: (n) => sum(1, n + 1, fv),
        lines: [
          L("=", T`\left(\sum_{k=1}^{n} k\cdot k!\right) + (n+1)\cdot (n+1)!`, "Letzten Summanden abspalten.", vv),
          L("=", T`(n+1)! - 1 + (n+1)\cdot (n+1)!`, "Induktionsannahme einsetzen.", vv),
          L("=", T`(n+1)!\,\bigl(1+(n+1)\bigr) - 1`, "$(n+1)!$ ausklammern.", vv),
          L("=", T`(n+2)\cdot (n+1)! - 1`, "Zusammenfassen: $1+(n+1)=n+2$.", vv),
          L("=", T`(n+2)! - 1`, "Definition der Fakultät: $(n+2)!=(n+2)\cdot(n+1)!$. Das ist die rechte Seite für $n+1$.", vv),
        ],
      },
      anfang: [
        { t: "text", s: "Startwert $n_0=1$." },
        { t: "eq", tex: T`\sum_{k=1}^{1} k\cdot k! = 1\cdot 1! = 1` },
        { t: "eq", tex: T`(1+1)! - 1 = 2-1 = 1` },
        { t: "text", s: "Beide Seiten sind gleich, der Induktionsanfang gilt." },
      ],
    }),
  };
}

function sumK2k() {
  const two = new Fr(2);
  const fv = (k) => two.pow(k - 1).mul(k);
  const R = (n) => two.pow(n).mul(n - 1).add(1);
  const An = T`\sum_{k=1}^{n} k\cdot 2^{k-1} = (n-1)\cdot 2^{n} + 1`;
  const An1 = T`\sum_{k=1}^{n+1} k\cdot 2^{k-1} = \bigl((n+1)-1\bigr)\cdot 2^{n+1} + 1 = n\cdot 2^{n+1}+1`;
  const vv = (n) => R(n + 1);
  const n0 = 1;
  return {
    n0, claim: An, holds: (n) => sum(1, n, fv).eq(R(n)),
    hints: hints(n0, An1, T`Nach dem Einsetzen steht $2^{n}$ in beiden Summanden: ausklammern. Danach $2\cdot 2^{n}=2^{n+1}$.`),
    blocks: blocks({
      n0, dom: T`n\in${NN}`, An, An1,
      chain: {
        start: T`\sum_{k=1}^{n+1} k\cdot 2^{k-1}`, v0: (n) => sum(1, n + 1, fv),
        lines: [
          L("=", T`\left(\sum_{k=1}^{n} k\cdot 2^{k-1}\right) + (n+1)\cdot 2^{(n+1)-1}`, "Letzten Summanden abspalten.", vv),
          L("=", T`(n-1)\cdot 2^{n} + 1 + (n+1)\cdot 2^{n}`, "Induktionsannahme einsetzen, $(n+1)-1=n$.", vv),
          L("=", T`\bigl((n-1)+(n+1)\bigr)\cdot 2^{n} + 1`, "$2^{n}$ ausklammern.", vv),
          L("=", T`2n\cdot 2^{n} + 1`, "Zusammenfassen: $(n-1)+(n+1)=2n$.", vv),
          L("=", T`n\cdot 2^{n+1} + 1`, "$2\cdot 2^{n}=2^{n+1}$. Das ist die rechte Seite für $n+1$.", vv),
        ],
      },
      anfang: [
        { t: "text", s: "Startwert $n_0=1$." },
        { t: "eq", tex: T`\sum_{k=1}^{1} k\cdot 2^{k-1} = 1\cdot 2^{0} = 1` },
        { t: "eq", tex: T`(1-1)\cdot 2^{1}+1 = 1` },
        { t: "text", s: "Beide Seiten sind gleich, der Induktionsanfang gilt." },
      ],
    }),
  };
}

// ---------- Ungleichungen ----------
const RELS = { ">": { sym: ">", no: T`\ngtr`, ok: (c) => c > 0 }, ge: { sym: T`\ge`, no: T`\ngeq`, ok: (c) => c >= 0 }, "<": { sym: "<", no: T`\nless`, ok: (c) => c < 0 }, le: { sym: T`\le`, no: T`\nleq`, ok: (c) => c <= 0 } };
const relOk = { "=": (c) => c === 0, "<": (c) => c < 0, ">": (c) => c > 0, [T`\le`]: (c) => c <= 0, [T`\ge`]: (c) => c >= 0 };
export { relOk };
// kleinstes n0 >= 1, ab dem `holds` für alle weiteren n gilt (Scan bis 80)
const firstGood = (holds) => { let last = 0; for (let n = 1; n <= 80; n++) if (!holds(n)) last = n; return last + 1; };

function ineqAnfang({ n0, find, rel, lt, rt, lv, rv }) {
  const R = RELS[rel];
  const row = (m) => ({ t: "eq", tex: T`${lt(m)} = ${lv(m)} \;${R.ok(lv(m).cmp(rv(m))) ? R.sym : R.no}\; ${rt(m)} = ${rv(m)}` });
  const num = (f) => (m) => f(m).toString();
  const wrap = (m) => ({ lt: lt(m), lv: num(lv)(m), rt: rt(m), rv: num(rv)(m), ok: R.ok(lv(m).cmp(rv(m))) });
  const show = (m) => { const w = wrap(m); return { t: "eq", tex: T`${w.lt} = ${w.lv} \;${w.ok ? R.sym : R.no}\; ${w.rt} = ${w.rv}` }; };
  void row;
  const items = [];
  if (find) {
    items.push({ t: "text", s: `Wertetabelle: wir probieren von klein nach groß, bis die Aussage stimmt (und danach stimmen bleibt, das zeigt der Induktionsschritt).` });
    for (let m = Math.max(1, n0 - 2); m <= n0; m++) items.push(show(m));
    items.push({ t: "text", s: `Für $n=${n0}$ gilt die Aussage zum ersten Mal, also $n_0=${n0}$.` });
  } else {
    items.push({ t: "text", s: `Startwert $n_0=${n0}$.` }, show(n0), { t: "text", s: "Die Aussage ist wahr, der Induktionsanfang gilt." });
  }
  return items;
}
const ineqLead = (find, dom) => (find ? "Ab welchem $n_0$ gilt die Ungleichung für alle $n\\ge n_0$? Bestimme das kleinste $n_0$ und beweise die Aussage durch vollständige Induktion:" : `Beweise durch vollständige Induktion: Für alle $${dom}$ gilt`);

function ineqQuad(r) {
  const a = r.int(2, 7), b = r.int(1, 12), strict = r.chance(0.4), find = r.chance(0.3);
  const rel = strict ? ">" : "ge", S = RELS[rel].sym;
  const ok = (n) => (strict ? n * n > a * n + b : n * n >= a * n + b);
  const n0 = firstGood(ok), dom = find ? T`n\ge n_0` : domTex(r, n0);
  const lin = polyTex([b, a]);
  const An = T`n^{2} ${S} ${lin}`, An1 = T`(n+1)^{2} ${S} ${a}(n+1)+${b}`;
  const rest = 2 * n0 + 1 - a;
  const v = (f) => (n) => new Fr(f(n));
  return {
    n0, lead: ineqLead(find, dom), claim: An, holds: ok,
    hints: hints(n0, An1, T`Binomische Formel: $(n+1)^2=n^2+2n+1$. Dann die Induktionsannahme für $n^2$ einsetzen und den Rest $2n+1-${a}$ abschätzen.`),
    blocks: blocks({
      n0, dom, An, An1,
      anfang: ineqAnfang({ n0, find, rel, lt: (m) => `${m}^{2}`, rt: (m) => polyTex([b, a], String(m)).replace(/(\d)(\d)(?!.*\d)/, "$1$2"), lv: (m) => new Fr(m * m), rv: (m) => new Fr(a * m + b) }),
      chain: {
        start: "(n+1)^{2}", v0: v((n) => (n + 1) ** 2),
        lines: [
          L("=", "n^{2}+2n+1", "Binomische Formel.", v((n) => (n + 1) ** 2)),
          L(rel === ">" ? ">" : T`\ge`, T`(${lin})+2n+1`, "Induktionsannahme: $n^2$ durch die kleinere Seite ersetzen.", v((n) => a * n + b + 2 * n + 1)),
          L("=", T`${a}(n+1)+${b}+(2n+1-${a})`, `Umschreiben, damit das Ziel $${a}(n+1)+${b}$ sichtbar wird. Es bleibt der Rest $2n+1-${a}$.`, v((n) => a * n + b + 2 * n + 1)),
          L(T`\ge`, T`${a}(n+1)+${b}`, `Der Rest ist nicht negativ: wegen $n\\ge ${n0}$ ist $2n+1-${a}\\ge ${rest}\\ge 0$.`, v((n) => a * (n + 1) + b)),
        ],
      },
    }),
  };
}

function ineqExpLin(r) {
  const c = r.pick([2, 2, 3]), a = r.int(1, 8), b = r.chance(0.3) ? 0 : r.int(1, 10), strict = r.chance(0.5), find = r.chance(0.3);
  const rel = strict ? ">" : "ge", S = RELS[rel].sym;
  const big = (n) => BigInt(c) ** BigInt(n);
  const ok = (n) => (strict ? big(n) > BigInt(a * n + b) : big(n) >= BigInt(a * n + b));
  const n0 = firstGood(ok), dom = find ? T`n\ge n_0` : domTex(r, n0);
  const lin = polyTex([b, a]);
  const An = T`${c}^{n} ${S} ${lin}`, An1 = T`${c}^{n+1} ${S} ${a === 1 ? "(n+1)" : `${a}(n+1)`}${b ? `+${b}` : ""}`;
  const rn = (c - 1) * a, rc = (c - 1) * b - a;
  const rest = polyTex([rc, rn]);
  const target = `${a === 1 ? "(n+1)" : `${a}(n+1)`}${b ? `+${b}` : ""}`;
  const v = (f) => (n) => new Fr(f(n));
  const vv = v((n) => c ** (n + 1));
  return {
    n0, lead: ineqLead(find, dom), claim: An, holds: ok,
    hints: hints(n0, An1, T`Schreibe $${c}^{n+1}=${c}\cdot ${c}^{n}$, wende die Induktionsannahme an und forme so um, dass $${target}$ plus ein nicht negativer Rest dasteht.`),
    blocks: blocks({
      n0, dom, An, An1,
      anfang: ineqAnfang({ n0, find, rel, lt: (m) => `${c}^{${m}}`, rt: (m) => `${a}\\cdot ${m}${b ? `+${b}` : ""}`, lv: (m) => new Fr(big(m)), rv: (m) => new Fr(a * m + b) }),
      chain: {
        start: `${c}^{n+1}`, v0: vv,
        lines: [
          L("=", T`${c}\cdot ${c}^{n}`, "Potenzgesetz.", vv),
          L(rel === ">" ? ">" : T`\ge`, T`${c}\cdot (${lin})`, `Induktionsannahme, beide Seiten mit $${c}>0$ multipliziert.`, v((n) => c * (a * n + b))),
          L("=", polyTex([c * b, c * a]), "Ausmultiplizieren.", v((n) => c * (a * n + b))),
          L("=", T`(${target}) + (${rest})`, `Umschreiben: Ziel plus Rest. Rest $=(${c}-1)(${lin})-${a}$.`, v((n) => c * (a * n + b))),
          L(T`\ge`, target, `Der Rest ist nicht negativ: für $n\\ge ${n0}$ ist $${rest}\\ge ${rn * n0 + rc}\\ge 0$.`, v((n) => a * (n + 1) + b)),
        ],
      },
    }),
  };
}

function ineqExpQuad(r) {
  const a = r.int(1, 3), am = a === 1 ? "" : a;
  const ok = (n) => 2n ** BigInt(n) > BigInt(a * n * n);
  const n0 = firstGood(ok), dom = domTex(r, n0);
  const An = T`2^{n} > ${am}n^{2}`, An1 = T`2^{n+1} > ${am}(n+1)^{2}`;
  const v = (f) => (n) => new Fr(f(n));
  const vv = v((n) => 2 ** (n + 1));
  return {
    n0, claim: An, holds: ok,
    hints: hints(n0, An1, T`$2^{n+1}=2\cdot 2^n$. Nach der Induktionsannahme bleibt $2${am}n^2$. Zerlege das in ${am}n^2+${am}n^2$ und schätze eine Hälfte mit $n^2\ge 2n+1$ ab.`),
    blocks: blocks({
      n0, dom, An, An1,
      anfang: ineqAnfang({ n0, find: false, rel: ">", lt: (m) => `2^{${m}}`, rt: (m) => `${am}\\cdot ${m}^{2}`, lv: (m) => new Fr(2n ** BigInt(m)), rv: (m) => new Fr(a * m * m) }),
      chain: {
        start: "2^{n+1}", v0: vv,
        lines: [
          L("=", T`2\cdot 2^{n}`, "Potenzgesetz.", vv),
          L(">", T`2\cdot ${am}n^{2}`, "Induktionsannahme, mit $2>0$ multipliziert.", v((n) => 2 * a * n * n)),
          L("=", T`${am}n^{2}+${am}n^{2}`, "Aufspalten in zwei gleiche Teile.", v((n) => 2 * a * n * n)),
          L(T`\ge`, T`${am}n^{2}+${am}(2n+1)`, "Für $n\\ge 3$ gilt $n^2\\ge 2n+1$, denn $n^2-2n-1=(n-1)^2-2\\ge 2$. Das gilt hier, weil $n\\ge " + n0 + "$.", v((n) => a * n * n + a * (2 * n + 1))),
          L("=", T`${am}(n^{2}+2n+1)`, `${am ? "$" + am + "$" : "Den Faktor"} ausklammern.`, v((n) => a * (n + 1) ** 2)),
          L("=", T`${am}(n+1)^{2}`, "Binomische Formel. Das ist die rechte Seite für $n+1$.", v((n) => a * (n + 1) ** 2)),
        ],
      },
    }),
  };
}

function ineqFact(r) {
  const c = r.pick([2, 3, 4]);
  const ok = (n) => BigInt(c) ** BigInt(n) < fact(n).n;
  const n0 = firstGood(ok), dom = domTex(r, n0);
  const An = T`${c}^{n} < n!`, An1 = T`${c}^{n+1} < (n+1)!`;
  const v = (f) => (n) => fr(f(n));
  const vv = (n) => fact(n + 1);
  return {
    n0, claim: An, holds: ok,
    hints: hints(n0, An1, T`Starte bei der größeren Seite: $(n+1)!=(n+1)\cdot n!$. Induktionsannahme anwenden und beachten, dass $n+1\ge ${c}$.`),
    blocks: blocks({
      n0, dom, An, An1,
      anfang: ineqAnfang({ n0, find: false, rel: "<", lt: (m) => `${c}^{${m}}`, rt: (m) => `${m}!`, lv: (m) => new Fr(BigInt(c) ** BigInt(m)), rv: (m) => fact(m) }),
      chain: {
        start: "(n+1)!", v0: vv,
        lines: [
          L("=", T`(n+1)\cdot n!`, "Definition der Fakultät.", vv),
          L(">", T`(n+1)\cdot ${c}^{n}`, "Induktionsannahme $n!>" + c + "^n$, mit $n+1>0$ multipliziert.", (n) => fr(n + 1).mul(new Fr(c).pow(n))),
          L(T`\ge`, T`${c}\cdot ${c}^{n}`, `Wegen $n\\ge ${n0}$ ist $n+1\\ge ${n0 + 1}\\ge ${c}$.`, (n) => fr(c).mul(new Fr(c).pow(n))),
          L("=", `${c}^{n+1}`, "Potenzgesetz. Gelesen von links nach rechts: $(n+1)!>" + c + "^{n+1}$, das ist $A(n+1)$.", (n) => new Fr(c).pow(n + 1)),
        ],
      },
    }),
  };
}

function ineqFixed(r) {
  const which = r.pick([0, 1]);
  const v = (f) => (n) => fr(f(n));
  if (which === 0) {
    const ok = (n) => fact(n).n < BigInt(n) ** BigInt(n);
    const An = T`n! < n^{n}`, An1 = T`(n+1)! < (n+1)^{n+1}`, n0 = 2, dom = domTex(r, n0);
    return {
      n0, claim: An, holds: ok,
      hints: hints(n0, An1, T`$(n+1)!=(n+1)\cdot n!$, dann die Induktionsannahme. Für den Rest brauchst du $n^n<(n+1)^n$.`),
      blocks: blocks({
        n0, dom, An, An1,
        anfang: ineqAnfang({ n0, find: false, rel: "<", lt: (m) => `${m}!`, rt: (m) => `${m}^{${m}}`, lv: (m) => fact(m), rv: (m) => new Fr(BigInt(m) ** BigInt(m)) }),
        chain: {
          start: "(n+1)!", v0: (n) => fact(n + 1),
          lines: [
            L("=", T`(n+1)\cdot n!`, "Definition der Fakultät.", (n) => fact(n + 1)),
            L("<", T`(n+1)\cdot n^{n}`, "Induktionsannahme, mit $n+1>0$ multipliziert.", (n) => fr(n + 1).mul(new Fr(n).pow(n))),
            L("<", T`(n+1)\cdot (n+1)^{n}`, "Es ist $n<n+1$, also auch $n^{n}<(n+1)^{n}$.", (n) => fr(n + 1).mul(new Fr(n + 1).pow(n))),
            L("=", "(n+1)^{n+1}", "Potenzgesetz. Das ist die rechte Seite für $n+1$.", (n) => new Fr(n + 1).pow(n + 1)),
          ],
        },
      }),
    };
  }
  const ok = (n) => 2n ** BigInt(n - 1) <= fact(n).n;
  const An = T`2^{n-1} \le n!`, An1 = T`2^{(n+1)-1} \le (n+1)!`, n0 = 1, dom = domTex(r, n0);
  return {
    n0, claim: An, holds: ok,
    hints: hints(n0, An1, T`Es ist $2^{(n+1)-1}=2^{n}=2\cdot 2^{n-1}$. Induktionsannahme anwenden und $2\le n+1$ benutzen.`),
    blocks: blocks({
      n0, dom, An, An1,
      anfang: ineqAnfang({ n0, find: false, rel: "le", lt: (m) => `2^{${m}-1}`, rt: (m) => `${m}!`, lv: (m) => new Fr(2n ** BigInt(m - 1)), rv: (m) => fact(m) }),
      chain: {
        start: "2^{(n+1)-1}", v0: (n) => new Fr(2).pow(n),
        lines: [
          L("=", T`2\cdot 2^{n-1}`, "$(n+1)-1=n$ und $2^{n}=2\\cdot 2^{n-1}$.", (n) => new Fr(2).pow(n)),
          L(T`\le`, T`2\cdot n!`, "Induktionsannahme, mit $2>0$ multipliziert.", (n) => fr(2).mul(fact(n))),
          L(T`\le`, T`(n+1)\cdot n!`, "Wegen $n\\ge 1$ ist $2\\le n+1$.", (n) => fr(n + 1).mul(fact(n))),
          L("=", "(n+1)!", "Definition der Fakultät. Das ist die rechte Seite für $n+1$.", (n) => fact(n + 1)),
        ],
      },
    }),
  };
}

function ineqBern(r) {
  const x = r.pick(["x", "h", "a"]);
  const X = new Fr(3, 7);
  const An = T`(1+${x})^{n} > 1+n${x}`, An1 = T`(1+${x})^{n+1} > 1+(n+1)${x}`, n0 = 2;
  const v = (f) => (n) => fr(f(n));
  const g = (n) => new Fr(1).add(X).pow(n);
  return {
    n0, lead: `Beweise durch vollständige Induktion: Für alle $n\\ge 2$ und alle reellen $${x}>0$ gilt`, claim: An,
    holds: (n) => g(n).cmp(new Fr(1).add(X.mul(n))) > 0,
    hints: hints(n0, An1, T`Schreibe $(1+${x})^{n+1}=(1+${x})^{n}(1+${x})$ und multipliziere die Induktionsannahme mit $1+${x}>0$. Der Rest ist $n${x}^2>0$.`),
    blocks: blocks({
      n0, dom: T`n\ge 2`, An, An1,
      annahme: `Die Aussage gelte für ein festes $n\\ge 2$ (und das feste $${x}>0$):`,
      anfang: [
        { t: "text", s: "Startwert $n_0=2$." },
        { t: "eq", tex: T`(1+${x})^{2} = 1+2${x}+${x}^{2} > 1+2${x}` },
        { t: "text", s: `Das gilt, weil $${x}>0$ und damit $${x}^{2}>0$ ist. Der Induktionsanfang gilt.` },
      ],
      chain: {
        start: T`(1+${x})^{n+1}`, v0: (n) => g(n + 1),
        lines: [
          L("=", T`(1+${x})^{n}\cdot (1+${x})`, "Potenzgesetz.", (n) => g(n + 1)),
          L(">", T`(1+n${x})(1+${x})`, `Induktionsannahme, mit $1+${x}>0$ multipliziert (das Ungleichheitszeichen bleibt).`, (n) => new Fr(1).add(X.mul(n)).mul(new Fr(1).add(X))),
          L("=", T`1+${x}+n${x}+n${x}^{2}`, "Ausmultiplizieren.", (n) => new Fr(1).add(X.mul(n)).mul(new Fr(1).add(X))),
          L("=", T`1+(n+1)${x}+n${x}^{2}`, `$${x}+n${x}=(n+1)${x}$.`, (n) => new Fr(1).add(X.mul(n)).mul(new Fr(1).add(X))),
          L(">", T`1+(n+1)${x}`, `Der Rest $n${x}^{2}$ ist positiv, da $n\\ge 2$ und $${x}>0$.`, (n) => new Fr(1).add(X.mul(n + 1))),
        ],
      },
    }),
  };
}

// ---------- Teilbarkeit ----------
const divDefs = (d) => ({ t: "text", s: `Teilbar heißt: $X = ${d}\\cdot m$ mit einer ganzen Zahl $m\\in\\mathbb{Z}$.` });

function divPow(r) {
  const d = r.int(2, 9), b = r.chance(0.35) ? 1 : r.int(1, 9), a = b + d;
  const bn = b === 1 ? "1" : `${b}^{n}`, bn1 = b === 1 ? "1" : `${b}^{n+1}`;
  const X = T`${a}^{n}-${bn}`;
  const mOf = (n) => new Fr(BigInt(a) ** BigInt(n) - BigInt(b) ** BigInt(n)).div(d);
  const A = new Fr(a), B = new Fr(b), D = new Fr(d);
  const vv = (n) => A.pow(n + 1).sub(B.pow(n + 1));
  const t1 = b === 1 ? `${a}` : T`${a}\cdot ${bn}`, t2 = b === 1 ? "1" : T`${b}\cdot ${bn}`;
  const n0 = 1;
  return {
    n0, lead: `Zeige: Für alle $n\\in${NN}$ ist`, claim: X, tail: `durch $${d}$ teilbar.`,
    holds: (n) => mOf(n).isInt,
    hints: hints(n0, T`${a}^{n+1}-${bn1} = ${d}\,m'\ \text{ mit } m'\in\mathbb{Z}`, T`Stelle die Induktionsannahme nach $${a}^{n}$ um: $${a}^{n}=${d}m+${bn}$. Setze das in $${a}^{n+1}=${a}\cdot ${a}^{n}$ ein.`),
    blocks: blocks({
      n0, dom: T`n\in${NN}`, An: T`${X} = ${d}\,m \quad (m\in\mathbb{Z}),\ \text{also}\ ${a}^{n} = ${d}m+${bn}`,
      An1: T`${a}^{n+1}-${bn1} = ${d}\,m' \quad\text{für ein } m'\in\mathbb{Z}`,
      annahme: `Für ein festes $n\\ge 1$ sei $${X.replace(/\\/g, "\\")}$ durch $${d}$ teilbar, also:`,
      chain: {
        start: T`${a}^{n+1}-${bn1}`, v0: vv,
        lines: [
          L("=", T`${a}\cdot ${a}^{n}-${bn1}`, "Potenzgesetz $a^{n+1}=a\\cdot a^{n}$.", vv),
          L("=", T`${a}\,(${d}m+${bn})-${bn1}`, `Induktionsannahme: $${a}^{n}$ ersetzen durch $${d}m+${bn}$.`, (n) => A.mul(D.mul(mOf(n)).add(B.pow(n))).sub(B.pow(n + 1))),
          L("=", T`${a * d}m+${t1}-${t2}`, `Ausmultiplizieren.${b === 1 ? "" : " Dabei ist $" + b + "^{n+1}=" + b + "\\cdot " + b + "^{n}$."}`, (n) => A.mul(D).mul(mOf(n)).add(A.mul(B.pow(n))).sub(B.mul(B.pow(n)))),
          L("=", T`${a * d}m+${d}${b === 1 ? "" : T`\cdot ${bn}`}`, `Zusammenfassen: $${a}-${b}=${d}$.`, (n) => A.mul(D).mul(mOf(n)).add(D.mul(B.pow(n)))),
          L("=", T`${d}\,\bigl(${a}m+${bn}\bigr)`, `$${d}$ ausklammern.`, (n) => D.mul(A.mul(mOf(n)).add(B.pow(n)))),
        ],
      },
      afterStep: [{ t: "text", s: `Mit $m'=${a}m+${bn}\\in\\mathbb{Z}$ ist $${a}^{n+1}-${bn1}=${d}m'$ durch $${d}$ teilbar.` }],
      anfang: [
        { t: "text", s: "Startwert $n_0=1$." },
        { t: "eq", tex: T`${a}^{1}-${b === 1 ? "1" : `${b}^{1}`} = ${d} = ${d}\cdot 1` },
        { t: "text", s: `Das ist durch $${d}$ teilbar, der Induktionsanfang gilt.` },
      ],
    }),
  };
}

function divShift(r) {
  const d = r.int(3, 9), t = r.int(1, 2), s = r.int(1, 2), a = 1 + d * t, c = d * s - 1;
  const A = new Fr(a), C = new Fr(c), D = new Fr(d);
  const mOf = (n) => A.pow(n).add(C).div(d);
  const vv = (n) => A.pow(n + 1).add(C);
  const X = T`${a}^{n}+${c}`;
  const n0 = 1;
  return {
    n0, lead: `Zeige: Für alle $n\\in${NN}$ ist`, claim: X, tail: `durch $${d}$ teilbar.`,
    holds: (n) => mOf(n).isInt,
    hints: hints(n0, T`${a}^{n+1}+${c} = ${d}\,m' \ \text{ mit } m'\in\mathbb{Z}`, T`Aus der Induktionsannahme folgt $${a}^{n}=${d}m-${c}$. Setze das in $${a}^{n+1}=${a}\cdot ${a}^{n}$ ein und klammere $${d}$ aus (beachte $${a}-1=${d}\cdot ${t}$).`),
    blocks: blocks({
      n0, dom: T`n\in${NN}`, An: T`${X} = ${d}\,m\quad (m\in\mathbb{Z}),\ \text{also}\ ${a}^{n} = ${d}m-${c}`,
      An1: T`${a}^{n+1}+${c} = ${d}\,m' \quad\text{für ein } m'\in\mathbb{Z}`,
      annahme: `Für ein festes $n\\ge 1$ sei $${X}$ durch $${d}$ teilbar, also:`,
      chain: {
        start: T`${a}^{n+1}+${c}`, v0: vv,
        lines: [
          L("=", T`${a}\cdot ${a}^{n}+${c}`, "Potenzgesetz.", vv),
          L("=", T`${a}\,(${d}m-${c})+${c}`, `Induktionsannahme: $${a}^{n}$ ersetzen durch $${d}m-${c}$.`, (n) => A.mul(D.mul(mOf(n)).sub(C)).add(C)),
          L("=", T`${a * d}m-${a * c}+${c}`, "Ausmultiplizieren.", vv),
          L("=", T`${a * d}m-${c * (a - 1)}`, `Zusammenfassen: $-${a * c}+${c}=-${c}(${a}-1)=-${c * (a - 1)}$.`, vv),
          L("=", T`${d}\,\bigl(${a}m-${c * t}\bigr)`, `$${d}$ ausklammern. Es ist $${c * (a - 1)}=${d}\\cdot ${c * t}$, weil $${a}-1=${d}\\cdot ${t}$.`, vv),
        ],
      },
      afterStep: [{ t: "text", s: `Mit $m'=${a}m-${c * t}\\in\\mathbb{Z}$ ist $${a}^{n+1}+${c}=${d}m'$ durch $${d}$ teilbar.` }],
      anfang: [
        { t: "text", s: "Startwert $n_0=1$." },
        { t: "eq", tex: T`${a}^{1}+${c} = ${a + c} = ${d}\cdot ${t + s}` },
        { t: "text", s: `Das ist durch $${d}$ teilbar, der Induktionsanfang gilt.` },
      ],
    }),
  };
}

function divCubic(r) {
  const p = r.pick([3, 3, 5, 7]), t = r.int(0, 2), c = p * t - 1;
  const g = Array.from({ length: p + 1 }, (_, i) => binom(p, i)); // (n+1)^p: Koeffizient von n^i
  const X = polyTex([0, c, ...Array(p - 2).fill(0), 1]);
  const mOf = (n) => new Fr(n ** p + c * n).div(p);
  const vv = (n) => new Fr((n + 1) ** p + c * (n + 1));
  const midInts = [0, ...g.slice(1, p)];
  const Q = [0, ...g.slice(1, p).map((x) => x / p)];
  const cTerm = (s) => (c < 0 ? `-${c === -1 ? "" : -c}${s}` : `+${c}${s}`);
  const n0 = 1;
  const P = new Fr(p);
  const mid = polyTex(midInts), Qt = polyTex(Q);
  const ev = (n) => (t === 0 ? mOf(n).mul(P).add(P.mul(new Fr(Q.reduce((s, x, i) => s + x * n ** i, 0)))) : vv(n));
  return {
    n0, lead: `Zeige: Für alle $n\\in${NN}$ ist`, claim: X, tail: `durch $${p}$ teilbar.`,
    holds: (n) => mOf(n).isInt,
    hints: hints(n0, T`(n+1)^{${p}}${cTerm("(n+1)")} = ${p}\,m' \ \text{ mit } m'\in\mathbb{Z}`, T`Multipliziere $(n+1)^{${p}}$ mit dem Binomischen Lehrsatz aus. Alle Binomialkoeffizienten $\binom{${p}}{j}$ mit $0<j<${p}$ sind durch $${p}$ teilbar.`),
    blocks: blocks({
      n0, dom: T`n\in${NN}`, An: T`${X} = ${p}\,m \quad (m\in\mathbb{Z})`,
      An1: T`(n+1)^{${p}}${cTerm("(n+1)")} = ${p}\,m' \quad\text{für ein } m'\in\mathbb{Z}`,
      annahme: `Für ein festes $n\\ge 1$ sei $${X}$ durch $${p}$ teilbar, also:`,
      chain: {
        start: T`(n+1)^{${p}}${cTerm("(n+1)")}`, v0: vv,
        lines: [
          L("=", T`${polyTex(g)}${cTerm("(n+1)")}`, `Binomischer Lehrsatz: $(n+1)^{${p}}=\\sum_{j=0}^{${p}}\\binom{${p}}{j}n^{j}$.`, vv),
          L("=", T`\bigl(${X}\bigr)+\bigl(${mid}\bigr)+${1 + c}`, `Umsortieren: Der Term $${X}$ taucht auf, der Rest wird gesammelt. Konstanten: $1${c < 0 ? "-" + -c : "+" + c}=${1 + c}$.`, vv),
          L("=", T`${p}m+${p}\bigl(${Qt}\bigr)${t ? `+${p}\\cdot ${t}` : ""}`, `Induktionsannahme für die erste Klammer. In der zweiten Klammer ist jeder Koeffizient durch $${p}$ teilbar, wir ziehen $${p}$ heraus.${t ? ` Außerdem $${1 + c}=${p}\\cdot ${t}$.` : ""}`, ev),
          L("=", T`${p}\,\bigl(m+${Qt}${t ? `+${t}` : ""}\bigr)`, `$${p}$ ausklammern.`, ev),
        ],
      },
      afterStep: [{ t: "text", s: `Mit $m'=m+${Qt}${t ? `+${t}` : ""}\\in\\mathbb{Z}$ ist der Term durch $${p}$ teilbar.` }],
      anfang: [
        { t: "text", s: "Startwert $n_0=1$." },
        { t: "eq", tex: T`1^{${p}}${cTerm("\\cdot 1")} = ${1 + c} = ${p}\cdot ${t}` },
        { t: "text", s: `Das ist durch $${p}$ teilbar${t === 0 ? " ($0=" + p + "\\cdot 0$)" : ""}, der Induktionsanfang gilt.` },
      ],
    }),
  };
}

function divProd(r) {
  const n0 = 1;
  if (r.chance(0.5)) {
    const R = (n) => new Fr(n * (n + 1) * (n + 2)).div(6);
    const vv = (n) => new Fr((n + 1) * (n + 2) * (n + 3));
    const rOf = (n) => new Fr((n + 1) * (n + 2)).div(2);
    return {
      n0, lead: `Zeige: Für alle $n\\in${NN}$ ist`, claim: "n(n+1)(n+2)", tail: "durch $6$ teilbar.",
      holds: (n) => R(n).isInt,
      hints: hints(n0, T`(n+1)(n+2)(n+3) = 6\,m' \ \text{ mit } m'\in\mathbb{Z}`, T`Schreibe $(n+1)(n+2)(n+3)=(n+1)(n+2)\cdot n+(n+1)(n+2)\cdot 3$. Der erste Teil ist die Induktionsannahme. Für den zweiten: das Produkt zweier aufeinanderfolgender Zahlen ist gerade.`),
      blocks: blocks({
        n0, dom: T`n\in${NN}`, An: T`n(n+1)(n+2) = 6\,m \quad (m\in\mathbb{Z})`, An1: T`(n+1)(n+2)(n+3) = 6\,m' \quad\text{für ein } m'\in\mathbb{Z}`,
        annahme: "Für ein festes $n\\ge 1$ sei $n(n+1)(n+2)$ durch $6$ teilbar, also:",
        chain: {
          start: "(n+1)(n+2)(n+3)", v0: vv,
          lines: [
            L("=", T`n(n+1)(n+2)+3(n+1)(n+2)`, "$(n+3)=n+3$: den Faktor $(n+1)(n+2)$ einmal mit $n$ und einmal mit $3$ multiplizieren.", vv),
            L("=", T`6m+3(n+1)(n+2)`, "Induktionsannahme einsetzen.", (n) => R(n).mul(6).add(new Fr(3 * (n + 1) * (n + 2)))),
            L("=", T`6m+3\cdot 2r`, "$(n+1)(n+2)$ ist ein Produkt zweier aufeinanderfolgender ganzer Zahlen, also gerade: $(n+1)(n+2)=2r$ mit $r\\in\\mathbb{Z}$.", (n) => R(n).mul(6).add(rOf(n).mul(6))),
            L("=", T`6\,(m+r)`, "$6$ ausklammern.", (n) => R(n).mul(6).add(rOf(n).mul(6))),
          ],
        },
        afterStep: [{ t: "text", s: "Mit $m'=m+r\\in\\mathbb{Z}$ ist der Term durch $6$ teilbar." }],
        anfang: [{ t: "text", s: "Startwert $n_0=1$." }, { t: "eq", tex: T`1\cdot 2\cdot 3 = 6 = 6\cdot 1` }, { t: "text", s: "Das ist durch $6$ teilbar, der Induktionsanfang gilt." }],
      }),
    };
  }
  const R = (n) => new Fr(n * (n + 1) * (2 * n + 1)).div(6);
  const vv = (n) => new Fr((n + 1) * (n + 2) * (2 * n + 3));
  return {
    n0, lead: `Zeige: Für alle $n\\in${NN}$ ist`, claim: "n(n+1)(2n+1)", tail: "durch $6$ teilbar.",
    holds: (n) => R(n).isInt,
    hints: hints(n0, T`(n+1)(n+2)(2n+3) = 6\,m' \ \text{ mit } m'\in\mathbb{Z}`, T`Bilde die Differenz $(n+1)(n+2)(2n+3)-n(n+1)(2n+1)$: $(n+1)$ ausklammern, in der eckigen Klammer bleibt $6n+6$.`),
    blocks: blocks({
      n0, dom: T`n\in${NN}`, An: T`n(n+1)(2n+1) = 6\,m \quad (m\in\mathbb{Z})`, An1: T`(n+1)(n+2)(2n+3) = 6\,m' \quad\text{für ein } m'\in\mathbb{Z}`,
      annahme: "Für ein festes $n\\ge 1$ sei $n(n+1)(2n+1)$ durch $6$ teilbar, also:",
      chain: {
        start: "(n+1)(n+2)(2n+3)", v0: vv,
        lines: [
          L("=", T`n(n+1)(2n+1)+6(n+1)^{2}`, "Wo wollen wir hin? Wir suchen den Term der Induktionsannahme. Probe: $(n+1)\\bigl[(n+2)(2n+3)-n(2n+1)\\bigr]=(n+1)(6n+6)=6(n+1)^2$.", vv),
          L("=", T`6m+6(n+1)^{2}`, "Induktionsannahme einsetzen.", vv),
          L("=", T`6\,\bigl(m+(n+1)^{2}\bigr)`, "$6$ ausklammern.", vv),
        ],
      },
      afterStep: [{ t: "text", s: "Mit $m'=m+(n+1)^2\\in\\mathbb{Z}$ ist der Term durch $6$ teilbar." }],
      anfang: [{ t: "text", s: "Startwert $n_0=1$." }, { t: "eq", tex: T`1\cdot 2\cdot 3 = 6 = 6\cdot 1` }, { t: "text", s: "Das ist durch $6$ teilbar, der Induktionsanfang gilt." }],
    }),
  };
}

// ---------- Produkte ----------
function prodPow(r) {
  const c = r.pick([2, 2, 3]), e = r.int(1, 4), B = c ** e;
  const E = (sh) => { const A = sh ? "(n+1)" : "n", Bq = sh ? "(n+2)" : "(n+1)"; return e === 1 ? T`\frac{${A}${Bq}}{2}` : e === 3 ? T`\frac{3${A}${Bq}}{2}` : `${e / 2 === 1 ? "" : e / 2}${A}${Bq}`; };
  const expo = (n) => (e * n * (n + 1)) / 2;
  const C = new Fr(c);
  const An = T`\prod_{k=1}^{n} ${B}^{k} = ${c}^{${E(0)}}`, An1 = T`\prod_{k=1}^{n+1} ${B}^{k} = ${c}^{${E(1)}}`;
  const vv = (n) => C.pow(expo(n + 1));
  const ex1 = e === 1 ? "(n+1)" : `${e}(n+1)`;
  const n0 = 1;
  return {
    n0, claim: An, holds: (n) => prod(1, n, (k) => new Fr(B).pow(k)).eq(C.pow(expo(n))),
    hints: hints(n0, An1, T`Letzten Faktor $${B}^{n+1}$ abspalten. Schreibe ${B} als $${c}^{${e}}$ und fasse die Exponenten zusammen.`),
    blocks: blocks({
      n0, dom: T`n\in${NN}`, An, An1,
      chain: {
        start: T`\prod_{k=1}^{n+1} ${B}^{k}`, v0: (n) => prod(1, n + 1, (k) => new Fr(B).pow(k)),
        lines: [
          L("=", T`\left(\prod_{k=1}^{n} ${B}^{k}\right)\cdot ${B}^{n+1}`, "Letzten Faktor abspalten.", vv),
          L("=", T`${c}^{${E(0)}}\cdot ${B}^{n+1}`, "Induktionsannahme einsetzen.", vv),
          ...(e === 1 ? [] : [L("=", T`${c}^{${E(0)}}\cdot (${c}^{${e}})^{n+1}`, `${B} als Potenz von ${c} schreiben: $${B}=${c}^{${e}}$.`, vv)]),
          L("=", T`${c}^{${E(0)}}\cdot ${c}^{${ex1}}`, "Potenzgesetz $(a^x)^y=a^{xy}$.", vv),
          L("=", T`${c}^{${E(0)}+${ex1}}`, "Potenzgesetz $a^x\\cdot a^y=a^{x+y}$.", vv),
          L("=", T`${c}^{${E(1)}}`, `Exponenten: ${"$"}${E(0)}+${ex1}$ auf den Hauptnenner bringen und $(n+1)$ ausklammern ergibt $${E(1)}$. Das ist die rechte Seite für $n+1$.`, vv),
        ],
      },
      anfang: [
        { t: "text", s: "Startwert $n_0=1$." },
        { t: "eq", tex: T`\prod_{k=1}^{1} ${B}^{k} = ${B}^{1} = ${B}` },
        { t: "eq", tex: T`${c}^{${E(0).replace(/n/g, "1")}} = ${c}^{${e}} = ${B}` },
        { t: "text", s: "Beide Seiten sind gleich, der Induktionsanfang gilt." },
      ],
    }),
  };
}

function prodFrac(r) {
  const pick = r.pick([1, 2, 3, 4]);
  if (pick <= 3) {
    const c = pick;
    const Rn = (sh) => { const fs = Array.from({ length: c }, (_, j) => `(n+${j + 1 + sh})`); return c === 1 ? `n+${1 + sh}` : T`\frac{${fs.join("")}}{${[1, 2, 6][c - 1]}}`; };
    const Rv = (n) => { let x = new Fr(1); for (let j = 1; j <= c; j++) x = x.mul(n + j); return x.div([1, 2, 6][c - 1]); };
    const f = (k) => T`\left(1+\frac{${c === 1 ? "" : c}}{${k}}\right)`;
    const An = T`\prod_{k=1}^{n} ${f("k")} = ${Rn(0)}`, An1 = T`\prod_{k=1}^{n+1} ${f("k")} = ${Rn(1)}`;
    const vv = (n) => Rv(n + 1);
    const n0 = 1;
    const at1 = c === 1 ? "2" : T`\frac{${Array.from({ length: c }, (_, j) => j + 2).join("\\cdot ")}}{${[1, 2, 6][c - 1]}}`;
    return {
      n0, claim: An, holds: (n) => prod(1, n, (k) => new Fr(k + c, k)).eq(Rv(n)),
      hints: hints(n0, An1, T`Letzten Faktor abspalten, Induktionsannahme einsetzen, $1+\frac{${c}}{n+1}$ zu einem Bruch machen. Dann kürzt sich der Faktor $(n+1)$.`),
      blocks: blocks({
        n0, dom: T`n\in${NN}`, An, An1,
        chain: {
          start: T`\prod_{k=1}^{n+1} ${f("k")}`, v0: (n) => prod(1, n + 1, (k) => new Fr(k + c, k)),
          lines: [
            L("=", T`\left(\prod_{k=1}^{n} ${f("k")}\right)\cdot ${f("(n+1)")}`, "Letzten Faktor abspalten.", vv),
            L("=", T`${Rn(0)}\cdot ${f("(n+1)")}`, "Induktionsannahme einsetzen.", vv),
            L("=", T`${Rn(0)}\cdot \frac{n+${c + 1}}{n+1}`, `Auf einen Bruch bringen: $1+\\frac{${c}}{n+1}=\\frac{n+1+${c}}{n+1}$.`, vv),
            L("=", Rn(1), `Der Faktor $(n+1)$ steht im Zähler von $${Rn(0)}$ und kürzt sich. Übrig bleibt der neue Faktor $(n+${c + 1})$. Das ist die rechte Seite für $n+1$.`, vv),
          ],
        },
        anfang: [
          { t: "text", s: "Startwert $n_0=1$." },
          { t: "eq", tex: T`\prod_{k=1}^{1} ${f("k")} = 1+${c} = ${1 + c}` },
          { t: "eq", tex: T`${c === 1 ? "1+1" : at1} = ${1 + c}` },
          { t: "text", s: "Beide Seiten sind gleich, der Induktionsanfang gilt." },
        ],
      }),
    };
  }
  const n0 = 2;
  const R = (n) => new Fr(1, n);
  const An = T`\prod_{k=2}^{n} \left(1-\frac{1}{k}\right) = \frac{1}{n}`, An1 = T`\prod_{k=2}^{n+1} \left(1-\frac{1}{k}\right) = \frac{1}{n+1}`;
  const vv = (n) => R(n + 1);
  return {
    n0, claim: An, holds: (n) => prod(2, n, (k) => new Fr(k - 1, k)).eq(R(n)),
    hints: hints(n0, An1, T`Letzten Faktor abspalten; $1-\frac{1}{n+1}=\frac{n}{n+1}$. Dann kürzt sich $n$.`),
    blocks: blocks({
      n0, dom: T`n\ge 2`, An, An1,
      chain: {
        start: T`\prod_{k=2}^{n+1} \left(1-\frac{1}{k}\right)`, v0: (n) => prod(2, n + 1, (k) => new Fr(k - 1, k)),
        lines: [
          L("=", T`\left(\prod_{k=2}^{n} \left(1-\frac{1}{k}\right)\right)\cdot\left(1-\frac{1}{n+1}\right)`, "Letzten Faktor abspalten.", vv),
          L("=", T`\frac{1}{n}\cdot\left(1-\frac{1}{n+1}\right)`, "Induktionsannahme einsetzen.", vv),
          L("=", T`\frac{1}{n}\cdot\frac{n}{n+1}`, "$1-\\frac{1}{n+1}=\\frac{n+1-1}{n+1}=\\frac{n}{n+1}$.", vv),
          L("=", T`\frac{1}{n+1}`, "Mit $n$ kürzen. Das ist die rechte Seite für $n+1$.", vv),
        ],
      },
      anfang: [
        { t: "text", s: "Startwert $n_0=2$." },
        { t: "eq", tex: T`\prod_{k=2}^{2} \left(1-\frac{1}{k}\right) = 1-\frac{1}{2} = \frac{1}{2}` },
        { t: "eq", tex: T`\frac{1}{2}` },
        { t: "text", s: "Beide Seiten sind gleich, der Induktionsanfang gilt." },
      ],
    }),
  };
}

function prodTele(r) {
  const which = r.int(0, 2);
  const fr1 = (a, b) => new Fr(a, b);
  const defs = [
    { // (1 - 1/k^2) = (n+1)/(2n)
      n0: 2, lo: 2, f: (k) => T`\left(1-\frac{1}{${k}^{2}}\right)`, fv: (k) => fr1(k * k - 1, k * k), R: (n) => fr1(n + 1, 2 * n),
      Rt: "\\frac{n+1}{2n}", R1: "\\frac{(n+1)+1}{2(n+1)}", a1: [T`1-\frac{1}{4}=\frac{3}{4}`, T`\frac{2+1}{2\cdot 2}=\frac{3}{4}`],
      steps: (vv) => [
        L("=", T`\frac{n+1}{2n}\cdot\left(1-\frac{1}{(n+1)^{2}}\right)`, "Induktionsannahme einsetzen.", vv),
        L("=", T`\frac{n+1}{2n}\cdot\frac{(n+1)^{2}-1}{(n+1)^{2}}`, "Auf einen Bruch bringen.", vv),
        L("=", T`\frac{n+1}{2n}\cdot\frac{n^{2}+2n}{(n+1)^{2}}`, "Binomische Formel: $(n+1)^2-1=n^2+2n$.", vv),
        L("=", T`\frac{n+1}{2n}\cdot\frac{n(n+2)}{(n+1)^{2}}`, "$n$ ausklammern.", vv),
        L("=", T`\frac{n+2}{2(n+1)}`, "Mit $n$ und $(n+1)$ kürzen. Das ist die rechte Seite für $n+1$.", vv),
      ],
      tip: T`Nach dem Einsetzen: $1-\frac{1}{(n+1)^2}=\frac{(n+1)^2-1}{(n+1)^2}=\frac{n(n+2)}{(n+1)^2}$. Dann kürzen.`,
    },
    { // 1 + 1/(k(k+2)) = 2(n+1)/(n+2)
      n0: 1, lo: 1, f: (k) => T`\left(1+\frac{1}{${k}(${k}+2)}\right)`, fv: (k) => fr1(k * (k + 2) + 1, k * (k + 2)), R: (n) => fr1(2 * (n + 1), n + 2),
      Rt: "\\frac{2(n+1)}{n+2}", R1: "\\frac{2((n+1)+1)}{(n+1)+2}", a1: [T`1+\frac{1}{1\cdot 3}=\frac{4}{3}`, T`\frac{2\cdot 2}{3}=\frac{4}{3}`],
      steps: (vv) => [
        L("=", T`\frac{2(n+1)}{n+2}\cdot\left(1+\frac{1}{(n+1)(n+3)}\right)`, "Induktionsannahme einsetzen, $(n+1)+2=n+3$.", vv),
        L("=", T`\frac{2(n+1)}{n+2}\cdot\frac{(n+1)(n+3)+1}{(n+1)(n+3)}`, "Auf einen Bruch bringen.", vv),
        L("=", T`\frac{2(n+1)}{n+2}\cdot\frac{(n+2)^{2}}{(n+1)(n+3)}`, "Probe: $(n+1)(n+3)+1=n^2+4n+4=(n+2)^2$.", vv),
        L("=", T`\frac{2(n+2)}{n+3}`, "Mit $(n+1)$ und $(n+2)$ kürzen. Das ist die rechte Seite für $n+1$.", vv),
      ],
      tip: T`Bruch erweitern: $(n+1)(n+3)+1=(n+2)^2$ (binomische Formel). Dann kürzen.`,
    },
    { // 1 - 2/(k(k+1)) = (n+2)/(3n)
      n0: 2, lo: 2, f: (k) => T`\left(1-\frac{2}{${k}(${k}+1)}\right)`, fv: (k) => fr1(k * (k + 1) - 2, k * (k + 1)), R: (n) => fr1(n + 2, 3 * n),
      Rt: "\\frac{n+2}{3n}", R1: "\\frac{(n+1)+2}{3(n+1)}", a1: [T`1-\frac{2}{2\cdot 3}=\frac{2}{3}`, T`\frac{2+2}{3\cdot 2}=\frac{2}{3}`],
      steps: (vv) => [
        L("=", T`\frac{n+2}{3n}\cdot\left(1-\frac{2}{(n+1)(n+2)}\right)`, "Induktionsannahme einsetzen, $(n+1)+1=n+2$.", vv),
        L("=", T`\frac{n+2}{3n}\cdot\frac{(n+1)(n+2)-2}{(n+1)(n+2)}`, "Auf einen Bruch bringen.", vv),
        L("=", T`\frac{n+2}{3n}\cdot\frac{n(n+3)}{(n+1)(n+2)}`, "Probe: $(n+1)(n+2)-2=n^2+3n=n(n+3)$.", vv),
        L("=", T`\frac{n+3}{3(n+1)}`, "Mit $n$ und $(n+2)$ kürzen. Das ist die rechte Seite für $n+1$.", vv),
      ],
      tip: T`Bruch erweitern: $(n+1)(n+2)-2=n(n+3)$. Dann kürzen.`,
    },
  ][which];
  const { n0, lo, f, fv, R } = defs;
  const An = T`\prod_{k=${lo}}^{n} ${f("k")} = ${defs.Rt}`, An1 = T`\prod_{k=${lo}}^{n+1} ${f("k")} = ${defs.R1}`;
  const vv = (n) => R(n + 1);
  return {
    n0, claim: An, holds: (n) => prod(lo, n, fv).eq(R(n)),
    hints: hints(n0, An1, defs.tip),
    blocks: blocks({
      n0, dom: n0 === 1 ? T`n\in${NN}` : T`n\ge ${n0}`, An, An1,
      chain: {
        start: T`\prod_{k=${lo}}^{n+1} ${f("k")}`, v0: (n) => prod(lo, n + 1, fv),
        lines: [L("=", T`\left(\prod_{k=${lo}}^{n} ${f("k")}\right)\cdot ${f("(n+1)")}`, "Letzten Faktor abspalten.", vv), ...defs.steps(vv)],
      },
      anfang: [
        { t: "text", s: `Startwert $n_0=${n0}$.` },
        { t: "eq", tex: T`\prod_{k=${lo}}^{${n0}} ${f("k")} = ${defs.a1[0]}` },
        { t: "eq", tex: defs.a1[1] },
        { t: "text", s: "Beide Seiten sind gleich, der Induktionsanfang gilt." },
      ],
    }),
  };
}

// ---------- Stärkere Aussage ("Manchmal klappt es nicht") ----------
function strongGeo(r) {
  const c = r.int(2, 5), n0 = 1;
  const q = c - 1;
  const Cc = new Fr(c);
  const S = (n) => sum(1, n, (k) => Cc.pow(k).pow(1).mul(0).add(new Fr(1).div(Cc.pow(k))));
  const Bn = (n) => new Fr(1).sub(new Fr(1).div(Cc.pow(n))).div(q);
  const lhs = (hi) => T`\sum_{k=1}^{${hi}} \frac{1}{${c}^{k}}`;
  const G = (e) => T`\frac{1}{${q}}\left(1-\frac{1}{${c}^{${e}}}\right)`;
  const bound = T`\frac{1}{${q}}`;
  const vv = (n) => Bn(n + 1);
  const Bd = T`${lhs("n")} = ${G("n")}`, Bd1 = T`${lhs("n+1")} = ${G("n+1")}`;
  return {
    n0, lead: "Zeige durch vollständige Induktion (Vorsicht, hier hilft ein Trick):", claim: T`${lhs("n")} < ${bound}`, tail: T`für alle $n\in${NN}$.`,
    holds: (n) => S(n).cmp(new Fr(1, q)) < 0,
    hints: [
      { s: "Probiere zuerst den direkten Weg: Anfang, Annahme, Schritt. Wenn du im Schritt hängen bleibst, ist die Annahme zu schwach." },
      { s: "Wenn aus „$<$“ nichts folgt, beweise eine stärkere Aussage mit Gleichheit: Rechne die Summe für $n=1,2,3$ aus und suche die Formel.", eq: Bd },
      { s: "Beweise die Formel mit Induktion. Danach folgt die ursprüngliche Aussage direkt, weil der abgezogene Term positiv ist." },
    ],
    blocks: [
      { h: "Direkter Versuch", items: [
        { t: "text", s: T`Anfang: $n=1$: $\frac{1}{${c}} < \frac{1}{${q}}$, das stimmt. Annahme: $${lhs("n")} < ${bound}$. Im Schritt:` },
        { t: "chain", start: lhs("n+1"), v0: (n) => S(n + 1), lines: [
          L("=", T`${lhs("n")} + \frac{1}{${c}^{n+1}}`, "Letzten Summanden abspalten."),
          L("<", T`${bound} + \frac{1}{${c}^{n+1}}`, "Induktionsannahme einsetzen."),
        ] },
        { t: "text", s: T`Hier ist Schluss: Wir bräuchten $\le ${bound}$, aber $${bound}+\frac{1}{${c}^{n+1}}$ ist größer als $${bound}$. Die Induktionsannahme sagt nicht, wie weit die Summe unter $${bound}$ liegt. Die Aussage ist zu schwach, um sie direkt zu beweisen.` },
      ] },
      { h: "Stärkere Aussage", items: [
        { t: "text", s: "Wir beweisen stattdessen eine genaue Formel. Sie merkt sich den Abstand zur Schranke:" },
        { t: "eq", tex: Bd },
        { t: "text", s: T`Idee: Rechne $n=1,2,3$ aus. Die Summe ist immer $${bound}$ minus ein Rest, und der Rest ist $\frac{1}{${q}}\cdot\frac{1}{${c}^{n}}$.` },
      ] },
      { h: "Induktionsanfang", items: [
        { t: "text", s: "Für die Formel, Startwert $n_0=1$:" },
        { t: "eq", tex: T`\frac{1}{${c}^{1}} = \frac{1}{${c}} \qquad\text{und}\qquad ${G("1")} = \frac{1}{${q}}\cdot\frac{${c}-1}{${c}} = \frac{1}{${c}}` },
        { t: "text", s: "Beide Seiten sind gleich, der Induktionsanfang gilt." },
      ] },
      { h: "Induktionsannahme", items: [{ t: "text", s: "Die Formel gelte für ein festes $n\\ge 1$:" }, { t: "eq", tex: Bd }] },
      { h: "Induktionsschritt", items: [
        { t: "text", s: "Für dieses $n$ ist zu zeigen:" }, { t: "eq", tex: Bd1 },
        { t: "chain", start: lhs("n+1"), v0: (n) => S(n + 1), lines: [
          L("=", T`${lhs("n")} + \frac{1}{${c}^{n+1}}`, "Letzten Summanden abspalten.", vv),
          L("=", T`${G("n")} + \frac{1}{${c}^{n+1}}`, "Induktionsannahme einsetzen.", vv),
          L("=", T`\frac{1}{${q}}\left(1-\frac{1}{${c}^{n}}+\frac{${q}}{${c}^{n+1}}\right)`, T`$\frac{1}{${q}}$ ausklammern: $\frac{1}{${c}^{n+1}}=\frac{1}{${q}}\cdot\frac{${q}}{${c}^{n+1}}$.`, vv),
          L("=", T`\frac{1}{${q}}\left(1-\frac{${c}}{${c}^{n+1}}+\frac{${q}}{${c}^{n+1}}\right)`, T`Gleichnamig machen: $\frac{1}{${c}^{n}}=\frac{${c}}{${c}^{n+1}}$.`, vv),
          L("=", G("n+1"), T`Zusammenfassen: $-${c}+${q}=-1$. Das ist die rechte Seite für $n+1$.`, vv),
        ] },
      ] },
      { h: "Folgerung und Schluss", items: [
        { t: "text", s: "Nach dem Prinzip der vollständigen Induktion gilt die Formel für alle $n\\in\\mathbb{N}$. Daraus folgt die ursprüngliche Behauptung:" },
        { t: "eq", tex: T`${lhs("n")} = \frac{1}{${q}}\left(1-\frac{1}{${c}^{n}}\right) < \frac{1}{${q}}` },
        { t: "text", s: T`denn $\frac{1}{${c}^{n}}>0$. Beachte: Das ist ein Beweis über einen Umweg. Die Ungleichung selbst lässt sich nicht direkt mit Induktion beweisen.` },
      ] },
    ],
  };
}

function strongSq() {
  const n0 = 1;
  const S = (n) => sum(1, n, (k) => new Fr(1, k * k));
  const bound = (n) => new Fr(2).sub(new Fr(1, n));
  const Bd = T`\sum_{k=1}^{n} \frac{1}{k^{2}} \le 2-\frac{1}{n}`, Bd1 = T`\sum_{k=1}^{n+1} \frac{1}{k^{2}} \le 2-\frac{1}{n+1}`;
  return {
    n0, lead: "Zeige durch vollständige Induktion (Vorsicht, hier hilft ein Trick):", claim: T`\sum_{k=1}^{n} \frac{1}{k^{2}} < 2`, tail: T`für alle $n\in${NN}$.`,
    holds: (n) => S(n).cmp(2) < 0,
    hints: [
      { s: "Direkt klappt es nicht: nach dem Einsetzen steht $2+\\frac{1}{(n+1)^2}$ da und das ist größer als $2$." },
      { s: "Ziehe in der Aussage einen Term ab, der mit $n$ kleiner wird, zum Beispiel $\\frac{1}{n}$.", eq: Bd },
      { s: "Im Schritt brauchst du: $\\frac{1}{(n+1)^2}\\le\\frac{1}{n(n+1)}=\\frac{1}{n}-\\frac{1}{n+1}$." },
    ],
    blocks: [
      { h: "Direkter Versuch", items: [
        { t: "text", s: "Annahme: $\\sum_{k=1}^{n}\\frac{1}{k^2}<2$. Im Schritt bekommen wir:" },
        { t: "chain", start: T`\sum_{k=1}^{n+1} \frac{1}{k^{2}}`, v0: (n) => S(n + 1), lines: [
          L("=", T`\sum_{k=1}^{n} \frac{1}{k^{2}} + \frac{1}{(n+1)^{2}}`, "Letzten Summanden abspalten."),
          L("<", T`2 + \frac{1}{(n+1)^{2}}`, "Induktionsannahme einsetzen."),
        ] },
        { t: "text", s: "Das ist größer als $2$, wir kommen nicht zur Behauptung. Die Annahme ist zu schwach." },
      ] },
      { h: "Stärkere Aussage", items: [
        { t: "text", s: "Wir beweisen mehr: Die Summe bleibt sogar um $\\frac{1}{n}$ unter $2$." },
        { t: "eq", tex: Bd },
      ] },
      { h: "Induktionsanfang", items: [
        { t: "text", s: "Startwert $n_0=1$:" },
        { t: "eq", tex: T`\sum_{k=1}^{1} \frac{1}{k^{2}} = 1 \le 2-\frac{1}{1} = 1` },
        { t: "text", s: "Die Aussage ist wahr, der Induktionsanfang gilt." },
      ] },
      { h: "Induktionsannahme", items: [{ t: "text", s: "Die Aussage gelte für ein festes $n\\ge 1$:" }, { t: "eq", tex: Bd }] },
      { h: "Induktionsschritt", items: [
        { t: "text", s: "Für dieses $n$ ist zu zeigen:" }, { t: "eq", tex: Bd1 },
        { t: "chain", start: T`\sum_{k=1}^{n+1} \frac{1}{k^{2}}`, v0: (n) => S(n + 1), lines: [
          L("=", T`\sum_{k=1}^{n} \frac{1}{k^{2}} + \frac{1}{(n+1)^{2}}`, "Letzten Summanden abspalten.", (n) => S(n + 1)),
          L(T`\le`, T`2-\frac{1}{n}+\frac{1}{(n+1)^{2}}`, "Induktionsannahme.", (n) => bound(n).add(new Fr(1, (n + 1) ** 2))),
          L(T`\le`, T`2-\frac{1}{n}+\frac{1}{n(n+1)}`, "Es ist $(n+1)^2\\ge n(n+1)$, also $\\frac{1}{(n+1)^2}\\le\\frac{1}{n(n+1)}$.", (n) => bound(n).add(new Fr(1, n * (n + 1)))),
          L("=", T`2-\frac{n+1}{n(n+1)}+\frac{1}{n(n+1)}`, "Gleichnamig machen: $\\frac{1}{n}=\\frac{n+1}{n(n+1)}$.", (n) => bound(n + 1)),
          L("=", T`2-\frac{n}{n(n+1)}`, "Zusammenfassen: $-(n+1)+1=-n$.", (n) => bound(n + 1)),
          L("=", T`2-\frac{1}{n+1}`, "Mit $n$ kürzen. Das ist die rechte Seite für $n+1$.", (n) => bound(n + 1)),
        ] },
      ] },
      { h: "Folgerung und Schluss", items: [
        { t: "text", s: "Nach dem Prinzip der vollständigen Induktion gilt die stärkere Aussage für alle $n\\in\\mathbb{N}$. Daraus folgt die ursprüngliche Behauptung:" },
        { t: "eq", tex: T`\sum_{k=1}^{n} \frac{1}{k^{2}} \le 2-\frac{1}{n} < 2` },
        { t: "text", s: "denn $\\frac{1}{n}>0$." },
      ] },
    ],
  };
}

// ---------- Registry ----------
export const CATS = {
  summen: "Summen",
  ungl: "Ungleichungen",
  teil: "Teilbarkeit",
  prod: "Produkte",
  stark: "Stärkere Aussage",
};
// Themen wie in der PDF (Kapitel 2 bis 6)
export const CAT_INFO = {
  summen: { name: "Formeln mit Summen", tip: "Eine Summenformel beweisen. Trick: den letzten Summanden abspalten." },
  ungl: { name: "Ungleichungen", tip: "Eine Ungleichung ab einem Startwert beweisen. Trick: Annahme einsetzen, Rest abschätzen." },
  teil: { name: "Teilbarkeit", tip: "Zeigen, dass ein Term durch eine Zahl teilbar ist. Trick: Annahme als $d\cdot m$ schreiben." },
  prod: { name: "Formeln mit Produkten", tip: "Eine Produktformel beweisen. Trick: den letzten Faktor abspalten, dann kürzen." },
  stark: { name: "Manchmal klappt es nicht", tip: "Die Aussage ist zu schwach für Induktion. Trick: eine stärkere Aussage beweisen und folgern." },
};
const REG = [
  { key: "sum-arith", cat: "summen", lvl: 1, title: "Summenformel", fn: sumArith },
  { key: "sum-poly", cat: "summen", lvl: 2, title: "Summenformel", fn: sumPoly },
  { key: "sum-geo", cat: "summen", lvl: 2, title: "Geometrische Summe", fn: sumGeo },
  { key: "sum-tele", cat: "summen", lvl: 2, title: "Teleskopsumme", fn: sumTele },
  { key: "sum-hard", cat: "summen", lvl: 3, title: "Summenformel", fn: sumHard },
  { key: "sum-tele3", cat: "summen", lvl: 3, title: "Teleskopsumme", fn: sumTele3 },
  { key: "sum-alt", cat: "summen", lvl: 3, title: "Alternierende Summe", fn: sumAlt },
  { key: "sum-fact", cat: "summen", lvl: 3, title: "Summe mit Fakultät", fn: sumFact },
  { key: "sum-k2k", cat: "summen", lvl: 3, title: "Summe mit Potenzen", fn: sumK2k },
  { key: "ineq-quad", cat: "ungl", lvl: 1, title: "Ungleichung", fn: ineqQuad },
  { key: "ineq-explin", cat: "ungl", lvl: 2, title: "Ungleichung", fn: ineqExpLin },
  { key: "ineq-fact", cat: "ungl", lvl: 2, title: "Fakultät", fn: ineqFact },
  { key: "ineq-fixed", cat: "ungl", lvl: 2, title: "Fakultät", fn: ineqFixed },
  { key: "ineq-bern", cat: "ungl", lvl: 2, title: "Bernoulli", fn: ineqBern },
  { key: "ineq-expquad", cat: "ungl", lvl: 3, title: "Ungleichung", fn: ineqExpQuad },
  { key: "div-pow", cat: "teil", lvl: 1, title: "Teilbarkeit", fn: divPow },
  { key: "div-shift", cat: "teil", lvl: 2, title: "Teilbarkeit", fn: divShift },
  { key: "div-cubic", cat: "teil", lvl: 2, title: "Teilbarkeit", fn: divCubic },
  { key: "div-prod", cat: "teil", lvl: 3, title: "Teilbarkeit", fn: divProd },
  { key: "prod-pow", cat: "prod", lvl: 1, title: "Produktformel", fn: prodPow },
  { key: "prod-frac", cat: "prod", lvl: 2, title: "Produktformel", fn: prodFrac },
  { key: "prod-tele", cat: "prod", lvl: 3, title: "Produktformel", fn: prodTele },
  { key: "strong-geo", cat: "stark", lvl: 3, title: "Stärkere Aussage", fn: strongGeo },
  { key: "strong-sq", cat: "stark", lvl: 3, title: "Stärkere Aussage", fn: strongSq },
];
export const GENERATORS = REG;

export function makeTask(id) {
  const [key, seed] = id.split(".");
  const g = REG.find((x) => x.key === key);
  if (!g) throw new Error("Unbekannte Aufgabe");
  const t = g.fn(rng(id));
  t.dom ??= t.n0 === 1 ? T`n\in${NN}` : T`n\ge ${t.n0}`;
  t.lead ??= `Beweise durch vollständige Induktion: Für alle $n\\in${NN}$ gilt`;
  return { ...t, id, seed, key, cat: g.cat, lvl: g.lvl, title: g.title };
}

export function randomTask({ cat, lvl } = {}) {
  const pool = REG.filter((g) => (!cat || g.cat === cat) && (!lvl || g.lvl === lvl));
  const g = pool[Math.floor(Math.random() * pool.length)] ?? REG[0];
  return makeTask(`${g.key}.${newSeed()}`);
}
