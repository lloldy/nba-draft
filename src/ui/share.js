// Share card (Canvas -> PNG) and copyable result text.
import { PO_LABELS } from '../core/stats.js';

export function shareText(run, link) {
  const head = run.mode === 'daily' ? `Daily ${run.date}` : run.mode === 'challenge' ? 'Challenge' : 'Freies Spiel';
  const lines = run.lineup.map((l) => `${l.slot} ${l.name} (${l.rating})${l.ultra ? ' ★ Ultra' : ''}`);
  return [
    `NBA Draft · ${head}`,
    `${run.wins}–${run.losses} · ${PO_LABELS[run.po]}`,
    ...lines,
    `Chemie: ${run.chem} · Stärke ${run.strength}`,
    run.iq ? `HoopIQ: ${run.iq.pct} % (${run.iq.title})` : null,
    run.ruleLabel ? `Regel: ${run.ruleLabel} ${run.passed ? '✓' : '✗'}` : null,
    `Schlag meinen Rekord: ${link}`,
  ].filter(Boolean).join('\n');
}

const FONT = '"Big Shoulders Display", Impact, "Arial Narrow", system-ui, sans-serif';

export function renderShareCard(run, franchises, teams = {}) {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2a1d12'); bg.addColorStop(0.45, '#0b0d12'); bg.addColorStop(1, '#0b0d12');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = '#b9824a'; g.fillRect(0, 0, W, 10);

  g.fillStyle = '#eef1f7'; g.font = `800 88px ${FONT}`; g.textBaseline = 'alphabetic';
  g.fillText('NBA DRAFT', 70, 140);
  g.fillStyle = '#8b93a7'; g.font = `800 34px ${FONT}`;
  const head = run.mode === 'daily' ? `DAILY ${run.date}` : run.mode === 'challenge' ? 'CHALLENGE' : 'FREIES SPIEL';
  g.fillText(head, 74, 192);

  g.fillStyle = '#ffb020'; g.font = `800 300px ${FONT}`; g.textAlign = 'center';
  g.fillText(`${run.wins}–${run.losses}`, W / 2, 470);
  g.fillStyle = run.po === 5 ? '#ffb020' : '#eef1f7'; g.font = `800 54px ${FONT}`;
  g.fillText(PO_LABELS[run.po].toUpperCase(), W / 2, 545);
  g.textAlign = 'left';

  run.lineup.forEach((l, i) => {
    const y = 610 + i * 118;
    const f = { ...(franchises[l.franchise] ?? { primary: '#444', secondary: '#888' }), ...(teams[l.team]?.primary ? teams[l.team] : {}) };
    g.fillStyle = '#141821'; g.fillRect(70, y, W - 140, 100);
    g.fillStyle = f.primary; g.fillRect(70, y, 18, 100);
    g.fillStyle = f.secondary; g.fillRect(88, y, 6, 100);
    g.fillStyle = '#8b93a7'; g.font = `800 38px ${FONT}`; g.fillText(l.slot, 118, y + 64);
    g.fillStyle = '#eef1f7'; g.font = `800 44px ${FONT}`; g.fillText(l.name, 210, y + 50);
    if (l.ultra) { const x = 210 + g.measureText(l.name).width + 16; g.font = `800 28px ${FONT}`; g.fillStyle = '#ffe08a'; g.fillText('★ ULTRA', x, y + 48); }
    g.fillStyle = '#8b93a7'; g.font = `28px system-ui, sans-serif`; g.fillText(`${l.team ?? l.franchise} · ${l.decade}er`, 210, y + 84);
    g.fillStyle = '#ffb020'; g.font = `800 62px ${FONT}`; g.textAlign = 'right'; g.fillText(String(l.rating), W - 100, y + 68); g.textAlign = 'left';
  });

  g.fillStyle = '#eef1f7'; g.font = `800 40px ${FONT}`;
  g.fillText(`${run.chem.toUpperCase()}  ·  STÄRKE ${run.strength}`, 70, 1250);
  g.fillStyle = '#8b93a7'; g.font = `30px system-ui, sans-serif`;
  const rule = (run.ruleLabel ? `${run.ruleLabel} ${run.passed ? '✓' : '✗'}  ·  ` : '') + (run.iq ? `HoopIQ ${run.iq.pct} %  ·  ` : '');
  g.fillText(`${rule}Seed ${run.seed}  ·  Schlag meinen Rekord!`, 70, 1300);
  return c;
}

export function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
}
