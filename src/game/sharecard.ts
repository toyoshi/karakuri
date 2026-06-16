/* ============================================================
   KARAKURI — share card. Renders a 1200×630 achievement card on
   a canvas (no server needed). Used for SNS sharing on a static
   GitHub Pages site.
   ============================================================ */
import type { Bit } from '../sim/netlist';

const C = {
  ink: '#0b0e13', ink2: '#131822', line: 'rgba(255,255,255,0.10)',
  paper: '#f3efe6', paper2: '#cdd3de', muted: '#8b96a8', faint: '#5a6577',
  brass: '#d8a657', brassB: '#f2c879', verd: '#57b09a', signal: '#6cc6ff',
};

export interface CardData {
  title: string;          // level title, e.g. "AND — 論理積"
  unit: string;           // 'NAND' | 'トランジスタ'
  cost: number;
  par: number;
  delay: number | null;
  lang: 'ja' | 'en';
  solved: boolean;        // false = sharing a work-in-progress ("not cleared yet")
  optimal: boolean;
  totalNands: number;
  stars: number;
  cleared: string;        // e.g. "8/15"
  table: { inputs: string[]; outputs: string[]; rows: { in: Record<string, Bit>; out: Record<string, Bit> }[] } | null;
  /** the player's actual circuit, in CELL pixel coords, for the "look what I built" panel */
  circuit?: {
    w: number; h: number;
    nodes: { x: number; y: number; cw: number; ch: number; kind: string; label: string; on?: boolean }[];
    wires: { ax: number; ay: number; bx: number; by: number; lit: boolean }[];
  } | null;
  url: string;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}

/** draw the player's actual circuit, fit into a panel — the "look what I built" flex */
function drawCircuitInto(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number, circ: NonNullable<CardData['circuit']>, label: string) {
  roundRect(ctx, px, py, pw, ph, 16); ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.muted; ctx.font = `500 18px "JetBrains Mono", monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(label, px + 26, py + 36);
  const ix = px + 24, iy = py + 54, iw = pw - 48, ih = ph - 78;
  const s = Math.min(iw / (circ.w || 1), ih / (circ.h || 1));
  const ox = ix + (iw - circ.w * s) / 2, oy = iy + (ih - circ.h * s) / 2;
  const X = (x: number) => ox + x * s, Y = (y: number) => oy + y * s;
  ctx.save();
  // wires
  for (const w of circ.wires) {
    const dx = Math.max(10, Math.abs(w.bx - w.ax) * 0.5) * s;
    ctx.beginPath();
    ctx.moveTo(X(w.ax), Y(w.ay));
    ctx.bezierCurveTo(X(w.ax) + dx, Y(w.ay), X(w.bx) - dx, Y(w.by), X(w.bx), Y(w.by));
    ctx.strokeStyle = w.lit ? C.signal : C.ink2; ctx.lineWidth = Math.max(1.5, 3 * s); ctx.lineCap = 'round'; ctx.stroke();
  }
  // nodes
  for (const n of circ.nodes) {
    const x = X(n.x) + 3 * s, y = Y(n.y) + 3 * s, w = n.cw * s - 6 * s, h = n.ch * s - 6 * s;
    let fill = '#1b2330', stroke = C.muted;
    if (n.kind === 'chip') { fill = '#1a2030'; stroke = C.verd; }
    else if (n.kind === 'dff') { fill = '#181f2e'; stroke = C.verd; }
    else if (n.kind === 'input') { fill = n.on ? C.brass : '#221b10'; stroke = C.brass; }
    else if (n.kind === 'output') { fill = n.on ? C.signal : '#16202b'; stroke = n.on ? C.signal : C.muted; }
    else if (n.kind === 'high' || n.kind === 'low') { fill = '#1c2330'; stroke = C.brass; }
    if (n.kind === 'output') { ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, 6.2832); }
    else roundRect(ctx, x, y, w, h, 4 * s);
    ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = Math.max(1, 1.5 * s); ctx.strokeStyle = stroke; ctx.stroke();
    if (s > 0.42 && n.label) {
      ctx.fillStyle = n.kind === 'input' && n.on ? '#1a130a' : (n.kind === 'output' && n.on ? '#04121d' : C.paper2);
      ctx.font = `600 ${Math.round(11 * s + 3)}px "JetBrains Mono", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n.label, x + w / 2, y + h / 2);
    }
  }
  ctx.restore(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

export async function makeShareCard(d: CardData): Promise<Blob> {
  const W = 1200, H = 630;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  try { await (document as any).fonts?.ready; } catch { /* ignore */ }
  const ja = d.lang === 'ja';
  const SANS = ja ? '"Zen Kaku Gothic New", "Inter", sans-serif' : '"Inter", sans-serif';
  const DISP = '"Fraunces", "Zen Old Mincho", serif';
  const MONO = '"JetBrains Mono", monospace';

  // background
  ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W - 180, -120, 60, W - 180, -120, 760);
  glow.addColorStop(0, 'rgba(216,166,87,0.18)'); glow.addColorStop(1, 'rgba(216,166,87,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.line; ctx.lineWidth = 1;
  for (let x = 48; x < W; x += 48) { ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 48; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 2;
  roundRect(ctx, 16, 16, W - 32, H - 32, 22); ctx.stroke();

  const pad = 76;

  // logo + wordmark
  ctx.save();
  roundRect(ctx, pad, pad, 46, 46, 10); ctx.fillStyle = '#0b0e13'; ctx.fill();
  ctx.strokeStyle = C.brass; ctx.lineWidth = 1.5; ctx.stroke();
  // little "D" gate + line (echoes the favicon)
  ctx.strokeStyle = C.signal; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(pad + 13, pad + 14); ctx.lineTo(pad + 20, pad + 14);
  ctx.arc(pad + 20, pad + 23, 9, -Math.PI / 2, Math.PI / 2); ctx.lineTo(pad + 13, pad + 32); ctx.closePath(); ctx.stroke();
  ctx.strokeStyle = C.brass; ctx.beginPath(); ctx.moveTo(pad + 20, pad + 23); ctx.lineTo(pad + 34, pad + 23); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = C.paper; ctx.font = `600 30px ${DISP}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText(ja ? 'スイッチからCPU' : 'Switch → CPU', pad + 60, pad + 32);

  // eyebrow — solved vs work-in-progress
  ctx.fillStyle = d.solved ? C.brass : C.muted; ctx.font = `500 20px ${MONO}`;
  ctx.fillText(d.solved ? (ja ? '課題クリア' : 'SOLVED') : (ja ? '挑戦中・未クリア' : 'IN PROGRESS · NOT CLEARED YET'), pad, 230);

  // headline (level title) — clamp to the LEFT column so it never runs under
  // the right-hand panel (circuit / truth table) which begins at x=760
  ctx.fillStyle = C.paper; ctx.font = `600 58px ${DISP}`;
  let title = d.title; const maxW = 760 - pad - 28;
  while (ctx.measureText(title).width > maxW && title.length > 4) title = title.slice(0, -1);
  ctx.fillText(title === d.title ? title : title + '…', pad, 300);

  // big stat
  ctx.fillStyle = C.brassB; ctx.font = `600 120px ${DISP}`;
  const numStr = String(d.cost);
  ctx.fillText(numStr, pad, 450);
  const numW = ctx.measureText(numStr).width;
  ctx.fillStyle = C.paper2; ctx.font = `500 30px ${SANS}`;
  ctx.fillText(d.unit, pad + numW + 22, 410);
  ctx.fillStyle = C.muted; ctx.font = `400 26px ${SANS}`;
  ctx.fillText(d.solved ? (ja ? `個で組み上げた` : `to build it`) : (ja ? `個で組み立て中` : `placed so far`), pad + numW + 22, 448);

  // chips: par / delay
  let cx = pad;
  const chip = (label: string, val: string, color: string) => {
    ctx.font = `500 22px ${MONO}`;
    const txt = `${label} ${val}`;
    const w = ctx.measureText(txt).width + 36;
    roundRect(ctx, cx, 490, w, 44, 22); ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = C.muted; ctx.fillText(label, cx + 18, 518);
    const lw = ctx.measureText(label + ' ').width;
    ctx.fillStyle = color; ctx.fillText(val, cx + 18 + lw, 518);
    cx += w + 14;
  };
  chip(ja ? '目標' : 'par', String(d.par), C.paper);
  if (d.delay != null) chip(ja ? '遅延' : 'delay', String(d.delay), C.signal);
  if (d.optimal) chip('★', ja ? '最小' : 'optimal', C.brassB);

  // totals (the "compete on the whole run" hook) — right column, under the table
  ctx.fillStyle = C.muted; ctx.font = `500 22px ${MONO}`;
  ctx.fillText(ja ? '通算' : 'TOTAL', 760, 525);
  ctx.fillStyle = C.verd; ctx.font = `600 26px ${MONO}`;
  ctx.fillText(`NAND ${d.totalNands} · ★${d.stars} · ${d.cleared}`, 760, 558);

  // footer
  ctx.fillStyle = C.muted; ctx.font = `400 22px ${SANS}`;
  ctx.fillText(ja ? 'スイッチひとつから、CPUまで' : 'From a switch to a CPU', pad, H - 76);
  ctx.fillStyle = C.brass; ctx.font = `400 22px ${MONO}`;
  ctx.fillText(d.url.replace(/^https?:\/\//, ''), pad, H - 44);

  // right panel: the player's actual circuit (preferred), else the truth table
  if (d.circuit && d.circuit.nodes.length) {
    drawCircuitInto(ctx, 760, 150, W - 760 - pad, 330, d.circuit, ja ? '君の回路' : 'YOUR CIRCUIT');
  } else if (d.table && d.table.inputs.length <= 4) {
    const bx = 760, by = 150, bw = W - 760 - pad, bh = 330;
    roundRect(ctx, bx, by, bw, bh, 16); ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = C.muted; ctx.font = `500 18px ${MONO}`;
    ctx.fillText(ja ? '真理値表' : 'TRUTH TABLE', bx + 26, by + 36);
    const cols = [...d.table.inputs, '→', ...d.table.outputs];
    const n = cols.length;
    const x0 = bx + 30, colW = (bw - 56) / n;
    const headY = by + 74;
    ctx.font = `600 24px ${MONO}`; ctx.textAlign = 'center';
    cols.forEach((c, i) => { ctx.fillStyle = c === '→' ? C.faint : C.paper2; ctx.fillText(c, x0 + colW * (i + 0.5), headY); });
    const rowsToShow = d.table.rows.slice(0, 8);
    const rh = Math.min(30, (bh - 100) / rowsToShow.length);
    ctx.font = `500 24px ${MONO}`;
    rowsToShow.forEach((r, ri) => {
      const y = headY + 16 + rh * (ri + 1);
      let ci = 0;
      d.table!.inputs.forEach(nm => { const v = r.in[nm]; ctx.fillStyle = v ? C.signal : C.faint; ctx.fillText(String(v), x0 + colW * (ci++ + 0.5), y); });
      ctx.fillStyle = C.faint; ctx.fillText('', x0 + colW * (ci++ + 0.5), y);
      d.table!.outputs.forEach(nm => { const v = r.out[nm]; ctx.fillStyle = v ? C.signal : C.faint; ctx.fillText(String(v), x0 + colW * (ci++ + 0.5), y); });
    });
    ctx.textAlign = 'left';
  }

  return await new Promise<Blob>((resolve) => cv.toBlob(b => resolve(b!), 'image/png'));
}

/** Share an already-rendered card blob: native file-share where possible, else download + copy text. */
export async function dispatchShare(blob: Blob, text: string, url: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], 'karakuri.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text, url } as ShareData); return 'shared'; } catch { /* fall through */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'karakuri.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  try { await navigator.clipboard.writeText(text + ' ' + url); } catch { /* ignore */ }
  return 'downloaded';
}

/** Share the card: native file-share where possible, else download + copy text. */
export async function shareCard(d: CardData, text: string): Promise<'shared' | 'downloaded'> {
  const blob = await makeShareCard(d);
  const file = new File([blob], 'karakuri.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text, url: d.url } as ShareData); return 'shared'; } catch { /* fall through */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'karakuri.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  try { await navigator.clipboard.writeText(text + ' ' + d.url); } catch { /* ignore */ }
  return 'downloaded';
}
