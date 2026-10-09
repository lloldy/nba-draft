// Small canvas confetti burst (82-0 and championships). Does nothing with reduced motion.
import { reducedMotion } from './dom.js';

const COLORS = ['#ffb020', '#ffffff', '#3ddc84', '#5aa9ff', '#ff5d5d'];

export function confetti({ count = 160, duration = 3200 } = {}) {
  if (reducedMotion()) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  c.width = innerWidth; c.height = innerHeight;
  document.body.append(c);
  const g = c.getContext('2d');
  const parts = Array.from({ length: count }, () => ({
    x: c.width / 2 + (Math.random() - 0.5) * c.width * 0.3,
    y: c.height * 0.35,
    vx: (Math.random() - 0.5) * 16,
    vy: -Math.random() * 16 - 4,
    w: 6 + Math.random() * 8, h: 4 + Math.random() * 6,
    rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
  const start = performance.now();
  (function frame(now) {
    const t = now - start;
    g.clearRect(0, 0, c.width, c.height);
    g.globalAlpha = Math.max(0, 1 - t / duration);
    for (const p of parts) {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.fillStyle = p.color; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      g.restore();
    }
    if (t < duration) requestAnimationFrame(frame); else c.remove();
  })(start);
}
