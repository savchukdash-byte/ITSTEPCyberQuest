// CyberQuest — 2D-світ (вид згори): ходьба персонажем, NPC-квестодавці, стіл планування, серверна вежа.
window.World = (function () {
  const T = 48, W = 48, H = 30;
  const G = 0, ROAD = 1, FLOOR = 2, WALL = 3, TREE = 4, TABLE = 5, GATE = 6, PLAZA = 7, FOUNT = 8, DESK = 9;
  const SOLID = new Set([WALL, TREE, TABLE, GATE, FOUNT, DESK]);
  const map = [], tint = [];
  for (let y = 0; y < H; y++) { map.push(Array(W).fill(G)); tint.push(Array(W).fill(null)); }
  const set = (x, y, v, c) => { if (x >= 0 && y >= 0 && x < W && y < H) { map[y][x] = v; if (c) tint[y][x] = c; } };
  const rect = (x, y, w, h, v, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, v, c); };

  // дороги
  rect(0, 12, W, 3, ROAD); rect(16, 0, 2, H, ROAD); rect(31, 0, 2, H, ROAD);
  rect(18, 15, 13, 3, PLAZA);

  const buildings = [];
  function room(x, y, w, h, doorSide, name, color, icon) {
    rect(x, y, w, h, WALL, color); rect(x + 1, y + 1, w - 2, h - 2, FLOOR, color);
    const dx = x + Math.floor(w / 2) - 1;
    const dy = doorSide === 'bottom' ? y + h - 1 : y;
    set(dx, dy, FLOOR, color); set(dx + 1, dy, FLOOR, color);
    buildings.push({ x, y, w, h, name, color, icon, door: { x: dx, y: dy, side: doorSide } });
  }
  room(2, 2, 14, 9, 'bottom', 'ШКОЛА', '#2F6BFF', '🏫');
  room(19, 2, 12, 9, 'bottom', 'ШТАБ «ЩИТ»', '#8B5CF6', '🛡');
  room(34, 2, 12, 9, 'bottom', 'КЛУБ «СВІТ БЛОКІВ»', '#27D3F5', '🎮');
  room(2, 18, 12, 9, 'top', 'КАВ\'ЯРНЯ', '#FFD34D', '☕');
  room(34, 18, 12, 9, 'top', 'ФОТОЛАБ', '#2EE59D', '📷');
  room(19, 19, 12, 9, 'top', 'СЕРВЕРНА «СОНЯ_2014»', '#FF3B5C', '🤖');
  // ворота серверної
  const gate = buildings[5].door; set(gate.x, gate.y, GATE); set(gate.x + 1, gate.y, GATE);
  // меблі
  rect(22, 4, 6, 2, TABLE);                      // стіл планування
  rect(4, 4, 2, 1, DESK); rect(8, 4, 2, 1, DESK); rect(12, 4, 2, 1, DESK); rect(4, 7, 2, 1, DESK); rect(8, 7, 2, 1, DESK);
  rect(36, 4, 2, 1, DESK); rect(40, 4, 2, 1, DESK); rect(36, 7, 2, 1, DESK); rect(40, 7, 2, 1, DESK);
  rect(4, 21, 2, 2, DESK); rect(9, 21, 2, 2, DESK);
  rect(37, 21, 3, 1, DESK); rect(41, 23, 2, 2, DESK);
  rect(22, 22, 1, 4, DESK); rect(27, 22, 1, 4, DESK);
  set(24, 16, FOUNT); set(25, 16, FOUNT);
  [[1, 15], [5, 16], [9, 15], [13, 16], [19, 15], [29, 15], [35, 16], [40, 15], [45, 16], [1, 28], [15, 28], [18, 28], [30, 28], [33, 28], [46, 28], [0, 0], [47, 0], [33, 0], [15, 0], [47, 11], [0, 11]].forEach(([x, y]) => set(x, y, TREE));

  // ---------- стан ----------
  let cfg = null, canvas = null, ctx = null, host = null;
  const P = { x: 24.5 * T, y: 9 * T, dir: 'down', moving: false, phase: 0, tx: null, ty: null };
  const keys = {};
  let last = 0, cam = { x: 0, y: 0 }, near = null, blocked = false, running = false, t = 0;
  const particles = Array.from({ length: 40 }, () => ({ x: Math.random() * W * T, y: Math.random() * H * T, s: Math.random() * 0.5 + 0.2 }));

  const solidAt = (px, py) => {
    const tx = Math.floor(px / T), ty = Math.floor(py / T);
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
    const v = map[ty][tx];
    if (v === GATE && cfg && cfg.gateOpen()) return false;
    return SOLID.has(v) || npcAt(px, py);
  };
  function npcAt(px, py) {
    if (!cfg) return false;
    return cfg.npcs.some((n) => Math.abs(n.x * T - px) < 16 && Math.abs(n.y * T - py) < 12);
  }
  const blockedBox = (x, y) => solidAt(x - 13, y - 6) || solidAt(x + 13, y - 6) || solidAt(x - 13, y + 6) || solidAt(x + 13, y + 6);

  // ---------- малювання ----------
  function shade(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

  function drawTile(x, y) {
    const v = map[y][x], c = tint[y][x], px = x * T, py = y * T;
    if (v === G || v === TREE) {
      ctx.fillStyle = (x + y) % 2 ? '#0d1f2a' : '#0f2330'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = 'rgba(46,229,157,.12)'; ctx.fillRect(px + 10 + (x * 7) % 20, py + 12 + (y * 11) % 20, 3, 3);
    } else if (v === ROAD) {
      ctx.fillStyle = '#141826'; ctx.fillRect(px, py, T, T);
      if ((y === 13 && x % 3 === 0)) { ctx.fillStyle = 'rgba(39,211,245,.5)'; ctx.fillRect(px + 6, py + T / 2 - 2, 26, 4); }
      if ((x === 16 || x === 31) && y % 3 === 0 && (y < 12 || y > 14)) { ctx.fillStyle = 'rgba(39,211,245,.5)'; ctx.fillRect(px + T - 2, py + 6, 4, 26); }
    } else if (v === PLAZA || v === FOUNT) {
      ctx.fillStyle = (x + y) % 2 ? '#1a1f38' : '#1d2340'; ctx.fillRect(px, py, T, T);
      ctx.strokeStyle = 'rgba(139,92,246,.18)'; ctx.strokeRect(px + .5, py + .5, T - 1, T - 1);
    } else if (v === FLOOR || v === TABLE || v === DESK || v === GATE) {
      ctx.fillStyle = (x + y) % 2 ? '#161b33' : '#1a2040'; ctx.fillRect(px, py, T, T);
      ctx.strokeStyle = c ? shade(c, .12) : 'rgba(255,255,255,.05)'; ctx.strokeRect(px + .5, py + .5, T - 1, T - 1);
    } else if (v === WALL) {
      ctx.fillStyle = '#0a0d1a'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = c ? shade(c, .55) : '#333'; ctx.fillRect(px + 4, py + 4, T - 8, T - 8);
      ctx.fillStyle = c ? shade(c, .9) : '#555'; ctx.fillRect(px + 4, py + 4, T - 8, 5);
    }
  }
  function drawObj(x, y) {
    const v = map[y][x], px = x * T, py = y * T;
    if (v === TREE) {
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(px + T / 2, py + T - 6, 18, 7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(px + T / 2 - 4, py + T / 2, 8, T / 2 - 6);
      ctx.shadowColor = '#2EE59D'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#137a5a'; ctx.beginPath(); ctx.arc(px + T / 2, py + T / 2 - 6, 20, 0, 7); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#1fae7f'; ctx.beginPath(); ctx.arc(px + T / 2 - 6, py + T / 2 - 12, 9, 0, 7); ctx.fill();
    } else if (v === DESK) {
      ctx.fillStyle = '#2a3157'; ctx.fillRect(px + 3, py + 6, T - 6, T - 12);
      ctx.fillStyle = 'rgba(39,211,245,.8)'; ctx.fillRect(px + 12, py + 10, 22, 14);
    } else if (v === FOUNT) {
      ctx.fillStyle = '#2a3157'; ctx.beginPath(); ctx.arc(px + T, py + T / 2, 30, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(39,211,245,${0.5 + Math.sin(t * 3) * 0.2})`; ctx.beginPath(); ctx.arc(px + T, py + T / 2, 22, 0, 7); ctx.fill();
    } else if (v === GATE) {
      const open = cfg && cfg.gateOpen();
      ctx.fillStyle = open ? 'rgba(46,229,157,.25)' : `rgba(255,59,92,${0.55 + Math.sin(t * 6) * 0.2})`;
      ctx.fillRect(px, py + 10, T, 10);
      for (let i = 0; i < 4; i++) { ctx.fillStyle = open ? 'rgba(46,229,157,.6)' : 'rgba(255,255,255,.7)'; ctx.fillRect(px + 4 + i * 11, py + 12, 3, 6); }
    }
  }
  function drawTable() {
    const x = 22 * T, y = 4 * T, w = 6 * T, h = 2 * T;
    ctx.shadowColor = '#27D3F5'; ctx.shadowBlur = 20;
    ctx.fillStyle = '#0b1a2e'; ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(39,211,245,.55)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(x + 4 + i * (w - 8) / 12, y + 4); ctx.lineTo(x + 4 + i * (w - 8) / 12, y + h - 4); ctx.stroke(); }
    for (let j = 0; j <= 4; j++) { ctx.beginPath(); ctx.moveTo(x + 4, y + 4 + j * (h - 8) / 4); ctx.lineTo(x + w - 4, y + 4 + j * (h - 8) / 4); ctx.stroke(); }
    ctx.strokeStyle = '#FF3B5C'; ctx.lineWidth = 2; ctx.beginPath();
    [[.1, .3], [.3, .7], [.5, .25], [.7, .65], [.9, .35]].forEach(([a, b], i) => { const X = x + a * w, Y = y + b * h; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
    ctx.stroke();
    [[.1, .3], [.3, .7], [.5, .25], [.7, .65], [.9, .35]].forEach(([a, b], i) => { ctx.fillStyle = cfg && i < cfg.done() ? '#2EE59D' : '#FFD34D'; ctx.beginPath(); ctx.arc(x + a * w, y + b * h, 5, 0, 7); ctx.fill(); });
    ctx.lineWidth = 1;
  }

  function drawChar(x, y, look, dir, phase, moving) {
    const sw = moving ? Math.sin(phase) * 6 : 0, bob = moving ? Math.abs(Math.sin(phase)) * 2 : 0;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(x, y + 4, 15, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = look.pants || '#1d2440';
    ctx.fillRect(x - 9, y - 14 + sw * 0.3, 7, 16 - sw * 0.3); ctx.fillRect(x + 2, y - 14 - sw * 0.3, 7, 16 + sw * 0.3);
    ctx.fillStyle = look.body; roundRect(x - 13, y - 36 - bob, 26, 26, 8); ctx.fill();
    if (look.glow) { ctx.shadowColor = look.body; ctx.shadowBlur = 12; roundRect(x - 13, y - 36 - bob, 26, 26, 8); ctx.fill(); ctx.shadowBlur = 0; }
    ctx.fillStyle = look.skin || '#f2c6a8'; ctx.beginPath(); ctx.arc(x, y - 46 - bob, 12, 0, 7); ctx.fill();
    ctx.fillStyle = look.hair || '#3a2414';
    ctx.beginPath(); ctx.arc(x, y - 49 - bob, 12, Math.PI, 0); ctx.fill();
    if (look.long) ctx.fillRect(x - 12, y - 49 - bob, 5, 16), ctx.fillRect(x + 7, y - 49 - bob, 5, 16);
    if (dir !== 'up') {
      ctx.fillStyle = '#111';
      const ex = dir === 'left' ? -4 : dir === 'right' ? 4 : 0;
      ctx.fillRect(x - 5 + ex, y - 46 - bob, 3, 3); ctx.fillRect(x + 3 + ex, y - 46 - bob, 3, 3);
    }
    if (look.hat) { ctx.fillStyle = look.hat; ctx.fillRect(x - 13, y - 60 - bob, 26, 7); }
    if (look.emoji) { ctx.font = '18px Segoe UI Emoji'; ctx.textAlign = 'center'; ctx.fillText(look.emoji, x, y - 22 - bob); }
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function label(text, x, y, color = '#F4F7FF', size = 14) {
    ctx.font = `800 ${size}px Montserrat, Segoe UI, sans-serif`; ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 14;
    ctx.fillStyle = 'rgba(11,16,32,.8)'; roundRect(x - w / 2, y - size - 4, w, size + 10, 6); ctx.fill();
    ctx.fillStyle = color; ctx.fillText(text, x, y + 1);
  }

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; t += dt;
    if (!canvas || !canvas.isConnected) return;
    if (canvas.width !== host.clientWidth || canvas.height !== host.clientHeight) { canvas.width = host.clientWidth; canvas.height = host.clientHeight; }
    update(dt); draw();
  }

  function update(dt) {
    let vx = 0, vy = 0;
    if (!blocked) {
      if (keys.ArrowLeft || keys.KeyA) vx -= 1; if (keys.ArrowRight || keys.KeyD) vx += 1;
      if (keys.ArrowUp || keys.KeyW) vy -= 1; if (keys.ArrowDown || keys.KeyS) vy += 1;
      if (vx || vy) { P.tx = null; P.path = null; }
      else if (P.path && P.path.length) {
        const [wx, wy] = P.path[0], dx = wx - P.x, dy = wy - P.y, d = Math.hypot(dx, dy);
        if (d < 8) { P.path.shift(); if (!P.path.length) { P.path = null; P.tx = null; } }
        else { vx = dx / d; vy = dy / d; }
      }
    }
    const len = Math.hypot(vx, vy) || 1, sp = 230 * dt;
    P.moving = !!(vx || vy);
    if (P.moving) {
      const nx = P.x + (vx / len) * sp, ny = P.y + (vy / len) * sp;
      let movedAny = false;
      if (!blockedBox(nx, P.y)) { P.x = nx; movedAny = true; }
      if (!blockedBox(P.x, ny)) { P.y = ny; movedAny = true; }
      if (!movedAny) { P.tx = null; P.path = null; }
      P.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : (vy < 0 ? 'up' : 'down');
      P.phase += dt * 12;
      if (Math.floor(P.phase / Math.PI) !== Math.floor((P.phase - dt * 12) / Math.PI)) cfg.onStep && cfg.onStep();
    }
    // найближчий інтерактив
    near = null; let best = 115;
    for (const o of cfg.interactables()) {
      const d = Math.hypot(o.px - P.x, o.py - P.y);
      if (d < best) { best = d; near = o; }
    }
    if (P.pending && near && near.px === P.pending.px && near.py === P.pending.py && !blocked) {
      P.pending = null; P.path = null; P.tx = null; cfg.onInteract(near);
    }
    if (P.pending && !P.path) {
      const o = P.pending; P.pending = null;
      if (!blocked && Math.hypot(o.px - P.x, o.py - P.y) < 160) cfg.onInteract(o);
    }
    cam.x = Math.max(0, Math.min(W * T - canvas.width, P.x - canvas.width / 2));
    cam.y = Math.max(0, Math.min(H * T - canvas.height, P.y - canvas.height / 2));
    if (W * T < canvas.width) cam.x = (W * T - canvas.width) / 2;
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#070a14'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
    const x0 = Math.max(0, Math.floor(cam.x / T)), y0 = Math.max(0, Math.floor(cam.y / T));
    const x1 = Math.min(W, x0 + Math.ceil(canvas.width / T) + 2), y1 = Math.min(H, y0 + Math.ceil(canvas.height / T) + 2);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) drawTile(x, y);
    drawTable();
    // таблички будівель
    buildings.forEach((b) => {
      const cx = (b.x + b.w / 2) * T;
      ctx.shadowColor = b.color; ctx.shadowBlur = 16;
      label(`${b.icon} ${b.name}`, cx, b.y * T - 8, b.color, 16); ctx.shadowBlur = 0;
    });
    // сортування за y: об'єкти, NPC, гравець
    const ents = [];
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if ([TREE, DESK, FOUNT, GATE].includes(map[y][x])) ents.push({ y: y * T + T, f: () => drawObj(x, y) });
    cfg.npcs.forEach((n) => ents.push({ y: n.y * T, f: () => drawNpc(n) }));
    ents.push({ y: P.y, f: () => drawChar(P.x, P.y, cfg.playerLook, P.dir, P.phase, P.moving) });
    ents.sort((a, b) => a.y - b.y).forEach((e) => e.f());
    // частинки
    particles.forEach((p) => { p.y -= p.s; if (p.y < 0) p.y = H * T; ctx.fillStyle = 'rgba(39,211,245,.35)'; ctx.fillRect(p.x, p.y, 2, 2); });
    if (P.tx !== null) { ctx.strokeStyle = 'rgba(39,211,245,.7)'; ctx.beginPath(); ctx.arc(P.tx, P.ty, 10 + Math.sin(t * 8) * 3, 0, 7); ctx.stroke(); }
    // підказка взаємодії
    if (near && !blocked) label(`[E] ${near.verb}`, near.px, near.py - 78, '#FFD34D', 16);
    // стрілка до цілі
    const goal = cfg.goal && cfg.goal();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (goal) {
      const gx = goal.x - cam.x, gy = goal.y - cam.y;
      const onScreen = gx > 40 && gy > 40 && gx < canvas.width - 40 && gy < canvas.height - 40;
      if (!onScreen) {
        const cx = canvas.width / 2, cy = canvas.height / 2, a = Math.atan2(gy - cy, gx - cx);
        const r = Math.min(cx, cy) - 50, ax = cx + Math.cos(a) * r, ay = cy + Math.sin(a) * r;
        ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
        ctx.fillStyle = '#FFD34D'; ctx.shadowColor = '#FFD34D'; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-10, -14); ctx.lineTo(-4, 0); ctx.lineTo(-10, 14); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    drawMinimap();
  }

  function drawNpc(n) {
    const x = n.x * T, y = n.y * T;
    const idle = Math.sin(t * 2 + n.x) * 1.5;
    drawChar(x, y + idle * 0, n.look, 'down', 0, false);
    const st = cfg.npcState(n);
    label(n.name, x, y + 24, '#F4F7FF', 13);
    if (st === 'quest') {
      const by = y - 82 + Math.sin(t * 5) * 5;
      ctx.shadowColor = '#FFD34D'; ctx.shadowBlur = 20; ctx.fillStyle = '#FFD34D';
      ctx.font = '900 34px Montserrat, Segoe UI'; ctx.textAlign = 'center'; ctx.fillText('!', x, by); ctx.shadowBlur = 0;
    } else if (st === 'done') {
      ctx.fillStyle = '#2EE59D'; ctx.font = '900 24px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText('✔', x, y - 76);
    }
  }

  function drawMinimap() {
    const s = 4, mw = W * s, mh = H * s, ox = canvas.width - mw - 14, oy = canvas.height - mh - 14;
    ctx.fillStyle = 'rgba(11,16,32,.85)'; ctx.fillRect(ox - 4, oy - 4, mw + 8, mh + 8);
    ctx.strokeStyle = 'rgba(39,211,245,.6)'; ctx.strokeRect(ox - 4, oy - 4, mw + 8, mh + 8);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = map[y][x];
      if (v === WALL) ctx.fillStyle = tint[y][x] || '#555';
      else if (v === ROAD) ctx.fillStyle = '#222838';
      else if (v === G || v === TREE) continue;
      else ctx.fillStyle = '#2a2f4a';
      ctx.fillRect(ox + x * s, oy + y * s, s, s);
    }
    cfg.npcs.forEach((n) => { if (cfg.npcState(n) === 'quest') { ctx.fillStyle = '#FFD34D'; ctx.fillRect(ox + n.x * s - 3, oy + n.y * s - 3, 6, 6); } });
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ox + (P.x / T) * s, oy + (P.y / T) * s, 3.5, 0, 7); ctx.fill();
  }

  // ---------- пошук шляху (BFS по клітинках) ----------
  function walkable(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const v = map[y][x];
    if (v === GATE) return cfg.gateOpen();
    if (cfg.npcs.some((n) => Math.floor(n.x) === x && Math.floor(n.y) === y)) return false;
    return !SOLID.has(v);
  }
  function findPath(wx, wy) {
    const sx = Math.floor(P.x / T), sy = Math.floor(P.y / T);
    let tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    if (!walkable(tx, ty)) {
      let best = null;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1], [0, 2]]) if (walkable(tx + dx, ty + dy)) { best = [tx + dx, ty + dy]; break; }
      if (!best) return null; [tx, ty] = best;
    }
    const prev = new Map(), key = (x, y) => y * W + x, q = [[sx, sy]];
    prev.set(key(sx, sy), null);
    while (q.length) {
      const [x, y] = q.shift();
      if (x === tx && y === ty) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (!prev.has(k) && walkable(nx, ny)) { prev.set(k, [x, y]); q.push([nx, ny]); }
      }
    }
    if (!prev.has(key(tx, ty))) return null;
    const path = []; let c = [tx, ty];
    while (c) { path.unshift([(c[0] + 0.5) * T, (c[1] + 0.6) * T]); c = prev.get(key(c[0], c[1])); }
    path.shift();
    if (path.length) path[path.length - 1] = [Math.min(Math.max(wx, tx * T + 14), tx * T + T - 14), Math.min(Math.max(wy, ty * T + 8), ty * T + T - 8)];
    return path;
  }

  // ---------- ввід ----------
  window.addEventListener('keydown', (e) => {
    if (!running) return;
    keys[e.code] = true;
    if (blocked) return;
    if ((e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') && near) { e.preventDefault(); cfg.onInteract(near); }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  return {
    T,
    init(c) { cfg = c; },
    attach(el) {
      host = el;
      if (!canvas) {
        canvas = document.createElement('canvas'); ctx = canvas.getContext('2d');
        canvas.addEventListener('mousedown', (e) => {
          if (blocked) return;
          const r = canvas.getBoundingClientRect(), wx = e.clientX - r.left + cam.x, wy = e.clientY - r.top + cam.y;
          if (near && Math.hypot(wx - near.px, wy - (near.py - 30)) < 50) { cfg.onInteract(near); return; }
          const hit = cfg.interactables().find((o) => Math.abs(wx - o.px) < 40 && wy > o.py - 105 && wy < o.py + 30);
          P.pending = hit || null;
          const path = hit ? findPath(hit.px, hit.py + T * 0.9) || findPath(hit.px, hit.py - T * 0.9) || findPath(hit.px + T, hit.py) || findPath(hit.px - T, hit.py) : findPath(wx, wy);
          if (path) { P.path = path; P.tx = path[path.length - 1][0]; P.ty = path[path.length - 1][1]; }
        });
      }
      el.appendChild(canvas);
      if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    },
    stop() { running = false; for (const k in keys) keys[k] = false; },
    block(b) { blocked = b; if (b) { P.tx = null; P.path = null; for (const k in keys) keys[k] = false; } },
    reset() { P.x = 24.5 * T; P.y = 9 * T; P.dir = 'down'; P.tx = null; P.path = null; },
    player: P,
    buildings,
    _dbg: { findPath, walkable, interactables: () => cfg.interactables() },
  };
})();
