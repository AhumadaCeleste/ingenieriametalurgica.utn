/* Panel de aspirantes · Ingeniería Metalúrgica UTN FRC */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ss = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- Modelo ---------- */
  const ESTADOS = ['Consultante', 'Ingresante', 'Estudiante', 'Baja'];
  const SITUACIONES = ['Nuevo · sin contactar', 'Contactado', 'Haciendo el cursillo', 'Responde pero no viene a clases',
    'No responde mensajes', 'Sin comunicación', 'Abandonó', 'Cambio de especialidad', 'Inscripto al cursado'];
  const REQS = [
    { g: 'Contacto', k: 'Req: Datos validados', t: 'Datos validados', req: true },
    { g: 'Contacto', k: 'Req: Agendado / WhatsApp', t: 'Agendado / sumado al grupo de WhatsApp' },
    { g: 'Contacto', k: 'Req: Preinscripción SysAcad', t: 'Preinscripto en el sistema de la facultad (SysAcad)', req: true },
    { g: 'Ingreso', k: 'Req: Pre-cursillo', t: 'Asiste al pre-cursillo de Metalúrgica' },
    { g: 'Ingreso', k: 'Req: Matemática', t: 'Matemática aprobada', nota: 'Nota Matemática', mod: true },
    { g: 'Ingreso', k: 'Req: Física', t: 'Física aprobada', nota: 'Nota Física', mod: true },
    { g: 'Ingreso', k: 'Req: Intro Vida Univ.', t: 'Introducción a la Vida Universitaria aprobada', nota: 'Nota Intro Vida Univ.', mod: true },
    { g: 'Ingreso', k: 'Req: Equivalencia', t: 'Ingreso aprobado por equivalencia', alt: true },
    { g: 'Para ser estudiante', k: 'Req: Documentación', t: 'Documentación entregada', req: true },
    { g: 'Para ser estudiante', k: 'Req: Requisitos académicos', t: 'Requisitos académicos (título secundario)', req: true },
    { g: 'Para ser estudiante', k: 'Req: Inscripción Guaraní', t: 'Inscripto al cursado en Guaraní', req: true }
  ];
  const DATOS = ['Apellidos', 'Nombres', 'Email', 'Teléfono', 'DNI', 'CUIL', 'Fecha de nacimiento', 'Estado civil', 'Nacionalidad', 'País',
    'Dirección', 'Barrio', 'Localidad', 'Provincia', 'Código postal', 'Colegio', 'Secundario técnico', 'Egreso', 'Cómo nos conoció', 'Consulta'];
  const ACCIONES = [['WhatsApp', '#1DA851'], ['Llamada', 'var(--violet)'], ['Email', 'var(--pink)'], ['Reunión / visita', 'var(--amber)'], ['Nota', 'var(--cyan)']];
  const ACC_COLOR = Object.fromEntries(ACCIONES.concat([['Cambio de estado', 'var(--green)'], ['Formulario web', 'var(--navy)']]));

  const on = v => v === true || /^(✓|si|sí|x|ok|true|1)$/i.test(String(v == null ? '' : v).trim());
  const d10 = v => String(v || '').slice(0, 10);
  const hoy = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const fmt = v => { const s = d10(v); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const [y, m, d] = s.split('-'); return `${d}/${m}/${y.slice(2)}`; };
  const nombre = r => `${r['Apellidos'] || ''}, ${r['Nombres'] || ''}`.replace(/^, |, $/, '');
  const telLimpio = t => String(t || '').replace(/\D/g, '');
  function wa(t) {
    let n = telLimpio(t).replace(/^0/, '');
    if (!n) return '';
    if (n.startsWith('54')) return n;
    n = n.replace(/^(\d{2,4})15/, '$1');
    return '549' + n;
  }
  function cursillo(r) { return on(r['Req: Equivalencia']) || (on(r['Req: Matemática']) && on(r['Req: Física']) && on(r['Req: Intro Vida Univ.'])); }
  function faltantes(r) {
    const f = [];
    if (!on(r['Req: Datos validados'])) f.push('datos validados');
    if (!on(r['Req: Preinscripción SysAcad'])) f.push('preinscripción en SysAcad');
    if (!cursillo(r)) f.push('cursillo aprobado (3 módulos o equivalencia)');
    if (!on(r['Req: Documentación'])) f.push('documentación');
    if (!on(r['Req: Requisitos académicos'])) f.push('requisitos académicos');
    if (!on(r['Req: Inscripción Guaraní'])) f.push('inscripción en Guaraní');
    return f;
  }
  const progreso = r => 6 - faltantes(r).length;

  /* ---------- Estado ---------- */
  let CRED = ss.get('im_admin');
  let FILAS = [], LOG = [], CIERRE = window.IM_CONFIG.CIERRE;
  let filtroEstado = '', orden = { k: 'Fecha', dir: -1 };
  let actual = null, draft = {}, accion = 'WhatsApp';

  function toast(m, ms) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms || 2600); }

  async function call(params) {
    const d = await imApi(Object.assign({}, params, { email: CRED && CRED.email, clave: CRED && CRED.clave }));
    if (d && d.auth === false) { logout(d.error); throw new Error(d.error); }
    if (!d || !d.ok) throw new Error((d && d.error) || 'Error');
    return d;
  }
  function apply(d) {
    FILAS = d.filas || []; LOG = d.log || []; if (d.cierre) CIERRE = d.cierre;
    $('#sync').textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    render();
    if (actual) { const r = FILAS.find(x => x.ID === actual); if (r) fillDrawer(r, true); }
  }

  /* ---------- Login ---------- */
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#lEmail').value.trim(), clave = $('#lClave').value;
    $('#lErr').textContent = ''; $('#lBtn').disabled = true; $('#lBtn').textContent = 'Ingresando…';
    try {
      CRED = { email, clave };
      const d = await imApi({ action: 'list', email, clave });
      if (!d.ok) throw new Error(d.error || 'No se pudo ingresar');
      ss.set('im_admin', CRED); enter(d);
    } catch (err) {
      CRED = null; $('#lErr').textContent = /incorrect|intentos/i.test(err.message) ? err.message : 'No se pudo conectar con la planilla. Probá de nuevo.';
    } finally { $('#lBtn').disabled = false; $('#lBtn').textContent = 'Ingresar'; }
  });
  function enter(d) { $('#login').hidden = true; $('#app').hidden = false; apply(d); }
  function logout(msg) {
    CRED = null; ss.set('im_admin', null); closeDrawer();
    $('#app').hidden = true; $('#login').hidden = false; $('#lClave').value = '';
    if (msg) $('#lErr').textContent = msg;
  }
  $('#bOut').onclick = () => logout();
  $('#bRefresh').onclick = () => refresh(true);
  async function refresh(loud) {
    try { apply(await call({ action: 'list' })); if (loud) toast('Datos actualizados'); }
    catch (e) { if (loud) toast('No se pudo actualizar: ' + e.message); }
  }

  /* ---------- Tablero ---------- */
  function render() { renderKpis(); renderFunnel(); renderOrigen(); renderAgenda(); renderChips(); renderTable(); }

  function vencido(r) { const p = d10(r['Próximo contacto']); return p && p <= hoy() && !['Estudiante', 'Baja'].includes(r['Estado']); }

  function renderKpis() {
    const n = e => FILAS.filter(r => r['Estado'] === e).length;
    const sem = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const [y, m, d] = CIERRE.split('-').map(Number);
    const dias = Math.ceil((new Date(y, m - 1, d, 23, 59) - new Date()) / 86400000);
    const k = [
      ['Registros', FILAS.length, 'var(--navy)', '', `${FILAS.filter(r => r['Tipo'] === 'Preinscripción').length} preinscripciones`],
      ['Consultantes', n('Consultante'), 'var(--cyan)', 'Consultante'],
      ['Ingresantes', n('Ingresante'), 'var(--amber)', 'Ingresante'],
      ['Estudiantes', n('Estudiante'), 'var(--green)', 'Estudiante'],
      ['Bajas', n('Baja'), 'var(--muted)', 'Baja'],
      ['Sin contactar', FILAS.filter(r => /^nuevo/i.test(r['Situación'] || '') && r['Estado'] === 'Consultante').length, 'var(--pink)', '', 'Esperan respuesta'],
      ['Seguimiento vencido', FILAS.filter(vencido).length, 'var(--pink)', '', 'Hoy o antes'],
      ['Últimos 7 días', FILAS.filter(r => d10(r['Fecha']) >= sem).length, 'var(--violet)', '', 'Nuevos registros'],
      ['Cierre inscripción', dias > 0 ? dias : 0, 'var(--amber)', '', dias > 0 ? 'días restantes · ' + fmt(CIERRE) : 'Cerrada']
    ];
    $('#kpis').innerHTML = k.map(([t, v, c, f, s]) => `<div class="kpi ${f ? 'click' : ''}" data-f="${f}" style="--c:${c}"><span>${t}</span><b>${v}</b>${s ? `<small>${esc(s)}</small>` : ''}</div>`).join('');
    $$('.kpi.click').forEach(el => el.onclick = () => { filtroEstado = el.dataset.f; renderChips(); renderTable(); $('.list').scrollIntoView({ behavior: 'smooth' }); });
  }

  function bars(rows, max) {
    return `<div class="bars">${rows.map(([l, v, c, extra]) => `<div><div class="bar-l"><span>${esc(l)}</span><b>${v}</b></div>
      <div class="bar-t"><div style="width:${max ? Math.round(v / max * 100) : 0}%;--c:${c}"></div></div>${extra ? `<p class="conv">${extra}</p>` : ''}</div>`).join('')}</div>`;
  }
  function renderFunnel() {
    const activos = FILAS.length;
    const ing = FILAS.filter(r => ['Ingresante', 'Estudiante'].includes(r['Estado'])).length;
    const est = FILAS.filter(r => r['Estado'] === 'Estudiante').length;
    const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
    $('#funnel').innerHTML = bars([
      ['Consultas y preinscripciones', activos, 'var(--cyan)'],
      ['Llegaron a ingresantes', ing, 'var(--amber)', `${pct(ing, activos)} del total`],
      ['Llegaron a estudiantes', est, 'var(--green)', `${pct(est, ing)} de los ingresantes`],
      ['Bajas', FILAS.filter(r => r['Estado'] === 'Baja').length, 'var(--muted)']
    ], Math.max(activos, 1));
  }
  function renderOrigen() {
    const c = {};
    FILAS.forEach(r => { const k = r['Cómo nos conoció'] || 'Sin dato'; c[k] = (c[k] || 0) + 1; });
    const rows = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 7);
    const cols = ['var(--pink)', 'var(--amber)', 'var(--cyan)', 'var(--violet)', 'var(--navy)', 'var(--green)', 'var(--muted)'];
    $('#origen').innerHTML = rows.length ? bars(rows.map(([k, v], i) => [k, v, cols[i % cols.length]]), Math.max(...rows.map(r => r[1]))) : '<p class="none">Todavía no hay datos.</p>';
  }
  function renderAgenda() {
    const h = hoy();
    const list = FILAS.filter(r => d10(r['Próximo contacto']) && !['Estudiante', 'Baja'].includes(r['Estado']))
      .sort((a, b) => d10(a['Próximo contacto']).localeCompare(d10(b['Próximo contacto']))).slice(0, 15);
    const nuevos = FILAS.filter(r => /^nuevo/i.test(r['Situación'] || '') && r['Estado'] === 'Consultante' && !d10(r['Próximo contacto'])).slice(0, 8);
    let html = list.map(r => {
      const p = d10(r['Próximo contacto']); const cls = p < h ? 'late' : p === h ? 'today' : '';
      return `<button class="ag" data-id="${esc(r.ID)}"><span class="d ${cls}">${p < h ? 'Vencido' : p === h ? 'Hoy' : fmt(p)}</span><div><b>${esc(nombre(r))}</b><small>${esc(r['Situación'] || r['Estado'])}</small></div></button>`;
    }).join('');
    html += nuevos.map(r => `<button class="ag" data-id="${esc(r.ID)}"><span class="d late">Nuevo</span><div><b>${esc(nombre(r))}</b><small>Ingresó ${fmt(r['Fecha'])} · sin contactar</small></div></button>`).join('');
    $('#agenda').innerHTML = html || '<p class="none">No hay seguimientos pendientes. 🎉</p>';
    $$('#agenda .ag').forEach(b => b.onclick = () => openDrawer(b.dataset.id));
  }
  function renderChips() {
    const c = e => e ? FILAS.filter(r => r['Estado'] === e).length : FILAS.length;
    $('#chips').innerHTML = [['', 'Todos']].concat(ESTADOS.map(e => [e, e + 's'])).map(([e, t]) =>
      `<button class="chip ${filtroEstado === e ? 'on' : ''}" data-e="${e}">${t}<b>${c(e)}</b></button>`).join('');
    $$('#chips .chip').forEach(b => b.onclick = () => { filtroEstado = b.dataset.e; renderChips(); renderTable(); });
  }
  function filtradas() {
    const q = $('#q').value.trim().toLowerCase(), tipo = $('#fTipo').value, sit = $('#fSit').value, pend = $('#fPend').checked;
    return FILAS.filter(r => (!filtroEstado || r['Estado'] === filtroEstado) && (!tipo || r['Tipo'] === tipo) && (!sit || r['Situación'] === sit) && (!pend || vencido(r)) &&
      (!q || ['Apellidos', 'Nombres', 'DNI', 'Email', 'Teléfono', 'Colegio', 'Localidad', 'ID', 'Legajo'].some(k => String(r[k] || '').toLowerCase().includes(q))))
      .sort((a, b) => String(a[orden.k] || '').localeCompare(String(b[orden.k] || ''), 'es', { numeric: true }) * orden.dir);
  }
  function renderTable() {
    const sits = Array.from(new Set(SITUACIONES.concat(FILAS.map(r => r['Situación']).filter(Boolean))));
    const sel = $('#fSit'), cur = sel.value;
    sel.innerHTML = '<option value="">Todas las situaciones</option>' + sits.map(s => `<option ${s === cur ? 'selected' : ''}>${esc(s)}</option>`).join('');
    const rows = filtradas(), h = hoy();
    $('#empty').hidden = rows.length > 0;
    $('#tbody').innerHTML = rows.map(r => {
      const p = progreso(r), prox = d10(r['Próximo contacto']);
      const w = wa(r['Teléfono']);
      return `<tr data-id="${esc(r.ID)}">
        <td><div class="p-name">${esc(nombre(r))}</div><div class="p-sub">${r['DNI'] ? 'DNI ' + esc(r['DNI']) + ' · ' : ''}${esc(r['Localidad'] || '')}</div><span class="tipo">${esc(r['Tipo'])}</span></td>
        <td>${w ? `<a class="ic" href="https://wa.me/${w}" target="_blank" rel="noopener" title="WhatsApp">💬</a>` : ''}${r['Email'] ? `<a class="ic" href="mailto:${esc(r['Email'])}" title="Email">✉</a>` : ''}<div class="p-sub">${esc(r['Teléfono'] || '')}</div></td>
        <td><span class="badge b-${esc(r['Estado'])}">${esc(r['Estado'])}</span></td>
        <td>${esc(r['Situación'] || '')}</td>
        <td><div class="mini"><div class="bar-t"><div style="width:${p / 6 * 100}%;--c:${p === 6 ? 'var(--green)' : 'var(--amber)'}"></div></div><span>${p}/6</span></div></td>
        <td class="${prox && prox < h ? 'late-t' : prox === h ? 'today-t' : ''}">${prox ? (prox < h ? '⚠ ' : '') + fmt(prox) : '—'}</td>
        <td>${fmt(r['Fecha'])}</td></tr>`;
    }).join('');
    $$('#tbody tr').forEach(tr => tr.addEventListener('click', e => { if (!e.target.closest('a')) openDrawer(tr.dataset.id); }));
  }
  ['#q', '#fTipo', '#fSit', '#fPend'].forEach(s => $(s).addEventListener('input', renderTable));
  $$('th[data-sort]').forEach(th => th.onclick = () => { const k = th.dataset.sort; orden = { k, dir: orden.k === k ? -orden.dir : 1 }; renderTable(); });

  /* ---------- Exportar ---------- */
  $('#bCsv').onclick = () => {
    const rows = filtradas(); if (!rows.length) return toast('No hay filas para exportar');
    const cols = Object.keys(rows[0]);
    const cell = v => { const s = String(v == null ? '' : v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const csv = '﻿' + [cols.join(';')].concat(rows.map(r => cols.map(c => cell(r[c])).join(';'))).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `aspirantes-metalurgica-${hoy()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  /* ---------- Ficha ---------- */
  function openDrawer(id) {
    const r = FILAS.find(x => x.ID === id); if (!r) return;
    actual = id; draft = {};
    fillDrawer(r);
    $('#scrim').hidden = false; $('#drawer').classList.add('on'); $('#drawer').setAttribute('aria-hidden', 'false');
  }
  function closeDrawer() {
    if (Object.keys(draft).length && !confirm('Tenés cambios sin guardar. ¿Cerrar igual?')) return;
    actual = null; draft = {};
    $('#scrim').hidden = true; $('#drawer').classList.remove('on'); $('#drawer').setAttribute('aria-hidden', 'true');
  }
  $('#dClose').onclick = closeDrawer; $('#scrim').onclick = closeDrawer;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && actual) closeDrawer(); });

  const V = k => (k in draft ? draft[k] : (FILAS.find(x => x.ID === actual) || {})[k]);
  function setDraft(k, v) {
    const orig = (FILAS.find(x => x.ID === actual) || {})[k];
    if (String(v ?? '') === String(orig ?? '')) delete draft[k]; else draft[k] = v;
    $('#dDirty').textContent = Object.keys(draft).length ? '● Cambios sin guardar' : '';
  }

  function fillDrawer(r, keepDraft) {
    if (!keepDraft) draft = {};
    $('#dId').textContent = r.ID + ' · ' + (r['Tipo'] || '');
    $('#dName').textContent = nombre(r);
    $('#dMeta').textContent = `Ingresó ${fmt(r['Fecha'])}${r['Colegio'] ? ' · ' + r['Colegio'] : ''}${r['Localidad'] ? ' · ' + r['Localidad'] : ''}`;
    const w = wa(r['Teléfono']);
    $('#dQuick').innerHTML = (w ? `<a class="q-wa" href="https://wa.me/${w}?text=${encodeURIComponent('¡Hola ' + (r['Nombres'] || '') + '! Te escribimos de Ingeniería Metalúrgica UTN FRC 👋')}" target="_blank" rel="noopener">💬 WhatsApp</a>` : '') +
      (telLimpio(r['Teléfono']) ? `<a class="q-tel" href="tel:${telLimpio(r['Teléfono'])}">☎ Llamar</a>` : '') +
      (r['Email'] ? `<a class="q-mail" href="mailto:${esc(r['Email'])}?subject=${encodeURIComponent('Ingeniería Metalúrgica UTN FRC')}">✉ Email</a>` : '');
    renderPipe();
    $('#dSit').innerHTML = Array.from(new Set(SITUACIONES.concat(V('Situación') ? [V('Situación')] : []))).map(s => `<option ${s === V('Situación') ? 'selected' : ''}>${esc(s)}</option>`).join('');
    renderReqs();
    $('#dLegajo').value = V('Legajo') || '';
    $('#dProx').value = d10(V('Próximo contacto'));
    $('#dObs').value = V('Observaciones') || '';
    $('#dDirty').textContent = Object.keys(draft).length ? '● Cambios sin guardar' : '';
    $('#dActs').innerHTML = ACCIONES.map(([a]) => `<button class="${a === accion ? 'on' : ''}" data-a="${a}">${a}</button>`).join('');
    $$('#dActs button').forEach(b => b.onclick = () => { accion = b.dataset.a; $$('#dActs button').forEach(x => x.classList.toggle('on', x === b)); });
    const logs = LOG.filter(l => l.ID === r.ID).sort((a, b) => String(b['Fecha']).localeCompare(String(a['Fecha'])));
    $('#dLog').innerHTML = logs.length ? logs.map(l => `<li style="--c:${ACC_COLOR[l['Acción']] || 'var(--cyan)'}"><b>${esc(l['Acción'])}</b><small>${fmt(l['Fecha'])} ${String(l['Fecha']).slice(11, 16)}${l['Próximo contacto'] ? ' · próximo: ' + fmt(l['Próximo contacto']) : ''}</small>${l['Detalle'] ? `<p>${esc(l['Detalle'])}</p>` : ''}</li>`).join('')
      : '<li><p>Todavía no hay seguimientos registrados.</p></li>';
    $('#dData').innerHTML = DATOS.map(k => k === 'Consulta'
      ? `<label style="grid-column:1/-1">${k}<textarea data-k="${k}" rows="3">${esc(V(k) || '')}</textarea></label>`
      : `<label>${k}<input data-k="${k}" value="${esc(k === 'Fecha de nacimiento' ? d10(V(k)) : V(k) || '')}"></label>`).join('');
  }

  function renderPipe() {
    const r = Object.assign({}, FILAS.find(x => x.ID === actual), draft);
    const falt = faltantes(r);
    $('#dPipe').innerHTML = ESTADOS.map(e => `<button data-e="${e}" class="${V('Estado') === e ? 'on' : ''} ${e === 'Estudiante' && falt.length ? 'lock' : ''}">${e}</button>`).join('');
    $('#dPipeHint').innerHTML = V('Estado') === 'Estudiante' ? '✓ Registrado/a como estudiante.'
      : falt.length ? `Para pasar a <b>Estudiante</b> falta: ${esc(falt.join(', '))}.` : '✓ Cumple todos los requisitos: ya puede pasar a <b>Estudiante</b>.';
    $$('#dPipe button').forEach(b => b.onclick = () => {
      const e = b.dataset.e; if (e === V('Estado')) return;
      if (e === 'Estudiante' && falt.length && !confirm('Todavía falta: ' + falt.join(', ') + '.\n\n¿Marcar como estudiante igual?')) return;
      setDraft('Estado', e);
      if (e === 'Estudiante') { setDraft('Situación', 'Inscripto al cursado'); }
      if (e === 'Baja' && !/abandon|sin comunic|cambio|no responde/i.test(V('Situación') || '')) setDraft('Situación', 'Abandonó');
      save();
    });
  }
  function renderReqs() {
    const r = Object.assign({}, FILAS.find(x => x.ID === actual), draft);
    const p = progreso(r);
    $('#dReqCount').textContent = `${p} de 6 obligatorios`;
    $('#dReqBar').style.width = (p / 6 * 100) + '%';
    const groups = Array.from(new Set(REQS.map(q => q.g)));
    $('#dReqs').innerHTML = groups.map(g => `<div class="rgroup"><p>${g}</p>${REQS.filter(q => q.g === g).map(q => {
      const ok = on(V(q.k));
      return `<label class="req ${ok ? 'ok' : ''}"><input type="checkbox" data-k="${q.k}" ${ok ? 'checked' : ''}><span>${q.t}</span>${
        q.nota ? `<input class="nota" data-n="${q.nota}" value="${esc(V(q.nota) || '')}" placeholder="Nota" inputmode="decimal">` : q.alt ? '<span class="opt">Reemplaza los 3 módulos</span>' : q.req ? '' : '<span class="opt">Opcional</span>'}</label>`;
    }).join('')}</div>`).join('');
    $$('#dReqs input[type=checkbox]').forEach(c => c.onchange = () => { setDraft(c.dataset.k, c.checked ? '✓' : ''); renderReqs(); renderPipe(); });
    $$('#dReqs .nota').forEach(n => {
      n.onclick = e => e.preventDefault();
      n.oninput = () => setDraft(n.dataset.n, n.value.trim());
    });
  }
  $('#dSit').onchange = e => setDraft('Situación', e.target.value);
  $('#dLegajo').oninput = e => setDraft('Legajo', e.target.value.trim());
  $('#dProx').oninput = e => setDraft('Próximo contacto', e.target.value);
  $('#dObs').oninput = e => setDraft('Observaciones', e.target.value);
  $('#dData').addEventListener('input', e => { const k = e.target.dataset.k; if (k) setDraft(k, e.target.value); });

  async function save() {
    if (!Object.keys(draft).length) { toast('No hay cambios para guardar'); return; }
    const btns = ['#dSave', '#dSaveData']; btns.forEach(b => $(b).disabled = true);
    try {
      const cambios = Object.assign({}, draft);
      const d = await call({ action: 'update', id: actual, cambios });
      draft = {}; apply(d); toast('✓ Cambios guardados');
    } catch (e) { toast('No se pudo guardar: ' + e.message, 4000); }
    finally { btns.forEach(b => $(b).disabled = false); }
  }
  $('#dSave').onclick = save; $('#dSaveData').onclick = save;

  $('#lSave').onclick = async () => {
    const det = $('#lDet').value.trim(), prox = $('#lProx').value;
    if (!det && !prox) return toast('Escribí qué pasó o elegí un próximo contacto');
    $('#lSave').disabled = true;
    try {
      const params = { action: 'log', id: actual, accion, detalle: det, proximo: prox };
      if (/^nuevo/i.test(V('Situación') || '')) params.situacion = 'Contactado';
      if (!prox && d10(V('Próximo contacto')) && d10(V('Próximo contacto')) <= hoy()) params.limpiarProximo = true;
      const pend = Object.assign({}, draft);
      const d = await call(params);
      $('#lDet').value = ''; $('#lProx').value = '';
      draft = pend; apply(d); toast('✓ Seguimiento registrado');
    } catch (e) { toast('No se pudo registrar: ' + e.message, 4000); }
    finally { $('#lSave').disabled = false; }
  };

  /* ---------- Inicio ---------- */
  setInterval(() => { if (CRED && !document.hidden && !Object.keys(draft).length) refresh(false); }, 90000);
  if (CRED) {
    $('#login').hidden = true;
    call({ action: 'list' }).then(enter).catch(() => { $('#login').hidden = false; });
  }
  $('#lEmail').value = (CRED && CRED.email) || '';
})();
