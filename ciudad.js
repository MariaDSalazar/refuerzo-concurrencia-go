'use strict';
// La ciudad: mapa, carro, tráfico, drones y minimapa, dibujados en un lienzo. Todo es dibujo propio.
// Las posiciones de las calles se cuentan en cuadras: (columna, fila); .5 es la mitad de una cuadra.

const Ciudad = (() => {
  const COLS = 7, FILAS = 5, S = 360, M = 200, R = 100, ACERA = 14;      // cuadras, tamaño de cuadra, margen, ancho de calle
  const ANCHO = M * 2 + S * COLS, ALTO = M * 2 + S * FILAS;
  const X = i => M + S * i, Y = j => M + S * j;
  const LUGARES = { '3,2': ['Central de despachos', '#EAAA00'], '1,1': ['Parque El Mirador', 'parque'], '6,0': ['Laguna', 'agua'], '6,1': ['Faro', '#6AD7E5'],
    '5,3': ['Coliseo', '#910048'], '2,0': ['Banco', '#3d6bb8'], '0,3': ['Mercado', '#c46a2b'], '4,4': ['Taller', '#7a5a2a'], '4,0': ['Torre de red', '#6b4fa8'],
    '1,4': ['Universidad', '#002C71'], '6,4': ['Terminal', '#2c7a62'], '2,3': ['Parque Central', 'parque'], '0,0': ['Cancha', 'parque'], '5,1': ['Museo', '#8a4f7d'] };
  let cv, cx, fondo = null, mini, mx, W = 0, H = 0, zoom = 1, raf = 0, antes = 0, corre = false, tiempo = 0;
  let cb = {}, marcas = [], carro, trafico = [], drones = [], fichas = [], ruta = null, choque = 0, avisoT = 0;
  const teclas = new Set(), palanca = { x: 0, y: 0, activa: false };

  // azar repetible: la ciudad siempre es la misma
  let semilla = 20261124;
  const azar = () => { semilla = (semilla * 1664525 + 1013904223) >>> 0; return semilla / 4294967296; };
  const entre = (a, b) => a + azar() * (b - a);

  /* ---------------- fondo (se dibuja una sola vez) ---------------- */
  function pintarFondo() {
    semilla = 20261124;
    fondo = document.createElement('canvas'); fondo.width = ANCHO; fondo.height = ALTO;
    const c = fondo.getContext('2d');
    c.fillStyle = '#0d2233'; c.fillRect(0, 0, ANCHO, ALTO);
    // montañas alrededor
    for (let k = 0; k < 150; k++) {
      const lado = k % 4, a = azar();
      const x = lado === 0 ? entre(10, 120) : lado === 1 ? ANCHO - entre(10, 120) : a * ANCHO;
      const y = lado === 2 ? entre(10, 110) : lado === 3 ? ALTO - entre(0, 90) : a * ALTO;
      const t = entre(30, 80);
      c.fillStyle = ['#16384a', '#1a4152', '#12303f'][k % 3];
      c.beginPath(); c.moveTo(x - t, y + t * .6); c.lineTo(x, y - t); c.lineTo(x + t, y + t * .6); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.moveTo(x - t * .22, y - t * .62); c.lineTo(x, y - t); c.lineTo(x + t * .22, y - t * .62); c.closePath(); c.fill();
    }
    // calles
    c.fillStyle = '#4b5563'; c.fillRect(X(0) - R / 2 - ACERA, Y(0) - R / 2 - ACERA, S * COLS + R + ACERA * 2, S * FILAS + R + ACERA * 2);
    c.fillStyle = '#272e3a';
    for (let i = 0; i <= COLS; i++) c.fillRect(X(i) - R / 2, Y(0) - R / 2, R, S * FILAS + R);
    for (let j = 0; j <= FILAS; j++) c.fillRect(X(0) - R / 2, Y(j) - R / 2, S * COLS + R, R);
    c.strokeStyle = '#d9b44a'; c.lineWidth = 3; c.setLineDash([18, 18]);
    for (let i = 0; i <= COLS; i++) for (let j = 0; j < FILAS; j++) { c.beginPath(); c.moveTo(X(i), Y(j) + R / 2 + 20); c.lineTo(X(i), Y(j + 1) - R / 2 - 20); c.stroke(); }
    for (let j = 0; j <= FILAS; j++) for (let i = 0; i < COLS; i++) { c.beginPath(); c.moveTo(X(i) + R / 2 + 20, Y(j)); c.lineTo(X(i + 1) - R / 2 - 20, Y(j)); c.stroke(); }
    c.setLineDash([]);
    // pasos peatonales
    c.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i <= COLS; i++) for (let j = 0; j <= FILAS; j++) for (let k = -3; k <= 3; k++) {
      if (i < COLS) c.fillRect(X(i) + R / 2 + 4, Y(j) + k * 13 - 4, 12, 7);
      if (j < FILAS) c.fillRect(X(i) + k * 13 - 4, Y(j) + R / 2 + 4, 7, 12);
    }
    for (let i = 0; i < COLS; i++) for (let j = 0; j < FILAS; j++) cuadra(c, i, j);
    // faroles
    for (let i = 0; i <= COLS; i++) for (let j = 0; j <= FILAS; j++) for (const [dx, dy] of [[-1, -1], [1, 1]]) {
      const x = X(i) + dx * (R / 2 + 7), y = Y(j) + dy * (R / 2 + 7), g = c.createRadialGradient(x, y, 2, x, y, 80);
      g.addColorStop(0, 'rgba(255,214,120,.5)'); g.addColorStop(1, 'rgba(255,214,120,0)');
      c.fillStyle = g; c.fillRect(x - 80, y - 80, 160, 160);
      c.fillStyle = '#ffe9b0'; c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill();
    }
  }
  function cuadra(c, i, j) {
    const x = X(i) + R / 2 + ACERA, y = Y(j) + R / 2 + ACERA, t = S - R - ACERA * 2, [nombre, tipo] = LUGARES[`${i},${j}`] || ['', ''];
    if (tipo === 'agua' || tipo === 'parque') {
      c.fillStyle = tipo === 'agua' ? '#1c5f86' : '#1f5a3a'; c.beginPath(); c.roundRect(x, y, t, t, 26); c.fill();
      if (tipo === 'agua') {
        c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 3;
        for (let k = 0; k < 9; k++) { const a = x + entre(20, t - 60), b = y + entre(20, t - 20); c.beginPath(); c.moveTo(a, b); c.quadraticCurveTo(a + 12, b - 8, a + 24, b); c.quadraticCurveTo(a + 36, b + 8, a + 48, b); c.stroke(); }
      } else {
        c.strokeStyle = '#b79a68'; c.lineWidth = 12; c.beginPath(); c.moveTo(x, y); c.lineTo(x + t, y + t); c.moveTo(x + t, y); c.lineTo(x, y + t); c.stroke();
        for (let k = 0; k < 16; k++) { const a = x + entre(22, t - 22), b = y + entre(22, t - 22); c.fillStyle = '#123d27'; c.beginPath(); c.arc(a + 3, b + 4, 15, 0, 7); c.fill(); c.fillStyle = k % 3 ? '#2f7d4f' : '#3f9a5f'; c.beginPath(); c.arc(a, b, 14, 0, 7); c.fill(); }
      }
    } else {
      const partes = nombre ? [[0, 0, 1, 1]] : azar() < .5 ? [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]] : [[0, 0, 1, .5], [0, .5, .5, .5], [.5, .5, .5, .5]];
      for (const [a, b, w, h] of partes) {
        const px = x + a * t + 3, py = y + b * t + 3, pw = w * t - 6, ph = h * t - 6;
        c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(px + 8, py + 8, pw, ph);
        c.fillStyle = nombre ? tipo : ['#2b3d5c', '#34496b', '#3b3557', '#244a5a', '#4a3a48'][Math.floor(azar() * 5)];
        c.fillRect(px, py, pw, ph);
        c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 4; c.strokeRect(px + 6, py + 6, pw - 12, ph - 12);
        for (let u = px + 22; u < px + pw - 24; u += 26) for (let v = py + 22; v < py + ph - 24; v += 26) {
          if (nombre && Math.abs(v - (py + ph / 2)) < 30) continue;
          c.fillStyle = azar() < .45 ? 'rgba(255,221,130,.8)' : 'rgba(10,18,35,.55)'; c.fillRect(u, v, 12, 12);
        }
      }
    }
    if (nombre) {
      c.font = '800 25px Poppins, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const w = Math.min(t - 8, c.measureText(nombre).width + 26);
      c.fillStyle = 'rgba(6,14,32,.82)'; c.beginPath(); c.roundRect(x + t / 2 - w / 2, y + t / 2 - 22, w, 44, 12); c.fill();
      c.fillStyle = '#fff'; c.fillText(nombre, x + t / 2, y + t / 2 + 1, t - 24);
    }
  }

  /* ---------------- calles: por dónde se puede pasar y cómo llegar ---------------- */
  const LIM = R / 2 + ACERA - 13;
  const enV = x => { const i = Math.round((x - M) / S); return i >= 0 && i <= COLS && Math.abs(x - X(i)) <= LIM ? i : -1; };
  const enH = y => { const j = Math.round((y - M) / S); return j >= 0 && j <= FILAS && Math.abs(y - Y(j)) <= LIM ? j : -1; };
  const libre = (x, y) => x >= X(0) - LIM && x <= X(COLS) + LIM && y >= Y(0) - LIM && y <= Y(FILAS) + LIM && (enV(x) >= 0 || enH(y) >= 0);
  const pos = ([a, b]) => ({ x: X(a), y: Y(b) });
  // esquinas a las que se llega en línea recta desde un punto de la calle
  function esquinas(x, y) {
    const out = [], i = enV(x), j = enH(y);
    if (i >= 0) { const r = (y - M) / S; for (const q of [Math.floor(r), Math.ceil(r)]) if (q >= 0 && q <= FILAS) out.push([i, q]); }
    if (j >= 0) { const r = (x - M) / S; for (const q of [Math.floor(r), Math.ceil(r)]) if (q >= 0 && q <= COLS) out.push([q, j]); }
    return out;
  }
  function camino(desde, hasta) {
    let mejor = null;
    if ((enV(desde.x) >= 0 && enV(desde.x) === enV(hasta.x) && Math.abs(desde.y - hasta.y) < S) || (enH(desde.y) >= 0 && enH(desde.y) === enH(hasta.y) && Math.abs(desde.x - hasta.x) < S)) return [hasta];
    for (const a of esquinas(desde.x, desde.y)) for (const b of esquinas(hasta.x, hasta.y)) {
      const d = Math.hypot(X(a[0]) - desde.x, Y(a[1]) - desde.y) + Math.abs(X(a[0]) - X(b[0])) + Math.abs(Y(a[1]) - Y(b[1])) + Math.hypot(X(b[0]) - hasta.x, Y(b[1]) - hasta.y);
      if (!mejor || d < mejor.d) mejor = { d, p: [pos(a), pos([b[0], a[1]]), pos(b), hasta] };
    }
    return mejor ? mejor.p : [hasta];
  }

  /* ---------------- actores ---------------- */
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  function nuevoTrafico() {
    const COL = ['#c9d3e0', '#b8423d', '#3f7fbf', '#6aa56a', '#e08b3a', '#8a6fc0'];
    trafico = Array.from({ length: 16 }, (_, k) => ({ i: Math.floor(Math.random() * COLS), j: Math.floor(Math.random() * FILAS), d: k % 2, t: Math.random(), v: 70 + Math.random() * 50, c: COL[k % 6], x: 0, y: 0 }));
  }
  function moverTrafico(o, dt) {
    const [dx, dy] = DIRS[o.d], lejos = Math.hypot(o.x - carro.x, o.y - carro.y), delante = (carro.x - o.x) * dx + (carro.y - o.y) * dy;
    if (!(lejos < 95 && delante > 0)) o.t += o.v * dt / S;
    if (o.t >= 1) {
      o.i += dx; o.j += dy; o.t = 0;
      const op = [0, 1, 2, 3].filter(d => { if (d === (o.d + 2) % 4) return false; const [a, b] = DIRS[d]; return o.i + a >= 0 && o.i + a <= COLS && o.j + b >= 0 && o.j + b <= FILAS; });
      o.d = op[Math.floor(Math.random() * op.length)];
    }
    const [ex, ey] = DIRS[o.d];
    o.x = X(o.i) + ex * S * o.t - ey * 24; o.y = Y(o.j) + ey * S * o.t + ex * 24; o.a = Math.atan2(ey, ex);
  }
  function soltarDrones(n) {
    drones = Array.from({ length: n }, (_, k) => ({ x: carro.x + Math.cos(k * 2.1) * 520, y: carro.y + Math.sin(k * 2.1) * 520, vida: 14, pausa: 0 }));
  }
  function nuevasFichas() {
    fichas = [];
    for (let k = 0; k < 34; k++) {
      const v = Math.random() < .5;
      const p = v ? { x: X(Math.floor(Math.random() * (COLS + 1))), y: Y(Math.random() * FILAS) } : { x: X(Math.random() * COLS), y: Y(Math.floor(Math.random() * (FILAS + 1))) };
      fichas.push(p);
    }
  }

  /* ---------------- paso de la simulación ---------------- */
  function paso(dt) {
    tiempo += dt;
    let dx = 0, dy = 0;
    if (teclas.has('ArrowLeft') || teclas.has('a')) dx--;
    if (teclas.has('ArrowRight') || teclas.has('d')) dx++;
    if (teclas.has('ArrowUp') || teclas.has('w')) dy--;
    if (teclas.has('ArrowDown') || teclas.has('s')) dy++;
    if (palanca.activa) { dx = palanca.x; dy = palanca.y; }
    if ((dx || dy) && ruta) { ruta = null; if (cb.piloto) cb.piloto(false); }
    let tope = 330;
    if (ruta) {                                          // piloto automático
      const p = ruta[0], d = Math.hypot(p.x - carro.x, p.y - carro.y);
      if (d < 14) { ruta.shift(); if (!ruta.length) { ruta = null; if (cb.piloto) cb.piloto(false); } } else { dx = (p.x - carro.x) / d; dy = (p.y - carro.y) / d; tope = d < 90 && ruta.length === 1 ? 190 : 420; }
    }
    const f = Math.min(1, Math.hypot(dx, dy));
    if (f > .12) {
      const meta = Math.atan2(dy, dx);
      let dif = Math.atan2(Math.sin(meta - carro.a), Math.cos(meta - carro.a));
      carro.a += Math.max(-1, Math.min(1, dif)) * Math.min(1, dt * 9);
      carro.v += (tope * f * Math.max(.35, Math.cos(dif)) - carro.v) * Math.min(1, dt * 3.2);
    } else carro.v *= Math.pow(.08, dt);
    let nx, ny;
    if (ruta && ruta.length) {                            // sigue la calle exacta para no rozar las esquinas
      const p = ruta[0], d = Math.hypot(p.x - carro.x, p.y - carro.y) || 1, av = Math.min(d, carro.v * dt);
      nx = carro.x + (p.x - carro.x) / d * av; ny = carro.y + (p.y - carro.y) / d * av;
    } else { nx = carro.x + Math.cos(carro.a) * carro.v * dt; ny = carro.y + Math.sin(carro.a) * carro.v * dt; }
    if (libre(nx, ny)) { carro.x = nx; carro.y = ny; }
    else if (libre(nx, carro.y)) { carro.x = nx; carro.v *= .96; }
    else if (libre(carro.x, ny)) { carro.y = ny; carro.v *= .96; }
    else carro.v *= .3;
    choque = Math.max(0, choque - dt);
    for (const o of trafico) {
      moverTrafico(o, dt);
      const d = Math.hypot(o.x - carro.x, o.y - carro.y);
      if (d < 34 && !ruta && choque === 0) { carro.v *= -.35; choque = .6; if (cb.sonido) cb.sonido('golpe'); }
    }
    for (const o of drones) {
      o.vida -= dt; o.pausa = Math.max(0, o.pausa - dt);
      const d = Math.hypot(carro.x - o.x, carro.y - o.y) || 1;
      if (!o.pausa) { o.x += (carro.x - o.x) / d * 235 * dt; o.y += (carro.y - o.y) / d * 235 * dt; }
      if (d < 30 && !o.pausa) { o.pausa = 3; carro.v *= .2; if (cb.tocado) cb.tocado(); }
    }
    const habia = drones.length;
    drones = drones.filter(o => o.vida > 0);
    if (habia && !drones.length && cb.librado) cb.librado();
    fichas = fichas.filter(p => { if (Math.hypot(p.x - carro.x, p.y - carro.y) < 34) { if (cb.ficha) cb.ficha(); return false; } return true; });
    for (const m of marcas) {
      const d = Math.hypot(m.x - carro.x, m.y - carro.y);
      if (m.lejos && d > 120) m.lejos = false;
      if (!m.lejos && d < 46) { m.lejos = true; carro.v = 0; ruta = null; teclas.clear(); soltar(); if (cb.piloto) cb.piloto(false); if (cb.llegar) cb.llegar(m.id); return; }
    }
  }

  /* ---------------- dibujo de cada cuadro ---------------- */
  function dibujaCarro(c, x, y, a, color, jugador) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.roundRect(-22, -10, 48, 26, 8); c.fill();
    c.fillStyle = '#10151f'; for (const [p, q] of [[-15, -15], [12, -15], [-15, 11], [12, 11]]) c.fillRect(p, q, 10, 4);
    c.fillStyle = color; c.beginPath(); c.roundRect(-24, -13, 48, 26, 8); c.fill();
    c.fillStyle = 'rgba(12,30,60,.85)'; c.beginPath(); c.roundRect(5, -10, 9, 20, 3); c.fill(); c.beginPath(); c.roundRect(-18, -9, 6, 18, 3); c.fill();
    c.fillStyle = '#fff3c4'; c.fillRect(21, -11, 4, 6); c.fillRect(21, 5, 4, 6);
    c.fillStyle = '#e0413a'; c.fillRect(-25, -11, 3, 6); c.fillRect(-25, 5, 3, 6);
    if (jugador) {                                        // el gopher asoma por el techo
      c.fillStyle = '#6AD7E5'; c.strokeStyle = '#1b2a3a'; c.lineWidth = 1.6;
      for (const q of [-7, 7]) { c.beginPath(); c.arc(-6, q, 3, 0, 7); c.fill(); c.stroke(); }
      c.beginPath(); c.arc(-4, 0, 8, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#fff'; for (const q of [-3.4, 3.4]) { c.beginPath(); c.arc(-.5, q, 2.9, 0, 7); c.fill(); c.stroke(); }
      c.fillStyle = '#1b2a3a'; for (const q of [-3.4, 3.4]) { c.beginPath(); c.arc(.5, q, 1.2, 0, 7); c.fill(); }
    }
    c.restore();
  }
  function pintar() {
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.fillStyle = '#0a1a28'; cx.fillRect(0, 0, cv.width, cv.height);
    const dpr = cv.width / W, z = zoom * dpr, vw = W / zoom, vh = H / zoom;
    const cxm = vw >= ANCHO ? ANCHO / 2 : Math.max(vw / 2, Math.min(ANCHO - vw / 2, carro.x)), cym = vh >= ALTO ? ALTO / 2 : Math.max(vh / 2, Math.min(ALTO - vh / 2, carro.y));
    cx.setTransform(z, 0, 0, z, -(cxm - vw / 2) * z, -(cym - vh / 2) * z);
    const sx = Math.max(0, cxm - vw / 2), sy = Math.max(0, cym - vh / 2), sw = Math.min(ANCHO - sx, vw), sh = Math.min(ALTO - sy, vh);
    cx.drawImage(fondo, sx, sy, sw, sh, sx, sy, sw, sh);
    // ruta del piloto automático
    if (ruta) { cx.strokeStyle = 'rgba(106,215,229,.75)'; cx.lineWidth = 8; cx.setLineDash([20, 16]); cx.beginPath(); cx.moveTo(carro.x, carro.y); ruta.forEach(p => cx.lineTo(p.x, p.y)); cx.stroke(); cx.setLineDash([]); }
    for (const p of fichas) { cx.fillStyle = '#EAAA00'; cx.strokeStyle = '#7a5800'; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(p.x, p.y, 3 + 8 * Math.abs(Math.cos(tiempo * 3 + p.x)), 11, 0, 0, 7); cx.fill(); cx.stroke(); }
    for (const m of marcas) {
      const r = 34 + Math.sin(tiempo * 4) * 6;
      const g = cx.createRadialGradient(m.x, m.y, 4, m.x, m.y, 74); g.addColorStop(0, m.color + 'cc'); g.addColorStop(1, m.color + '00');
      cx.fillStyle = g; cx.beginPath(); cx.arc(m.x, m.y, 74, 0, 7); cx.fill();
      cx.strokeStyle = m.color; cx.lineWidth = 6; cx.beginPath(); cx.arc(m.x, m.y, r, 0, 7); cx.stroke();
      cx.fillStyle = '#06101f'; cx.beginPath(); cx.arc(m.x, m.y - 4, 19, 0, 7); cx.fill();
      cx.fillStyle = m.color; cx.font = '800 22px Poppins, Arial, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(m.n, m.x, m.y - 3);
    }
    for (const o of trafico) dibujaCarro(cx, o.x, o.y, o.a, o.c, false);
    // luces del carro
    cx.save(); cx.translate(carro.x, carro.y); cx.rotate(carro.a);
    const luz = cx.createRadialGradient(20, 0, 8, 20, 0, 225); luz.addColorStop(0, 'rgba(255,244,200,.42)'); luz.addColorStop(1, 'rgba(255,244,200,0)');
    cx.fillStyle = luz; cx.beginPath(); cx.moveTo(20, -8); cx.lineTo(236, -84); cx.arc(20, 0, 232, -.37, .37); cx.lineTo(20, 8); cx.closePath(); cx.fill(); cx.restore();
    dibujaCarro(cx, carro.x, carro.y, carro.a, '#EAAA00', true);
    for (const o of drones) {
      cx.save(); cx.translate(o.x, o.y + Math.sin(tiempo * 8) * 4);
      cx.fillStyle = 'rgba(0,0,0,.35)'; cx.beginPath(); cx.ellipse(8, 22, 18, 8, 0, 0, 7); cx.fill();
      cx.fillStyle = o.pausa ? '#6d7480' : '#d63a5e'; cx.strokeStyle = '#2a0a16'; cx.lineWidth = 2.5;
      cx.beginPath(); cx.ellipse(0, 0, 18, 13, 0, 0, 7); cx.fill(); cx.stroke();
      cx.beginPath(); cx.moveTo(0, -13); cx.lineTo(0, 13); cx.stroke();
      for (const s of [-1, 1]) { for (const q of [-7, 0, 7]) { cx.beginPath(); cx.moveTo(q, s * 12); cx.lineTo(q + 5, s * 20); cx.stroke(); } }
      cx.fillStyle = '#fff'; for (const q of [-5, 5]) { cx.beginPath(); cx.arc(12, q, 3.4, 0, 7); cx.fill(); }
      cx.restore();
    }
    // flecha hacia la misión más cercana, si no se ve
    const m = cercana();
    if (m && Math.hypot(m.x - carro.x, m.y - carro.y) > 260 / zoom) {
      const a = Math.atan2(m.y - carro.y, m.x - carro.x);
      cx.save(); cx.translate(carro.x + Math.cos(a) * 64, carro.y + Math.sin(a) * 64); cx.rotate(a);
      cx.fillStyle = m.color; cx.strokeStyle = '#06101f'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(16, 0); cx.lineTo(-10, -12); cx.lineTo(-4, 0); cx.lineTo(-10, 12); cx.closePath(); cx.fill(); cx.stroke(); cx.restore();
    }
    pintarMini();
  }
  function pintarMini() {
    if (!mini) return;
    const w = mini.width, h = mini.height, k = Math.min(w / ANCHO, h / ALTO), ox = (w - ANCHO * k) / 2, oy = (h - ALTO * k) / 2;
    mx.fillStyle = '#0a1a2c'; mx.fillRect(0, 0, w, h);
    for (const [c, [, tipo]] of Object.entries(LUGARES)) {
      const [i, j] = c.split(',').map(Number);
      mx.fillStyle = tipo === 'parque' ? '#1f6a41' : tipo === 'agua' ? '#1f6f9e' : tipo + '99';
      mx.fillRect(ox + (X(i) + R / 2) * k, oy + (Y(j) + R / 2) * k, (S - R) * k, (S - R) * k);
    }
    mx.strokeStyle = '#7f93ad'; mx.lineWidth = R * k * .55; mx.lineCap = 'round'; mx.beginPath();
    for (let i = 0; i <= COLS; i++) { mx.moveTo(ox + X(i) * k, oy + Y(0) * k); mx.lineTo(ox + X(i) * k, oy + Y(FILAS) * k); }
    for (let j = 0; j <= FILAS; j++) { mx.moveTo(ox + X(0) * k, oy + Y(j) * k); mx.lineTo(ox + X(COLS) * k, oy + Y(j) * k); }
    mx.stroke();
    if (ruta) { mx.strokeStyle = '#6AD7E5'; mx.lineWidth = 5; mx.beginPath(); mx.moveTo(ox + carro.x * k, oy + carro.y * k); ruta.forEach(p => mx.lineTo(ox + p.x * k, oy + p.y * k)); mx.stroke(); }
    const punto = (x, y, r, c) => { mx.fillStyle = c; mx.beginPath(); mx.arc(ox + x * k, oy + y * k, r, 0, 7); mx.fill(); };
    for (const m of marcas) { punto(m.x, m.y, 17, '#06101f'); punto(m.x, m.y, 14, m.color); mx.fillStyle = '#06101f'; mx.font = '800 18px Poppins, Arial, sans-serif'; mx.textAlign = 'center'; mx.textBaseline = 'middle'; mx.fillText(m.n, ox + m.x * k, oy + m.y * k + 1); }
    for (const o of drones) punto(o.x, o.y, 7, '#ff5c7c');
    punto(carro.x, carro.y, 11, '#06101f'); punto(carro.x, carro.y, 9, '#fff');
  }
  const cercana = () => marcas.reduce((a, m) => !a || Math.hypot(m.x - carro.x, m.y - carro.y) < Math.hypot(a.x - carro.x, a.y - carro.y) ? m : a, null);
  function medir() {
    const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.max(50, r.width); H = Math.max(50, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    zoom = Math.max(.62, Math.min(1.1, Math.min(W, H) / 640));
  }
  function cuadro(t) {
    raf = requestAnimationFrame(cuadro);
    if (!corre || !cv.isConnected) return;
    const dt = Math.min(.05, (t - antes) / 1000 || 0); antes = t;
    paso(dt);
    if (cv.isConnected) pintar();
  }

  /* ---------------- controles ---------------- */
  const NORMAL = k => k.length === 1 ? k.toLowerCase() : k;
  const MUEVEN = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd']);
  window.addEventListener('keydown', e => {
    const k = NORMAL(e.key);
    if (!corre || !MUEVEN.has(k) || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    e.preventDefault(); teclas.add(k);
  });
  window.addEventListener('keyup', e => teclas.delete(NORMAL(e.key)));
  window.addEventListener('blur', () => teclas.clear());
  window.addEventListener('resize', () => { if (cv && cv.isConnected) medir(); });
  function soltar() { palanca.activa = false; palanca.x = palanca.y = 0; const b = document.querySelector('#palanca i'); if (b) b.style.transform = ''; }
  function conectarPalanca(el) {
    const bola = el.querySelector('i');
    const mover = e => {
      const r = el.getBoundingClientRect(), m = r.width / 2;
      let x = (e.clientX - r.left - m) / m, y = (e.clientY - r.top - m) / m; const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      palanca.x = x; palanca.y = y; palanca.activa = true; bola.style.transform = `translate(${x * m * .6}px, ${y * m * .6}px)`;
    };
    el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); mover(e); e.preventDefault(); });
    el.addEventListener('pointermove', e => { if (palanca.activa) mover(e); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => el.addEventListener(ev, soltar));
  }

  return {
    // lienzo, minimapa, palanca y avisos (llegar, ficha, tocado, librado, piloto, sonido)
    abrir({ lienzo, minimapa, palanca: pal, avisos }) {
      cv = lienzo; cx = cv.getContext('2d'); mini = minimapa; mx = mini ? mini.getContext('2d') : null; cb = avisos;
      if (!fondo) pintarFondo();
      if (!carro) { carro = { x: X(3), y: Y(3), a: -Math.PI / 2, v: 0 }; nuevoTrafico(); nuevasFichas(); trafico.forEach(o => moverTrafico(o, 0)); }
      ruta = null; teclas.clear(); soltar(); if (pal) conectarPalanca(pal);
      medir(); corre = true; antes = performance.now();
      if (!raf) raf = requestAnimationFrame(cuadro);
    },
    marcas(lista) { marcas = lista.map(m => { const p = pos(m.lugar); return { ...m, ...p, lejos: Math.hypot(p.x - carro.x, p.y - carro.y) < 60 }; }); ruta = null; },
    pausa(si) { corre = !si; teclas.clear(); soltar(); antes = performance.now(); },
    piloto(id) {
      const m = marcas.find(q => q.id === id) || cercana();
      if (!m) return false;
      m.lejos = false; ruta = camino(carro, m); drones.forEach(o => { o.vida = Math.min(o.vida, 6); });
      return true;
    },
    cancelarPiloto() { ruta = null; },
    drones: soltarDrones,
    hayDrones: () => drones.length > 0,
    estado: () => ({ x: carro.x, y: carro.y, v: carro.v, drones: drones.length, marcas: marcas.map(m => m.id), piloto: !!ruta, libre: libre(carro.x, carro.y) }),
    reiniciar() { carro = null; drones = []; ruta = null; },
  };
})();
