// CyberQuest «Кібердетектив» — ігровий рушій.
(function () {
  try { const ext = window.cq && window.cq.externalPack(); if (ext) new Function(ext)(); } catch (e) { console.warn(e); }

  const P = window.PACK, A = window.SFX;
  const app = document.getElementById('app');
  const fxLayer = document.getElementById('fx');
  const MISSIONS = [...P.missions, { ...P.final, final: true }];
  const TOOLS = Object.keys(P.tools);
  const LOGO = '../assets/logo.png';
  // Хронометраж (діти 9–14, ~30 хв). Можна перевизначити в pack.js → timing.
  const TM = Object.assign({
    targetMinutes: 30, chatSeconds: 25, bossChatSeconds: 18, sortSeconds: 9, finalSortSeconds: 7,
    scanSeconds: 150, lockSeconds: 75, helpAfterErrors: 2, missionMinutes: [4.5, 4.5, 3.5, 4, 3.5, 5, 2.5],
  }, P.timing || {});

  const S = {
    screen: 'start', team: '', players: 3, shield: 100, score: 0, combo: 1,
    m: 0, sc: 0, keys: [], stars: [], t0: 0, tEnd: 0, pauseAt: 0, pause: false,
    exitOpen: false, logoClicks: 0, logoT: 0, mStartShield: 100, done: 0,
  };
  S.metCmd = false; S.dialog = null;
  let SS = {};           // стан поточної сцени
  let timers = [];       // таймери сцени (чистяться при зміні)

  // ---------- утиліти ----------
  const $ = (s) => document.querySelector(s);
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const every = (fn, ms) => { const id = setInterval(fn, ms); timers.push(id); return id; };
  const clearTimers = () => { timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = []; };
  const shuffle = (n) => { let r; do { r = [...Array(n).keys()].sort(() => Math.random() - 0.5); } while (n > 1 && r.every((v, i) => v === i)); return r; };
  const fmt = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  const elapsed = () => Math.floor(((S.tEnd || (S.pause ? S.pauseAt : Date.now())) - S.t0) / 1000);
  const mission = () => MISSIONS[S.m];
  const scene = () => mission().scenes[S.sc];

  function toast(text, kind = '', ms = 2200) {
    fxLayer.querySelectorAll('.toast').forEach((o) => o.remove());
    const d = document.createElement('div');
    d.className = 'toast ' + kind; d.innerHTML = text;
    fxLayer.appendChild(d); setTimeout(() => d.remove(), ms);
  }
  function floatPts(text, kind = 'good') {
    const d = document.createElement('div');
    d.className = 'pts ' + kind; d.textContent = text;
    fxLayer.appendChild(d); setTimeout(() => d.remove(), 1200);
  }
  function shake() { document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake'); }
  function flash(kind) { const d = document.createElement('div'); d.className = 'flash ' + kind; fxLayer.appendChild(d); setTimeout(() => d.remove(), 500); }

  function gain(base) {
    const pts = base * S.combo; S.score += pts; floatPts('+' + pts + (S.combo > 1 ? ' ×' + S.combo : ''));
    S.combo = Math.min(S.combo + 1, 5); updHud();
  }
  // ---------- ТЕМП І ДОПОМОГА ----------
  const chatT = () => (scene().boss ? TM.bossChatSeconds : TM.chatSeconds);
  const missionOver = () => S.mStart && (Date.now() - S.mStart) / 60000 > (TM.missionMinutes[S.m] || 4);
  const gameOver30 = () => S.t0 && elapsed() > TM.targetMinutes * 60;
  const help = () => (gameOver30() || missionOver() ? 2 : (SS.err || 0) >= TM.helpAfterErrors ? 1 : 0);

  function damage(n, why) {
    SS.err = (SS.err || 0) + 1;
    S.shield = Math.max(0, S.shield - n); S.combo = 1;
    A.play('buzz'); shake(); flash('bad'); floatPts('−' + n + ' ЩИТ', 'bad');
    if (why) toast('✖ ' + why, 'bad', 2600);
    updHud();
    if (S.screen === 'scene' && SS.type !== 'sort' && S.shield > 0) render(); // показати підказку після помилки
    if (S.shield <= 0) later(() => { clearTimers(); S.screen = 'broken'; A.play('fail'); render(); }, 700);
  }

  // ---------- HUD ----------
  function hud() {
    const keys = P.missions.map((_, i) => `<div class="key ${S.keys[i] ? 'on' : ''}">${S.keys[i] ? '🔑' : i + 1}</div>`).join('');
    const sh = S.shield;
    return `<header>
      <img id="logo" src="${LOGO}" alt="ITSTEP">
      <div class="ttl">${P.meta.title}<small>${P.meta.subtitle}${S.team ? ' · ' + S.team : ''}</small></div>
      ${S.t0 ? `<div class="shield"><span>🛡 ЩИТ</span><div class="bar"><i id="shbar" style="width:${sh}%" class="${sh < 35 ? 'low' : ''}"></i></div><b id="shval">${sh}%</b></div>
      <div class="score mono"><span id="score">${S.score}</span><small id="combo">${S.combo > 1 ? '×' + S.combo : ''}</small></div>` : '<div class="sp"></div>'}
      <div class="keys">${keys}</div>
      <div class="tm mono ${gameOver30() ? 'over' : ''}" id="tm" title="Час гри / ціль">${S.t0 ? fmt(elapsed()) + `<small> / ${TM.targetMinutes}:00</small>` : ''}</div>
      ${S.t0 && !['start', 'cert'].includes(S.screen) ? '<button class="icon" data-act="mentor" title="Покликати ментора">🙋</button>' : ''}
      <button class="icon" data-act="mute" title="Звук">${A.muted ? '🔇' : '🔊'}</button>
    </header>`;
  }
  function updHud() {
    const b = $('#shbar'); if (b) { b.style.width = S.shield + '%'; b.className = S.shield < 35 ? 'low' : ''; }
    const v = $('#shval'); if (v) v.textContent = S.shield + '%';
    const s = $('#score'); if (s) s.textContent = S.score;
    const c = $('#combo'); if (c) c.textContent = S.combo > 1 ? '×' + S.combo : '';
  }

  // ---------- СЦЕНИ: старт ----------
  function startScene() {
    clearTimers();
    const sc = scene();
    SS = { type: sc.type, err: 0 };
    if (sc.type === 'scan' && sc.variants) {
      // випадкове фото з набору (без тих, що не завантажились)
      const pool = sc.variants.filter((v) => !v.broken);
      Object.assign(sc, pool[Math.floor(Math.random() * pool.length)] || sc.variants[0]);
    }
    if (sc.type === 'scan') {
      SS.tool = null; SS.found = []; SS.time = TM.scanSeconds;
      SS.total = sc.parts.filter((p) => p.f).length;
      every(() => tickTime(sc), 1000);
    } else if (sc.type === 'chat') {
      SS.log = []; SS.round = 0; SS.hp = sc.rounds.length; SS.opts = false; SS.typing = false; SS.time = chatT();
      SS.smsShown = false;
      queue(sc.intro.map((t) => ({ who: 'them', t })), () => showRound());
      every(() => { if (SS.opts && !S.pause) { SS.time--; const el = $('#ctime'); if (el) { el.textContent = SS.time; el.parentElement.className = 'ctimer' + (SS.time <= 5 ? ' hot' : ''); } if (SS.time <= 5 && SS.time > 0) A.play('tick'); if (SS.time <= 0) chatTimeout(); } }, 1000);
    } else if (sc.type === 'sort') {
      SS.i = 0; SS.y = 0; SS.ok = 0; SS.busy = false;
      startCard();
    } else if (sc.type === 'lock') {
      SS.next = 0; SS.layout = shuffle(sc.items.length); SS.time = TM.lockSeconds;
      every(() => tickTime(sc), 1000);
    } else if (sc.type === 'cut') {
      SS.n = 0;
      sc.lines.forEach((_, i) => later(() => { SS.n = i + 1; A.play('alarm'); render(); }, 700 + i * 1300));
    }
    S.screen = 'scene'; render();
  }

  function tickTime(sc) {
    if (S.pause) return;
    SS.time--;
    const el = $('#stime'); if (el) { el.textContent = fmt(Math.max(0, SS.time)); el.className = 'stime mono' + (SS.time <= 10 ? ' hot' : ''); }
    if (SS.time <= 10 && SS.time > 0) A.play('tick');
    if (SS.time <= 0) { SS.time = 30; damage(15, 'Час вийшов! ЩИТ втрачає енергію. +30 секунд.'); }
  }

  function sceneClear(msg) {
    clearTimers();
    A.play('win'); flash('good');
    gain(200);
    toast('✔ ' + (msg || 'Сцену пройдено!'), 'good', 2000);
    S.screen = 'clear'; render();
    later(() => {
      S.sc++;
      if (S.sc >= mission().scenes.length) missionDone(); else startScene();
    }, 1800);
  }

  function missionDone() {
    clearTimers();
    const lost = S.mStartShield - S.shield;
    const stars = lost <= 10 ? 3 : lost <= 35 ? 2 : 1;
    S.stars[S.m] = stars;
    if (mission().final) { S.tEnd = Date.now(); S.screen = 'cert'; A.play('key'); render(); return; }
    S.keys[S.m] = true; S.done = Math.max(S.done, S.m + 1);
    S.shield = Math.min(100, S.shield + 30);
    S.screen = 'key'; A.play('key'); render();
  }

  // ---------- CHAT ----------
  function queue(msgs, then) {
    let d = 300;
    msgs.forEach((m) => {
      later(() => { SS.typing = true; render(); A.play('type'); }, d);
      d += 700 + Math.min(1400, m.t.length * 22);
      later(() => { SS.typing = false; SS.log.push({ ...m, fresh: true }); A.play('msg'); render(); }, d);
      d += 250;
    });
    later(then, d + 100);
  }
  function showRound() {
    const sc = scene(), r = sc.rounds[SS.round];
    if (sc.sms && !SS.smsShown) { SS.smsShown = true; later(() => { A.play('alarm'); render(); }, 0); }
    SS.roundErr = 0;
    queue(r.them.map((t) => ({ who: 'them', t })), () => { SS.opts = true; SS.time = chatT(); SS.order = shuffle(r.opts.length); render(); });
  }
  function chatPick(i) {
    if (!SS.opts) return;
    const sc = scene(), r = sc.rounds[SS.round], o = r.opts[i];
    SS.opts = false;
    SS.log.push({ who: 'me', t: o.t, fresh: true }); A.play('send'); render();
    if (o.good) {
      later(() => {
        SS.hp--; A.play('hit'); gain(150); toast('✔ ' + o.why, 'good', 2400);
        SS.round++;
        if (SS.round >= sc.rounds.length) {
          SS.log.push({ who: 'sys', t: '⛔ Користувача заблоковано', fresh: true }); render();
          later(() => sceneClear(sc.win), 1400);
        } else { render(); later(showRound, 900); }
      }, 500);
    } else {
      later(() => {
        SS.roundErr = (SS.roundErr || 0) + 1;
        damage(15, o.why);
        if (S.shield > 0) { render(); later(() => queue([{ who: 'them', t: pushLine() }], () => { SS.opts = true; SS.time = chatT(); SS.order = shuffle(r.opts.length); render(); }), 900); }
      }, 500);
    }
  }
  const PUSH = ['Ха-ха, дякую 😈 Але мені треба ще!', 'Бачиш, як просто? Давай далі!', 'Чудово… А тепер ще одне.', 'Ти мені довіряєш, правда? 😏'];
  const pushLine = () => PUSH[Math.floor(Math.random() * PUSH.length)];
  function chatTimeout() {
    SS.opts = false;
    damage(10, 'Ти мовчиш надто довго — шахрай тисне!');
    SS.roundErr = (SS.roundErr || 0) + 1;
    if (S.shield > 0) { render(); queue([{ who: 'them', t: 'Ну що, мовчиш? Швидше відповідай!!' }], () => { SS.opts = true; SS.time = chatT(); render(); }); }
  }

  // ---------- SORT (аркада) ----------
  function startCard() {
    const sc = scene();
    if (SS.i >= sc.items.length) { sceneClear('Потік відбито: ' + SS.ok + ' / ' + sc.items.length); return; }
    SS.y = 0; SS.busy = false; render();
    const dur = (mission().final ? TM.finalSortSeconds : TM.sortSeconds) * 1000;
    let t0 = performance.now(), pausedAt = 0;
    const step = (now) => {
      if (SS.type !== 'sort' || SS.busy || S.screen !== 'scene') return;
      if (S.pause) { if (!pausedAt) pausedAt = now; SS.raf = requestAnimationFrame(step); return; }
      if (pausedAt) { t0 += now - pausedAt; pausedAt = 0; }
      SS.y = Math.min(1, (now - t0) / dur);
      const c = $('#fall'); if (c) c.style.top = (8 + SS.y * 62) + "%";
      if (SS.y >= 1) { sortAnswer(null); return; }
      SS.raf = requestAnimationFrame(step);
    };
    SS.raf = requestAnimationFrame(step);
  }
  function sortAnswer(dangerous) {
    if (SS.busy || SS.type !== 'sort') return;
    SS.busy = true; cancelAnimationFrame(SS.raf);
    const it = scene().items[SS.i];
    const c = $('#fall');
    if (dangerous === null) { damage(10, 'Повідомлення проскочило! Треба вирішувати швидше.'); }
    else if (dangerous === it.bad) { SS.ok++; A.play('ping'); gain(100); if (c) c.classList.add(dangerous ? 'goR' : 'goL'); }
    else { damage(10, it.bad ? 'Це було небезпечно!' : 'Це було безпечне повідомлення.'); if (c) c.classList.add('wrong'); }
    SS.i++;
    if (S.shield > 0) later(startCard, 550);
  }

  // ---------- SCAN ----------
  function scanClick(i) {
    const sc = scene(), p = sc.parts[i];
    if (SS.found.includes(i)) return;
    if (!SS.tool) { A.play('buzz'); toast('Спершу увімкни інструмент агента внизу екрана', 'warn'); return; }
    const kind = p.f ? p.f.tool : p.tool;
    if (p.f && kind !== SS.tool) {
      A.play('click');
      toast(`Цей інструмент тут нічого не бачить. Спробуй інший!`, 'warn', 2200);
      return;
    }
    if (p.f) {
      SS.found.push(i); A.play('ping'); gain(100); toast('🔎 ' + p.f.why, 'good', 2600); render();
      if (SS.found.length === SS.total && sc.fake) later(() => toast('Усі докази знайдено! Виноси вердикт «ФЕЙК»', 'warn', 2600), 600);
    } else {
      damage(10, 'Тут усе гаразд — хибна тривога.');
      SS.miss = i; render(); later(() => { SS.miss = null; render(); }, 600);
    }
  }
  function verdict(fake) {
    const sc = scene();
    if (fake && !sc.fake) return damage(20, 'Це було безпечно! Не все в мережі — загроза.');
    if (!fake && sc.fake) return damage(20, 'Це був ФЕЙК! Шукай докази уважніше.');
    if (fake && SS.found.length < SS.total) { A.play('buzz'); toast(`Недостатньо доказів: ${SS.found.length} / ${SS.total}`, 'warn'); return; }
    sceneClear(fake ? 'Фейк викрито!' : 'Правильно: це безпечно.');
  }

  // Фото не знайдено на диску: беремо інший варіант, а необов'язкову сцену пропускаємо
  window.__cqImgFail = (el) => {
    const sc = scene();
    if (S.screen !== 'scene' || SS.type !== 'scan' || !el.src.endsWith(sc.img)) return;
    if (sc.variants) {
      const v = sc.variants.find((x) => x.img === sc.img); if (v) v.broken = true;
      if (sc.variants.some((x) => !x.broken)) { startScene(); return; }
    }
    if (sc.optional) { clearTimers(); S.sc++; if (S.sc >= mission().scenes.length) missionDone(); else startScene(); }
  };

  // ---------- LOCK ----------
  function lockPick(idx) {
    const sc = scene();
    if (idx === SS.next) {
      SS.next++; A.play('ping'); gain(50); render();
      if (SS.next >= sc.items.length) later(() => sceneClear('Протокол активовано!'), 400);
    } else {
      SS.next = 0; damage(5, 'Не той крок — протокол скинуто!'); SS.layout = shuffle(sc.items.length); render();
    }
  }

  // ---------- РЕНДЕР СЦЕН ----------
  function photoSvg() {
    return `<svg viewBox="0 0 600 400" preserveAspectRatio="none" class="photo"><defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b2a6b"/><stop offset="1" stop-color="#1a2a5a"/></linearGradient>
      <radialGradient id="sk" cx=".45" cy=".4"><stop offset="0" stop-color="#ffd9c2"/><stop offset="1" stop-color="#e9a98a"/></radialGradient></defs>
      <rect width="600" height="400" fill="url(#pg)"/>
      <rect x="390" y="30" width="190" height="70" rx="10" fill="#ff3b5c" opacity=".85"/><text x="485" y="75" text-anchor="middle" font-size="28" font-weight="800" fill="#fff" font-family="Arial">ЛКЗО ФАЖ</text>
      <ellipse cx="300" cy="370" rx="150" ry="18" fill="#000" opacity=".35" transform="skewX(30)"/><ellipse cx="300" cy="380" rx="120" ry="14" fill="#000" opacity=".3" transform="skewX(-35) translate(300,0)"/>
      <path d="M190 400 Q200 280 300 270 Q400 280 410 400Z" fill="#8b5cf6"/>
      <path d="M215 190 Q205 70 300 70 Q400 70 390 200 Q395 250 380 280 L220 280 Q205 250 215 190Z" fill="#5a3a22"/>
      <ellipse cx="300" cy="175" rx="72" ry="88" fill="url(#sk)"/>
      <ellipse cx="270" cy="160" rx="11" ry="8" fill="#fff"/><circle cx="274" cy="162" r="6" fill="#2f6bff"/><circle cx="276" cy="159" r="2" fill="#fff"/>
      <ellipse cx="330" cy="160" rx="11" ry="8" fill="#fff"/><circle cx="322" cy="157" r="6" fill="#2ee59d"/><circle cx="318" cy="161" r="2.5" fill="#fff"/>
      <path d="M278 215 Q300 232 322 215" stroke="#b5544a" stroke-width="5" fill="none"/>
      <circle cx="372" cy="198" r="7" fill="#ffd34d"/><path d="M372 205 Q382 215 390 205" stroke="#5a3a22" stroke-width="6" fill="none"/>
      <g fill="url(#sk)"><rect x="60" y="270" width="70" height="60" rx="18"/>${[0, 1, 2, 3, 4, 5].map((k) => `<rect x="${55 + k * 13}" y="${222 + Math.abs(k - 2.5) * 6}" width="11" height="55" rx="5"/>`).join('')}</g>
    </svg>`;
  }

  function sceneHtml() {
    const sc = scene(), m = mission();
    const head = `<div class="row"><span class="chip"><i></i>${m.final ? 'ФІНАЛ' : 'Місія ' + m.id}: ${m.title}</span>
      <span class="chip ghost">сцена ${S.sc + 1} / ${m.scenes.length}</span><div class="sp"></div>
      ${SS.time !== undefined && (sc.type === 'scan' || sc.type === 'lock') ? `<span class="stime mono" id="stime">${fmt(SS.time)}</span>` : ''}</div>
      <h2>${sc.title}</h2>${sc.task ? `<div class="muted">${sc.task}</div>` : ''}`;

    if (sc.type === 'scan') {
      const hl = help(), nf = sc.parts.findIndex((p, i) => p.f && !SS.found.includes(i));
      const hintOn = hl > 0 && sc.fake && nf >= 0;
      const hintTool = hintOn ? sc.parts[nf].f.tool : null;
      const hintVerdict = hl > 0 && (sc.fake ? nf < 0 : true) ? (sc.fake ? '1' : '0') : null;
      const parts = sc.parts.map((p, i) => {
        const kind = p.f ? p.f.tool : p.tool;
        const cls = ['part', 'k-' + p.k, SS.found.includes(i) ? 'found' : '', SS.tool && kind === SS.tool ? 'cand' : '', SS.miss === i ? 'miss' : '', hintOn && i === nf && SS.tool === kind ? 'hint' : ''].join(' ');
        if (p.k === 'spot') return `<div class="${cls}" data-act="part" data-i="${i}" style="left:${p.x}%;top:${p.y}%;width:${p.w}%;height:${p.h}%"></div>`;
        if (p.k === 'avatar') return `<div class="${cls}" data-act="part" data-i="${i}">${p.t}</div>`;
        return `<div class="${cls}" data-act="part" data-i="${i}">${p.t}${SS.found.includes(i) ? ' <b class="tag">ДОКАЗ</b>' : ''}</div>`;
      }).join('');
      const tools = TOOLS.map((t) => `<button class="toolbtn ${SS.tool === t ? 'on' : ''} ${hintTool === t && SS.tool !== t ? 'hint' : ''}" data-act="tool" data-t="${t}">
        <span class="ti">${P.tools[t].icon}</span><span>${P.tools[t].name}<small>клавіша ${TOOLS.indexOf(t) + 1}</small></span></button>`).join('');
      const evidence = SS.found.map((i) => `<div class="ev">${P.tools[sc.parts[i].f.tool].icon} ${sc.parts[i].f.why}</div>`).join('');
      return `<main class="scan">${head}
        <div class="scanwrap">
          <div class="device d-${sc.device} ${SS.tool ? 'scanning' : ''}">${sc.device === 'photo'
            ? `<div class="photobox" style="aspect-ratio:${sc.ar || '3 / 2'}">${sc.img ? `<img class="photo" src="${sc.img}" alt="" draggable="false" onerror="window.__cqImgFail && window.__cqImgFail(this)">` : photoSvg()}<div class="parts">${parts}</div></div>`
            : `<div class="parts">${parts}</div>`}<div class="beam"></div></div>
          <div class="board card"><h3>Дошка доказів <span class="mono">${SS.found.length} / ?</span></h3>${evidence || '<div class="muted">Поки порожньо…</div>'}
            ${hintOn ? `<div class="helpnote">💡 Командир: спробуй <b>${P.tools[hintTool].icon} ${P.tools[hintTool].name}</b> — там ще є доказ.</div>` : ''}
            <div class="verd"><button class="btn green ${hintVerdict === '0' ? 'hint' : ''}" data-act="verdict" data-v="0">✔ БЕЗПЕЧНО</button><button class="btn red ${hintVerdict === '1' ? 'hint' : ''}" data-act="verdict" data-v="1">⚠ ФЕЙК</button></div></div>
        </div>
        <div class="tools">${tools}</div></main>`;
    }

    if (sc.type === 'chat') {
      const w = sc.who;
      const log = SS.log.map((l) => `<div class="bub ${l.who} ${l.fresh ? 'fresh' : ''}">${l.t}</div>`).join('');
      const r = sc.rounds[SS.round];
      const opts = SS.opts && r ? `<div class="replies"><div class="ctimer"><span id="ctime">${SS.time}</span>с</div>${(SS.order || r.opts.map((_, i) => i)).map((i) => `<button class="reply ${r.opts[i].good && ((SS.roundErr || 0) >= 1 || help() === 2) ? 'hint' : ''}" data-act="reply" data-i="${i}">${r.opts[i].t}</button>`).join('')}</div>` : '<div class="replies wait muted">…</div>';
      const hp = Array.from({ length: sc.rounds.length }, (_, i) => `<i class="${i < SS.hp ? 'on' : ''}"></i>`).join('');
      SS.log.forEach((l) => (l.fresh = false));
      return `<main class="chatscene">${head}
        <div class="chatwrap">
          <div class="phone">
            ${sc.sms && SS.smsShown ? `<div class="sms">💬 СМС · ${sc.sms}</div>` : ''}
            <div class="chead"><div class="ava">${w.ava}</div><div><b>${w.name}</b><small>${SS.typing ? 'друкує…' : w.sub}</small></div>
              <div class="sp"></div><div class="bosshp ${sc.boss ? 'boss' : ''}"><span>${sc.boss ? 'БОС' : 'Захист шахрая'}</span><div>${hp}</div></div></div>
            <div class="clog" id="clog">${log}${SS.typing ? '<div class="bub them typing"><span></span><span></span><span></span></div>' : ''}</div>
          </div>
          <div class="side card"><h3>Твоя відповідь</h3><div class="muted">Кожна правильна відповідь пробиває захист шахрая. Помилка коштує енергії ЩИТа. Таймер не чекає!</div>${opts}</div>
        </div></main>`;
    }

    if (sc.type === 'sort') {
      const it = sc.items[SS.i];
      const l = sc.left || 'Безпечно', r = sc.right || 'Небезпечно';
      return `<main class="sortscene">${head}
        <div class="arena">
          <div class="lane L" data-act="sort" data-v="0"><span>← ${l}</span></div>
          <div class="lane R" data-act="sort" data-v="1"><span>${r} →</span></div>
          ${it ? `<div class="fall" id="fall" style="top:${8 + SS.y * 62}%">${it.t}</div>` : ''}
          <div class="prog mono">${Math.min(SS.i + 1, sc.items.length)} / ${sc.items.length}</div>
        </div>
        <div class="muted center">Клавіші ← / → або натисни на половину екрана</div></main>`;
    }

    if (sc.type === 'lock') {
      const tiles = SS.layout.map((idx) => `<button class="tile ${idx < SS.next ? 'lit' : ''} ${idx === SS.next && help() > 0 ? 'hint' : ''}" data-act="lock" data-i="${idx}" ${idx < SS.next ? 'disabled' : ''}>${idx < SS.next ? `<b>${idx + 1}</b>` : ''}${sc.items[idx]}</button>`).join('');
      const slots = sc.items.map((t, i) => `<div class="slot ${i < SS.next ? 'on' : ''}">${i < SS.next ? t : i + 1}</div>`).join('<div class="wire"></div>');
      return `<main class="lockscene">${head}<div class="circuit">${slots}</div><div class="tiles">${tiles}</div></main>`;
    }

    if (sc.type === 'cut') {
      return `<main>${head}<div class="center stack" style="max-width:900px"><div class="card timeline">${sc.lines.slice(0, SS.n).map((l) => `<p>${l}</p>`).join('')}</div>
        ${SS.n >= sc.lines.length ? '<div class="muted">Цього не сталося — бо ти не надіслав код. 💪</div><button class="btn" data-act="cutnext">Далі →</button>' : ''}</div></main>`;
    }
    return '';
  }

  // ---------- СВІТ ----------
  const W = window.World, T = W.T;
  const NPCS = [
    { id: 'cmd', name: 'Командир ЩИТ', x: 21.5, y: 8, look: { body: '#8B5CF6', glow: true, hair: '#cfd6e6', hat: '#1d2440', pants: '#111' } },
    { id: 'm0', m: 0, name: 'Тимур', x: 11.5, y: 11.9, look: { body: '#FFB547', hair: '#2a1a0a' }, hello: 'Агенте! Мені прийшов лист, що я виграв телефон! Це ж правда?..' },
    { id: 'm1', m: 1, name: 'Олена Петрівна', x: 11, y: 6.9, look: { body: '#2EE59D', hair: '#7a4a2a', long: true, pants: '#333' }, hello: 'Моїм учням приходять запити в друзі від дивних акаунтів. Перевіриш їх?' },
    { id: 'm2', m: 2, name: 'Артем', x: 21.5, y: 17.6, look: { body: '#FF3B5C', hair: '#111', hat: '#2F6BFF' }, hello: 'Мені пише друг і терміново просить код із СМС… Що робити?!' },
    { id: 'm3', m: 3, name: 'Даня', x: 39, y: 6.5, look: { body: '#27D3F5', hair: '#f0d080' }, hello: 'Адмін «Світу Блоків» хоче мій пароль, бо інакше видалять акаунт! Допоможи!' },
    { id: 'm4', m: 4, name: 'Софійка', x: 7.5, y: 24.5, look: { body: '#ff8ad8', hair: '#3a2414', long: true }, hello: 'Новий друг просить моє фото і каже нікому не казати… Мені якось тривожно.' },
    { id: 'm5', m: 5, name: 'Ліза', x: 39, y: 24.5, look: { body: '#FFD34D', hair: '#111', long: true }, hello: 'Я дослідила фото дітей на профілях «Соні_2014». Здається, вони не справжні. А ще мені прийшла погроза…' },
    { id: 'core', m: 6, name: 'Ядро «Соня_2014»', x: 25, y: 24, look: { body: '#FF3B5C', glow: true, skin: '#9aa3b5', hair: '#444', emoji: '🤖' } },
  ];
  const giverOf = (m) => NPCS.find((n) => n.m === m);
  function npcState(n) {
    if (n.id === 'cmd') return S.metCmd ? '' : 'quest';
    if (!S.metCmd) return '';
    if (n.m < S.done) return 'done';
    if (n.m === S.done) return 'quest';
    return '';
  }
  W.init({
    npcs: NPCS,
    playerLook: { body: '#2F6BFF', glow: true, hair: '#1b1b1b', pants: '#141a33' },
    gateOpen: () => S.done >= 6,
    done: () => S.done,
    npcState,
    onStep: () => A.play('step'),
    interactables: () => {
      const list = NPCS.filter((n) => n.id !== 'core' || S.done >= 6).map((n) => ({ kind: 'npc', ref: n, px: n.x * T, py: n.y * T, verb: n.id === 'core' ? 'Атакувати ядро' : 'Поговорити: ' + n.name }));
      list.push({ kind: 'table', px: 25 * T, py: 6.6 * T, verb: 'Стіл планування' });
      if (S.done < 6) list.push({ kind: 'gate', px: 25 * T, py: 18.7 * T, verb: 'Серверна (замкнено)' });
      return list;
    },
    goal: () => {
      const n = !S.metCmd ? NPCS[0] : giverOf(S.done);
      return n ? { x: n.x * T, y: n.y * T } : null;
    },
    onInteract: (o) => interact(o),
  });

  function goalText() {
    if (!S.metCmd) return 'Поговори з Командиром ЩИТ у штабі';
    if (S.done >= 6) return 'Ворота серверної відкрито! Знешкодь ядро «Соня_2014»';
    const n = giverOf(S.done); return `Знайди: ${n.name} (жовтий «!»)`;
  }
  function say(name, lines, choices, onEnd) { S.dialog = { name, lines, i: 0, choices, onEnd }; A.play('msg'); render(); }
  function interact(o) {
    if (S.dialog) return;
    A.play('click');
    if (o.kind === 'table') { S.screen = 'board'; A.play('whoosh'); render(); return; }
    if (o.kind === 'gate') { say('🔒 Серверна «Соня_2014»', [`ДОСТУП ЗАБОРОНЕНО. Потрібно 6 ключів-правил. Зібрано: ${S.done} / 6.`]); return; }
    const n = o.ref;
    if (n.id === 'cmd') {
      if (!S.metCmd) say(n.name, [...P.intro.commander, 'Почни з Тимура біля школи — у нього підозрілий лист.', 'Жовта стрілка й «!» над головою покажуть, куди йти. Ходи — WASD або стрілки, говорити — E.', 'А тут, на столі планування, — дошка нашої справи.'], null, () => { S.metCmd = true; });
      else say(n.name, S.done >= 6 ? ['Усі 6 ключів у тебе! Ворота серверної відкрито. Знешкодь ядро «Соня_2014»!'] : [`Ключів: ${S.done} / 6. Тримайся, агенте! Наступна ціль: ${giverOf(S.done).name}.`]);
      return;
    }
    const st = npcState(n), m = MISSIONS[n.m];
    if (n.id === 'core') { say(n.name, ['СИСТЕМА «СОНЯ_2014»: Ти… знайшов мене?', 'ЗАПУСК ЗАХИСТУ. УСІ ТРЮКИ — ОДНОЧАСНО!'], [{ t: '⚔ Почати фінальну битву', go: 6 }]); return; }
    if (st === 'quest') say(n.name, [n.hello, m.brief], [{ t: '✔ Взятися за справу', go: n.m }, { t: 'Хвилинку…' }]);
    else if (st === 'done') say(n.name, [`Дякую, агенте! Я запам'ятав правило: «${m.key}»`]);
    else if (!S.metCmd) say(n.name, ['Привіт! Тебе шукав Командир ЩИТ — він у штабі.']);
    else say(n.name, [`Привіт! Поки все спокійно. Спершу допоможи: ${giverOf(S.done).name}.`]);
  }
  function dialogNext() {
    const d = S.dialog; if (!d) return;
    if (d.i < d.lines.length - 1) { d.i++; A.play('type'); render(); return; }
    if (d.choices) return;
    S.dialog = null; d.onEnd && d.onEnd(); render();
  }
  function startMission(m) { S.dialog = null; S.m = m; S.sc = 0; S.mStartShield = S.shield; S.mStart = Date.now(); S.helpToast = false; A.play('whoosh'); startScene(); }
  function enterWorld() { clearTimers(); S.screen = 'world'; S.dialog = null; render(); }

  // ---------- ОСНОВНИЙ РЕНДЕР ----------
  const MAPPOS = [[10, 26], [26, 74], [42, 26], [58, 74], [74, 26], [90, 74], [50, 50]];
  function render() {
    let h = hud();
    switch (S.screen) {
      case 'start':
        h += `<main><div class="center stack hero">
          <img src="${LOGO}" class="herologo">
          <h1 class="glitch" data-t="${P.meta.title}">${P.meta.title}</h1>
          <h3 class="muted">${P.meta.subtitle} · ${P.meta.org}</h3>
          <div class="card stack" style="text-align:left;max-width:640px;margin:0 auto">
            <label>Твоє ім'я агента</label><input type="text" id="team" maxlength="24" placeholder="Напр.: Агент Нуль" value="${S.team}">
          </div>
          <button class="btn big" data-act="begin">▶ ПОЧАТИ РОЗСЛІДУВАННЯ</button>
        </div></main>`;
        break;
      case 'intro': {
        const I = P.intro;
        h += `<main class="intro"><div class="lock">
          <div class="clock">${I.time}</div>
          ${I.notes.slice(0, SS.n).map((n) => `<div class="note"><i>?</i><div><b>${n.from}</b><span>${n.t}</span></div><small>зараз</small></div>`).join('')}
        </div>
        <div class="cmd">${SS.n >= I.notes.length ? `<div class="cmdh">🛡 ЩИТ · ТРИВОГА</div><p>Агенте ${S.team}, терміново до штабу! Командир чекає.</p><button class="btn big" data-act="world">▶ ДО ШТАБУ</button>` : ''}</div></main>`;
        break;
      }
      case 'world': {
        const d = S.dialog;
        h += `<main class="worldscreen"><div id="worldhost"></div>
          <div class="objective"><b>🎯 ЦІЛЬ</b>${goalText()}</div>
          <div class="controls">WASD / стрілки — ходити · E — говорити · клік мишкою — йти туди</div>
          ${d ? `<div class="dlg" data-act="dnext"><div class="dname">${d.name}</div><div class="dtext">${d.lines[d.i]}</div>
            <div class="dbtns">${d.i === d.lines.length - 1 && d.choices ? d.choices.map((c, i) => `<button class="btn ${i ? 'ghost' : ''}" data-act="dchoice" data-i="${i}">${c.t}</button>`).join('') : '<span class="muted">E / клік — далі ▸</span>'}</div></div>` : ''}
        </main>`;
        break;
      }
      case 'board': {
        const pts = (a, b) => `<line x1="${MAPPOS[a][0]}" y1="${MAPPOS[a][1]}" x2="${MAPPOS[b][0]}" y2="${MAPPOS[b][1]}" class="${b <= S.done ? 'str' : 'str off'}"/>`;
        const links = [0, 1, 2, 3, 4, 5].map((i) => pts(i, 6)).join('') + [0, 1, 2, 3, 4].map((i) => pts(i, i + 1)).join('');
        h += `<main class="boardscreen"><div class="row"><h2>🗂 Стіл планування · ${P.meta.subtitle}</h2><div class="sp"></div><span class="chip ghost">${P.rules}</span><button class="btn" data-act="world">← До штабу</button></div>
          <div class="caseboard"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${links}</svg>
          ${MISSIONS.map((m, i) => {
            const [x, y] = MAPPOS[i], st = i < S.done ? 'done' : i === S.done ? 'open' : 'lock', g = giverOf(i);
            if (m.final) return `<div class="pin suspect ${S.done >= 6 ? 'open' : ''}" style="left:${x}%;top:${y}%"><div class="ph">${S.done >= 6 ? '🤖' : '?'}</div><b>«Соня_2014»</b><small>${S.done >= 6 ? 'Знайдено: серверна вежа' : 'Особа невідома'}</small></div>`;
            return `<div class="pin ${st}" style="left:${x}%;top:${y}%"><div class="ph">${st === 'lock' ? '🔒' : m.icon}</div><b>${m.title}</b><small>${g.name}</small>
              ${st === 'done' ? `<div class="kk">🔑 ${m.key}</div><div class="cl">🧩 ${m.clue}</div><span class="stars">${'★'.repeat(S.stars[i] || 0)}${'☆'.repeat(3 - (S.stars[i] || 0))}</span>` : st === 'open' ? '<div class="kk">▶ Активна справа</div>' : ''}</div>`;
          }).join('')}</div></main>`;
        break;
      }
      case 'brief':
        h += `<main><div class="center stack"><div class="chip">${mission().final ? 'ФІНАЛ' : 'МІСІЯ ' + mission().id}</div>
          <h1 class="grad">${mission().icon} ${mission().title}</h1><div class="card" style="font-size:24px">${mission().brief}</div>
          <div class="row" style="justify-content:center">${mission().scenes.map((s) => `<span class="chip ghost">${{ scan: '🔎 Сканування', chat: '💬 Чат-бій', sort: '⚡ Аркада', lock: '🔐 Протокол', cut: '🎬 Кат-сцена' }[s.type]}</span>`).join('')}</div>
          <button class="btn big" data-act="go">▶ ВПЕРЕД</button></div></main>`;
        break;
      case 'scene': h += sceneHtml(); break;
      case 'clear': h += `<main><div class="center"><h1 class="grad pop">СЦЕНУ ПРОЙДЕНО</h1></div></main>`; break;
      case 'key': {
        const m = mission(), st = S.stars[S.m];
        h += `<main><div class="center stack"><div class="card keycard">
          <div class="chip">КЛЮЧ ${m.id} / 6 ЗДОБУТО</div><div class="bigkey">🔑</div><div class="big grad">${m.key}</div>
          <div class="starsbig">${'★'.repeat(st)}${'☆'.repeat(3 - st)}</div>
          <div class="muted">🧩 Зачіпка: ${m.clue}</div><div class="muted">ЩИТ відновлено на +30%</div></div>
          <button class="btn big" data-act="world">ПОВЕРНУТИСЯ В МІСТО →</button></div></main>`;
        break;
      }
      case 'broken':
        h += `<main><div class="center stack"><h1 class="glitch red" data-t="ЩИТ ПРОБИТО">ЩИТ ПРОБИТО</h1>
          <div class="card">Шахраї пробили захист. Не біда: справжні агенти вчаться на помилках. Перезапусти місію з повним ЩИТом.</div>
          <button class="btn big" data-act="retry">↻ ПЕРЕЗАПУСК МІСІЇ</button></div></main>`;
        break;
      case 'cert': {
        const tot = S.stars.reduce((a, b) => a + (b || 0), 0);
        const rank = S.score > 50000 ? 'Агент-легенда' : S.score > 30000 ? 'Старший агент' : 'Агент ЩИТа';
        h += `<main><div class="center stack"><div class="cert">
          <img src="${LOGO}" style="height:70px;filter:invert(1)">
          <h1>СЕРТИФІКАТ «${rank.toUpperCase()}»</h1>
          <div>Агент</div><div class="who">${S.team}</div>
          <div>розкриває справу «Соня_2014», здобуває 6 ключів і знешкоджує бот-фабрику</div>
          <h3 style="margin-top:12px">Бали: ${S.score} · Зірки: ${tot} / 21 · Час: ${fmt(elapsed())}</h3>
          <div style="margin-top:12px;font-weight:800">${P.rules}</div></div>
          <button class="btn ghost" data-act="restart">Нова команда</button></div></main>`;
        break;
      }
    }
    if (S.pause) h += `<div class="overlay"><div class="card stack"><h2>🙋 Ментор іде до вас</h2><div class="muted">Гра на паузі.</div><button class="btn" data-act="resume">Продовжити</button></div></div>`;
    if (S.exitOpen) h += `<div class="overlay"><div class="card stack"><h3>Вийти з гри?</h3><div class="muted">Прогрес не збережеться.</div><div class="row" style="justify-content:center"><button class="btn" data-act="exit">Вийти</button><button class="btn ghost" data-act="cancelExit">Скасувати</button></div></div></div>`;
    app.innerHTML = h;
    const cl = $('#clog'); if (cl) cl.scrollTop = cl.scrollHeight;
    if (S.screen === 'world') { W.attach($('#worldhost')); W.block(!!(S.dialog || S.pause || S.exitOpen)); } else W.stop();
  }


  function playIntro() {
    clearTimers(); SS = { n: 0, c: 0 }; S.screen = 'intro'; render();
    const I = P.intro; let d = 600;
    I.notes.forEach((_, i) => { later(() => { SS.n = i + 1; A.play('msg'); if (i === I.notes.length - 1) later(() => A.play('alarm'), 700); render(); }, d); d += 1300; });
  }

  // ---------- ПОДІЇ ----------
  app.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act],#logo');
    if (!t) return;
    if (t.id === 'logo') {
      const now = Date.now(); S.logoClicks = now - S.logoT > 3000 ? 1 : S.logoClicks + 1; S.logoT = now;
      if (S.logoClicks >= 5) { S.exitOpen = true; S.logoClicks = 0; render(); }
      return;
    }
    if (S.pause && t.dataset.act !== 'resume') return;
    const a = t.dataset.act, i = +t.dataset.i;
    if (!['part', 'reply', 'sort', 'lock', 'verdict'].includes(a)) A.play('click');
    switch (a) {
      case 'mute': A.toggle(); break;
      case 'begin': S.team = ($('#team').value || '').trim() || 'Агент'; S.t0 = Date.now(); A.startMusic(); A.play('whoosh'); playIntro(); return;
      case 'world': A.play('whoosh'); enterWorld(); return;
      case 'dnext': dialogNext(); return;
      case 'dchoice': {
        const c = S.dialog.choices[i];
        if (c.go !== undefined) startMission(c.go); else { S.dialog = null; render(); }
        return;
      }
      case 'go': S.sc = 0; S.mStartShield = S.shield; startScene(); return;
      case 'retry': S.shield = 100; S.sc = 0; S.mStartShield = 100; startScene(); return;
      case 'tool': SS.tool = SS.tool === t.dataset.t ? null : t.dataset.t; A.play('tool'); break;
      case 'part': scanClick(i); return;
      case 'verdict': verdict(t.dataset.v === '1'); return;
      case 'reply': chatPick(i); return;
      case 'sort': sortAnswer(t.dataset.v === '1'); return;
      case 'lock': lockPick(i); return;
      case 'cutnext': sceneClear('Урок засвоєно'); return;
      case 'mentor': S.pause = true; S.pauseAt = Date.now(); break;
      case 'resume': { const d = Date.now() - S.pauseAt; S.t0 += d; if (S.mStart) S.mStart += d; S.pause = false; break; }
      case 'restart': clearTimers(); W.reset(); Object.assign(S, { screen: 'start', team: '', shield: 100, score: 0, combo: 1, m: 0, sc: 0, keys: [], stars: [], t0: 0, tEnd: 0, done: 0, metCmd: false, dialog: null }); break;
      case 'cancelExit': S.exitOpen = false; break;
      case 'exit': {
        if (window.cq) await window.cq.quit(); else { S.exitOpen = false; render(); }
        return;
      }
    }
    render();
  });

  document.addEventListener('keydown', (e) => {
    if (S.screen === 'world' && S.dialog && ['KeyE', 'Space', 'Enter'].includes(e.code)) {
      e.preventDefault(); e.stopPropagation();
      const d = S.dialog;
      if (d.i === d.lines.length - 1 && d.choices) { const c = d.choices[0]; if (c.go !== undefined) startMission(c.go); }
      else dialogNext();
      return;
    }
    if (S.screen === 'board' && (e.code === 'Escape' || e.code === 'KeyE')) { enterWorld(); return; }
    if (S.screen === 'scene' && SS.type === 'scan' && !S.pause && /^[1-4]$/.test(e.key) && e.target.tagName !== 'INPUT') {
      const t = TOOLS[+e.key - 1]; SS.tool = SS.tool === t ? null : t; A.play('tool'); render(); return;
    }
    if (S.screen === 'scene' && SS.type === 'sort' && !S.pause) {
      if (e.key === 'ArrowLeft' || e.key === 'a') sortAnswer(false);
      if (e.key === 'ArrowRight' || e.key === 'd') sortAnswer(true);
    }
    if (e.key === 'Enter' && S.exitOpen) $('[data-act=exit]')?.click();
    // чит лише для розробки (npm run dev): F9 — зарахувати наступну місію, F8 — пропустити сцену
    if (location.search.includes('dev=1')) {
      if (e.key === 'F9' && S.done < 6) { S.keys[S.done] = true; S.stars[S.done] = 3; S.done++; S.metCmd = true; enterWorld(); }
      if (e.key === 'F8' && S.screen === 'scene') sceneClear('DEV: пропущено');
    }
  });

  setInterval(() => {
    const el = $('#tm');
    if (el && S.t0 && !S.tEnd && !S.pause) { el.innerHTML = fmt(elapsed()) + `<small> / ${TM.targetMinutes}:00</small>`; el.classList.toggle('over', gameOver30()); }
    // коли місія затягується — Командир вмикає підказки (щоб уся гра вміщалась у ~30 хв)
    if (S.screen === 'scene' && !S.pause && !S.helpToast && help() === 2) {
      S.helpToast = true; toast('🛡 Командир: час підганяє — вмикаю підказки!', 'warn', 3000); render();
    }
  }, 1000);
  window.__cq = { S, get SS() { return SS; }, start: (m) => startMission(m), help: () => help() }; // для тестів
  render();
})();
