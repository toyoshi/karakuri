/* Karakuri — hero canvas. A tiny living preview of the factory:
   source → belt → ×2 machine → belt → filter(even?) → two sinks.
   Pure canvas, DPR-aware, pauses when offscreen / reduced-motion. */
(() => {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const C = {
    ink: '#0f131a', line: 'rgba(255,255,255,0.10)', belt: '#1c2430', beltEdge: '#2c3848',
    brass: '#d8a657', brassB: '#f2c879', signal: '#6cc6ff', verd: '#57b09a', copper: '#d4805a',
    paper: '#f3efe6', muted: '#8b96a8'
  };

  let W = 0, H = 0, S = 0; // S = grid cell size
  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = r.width * dpr; canvas.height = r.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = r.width; H = r.height; S = W / 8;
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  // Layout in grid cells (col,row). 8x8 grid.
  // path: source(1,4) -> belt 2,3 -> machine(4,4) -> belt 5 -> filter(6,4) -> up/down sinks
  const cell = (c, r) => ({ x: c * S + S / 2, y: r * S + S / 2 });

  // Belt path as list of segments the tokens follow (in canvas coords).
  const path = [
    cell(0.6, 4), cell(3.4, 4)  // into machine
  ];
  const path2 = [ cell(4.6, 4), cell(5.4, 4) ]; // machine -> filter
  const pathEven = [ cell(6.4, 4), cell(7.4, 2.2) ]; // filter -> up sink (even)
  const pathOdd  = [ cell(6.4, 4), cell(7.4, 5.8) ]; // filter -> down sink (odd)

  const machine = cell(4, 4);
  const filter = cell(6, 4);
  const source = cell(0.6, 4);

  function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

  // Tokens: each has a value and a parametric position along the route.
  // route phases: 0 = source->machine, 1 = machine->filter, 2 = filter->sink
  let tokens = [];
  let nextVal = 1;
  let spawnT = 0;

  function spawn() {
    tokens.push({ v: nextVal, phase: 0, t: 0, doubled: false, even: null });
    nextVal = nextVal % 9 + 1;
  }

  const SPEED = 0.42; // phase units / sec

  function update(dt) {
    spawnT -= dt;
    if (spawnT <= 0 && tokens.length < 7) { spawn(); spawnT = 0.95; }
    for (const tk of tokens) {
      tk.t += SPEED * dt;
      if (tk.t >= 1) {
        tk.t = 0;
        if (tk.phase === 0) { tk.v *= 2; tk.doubled = true; tk.phase = 1; }
        else if (tk.phase === 1) { tk.even = (tk.v % 2 === 0); tk.phase = 2; }
        else { tk.done = true; }
      }
    }
    tokens = tokens.filter(t => !t.done);
  }

  function tokenPos(tk) {
    const e = (x) => x * x * (3 - 2 * x); // smoothstep for the turn
    if (tk.phase === 0) return lerp(path[0], path[1], tk.t);
    if (tk.phase === 1) return lerp(path2[0], path2[1], tk.t);
    const route = tk.even ? pathEven : pathOdd;
    return lerp(route[0], route[1], e(tk.t));
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, r);
  }

  function drawBeltSeg(a, b) {
    const w = S * 0.42;
    ctx.save();
    ctx.strokeStyle = C.belt; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = C.beltEdge; ctx.lineWidth = w; ctx.setLineDash([2, 6]);
    ctx.lineDashOffset = -(perf * 40 % 1000);
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.restore();
  }

  function drawMachine(p, label, color) {
    const s = S * 0.62;
    ctx.save();
    roundRect(p.x, p.y, s, s, 8);
    const g = ctx.createLinearGradient(p.x, p.y - s / 2, p.x, p.y + s / 2);
    g.addColorStop(0, '#222c3a'); g.addColorStop(1, '#161d27');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = color; ctx.stroke();
    // turning gear
    ctx.translate(p.x, p.y - s * 0.06);
    ctx.rotate(perf * 1.4);
    ctx.strokeStyle = color; ctx.globalAlpha = 0.35; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); }
    ctx.stroke();
    ctx.rotate(-perf * 1.4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = color; ctx.font = `600 ${S * 0.2}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, s * 0.04);
    ctx.restore();
  }

  function drawSource(p) {
    ctx.save();
    roundRect(p.x, p.y, S * 0.5, S * 0.7, 8);
    ctx.fillStyle = '#1a222e'; ctx.fill();
    ctx.strokeStyle = C.brass; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = C.brass; ctx.font = `${S * 0.26}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('源', p.x, p.y);
    ctx.restore();
  }

  function drawSink(p, color, glyph) {
    ctx.save();
    roundRect(p.x, p.y, S * 0.46, S * 0.46, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color; ctx.font = `${S * 0.2}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(glyph, p.x, p.y);
    ctx.restore();
  }

  function drawToken(tk) {
    const p = tokenPos(tk);
    const r = S * 0.17;
    let col = tk.doubled ? (tk.phase >= 2 ? (tk.even ? C.verd : C.copper) : C.brassB) : C.signal;
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0b0e13'; ctx.font = `600 ${r * 1.1}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(tk.v, p.x, p.y + 0.5);
    ctx.restore();
  }

  let perf = 0, last = 0, running = true;
  function frame(ts) {
    if (!running) return;
    const dt = Math.min((ts - last) / 1000 || 0, 0.05);
    last = ts; perf = ts / 1000;
    if (!reduced) update(dt);

    ctx.clearRect(0, 0, W, H);
    // belts
    drawBeltSeg(path[0], path[1]);
    drawBeltSeg(path2[0], path2[1]);
    drawBeltSeg(pathEven[0], pathEven[1]);
    drawBeltSeg(pathOdd[0], pathOdd[1]);
    // nodes
    drawSource(source);
    drawMachine(machine, '×2', C.brass);
    drawMachine(filter, '偶?', C.verd);
    drawSink(pathEven[1], C.verd, '偶');
    drawSink(pathOdd[1], C.copper, '奇');
    // tokens
    for (const tk of tokens) drawToken(tk);

    requestAnimationFrame(frame);
  }

  // pause when offscreen
  const vis = new IntersectionObserver((es) => {
    es.forEach(e => {
      if (e.isIntersecting && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
      else if (!e.isIntersecting) running = false;
    });
  }, { threshold: 0 });
  vis.observe(canvas);

  // seed a few so it isn't empty on load
  spawn(); tokens[0].t = 0.5;
  requestAnimationFrame(frame);
})();
