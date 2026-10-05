// © 2026 Nikita Berger
// Effekte: BlurText und GradualBlur (nach reactbits.dev, ohne React) sowie Haptik via web-haptics.

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Wörter blenden nacheinander aus der Unschärfe ein (Animation in app.css: .bt). Kursives <em> bleibt erhalten.
export function blurText(el) {
  el.setAttribute("aria-label", el.textContent);
  let i = 0;
  const words = (t) => t.split(/(\s+)/).map((w) => (/^\s*$/.test(w) ? w : `<span class="bt" aria-hidden="true" style="--i:${i++}">${esc(w)}</span>`)).join("");
  el.innerHTML = [...el.childNodes].map((n) => (n.nodeType === 3 ? words(n.nodeValue) : `<${n.tagName.toLowerCase()}>${words(n.textContent)}</${n.tagName.toLowerCase()}>`)).join("");
}

// Weicher Verlauf in der Hintergrundfarbe am oberen Rand: Inhalt läuft darunter sanft aus (Safari kann Masken auf backdrop-filter nicht verlässlich).
export function gradualBlur(position, { height = "4rem" } = {}) {
  const host = document.createElement("div");
  host.className = `gb gb-${position}`;
  host.setAttribute("aria-hidden", "true");
  host.style.height = height;
  document.body.append(host);
  return host;
}

// ---------- Haptik ----------
let wh = null, enabled = true;
export const setHaptics = (on) => { enabled = on; };
export async function initHaptics() {
  try {
    const m = await import("https://cdn.jsdelivr.net/npm/web-haptics@0.0.6/+esm");
    wh = new m.WebHaptics({ debug: /[?&]haptics-debug/.test(location.search) }); // ?haptics-debug: Klickgeräusch am Desktop zum Testen
  } catch { /* offline oder blockiert: Fallback auf navigator.vibrate */ }
}
const FALLBACK = { tap: 8, success: [20, 40, 20], nudge: 15, error: [30, 40, 30, 40, 30] };
// tap | success | nudge | error
let lastAt = 0;
export const hapticAge = (ms) => performance.now() - lastAt < ms; // gerade erst eine gezielte Haptik gespielt?
export function haptic(kind = "tap") {
  if (!enabled) return;
  if (kind !== "tap") lastAt = performance.now();
  try {
    if (wh) kind === "tap" ? wh.trigger(10, { intensity: 0.4 }) : wh.trigger(kind);
    else navigator.vibrate?.(FALLBACK[kind]);
  } catch { /* Gerät ohne Haptik */ }
}
