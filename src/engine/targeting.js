export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

export function distToRectPerimeter(px, py, rect) {
  const x1 = rect.x, y1 = rect.y, x2 = rect.x + rect.w, y2 = rect.y + rect.h;
  const cx = clamp(px, x1, x2), cy = clamp(py, y1, y2);
  const outside = Math.hypot(px - cx, py - cy);
  if (outside > 0) return outside;
  const dL = px - x1, dR = x2 - px, dT = py - y1, dB = y2 - py;
  return Math.min(dL, dR, dT, dB);
}
