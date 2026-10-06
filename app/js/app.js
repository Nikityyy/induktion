// © 2026 Nikita Berger
import { makeTask, randomTask, CAT_INFO } from "./gen.js";
import { blurText, gradualBlur, haptic, hapticAge, initHaptics, setHaptics } from "./fx.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const km = (tex, display = false) => (window.katex ? katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: false }) : `<code>${esc(tex)}</code>`);
const rich = (s) => s.split("$").map((p, i) => (i % 2 ? km(p) : esc(p))).join("");
const mathify = (root) => {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), hit = [];
  for (let n; (n = w.nextNode()); ) if (n.nodeValue.includes("$")) hit.push(n);
  hit.forEach((n) => { const s = document.createElement("span"); s.innerHTML = rich(n.nodeValue); n.replaceWith(s); });
};
const eq = (tex) => `<div class="eq">${km(tex, true)}</div>`;
const emph = (n) => { const i = n.lastIndexOf(" "); return i < 0 ? `<em>${n}</em>` : `${n.slice(0, i)} <em>${n.slice(i + 1)}</em>`; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Formeln: bei der Relation umbrechen (groß statt klein), sonst auf die Breite skalieren ----------
function relIndex(tex) {
  let d = 0;
  for (let i = 0; i < tex.length; i++) {
    const c = tex[i];
    if ("{([".includes(c)) d++; else if ("})]".includes(c)) d--;
    else if (!d && (c === "=" || c === "<" || c === ">" || /^\\(ge|le)q?(?![a-zA-Z])/.test(tex.slice(i, i + 6)))) return i;
  }
  return -1;
}
// Einzeilig: Summen und Produkte kompakt (Text-Stil, Grenzen neben dem Zeichen), einfache Aussagen groß. Passt es so nicht, bei der Relation umbrechen.
const oneLine = (tex) => (/\\(sum|prod)/.test(tex) ? `\\textstyle ${tex}` : `\\displaystyle ${tex}`);
const formulaLines = (tex) => { const i = relIndex(tex); return i < 0 || tex.length < 26 ? [tex] : [`\\displaystyle ${tex.slice(0, i).trim()}`, tex.slice(i).trim()]; };

const MIN_SCALE = 0.55;
function fit(root = document) {
  $$(".eq, .hl", root).forEach((box) => {
    const d = $(".katex-display", box), k = d && $(".katex", d);
    if (!k) return;
    d.style.transform = ""; box.style.height = ""; box.classList.remove("scroll");
    const html = $(".katex-html", k), have = k.clientWidth, need = Math.max(k.scrollWidth, Math.ceil(html ? html.getBoundingClientRect().width : 0)); // Safari meldet scrollWidth teils zu klein: auch die echte Breite messen
    if (!need || !have || need <= have) return;
    const s = have / need, sc = Math.max(s, MIN_SCALE);
    d.style.transform = `scale(${sc})`;
    box.style.height = `${d.offsetHeight * sc}px`;
    box.classList.toggle("scroll", s < MIN_SCALE);
  });
  const f = $("#pinF");
  if (f && !$("#pin").hidden) { f.style.transform = ""; const w = f.parentElement.clientWidth, n = f.scrollWidth; if (n > w) f.style.transform = `scale(${Math.max(0.6, w / n)})`; }
}
function placeTip() {
  const tip = $("#tip"), tile = $("#tile");
  if (!tip || !tile || tip.hidden) return;
  tip.classList.remove("flow");
  if (getComputedStyle(tip).position === "fixed" && tile.getBoundingClientRect().bottom + 12 > tip.getBoundingClientRect().top) tip.classList.add("flow");
}
function heroFit() {
  const f = $("#formula");
  if (!f || !cur) return;
  const tex = cur.claim, can = relIndex(tex) >= 0 && tex.length >= 26;
  const m = f.cloneNode(false);
  m.removeAttribute("id"); m.classList.add("meas"); m.style.width = f.clientWidth ? `${f.clientWidth}px` : "";
  m.innerHTML = `<div class="hl">${km(oneLine(tex), true)}</div>`;
  f.parentElement.append(m);
  const k = $(".katex", m), ratio = k && k.clientWidth ? k.scrollWidth / k.clientWidth : 1;
  m.remove();
  const mode = can && ratio > 1.5 ? "two" : "one";
  if (f.dataset.mode !== mode) {
    f.dataset.mode = mode;
    f.innerHTML = (mode === "two" ? formulaLines(tex) : [oneLine(tex)]).map((l) => `<div class="hl">${km(l, true)}</div>`).join("");
  }
  fit(f);
}
const refit = () => requestAnimationFrame(() => { heroFit(); fit(document); placeTip(); });

// ---------- Speicher ----------
const KEY = "induktion.v1";
const defaults = () => ({ stats: {}, wrong: [], total: 0, streak: 0, best: 0, last: "", done: "", prefs: { cat: "", lvl: 0, hap: true, theme: "system" } });
const S = (() => { try { const d = defaults(), s = JSON.parse(localStorage.getItem(KEY)) ?? {}; return { ...d, ...s, prefs: { ...d.prefs, ...s.prefs } }; } catch { return defaults(); } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* privater Modus */ } };
setHaptics(S.prefs.hap);

const mq = matchMedia("(prefers-color-scheme: dark)");
function applyTheme() {
  const dark = S.prefs.theme === "nacht" || (S.prefs.theme === "system" && mq.matches);
  document.documentElement.dataset.theme = dark ? "nacht" : "hell";
  $('meta[name="theme-color"]').content = dark ? "#0D1015" : "#F5F6F8";
}
mq.addEventListener?.("change", applyTheme);

const view = $("#view"), cta = $("#cta"), ctaWrap = $("#ctaWrap"), pin = $("#pin");
const ARROW = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9"/></svg>';
const setCta = (t) => { cta.innerHTML = `<span>${t}</span><i>${ARROW}</i>`; };
let cur = null, st = null, io = null, tileVisible = true, installEv = null;
const iosHint = /iphone|ipad/i.test(navigator.userAgent) && !navigator.standalone && !matchMedia("(display-mode: standalone)").matches;

const calm = matchMedia("(prefers-reduced-motion: reduce)");

// ---------- Routing ----------
function route() {
  const [, a, b] = (location.hash.slice(1) || "/").split("/");
  const v = a === "lernen" ? "lernen" : a === "fortschritt" ? "fortschritt" : "ueben";
  document.documentElement.dataset.view = v;
  $$("[data-nav]").forEach((n) => { const on = n.dataset.nav === v; n.classList.toggle("on", on); n.setAttribute("aria-selected", String(on)); });
  ctaWrap.hidden = v !== "ueben";
  io?.disconnect(); setPin(false);
  window.scrollTo({ top: 0, behavior: "instant" });
  if (v === "lernen") return viewLearn();
  if (v === "fortschritt") return viewProgress();
  const explicit = a === "t" && b;
  try { cur = makeTask(explicit ? b : S.last); } catch { cur = pickNew(); }
  if (!explicit && cur.id === S.done) cur = pickNew();
  if (a !== "t" || b !== cur.id) history.replaceState(null, "", `#/t/${cur.id}`);
  viewTask();
}
const pickNew = () => randomTask({ cat: S.prefs.cat || undefined, lvl: S.prefs.lvl || undefined });
const go = (task) => { location.hash = `#/t/${task.id}`; };
const mount = (html) => {
  view.innerHTML = html;
  view.classList.remove("enter"); void view.offsetWidth; view.classList.add("enter");
  view.focus({ preventScroll: true });
  $$("[data-blur]", view).forEach((el) => blurText(el));
  fit(view);
  onScroll();
  setTimeout(refit, 500); setTimeout(refit, 1500); // Schriften können nachladen und die Breite ändern
};
// großer Titel -> kleiner Titel in der Leiste (Fortschritt 0..1)
function onScroll() {
  const t = $(".tt"), end = t ? t.offsetTop + t.offsetHeight - 70 : 80;
  document.documentElement.style.setProperty("--p", Math.min(1, Math.max(0, (scrollY - (end - 40)) / 40)).toFixed(2));
}
addEventListener("scroll", onScroll, { passive: true });

// ---------- Aufgabe ----------
const item = (it) =>
  it.t === "text" ? `<p>${rich(it.s)}</p>`
  : it.t === "eq" ? eq(it.tex)
  : `<div class="chain">${eq(it.start)}${it.lines.map((l) => `<div class="ln">${eq(l.rel === "=" ? `= ${l.tex}` : `${l.rel} ${l.tex}`)}${l.note ? `<p class="note">${rich(l.note)}</p>` : ""}</div>`).join("")}</div>`;
const wrapItems = (items) => items.map((it, k) => `<div class="ln" style="--i:${Math.min(k + 1, 8)}">${item(it)}</div>`).join("");

function viewTask() {
  const t = cur;
  S.last = t.id; save();
  st = { revealed: 0, hints: 0, rated: false };
  const lead = t.lead.startsWith("Beweise durch vollständige Induktion: Für alle") ? `Beweise für alle $${t.dom}$:` : t.lead;
  mount(`
    <div class="tt"><h1 data-blur>${emph(CAT_INFO[t.cat].name)}</h1></div>
    <article class="tile" id="tile" aria-label="Aufgabe">
      <div class="zone-a"><span>Level ${t.lvl} von 3</span><span class="segs" id="segs" aria-hidden="true">${t.blocks.map(() => "<i></i>").join("")}</span></div>
      <div class="zone-b">
        <p class="lead">${rich(lead)}</p>
        <div class="formula" id="formula"></div>
        ${t.tail ? `<p class="tail">${rich(t.tail)}</p>` : ""}
      </div>
    </article>
    <section class="tipwrap" id="tip" aria-live="polite"><button class="lnk" id="hintb" type="button">Tipp anzeigen</button></section>
    <section class="sol" id="sol" aria-label="Lösungsweg"></section>`, CAT_INFO[t.cat].name);
  setCta("Lösungsweg zeigen");
  $("#hintb").onclick = showHint;
  io = new IntersectionObserver(([e]) => { tileVisible = e.isIntersecting; updatePin(); }, { rootMargin: "-90px 0px 0px 0px" });
  io.observe($("#tile"));
  $("#pinF").innerHTML = km(t.claim);
  heroFit();
  placeTip();
}

function showHint() {
  const h = cur.hints[st.hints];
  if (!h) return;
  st.hints++;
  const more = st.hints < cur.hints.length;
  $("#tip").innerHTML = `<div class="tiphead"><b>Tipp ${st.hints} von ${cur.hints.length}</b>${more ? '<button class="lnk" id="hintb" type="button">Nächster Tipp</button>' : ""}</div><p>${rich(h.s)}</p>${h.eq ? eq(h.eq) : ""}`;
  if (more) $("#hintb").onclick = showHint;
  haptic("nudge");
  fit($("#tip"));
  placeTip();
}

function setPin(on) { pin.hidden = !on; document.documentElement.classList.toggle("pinned", on); if (on) refit(); }
function updatePin() { setPin(!!st && st.revealed > 0 && !tileVisible); }
pin.onclick = () => { window.scrollTo({ top: 0, behavior: "smooth" }); haptic("tap"); };

function collapse(step) {
  step.classList.add("old", "collapsed");
  const h = $("h2", step);
  h.tabIndex = 0; h.setAttribute("role", "button"); h.setAttribute("aria-expanded", "false");
  const toggle = () => { const open = step.classList.toggle("collapsed") === false; h.setAttribute("aria-expanded", String(open)); haptic("tap"); };
  h.onclick = toggle;
  h.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } };
}

let busy = false;
async function reveal() {
  if (busy) return;
  busy = true;
  const i = st.revealed, b = cur.blocks[i], n = cur.blocks.length, sol = $("#sol");
  $("#tip").hidden = true;
  const prev = $(".sol-step:last-of-type", sol);
  if (prev) {
    collapse(prev);
    if (!calm.matches) await new Promise((r) => setTimeout(r, 400)); // erst zuklappen, dann den nächsten Schritt aufdecken: nie beides gleichzeitig
  }
  const el = document.createElement("section");
  el.className = "sol-step focus";
  el.innerHTML = `<span class="no" aria-hidden="true">${i + 1}</span><div class="sb"><h2><span>${b.h}</span><small>${i + 1} von ${n}</small></h2><div class="bd"><div class="bd-in">${wrapItems(b.items)}</div></div></div>`;
  sol.append(el);
  fit(el);
  $$("#segs i")[i]?.classList.add("on");
  st.revealed++;
  const last = st.revealed === n;
  haptic(last ? "success" : "nudge");
  if (last) { S.done = cur.id; save(); }
  $("#pinN").textContent = `${st.revealed} / ${n}`;
  updatePin();
  if (last) {
    sol.insertAdjacentHTML("beforeend", `<div class="rate"><h3>Hast du es so gelöst?</h3><div class="row"><button class="btn-ink" data-r="ok" type="button">Ja, gekonnt</button><button class="lnk" data-r="bad" type="button">Nochmal üben</button></div><p class="msg" id="ratemsg" role="status"></p></div>`);
    $$("[data-r]").forEach((r) => (r.onclick = () => rate(r.dataset.r)));
    setCta("Nächste Aufgabe");
  } else setCta(`Weiter: ${cur.blocks[st.revealed].h}`);
  // so weit hinunter, dass der Anfang des neuen Schritts oben steht (soweit die Seite reicht)
  const top = el.getBoundingClientRect().top + scrollY - 92;
  scrollTo({ top: Math.min(top, document.documentElement.scrollHeight - innerHeight), behavior: calm.matches ? "instant" : "smooth" });
  busy = false;
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
  haptic(r === "ok" ? "success" : "nudge");
  $$("[data-r]").forEach((b) => (b.disabled = true));
  $("#ratemsg").textContent = r === "ok" ? (S.streak > 1 ? `${S.streak} in Folge.` : "Gespeichert.") : "Gespeichert. Du findest sie unter Fortschritt.";
}
// Vor der nächsten Aufgabe erst sanft nach oben scrollen, dann wechseln (kein Springen)
const toTop = () => new Promise((done) => {
  if (scrollY < 40 || calm.matches) return done();
  scrollTo({ top: 0, behavior: "smooth" });
  const t0 = performance.now(), tick = () => (scrollY < 2 || performance.now() - t0 > 500 ? done() : requestAnimationFrame(tick));
  tick();
});
cta.onclick = async () => {
  if (!cur || !st) return;
  if (st.revealed < cur.blocks.length) return reveal();
  cta.disabled = true; await toTop(); cta.disabled = false; go(pickNew());
};

// ---------- Thema wählen ----------
function openSheet() {
  const d = $("#sheet");
  const ck = '<svg class="i ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const opt = (k, name, tip) => `<button class="opt" data-cat="${k}" type="button"><span><b>${name}</b><small>${tip}</small></span>${S.prefs.cat === k ? ck : ""}</button>`;
  d.innerHTML = `<div class="modal-box sheet-box" tabindex="-1" autofocus><div class="grab"></div><h2>Thema wählen</h2>
    <div class="seg3" role="group" aria-label="Level">${[0, 1, 2, 3].map((l) => `<button data-lvl="${l}" type="button" class="${S.prefs.lvl === l ? "on" : ""}">${l ? `Level ${l}` : "Alle Level"}</button>`).join("")}</div>
    ${opt("", "Alle Themen", "Querbeet üben")}${Object.entries(CAT_INFO).map(([k, v]) => opt(k, v.name, v.short)).join("")}</div>
    <form method="dialog" class="modal-backdrop"><button aria-label="Schließen">schließen</button></form>`;
  $$("[data-lvl]", d).forEach((b) => (b.onclick = () => { S.prefs.lvl = +b.dataset.lvl; save(); $$("[data-lvl]", d).forEach((x) => x.classList.toggle("on", x === b)); }));
  $$("[data-cat]", d).forEach((b) => (b.onclick = () => { S.prefs.cat = b.dataset.cat; save(); closeSheet(); const t = pickNew(); location.hash === `#/t/${t.id}` ? route() : go(t); }));
  d.showModal();
}
$("#topicBtn").onclick = openSheet;

// Sheet weich schließen: erst Animation (Blatt nach unten, Abdunklung blendet aus), dann <dialog>.close()
function closeSheet(swiped = false) {
  const d = $("#sheet");
  if (!d.open || d.classList.contains("closing")) return;
  d.classList.add("closing"); d.classList.toggle("swiped", swiped);
  setTimeout(() => { d.close(); d.classList.remove("closing", "swiped"); }, 260);
}
$("#sheet").addEventListener("cancel", (e) => { e.preventDefault(); closeSheet(); });
$("#sheet").addEventListener("click", (e) => { if (e.target.closest(".modal-backdrop")) { e.preventDefault(); closeSheet(); } });

// Aktionsblatt (wie iOS): Warnung oben, rote Aktion, Abbrechen getrennt
function confirmSheet(text, label, fn) {
  const d = $("#sheet");
  d.innerHTML = `<div class="action"><div class="grp"><p>${text}</p><button class="danger" id="yes" type="button">${label}</button></div><div class="cancel"><button type="button" id="no">Abbrechen</button></div></div><form method="dialog" class="modal-backdrop"><button aria-label="Schließen">schließen</button></form>`;
  $("#yes").onclick = () => { closeSheet(); haptic("success"); fn(); };
  $("#no").onclick = closeSheet;
  d.showModal(); haptic("nudge");
}

// Sheet nach unten wegwischen
$("#sheet").addEventListener("pointerdown", (e) => {
  const box = e.target.closest(".sheet-box");
  if (!box || e.target.closest("button")) return;
  const y0 = e.clientY; let dy = 0, t0 = performance.now();
  const move = (m) => { dy = Math.max(0, m.clientY - y0); box.style.transition = "none"; box.style.transform = `translateY(${dy}px)`; };
  const up = () => {
    removeEventListener("pointermove", move); removeEventListener("pointerup", up);
    box.style.transition = "transform 0.3s var(--spring)";
    const fast = dy / (performance.now() - t0) > 0.6;
    if (dy > 90 || fast) { box.style.transform = "translateY(110%)"; closeSheet(true); } else box.style.transform = "";
  };
  addEventListener("pointermove", move); addEventListener("pointerup", up);
});

// ---------- Fortschritt ----------
function viewProgress() {
  const rows = Object.entries(CAT_INFO).map(([k, v]) => ({ k, name: v.name, ...(S.stats[k] ?? { ok: 0, part: 0, bad: 0 }) }));
  const tot = (r) => r.ok + r.bad, score = (r) => (tot(r) ? r.ok / tot(r) : null);
  const ok = rows.reduce((a, r) => a + r.ok, 0), all = rows.reduce((a, r) => a + tot(r), 0);
  const weak = rows.filter((r) => tot(r) >= 2).sort((a, b) => score(a) - score(b))[0];
  mount(`
    <div class="tt pg"><h1 class="page" data-blur>Dein <em>Fortschritt</em></h1></div>
    ${all ? `<div class="hero-n">${ok} <small>von ${all}</small></div><p class="body-t">gekonnt.${weak && score(weak) < 0.8 ? ` Am wackeligsten: ${weak.name}.` : ""}</p>`
          : `<p class="empty">Noch nichts gelöst. Lass dir eine Aufgabe zeigen und sag danach, ob du sie so gelöst hast.</p><p style="margin-top:16px"><a class="btn-ink" style="display:inline-flex;align-items:center;text-decoration:none" href="#/">Zur ersten Aufgabe</a></p>`}
    <div style="margin-top:22px">${rows.map((r) => `<div class="cat"><span>${r.name}</span><span>${tot(r) ? `${r.ok} von ${tot(r)}` : "noch nichts"}</span><div class="bar"><i class="${weak && weak.k === r.k && score(r) < 0.8 ? "w" : ""}" style="width:${Math.round((score(r) ?? 0) * 100)}%"></i></div></div>`).join("")}</div>
    <h2 class="sec">Zum Wiederholen</h2>
    ${S.wrong.length ? S.wrong.map((w) => `<div class="redo"><div>${CAT_INFO[w.cat].name}<small>#${w.id.split(".")[1]}</small></div><button class="btn-ink" data-open="${w.id}" type="button">Nochmal</button></div>`).join("") : '<p class="empty" style="margin-top:6px">Nichts offen.</p>'}
    <h2 class="sec">Einstellungen</h2>
    <div class="set"><span>Darstellung</span><div class="seg3" role="group" aria-label="Darstellung">${[["hell", "Hell"], ["nacht", "Nacht"], ["system", "System"]].map(([v, l]) => `<button data-theme="${v}" type="button" class="${S.prefs.theme === v ? "on" : ""}">${l}</button>`).join("")}</div></div>
    <label class="set"><span>Haptisches Feedback</span><input id="hap" type="checkbox" class="sw" ${S.prefs.hap ? "checked" : ""} /></label>
    ${installEv ? '<div class="set"><span>Als App installieren</span><button class="lnk" id="inst" type="button">Installieren</button></div>' : ""}
    ${iosHint ? '<p class="ios-hint">Für das App-Gefühl auf dem iPhone: in Safari auf Teilen tippen, dann „Zum Home-Bildschirm“.</p>' : ""}
    <div class="set"><span>Fortschritt zurücksetzen</span><button class="lnk" id="reset" type="button">Löschen</button></div>`, "Dein Fortschritt");
  $$("[data-open]").forEach((b) => (b.onclick = () => (location.hash = `#/t/${b.dataset.open}`)));
  $$("button[data-theme]").forEach((b) => (b.onclick = () => { S.prefs.theme = b.dataset.theme; save(); applyTheme(); $$("button[data-theme]").forEach((x) => x.classList.toggle("on", x === b)); }));
  $("#hap").onchange = (e) => { S.prefs.hap = e.target.checked; setHaptics(S.prefs.hap); save(); haptic("success"); };
  $("#inst")?.addEventListener("click", async () => { installEv?.prompt(); installEv = null; viewProgress(); });
  $("#reset").onclick = () => confirmSheet("Dein gesamter Fortschritt wird gelöscht.", "Fortschritt löschen", () => { Object.assign(S, defaults(), { prefs: S.prefs, last: S.last }); save(); viewProgress(); });
}

// ---------- Lernen ----------
function viewLearn() {
  mount(`
    <div class="tt pg"><h1 class="page" data-blur>Wie Induktion <em>funktioniert</em></h1></div>
    <p class="body-t">Du willst etwas für <b>alle</b> Zahlen n beweisen, aber du kannst nicht unendlich viele Zahlen einzeln prüfen. Deshalb zeigst du zwei Dinge:</p>
    <p class="body-t" style="margin-top:12px"><b>1.</b> Die Aussage stimmt für die erste Zahl.<br><b>2.</b> Stimmt sie für irgendeine Zahl, dann stimmt sie auch für die nächste.</p>
    <div class="example">
      <h3>Was ist A(n)?</h3>
      <p class="body-t sm">Die Aussage, die zur Zahl n gehört, nennt man kurz A(n). Beispiel: Die Summe 1 + 2 + … + n ist n(n+1)/2.</p>
      <div class="ex" style="margin-top:8px"><b>A(n)</b><span>die Aussage für eine beliebige Zahl n</span><div class="eq">${km("1+2+\\dots+n=\\frac{n(n+1)}{2}", true)}</div></div>
      <div class="ex"><b>A(1)</b><span>dieselbe Aussage für n = 1</span><div class="eq">${km("1=\\frac{1\\cdot 2}{2}", true)}</div></div>
      <div class="ex"><b>A(2)</b><span>dieselbe Aussage für n = 2</span><div class="eq">${km("1+2=\\frac{2\\cdot 3}{2}", true)}</div></div>
      <div class="ex"><b>A(n+1)</b><span>dieselbe Aussage für die nächste Zahl</span><div class="eq">${km("1+2+\\dots+(n+1)=\\frac{(n+1)(n+2)}{2}", true)}</div></div>
    </div>
    <h2 class="sec">Die vier Teile eines Beweises</h2>
    <div class="part"><b>1</b><span>Induktionsanfang</span><small>Setze die erste Zahl ein (meist n = 1) und rechne beide Seiten getrennt aus. Sie müssen gleich sein.</small></div>
    <div class="part"><b>2</b><span>Induktionsannahme</span><small>Nimm an, dass die Aussage für ein festes n stimmt. Das ist eine Annahme, noch kein Beweis.</small></div>
    <div class="part"><b>3</b><span>Induktionsschritt</span><small>Zeige, dass die Aussage dann auch für n + 1 stimmt, und benutze dabei die Annahme.</small></div>
    <div class="part"><b>4</b><span>Schluss</span><small>Ein Satz: Nach dem Prinzip der vollständigen Induktion gilt die Aussage für alle n.</small></div>
    <h2 class="sec">Was Zeit spart</h2>
    <p class="tip-p"><b>Klammern setzen.</b> Ersetze n stur durch (n+1) und räume die Klammern erst danach auf.</p>
    <p class="tip-p"><b>Ziel hinschreiben.</b> Steckst du fest, schau auf die Aussage für n+1. Dort siehst du den Faktor, den du ausklammern musst.</p>
    <p class="tip-p"><b>Nicht zu früh ausmultiplizieren.</b> Erst Hauptnenner bilden, dann gemeinsame Faktoren suchen.</p>
    <p class="tip-p"><b>Klappt es nicht?</b> Dann ist die Aussage vielleicht zu schwach. Beweise eine stärkere mit Gleichheit und folgere die schwächere.</p>
    <p class="src">Aufbau angelehnt an das Skript „Beweise durch vollständige Induktion“ von Luise Unger (FernUniversität in Hagen). Alle Aufgaben erzeugt die App selbst. © 2026 Nikita Berger</p>`, "Wie Induktion funktioniert");
  mathify(view);
  fit(view);
}

// ---------- Start ----------
// Berührung, die nur eine auslaufende Scroll-Bewegung stoppt, erzeugt in iOS keinen click: Tab trotzdem wechseln
{
  let down = null;
  const tabAt = (x, y) => $$(".tabbar button").find((a) => { const r = a.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });
  addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), a: tabAt(e.clientX, e.clientY) }; }, true);
  addEventListener("pointerup", (e) => {
    const d = down; down = null;
    if (!d || !d.a || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10 || performance.now() - d.t > 600 || tabAt(e.clientX, e.clientY) !== d.a) return;
    setTimeout(() => { if (document.documentElement.dataset.view !== d.a.dataset.nav && !d.a.classList.contains("on")) d.a.click(); }, 80);
  }, true);
}
$$(".tabbar button").forEach((a) => a.addEventListener("click", () => (a.classList.contains("on") ? scrollTo({ top: 0, behavior: "smooth" }) : (location.hash = a.dataset.href))));
document.addEventListener("change", (e) => { if (e.target.matches(".sw")) haptic("tap"); });
// iOS löst Haptik nur innerhalb einer echten Berührung (click) aus, nicht bei pointerdown
document.addEventListener("click", (e) => { if (e.target.closest("button:not(:disabled)") && !hapticAge(60)) haptic("tap"); });
addEventListener("hashchange", route);
addEventListener("resize", refit);
document.fonts?.addEventListener?.("loadingdone", refit);
document.fonts?.ready.then(refit);
gradualBlur("top", { height: "calc(var(--sat) + 3rem)" });
applyTheme();
initHaptics();
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEv = e; });
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
route();
