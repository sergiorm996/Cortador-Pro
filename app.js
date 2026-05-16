/* ── == CONFIGURACIÓN == ─────────────────────────────────────────
   Cambia estos valores por defecto si quieres otros iniciales.
   Los valores reales se guardan en localStorage del usuario.    */

const DEFAULTS = {
  cfg: { iva: 21, irpf: 15, cuota: 320 },
  fabricas: [
    { id: 'fab-1', nombre: 'Fábrica Premium',    precio: 3.20 },
    { id: 'fab-2', nombre: 'Jamones del Sur',    precio: 2.80 },
    { id: 'fab-3', nombre: 'Ibéricos Salamanca', precio: 3.50 },
  ],
  theme: 'light',
};

const STORAGE_KEY = 'cortador-pro-v1';
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

/* ── Estado global ───────────────────────────────────────────── */
let state = cargarEstado();

function cargarEstado() {
  const base = {
    ...DEFAULTS,
    selFabId:    null,
    jamones:     [],
    gastosDelDia: 0,
    registros:   [],
    mesSel:      new Date().getMonth(),
    anioSel:     new Date().getFullYear(),
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...base, ...saved, jamones: [], selFabId: null, gastosDelDia: 0 };
  } catch { return base; }
}

function guardarEstado() {
  const toSave = { cfg: state.cfg, fabricas: state.fabricas, registros: state.registros, theme: state.theme, mesSel: state.mesSel, anioSel: state.anioSel };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave)); } catch {}
}

/* ── == LÓGICA == ────────────────────────────────────────────────
   Funciones de cálculo. Modificar aquí si cambia la lógica.     */

/** Formatea un número como euros: 1234.5 → "1.234,50 €" */
function eur(n, dec = 2) {
  if (isNaN(n)) n = 0;
  return Math.abs(n).toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + ' €';
}

/** Devuelve la fábrica seleccionada o null */
function getFab() {
  return state.fabricas.find(f => f.id === state.selFabId) || null;
}

/** Calcula todos los valores de la jornada actual */
function calcJornada() {
  const fab = getFab();
  if (!fab) return null;
  const totalPlatos = state.jamones.reduce((s, j) => s + (j.platos || 0), 0);
  if (totalPlatos === 0) return null;
  const bruto   = totalPlatos * fab.precio;
  const iva     = bruto * (state.cfg.iva / 100);
  const irpf    = bruto * (state.cfg.irpf / 100);
  const cobrado = bruto + iva - irpf;
  const neto    = bruto - irpf - state.gastosDelDia;
  return { totalPlatos, bruto, iva, irpf, cobrado, neto };
}

/** Calcula el resumen de un mes */
function calcMes(mes, anio) {
  const regs = state.registros.filter(r => {
    const d = new Date(r.fecha + 'T12:00:00');
    return d.getMonth() === mes && d.getFullYear() === anio;
  });
  const dias    = regs.length;
  const jamones = regs.reduce((s, r) => s + r.totalJamones, 0);
  const platos  = regs.reduce((s, r) => s + r.totalPlatos, 0);
  const bruto   = regs.reduce((s, r) => s + r.bruto, 0);
  const iva     = regs.reduce((s, r) => s + r.iva, 0);
  const irpf    = regs.reduce((s, r) => s + r.irpf, 0);
  const gastos  = regs.reduce((s, r) => s + r.gastos, 0);
  const cuota   = dias > 0 ? (regs[0].cuotaDelMes ?? state.cfg.cuota) : 0;
  const neto    = bruto - irpf - gastos - cuota;
  return { dias, jamones, platos, bruto, iva, irpf, gastos, cuota, neto };
}

/* ── Generador de IDs ────────────────────────────────────────── */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* ── TEMA ────────────────────────────────────────────────────── */
const ICON_MOON = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
const ICON_SUN  = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>';

function setTheme(t) {
  state.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('theme-meta').setAttribute('content', t === 'dark' ? '#0A0A0B' : '#FAFAFA');
  document.getElementById('theme-icon').innerHTML = t === 'dark' ? ICON_SUN : ICON_MOON;
  document.getElementById('theme-hint').textContent = t === 'dark' ? 'Oscuro' : 'Claro';
  document.getElementById('opt-light').classList.toggle('active', t === 'light');
  document.getElementById('opt-dark').classList.toggle('active',  t === 'dark');
  guardarEstado();
}

function toggleTheme() { setTheme(state.theme === 'light' ? 'dark' : 'light'); }

/* ── TABS ────────────────────────────────────────────────────── */
function switchTab(nombre, btn) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('screen-' + nombre).classList.add('active');
  btn.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (nombre === 'historial') renderHistorial();
  if (nombre === 'resumen')   renderResumen();
  if (nombre === 'ajustes')   renderFabCfg();
}

/* ── MODAL SELECTOR DE FÁBRICA ───────────────────────────────── */
function abrirModal() {
  var lista = document.getElementById('modal-opciones');
  if (state.fabricas.length === 0) {
    lista.innerHTML = '<div style="text-align:center;padding:32px 20px;color:var(--ink-3);font-size:13px">No tienes f\u00e1bricas.<br>Ve a Ajustes para a\u00f1adir.</div>';
  } else {
    var svgCheck = '<span class="modal-option-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>';
    lista.innerHTML = state.fabricas.map(function(f) {
      var isSelected = state.selFabId === f.id;
      return (
        '<div class="modal-option ' + (isSelected ? 'selected' : '') + '" onclick="seleccionarFab(\'' + f.id + '\')">' +
          '<div>' +
            '<div class="modal-option-name">' + (esc(f.nombre) || '(sin nombre)') + '</div>' +
            '<div class="modal-option-meta">' + eur(f.precio) + ' por plato</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:6px">' +
            '<span class="modal-option-price">' + eur(f.precio) + '</span>' +
            (isSelected ? svgCheck : '') +
          '</div>' +
        '</div>'
      );
    }).join('');
  }
  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function cerrarModal() {
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
}

function cerrarModalSiFondo(e) {
  if (e.target.id === 'modal') cerrarModal();
}

function seleccionarFab(id) {
  state.selFabId = id;
  renderFabSelector();
  renderJamones();
  recalc();
  cerrarModal();
}

/* ── SELECTOR DE FÁBRICA ─────────────────────────────────────── */
function renderFabSelector() {
  const fab = getFab();
  const nameEl  = document.getElementById('fab-nombre');
  const badgeEl = document.getElementById('fab-badge');
  if (fab) {
    nameEl.textContent = fab.nombre || '(sin nombre)';
    nameEl.classList.remove('empty');
    badgeEl.classList.remove('empty');
    badgeEl.querySelector('.fab-price-num').textContent = eur(fab.precio).replace(' €', '');
  } else {
    nameEl.textContent = 'Sin seleccionar';
    nameEl.classList.add('empty');
    badgeEl.classList.add('empty');
    badgeEl.querySelector('.fab-price-num').textContent = '—';
  }
}

/* ── JAMONES ─────────────────────────────────────────────────── */
function addJamon() {
  if (state.jamones.length >= 20) { toast('Máximo 20 jamones por jornada'); return; }
  state.jamones.push({ id: genId(), platos: 0 });
  renderJamones();
  recalc();
}

function delJamon(id) {
  state.jamones = state.jamones.filter(j => j.id !== id);
  renderJamones();
  recalc();
}

function cambiarPlatos(id, delta) {
  const j = state.jamones.find(x => x.id === id);
  if (!j) return;
  j.platos = Math.max(0, (j.platos || 0) + delta);
  var inp = document.querySelector('[data-jid="' + id + '"]');
  if (inp) inp.value = j.platos;
  actualizarSubtotal(id);
  recalc();
}

function setPlatos(id, val) {
  const j = state.jamones.find(x => x.id === id);
  if (!j) return;
  j.platos = Math.max(0, parseInt(val) || 0);
  actualizarSubtotal(id);
  recalc();
}

function actualizarSubtotal(id) {
  const j    = state.jamones.find(x => x.id === id);
  const fab  = getFab();
  const precio = fab ? fab.precio : 0;
  var el   = document.querySelector('[data-sub="' + id + '"]');
  if (!el || !j) return;
  el.innerHTML = j.platos > 0
    ? j.platos + ' platos · <span class="sub">' + eur(j.platos * precio) + '</span>'
    : `<span style="color:var(--ink-5)">sin cortar</span>`;
}

function renderJamones() {
  var container = document.getElementById('jamon-container');
  var list      = document.getElementById('jamon-list');
  var countLbl  = document.getElementById('jamon-count-label');
  var fab       = getFab();
  var precio    = fab ? fab.precio : 0;

  countLbl.textContent = state.jamones.length === 0 ? '0 piezas' :
                         state.jamones.length === 1 ? '1 pieza'  :
                         state.jamones.length + ' piezas';

  if (state.jamones.length === 0) { container.style.display = 'none'; return; }
  container.style.display = 'block';

  var svgMinus = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  var svgPlus  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  var svgX     = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  list.innerHTML = state.jamones.map(function(j, i) {
    var idx     = String(i+1).padStart(2, '0');
    var subHtml = j.platos > 0
      ? j.platos + ' platos &middot; <span class="sub">' + eur(j.platos * precio) + '</span>'
      : '<span style="color:var(--ink-5)">sin cortar</span>';
    return (
      '<div class="jamon-row">' +
        '<div class="jamon-idx">' + idx + '</div>' +
        '<div class="jamon-info">' +
          '<div class="jamon-name">Jam\u00f3n ' + (i + 1) + '</div>' +
          '<div class="jamon-detail" data-sub="' + j.id + '">' + subHtml + '</div>' +
        '</div>' +
        '<div class="jamon-controls">' +
          '<div class="stepper">' +
            '<button class="stepper-btn" onclick="cambiarPlatos(\'' + j.id + '\',-1)" aria-label="Restar">' + svgMinus + '</button>' +
            '<div class="stepper-sep"></div>' +
            '<input class="stepper-input" type="number" min="0" value="' + (j.platos || 0) + '" data-jid="' + j.id + '" oninput="setPlatos(\'' + j.id + '\',this.value)" onfocus="this.select()">' +
            '<div class="stepper-sep"></div>' +
            '<button class="stepper-btn" onclick="cambiarPlatos(\'' + j.id + '\',1)" aria-label="Sumar">' + svgPlus + '</button>' +
          '</div>' +
          '<button class="del-btn" onclick="delJamon(\'' + j.id + '\')" aria-label="Eliminar jam\u00f3n">' + svgX + '</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

/* ── CÁLCULO EN TIEMPO REAL ──────────────────────────────────── */
function recalc() {
  state.gastosDelDia = Math.max(0, parseFloat(document.getElementById('gastos-dia').value) || 0);
  const calc  = calcJornada();
  const wrap  = document.getElementById('calc-wrap');
  const btn   = document.getElementById('btn-guardar');

  if (!calc) { wrap.style.display = 'none'; btn.disabled = true; return; }

  document.getElementById('calc-meta').textContent    = state.jamones.length + (state.jamones.length === 1 ? ' jamón' : ' jamones');
  document.getElementById('r-platos').textContent     = calc.totalPlatos;
  document.getElementById('r-bruto').textContent      = eur(calc.bruto);
  document.getElementById('r-iva-pct').textContent    = state.cfg.iva;
  document.getElementById('r-irpf-pct').textContent   = state.cfg.irpf;
  document.getElementById('r-iva').textContent        = eur(calc.iva);
  document.getElementById('r-irpf').textContent       = '−' + eur(calc.irpf);
  document.getElementById('r-cobrado').textContent    = eur(calc.cobrado);

  const rowG = document.getElementById('row-gastos');
  if (state.gastosDelDia > 0) {
    rowG.style.display = 'flex';
    document.getElementById('r-gastos').textContent = '−' + eur(state.gastosDelDia);
  } else { rowG.style.display = 'none'; }

  const netoEl = document.getElementById('r-neto');
  netoEl.textContent = (calc.neto < 0 ? '−' : '') + eur(Math.abs(calc.neto));
  netoEl.className   = 'hero-value' + (calc.neto < 0 ? ' neg' : '');

  wrap.style.display = 'block';
  btn.disabled = false;
}

/* ── GUARDAR JORNADA ─────────────────────────────────────────── */
function guardarJornada() {
  const fab  = getFab();
  const calc = calcJornada();
  if (!fab || !calc) return;

  const hoy = new Date().toISOString().split('T')[0];
  if (state.registros.some(r => r.fecha === hoy)) {
    toast('Ya guardaste una jornada hoy. Elimina la anterior si quieres reemplazarla.');
    return;
  }

  state.registros.unshift({
    id:           genId(),
    fecha:        hoy,
    fabrica:      fab.nombre,
    precio:       fab.precio,
    jamones:      state.jamones.map(j => ({ platos: j.platos })),
    totalJamones: state.jamones.length,
    totalPlatos:  calc.totalPlatos,
    bruto:        calc.bruto,
    iva:          calc.iva,
    irpf:         calc.irpf,
    cobrado:      calc.cobrado,
    gastos:       state.gastosDelDia,
    neto:         calc.neto,
    cuotaDelMes:  state.cfg.cuota,
  });

  // Reset jornada
  state.jamones      = [];
  state.selFabId     = null;
  state.gastosDelDia = 0;
  document.getElementById('gastos-dia').value = '';
  renderFabSelector();
  renderJamones();
  recalc();
  guardarEstado();
  toast('Jornada guardada');
}

/* ── HISTORIAL ───────────────────────────────────────────────── */
function renderHistorial() {
  var cont = document.getElementById('hist-contenido');
  if (state.registros.length === 0) {
    cont.innerHTML = '<div class="empty-state">' +
      '<div class="empty-icon">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
      '</div>' +
      '<div class="empty-title">Sin registros</div>' +
      '<div class="empty-text">Tus jornadas guardadas aparecer\u00e1n aqu\u00ed.</div>' +
    '</div>';
    return;
  }

  // Agrupar por mes
  var grupos = {};
  state.registros.forEach(function(r) {
    var d   = new Date(r.fecha + 'T12:00:00');
    var key = d.getFullYear() + '-' + d.getMonth();
    if (!grupos[key]) grupos[key] = { d: d, items: [] };
    grupos[key].items.push(r);
  });

  cont.innerHTML = Object.values(grupos).map(function(g) {
    var mesNombre = MESES[g.d.getMonth()];
    var anio      = g.d.getFullYear();
    var totalNeto = g.items.reduce(function(s, r) { return s + r.neto; }, 0);

    var svgDel = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    var cards = g.items.map(function(r) {
      var d      = new Date(r.fecha + 'T12:00:00');
      var diaNom = DIAS[d.getDay()].slice(0, 3);
      var diaNum = d.getDate();
      var pills  = r.jamones.map(function(j, i) {
        return '<span class="pill"><span class="pill-idx">#' + (i+1) + '</span> <span class="pill-num">' + j.platos + '</span></span>';
      }).join('');
      return (
        '<div class="hist-card">' +
          '<div class="hist-head">' +
            '<div style="min-width:0;flex:1">' +
              '<div class="hist-fab">' + esc(r.fabrica) + '</div>' +
              '<div class="hist-date">' + diaNom + ' ' + diaNum + ' &middot; ' + r.totalJamones + (r.totalJamones === 1 ? ' jamón' : ' jamones') + ' &middot; ' + r.totalPlatos + ' platos</div>' +
            '</div>' +
            '<div class="hist-amount">' +
              '<button class="hist-del-btn" onclick="delRegistro(\'' + r.id + '\')" aria-label="Eliminar jornada">' + svgDel + '</button>' +
              '<div style="text-align:right">' +
                '<div class="hist-amount-val">' + eur(r.neto) + '</div>' +
                '<div class="hist-amount-lbl">Neto</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="hist-pills">' + pills + '</div>' +
          '<div class="hist-foot">' +
            '<div class="hist-foot-cell">' +
              '<div class="hist-foot-lbl">Bruto</div>' +
              '<div class="hist-foot-val">' + eur(r.bruto) + '</div>' +
            '</div>' +
            '<div class="hist-foot-cell">' +
              '<div class="hist-foot-lbl">IRPF</div>' +
              '<div class="hist-foot-val muted">&minus;' + eur(r.irpf) + '</div>' +
            '</div>' +
            '<div class="hist-foot-cell">' +
              '<div class="hist-foot-lbl">Cobrado</div>' +
              '<div class="hist-foot-val">' + eur(r.cobrado) + '</div>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    return (
      '<div class="hist-group">' +
        '<div class="hist-group-label">' +
          '<span>' + mesNombre + ' ' + anio + '</span>' +
          '<span class="hist-group-meta">' + eur(totalNeto) + ' &middot; ' + g.items.length + ' jornadas</span>' +
        '</div>' +
        cards +
      '</div>'
    );
  }).join('');
}

/* ── RESUMEN MENSUAL ─────────────────────────────────────────── */
function renderResumen() {
  const m = state.mesSel, a = state.anioSel;
  document.getElementById('mes-nombre').textContent = MESES[m];
  document.getElementById('mes-year').textContent   = a;

  const res = calcMes(m, a);
  document.getElementById('m-dias').textContent    = res.dias;
  document.getElementById('m-jamones').textContent = res.jamones;
  document.getElementById('m-platos').textContent  = res.platos;
  document.getElementById('m-bruto').innerHTML     = Math.round(res.bruto).toLocaleString('es-ES') + ' <span class="stat-unit">€</span>';
  document.getElementById('breakdown-meta').textContent = res.dias === 0 ? '—' : res.dias === 1 ? '1 jornada' : res.dias + ' jornadas';

  const netoEl = document.getElementById('m-neto');
  netoEl.textContent = (res.neto < 0 ? '−' : '') + eur(Math.abs(res.neto));
  netoEl.className   = 'hero-value' + (res.neto < 0 ? ' neg' : '');

  document.getElementById('md-bruto').textContent  = eur(res.bruto);
  document.getElementById('md-iva').textContent    = eur(res.iva);
  document.getElementById('md-irpf').textContent   = res.irpf  > 0 ? '−' + eur(res.irpf)  : eur(0);
  document.getElementById('md-gastos').textContent = res.gastos > 0 ? '−' + eur(res.gastos) : eur(0);
  document.getElementById('md-cuota').textContent  = res.cuota  > 0 ? '−' + eur(res.cuota)  : eur(0);
}

function cambiarMes(delta) {
  state.mesSel += delta;
  if (state.mesSel < 0)  { state.mesSel = 11; state.anioSel--; }
  if (state.mesSel > 11) { state.mesSel = 0;  state.anioSel++; }
  guardarEstado();
  renderResumen();
}

/* ── AJUSTES / CONFIG ────────────────────────────────────────── */
function saveCfg() {
  state.cfg.iva   = Math.min(100, Math.max(0, parseFloat(document.getElementById('cfg-iva').value)   || 0));
  state.cfg.irpf  = Math.min(100, Math.max(0, parseFloat(document.getElementById('cfg-irpf').value)  || 0));
  state.cfg.cuota = Math.max(0, parseFloat(document.getElementById('cfg-cuota').value) || 0);
  loadCfg();
  guardarEstado();
  recalc();
  renderResumen();
}

function loadCfg() {
  document.getElementById('cfg-iva').value   = state.cfg.iva;
  document.getElementById('cfg-irpf').value  = state.cfg.irpf;
  document.getElementById('cfg-cuota').value = state.cfg.cuota;
}

function addFabrica() {
  state.fabricas.push({ id: genId(), nombre: '', precio: 0 });
  guardarEstado();
  renderFabCfg();
}

function delFabrica(id) {
  state.fabricas = state.fabricas.filter(f => f.id !== id);
  if (state.selFabId === id) { state.selFabId = null; renderFabSelector(); }
  guardarEstado();
  renderFabCfg();
}

function renderFabCfg() {
  var cont = document.getElementById('fab-list-cfg');
  if (state.fabricas.length === 0) {
    cont.innerHTML = '<div style="padding:20px;text-align:center;color:var(--ink-3);font-size:13px">Sin f\u00e1bricas. A\u00f1ade una.</div>';
    return;
  }
  var svgTrash = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
  cont.innerHTML = state.fabricas.map(function(f, i) {
    return (
      '<div class="fab-edit-row">' +
        '<input class="fab-edit-name" type="text" value="' + esc(f.nombre) + '" placeholder="Nombre de la f\u00e1brica"' +
          ' oninput="state.fabricas[' + i + '].nombre=this.value; guardarEstado(); renderFabSelector();">' +
        '<div class="fab-edit-price">' +
          '<input type="number" value="' + (f.precio || '') + '" min="0" step="0.01" placeholder="0"' +
            ' oninput="state.fabricas[' + i + '].precio=parseFloat(this.value)||0; guardarEstado(); renderFabSelector(); renderJamones(); recalc();">' +
          '<span class="u">\u20ac</span>' +
        '</div>' +
        '<button class="fab-del-btn" onclick="delFabrica(\'' + f.id + '\')" aria-label="Eliminar">' + svgTrash + '</button>' +
      '</div>'
    );
  }).join('');
}

/* ── ELIMINAR REGISTRO ───────────────────────────────────────── */
function delRegistro(id) {
  if (!confirm('¿Eliminar esta jornada? Esta acción no se puede deshacer.')) return;
  state.registros = state.registros.filter(r => r.id !== id);
  guardarEstado();
  renderHistorial();
  toast('Jornada eliminada');
}

/* ── EXPORTAR CSV ────────────────────────────────────────────── */
function exportarCSV() {
  if (state.registros.length === 0) { toast('Sin datos para exportar'); return; }
  const cols = ['Fecha','Fábrica','Precio/plato','Jamones','Platos','Bruto','IVA','IRPF','Cobrado','Gastos','Neto'];
  const rows = state.registros.map(function(r) {
    return [r.fecha, r.fabrica, r.precio, r.totalJamones, r.totalPlatos,
            r.bruto, r.iva, r.irpf, r.cobrado, r.gastos, r.neto].join(';');
  });
  const csv = [cols.join(';')].concat(rows).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'cortador-pro-' + new Date().toISOString().split('T')[0] + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast('CSV exportado');
}

/* ── TOAST ───────────────────────────────────────────────────── */
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  document.getElementById('toast-text').textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2300);
}

/* ── ESCAPE HTML — siempre escapa antes de insertar en el DOM ── */
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── ESC key cierra modal ────────────────────────────────────── */
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });

/* ── ARRANQUE ────────────────────────────────────────────────── */
function init() {
  // Fecha en navbar y eyebrow
  const hoy = new Date();
  const dNom = DIAS[hoy.getDay()];
  const dNum = hoy.getDate();
  const mNom = MESES[hoy.getMonth()];
  document.getElementById('nav-sub').textContent      = dNom + ' ' + dNum + ' · ' + mNom;
  document.getElementById('hoy-eyebrow').textContent  = dNom + ' ' + dNum + ' de ' + mNom.toLowerCase();

  // Aplicar tema guardado
  setTheme(state.theme || 'light');

  // Cargar valores de config en los inputs
  loadCfg();

  // Renderizar pantalla inicial
  renderFabSelector();
  renderJamones();
  recalc();
}

init();