/* Ingeniería Metalúrgica · UTN FRC — interacción de la web pública */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CFG = window.IM_CONFIG;

  /* ---------- Navegación ---------- */
  const nav = $('#nav'), fab = $('#fab');
  const onScroll = () => {
    nav.classList.toggle('solid', window.scrollY > 30);
    const form = $('#preinscripcion').getBoundingClientRect();
    fab.classList.toggle('on', window.scrollY > 700 && (form.top > window.innerHeight || form.bottom < 0));
  };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  $('#burger').addEventListener('click', e => {
    const open = $('#links').classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', open);
  });
  $$('#links a').forEach(a => a.addEventListener('click', () => { $('#links').classList.remove('open'); $('#burger').setAttribute('aria-expanded', 'false'); }));

  // Sección activa en el menú
  const secObs = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) $$('#links a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + en.target.id)); });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach(s => secObs.observe(s));

  /* ---------- Animaciones de entrada ---------- */
  const rev = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); rev.unobserve(en.target); } });
  }, { threshold: 0.12 });
  $$('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 4) * 70 + 'ms'; rev.observe(el); });

  /* ---------- Contador y cuenta regresiva ---------- */
  let PRE = null;
  function countTo(el, to) {
    if (!el) return;
    const from = parseInt(el.textContent, 10) || 0, t0 = performance.now(), d = 1200;
    const step = t => { const k = Math.min(1, (t - t0) / d); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function setCount(n) {
    PRE = n; ['#contador', '#contador2', '#contador3'].forEach(s => countTo($(s), n));
    const lbl = $('#contador') && $('#contador').nextElementSibling;
    if (lbl) lbl.textContent = n === 0 ? '¡Sé de los primeros en preinscribirte!' : n === 1 ? 'persona ya se preinscribió' : 'personas ya se preinscribieron';
  }
  function setCierre(iso) {
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const [y, m, d] = iso.split('-').map(Number);
    const fin = new Date(y, m - 1, d, 23, 59, 59);
    const dias = Math.ceil((fin - new Date()) / 86400000);
    const txt = d + ' de ' + meses[m - 1];
    $('#cierreTxt').textContent = txt; $$('.cierre-inline').forEach(e => e.textContent = txt);
    if (dias > 0) { countTo($('#dias'), dias); $('#diasTxt').textContent = (dias === 1 ? 'día' : 'días') + ' para el cierre de inscripciones (' + txt + ')'; }
    else { $('#dias').textContent = '✓'; $('#diasTxt').textContent = 'Inscripciones cerradas. Dejanos tu consulta para el próximo ciclo.'; }
  }
  setCierre(CFG.CIERRE);
  imApi({ action: 'count' }, 15000).then(d => {
    if (d && d.ok) { setCount(d.preinscriptos || 0); if (d.cierre) setCierre(d.cierre); }
  }).catch(() => { ['#contador', '#contador2'].forEach(s => $(s).textContent = '+'); });

  /* ---------- Trivia ---------- */
  const TRIVIA = [
    { q: '“Estudiar Ingeniería Metalúrgica es trabajar con fierros en un taller.”', ops: ['Realidad', 'Mito', 'Un poco de las dos'], ok: 1,
      t: '¡Mito!', p: 'El taller es solo una parte. Se estudia cómo están hechos los materiales por dentro y cómo procesarlos: también es laboratorio, microscopía, simulación y calidad.' },
    { q: '¿Qué materiales estudia un ingeniero o ingeniera metalúrgica?', ops: ['Solo hierro y acero', 'Metales en general', 'Metales ferrosos y no ferrosos, cerámicos, polímeros y compuestos'], ok: 2,
      t: 'Los metales son el centro… pero no el límite', p: 'La base es la ciencia de los materiales: aceros, aluminio, titanio y cobre, pero también cerámicos, plásticos reforzados y fibras de carbono.' },
    { q: 'Si calentás un acero a alta temperatura y lo enfriás de golpe en agua, ¿qué le pasa?', ops: ['Se ablanda', 'Se endurece', 'No cambia nada', 'Se derrite'], ok: 1,
      t: 'Se endurece (se llama temple)', p: 'Cambia su estructura interna. El mismo material puede tener propiedades muy distintas según cómo se procese: eso es tratamiento térmico.' },
    { q: '“Se pueden fabricar piezas de metal con una impresora 3D.”', ops: ['Mito: solo se imprime plástico', 'Realidad', 'Solo en las películas'], ok: 1,
      t: '¡Realidad!', p: 'Se llama fabricación aditiva: un láser funde polvo metálico capa por capa. Se usa en aviones, implantes a medida y moldes.' },
    { q: 'De todo el aluminio producido en la historia, ¿cuánto sigue en uso hoy?', ops: ['Alrededor del 5%', 'Alrededor del 25%', 'Alrededor del 75%'], ok: 2,
      t: '¡Cerca del 75%!', p: 'El aluminio se recicla una y otra vez sin perder calidad, con una fracción de la energía que lleva producirlo. Economía circular pura.' }
  ];
  const COL = ['var(--pink)', 'var(--amber)', 'var(--cyan)', 'var(--violet)'];
  let qi = 0, aciertos = 0, res = [];
  function renderQuiz() {
    $('#qDots').innerHTML = TRIVIA.map((_, i) => `<i class="${res[i] === true ? 'ok' : res[i] === false ? 'no' : i === qi ? 'cur' : ''}"></i>`).join('');
    if (qi >= TRIVIA.length) {
      $('#qN').textContent = '¡Terminaste!';
      const msg = aciertos >= 4 ? ['¡Tenés madera de metalúrgico/a!', 'Ya pensás como ingeniero/a de materiales. El próximo paso es tuyo.']
        : aciertos >= 2 ? ['¡Vas muy bien!', 'Tenés curiosidad, que es lo más importante. En la carrera vas a descubrir todo lo demás.']
        : ['¡Ahora ya sabés más!', 'Metalúrgica es mucho más que fierros. ¿Te animás a conocerla de cerca?'];
      $('#qBody').innerHTML = `<div class="qend"><div class="score">${aciertos}/${TRIVIA.length}</div><h3>${msg[0]}</h3><p>${msg[1]}</p>
        <div class="btns"><a class="btn btn-pink" href="#preinscripcion">Preinscribirme</a><button class="btn btn-ghost-dark" id="qAgain">Jugar de nuevo</button></div></div>`;
      $('#qAgain').onclick = () => { qi = 0; aciertos = 0; res = []; renderQuiz(); };
      return;
    }
    const t = TRIVIA[qi];
    $('#qN').textContent = `Pregunta ${qi + 1} de ${TRIVIA.length}`;
    $('#qBody').innerHTML = `<p class="qq">${esc(t.q)}</p><div class="qops">${t.ops.map((o, j) =>
      `<button class="qop" data-j="${j}" style="--c:${COL[j % 4]}"><span class="l">${'ABCD'[j]}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
    $$('.qop', $('#qBody')).forEach(b => b.addEventListener('click', () => answer(+b.dataset.j)));
  }
  function answer(j) {
    const t = TRIVIA[qi], ok = j === t.ok;
    res[qi] = ok; if (ok) aciertos++;
    $$('.qop', $('#qBody')).forEach(b => {
      const k = +b.dataset.j; b.disabled = true;
      b.classList.add(k === t.ok ? 'right' : k === j ? 'wrong' : 'dim');
    });
    $('#qBody').insertAdjacentHTML('beforeend', `<div class="qexp"><b>${ok ? '✓ ' : '✗ '}${esc(t.t)}</b><p>${esc(t.p)}</p></div>
      <div class="qnext"><button class="btn btn-pink" id="qNext">${qi === TRIVIA.length - 1 ? 'Ver resultado' : 'Siguiente ▸'}</button></div>`);
    $('#qDots').children[qi].className = ok ? 'ok' : 'no';
    $('#qNext').onclick = () => { qi++; renderQuiz(); };
  }
  renderQuiz();

  /* ---------- Laboratorios ---------- */
  const ICON = {
    printer: '<svg viewBox="0 0 64 64"><rect x="10" y="8" width="44" height="48" rx="6" fill="none" stroke="currentColor" stroke-width="5"/><path d="M10 20h44M28 20v10h8V20M32 30v6c0 4-8 3-8 8s6 4 10 4M20 50h24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
    flame: '<svg viewBox="0 0 64 64"><path d="M32 6c4 10 16 16 16 32a16 16 0 0 1-32 0c0-8 4-12 8-16 0 6 3 9 6 10-2-10 2-18 2-26z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></svg>',
    micro: '<svg viewBox="0 0 64 64"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><path d="M26 6l10 6-10 18-10-6zM31 21l8 5"/><path d="M14 56h36M22 48h18a12 12 0 0 0 0-24"/></g></svg>',
    control: '<svg viewBox="0 0 64 64"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><path d="M14 10v44M32 10v44M50 10v44"/><circle cx="14" cy="22" r="5" fill="currentColor"/><circle cx="32" cy="40" r="5" fill="currentColor"/><circle cx="50" cy="28" r="5" fill="currentColor"/></g></svg>',
    test: '<svg viewBox="0 0 64 64"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><path d="M8 54C20 54 22 14 32 14s14 30 24 30"/><path d="M8 8v46h48"/></g></svg>'
  };
  const LABS = [
    { t: 'Impresión 3D', p: 'Fabricación aditiva para crear prototipos y piezas con geometrías imposibles por métodos tradicionales.', c: 'var(--amber)', i: 'printer' },
    { t: 'Tratamientos térmicos', p: 'Calentar y enfriar con precisión para cambiar la estructura interna de un metal: más duro, más tenaz, más resistente.', c: 'var(--pink)', i: 'flame', dark: true },
    { t: 'Microscopía y análisis metalográfico', p: 'Mirar el material por dentro: granos, fases y defectos que explican por qué una pieza resiste o falla.', c: 'var(--cyan)', i: 'micro' },
    { t: 'Sistemas de control', p: 'Instrumentación y automatización para medir y controlar procesos industriales.', c: 'var(--violet)', i: 'control' },
    { t: 'Ensayos mecánicos', p: 'Tracción, dureza, impacto: poner a prueba los materiales para saber cuánto aguantan antes de usarlos.', c: 'var(--amber)', i: 'test' }
  ];
  function showLab(i) {
    const l = LABS[i], v = $('#labView');
    $$('.lab').forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-selected', k === i); });
    v.style.setProperty('--lc', l.c); v.classList.toggle('dark', !!l.dark);
    $('#labIcon').innerHTML = ICON[l.i];
    $('#labT').textContent = l.t; $('#labP').textContent = l.p;
    const cap = $('#labCap'); cap.classList.remove('lab-anim'); void cap.offsetWidth; cap.classList.add('lab-anim');
  }
  $$('.lab').forEach(b => b.addEventListener('click', () => showLab(+b.dataset.i)));
  showLab(0);

  // Acordeón de salida laboral: uno abierto a la vez
  $$('#accSalida details').forEach(d => d.addEventListener('toggle', () => {
    if (d.open) $$('#accSalida details').forEach(o => { if (o !== d) o.open = false; });
  }));

  /* ---------- Formulario ---------- */
  const form = $('#form'), card = $('#formCard');
  let mode = 'pre', step = 1;
  const STEP_FIELDS = {
    1: ['nombres', 'apellidos', 'email', 'telefono'],
    2: ['dni', 'cuil', 'nacimiento', 'estadoCivil', 'nacionalidad', 'pais'],
    3: ['direccion', 'barrio', 'localidad', 'provincia', 'cp', 'colegio', 'acepto']
  };
  function setMode(m) {
    mode = m;
    $$('.mode').forEach(b => { b.classList.toggle('on', b.dataset.mode === m); b.setAttribute('aria-selected', b.dataset.mode === m); });
    card.classList.toggle('mode-consulta', m === 'consulta');
    goStep(1);
  }
  function goStep(n) {
    step = n;
    $$('.fstep').forEach(f => f.classList.toggle('on', +f.dataset.step === n));
    $$('.pstep').forEach((p, i) => { p.classList.toggle('on', i + 1 === n); p.classList.toggle('ok', i + 1 < n); });
    $('#bBack').hidden = n === 1;
    const last = mode === 'consulta' || n === 3;
    $('#bNext').textContent = last ? (mode === 'consulta' ? 'Enviar consulta' : 'Enviar preinscripción') : 'Siguiente ▸';
    $('#ferr').textContent = '';
  }
  $$('.mode').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

  const val = n => { const el = form.elements[n]; return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : ''; };
  function fieldError(n) {
    const v = val(n);
    if (n === 'acepto') return v ? '' : 'Necesitamos tu autorización para contactarte.';
    if (!v) return 'Completá los campos marcados con *.';
    if (n === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return 'Revisá el email.';
    if (n === 'telefono' && v.replace(/\D/g, '').length < 8) return 'Revisá el teléfono (con característica).';
    if (n === 'dni' && !/^\d{7,8}$/.test(v.replace(/\D/g, ''))) return 'El DNI debe tener 7 u 8 números.';
    if (n === 'cuil') {
      const c = v.replace(/\D/g, ''), d = val('dni').replace(/\D/g, '');
      if (c.length !== 11) return 'El CUIL debe tener 11 números.';
      if (d && c.slice(2, 10).replace(/^0+/, '') !== d.replace(/^0+/, '')) return 'El CUIL no coincide con el DNI.';
    }
    if (n === 'nacimiento') { const y = +v.slice(0, 4), now = new Date().getFullYear(); if (y < now - 80 || y > now - 14) return 'Revisá la fecha de nacimiento.'; }
    return '';
  }
  function validate(names) {
    let first = '';
    names.forEach(n => {
      const el = form.elements[n]; const e = fieldError(n);
      if (el && el.type !== 'checkbox') el.classList.toggle('invalid', !!e);
      if (e && !first) { first = e; if (el) el.focus({ preventScroll: false }); }
    });
    $('#ferr').textContent = first;
    return !first;
  }
  form.addEventListener('input', e => { if (e.target.classList.contains('invalid') && !fieldError(e.target.name)) e.target.classList.remove('invalid'); });

  $('#bBack').addEventListener('click', () => goStep(step - 1));
  $('#bNext').addEventListener('click', async () => {
    if (mode === 'consulta') {
      if (!validate(STEP_FIELDS[1])) return;
      if (!val('consulta')) { $('#ferr').textContent = 'Escribí tu consulta.'; form.elements.consulta.classList.add('invalid'); return; }
      return send();
    }
    if (!validate(STEP_FIELDS[step])) return;
    if (step < 3) { goStep(step + 1); card.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    send();
  });

  async function send() {
    const b = $('#bNext'); b.disabled = true; const txt = b.textContent; b.textContent = 'Enviando…';
    const datos = {};
    ['nombres', 'apellidos', 'email', 'telefono', 'origen'].forEach(n => datos[n] = val(n));
    if (mode === 'consulta') datos.consulta = val('consulta');
    else {
      ['dni', 'cuil', 'nacimiento', 'estadoCivil', 'nacionalidad', 'pais', 'direccion', 'barrio', 'localidad', 'provincia', 'cp', 'colegio', 'tecnico', 'egreso'].forEach(n => datos[n] = val(n));
      datos.dni = datos.dni.replace(/\D/g, '');
      datos.consulta = val('consultaPre');
    }
    try {
      const d = await imApi({ action: 'submit', tipo: mode === 'consulta' ? 'consulta' : 'pre', datos, website: val('website') });
      if (!d || !d.ok) throw new Error((d && d.error) || 'Error');
      form.hidden = true; $('.modes').hidden = true;
      const done = $('#done'); done.hidden = false;
      if (mode === 'consulta') {
        $('#doneT').textContent = '¡Recibimos tu consulta!';
        $('#doneP').textContent = 'Te respondemos a la brevedad por email o WhatsApp.';
        $('.done-count').hidden = true;
      } else if (d.nuevo === false) {
        $('#doneT').textContent = '¡Ya estabas en nuestra lista!';
        $('#doneP').textContent = 'Actualizamos tus datos. En breve te contactamos.';
      }
      if (typeof d.preinscriptos === 'number') {
        const prev = PRE == null ? Math.max(0, d.preinscriptos - 1) : PRE;
        $('#contador3').textContent = prev; setTimeout(() => setCount(d.preinscriptos), 500);
      }
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      confetti();
    } catch (e) {
      $('#ferr').textContent = 'No pudimos enviar tus datos. Revisá tu conexión y probá de nuevo, o escribinos a ingenieriametalurgicafrc@gmail.com.';
      b.disabled = false; b.textContent = txt;
    }
  }

  function confetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cols = ['#FF2566', '#F5AB12', '#4ED6FF', '#9D8BFF', '#ffffff'];
    for (let i = 0; i < 90; i++) {
      const c = document.createElement('div'); c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw'; c.style.background = cols[i % cols.length];
      c.style.animationDuration = (2.4 + Math.random() * 2.2) + 's'; c.style.animationDelay = (Math.random() * .8) + 's';
      document.body.appendChild(c); setTimeout(() => c.remove(), 5500);
    }
  }
  goStep(1);
})();
