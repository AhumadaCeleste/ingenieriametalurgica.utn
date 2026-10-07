/* Configuración compartida por la web pública y el panel de administración.
   Si algún día cambia la URL del Apps Script, se cambia solo acá. */
window.IM_CONFIG = {
  API: 'https://script.google.com/macros/s/AKfycbwC7i7bjUPyQvuUvZbRqFPWAFP_0PT_ivq_mzjg3cP8B-BR6lirQw3xjQv5hH4p9Rml/exec',
  CIERRE: '2026-11-29',            // Cierre de inscripciones (respaldo si la planilla no responde)
  ADMIN_EMAIL: 'ingenieriametalurgicafrc@gmail.com'
};

/* Llamadas a la planilla: lecturas por GET; todo lo demás por POST (cuerpo JSON en texto plano). */
window.imApi = async function (params, timeoutMs) {
  const cfg = window.IM_CONFIG;
  const isRead = !params || !params.action || params.action === 'count';
  const u = new URL(cfg.API);
  if (isRead) { u.searchParams.set('action', 'count'); u.searchParams.set('_', Date.now()); }
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs || 25000);
  try {
    const opts = { redirect: 'follow', signal: ctrl.signal, cache: 'no-store' };
    if (!isRead) { opts.method = 'POST'; opts.headers = { 'Content-Type': 'text/plain;charset=utf-8' }; opts.body = JSON.stringify(params); }
    const r = await fetch(u.toString(), opts);
    const txt = await r.text();
    try { return JSON.parse(txt); } catch (e) { throw new Error('Respuesta inválida del servidor'); }
  } finally { clearTimeout(to); }
};
