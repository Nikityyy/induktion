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

// Mehrere Lagen backdrop-filter mit steigender Stärke, jede mit eigener Maske: weicher Unschärfe-Verlauf.
export function gradualBlur(position, { height = "7rem", strength = 2, layers = 6 } = {}) {
  const host = document.createElement("div");
  host.className = `gb gb-${position}`;
  host.setAttribute("aria-hidden", "true");
  host.style.height = height;
  const dir = position === "top" ? "to top" : "to bottom";
  const inc = 100 / layers;
  for (let i = 1; i <= layers; i++) {
    const blur = Math.pow(2, (i / layers) * 4) * 0.0625 * strength;
    const p = (k) => Math.round(inc * k * 10) / 10;
    const stops = [`transparent ${p(i - 1)}%`, `black ${p(i)}%`];
    if (p(i + 1) <= 100) stops.push(`black ${p(i + 1)}%`);
    if (p(i + 2) <= 100) stops.push(`transparent ${p(i + 2)}%`);
    const layer = document.createElement("div");
    const mask = `linear-gradient(${dir}, ${stops.join(", ")})`;
    layer.style.cssText = `mask-image:${mask};-webkit-mask-image:${mask};backdrop-filter:blur(${blur.toFixed(3)}rem);-webkit-backdrop-filter:blur(${blur.toFixed(3)}rem)`;
    host.append(layer);
  }
  document.body.append(host);
  return host;
}

// ---------- Haptik ----------
let wh = null, enabled = true;
export const setHaptics = (on) => { enabled = on; };
export async function initHaptics() {
  try {
    const m = await import("https://cdn.jsdelivr.net/npm/web-haptics@0.0.6/+esm");
    wh = new m.WebHaptics();
  } catch { /* offline oder blockiert: Fallback auf navigator.vibrate */ }
}
const FALLBACK = { tap: 8, success: [20, 40, 20], nudge: 15, error: [30, 40, 30, 40, 30] };
// tap | success | nudge | error
export function haptic(kind = "tap") {
  if (!enabled) return;
  try {
    if (wh) kind === "tap" ? wh.trigger(10, { intensity: 0.4 }) : wh.trigger(kind);
    else navigator.vibrate?.(FALLBACK[kind]);
  } catch { /* Gerät ohne Haptik */ }
}
