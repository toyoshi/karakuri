/* ============================================================
   KARAKURI — animated circuit clip (the "signals flowing" share video).
   Draws the player's circuit on a canvas with flowing wires and records
   a short looping WebM via MediaRecorder. Falls back to null (→ PNG)
   where MediaRecorder/captureStream isn't available.
   ============================================================ */
import type { CardData } from './sharecard';

const C = {
  ink: '#0b0e13', ink2: '#131822', line: 'rgba(255,255,255,0.10)',
  paper: '#f3efe6', muted: '#8b96a8', faint: '#5a6577',
  brass: '#d8a657', brassB: '#f2c879', verd: '#57b09a', signal: '#6cc6ff',
};
type Circuit = NonNullable<CardData['circuit']>;

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

/** one animated frame of the branded clip; `t` is seconds (drives the flow). */
export function drawClipFrame(ctx: CanvasRenderingContext2D, W: number, H: number, circ: Circuit, t: number, caption: string) {
  ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W - 180, -120, 60, W - 180, -120, 760);
  glow.addColorStop(0, 'rgba(216,166,87,0.16)'); glow.addColorStop(1, 'rgba(216,166,87,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
  for (let x = 48; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 48; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.globalAlpha = 1;

  // wordmark + caption
  ctx.fillStyle = C.paper; ctx.font = `600 30px "Fraunces", serif`; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillText('Karakuri', 56, 64);
  ctx.fillStyle = C.brass; ctx.font = `500 22px "JetBrains Mono", monospace`;
  ctx.fillText(caption, 56, H - 46);

  // fit circuit into a centered area
  const ax = 56, ay = 92, aw = W - 112, ah = H - 92 - 78;
  const s = Math.min(aw / (circ.w || 1), ah / (circ.h || 1));
  const ox = ax + (aw - circ.w * s) / 2, oy = ay + (ah - circ.h * s) / 2;
  const X = (x: number) => ox + x * s, Y = (y: number) => oy + y * s;

  // wires (lit ones get a moving dash = flowing signal)
  const dash = 2.5 * s + 1, gap = 15 * s + 4;
  for (const w of circ.wires) {
    const dx = Math.max(10, Math.abs(w.bx - w.ax) * 0.5) * s;
    const path = new Path2D();
    path.moveTo(X(w.ax), Y(w.ay));
    path.bezierCurveTo(X(w.ax) + dx, Y(w.ay), X(w.bx) - dx, Y(w.by), X(w.bx), Y(w.by));
    ctx.setLineDash([]); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = w.lit ? C.signal : C.ink2; ctx.lineWidth = Math.max(2, 3.5 * s); ctx.stroke(path);
    if (w.lit) {
      ctx.setLineDash([dash, gap]); ctx.lineDashOffset = -(t * (gap + dash) * 3) % 10000;
      ctx.strokeStyle = C.brassB; ctx.lineWidth = Math.max(2, 3.5 * s); ctx.stroke(path);
      ctx.setLineDash([]);
    }
  }
  // nodes
  for (const n of circ.nodes) {
    const x = X(n.x) + 3 * s, y = Y(n.y) + 3 * s, w = n.cw * s - 6 * s, h = n.ch * s - 6 * s;
    let fill = '#1b2330', stroke = C.muted;
    if (n.kind === 'chip' || n.kind === 'dff') { fill = '#1a2030'; stroke = C.verd; }
    else if (n.kind === 'input') { fill = n.on ? C.brass : '#221b10'; stroke = C.brass; }
    else if (n.kind === 'output') { fill = n.on ? C.signal : '#16202b'; stroke = n.on ? C.signal : C.muted; }
    if (n.kind === 'output') { ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, 6.2832); if (n.on) { ctx.shadowColor = C.signal; ctx.shadowBlur = 18 * s; } }
    else rr(ctx, x, y, w, h, 4 * s);
    ctx.fillStyle = fill; ctx.fill(); ctx.shadowBlur = 0; ctx.lineWidth = Math.max(1, 1.6 * s); ctx.strokeStyle = stroke; ctx.stroke();
    if (s > 0.4 && n.label) {
      ctx.fillStyle = (n.kind === 'input' && n.on) ? '#1a130a' : (n.kind === 'output' && n.on) ? '#04121d' : C.paper;
      ctx.font = `600 ${Math.round(11 * s + 3)}px "JetBrains Mono", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n.label, x + w / 2, y + h / 2);
    }
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

export function clipSupported(): boolean {
  try {
    return typeof MediaRecorder !== 'undefined'
      && typeof document.createElement('canvas').captureStream === 'function';
  } catch { return false; }
}

/** record a ~3.2s looping WebM of the circuit with flowing signals; null if unsupported */
export async function recordClip(circ: Circuit, caption: string): Promise<Blob | null> {
  if (!clipSupported() || !circ.nodes.length) return null;
  const W = 1200, H = 630;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'); if (!ctx) return null;
  try { await (document as any).fonts?.ready; } catch { /* ignore */ }
  let stream: MediaStream;
  try { stream = cv.captureStream(30); } catch { return null; }
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find(m => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) || 'video/webm';
  let rec: MediaRecorder;
  try { rec = new MediaRecorder(stream, { mimeType: mime }); } catch { return null; }
  const chunks: BlobPart[] = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise<Blob>(res => { rec.onstop = () => res(new Blob(chunks, { type: 'video/webm' })); });
  rec.start();
  const t0 = performance.now(), DUR = 3200;
  await new Promise<void>(res => {
    const frame = (now: number) => {
      const t = now - t0;
      drawClipFrame(ctx, W, H, circ, t / 1000, caption);
      if (t < DUR) requestAnimationFrame(frame); else { try { rec.stop(); } catch {} res(); }
    };
    requestAnimationFrame(frame);
  });
  return await done;
}

export async function shareClip(blob: Blob, text: string, url: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], 'karakuri.webm', { type: 'video/webm' });
  const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text, url } as ShareData); return 'shared'; } catch { /* fall */ }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'karakuri.webm';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  try { await navigator.clipboard.writeText(text + ' ' + url); } catch { /* ignore */ }
  return 'downloaded';
}
