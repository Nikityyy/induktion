// © 2026 Nikita Berger. Prüft alle Generatoren: Aussage wahr, Rechenkette stimmt für viele Seeds.
import { GENERATORS, makeTask, relOk } from "../app/js/gen.js";
import { fr } from "../app/js/core.js";
let n = 0, bad = 0;
const fail = (id, msg) => { bad++; console.log("FAIL", id, msg); };
for (const g of GENERATORS) {
  for (let i = 0; i < 150; i++) {
    const id = `${g.key}.t${i}x`; let t;
    try { t = makeTask(id); } catch (e) { fail(id, e.message); continue; }
    n++;
    for (let m = t.n0; m < t.n0 + 8; m++) if (!t.holds(m)) { fail(id, "holds false at " + m); break; }
    for (const b of t.blocks) for (const it of b.items) {
      if (it.t !== "chain") continue;
      const steps = [{ rel: "=", v: it.v0 }, ...it.lines];
      for (let m = t.n0; m < t.n0 + 8; m++) {
        let prev = null;
        for (const s of steps) {
          if (!s.v) continue;
          const val = fr(s.v(m));
          if (prev && !relOk[s.rel]?.(prev.cmp(val))) { fail(id, `chain n=${m} ${prev} ${s.rel} ${val} :: ${s.tex}`); break; }
          prev = val;
        }
      }
    }
  }
}
console.log(`${n} Aufgaben geprüft, ${bad} Fehler`);
process.exit(bad ? 1 : 0);
