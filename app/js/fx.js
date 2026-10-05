// © 2026 Nikita Berger
// Effekte: BlurText und GradualBlur (nach reactbits.dev, ohne React) sowie Haptik (ios-vibrator-pro-max für iOS).

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
// navigator.vibrate gibt es auf Android nativ. Für iOS/Safari ergänzt ios-vibrator-pro-max (CDN, kein Build) die Funktion.
let enabled = true;
export const setHaptics = (on) => { enabled = on; };
export async function initHaptics() {
  try { await import("https://cdn.jsdelivr.net/npm/ios-vibrator-pro-max@3.0.3/+esm"); } catch { /* offline: ohne Haptik */ }
}
const PATTERNS = { tap: 10, success: [15, 60, 25], nudge: [20, 60, 10], error: [25, 40, 25, 40, 25] };
// tap | success | nudge | error
let lastAt = 0;
export const hapticAge = (ms) => performance.now() - lastAt < ms; // gerade erst eine gezielte Haptik gespielt?
export function haptic(kind = "tap") {
  if (!enabled) return;
  if (kind !== "tap") lastAt = performance.now();
  try { navigator.vibrate?.(PATTERNS[kind]); } catch { /* Gerät ohne Haptik */ }
}
