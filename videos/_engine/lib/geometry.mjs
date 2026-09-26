/**
 * Geometry for the OE explainer engine: points, cubic curves, arc-length sampling.
 * Everything a packet or a current pulse travels along is one of these functions
 * (t in 0..1 → point), so "constant speed" means equal ARC LENGTH per step.
 */
export const P = (x, y) => ({ x: +(+x).toFixed(2), y: +(+y).toFixed(2) });

export const bez = (p0, p1, p2, p3) => (t) => {
  const u = 1 - t;
  return { x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y };
};
export const line = (a, b) => (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** De Casteljau split of a cubic at t: two exact halves. */
export function splitBez(p0, p1, p2, p3, t = 0.5) {
  const L = (a, b) => P(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  const a = L(p0, p1), b = L(p1, p2), c = L(p2, p3), d = L(a, b), e = L(b, c), f = L(d, e);
  return [[p0, a, d, f], [f, e, c, p3]];
}

export const dPath = ([a, b, c, d]) => `M${a.x},${a.y} C${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`;

export function length(fn, n = 400) {
  let s = 0, prev = fn(0);
  for (let i = 1; i <= n; i++) { const p = fn(i / n); s += Math.hypot(p.x - prev.x, p.y - prev.y); prev = p; }
  return s;
}

/** n+1 points at equal arc length along fn. */
export function arc(fn, n) {
  const fine = []; let s = 0, prev = fn(0); fine.push([0, prev]);
  for (let i = 1; i <= 600; i++) { const p = fn(i / 600); s += Math.hypot(p.x - prev.x, p.y - prev.y); fine.push([s, p]); prev = p; }
  const out = []; let j = 0;
  for (let k = 0; k <= n; k++) {
    const target = (s * k) / n;
    while (j < fine.length - 1 && fine[j + 1][0] < target) j++;
    out.push(fine[Math.min(j + 1, fine.length - 1)][1]);
  }
  out[0] = fn(0);
  return out;
}

/** A link between two ports that sags like a real cable. */
export const sag = (a, b, dip) => [a, P(a.x + (b.x - a.x) * 0.35, dip), P(a.x + (b.x - a.x) * 0.65, dip), b];
/** A link that leaves and arrives horizontally (for height changes). */
export const ease = (a, b, reach = 70) => [a, P(a.x + reach, a.y), P(b.x - reach, b.y), b];

export const r3 = (n) => +(+n).toFixed(3);
