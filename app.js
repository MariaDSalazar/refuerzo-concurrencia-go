'use strict';
// Ciudad Goroutine · misiones de lógica sobre concurrencia en Go (semana 13 de POO). Juego original de ciudad abierta.
// Se recorre la ciudad, se llega a una misión y se resuelve un reto: seguir, calcular, ordenar, repartir o colocar.
// Las respuestas no están en la página: se guarda su huella SHA-256 y la explicación va cifrada (datos.js).

const J = window.JUEGO;
const CLAVE = 'ciudad-goroutine-v1';
const Q = Object.fromEntries(J.misiones.map(m => [m.id, m]));
const TOTAL = J.misiones.length, CAPS = J.capitulos.length;
const PREMIO = [500, 300, 150], COLOR_CAP = ['#EAAA00', '#6AD7E5', '#ff8ec0', '#ff9f5a', '#b79cf2'];
let E = null, ocupado = false, actual = null;

/* ---------------- estado guardado ---------------- */
// hechas: misiones cumplidas · fallos: veces que se falló cada una (también decide en qué lugar aparece)
const nuevo = (nombre = '', apellido = '') => ({ nombre, apellido, hechas: [], fallos: {}, dinero: 0, completo: false, mudo: false });
function cargar() { try { return { ...nuevo(), ...JSON.parse(localStorage.getItem(CLAVE)) }; } catch { return nuevo(); } }
const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(E)); } catch { /* sin almacenamiento */ } };
const capitulo = () => { for (const c of J.capitulos) if (J.misiones.some(m => m.cap === c.n && !E.hechas.includes(m.id))) return c; return null; };
const primeras = () => E.hechas.filter(id => !E.fallos[id]).length;

/* ---------------- utilidades ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const espera = ms => new Promise(ok => setTimeout(ok, ms));
const KW = /^(type|struct|interface|func|var|return|package|import|for|range|if|else|switch|case|default|map|nil|true|false|defer|go|continue)$/;
const TIPO = /^(string|int|bool|float64|error|any)$/;
function resaltar(src) {
  return src.replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:[^"\\]|\\.)*")|([A-Za-z_]\w*)|(\d+(?:\.\d+)?)|([\s\S])/g, (m, c, s, w, num) => {
    if (c) return `<span class="c">${esc(c)}</span>`;
    if (s) return `<span class="s">${esc(s)}</span>`;
    if (w) return KW.test(w) ? `<span class="k">${w}</span>` : TIPO.test(w) ? `<span class="t">${w}</span>` : w;
    if (num) return `<span class="n">${num}</span>`;
    return esc(m);
  });
}
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);
function nombreBonito(s) {
  return s.trim().replace(/\s+/g, ' ').toLowerCase().split(' ')
    .map((p, i) => i > 0 && PARTICULAS.has(p) ? p : p.replace(/(^|['-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())).join(' ');
}
function confeti() {
  const c = document.createElement('div'); c.className = 'confeti';
  const colores = ['#EAAA00', '#FFFFFF', '#ff8ec0', '#6AD7E5', '#37c978', '#b79cf2'];
  c.innerHTML = Array.from({ length: 70 }, () => `<i style="left:${Math.random() * 100}%;background:${colores[Math.floor(Math.random() * colores.length)]};animation-duration:${2 + Math.random() * 2.5}s;animation-delay:${Math.random() * .8}s"></i>`).join('');
  document.body.appendChild(c); setTimeout(() => c.remove(), 5000);
}
// sonidos cortos hechos con el navegador (sin archivos)
let audio = null;
const NOTAS = { ficha: [[880, .06], [1320, .08]], bien: [[523, .1], [659, .1], [784, .18]], mal: [[220, .15], [165, .25]], golpe: [[110, .1]], llegar: [[440, .08], [660, .12]] };
function sonar(q) {
  if (!E || E.mudo) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    let t = audio.currentTime;
    for (const [hz, d] of NOTAS[q]) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = q === 'golpe' || q === 'mal' ? 'square' : 'triangle'; o.frequency.value = hz;
      g.gain.setValueAtTime(.07, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + d); t += d * .8;
    }
  } catch { /* sin audio */ }
}

/* ---------------- pantalla y diálogo ---------------- */
function pintar(html, clase = '') {
  Ciudad.pausa(true);
  const quien = E && E.nombre ? `<div class="jugador"><b>${esc(E.nombre)} ${esc(E.apellido)}</b><span>${E.hechas.length} de ${TOTAL} misiones</span></div>` : '';
  document.body.innerHTML = `<header class="top"><div class="logo">${gopherSvg({ ojos: 'feliz', boca: 'abierta' })}<span>Ciudad <b>Goroutine</b></span></div>${quien}</header>
    <main id="app" class="${clase}">${html}</main>
    <dialog id="dlg" aria-labelledby="dlg-titulo"><div class="dlg-cuerpo" id="dlgc"></div><div class="dlg-pie" id="dlgpie"></div></dialog>`;
  $('#dlg').addEventListener('cancel', e => e.preventDefault());
  window.scrollTo({ top: 0 });
}
function abrirDlg(html, pie) {
  $('#dlgc').innerHTML = html; $('#dlgpie').innerHTML = pie;
  const d = $('#dlg'); if (!d.open) d.showModal();
  $('#dlgc').scrollTop = 0; Ciudad.pausa(true);
}
function cerrarDlg() { const d = $('#dlg'); if (d && d.open) d.close(); Ciudad.pausa(false); }

/* ---------------- inicio ---------------- */
function inicio() {
  const registro = E.nombre
    ? `<h2>Hola de nuevo, ${esc(E.nombre)}</h2><p class="suave">${E.completo ? 'Ya completaste la ciudad.' : `Llevas ${E.hechas.length} de ${TOTAL} misiones y $${E.dinero}.`}</p>
       <div class="fila-btn"><button class="btn grande" id="seguir">${E.completo ? `${ICONO.trofeo} Ver mi certificado` : `Volver a la calle ${ICONO.sig}`}</button></div>
       <div class="fila-btn"><button class="btn sec" id="otro">Soy otra persona / empezar de nuevo</button></div>`
    : `<h2>Registro</h2><p class="suave">Escribe tu nombre y tu apellido: aparecerán en tu certificado.</p>
       <label for="nom">Nombre</label><input type="text" id="nom" autocomplete="given-name" maxlength="30">
       <label for="ape">Apellido</label><input type="text" id="ape" autocomplete="family-name" maxlength="30">
       <p class="aviso" id="aviso" role="alert"></p><button class="btn grande" id="empezar">Salir a la calle ${ICONO.sig}</button>`;
  pintar(`<section class="portada">${gopherSvg({ ojos: 'arriba', boca: 'abierta', cejas: 'decidido' })}
      <h1>Ciudad <b>Goroutine</b></h1><p>Una ciudad, diez misiones y pura lógica. Concurrencia en Go · semana 13</p>
      <div class="chips">${J.capitulos.map(c => `<span class="chip">${c.n} · ${esc(c.titulo)}</span>`).join('')}</div></section>
    <div class="card">${registro}</div>
    <div class="card"><h2>${ICONO.ayuda} Cómo se juega</h2>
      <p>Conduce con las <b>flechas</b> o con <b>W A S D</b>; en el celular, con la palanca. Ve a los círculos numerados del mapa: cada uno es una misión. Si no quieres conducir, toca la misión en la lista y el carro irá solo.</p>
      <p>Cada misión es un <b>reto de lógica</b> con código de Go: seguir el tiempo, ordenar lo que se imprime, repartir trabajo, armar un programa, buscar dónde va una pieza. No hay preguntas de memoria.</p>
      <p>A la primera ganas <b>$500</b>; si fallas, la misión cambia de lugar, salen <b>drones bug</b> a perseguirte (si te tocan pierdes $20) y el premio baja. En la ciudad también hay monedas de <b>$10</b>.</p>
      <p>Hay 5 capítulos de 2 misiones. Al terminar recibes tu <b>certificado</b>. Tu avance se guarda en este dispositivo.</p></div>`);
  if (E.nombre) {
    $('#seguir').onclick = E.completo ? certificado : calle;
    $('#otro').onclick = () => { if (confirm('Se borrará el avance guardado en este dispositivo. ¿Continuar?')) { E = nuevo(); Ciudad.reiniciar(); guardar(); inicio(); } };
    return;
  }
  const valido = s => /^[\p{L}][\p{L}' -]{1,29}$/u.test(s.trim());
  const empezar = () => {
    const n = $('#nom').value, a = $('#ape').value;
    if (!valido(n) || !valido(a)) { $('#aviso').textContent = 'Escribe tu nombre y tu apellido (solo letras).'; return; }
    E = nuevo(nombreBonito(n), nombreBonito(a)); Ciudad.reiniciar(); guardar(); calle();
  };
  $('#empezar').onclick = empezar;
  ['#nom', '#ape'].forEach(s => $(s).addEventListener('keydown', e => { if (e.key === 'Enter') empezar(); }));
}

/* ---------------- la calle ---------------- */
const lugarDe = m => m.lugares[(E.fallos[m.id] || 0) % m.lugares.length];
const pendientes = () => { const c = capitulo(); return c ? J.misiones.filter(m => m.cap === c.n && !E.hechas.includes(m.id)) : []; };
const numero = m => J.misiones.indexOf(m) + 1;
function calle() {
  if (E.completo) { informe(); return; }
  pintar(`<div class="escena" id="escena"><canvas id="lienzo" tabindex="0" aria-label="Ciudad vista desde arriba. Conduce con las flechas o usa la lista de misiones para que el carro vaya solo."></canvas>
      <div class="hud hud-obj"><b id="cap"></b><span class="suave">Toca una misión y el carro va solo:</span><ul id="lista"></ul></div>
      <div class="hud hud-dinero" id="dinero" aria-live="polite"></div>
      <div class="hud hud-mapa"><canvas id="mini" width="460" height="346" aria-hidden="true"></canvas></div>
      <div id="palanca" aria-hidden="true"><i></i></div>
      <div class="hud hud-bot"><button class="btn sec" id="sonido"></button><button class="btn sec" id="ini">Inicio</button></div>
      <div class="cartel" id="cartel" aria-live="polite"></div></div>`, 'calle');
  Ciudad.abrir({ lienzo: $('#lienzo'), minimapa: $('#mini'), palanca: $('#palanca'), avisos: {
    llegar: id => { sonar('llegar'); mision(Q[id]); },
    ficha: () => { E.dinero += 10; sonar('ficha'); guardar(); hud(); },
    tocado: () => { E.dinero = Math.max(0, E.dinero - 20); sonar('mal'); guardar(); hud(); cartel('¡Te alcanzó un bug!', '−$20'); },
    librado: () => cartel('Perdiste a los drones', ''),
    sonido: sonar,
  } });
  $('#ini').onclick = inicio;
  const ps = () => { $('#sonido').textContent = E.mudo ? 'Sonido: no' : 'Sonido: sí'; };
  ps(); $('#sonido').onclick = () => { E.mudo = !E.mudo; guardar(); ps(); $('#lienzo').focus(); };
  ponerMisiones(); hud();
  const c = capitulo();
  if (!E.hechas.some(id => Q[id].cap === c.n)) cartel(`Capítulo ${c.n}`, c.titulo);
  $('#lienzo').focus();
}
function ponerMisiones() {
  const c = capitulo(), ps = pendientes();
  Ciudad.marcas(ps.map(m => ({ id: m.id, lugar: lugarDe(m), n: numero(m), color: COLOR_CAP[m.cap - 1] })));
  $('#cap').textContent = `Capítulo ${c.n} · ${c.titulo}`;
  $('#lista').innerHTML = ps.map(m => `<li><button data-id="${m.id}"><i style="background:${COLOR_CAP[m.cap - 1]}">${numero(m)}</i><span>${esc(m.titulo)}</span></button></li>`).join('');
  $$('#lista button').forEach(b => { b.onclick = () => { Ciudad.piloto(b.dataset.id); $('#lienzo').focus(); }; });
}
function hud() {
  const d = $('#dinero'); if (d) d.textContent = `$${E.dinero}`;
  const j = $('.jugador span'); if (j) j.textContent = `${E.hechas.length} de ${TOTAL} misiones`;
}
function cartel(t, sub) {
  const c = $('#cartel'); if (!c) return;
  c.innerHTML = `${esc(t)}<small>${esc(sub)}</small>`; c.classList.remove('ve'); void c.offsetWidth; c.classList.add('ve');
}

/* ---------------- misión: cada tipo de reto devuelve { html, conectar, leer } ---------------- */
// leer() da la respuesta como texto, o null si falta algo
const RETOS = {
  secuencia(m) {
    const fijo = m.etiquetas, v = fijo ? Array(fijo.length).fill(null) : [];
    let act = 0;
    const html = `<pre class="go" translate="no">${resaltar(m.codigo)}</pre>
      <p class="instr">${fijo ? 'Respuesta de cada solicitud (toca una casilla para cambiarla):' : 'Lo que se imprime, en orden (toca una para quitarla):'}</p>
      <div id="linea" class="${fijo ? 'pet' : 'linea'}"></div><div class="banco" id="banco" translate="no">${m.fichas.map((f, i) => `<button class="ficha" data-i="${i}">${esc(f)}</button>`).join('')}</div>`;
    const ver = () => {
      if (fijo) {
        $('#linea').innerHTML = fijo.map((e, i) => `<button data-i="${i}" class="${i === act ? 'act' : ''}">${i + 1}. GET ${esc(e)}<b>${v[i] === null ? '' : esc(v[i])}</b></button>`).join('');
        $$('#linea button').forEach(b => { b.onclick = () => { act = +b.dataset.i; ver(); }; });
      } else {
        $('#linea').innerHTML = v.map((x, i) => `<button class="ficha puesta" data-i="${i}" translate="no"><small>${i + 1}</small>${esc(x)}</button>`).join('');
        $$('#linea button').forEach(b => { b.onclick = () => { v.splice(+b.dataset.i, 1); ver(); }; });
        $$('#banco .ficha').forEach(b => { b.disabled = v.includes(m.fichas[+b.dataset.i]); });
      }
      listo();
    };
    return { html, leer: () => (fijo ? v.every(x => x !== null) : v.length > 0) ? v.join('>') : null,
      conectar() { $$('#banco .ficha').forEach(b => { b.onclick = () => { const x = m.fichas[+b.dataset.i]; if (fijo) { v[act] = x; const s = v.indexOf(null); if (s >= 0) act = s; } else v.push(x); ver(); }; }); ver(); } };
  },
  numeros(m) {
    return { html: `<pre class="go" translate="no">${resaltar(m.codigo)}</pre><div class="campos">${m.campos.map((c, i) => `<label>${esc(c)}<input type="text" inputmode="numeric" maxlength="5" autocomplete="off" data-i="${i}"></label>`).join('')}</div>`,
      leer: () => { const v = $$('.campos input').map(x => x.value.trim()); return v.every(x => /^\d+$/.test(x)) ? v.map(x => String(+x)).join('|') : null; },
      conectar() { $$('.campos input').forEach((x, i, a) => { x.oninput = listo; x.onkeydown = e => { if (e.key === 'Enter') { if (a[i + 1]) a[i + 1].focus(); else if (!$('#confirmar').disabled) $('#confirmar').click(); } }; }); } };
  },
  huecos(m) {
    const v = Array(m.bloques.length).fill(null);
    let sel = null;
    const cod = m.codigo.split('\n').map(l => { const h = l.match(/^(\s*)§(\d)§$/); return h ? `${h[1]}<button class="hueco" data-i="${h[2] - 1}" translate="no"></button>` : resaltar(l); }).join('\n');
    const ver = () => {
      $$('.hueco').forEach(b => { const x = v[+b.dataset.i]; b.textContent = x === null ? `casilla ${+b.dataset.i + 1}` : x; b.classList.toggle('lleno', x !== null); });
      $$('#banco .ficha').forEach(b => { const x = m.bloques[+b.dataset.i]; b.disabled = v.includes(x); b.classList.toggle('sel', sel === x); });
      listo();
    };
    return { html: `<pre class="go" translate="no">${cod}</pre><p class="instr">Toca un bloque y luego su casilla. El programa debe imprimir:</p><div class="terminal"><pre>${esc(m.meta)}</pre></div>
      <div class="banco" id="banco" translate="no">${m.bloques.map((f, i) => `<button class="ficha" data-i="${i}">${esc(f)}</button>`).join('')}</div>`,
    leer: () => v.includes(null) ? null : v.join('>'),
    conectar() {
      $$('#banco .ficha').forEach(b => { b.onclick = () => { sel = m.bloques[+b.dataset.i]; ver(); }; });
      $$('.hueco').forEach(b => { b.onclick = () => { const i = +b.dataset.i; if (sel !== null) { v[i] = sel; sel = null; } else v[i] = null; ver(); }; });
      ver();
    } };
  },
  puntos(m) {
    const v = Array(m.piezas.length).fill(null);
    let act = 0;
    const cod = m.codigo.split('\n').map(l => { const h = l.match(/^(\s*)§(\d)§$/); return h ? `${h[1]}<button class="punto" data-p="${h[2]}" translate="no"></button>` : resaltar(l); }).join('\n');
    const corto = i => m.piezas.length === 1 ? 'el bloque va aquí' : m.piezas[i];
    const ver = () => {
      $$('.punto').forEach(b => { const q = v.map((x, i) => x === b.dataset.p ? corto(i) : null).filter(Boolean); b.textContent = q.length ? q.join('  y  ') : `punto ${b.dataset.p}`; b.classList.toggle('lleno', q.length > 0); });
      $$('#banco .ficha').forEach(b => b.classList.toggle('sel', +b.dataset.i === act));
      listo();
    };
    const pieza = m.piezas.length === 1 ? `<p class="instr">El bloque de rescate:</p><pre class="go" translate="no">${resaltar(m.piezas[0].replace(/\t/g, '    '))}</pre>`
      : `<p class="instr">1) Elige la pieza · 2) toca su punto en el código</p><div class="banco" id="banco" translate="no">${m.piezas.map((x, i) => `<button class="ficha" data-i="${i}">${esc(x)}</button>`).join('')}</div>`;
    return { html: `${pieza}<pre class="go" translate="no">${cod}</pre><p class="instr">El programa debe imprimir:</p><div class="terminal"><pre>${esc(m.meta)}</pre></div>`,
      leer: () => v.includes(null) ? null : v.join('|'),
      conectar() {
        $$('#banco .ficha').forEach(b => { b.onclick = () => { act = +b.dataset.i; ver(); }; });
        $$('.punto').forEach(b => { b.onclick = () => { v[act] = b.dataset.p; const s = v.indexOf(null); if (s >= 0) act = s; ver(); }; });
        ver();
      } };
  },
  reparto(m) {
    const v = Array(m.tareas.length).fill(null);
    let sel = null;
    const ficha = i => `<span class="ficha${sel === i ? ' sel' : ''}" data-i="${i}" role="button" tabindex="0">${esc(m.tareas[i][0])} · ${m.tareas[i][1]} s</span>`;
    const ver = () => {
      $('#banco').innerHTML = v.map((g, i) => g === null ? ficha(i) : '').join('') || '<span class="suave">Todo repartido. Toca un encargo si quieres moverlo.</span>';
      $$('.carril').forEach((c, g) => { c.innerHTML = `<b>Conductor ${g + 1}</b>${v.map((x, i) => x === g ? ficha(i) : '').join('')}`; });
      $$('#reto .ficha').forEach(b => { b.onclick = e => { e.stopPropagation(); sel = +b.dataset.i; ver(); }; b.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); b.click(); } }; });
      listo();
    };
    return { html: `<pre class="go" translate="no">${resaltar(m.codigo)}</pre><p class="instr">Encargos:</p><div class="banco" id="banco"></div>
      <div class="carriles">${Array.from({ length: m.grupos }, (_, g) => `<div class="carril" data-g="${g}" role="button" tabindex="0"></div>`).join('')}</div>`,
    leer: () => v.includes(null) ? null : 'reparto:' + JSON.stringify(Array.from({ length: m.grupos }, (_, g) => m.tareas.filter((t, i) => v[i] === g).map(t => t[1]))),
    conectar() { $$('.carril').forEach(c => { c.onclick = () => { if (sel === null) return; v[sel] = +c.dataset.g; sel = null; ver(); }; c.onkeydown = e => { if (e.key === 'Enter') c.click(); }; }); ver(); } };
  },
  intercalar(m) {
    const orden = [], PASOS = ['lee', 'resta', 'escribe'];
    const hechos = g => orden.filter(x => x === g).length;
    const ver = () => {
      const cuenta = {};
      $('#linea').innerHTML = orden.map((g, i) => { const k = cuenta[g] = (cuenta[g] ?? -1) + 1; return `<span class="ficha puesta"><small>${i + 1}</small>${g} ${PASOS[k]}</span>`; }).join('');
      $$('.columnas .ficha').forEach(b => { b.disabled = hechos(b.dataset.g) !== +b.dataset.k; });
      listo();
    };
    return { html: `<pre class="go" translate="no">${resaltar(m.codigo)}</pre><p class="instr">Orden en que se ejecutan (cada goroutine respeta sus pasos):</p><div class="linea" id="linea"></div>
      <div class="columnas">${m.retiros.map(([g, r]) => `<div><b>Goroutine ${g} (retira ${r})</b>${PASOS.map((p, k) => `<button class="ficha" data-g="${g}" data-k="${k}">${g} ${p}</button>`).join('')}</div>`).join('')}</div>
      <button class="btn sec" id="borrar">Borrar el orden</button>`,
    leer: () => orden.length === 6 ? 'orden:' + orden.join('') : null,
    conectar() { $$('.columnas .ficha').forEach(b => { b.onclick = () => { orden.push(b.dataset.g); ver(); }; }); $('#borrar').onclick = () => { orden.length = 0; ver(); }; ver(); } };
  },
};
function listo() { const b = $('#confirmar'); if (b && actual) b.disabled = actual.leer() === null; }
function mision(m) {
  const c = J.contactos[m.contacto];
  actual = RETOS[m.tipo](m);
  abrirDlg(`<span class="chip">Misión ${numero(m)} de ${TOTAL} · ${esc(J.capitulos[m.cap - 1].tema)}</span><h3 class="mtit" id="dlg-titulo">${esc(m.titulo)}</h3>
    <div class="llamada" style="--c:${c.color}">${gopherSvg({ color: c.color, ojos: 'normal' })}<div><b>${esc(c.nombre)}</b> <small>${esc(c.cargo)}</small><p>${m.historia}</p></div></div>
    <p class="tarea">${m.tarea}</p><div id="reto">${actual.html}</div><div id="retro"></div>`,
  `<button class="btn sec" id="luego">Volver después</button><button class="btn" id="confirmar" disabled>Confirmar ${ICONO.sig}</button>`);
  actual.conectar(); listo();
  $('#luego').onclick = () => { actual = null; cerrarDlg(); $('#lienzo').focus(); };
  $('#confirmar').onclick = () => confirmar(m);
}

/* ---------------- consola: el programa se ejecuta de verdad en el Go Playground ---------------- */
async function ejecutarGo(fuente) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch('https://play.golang.org/compile', { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ version: '2', body: fuente, withVet: 'false' }).toString() });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (j.Errors) return { compila: false, texto: j.Errors.trim().replace(/\t/g, '    ') };
    const ls = (j.Events || []).map(ev => ev.Message).join('').replace(/\n$/, '').replace(/\/tmp\/sandbox\d+\/src\//g, '').replace(/\t/g, '    ').split('\n');
    return { compila: true, texto: ls.length > 14 ? ls.slice(0, 14).join('\n') + '\n…' : ls.join('\n'), codigoSalida: j.Status };
  } catch { return null; } finally { clearTimeout(t); }
}
async function consola(fuente, guardada) {
  const z = $('#consola'); if (!z) return;
  z.innerHTML = `<div class="terminal"><div class="term-cab">${ICONO.terminal}<span>$ go run .</span></div><pre id="sal">Compilando y ejecutando con Go…</pre></div>`;
  const r = await ejecutarGo(fuente), sal = $('#sal');
  if (!sal) return;
  if (!r) { sal.textContent = guardada ? `${guardada}\n\n(sin conexión: salida que dio Go 1.27 al preparar el juego)` : 'Sin conexión: no se pudo ejecutar con Go.'; return; }
  sal.parentNode.classList.toggle('mal', !r.compila || r.codigoSalida !== 0);
  sal.textContent = r.texto + (r.compila ? `\n\nTerminó con código de salida ${r.codigoSalida} · Go en go.dev` : '\n\nNo compila: Go muestra el error y no ejecuta el programa.');
}
// arma el programa con la respuesta: cada §n§ se cambia por sus líneas, con la sangría de su sitio
function armar(fuente, puestos) {
  return fuente.split('\n').flatMap(l => { const h = l.match(/^(\t*)§(\d)§$/); return h ? (puestos[h[2]] || []).flatMap(x => x.split('\n').map(y => h[1] + y)) : [l]; }).join('\n');
}
function programaDe(m, resp) {
  if (m.tipo === 'huecos') return armar(m.fuente, Object.fromEntries(resp.split('>').map((b, i) => [i + 1, [b]])));
  if (m.tipo === 'puntos') { const d = {}; resp.split('|').forEach((p, i) => { (d[p] = d[p] || []).push(m.piezas[i]); }); return armar(m.fuente, d); }
  if (m.tipo === 'reparto') return m.fuente.replace('§R§', JSON.parse(resp.slice(8)).map(g => `{${g.join(', ')}}`).join(', '));
  return null;
}
// la simulación de los seis pasos, para mostrar cómo queda el saldo
function simular(m, orden) {
  let s = m.inicial; const reg = {}, p = {}, ret = Object.fromEntries(m.retiros), filas = [];
  for (const g of orden) {
    const k = p[g] = (p[g] ?? -1) + 1;
    if (k === 0) reg[g] = s; else if (k === 1) reg[g] -= ret[g]; else s = reg[g];
    filas.push([`${g} ${['lee', 'resta', 'escribe'][k]}`, reg.A ?? '', reg.B ?? '', s]);
  }
  return { s, filas };
}
async function confirmar(m) {
  if (ocupado) return;
  const resp = actual.leer(); if (resp === null) return;
  ocupado = true;
  let clave = resp, extra = '', nota = '';
  if (m.tipo === 'reparto') { const t = Math.max(...JSON.parse(resp.slice(8)).map(g => g.reduce((a, b) => a + b, 0))); clave = String(t); nota = `Tu reparto tarda ${t} s.`; }
  if (m.tipo === 'intercalar') {
    const r = simular(m, resp.slice(6)); clave = String(r.s); nota = `El saldo termina en ${r.s}.`;
    extra = `<table class="traza"><thead><tr><th>Paso</th><th>a</th><th>b</th><th>saldo</th></tr></thead><tbody>${r.filas.map(f => `<tr>${f.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  const bien = (await Cifra.huella(J.sal, m.id, clave)) === m.h;
  $$('#reto button, #reto input').forEach(b => { b.disabled = true; }); $$('#reto .carril, #reto .ficha').forEach(b => { b.onclick = null; b.onkeydown = null; });
  const prog = programaDe(m, resp);
  if (bien) {
    const r = await Cifra.abrir(await Cifra.llave(J.sal, m.id, clave), m.x);
    const gana = PREMIO[Math.min(E.fallos[m.id] || 0, PREMIO.length - 1)];
    E.hechas.push(m.id); E.dinero += gana; sonar('bien'); guardar(); hud();
    const fuente = prog || r.fuente;
    $('#retro').innerHTML = `<div class="retro ok">${gopherSvg({ ojos: 'feliz', boca: 'abierta' })}<div><h3>¡Misión cumplida! +$${gana}</h3><p>${nota ? `<b>${esc(nota)}</b> ` : ''}${r.por}</p></div></div>${extra}${fuente ? '<p class="instr">El programa en Go:</p><div id="consola"></div>' : ''}`;
    $('#dlgpie').innerHTML = `<button class="btn" id="seguir">Seguir ${ICONO.sig}</button>`;
    $('#seguir').onclick = () => { actual = null; cerrarDlg(); siguiente(m, gana); };
    if (fuente) consola(fuente, r.real);
  } else {
    E.fallos[m.id] = (E.fallos[m.id] || 0) + 1; sonar('mal'); guardar();
    $('#retro').innerHTML = `<div class="retro no">${gopherSvg({ ojos: 'x', boca: 'abierta' })}<div><h3>La misión falló</h3><p>${nota ? `<b>${esc(nota)}</b> ` : ''}<b>Pista:</b> ${m.pista}</p><p>La misión cambió de lugar. ¡Cuidado con los drones!</p></div></div>${extra}${prog ? '<p class="instr">Así responde Go con tu programa:</p><div id="consola"></div>' : ''}`;
    $('#dlgpie').innerHTML = `<button class="btn" id="seguir">Escapar ${ICONO.sig}</button>`;
    $('#seguir').onclick = () => { actual = null; cerrarDlg(); ponerMisiones(); Ciudad.drones(Math.min(3, E.fallos[m.id])); cartel('Misión fallida', 'Inténtalo en el nuevo punto'); $('#lienzo').focus(); };
    if (prog) consola(prog);
  }
  ocupado = false;
  $('#retro').scrollIntoView({ block: 'start', behavior: 'smooth' }); $('#seguir').focus({ preventScroll: true });
}
function siguiente(m, gana) {
  if (E.hechas.length === TOTAL) { E.completo = true; guardar(); final(); return; }
  const c = capitulo(); ponerMisiones(); hud();
  if (c.n !== m.cap) { confeti(); cartel(`Capítulo ${c.n}`, c.titulo); } else cartel('¡Misión cumplida!', `+$${gana}`);
  $('#lienzo').focus();
}
function final() {
  confeti();
  abrirDlg(`<div class="retro ok">${gopherSvg({ ojos: 'feliz', boca: 'abierta' })}<div><h3 id="dlg-titulo">¡La ciudad es tuya!</h3><p>Cumpliste las ${TOTAL} misiones: ${primeras()} a la primera y $${E.dinero} reunidos.</p></div></div>`,
    `<button class="btn sec" id="dinf">${ICONO.informe} Ver mi informe</button><button class="btn" id="dcert">${ICONO.trofeo} Ver mi certificado</button>`);
  $('#dinf').onclick = informe; $('#dcert').onclick = certificado;
}

/* ---------------- informe ---------------- */
const porTema = () => J.capitulos.map(c => { const ms = J.misiones.filter(m => m.cap === c.n), bien = ms.filter(m => E.hechas.includes(m.id) && !E.fallos[m.id]).length; return { tema: c.tema, bien, total: ms.length, p: Math.round(bien / ms.length * 100) }; });
const nivelTema = p => p >= 80 ? 'Lo domina' : p >= 50 ? 'En proceso' : 'Debe practicarlo';
function informe() {
  if (!E.completo) { calle(); return; }
  const ts = porTema(), a = primeras(), p = Math.round(a / TOTAL * 100);
  pintar(`<div class="card"><h2>${ICONO.informe} Informe</h2><p><b>${esc(E.nombre)} ${esc(E.apellido)}</b> · ${a} de ${TOTAL} misiones a la primera (${p} %) · $${E.dinero}</p>
      <div class="temas">${ts.map(x => `<div class="tema"><b>${esc(x.tema)}</b><div class="barra"><i class="${x.p >= 80 ? '' : x.p >= 50 ? 'medio' : 'bajo'}" style="width:${x.p}%"></i></div><span>${x.bien}/${x.total}</span><small>${nivelTema(x.p)}</small></div>`).join('')}</div>
      <div class="fila-btn no-imprimir"><button class="btn" id="cert">${ICONO.trofeo} Ver mi certificado</button><button class="btn sec" id="imprimir">${ICONO.imprimir} Imprimir</button><button class="btn sec" id="ini">Inicio</button></div></div>`);
  $('#cert').onclick = certificado; $('#ini').onclick = inicio; $('#imprimir').onclick = () => window.print();
}

/* ---------------- certificado ---------------- */
const rango = p => p >= 90 ? 'Leyenda de la ciudad' : p >= 70 ? 'Jefatura de ruta' : p >= 50 ? 'Conducción experta' : 'Aprendiz al volante';
function codigo(texto) {
  let h = 0x811c9dc5;
  for (const ch of texto) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  const s = h.toString(36).toUpperCase().padStart(8, '0').slice(-8);
  return s.slice(0, 4) + '-' + s.slice(4);
}
function caja(x, a, b, w, h, r) { x.beginPath(); if (x.roundRect) x.roundRect(a, b, w, h, r); else x.rect(a, b, w, h); }
const cargarImg = src => new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = src; });
const svgUrl = (vb, w, h, cuerpo) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}">${cuerpo}</svg>`);
async function dibujarCertificado() {
  try { await Promise.all([document.fonts.load('800 60px Poppins'), document.fonts.load('600 30px Poppins'), document.fonts.load('400 28px Poppins')]); } catch { /* fuente del sistema */ }
  const AN = 1600, AL = 1131, c = document.createElement('canvas'); c.width = AN; c.height = AL;
  const x = c.getContext('2d'), AZUL = '#002C71', DORADO = '#EAAA00', MAG = '#910048', GRIS = '#4a5461';
  x.fillStyle = '#fff'; x.fillRect(0, 0, AN, AL); x.fillStyle = '#fbf7ec'; x.fillRect(60, 60, AN - 120, AL - 120);
  x.strokeStyle = DORADO; x.lineWidth = 16; x.strokeRect(28, 28, AN - 56, AL - 56);
  x.strokeStyle = AZUL; x.lineWidth = 3; x.strokeRect(60, 60, AN - 120, AL - 120);
  x.fillStyle = DORADO;
  [[60, 60, 1, 1], [AN - 60, 60, -1, 1], [60, AL - 60, 1, -1], [AN - 60, AL - 60, -1, -1]].forEach(([a, b, sx, sy]) => { x.beginPath(); x.moveTo(a, b); x.lineTo(a + 84 * sx, b); x.lineTo(a, b + 84 * sy); x.closePath(); x.fill(); });
  x.textAlign = 'left'; x.font = '800 50px Poppins, sans-serif'; x.fillStyle = AZUL; x.fillText('Ciudad', 130, 150); x.fillStyle = DORADO; x.fillText('Goroutine', 130, 206);
  try { x.drawImage(await cargarImg(svgUrl('0 0 120 136', 240, 272, gopher({ ojos: 'feliz', boca: 'abierta' }))), AN - 300, 80, 190, 215); } catch { /* sin dibujo */ }
  const centro = (txt, y, fuente, color) => { x.font = fuente; x.fillStyle = color; x.textAlign = 'center'; x.fillText(txt, AN / 2, y); };
  centro('CERTIFICADO DE COMPLETADO', 320, '800 62px Poppins, sans-serif', AZUL);
  x.fillStyle = DORADO; x.fillRect(AN / 2 - 160, 342, 320, 6);
  centro('Se otorga a', 410, '400 30px Poppins, sans-serif', GRIS);
  const nombre = `${E.nombre} ${E.apellido}`;
  let tam = 78; x.font = `800 ${tam}px Poppins, sans-serif`;
  while (x.measureText(nombre).width > AN - 360 && tam > 40) { tam -= 4; x.font = `800 ${tam}px Poppins, sans-serif`; }
  centro(nombre, 498, `800 ${tam}px Poppins, sans-serif`, MAG);
  x.strokeStyle = DORADO; x.lineWidth = 3; x.beginPath(); x.moveTo(AN / 2 - 420, 528); x.lineTo(AN / 2 + 420, 528); x.stroke();
  centro('por resolver las 10 misiones de lógica de Ciudad Goroutine: concurrencia en Go', 588, '600 29px Poppins, sans-serif', AZUL);
  centro('Programación Orientada a Objetos · semana 13', 630, '400 22px Poppins, sans-serif', GRIS);
  const a = primeras(), p = Math.round(a / TOTAL * 100);
  [[`${a} de ${TOTAL}`, 'a la primera'], [`$${E.dinero}`, 'reunidos en la ciudad'], [rango(p), 'nivel alcanzado']].forEach(([v, et], i) => {
    const cxx = AN / 2 + (i - 1) * 420, y = 668;
    x.fillStyle = i === 2 ? '#fdf2f7' : '#eef3fb'; x.strokeStyle = i === 2 ? MAG : AZUL; x.lineWidth = 2; caja(x, cxx - 190, y, 380, 104, 18); x.fill(); x.stroke();
    x.textAlign = 'center'; x.fillStyle = i === 2 ? MAG : AZUL;
    let t = 40; x.font = `800 ${t}px Poppins, sans-serif`;
    while (x.measureText(v).width > 350 && t > 22) { t -= 2; x.font = `800 ${t}px Poppins, sans-serif`; }
    x.fillText(v, cxx, y + 56); x.font = '400 20px Poppins, sans-serif'; x.fillStyle = GRIS; x.fillText(et, cxx, y + 88);
  });
  x.font = '600 17px Poppins, sans-serif';
  porTema().forEach((tm, i) => {
    const px = 150 + (i % 3) * 440, y = 825 + Math.floor(i / 3) * 52;
    x.textAlign = 'left'; x.fillStyle = AZUL; x.fillText(tm.tema, px, y);
    x.fillStyle = '#e8edf4'; x.fillRect(px, y + 9, 330, 9); x.fillStyle = tm.p >= 80 ? '#1E9E5A' : tm.p >= 50 ? DORADO : '#C62839'; x.fillRect(px, y + 9, 330 * tm.p / 100, 9);
    x.fillStyle = GRIS; x.textAlign = 'right'; x.fillText(`${tm.bien}/${tm.total}`, px + 386, y + 18);
  });
  const fecha = new Date().toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
  x.textAlign = 'left'; x.fillStyle = GRIS; x.font = '400 22px Poppins, sans-serif';
  x.strokeStyle = DORADO; x.lineWidth = 2; x.beginPath(); x.moveTo(130, 945); x.lineTo(AN - 130, 945); x.stroke();
  x.fillText(fecha.charAt(0).toUpperCase() + fecha.slice(1), 130, 990); x.font = '400 18px Poppins, sans-serif'; x.fillText('Fecha', 130, 1016);
  x.textAlign = 'right'; x.fillStyle = AZUL; x.font = '600 24px "JetBrains Mono", Consolas, monospace'; x.fillText(codigo(`${nombre}|${a}|${E.dinero}|${fecha}`), AN - 130, 990);
  x.fillStyle = GRIS; x.font = '400 18px Poppins, sans-serif'; x.fillText('Código de verificación', AN - 130, 1016);
  return c;
}
async function certificado() {
  if (!E.completo) { calle(); return; }
  pintar(`<div class="card centro"><h2 style="justify-content:center">${ICONO.trofeo} Tu certificado</h2><p class="suave" id="gen">Generando…</p><div id="certzona"></div></div>`);
  const url = (await dibujarCertificado()).toDataURL('image/png');
  const archivo = `Certificado-Ciudad-Goroutine-${E.nombre}-${E.apellido}.png`.replace(/\s+/g, '-');
  $('#certzona').innerHTML = `<img class="cert" src="${url}" alt="Certificado de ${esc(E.nombre)} ${esc(E.apellido)}">
    <div class="fila-btn" style="justify-content:center"><a class="btn" id="descargar" href="${url}" download="${esc(archivo)}">${ICONO.descargar} Descargar certificado</a><button class="btn sec" id="inf">${ICONO.informe} Ver mi informe</button><button class="btn sec" id="ini">Inicio</button></div>
    <p class="suave">En el celular también puedes mantener presionada la imagen para guardarla.</p>`;
  $('#gen').remove(); $('#ini').onclick = inicio; $('#inf').onclick = informe; confeti();
}

/* ---------------- arranque ---------------- */
function arrancar() {
  E = cargar();
  if (!Array.isArray(E.hechas) || E.hechas.some(id => !Q[id])) E = nuevo(E.nombre, E.apellido);   // datos de otra versión
  inicio();
}
Promise.all([document.fonts.load('15px "JetBrains Mono"'), document.fonts.load('700 16px Poppins'), document.fonts.load('400 15px Poppins')]).catch(() => null).then(arrancar);
