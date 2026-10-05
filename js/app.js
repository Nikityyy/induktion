// © 2026 Nikita Berger
import { makeTask, randomTask, CATS } from "./gen.js";
import { blurText, gradualBlur, haptic, initHaptics, setHaptics } from "./fx.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const km = (tex, display = false) => (window.katex ? katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: false }) : `<code>${esc(tex)}</code>`);
const rich = (s) => s.split("$").map((p, i) => (i % 2 ? km(p) : esc(p))).join("");
// ersetzt $...$ in vorhandenem HTML-Text durch KaTeX
const mathify = (root) => {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), hit = [];
  for (let n; (n = w.nextNode()); ) if (n.nodeValue.includes("$")) hit.push(n);
  hit.forEach((n) => { const s = document.createElement("span"); s.innerHTML = rich(n.nodeValue); n.replaceWith(s); });
};
const eq = (tex) => `<div class="eq">${km(tex, true)}</div>`;

// ---------- Speicher ----------
const KEY = "induktion.v1";
const defaults = () => ({ stats: {}, wrong: [], total: 0, streak: 0, best: 0, last: "", prefs: { cat: "", lvl: 0, hap: true } });
const S = (() => { try { const d = defaults(), s = JSON.parse(localStorage.getItem(KEY)) ?? {}; return { ...d, ...s, prefs: { ...d.prefs, ...s.prefs } }; } catch { return defaults(); } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* privater Modus */ } };
setHaptics(S.prefs.hap);

const view = $("#view"), cta = $("#cta"), ctaWrap = $("#ctaWrap");
let cur = null, st = null;

// ---------- Routing ----------
function route() {
  const [, a, b] = (location.hash.slice(1) || "/").split("/");
  $$("[data-nav]").forEach((n) => n.classList.toggle("on", n.dataset.nav === (a === "lernen" ? "lernen" : a === "fortschritt" ? "fortschritt" : "ueben")));
  ctaWrap.hidden = a === "lernen" || a === "fortschritt";
  window.scrollTo(0, 0);
  if (a === "lernen") return viewLearn();
  if (a === "fortschritt") return viewProgress();
  try { cur = makeTask(a === "t" && b ? b : S.last); } catch { cur = pickNew(); }
  if (a !== "t" || b !== cur.id) history.replaceState(null, "", `#/t/${cur.id}`);
  viewTask();
}
const pickNew = () => randomTask({ cat: S.prefs.cat || undefined, lvl: S.prefs.lvl || undefined });
const go = (task) => { location.hash = `#/t/${task.id}`; };
const mount = (html) => {
  view.classList.remove("view-in");
  view.innerHTML = html;
  void view.offsetWidth;
  view.classList.add("view-in");
  $$("[data-blur]", view).forEach((el) => blurText(el));
};

// ---------- Aufgabe ----------
const item = (it) =>
  it.t === "text" ? `<p class="txt">${rich(it.s)}</p>`
  : it.t === "eq" ? eq(it.tex)
  : `<div class="chain">${eq(it.start)}${it.lines.map((l) => `<div class="ln">${eq(l.rel === "=" ? `= ${l.tex}` : `${l.rel} ${l.tex}`)}${l.note ? `<p class="note">${rich(l.note)}</p>` : ""}</div>`).join("")}</div>`;

function viewTask() {
  const t = cur;
  S.last = t.id; save();
  st = { revealed: 0, hints: 0, rated: false };
  const cats = Object.entries(CATS);
  mount(`
    <div class="filters">
      <div class="scroll-x" role="group" aria-label="Kategorie">
        <button class="chip ${S.prefs.cat ? "" : "on"}" data-cat="">Alle</button>
        ${cats.map(([k, v]) => `<button class="chip ${S.prefs.cat === k ? "on" : ""}" data-cat="${k}">${v}</button>`).join("")}
      </div>
      <div class="scroll-x" role="group" aria-label="Level">
        ${[0, 1, 2, 3].map((l) => `<button class="chip ${S.prefs.lvl === l ? "on" : ""}" data-lvl="${l}">${l ? `Level ${l}` : "Alle Level"}</button>`).join("")}
      </div>
    </div>
    <article class="tile glass">
      <div class="tile-top"><span class="kind">${CATS[t.cat]} · ${t.title}</span><span class="grow"></span>
        <span class="pips" title="Level ${t.lvl}">${[1, 2, 3].map((i) => `<i class="${i <= t.lvl ? "on" : ""}"></i>`).join("")}</span><span class="seed">#${t.seed}</span></div>
      <div class="tile-rule"></div>
      <div class="tile-body">
        <p class="lead">${rich(t.lead)}</p>
        <div class="hero-eq">${km(t.claim, true)}</div>
        ${t.tail ? `<p class="tail">${rich(t.tail)}</p>` : ""}
      </div>
    </article>
    <section class="glass panel check" aria-label="Selbsttest">
      <div class="row between">
        <label class="row" for="n0"><span class="label">Startwert</span><b>n<sub>0</sub> =</b>
          <input id="n0" class="input input-sm" inputmode="numeric" autocomplete="off" aria-describedby="n0msg" /></label>
        <button class="btn btn-sm btn-neutral" id="n0b" type="button">Prüfen</button>
      </div>
      <p class="msg" id="n0msg" role="status"></p>
      <div class="row between">
        <button class="btn btn-sm btn-ghost" id="hintb" type="button">Tipp 1 von ${t.hints.length}</button>
        <span class="chain-mini" aria-label="Fortschritt im Lösungsweg">${t.blocks.map(() => "<i></i>").join("")}</span>
      </div>
      <div id="hints"></div>
    </section>
    <section id="sol" aria-label="Lösungsweg" class="grid gap-4"></section>`);
  cta.textContent = "Lösungsweg zeigen";
  $("#n0b").onclick = checkN0;
  $("#n0").onkeydown = (e) => e.key === "Enter" && checkN0();
  $("#hintb").onclick = showHint;
  $$("[data-cat]").forEach((b) => (b.onclick = () => { S.prefs.cat = b.dataset.cat; save(); go(pickNew()); }));
  $$("[data-lvl]").forEach((b) => (b.onclick = () => { S.prefs.lvl = +b.dataset.lvl; save(); go(pickNew()); }));
}

function checkN0() {
  const input = $("#n0"), msg = $("#n0msg"), v = input.value.trim();
  if (v === "") { msg.className = "msg"; msg.textContent = "Trage deinen Startwert ein."; return; }
  const ok = +v === cur.n0;
  msg.className = `msg ${ok ? "ok" : "no"}`;
  msg.innerHTML = ok ? rich(`Richtig, $n_0=${cur.n0}$. Dort prüfst du den Induktionsanfang.`) : "Noch nicht. Probiere kleine Werte aus: ab welchem n stimmt die Aussage?";
  haptic(ok ? "success" : "error");
  if (!ok) { input.classList.add("shake"); setTimeout(() => input.classList.remove("shake"), 400); }
}

function showHint() {
  const h = cur.hints[st.hints];
  if (!h) return;
  $("#hints").insertAdjacentHTML("beforeend", `<div class="hint view-in"><p><b>Tipp ${st.hints + 1}.</b> ${rich(h.s)}</p>${h.eq ? eq(h.eq) : ""}</div>`);
  st.hints++;
  haptic("nudge");
  const b = $("#hintb");
  st.hints >= cur.hints.length ? ((b.disabled = true), (b.textContent = "Keine weiteren Tipps")) : (b.textContent = `Tipp ${st.hints + 1} von ${cur.hints.length}`);
}

function reveal() {
  const i = st.revealed, b = cur.blocks[i];
  const el = document.createElement("section");
  el.className = "step";
  el.innerHTML = `<div class="rail"><span class="dm"></span></div><div class="stepc"><h3 data-blur>${b.h}</h3>${b.items.map(item).join("")}</div>`;
  $("#sol").append(el);
  blurText($("h3", el));
  setTimeout(() => { el.classList.add("fell"); $$(".chain-mini i")[i]?.classList.add("fell"); }, 60);
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  st.revealed++;
  const last = st.revealed === cur.blocks.length;
  haptic(last ? "success" : "nudge");
  if (last) {
    $("#sol").insertAdjacentHTML("beforeend", `<div class="rate glass"><h3>Wie lief dein eigener Versuch?</h3><div class="row">
      <button class="btn btn-success" data-r="ok">Richtig</button><button class="btn btn-warning" data-r="part">Fast</button><button class="btn btn-error btn-outline" data-r="bad">Nicht geschafft</button></div><p class="msg" id="ratemsg"></p></div>`);
    $$("[data-r]").forEach((r) => (r.onclick = () => rate(r.dataset.r)));
    cta.textContent = "Nächste Aufgabe";
  } else cta.textContent = `Weiter: ${cur.blocks[st.revealed].h}`;
}

function rate(r) {
  if (st.rated) return;
  st.rated = true;
  const c = (S.stats[cur.cat] ??= { ok: 0, part: 0, bad: 0 });
  c[r]++; S.total++;
  S.streak = r === "ok" ? S.streak + 1 : 0; S.best = Math.max(S.best, S.streak);
  S.wrong = S.wrong.filter((w) => w.id !== cur.id);
  if (r !== "ok") S.wrong = [{ id: cur.id, cat: cur.cat }, ...S.wrong].slice(0, 30);
  save();
  haptic(r === "ok" ? "success" : r === "part" ? "nudge" : "error");
  $$("[data-r]").forEach((b) => (b.disabled = true));
  $("#ratemsg").textContent = r === "ok" ? `Stark. Serie: ${S.streak}.` : "Gespeichert. Die Aufgabe landet unter „Fortschritt“ zum Wiederholen.";
}

cta.onclick = () => (!cur || !st ? 0 : st.revealed < cur.blocks.length ? reveal() : go(pickNew()));

// ---------- Fortschritt ----------
function viewProgress() {
  const rows = Object.entries(CATS).map(([k, v]) => ({ k, v, ...(S.stats[k] ?? { ok: 0, part: 0, bad: 0 }) }));
  const tot = (r) => r.ok + r.part + r.bad, score = (r) => (tot(r) ? (r.ok + r.part / 2) / tot(r) : null);
  const all = rows.reduce((a, r) => a + r.ok + r.part / 2, 0), pct = S.total ? Math.round((all / S.total) * 100) : 0;
  const weak = rows.filter((r) => tot(r) >= 2).sort((a, b) => score(a) - score(b))[0];
  mount(`
    <h1 class="page" data-blur>Fortschritt</h1>
    <section class="glass panel"><div class="stats-row">
      <div><div class="stat-n">${S.total}</div><div class="label">Aufgaben</div></div>
      <div><div class="stat-n">${pct}%</div><div class="label">Trefferquote</div></div>
      <div><div class="stat-n">${S.streak}</div><div class="label">Serie (Best ${S.best})</div></div></div>
      ${weak && score(weak) < 0.8 ? `<p class="msg" style="margin-top:14px">Schwächste Kategorie: <b>${weak.v}</b>. <a class="link" href="#/" id="drill">Gezielt üben</a></p>` : ""}</section>
    <section class="glass panel"><h2 class="sec">Nach Kategorie</h2>
      ${rows.map((r) => `<div class="cat-row"><div class="row"><span>${r.v}</span><span class="label">${tot(r) ? `${r.ok} richtig · ${r.part} fast · ${r.bad} offen` : "noch nichts"}</span></div>
        <progress class="progress progress-primary" value="${Math.round((score(r) ?? 0) * 100)}" max="100"></progress></div>`).join("")}</section>
    <section class="glass panel"><h2 class="sec">Zum Wiederholen</h2>
      ${S.wrong.length ? S.wrong.map((w) => `<div class="row between" style="margin:8px 0"><span>${CATS[w.cat]} <span class="seed">#${w.id.split(".")[1]}</span></span><button class="btn btn-sm btn-neutral" data-open="${w.id}">Nochmal</button></div>`).join("") : `<p class="msg">Noch nichts offen. Was du nicht schaffst, erscheint hier.</p>`}</section>
    <section class="glass panel"><h2 class="sec">Einstellungen</h2>
      <label class="row between"><span>Haptisches Feedback</span><input type="checkbox" class="toggle toggle-primary" id="hap" ${S.prefs.hap ? "checked" : ""} /></label>
      <button class="btn btn-sm btn-ghost" id="reset" style="margin-top:12px">Fortschritt zurücksetzen</button></section>`);
  $$("[data-open]").forEach((b) => (b.onclick = () => (location.hash = `#/t/${b.dataset.open}`)));
  $("#hap").onchange = (e) => { S.prefs.hap = e.target.checked; setHaptics(S.prefs.hap); save(); haptic("success"); };
  $("#reset").onclick = () => { if (confirm("Fortschritt wirklich löschen?")) { Object.assign(S, defaults(), { prefs: S.prefs, last: S.last }); save(); viewProgress(); } };
  $("#drill")?.addEventListener("click", () => { S.prefs.cat = weak.k; save(); });
}

// ---------- Lernen ----------
function viewLearn() {
  mount(`
    <h1 class="page" data-blur>Wie Induktion funktioniert</h1>
    <section class="glass panel prose">
      <p>Stell dir unendlich viele Dominosteine vor. Du musst nicht jeden einzeln anstoßen. Es reicht zu wissen: <b>Der erste fällt</b>, und <b>wenn einer fällt, fällt auch der nächste</b>. Probiere es aus:</p>
      <div class="dominos" id="dm" aria-hidden="true">${Array.from({ length: 9 }, () => '<i class="dom"></i>').join("")}</div>
      <div class="toggles"><label><input type="checkbox" class="toggle toggle-sm toggle-primary" id="tA" checked /> Induktionsanfang</label>
        <label><input type="checkbox" class="toggle toggle-sm toggle-primary" id="tS" checked /> Induktionsschritt</label></div>
      <div class="row"><button class="btn btn-neutral btn-sm" id="push">Anstoßen</button><span class="msg" id="dmsg" role="status" style="margin:0"></span></div>
    </section>
    <section class="glass panel prose"><h2 class="sec">Die vier Teile</h2>
      <ol class="steps-l">
        <li><div><b>Induktionsanfang</b><span>Setze den Startwert $n_0$ ein und rechne beide Seiten getrennt aus. Sie müssen gleich sein.</span></div></li>
        <li><div><b>Induktionsannahme</b><span>Die Aussage gilt für ein festes, aber beliebiges $n\\ge n_0$. Das ist eine Annahme, kein Beweis.</span></div></li>
        <li><div><b>Induktionsschritt</b><span>Zeige $A(n+1)$ und benutze dabei $A(n)$. Schreibe vorher hin, was zu zeigen ist.</span></div></li>
        <li><div><b>Schluss</b><span>Ein Satz: Nach dem Prinzip der vollständigen Induktion gilt die Behauptung für alle $n\\ge n_0$.</span></div></li>
      </ol></section>
    <section class="glass panel prose"><h2 class="sec">Tipps, die Zeit sparen</h2>
      <p><b>Klammern setzen.</b> Ersetze $n$ stur durch $(n+1)$ und räume die Klammern erst danach auf. So rutscht aus $2^n$ nicht aus Versehen $2^n+1$.</p>
      <p><b>Ziel hinschreiben.</b> Steckst du fest, schau auf das Ziel $A(n+1)$. Oft siehst du dort den Faktor, den du ausklammern musst.</p>
      <p><b>Nicht zu früh ausmultiplizieren.</b> Bei Brüchen und Produkten erst Hauptnenner bilden, dann gemeinsame Faktoren suchen.</p>
      <p><b>Summen:</b> letzten Summanden abspalten. <b>Teilbarkeit:</b> Annahme nach der Potenz umstellen, $a^n=d\\,m+\\dots$. <b>Ungleichungen:</b> Annahme einsetzen und den Rest abschätzen.</p>
      <p><b>Es klappt nicht?</b> Manchmal ist die Aussage zu schwach. Dann beweise eine stärkere mit Gleichheit und folgere die schwächere. Dafür gibt es die Kategorie „Stärkere Aussage“.</p>
    </section>
    <p class="src">Aufbau angelehnt an das Skript „Beweise durch vollständige Induktion“ von Luise Unger (FernUniversität in Hagen). Alle Aufgaben hier erzeugt die App selbst. © 2026 Nikita Berger</p>`);
  mathify(view);
  const doms = $$(".dom"), push = $("#push"), msg = $("#dmsg");
  const sync = () => doms.forEach((d, i) => { d.classList.remove("fell"); d.classList.toggle("gap", !$("#tS").checked && i === 4); }); sync();
  $("#tS").onchange = () => { sync(); msg.textContent = ""; };
  $("#tA").onchange = () => { sync(); msg.textContent = ""; };
  push.onclick = async () => {
    sync(); msg.textContent = "";
    if (!$("#tA").checked) { msg.textContent = "Ohne Anfang wird nie ein Stein angestoßen."; haptic("error"); return; }
    push.disabled = true;
    for (let i = 0; i < doms.length; i++) {
      if (doms[i].classList.contains("gap")) { msg.textContent = "Ohne Schritt reißt die Kette ab."; haptic("error"); push.disabled = false; return; }
      doms[i].classList.add("fell"); haptic("tap");
      await new Promise((r) => setTimeout(r, 170));
    }
    msg.textContent = "Alle gefallen. Das ist Induktion."; haptic("success"); push.disabled = false;
  };
}

// ---------- Start ----------
document.addEventListener("pointerdown", (e) => { if (e.target.closest("button:not(:disabled), .dock-glass a, .chip")) haptic("tap"); });
addEventListener("hashchange", route);
gradualBlur("top", { height: "6.5rem", strength: 2.2 });
gradualBlur("bottom", { height: "10rem", strength: 2.4 });
blurText($("#brand"));
initHaptics();
fetch("assets/bg/bg.jpg", { method: "HEAD" }).then((r) => r.ok && document.documentElement.style.setProperty("--bg-img", "url(assets/bg/bg.jpg)")).catch(() => {});
let installEv = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEv = e; $("#install").hidden = false; });
$("#install").onclick = async () => { installEv?.prompt(); installEv = null; $("#install").hidden = true; };
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
route();
