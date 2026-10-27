/* Howserfit — app web instalable. Todo se guarda en el dispositivo (IndexedDB). */
(function () {
  'use strict';
  const D = window.HF_DATA;
  const EX = D.EX;
  const $app = document.getElementById('app');
  const VERSION = '1.1.0';

  /* ---------- utilidades ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const DAY = 86400000;
  const now = () => Date.now();
  function fmt(n) {
    if (n == null || n === '' || isNaN(n)) return '—';
    const r = Math.round(n * 100) / 100;
    return String(r).replace('.', ',');
  }
  function num(v) {
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v || '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }
  function roundTo(x, step) { return Math.max(0, Math.round(x / step) * step); }
  function fmtSecs(s) {
    s = Math.round(s || 0);
    if (s >= 60) { const m = Math.floor(s / 60), r = s % 60; return r ? m + ':' + String(r).padStart(2, '0') + ' min' : m + ' min'; }
    return s + ' s';
  }
  function clock(ms) {
    const t = Math.max(0, Math.round(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function fmtDate(ts, opts) { return new Date(ts).toLocaleDateString('es', opts || { weekday: 'short', day: 'numeric', month: 'short' }); }
  function startOfWeek(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); const wd = (d.getDay() + 6) % 7; return d.getTime() - wd * DAY; }
  const e1rm = (kg, reps) => (kg > 0 && reps > 0 ? kg * (1 + reps / 30) : 0);

  /* ---------- almacenamiento ---------- */
  const DB = (() => {
    let dbp = null;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise((res, rej) => {
        const r = indexedDB.open('howserfit', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      return dbp;
    }
    function tx(mode, fn) {
      return open().then((db) => new Promise((res, rej) => {
        const t = db.transaction('kv', mode), st = t.objectStore('kv'), req = fn(st);
        t.oncomplete = () => res(req && req.result);
        t.onerror = () => rej(t.error);
      }));
    }
    return {
      get: (k) => tx('readonly', (s) => s.get(k)),
      set: (k, v) => tx('readwrite', (s) => s.put(v, k)),
      del: (k) => tx('readwrite', (s) => s.delete(k))
    };
  })();

  function blank() {
    return {
      v: 1, profile: null,
      settings: { rest: 90, sound: true, awake: true, theme: 'auto' },
      plan: null, sessions: [], active: null, bodyweight: [], measures: [], photos: []
    };
  }
  let S = blank();
  let saveT = null;
  function save(now_) {
    clearTimeout(saveT);
    const go = () => DB.set('state', S).catch(() => { try { localStorage.setItem('hf_state', JSON.stringify(S)); } catch (e) { /* sin espacio */ } });
    if (now_) go(); else saveT = setTimeout(go, 200);
  }

  /* ---------- estado de interfaz (no se guarda) ---------- */
  const UI = {
    mod: 'g', group: 'Todos', q: '', progTab: 'cuerpo', planGoal: 'Todos', dayPick: null,
    onb: 0, onbData: { name: '', sex: 'Hombre', age: '', height: '', weight: '' },
    wiz: { step: 0, r: {}, lim: ['Ninguna'] }, wizPlan: null,
    med: null, sheet: null, summary: null, selSet: null, heroTab: 0, alarmFired: false
  };

  /* ---------- historial y progresión ---------- */
  function perfs(exId, n) {
    const out = [];
    for (let i = S.sessions.length - 1; i >= 0 && out.length < (n || 99); i--) {
      const s = S.sessions[i];
      const e = s.exs.find((x) => x.ex === exId);
      if (e) { const sets = e.sets.filter((d) => d.done); if (sets.length) out.push({ date: s.start, sets, sid: s.id }); }
    }
    return out;
  }
  function bestOf(exId) {
    let best = null;
    perfs(exId).forEach((p) => p.sets.forEach((st) => { const v = e1rm(st.kg, st.reps); if (!best || v > best.e) best = { e: v, kg: st.kg, reps: st.reps }; }));
    return best;
  }

  function suggest(exId, item) {
    const ex = EX[exId] || { type: 'w', inc: 2.5 };
    const rmin = item ? item.rmin : (ex.type === 't' ? 30 : 8);
    const rmax = item ? item.rmax : (ex.type === 't' ? 60 : 12);
    const n = item ? item.sets : 3;
    const pp = perfs(exId, 2);
    const fill = (kg, reps) => Array.from({ length: n }, (_, i) => ({ kg, reps: Array.isArray(reps) ? reps[i] != null ? reps[i] : reps[reps.length - 1] : reps, done: false, prev: pp[0] && pp[0].sets[i] ? { kg: pp[0].sets[i].kg, reps: pp[0].sets[i].reps } : null }));
    if (!pp.length) {
      const txt = ex.type === 'w' ? 'Primera vez: elige un peso con el que llegues a ' + rmax + ' repeticiones con buena técnica.' : ex.type === 't' ? 'Primera vez: aguanta ' + fmtSecs(rmin) + ' con buena forma.' : 'Primera vez: haz ' + rmin + '–' + rmax + ' repeticiones limpias.';
      return { sets: fill(ex.type === 'w' ? 0 : 0, ex.type === 't' ? rmin : rmax), badge: { t: 'Nuevo', c: '' }, text: txt };
    }
    const last = pp[0];
    const days = Math.floor((now() - last.date) / DAY);
    const top = Math.max.apply(null, last.sets.map((s) => s.kg || 0));
    const reps = last.sets.map((s) => s.reps || 0);
    const allTop = last.sets.length >= n && reps.every((r) => r >= rmax);
    const below = reps.some((r) => r < rmin);
    const inc = ex.inc || 2.5;
    if (ex.type === 't') {
      const best = Math.max.apply(null, reps);
      if (days > 21) return { sets: fill(0, Math.max(rmin, Math.round(best * 0.8))), badge: { t: 'Retoma suave', c: 'warn' }, text: days + ' días sin hacerlo: empieza con el 80% del tiempo.' };
      const tgt = allTop ? best + inc : Math.min(rmax, best + inc);
      return { sets: fill(0, tgt), badge: { t: '+' + fmtSecs(inc), c: 'up' }, text: 'Suma ' + fmtSecs(inc) + ' a tu mejor marca (' + fmtSecs(best) + ').' };
    }
    if (days > 28 && top > 0) {
      const kg = roundTo(top * 0.8, inc);
      return { sets: fill(kg, rmax), badge: { t: 'Retoma 80%', c: 'warn' }, text: days + ' días sin entrenarlo: vuelve con ' + fmt(kg) + ' kg (80%) y subiremos en 2–3 semanas.' };
    }
    if (days > 14 && top > 0) {
      const kg = roundTo(top * 0.9, inc);
      return { sets: fill(kg, rmax), badge: { t: 'Retoma 90%', c: 'warn' }, text: days + ' días sin entrenarlo: vuelve con ' + fmt(kg) + ' kg (90%).' };
    }
    if (ex.type === 'bw') {
      if (allTop) return { sets: fill(top, rmax), badge: { t: 'Sube nivel', c: 'up' }, text: 'Llegaste a ' + n + ' × ' + rmax + '. Añade 2,5 kg de lastre o pasa a una variante más difícil.' };
      return { sets: fill(top, reps.map((r) => Math.min(rmax, r + 1))), badge: { t: '+1 rep', c: 'up' }, text: 'Intenta una repetición más por serie que la última vez.' };
    }
    if (allTop) {
      const kg = top + inc;
      return { sets: fill(kg, rmin), badge: { t: '+' + fmt(inc) + ' kg', c: 'up' }, text: 'Completaste ' + n + ' × ' + rmax + ' con ' + fmt(top) + ' kg: hoy sube a ' + fmt(kg) + ' kg.' };
    }
    if (below && pp[1]) {
      const pTop = Math.max.apply(null, pp[1].sets.map((s) => s.kg || 0));
      if (pTop === top && pp[1].sets.some((s) => s.reps < rmin)) {
        const kg = roundTo(top * 0.9, inc);
        return { sets: fill(kg, rmax), badge: { t: 'Descarga −10%', c: 'warn' }, text: 'Dos sesiones por debajo de ' + rmin + ' reps: baja a ' + fmt(kg) + ' kg y reconstruye.' };
      }
    }
    return { sets: fill(top, reps.map((r) => Math.min(rmax, Math.max(rmin, r + 1)))), badge: { t: '+1 rep', c: 'up' }, text: 'Mantén ' + fmt(top) + ' kg e intenta una repetición más por serie (meta ' + rmax + ').' };
  }

  /* ---------- planes ---------- */
  function clonePlan(tpl, opts) {
    opts = opts || {};
    const lims = (opts.lim || []).filter((l) => l !== 'Ninguna');
    const capN = opts.minutes ? (opts.minutes <= 30 ? 4 : opts.minutes <= 45 ? 5 : opts.minutes <= 60 ? 6 : 8) : 99;
    const days = tpl.days.map((d) => ({
      name: d.name, focus: d.focus,
      items: d.items.slice(0, capN).map((x, i) => {
        let ex = x.ex;
        lims.forEach((l) => { if (D.AVOID[l] && D.AVOID[l][ex]) ex = D.AVOID[l][ex]; });
        let sets = x.sets;
        if (opts.level === 'Estoy empezando') sets = Math.max(2, sets - 1);
        if (opts.level === 'Avanzado' && i < 2) sets += 1;
        return { ex, sets, rmin: x.rmin, rmax: x.rmax, rest: x.rest };
      })
    }));
    return { id: uid(), tpl: tpl.id, name: tpl.name, goal: opts.goal || tpl.goal, level: opts.level || tpl.level, perWeek: opts.dias || tpl.perWeek, minutes: opts.minutes || tpl.minutes, days, next: 0, created: now() };
  }
  function pickTemplate(r) {
    const T = (id) => D.TEMPLATES.find((t) => t.id === id);
    const dias = parseInt(r.dias || '4', 10);
    if (r.lugar === 'Casa') return T('casa');
    if (r.lugar === 'Parque de barras') return T('cali');
    if (r.lugar === 'Box de CrossFit') return T('cross');
    if (r.obj === 'Calistenia') return T('cali');
    if (r.obj === 'Ganar fuerza') return T('fuerza');
    if (r.obj === 'Bajar grasa') return T('grasa');
    if (r.obj === 'Salud general') return T('fb');
    return dias <= 3 ? T('fb') : dias === 4 ? T('ul') : T('ppl');
  }

  /* ---------- sesión ---------- */
  function sessFromItems(name, items, day) {
    return {
      id: uid(), start: now(), name, day: day == null ? null : day, planId: S.plan && day != null ? S.plan.id : null,
      ei: 0, restEnd: null, restTotal: 0,
      exs: items.map((it) => mkSessEx(it.ex, it))
    };
  }
  function mkSessEx(exId, item) {
    const ex = EX[exId] || {};
    const it = item || { sets: 3, rmin: ex.type === 't' ? 30 : 8, rmax: ex.type === 't' ? 60 : 12, rest: S.settings.rest };
    const sg = suggest(exId, it);
    return { ex: exId, rmin: it.rmin, rmax: it.rmax, rest: it.rest || S.settings.rest, sets: sg.sets, badge: sg.badge, text: sg.text };
  }
  function curSetIdx(e) { const i = e.sets.findIndex((s) => !s.done); return i; }
  function sessCounts(a) { let d = 0, t = 0; a.exs.forEach((e) => e.sets.forEach((s) => { t++; if (s.done) d++; })); return { d, t }; }
  function volume(exs) { let v = 0; exs.forEach((e) => { const x = EX[e.ex]; if (x && x.type === 'w') e.sets.forEach((s) => { if (s.done) v += (s.kg || 0) * (s.reps || 0); }); }); return v; }
  function fmtVol(v) { return v >= 1000 ? fmt(Math.round(v / 100) / 10) + ' t' : fmt(Math.round(v)) + ' kg'; }

  /* ---------- íconos ---------- */
  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    dumbbell: '<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/>', chart: '<path d="M3 20h18M6 16v-4M11 16V7M16 16v-6M21 16V4"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    check: '<path d="m5 12 5 5 9-10"/>', right: '<path d="m9 6 6 6-6 6"/>', left: '<path d="m15 6-6 6 6 6"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', clock: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    swap: '<path d="M7 7h13l-4-4M17 17H4l4 4"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    trend: '<path d="M4 17 10 11l4 4 6-7"/><path d="M15 8h5v5"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    tape: '<path d="M3 8h18v8H3z"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>', share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v8h14v-8"/>',
    play: '', down: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>', up: '<path d="M12 20V8M7 13l5-5 5 5M5 4h14"/>'
  };
  function ic(name, size, sw) { return '<svg width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P[name] + '</svg>'; }
  const playIc = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>';

  /* ---------- componentes visuales ---------- */
  const BACK = ['traps', 'upperback', 'lats', 'triceps', 'lowerback', 'glutes', 'hamstrings'];
  function bodyMap(prim, sec, o) {
    o = o || {};
    const view = o.view || 'both';
    const vb = view === 'f' ? '54 2 112 232' : view === 'b' ? '224 2 112 232' : '50 0 290 236';
    const parts = D.BODY.filter((p) => view === 'both' || p[1] === view).map((p) => {
      const c = p[0] && prim.indexOf(p[0]) >= 0 ? 'var(--m1)' : p[0] && sec.indexOf(p[0]) >= 0 ? 'var(--m2)' : 'var(--m0)';
      return '<g style="fill:' + c + '">' + p[2] + '</g>';
    }).join('');
    const lbl = 'Músculos: ' + prim.map((m) => D.MUSCLES[m]).join(', ') + (sec.length ? '; secundarios: ' + sec.map((m) => D.MUSCLES[m]).join(', ') : '');
    return '<svg class="bodymap" width="' + (o.w || 290) + '" height="' + (o.h || 236) + '" viewBox="' + vb + '" role="img" aria-label="' + esc(lbl) + '">' + parts + '</svg>';
  }
  function thumbFor(ex) {
    const back = ex.primary.some((m) => BACK.indexOf(m) >= 0) && !ex.primary.some((m) => BACK.indexOf(m) < 0);
    return '<div class="thumb" aria-hidden="true">' + bodyMap(ex.primary, ex.secondary, { view: back ? 'b' : 'f', w: 30, h: 52 }) + '</div>';
  }
  function benchFig() {
    return '<svg width="320" height="214" viewBox="60 40 290 220" aria-label="Animación: figura en banco plano bajando y empujando la barra" role="img" style="display:block;margin:0 auto">' +
      '<defs><linearGradient id="hfPiel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D2CEC7"/><stop offset="1" stop-color="#A39E96"/></linearGradient>' +
      '<linearGradient id="hfBanco" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A3A38"/><stop offset="1" stop-color="#1E1E1D"/></linearGradient>' +
      '<radialGradient id="hfPec" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#3F7362"/><stop offset="1" stop-color="#1F3B33"/></radialGradient>' +
      '<radialGradient id="hfDisco" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#4A4A48"/><stop offset="1" stop-color="#121212"/></radialGradient>' +
      '<filter id="hfSombra" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="6"/></filter></defs>' +
      '<ellipse cx="200" cy="240" rx="130" ry="8" fill="#000" opacity="0.14" filter="url(#hfSombra)"/>' +
      '<path d="M118 212 112 238M262 212 268 238" stroke="#2A2A29" stroke-width="7" stroke-linecap="round"/>' +
      '<rect x="95" y="198" width="190" height="14" rx="7" fill="url(#hfBanco)"/>' +
      '<path d="M262 192 300 160" stroke="#B9B4AC" stroke-width="20" stroke-linecap="round"/><path d="M300 160 312 232" stroke="#ADA89F" stroke-width="15" stroke-linecap="round"/><path d="M306 234H328" stroke="#2A2A29" stroke-width="9" stroke-linecap="round"/>' +
      '<path d="M140 176C142 166 160 162 196 164C226 166 252 172 266 180C272 188 268 198 258 199L152 199C140 197 138 186 140 176Z" fill="url(#hfPiel)"/>' +
      '<path d="M150 170C172 165 210 166 240 172" stroke="#E6E3DD" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.7"/>' +
      '<ellipse class="pec" cx="180" cy="171" rx="24" ry="8" fill="url(#hfPec)"/>' +
      '<circle cx="121" cy="184" r="15" fill="url(#hfPiel)"/>' +
      '<g class="brazo"><path d="M155 182 157.5 140" stroke="#99948C" stroke-width="15" stroke-linecap="round"/><path d="M159.5 175 161 147" stroke="#8FAE9F" stroke-width="5" stroke-linecap="round"/>' +
      '<g class="antebrazo"><path d="M157.5 140 160 98" stroke="#A7A29A" stroke-width="12" stroke-linecap="round"/><circle cx="160" cy="96" r="24" fill="url(#hfDisco)"/><circle cx="160" cy="96" r="16" fill="none" stroke="#5A5A58" stroke-width="1.5"/><circle cx="160" cy="96" r="5" fill="#B9B6B0"/></g></g>' +
      '<circle cx="155" cy="181" r="10" fill="#8FAE9F"/></svg>';
  }
  function lineChart(pts, w, h, color) {
    if (pts.length < 2) return '<div class="empty small">Registra al menos dos veces para ver la gráfica.</div>';
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    let y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    if (y1 - y0 < 1) { y0 -= 1; y1 += 1; }
    const pad = 8;
    const X = (x) => pad + ((x - x0) / (x1 - x0 || 1)) * (w - pad * 2);
    const Y = (y) => pad + (1 - (y - y0) / (y1 - y0)) * (h - pad * 2);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
    const last = pts[pts.length - 1];
    return '<svg width="100%" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="Gráfica de ' + pts.length + ' registros, de ' + fmt(pts[0].y) + ' a ' + fmt(last.y) + '">' +
      '<path d="M0 ' + (h - 1) + 'H' + w + 'M0 ' + h / 2 + 'H' + w + '" style="stroke:var(--line2)" stroke-width="1" vector-effect="non-scaling-stroke"/>' +
      '<path class="traza" d="' + d + '" fill="none" style="--len:1200;stroke:' + (color || 'var(--pine-ink)') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      '<circle cx="' + X(last.x).toFixed(1) + '" cy="' + Y(last.y).toFixed(1) + '" r="4" style="fill:' + (color || 'var(--pine-ink)') + '"/></svg>';
  }
  function badge(b) { return b ? '<span class="badge ' + (b.c || '') + '">' + esc(b.t) + '</span>' : ''; }
  function planMeta(it) { const ex = EX[it.ex] || {}; return it.sets + ' × ' + (ex.type === 't' ? fmtSecs(it.rmin) + '–' + fmtSecs(it.rmax) : it.rmin + '–' + it.rmax); }
  function setTxt(ex, s) { if (!s) return '—'; if (ex.type === 't') return fmtSecs(s.reps); if (ex.type === 'bw') return (s.kg ? '+' + fmt(s.kg) + ' kg × ' : '') + s.reps; return fmt(s.kg) + ' × ' + s.reps; }

  function tabbar(name) {
    const tabs = [['hoy', 'Hoy', 'home'], ['explorar', 'Explorar', 'search'], ['sesion', 'Entrenar', 'dumbbell'], ['progreso', 'Progreso', 'chart'], ['planes', 'Planes', 'list']];
    return '<div class="tabbar"><nav aria-label="Navegación principal">' + tabs.map((t) =>
      '<a class="tab' + (name === t[0] ? ' on' : '') + '" href="#/' + t[0] + '"' + (name === t[0] ? ' aria-current="page"' : '') + '><span style="position:relative">' + ic(t[2]) + (t[0] === 'sesion' && S.active ? '<i class="live"></i>' : '') + '</span>' + t[1] + '</a>'
    ).join('') + '</nav></div>';
  }

  /* ---------- vistas ---------- */
  const V = {};

  V.onboarding = function () {
    const st = UI.onb, d = UI.onbData;
    if (st === 0) {
      return '<div class="hero" style="height:46dvh;display:flex;align-items:center;justify-content:center;border-radius:0 0 32px 32px">' +
        '<span class="brand" style="position:absolute;top:calc(var(--st) + 22px);left:22px;font-size:24px">howser<b>fit</b></span>' +
        '<svg width="200" height="240" viewBox="0 0 220 260" aria-hidden="true"><path d="M20 250H200" stroke="#D3D0CA" stroke-width="2" stroke-linecap="round"/><circle cx="110" cy="44" r="16" fill="#BDB9B2"/><path d="M110 66V150" stroke="#BDB9B2" stroke-width="28" stroke-linecap="round"/><path d="M98 152 84 200 92 246M122 152 136 200 128 246" fill="none" stroke="#BDB9B2" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/><path d="M96 76 62 58 50 20M124 76 158 58 170 20" fill="none" stroke="#A5A19A" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 20H190" stroke="#161616" stroke-width="5" stroke-linecap="round"/><rect x="18" y="4" width="10" height="32" rx="3" fill="#161616"/><rect x="192" y="4" width="10" height="32" rx="3" fill="#161616"/><ellipse cx="110" cy="96" rx="15" ry="9" fill="#1F3B33"/></svg></div>' +
        '<div class="col" style="gap:12px;margin-top:8px"><h1 class="h1" style="font-size:34px;letter-spacing:-.8px">Entrena con un plan.<br>Progresa con datos.</h1>' +
        '<p class="muted lh" style="margin:0;font-size:15px">Registra cada serie, descansa con cronómetro y deja que la app te diga cuánto subir la próxima vez.</p></div>' +
        '<div class="stack" style="margin-top:auto"><button class="btn primary" data-a="onb-next">Comenzar</button>' +
        '<label class="btn ghost" style="cursor:pointer">Restaurar copia de seguridad<input type="file" accept="application/json" class="sr" data-c="import"></label></div>';
    }
    const head = '<div class="row"><button class="icon-btn" data-a="onb-back" aria-label="Atrás">' + ic('left', 18, 2) + '</button><div class="progress grow" style="grid-template-columns:repeat(2,1fr)"><i class="on"></i><i class="' + (st === 2 ? 'on' : '') + '"></i></div><span class="small muted">' + st + ' de 2</span></div>';
    if (st === 1) {
      return head + '<div class="col"><h1 class="h1">Cuéntanos de ti</h1><span class="muted small">Lo usamos para calcular cargas y tu progreso.</span></div>' +
        '<label class="field"><span>Nombre</span><input class="input" data-c="onb" data-k="name" value="' + esc(d.name) + '" placeholder="Tu nombre" autocomplete="given-name"></label>' +
        '<div class="field"><span>Sexo</span><div class="seg" style="grid-template-columns:repeat(3,1fr)">' + ['Hombre', 'Mujer', 'Otro'].map((s) => '<button class="' + (d.sex === s ? 'on' : '') + '" data-a="onb-sex" data-v="' + s + '">' + s + '</button>').join('') + '</div></div>' +
        '<div class="grid3"><label class="field"><span>Edad</span><input class="input" inputmode="numeric" data-c="onb" data-k="age" value="' + esc(d.age) + '"></label>' +
        '<label class="field"><span>Altura (cm)</span><input class="input" inputmode="numeric" data-c="onb" data-k="height" value="' + esc(d.height) + '"></label>' +
        '<label class="field"><span>Peso (kg)</span><input class="input" inputmode="decimal" data-c="onb" data-k="weight" value="' + esc(d.weight) + '"></label></div>' +
        '<button class="btn primary" style="margin-top:12px" data-a="onb-save">Continuar</button>';
    }
    return head + '<div class="col"><h1 class="h1">Tu punto de partida</h1><span class="muted small lh">Una foto y tus medidas de hoy te dejan ver el cambio real en unas semanas. Es opcional y queda solo en tu teléfono.</span></div>' +
      '<div class="grid3">' + ['Frente', 'Perfil', 'Espalda'].map((p) => photoAdd(p)).join('') + '</div>' +
      '<a class="item" href="#/medidas"><div class="thumb" style="width:40px;height:40px;border-radius:20px;background:var(--pine-soft);color:var(--pine-ink)">' + ic('tape', 20) + '</div><div class="grow col" style="gap:2px"><span class="h3">Registrar medidas</span><span class="small muted">Peso, brazo, pecho, cintura, cadera, pierna</span></div><span class="chev">' + ic('right', 16, 2) + '</span></a>' +
      '<div class="row small muted lh" style="align-items:flex-start">' + ic('lock', 18) + '<span>Tus fotos y datos se guardan solo en este dispositivo. Exporta una copia desde Ajustes cuando quieras.</span></div>' +
      '<div class="stack" style="margin-top:8px"><a class="btn primary" href="#/asistente">Crear mi plan</a><a class="btn ghost" href="#/hoy">Hacerlo más tarde</a></div>';
  };
  function photoAdd(pose) {
    return '<label class="photo add tap" style="cursor:pointer">' + ic('camera', 22) + pose + '<input type="file" accept="image/*" class="sr" data-c="photo" data-pose="' + pose + '"></label>';
  }

  V.hoy = function () {
    const p = S.profile, t = now();
    const wk = startOfWeek(t);
    const weekS = S.sessions.filter((s) => s.start >= wk);
    let streak = 0; { let w = startOfWeek(t); if (!weekS.length) w -= 7 * DAY; while (S.sessions.some((s) => s.start >= w && s.start < w + 7 * DAY)) { streak++; w -= 7 * DAY; } }
    const goalW = S.plan ? (parseInt(S.plan.perWeek, 10) || S.plan.days.length) : 3;
    let h = '<header class="between"><div class="col" style="gap:4px"><span class="small muted" style="font-weight:500">' + cap(fmtDate(t, { weekday: 'long', day: 'numeric', month: 'long' })) + '</span><h1 class="h1">Hola, ' + esc(p.name || 'atleta') + '</h1></div>' +
      '<a class="icon-btn" href="#/ajustes" aria-label="Ajustes y perfil" style="background:var(--line);font-weight:600;font-size:14px">' + esc((p.name || 'H').slice(0, 2).toUpperCase()) + '</a></header>';
    if (S.active) {
      const c = sessCounts(S.active);
      h += '<a class="card dark" href="#/sesion" style="flex-direction:row;align-items:center;gap:14px"><div class="grow col" style="gap:3px"><span class="xs" style="color:#A9A7A2;font-weight:600;letter-spacing:.8px">SESIÓN EN CURSO</span><span class="h3">' + esc(S.active.name) + '</span><span class="small" style="color:#C9C7C2"><span data-live="elapsed">' + clock(t - S.active.start) + '</span> · ' + c.d + ' de ' + c.t + ' series</span></div><span class="btn sm" style="background:#fff;color:#161616">Continuar</span></a>';
    }
    h += '<section class="between" aria-label="Resumen" style="padding:0 2px">' +
      stat(streak, streak === 1 ? 'semana seguida' : 'semanas seguidas') + '<div style="width:1px;align-self:stretch;background:var(--line)"></div>' +
      stat(weekS.length + '<span class="faint">/' + goalW + '</span>', 'sesiones semana') + '<div style="width:1px;align-self:stretch;background:var(--line)"></div>' +
      stat(fmtVol(weekS.reduce((a, s) => a + volume(s.exs), 0)), 'volumen semana') + '</section>';
    if (!isStandalone() && !hideInstall() && (IS_IOS || IS_ANDROID || deferredInstall)) {
      const how = deferredInstall ? '<b>Instala Howserfit</b> para abrirla como app, a pantalla completa y sin internet.'
        : IS_IOS ? '<b>Instálala en tu iPhone:</b> en Safari toca Compartir y luego “Agregar a pantalla de inicio”.'
        : '<b>Instálala en tu Android:</b> abre el menú ⋮ de Chrome y toca “Instalar aplicación”.';
      h += '<div class="card outline tight" style="flex-direction:row;align-items:flex-start;gap:12px"><span style="color:var(--pine-ink)">' + ic(deferredInstall ? 'down' : 'share', 20) + '</span><div class="grow col small lh" style="gap:10px"><span>' + how + '</span>' + (deferredInstall ? '<button class="btn sm primary" style="align-self:flex-start" data-a="install">Instalar</button>' : '') + '</div><button data-a="hide-install" aria-label="Ocultar" class="faint">' + ic('x', 16, 2) + '</button></div>';
    }
    if (S.plan && !S.active) {
      const di = UI.dayPick != null ? UI.dayPick : S.plan.next % S.plan.days.length;
      const day = S.plan.days[di];
      const rows = day.items.map((it) => { const ex = EX[it.ex]; if (!ex) return ''; const sg = suggest(it.ex, it); const s0 = sg.sets[0]; const kgTxt = ex.type === 'w' && s0.kg ? ' · ' + fmt(s0.kg) + ' kg' : '';
        return '<li class="li" style="min-height:52px"><div class="grow col" style="gap:2px"><span style="font-size:15px;font-weight:500">' + esc(ex.name) + '</span><span class="xs muted">' + planMeta(it) + kgTxt + '</span></div>' + badge(sg.badge) + '</li>'; }).join('');
      h += '<section class="card" aria-label="Entrenamiento de hoy"><div class="col"><span class="eyebrow">' + (di === S.plan.next % S.plan.days.length ? 'Te toca' : 'Elegido') + ' · ' + esc(S.plan.name) + '</span><h2 class="h2">' + esc(day.name) + '</h2><span class="small muted">' + esc(day.focus || '') + ' · ' + day.items.length + ' ejercicios</span></div>' +
        (S.plan.days.length > 1 ? '<div class="scrollx">' + S.plan.days.map((d, i) => '<button class="chip' + (i === di ? ' on' : '') + '" data-a="day-pick" data-i="' + i + '">' + esc(d.name) + '</button>').join('') + '</div>' : '') +
        '<ul class="list" style="padding:0;list-style:none;margin:0;background:none">' + rows + '</ul>' +
        '<button class="btn primary" data-a="start-day" data-i="' + di + '">' + playIc + 'Empezar entrenamiento</button></section>';
      const back = day.items.map((it) => ({ it, pp: perfs(it.ex, 1)[0] })).filter((x) => x.pp && now() - x.pp.date > 14 * DAY)[0];
      if (back) {
        const days = Math.floor((now() - back.pp.date) / DAY);
        h += '<section class="card outline" style="flex-direction:row;gap:14px;align-items:flex-start"><div style="width:36px;height:36px;flex-shrink:0;border-radius:18px;background:var(--clay-soft);color:var(--clay);display:flex;align-items:center;justify-content:center">' + ic('clock', 18) + '</div><div class="col" style="gap:4px"><span class="h3" style="font-size:14px">' + esc(EX[back.it.ex].name) + ' · ' + days + ' días sin entrenar</span><span class="small muted lh">Ajustamos las cargas para que retomes sin lesionarte y subas de nuevo en 2–3 semanas.</span></div></section>';
      }
    } else if (!S.plan && !S.active) {
      h += '<section class="card"><div class="col"><span class="eyebrow">Empieza aquí</span><h2 class="h2">Crea tu plan en 1 minuto</h2><span class="small muted lh">Responde 6 preguntas y armamos tu rutina según objetivo, nivel, días y equipo.</span></div><a class="btn primary" href="#/asistente">Crear mi plan</a><button class="btn white" style="background:var(--bg)" data-a="start-free">Entrenamiento libre</button></section>';
    }
    const recent = S.sessions.slice(-3).reverse();
    if (recent.length) {
      h += '<section class="col" style="gap:8px"><div class="between"><span class="h3">Últimas sesiones</span><a class="link" href="#/progreso" data-a="prog-tab" data-v="historial">Ver todo</a></div><div class="list">' + recent.map(sessRow).join('') + '</div></section>';
    }
    return h;
  };
  function stat(v, k) { return '<div class="col" style="gap:2px"><span style="font-size:24px;font-weight:600;letter-spacing:-.5px">' + v + '</span><span class="xs muted">' + k + '</span></div>'; }
  function sessRow(s) {
    const c = s.exs.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
    return '<a class="li" href="#/historial/' + s.id + '"><div class="grow col" style="gap:2px"><span style="font-size:15px;font-weight:500">' + esc(s.name) + '</span><span class="xs muted">' + cap(fmtDate(s.start)) + ' · ' + clock((s.end || s.start) - s.start) + ' · ' + c + ' series · ' + fmtVol(volume(s.exs)) + '</span></div><span class="chev">' + ic('right', 16, 2) + '</span></a>';
  }
  function isStandalone() { return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches; }
  function hideInstall() { try { return !!localStorage.getItem('hf_hide_install'); } catch (e) { return false; } }
  const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const IS_ANDROID = /Android/i.test(navigator.userAgent);
  let deferredInstall = null;
  let booted = false;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; if (booted) render(false); });
  window.addEventListener('appinstalled', () => { deferredInstall = null; toast('Howserfit instalada'); render(false); });

  function applyTheme() {
    const t = S.settings.theme || 'auto', root = document.documentElement;
    if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
    try { localStorage.setItem('hf_theme', t); } catch (e) { /* sin acceso */ }
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim() || '#F3F2EF';
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', bg));
    const dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const sb = document.getElementById('sbstyle'); if (sb) sb.setAttribute('content', dark ? 'black' : 'default');
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if ((S.settings.theme || 'auto') === 'auto') applyTheme(); });

  V.explorar = function (r) {
    const pick = r.q.pick || '';
    let h = pick
      ? '<div class="between"><h1 class="h1">Elegir ejercicio</h1><button class="btn sm white" data-a="pick-cancel">Cancelar</button></div>'
      : '<div class="between"><h1 class="h1">Explorar</h1><span class="small muted">' + D.EXERCISES.length + ' ejercicios</span></div>';
    h += '<div class="seg" role="tablist" aria-label="Modalidad" style="grid-template-columns:repeat(4,1fr)">' + D.MODS.map((m) => '<button role="tab" aria-selected="' + (UI.mod === m[0]) + '" class="' + (UI.mod === m[0] ? 'on' : '') + '" data-a="mod" data-v="' + m[0] + '">' + m[1] + '</button>').join('') + '</div>' +
      '<label class="search">' + ic('search', 18) + '<span class="sr">Buscar ejercicio</span><input type="search" data-c="search" value="' + esc(UI.q) + '" placeholder="Buscar ejercicio, músculo o equipo" autocomplete="off"></label>' +
      '<div class="scrollx">' + ['Todos'].concat(D.GROUPS).map((g) => '<button class="chip' + (UI.group === g ? ' on' : '') + '" aria-pressed="' + (UI.group === g) + '" data-a="group" data-v="' + g + '">' + g + '</button>').join('') + '</div>' +
      '<div id="exlist" class="stack">' + exList(pick) + '</div>';
    return h;
  };
  function exList(pick) {
    const q = UI.q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const list = D.EXERCISES.filter((e) => (q || e.mods.indexOf(UI.mod) >= 0) && (UI.group === 'Todos' || e.group === UI.group) && (!q || (e.name + ' ' + e.equip + ' ' + e.group + ' ' + e.primary.map((m) => D.MUSCLES[m]).join(' ')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').indexOf(q) >= 0));
    if (!list.length) return '<div class="empty">No encontramos ejercicios con ese filtro.</div>';
    return '<span class="small muted">' + list.length + (list.length === 1 ? ' ejercicio' : ' ejercicios') + '</span>' + list.map((e) => {
      const inner = thumbFor(e) + '<div class="grow col" style="gap:3px"><span style="font-size:15px;font-weight:500">' + esc(e.name) + '</span><span class="xs muted">' + esc(e.group) + ' · ' + esc(e.equip) + '</span></div>';
      return pick ? '<button class="item" data-a="pick-ex" data-id="' + e.id + '">' + inner + '<span class="chev" style="color:var(--pine-ink)">' + ic('plus', 18, 2) + '</span></button>'
        : '<a class="item" href="#/ejercicio/' + e.id + '">' + inner + '<span class="chev">' + ic('right', 16, 2) + '</span></a>';
    }).join('');
  }

  V.ejercicio = function (r) {
    const ex = EX[r.parts[0]];
    if (!ex) return '<div class="empty">Ejercicio no encontrado.</div><a class="btn white" href="#/explorar">Volver</a>';
    const anim = ['press_banca', 'press_banca_mancuernas', 'press_cerrado', 'press_pecho_maquina'].indexOf(ex.id) >= 0;
    const tab = anim ? UI.heroTab : 1;
    const pp = perfs(ex.id), best = bestOf(ex.id);
    let h = '<div class="hero"><div class="between" style="position:relative;z-index:2"><button class="icon-btn" style="background:var(--glass)" data-a="back" aria-label="Volver">' + ic('left', 18, 2) + '</button>' +
      (anim ? '<div class="seg" style="grid-template-columns:1fr 1fr;background:var(--glass);border-radius:20px;padding:3px"><button class="' + (tab === 0 ? 'on' : '') + '" style="height:34px;border-radius:17px;padding:0 12px" data-a="hero" data-v="0">Movimiento</button><button class="' + (tab === 1 ? 'on' : '') + '" style="height:34px;border-radius:17px;padding:0 12px" data-a="hero" data-v="1">Músculos</button></div>' : '') + '</div>' +
      '<div style="min-height:250px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;animation:fade 400ms ease both" data-swipe="hero">' +
      (tab === 0 ? benchFig() + '<div class="row" style="gap:6px;flex-wrap:wrap;justify-content:center"><span class="badge" style="background:var(--glass)">Baja 2 s</span><span class="badge" style="background:var(--glass)">Sube 1 s</span><span class="badge" style="background:var(--glass)">Codos a 45°</span></div>'
        : bodyMap(ex.primary, ex.secondary, { w: 300, h: 226 }) + '<div class="row xs muted" style="gap:90px;font-weight:600;letter-spacing:.6px"><span>FRENTE</span><span>ESPALDA</span></div>') + '</div></div>';
    h += '<div class="col" style="gap:10px"><h1 class="h1" style="font-size:26px">' + esc(ex.name) + '</h1><div class="row" style="flex-wrap:wrap;gap:6px">' +
      ex.primary.map((m) => '<span class="badge" style="background:var(--card);color:var(--ink);display:inline-flex;gap:6px;align-items:center"><i class="dot" style="background:var(--pine)"></i>' + D.MUSCLES[m] + '</span>').join('') +
      ex.secondary.map((m) => '<span class="badge" style="background:var(--card);color:var(--ink);font-weight:500;display:inline-flex;gap:6px;align-items:center"><i class="dot" style="background:var(--sage)"></i>' + D.MUSCLES[m] + '</span>').join('') +
      '<span class="badge" style="background:transparent;border:1px solid var(--line);font-weight:500">' + esc(ex.equip) + '</span></div></div>';
    if (ex.type === 'w') {
      h += '<section class="grid3" aria-label="Tus marcas">' + '<div class="stat"><span class="k">1RM estimado</span><span class="v">' + (best ? fmt(Math.round(best.e * 2) / 2) + ' kg' : '—') + '</span></div>' +
        '<div class="stat"><span class="k">Mejor serie</span><span class="v">' + (best ? fmt(best.kg) + ' × ' + best.reps : '—') + '</span></div>' +
        '<div class="stat"><span class="k">Última vez</span><span class="v">' + (pp[0] ? fmt(Math.max.apply(null, pp[0].sets.map((s) => s.kg))) + ' kg' : '—') + '</span></div></section>';
      if (pp.length > 1) {
        const pts = pp.slice().reverse().map((p) => ({ x: p.date, y: Math.max.apply(null, p.sets.map((s) => e1rm(s.kg, s.reps))) }));
        const delta = pts[pts.length - 1].y - pts[0].y;
        h += '<section class="card tight"><div class="between"><span class="h3" style="font-size:14px">1RM estimado · ' + pts.length + ' sesiones</span><span class="small" style="font-weight:600;color:var(--pine-ink)">' + (delta >= 0 ? '+' : '−') + fmt(Math.abs(Math.round(delta * 2) / 2)) + ' kg</span></div>' + lineChart(pts, 320, 80) + '</section>';
      }
    }
    const tips = ex.tips || ['Controla la bajada (2 segundos).', 'Usa todo el rango de movimiento sin perder la postura.', 'Termina cada serie con 1–2 repeticiones en reserva.'];
    h += '<section class="col" style="gap:8px"><span class="h3" style="font-size:14px">Claves de técnica</span><ol class="small lh" style="margin:0;padding-left:18px;color:var(--ink2);display:flex;flex-direction:column;gap:4px">' + tips.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ol></section>';
    if (pp.length) {
      h += '<section class="col" style="gap:8px"><span class="h3" style="font-size:14px">Historial</span><div class="list">' + pp.slice(0, 6).map((p) => '<div class="li" style="min-height:48px"><span class="small muted" style="width:86px;flex-shrink:0">' + cap(fmtDate(p.date, { day: 'numeric', month: 'short' })) + '</span><span class="small grow">' + p.sets.map((s) => setTxt(ex, s)).join(' · ') + '</span></div>').join('') + '</div></section>';
    }
    h += '<div class="stack">' + (S.active ? '<button class="btn primary" data-a="add-active" data-id="' + ex.id + '">Añadir a mi sesión</button>' : '<button class="btn primary" data-a="start-with" data-id="' + ex.id + '">' + playIc + 'Empezar con este ejercicio</button>') + '</div>';
    return h;
  };

  V.sesion = function () {
    if (UI.summary) return summaryView();
    const a = S.active;
    if (!a) {
      let h = '<h1 class="h1">Entrenar</h1>';
      if (S.plan) {
        h += '<span class="eyebrow">' + esc(S.plan.name) + '</span><div class="stack">' + S.plan.days.map((d, i) => '<button class="item" data-a="start-day" data-i="' + i + '"><div class="thumb" style="width:44px;height:44px;border-radius:22px;background:var(--pine-soft);color:var(--pine-ink);font-weight:700;font-size:13px">' + (i + 1) + '</div><div class="grow col" style="gap:2px"><span style="font-size:15px;font-weight:600">' + esc(d.name) + '</span><span class="xs muted">' + esc(d.focus || '') + ' · ' + d.items.length + ' ejercicios</span></div>' + (i === S.plan.next % S.plan.days.length ? '<span class="badge up">Te toca</span>' : '<span class="chev">' + playIc + '</span>') + '</button>').join('') + '</div>';
      } else {
        h += '<div class="card"><span class="small muted lh">Aún no tienes plan. Crea uno con el asistente o entrena libre añadiendo ejercicios.</span><a class="btn primary" href="#/asistente">Crear mi plan</a></div>';
      }
      h += '<button class="btn white" data-a="start-free">' + ic('plus', 18, 2) + 'Entrenamiento libre</button>';
      return h;
    }
    const c = sessCounts(a);
    let h = '<header class="between"><a class="icon-btn" href="#/hoy" aria-label="Minimizar sesión">' + ic('down', 18, 2) + '</a><div class="col center" style="gap:1px;align-items:center"><span class="h3" style="font-size:14px">' + esc(a.name) + '</span><span class="xs muted"><span data-live="elapsed">' + clock(now() - a.start) + '</span> · ' + c.d + ' de ' + c.t + ' series</span></div><button class="btn sm white" data-a="finish">Finalizar</button></header>';
    if (!a.exs.length) {
      return h + '<div class="card center"><span class="h2">Sesión libre</span><span class="small muted lh">Añade el primer ejercicio para empezar a registrar.</span><a class="btn primary" href="#/explorar?pick=add">' + ic('plus', 18, 2) + 'Añadir ejercicio</a></div>';
    }
    a.ei = clamp(a.ei, 0, a.exs.length - 1);
    const e = a.exs[a.ei], ex = EX[e.ex] || { name: e.ex, type: 'w', inc: 2.5 };
    h += '<div class="scrollx" role="tablist" aria-label="Ejercicios">' + a.exs.map((x, i) => { const dn = x.sets.filter((s) => s.done).length; const full = dn === x.sets.length && x.sets.length; return '<button role="tab" aria-selected="' + (i === a.ei) + '" class="chip' + (i === a.ei ? ' on' : '') + '" data-a="goto-ex" data-i="' + i + '" style="display:inline-flex;gap:6px;align-items:center">' + (full ? '<span style="color:' + (i === a.ei ? '#fff' : 'var(--pine)') + '">' + ic('check', 14, 2.6) + '</span>' : '') + '<span class="nm">' + esc((EX[x.ex] || {}).name || x.ex) + '</span> <span style="opacity:.6">' + dn + '/' + x.sets.length + '</span></button>'; }).join('') + '</div>';
    h += '<div class="between" style="align-items:flex-end"><div class="col" style="gap:4px"><span class="xs muted" style="font-weight:500">Ejercicio ' + (a.ei + 1) + ' de ' + a.exs.length + ' · Meta ' + e.sets.length + ' × ' + (ex.type === 't' ? fmtSecs(e.rmin) + '–' + fmtSecs(e.rmax) : e.rmin + '–' + e.rmax) + '</span><h1 class="h2" style="font-size:24px">' + esc(ex.name) + '</h1></div><a class="icon-btn soft" style="border-radius:12px" href="#/ejercicio/' + e.ex + '" aria-label="Ver técnica y músculos">' + ic('info', 18) + '</a></div>';
    if (e.text) h += '<div class="row small lh" style="align-items:flex-start;color:var(--ink2)">' + (e.badge ? badge(e.badge) : '') + '<span class="grow">' + esc(e.text) + '</span></div>';
    let ci = curSetIdx(e);
    if (UI.selSet != null && UI.selSet < e.sets.length) ci = UI.selSet;
    const kgLbl = ex.type === 'bw' ? 'Lastre' : 'Peso';
    h += '<div class="sets" role="table" aria-label="Series"><div class="set head" role="row"><span role="columnheader">Serie</span><span role="columnheader">Anterior</span><span role="columnheader">Hoy</span><span role="columnheader" style="text-align:right">OK</span></div>' +
      e.sets.map((s, i) => '<div class="set' + (i === ci ? ' cur' : '') + (!s.done && i !== ci ? ' pend' : '') + '" role="row"><button role="cell" data-a="sel-set" data-i="' + i + '" style="text-align:left;min-height:44px">' + (i + 1) + '</button><button role="cell" data-a="sel-set" data-i="' + i + '" class="faint" style="text-align:left;font-size:14px;min-height:44px">' + setTxt(ex, s.prev) + '</button><button role="cell" data-a="sel-set" data-i="' + i + '" style="text-align:left;min-height:44px">' + (s.done || i === ci ? setTxt(ex, s) : '—') + '</button><button role="cell" data-a="toggle-set" data-i="' + i + '" aria-label="' + (s.done ? 'Marcar serie ' + (i + 1) + ' como pendiente' : 'Completar serie ' + (i + 1)) + '" style="display:flex;justify-content:flex-end;min-height:44px;align-items:center"><span class="chk' + (s.done ? ' on pop' : i === ci ? ' cur' : '') + '">' + (s.done ? '<span style="color:#fff">' + ic('check', 13, 3) + '</span>' : '') + '</span></button></div>').join('') + '</div>';
    if (ci >= 0) {
      const s = e.sets[ci];
      const repLbl = ex.type === 't' ? 'Segundos' : 'Repeticiones';
      const showKg = ex.type !== 't';
      h += '<section class="card" aria-label="Serie actual"><div class="between"><span class="h2">Serie ' + (ci + 1) + ' de ' + e.sets.length + '</span><span class="xs muted">' + (s.done ? 'Completada · edita si hace falta' : 'Deja 1–2 reps en reserva') + '</span></div>' +
        '<div class="grid' + (showKg ? '2' : '1') + '" style="' + (showKg ? '' : 'display:grid') + '">' +
        (showKg ? '<div class="stepper"><span class="label">' + kgLbl + ' (kg)</span><div class="ctr"><button data-a="step" data-f="kg" data-d="-1" aria-label="Bajar peso">−</button><input inputmode="decimal" data-c="setval" data-f="kg" value="' + fmt(s.kg || 0) + '" aria-label="' + kgLbl + ' en kg"><button data-a="step" data-f="kg" data-d="1" aria-label="Subir peso">+</button></div></div>' : '') +
        '<div class="stepper"><span class="label">' + repLbl + '</span><div class="ctr"><button data-a="step" data-f="reps" data-d="-1" aria-label="Menos">−</button><input inputmode="numeric" data-c="setval" data-f="reps" value="' + (s.reps || 0) + '" aria-label="' + repLbl + '"><button data-a="step" data-f="reps" data-d="1" aria-label="Más">+</button></div></div></div>' +
        (s.done ? '<button class="btn white" style="background:var(--bg)" data-a="sel-set" data-i="-1">Listo</button>' : '<button class="btn primary" data-a="complete">Completar serie</button>') + '</section>';
    } else {
      const last = a.ei === a.exs.length - 1;
      h += '<section class="card center" style="align-items:center"><span style="color:var(--pine-ink)">' + ic('check', 28, 2.4) + '</span><span class="h2">Ejercicio completado</span>' + (last ? '<button class="btn primary" data-a="finish">Finalizar sesión</button>' : '<button class="btn primary" data-a="goto-ex" data-i="' + (a.ei + 1) + '">Siguiente: ' + esc((EX[a.exs[a.ei + 1].ex] || {}).name) + '</button>') + '</section>';
    }
    h += '<div class="grid2"><button class="btn white sm" style="width:100%;height:44px" data-a="add-set">' + ic('plus', 16, 2) + 'Serie</button><button class="btn white sm" style="width:100%;height:44px" data-a="del-set"' + (e.sets.length <= 1 ? ' disabled' : '') + '>' + ic('minus', 16, 2) + 'Serie</button>' +
      '<a class="btn white sm" style="width:100%;height:44px" href="#/explorar?pick=swap">' + ic('swap', 16) + 'Cambiar</a><a class="btn white sm" style="width:100%;height:44px" href="#/explorar?pick=add">' + ic('plus', 16, 2) + 'Ejercicio</a></div>';
    h += '<div class="between"><button class="link" data-a="goto-ex" data-i="' + (a.ei - 1) + '"' + (a.ei === 0 ? ' disabled' : '') + '>' + ic('left', 16, 2) + ' Anterior</button><button class="link" data-a="goto-ex" data-i="' + (a.ei + 1) + '"' + (a.ei === a.exs.length - 1 ? ' disabled' : '') + '>Siguiente ' + ic('right', 16, 2) + '</button></div>';
    if (!a.restEnd) h += '<div class="row small muted lh" style="align-items:flex-start">' + '<span style="color:var(--pine-ink)">' + ic('clock', 18) + '</span><span>Al completar una serie empieza tu descanso de ' + fmtSecs(e.rest) + '.</span></div>';
    return h;
  };
  function restBar() {
    const a = S.active; if (!a || !a.restEnd) return '';
    const rem = a.restEnd - now();
    return '<div class="rest" role="timer" aria-label="Descanso"><div class="grow col" style="gap:0"><span class="xs" style="font-weight:600;letter-spacing:.8px;color:#A9A7A2">DESCANSO</span><span class="t" data-live="rest">' + clock(rem) + '</span></div>' +
      '<button data-a="rest" data-d="-15">−15 s</button><button data-a="rest" data-d="15">+15 s</button><button class="w" data-a="rest" data-d="0">Saltar</button><div class="bar"><i data-live="restbar" style="transform:scaleX(' + clamp(rem / (a.restTotal || 1), 0, 1) + ')"></i></div></div>';
  }
  function summaryView() {
    const m = UI.summary;
    return '<div class="card pine" style="align-items:flex-start;gap:10px;margin-top:20px"><span class="xs" style="font-weight:600;letter-spacing:.8px;color:#C9D6CF">SESIÓN GUARDADA</span><span class="h1" style="color:#fff">¡Buen trabajo!</span><span class="small" style="color:#C9D6CF">' + esc(m.name) + '</span></div>' +
      '<div class="grid3">' + '<div class="stat"><span class="k">Duración</span><span class="v">' + clock(m.dur) + '</span></div><div class="stat"><span class="k">Series</span><span class="v">' + m.sets + '</span></div><div class="stat"><span class="k">Volumen</span><span class="v">' + fmtVol(m.vol) + '</span></div></div>' +
      (m.prs.length ? '<section class="card"><span class="eyebrow">Nuevos récords</span>' + m.prs.map((p) => '<div class="between"><span style="font-weight:500">' + esc(p.name) + '</span><span class="badge up">' + esc(p.txt) + '</span></div>').join('') + '</section>' : '') +
      '<div class="card outline small lh muted">La próxima vez que hagas estos ejercicios te propondremos el peso y las repeticiones para seguir progresando.</div>' +
      '<button class="btn primary" data-a="summary-ok">Listo</button>';
  }

  V.progreso = function () {
    const t = UI.progTab;
    let h = '<div class="between"><h1 class="h1">Progreso</h1><a class="btn sm dark" href="#/medidas">' + ic('plus', 16, 2) + 'Registrar</a></div>' +
      '<div class="seg" role="tablist" style="grid-template-columns:repeat(3,1fr)">' + [['cuerpo', 'Cuerpo'], ['fuerza', 'Fuerza'], ['historial', 'Historial']].map((x) => '<button role="tab" aria-selected="' + (t === x[0]) + '" class="' + (t === x[0] ? 'on' : '') + '" data-a="prog-tab" data-v="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>';
    if (t === 'cuerpo') {
      const bw = S.bodyweight;
      const cur = bw[bw.length - 1], first = bw[0];
      h += '<section class="card"><div class="between" style="align-items:flex-end"><div class="col" style="gap:2px"><span class="xs muted">Peso corporal</span><span style="font-size:30px;font-weight:600;letter-spacing:-.6px">' + (cur ? fmt(cur.kg) : '—') + ' <span class="muted" style="font-size:16px;font-weight:500">kg</span></span></div>' +
        (cur && first && cur !== first && cur.kg !== first.kg ?'<span class="badge up">' + (cur.kg - first.kg >= 0 ? '+' : '−') + fmt(Math.abs(Math.round((cur.kg - first.kg) * 10) / 10)) + ' kg desde ' + fmtDate(first.date, { day: 'numeric', month: 'short' }) + '</span>' : '') + '</div>' +
        lineChart(bw.map((b) => ({ x: b.date, y: b.kg })), 320, 90, 'var(--ink)') + '</section>';
      const ms = S.measures, mc = ms[ms.length - 1], mf = ms[0];
      const Z = [['chest', 'Pecho'], ['arm', 'Brazo'], ['waist', 'Cintura'], ['hip', 'Cadera'], ['thigh', 'Muslo'], ['calf', 'Pantorrilla']];
      h += '<section class="col" style="gap:8px"><div class="between"><span class="h3" style="font-size:14px">Medidas (cm)</span>' + (mc ? '<span class="xs muted">' + fmtDate(mc.date, { day: 'numeric', month: 'short' }) + '</span>' : '') + '</div>' +
        (mc ? '<div class="grid3">' + Z.map((z) => { const v = mc[z[0]], f = mf[z[0]]; const d = v != null && f != null && mc !== mf ? v - f : null; return '<div class="stat"><span class="k">' + z[1] + '</span><span class="v">' + (v != null ? fmt(v) : '—') + '</span><span class="d" style="color:' + (d == null ? 'var(--faint)' : 'var(--pine)') + '">' + (d == null ? '·' : (d >= 0 ? '+' : '−') + fmt(Math.abs(Math.round(d * 10) / 10))) + '</span></div>'; }).join('') + '</div>'
          : '<a class="card outline small muted lh" href="#/medidas">Aún no registras medidas. Toca para registrar tu punto de partida.</a>') + '</section>';
      h += '<section class="col" style="gap:8px"><div class="between"><span class="h3" style="font-size:14px">Fotos</span><span class="xs muted">Solo en este dispositivo</span></div>' +
        (S.photos.length ? '<div class="grid2">' + (S.photos.length > 1 ? '<button class="btn white sm" style="width:100%;height:44px" data-a="cmp-open">Antes y después</button>' : '') + '<button class="btn white sm" style="width:100%;height:44px' + (S.photos.length > 1 ? '' : ';grid-column:span 2') + '" data-a="photos-zip">' + ic('down', 16) + 'Descargar fotos</button></div>' : '') +
        '<div class="grid3">' +
        S.photos.slice(-8).reverse().map((p) => '<button class="photo" data-a="photo-open" data-id="' + p.id + '"><img data-photo="' + p.id + '" alt="Foto ' + esc(p.pose) + ' del ' + fmtDate(p.date) + '"><span>' + fmtDate(p.date, { day: 'numeric', month: 'short' }) + '</span></button>').join('') + photoAdd('Añadir') + '</div></section>';
    } else if (t === 'fuerza') {
      const ids = []; for (let i = S.sessions.length - 1; i >= 0; i--) S.sessions[i].exs.forEach((e) => { if (ids.indexOf(e.ex) < 0 && EX[e.ex] && EX[e.ex].type === 'w') ids.push(e.ex); });
      h += ids.length ? '<div class="list">' + ids.map((id) => { const pp = perfs(id); const be = (p) => Math.max.apply(null, p.sets.map((s) => e1rm(s.kg, s.reps))); const lastE = be(pp[0]), firstE = be(pp[pp.length - 1]); const d = lastE - firstE;
        return '<a class="li" href="#/ejercicio/' + id + '"><div class="grow col" style="gap:2px"><span style="font-size:15px;font-weight:500">' + esc(EX[id].name) + '</span><span class="xs muted">1RM estimado ' + fmt(Math.round(lastE * 2) / 2) + ' kg · ' + pp.length + ' sesiones</span></div>' + (pp.length > 1 ? '<span class="badge ' + (d > 0 ? 'up' : '') + '">' + (d >= 0 ? '+' : '−') + fmt(Math.abs(Math.round(d * 2) / 2)) + ' kg</span>' : '') + '</a>'; }).join('') + '</div>'
        : '<div class="empty">Cuando completes tu primera sesión verás aquí la evolución de cada ejercicio.</div>';
    } else {
      h += S.sessions.length ? '<div class="list">' + S.sessions.slice().reverse().map(sessRow).join('') + '</div>' : '<div class="empty">Aún no hay sesiones registradas.</div>';
    }
    return h;
  };

  V.historial = function (r) {
    const s = S.sessions.find((x) => x.id === r.parts[0]);
    if (!s) return '<div class="empty">Sesión no encontrada.</div><a class="btn white" href="#/progreso">Volver</a>';
    return '<div class="row"><button class="icon-btn" data-a="back" aria-label="Volver">' + ic('left', 18, 2) + '</button><div class="col grow" style="gap:2px"><span class="h3">' + esc(s.name) + '</span><span class="xs muted">' + cap(fmtDate(s.start, { weekday: 'long', day: 'numeric', month: 'long' })) + '</span></div></div>' +
      '<div class="grid3"><div class="stat"><span class="k">Duración</span><span class="v">' + clock((s.end || s.start) - s.start) + '</span></div><div class="stat"><span class="k">Series</span><span class="v">' + s.exs.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0) + '</span></div><div class="stat"><span class="k">Volumen</span><span class="v">' + fmtVol(volume(s.exs)) + '</span></div></div>' +
      '<div class="list">' + s.exs.map((e) => { const ex = EX[e.ex] || { name: e.ex, type: 'w' }; return '<a class="li" href="#/ejercicio/' + e.ex + '"><div class="grow col" style="gap:3px"><span style="font-size:15px;font-weight:500">' + esc(ex.name) + '</span><span class="xs muted">' + e.sets.filter((x) => x.done).map((x) => setTxt(ex, x)).join(' · ') + '</span></div></a>'; }).join('') + '</div>' +
      '<button class="btn danger" data-a="del-session" data-id="' + s.id + '">' + ic('trash', 18) + 'Eliminar sesión</button>';
  };

  V.planes = function () {
    let h = '<h1 class="h1">Planes</h1>';
    if (S.plan) {
      h += '<section class="card pine"><div class="col" style="gap:4px"><span class="xs" style="font-weight:600;letter-spacing:.8px;color:#C9D6CF">TU PLAN</span><span class="h2" style="color:#fff">' + esc(S.plan.name) + '</span><span class="small" style="color:#C9D6CF">' + esc(S.plan.goal) + ' · ' + esc(String(S.plan.perWeek)) + (String(S.plan.perWeek).match(/d[ií]as/) ? '' : ' días') + ' · ' + S.plan.days.length + ' rutinas</span></div>' +
        '<div class="row" style="gap:8px"><a class="btn sm" style="background:#fff;color:#161616" href="#/plan">Ver y editar</a><button class="btn sm" style="background:rgba(255,255,255,.14);color:#fff" data-a="start-day" data-i="' + (S.plan.next % S.plan.days.length) + '">Entrenar ' + esc(S.plan.days[S.plan.next % S.plan.days.length].name) + '</button></div></section>';
    }
    h += '<section class="card dark"><span class="xs" style="font-weight:600;letter-spacing:.8px;color:#A9A7A2">PLAN A TU MEDIDA</span><span class="h2" style="color:#fff;line-height:1.25">Responde 6 preguntas y armamos tu rutina según objetivo, nivel, días y equipo.</span><a class="btn sm" style="background:#fff;color:#161616;align-self:flex-start" href="#/asistente">' + (S.plan ? 'Rehacer mi plan' : 'Empezar') + '</a></section>';
    const goals = ['Todos', 'Hipertrofia', 'Fuerza', 'Pérdida de grasa', 'Calistenia', 'Rendimiento'];
    h += '<div class="scrollx">' + goals.map((g) => '<button class="chip' + (UI.planGoal === g ? ' on' : '') + '" data-a="plan-goal" data-v="' + g + '">' + g + '</button>').join('') + '</div>';
    h += '<div class="stack">' + D.TEMPLATES.filter((t) => UI.planGoal === 'Todos' || t.goal === UI.planGoal).map((t) =>
      '<button class="item" style="flex-direction:column;align-items:stretch;gap:8px;padding:16px" data-a="tpl-open" data-id="' + t.id + '"><div class="between"><span class="h3">' + esc(t.name) + '</span><span class="badge">' + esc(t.level) + '</span></div><span class="small muted lh">' + esc(t.desc) + '</span><div class="row xs" style="gap:14px;color:var(--ink2);font-weight:500"><span>' + esc(t.perWeek) + '</span><span>' + t.days.length + ' rutinas</span><span>' + t.minutes + ' min</span>' + (S.plan && S.plan.tpl === t.id ? '<span style="color:var(--pine-ink)">· Activo</span>' : '') + '</div></button>').join('') + '</div>';
    return h;
  };

  V.plan = function () {
    if (!S.plan) return '<div class="empty">No tienes un plan activo.</div><a class="btn primary" href="#/asistente">Crear mi plan</a>';
    return '<div class="row"><button class="icon-btn" data-a="back" aria-label="Volver">' + ic('left', 18, 2) + '</button><div class="col grow" style="gap:2px"><span class="h3">' + esc(S.plan.name) + '</span><span class="xs muted">Toca un ejercicio para ajustar series, repeticiones o cambiarlo</span></div></div>' +
      S.plan.days.map((d, di) => '<section class="col" style="gap:8px"><div class="between"><span class="h3">' + esc(d.name) + ' <span class="muted" style="font-weight:500;font-size:13px">' + esc(d.focus || '') + '</span></span>' + (di === S.plan.next % S.plan.days.length ? '<span class="badge up">Te toca</span>' : '') + '</div><div class="list">' +
        d.items.map((it, ii) => { const ex = EX[it.ex] || { name: it.ex }; return '<button class="li" data-a="item-open" data-d="' + di + '" data-i="' + ii + '"><div class="grow col" style="gap:2px"><span style="font-size:15px;font-weight:500">' + esc(ex.name) + '</span><span class="xs muted">' + planMeta(it) + ' · descanso ' + fmtSecs(it.rest) + '</span></div><span class="chev">' + ic('right', 16, 2) + '</span></button>'; }).join('') +
        '<a class="li link" href="#/explorar?pick=day:' + di + '" style="justify-content:flex-start">' + ic('plus', 16, 2) + ' Añadir ejercicio</a></div></section>').join('') +
      '<button class="btn danger" data-a="plan-delete">Quitar este plan</button>';
  };

  const WQ = [
    { id: 'obj', t: '¿Cuál es tu objetivo principal?', h: 'Puedes cambiarlo cuando quieras.', o: [['Ganar músculo', 'Hipertrofia y volumen'], ['Bajar grasa', 'Conservar músculo y perder grasa'], ['Ganar fuerza', 'Mover más peso en los básicos'], ['Calistenia', 'Dominar tu peso corporal'], ['Salud general', 'Moverme mejor y sentirme bien']] },
    { id: 'nivel', t: '¿Cuánta experiencia tienes?', h: 'Define el volumen inicial.', o: [['Estoy empezando', 'Menos de 3 meses'], ['Principiante', '3 a 12 meses'], ['Intermedio', '1 a 3 años'], ['Avanzado', 'Más de 3 años']] },
    { id: 'dias', t: '¿Cuántos días a la semana puedes entrenar?', h: 'Mejor constante que perfecto.', o: [['2 días', ''], ['3 días', ''], ['4 días', ''], ['5 días', ''], ['6 días', '']] },
    { id: 'min', t: '¿Cuánto tiempo por sesión?', h: 'Ajustamos la cantidad de ejercicios.', o: [['30 min', 'Exprés'], ['45 min', 'Equilibrado'], ['60 min', 'Completo'], ['75 min o más', 'Sin prisa']] },
    { id: 'lugar', t: '¿Dónde vas a entrenar?', h: 'Solo te proponemos lo que puedes hacer.', o: [['Gimnasio completo', 'Máquinas, poleas y pesos libres'], ['Casa', 'Mancuernas o bandas'], ['Parque de barras', 'Barra fija y paralelas'], ['Box de CrossFit', 'Barras olímpicas y metcon']] },
    { id: 'lim', multi: true, t: '¿Alguna molestia o lesión?', h: 'Cambiamos los ejercicios que podrían agravarla.', o: [['Ninguna', ''], ['Rodilla', ''], ['Hombro', ''], ['Espalda baja', ''], ['Muñeca', '']] }
  ];
  V.asistente = function () {
    const w = UI.wiz;
    const head = '<div class="row"><button class="icon-btn" data-a="wiz-back" aria-label="Atrás">' + ic('left', 18, 2) + '</button><div class="progress grow" style="grid-template-columns:repeat(6,1fr)">' + WQ.map((_, i) => '<i class="' + (i <= w.step ? 'on' : '') + '"></i>').join('') + '</div><span class="small muted" style="min-width:36px;text-align:right">' + (w.step < 6 ? (w.step + 1) + '/6' : 'Listo') + '</span></div>';
    if (w.step >= 6 && UI.wizPlan) {
      const p = UI.wizPlan, lims = w.lim.filter((l) => l !== 'Ninguna');
      return head + '<div class="col" style="gap:6px"><span class="eyebrow">Tu plan recomendado</span><h1 class="h1">' + esc(p.name) + '</h1><span class="small muted">' + esc(w.r.nivel || '') + ' · ' + esc(w.r.dias || '') + ' · ' + esc(w.r.min || '') + ' · ' + esc(w.r.lugar || '') + '</span></div>' +
        '<div class="list">' + p.days.map((d, i) => '<div class="li"><span style="width:34px;height:34px;border-radius:17px;background:var(--pine-soft);color:var(--pine-ink);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">' + (i + 1) + '</span><div class="col" style="gap:1px"><span style="font-size:15px;font-weight:600">' + esc(d.name) + '</span><span class="xs muted">' + d.items.map((x) => (EX[x.ex] || {}).name).slice(0, 3).join(' · ') + (d.items.length > 3 ? '…' : '') + '</span></div></div>').join('') + '</div>' +
        '<section class="col" style="gap:8px"><span class="h3" style="font-size:14px">Por qué este plan</span>' +
        ['Cada músculo se trabaja 2 veces por semana, lo más eficiente para crecer.', 'Progresión automática: sube repeticiones y luego peso cuando cumples el rango.', lims.length ? 'Cambiamos ejercicios de riesgo para: ' + lims.join(', ').toLowerCase() + '.' : 'Si dejas de entrenar unas semanas, ajustamos las cargas para que retomes seguro.'].map((t) => '<div class="row small lh" style="align-items:flex-start;color:var(--ink2)"><span style="color:var(--pine-ink);flex-shrink:0">' + ic('check', 16, 2.2) + '</span><span>' + esc(t) + '</span></div>').join('') + '</section>' +
        '<div class="stack"><button class="btn primary" data-a="wiz-accept">Empezar este plan</button><button class="btn ghost" data-a="wiz-reset">Cambiar respuestas</button></div>';
    }
    const q = WQ[w.step];
    return head + '<div class="col" style="gap:6px;margin-top:8px"><h1 class="h1" style="font-size:28px">' + q.t + '</h1><span class="small muted">' + q.h + '</span></div>' +
      '<div class="stack" role="listbox" aria-label="' + esc(q.t) + '">' + q.o.map((o) => { const on = q.multi ? w.lim.indexOf(o[0]) >= 0 : w.r[q.id] === o[0];
        return '<button role="option" aria-selected="' + on + '" class="opt' + (on ? ' on' : '') + '" data-a="wiz-opt" data-v="' + esc(o[0]) + '"><span class="grow col" style="gap:2px"><span style="font-size:16px;font-weight:600">' + o[0] + '</span>' + (o[1] ? '<span class="small muted">' + o[1] + '</span>' : '') + '</span><span class="mk' + (q.multi ? ' sq' : '') + '"><span style="color:#fff">' + (on ? ic('check', 12, 3) : '') + '</span></span></button>'; }).join('') + '</div>' +
      (q.multi ? '<button class="btn primary" data-a="wiz-done">Ver mi plan</button>' : '');
  };

  const MZ = [['chest', 'Pecho', 'Cinta a la altura de los pezones, brazos relajados, al final de una exhalación.', 'M76 62H144'], ['arm', 'Brazo', 'Brazo derecho relajado, en la parte más ancha del bíceps.', 'M62 74H84'], ['waist', 'Cintura', 'A la altura del ombligo, de pie y sin meter el abdomen.', 'M80 100H140'], ['hip', 'Cadera', 'En la parte más ancha de los glúteos, pies juntos.', 'M80 124H140'], ['thigh', 'Muslo', 'Pierna derecha, en el punto medio entre cadera y rodilla.', 'M84 152H111'], ['calf', 'Pantorrilla', 'En la parte más ancha de la pantorrilla, de pie.', 'M86 206H109']];
  V.medidas = function () {
    if (!UI.med) {
      const lm = S.measures[S.measures.length - 1] || {}, lb = S.bodyweight[S.bodyweight.length - 1];
      UI.med = { sel: 2, kg: lb ? lb.kg : num(S.profile && S.profile.weight) || 70, v: {} };
      MZ.forEach((z) => { UI.med.v[z[0]] = lm[z[0]] != null ? lm[z[0]] : null; });
    }
    const m = UI.med, lm = S.measures[S.measures.length - 1] || {}, z = MZ[m.sel];
    return '<header class="between"><button class="icon-btn" data-a="back" aria-label="Cerrar">' + ic('x', 16, 2) + '</button><div class="col center" style="gap:1px;align-items:center"><span class="h3" style="font-size:15px">Registrar medidas</span><span class="xs muted">Hoy' + (S.measures.length ? ' · último: ' + fmtDate(lm.date, { day: 'numeric', month: 'short' }) : '') + '</span></div><span style="width:44px"></span></header>' +
      '<section class="card tight" style="flex-direction:row;align-items:center;gap:8px;padding-left:18px"><div class="grow col" style="gap:2px"><span class="small muted">Peso corporal</span><span class="row" style="gap:4px"><input class="big" style="border:0;background:transparent;width:96px;padding:0;outline:none" inputmode="decimal" data-c="med-kg" value="' + fmt(m.kg) + '" aria-label="Peso corporal en kg"><span class="muted" style="font-size:15px">kg</span></span></div><button class="icon-btn" style="background:var(--bg);font-size:20px" data-a="med-kg" data-d="-0.1" aria-label="Restar 0,1 kg">−</button><button class="icon-btn" style="background:var(--bg);font-size:20px" data-a="med-kg" data-d="0.1" aria-label="Sumar 0,1 kg">+</button></section>' +
      '<section class="card tight" style="flex-direction:row;align-items:center;gap:10px;padding-left:8px"><svg width="86" height="140" viewBox="55 0 110 236" role="img" aria-label="Silueta con la zona de medición marcada: ' + z[1] + '"><g style="fill:var(--soft2)"><circle cx="110" cy="22" r="13"/><rect x="105" y="34" width="10" height="9" rx="3"/><rect x="84" y="44" width="52" height="88" rx="16"/><rect x="66" y="50" width="14" height="46" rx="7"/><rect x="140" y="50" width="14" height="46" rx="7"/><rect x="62" y="98" width="12" height="34" rx="6"/><rect x="146" y="98" width="12" height="34" rx="6"/><rect x="87" y="134" width="21" height="56" rx="9"/><rect x="112" y="134" width="21" height="56" rx="9"/><rect x="89" y="192" width="17" height="40" rx="7"/><rect x="114" y="192" width="17" height="40" rx="7"/></g>' +
      MZ.map((x, i) => '<path d="' + x[3] + '" stroke-width="' + (i === m.sel ? 4 : 1.5) + '" stroke-linecap="round" style="stroke:' + (i === m.sel ? 'var(--pine-ink)' : 'var(--faint)') + ';transition:stroke 260ms ease,stroke-width 260ms ease"/>').join('') + '</svg>' +
      '<div class="grow col" style="gap:4px"><span class="eyebrow">Cómo medir · ' + z[1] + '</span><span class="small lh" style="color:var(--ink2)">' + z[2] + '</span></div></section>' +
      '<section class="list" aria-label="Medidas en centímetros" style="padding:4px 8px 4px 16px">' + MZ.map((x, i) => { const v = m.v[x[0]], prev = lm[x[0]]; const d = v != null && prev != null ? v - prev : null;
        return '<div class="li" style="gap:6px;min-height:54px"><button class="grow row" style="gap:10px;min-height:44px;text-align:left" data-a="med-sel" data-i="' + i + '"><i class="dot" style="background:' + (i === m.sel ? 'var(--pine)' : 'var(--m0)') + '"></i><span class="col" style="gap:1px"><span style="font-size:15px;font-weight:' + (i === m.sel ? 600 : 500) + '">' + x[1] + '</span><span class="xs muted">' + (prev != null ? 'Antes ' + fmt(prev) + (d ? ' · ' + (d > 0 ? '+' : '−') + fmt(Math.abs(Math.round(d * 10) / 10)) : ' · sin cambio') : 'Sin registro previo') + '</span></span></button>' +
          '<button class="icon-btn" style="width:40px;height:40px;background:var(--bg);font-size:18px" data-a="med-step" data-k="' + x[0] + '" data-d="-0.5" aria-label="Restar 0,5 cm a ' + x[1] + '">−</button><input inputmode="decimal" data-c="med-v" data-k="' + x[0] + '" value="' + (v != null ? fmt(v) : '') + '" placeholder="—" aria-label="' + x[1] + ' en cm" style="width:54px;text-align:center;border:0;background:transparent;font-size:17px;font-weight:600;outline:none"><button class="icon-btn" style="width:40px;height:40px;background:var(--bg);font-size:18px" data-a="med-step" data-k="' + x[0] + '" data-d="0.5" aria-label="Sumar 0,5 cm a ' + x[1] + '">+</button></div>'; }).join('') + '</section>' +
      '<button class="btn primary" data-a="med-save">Guardar medidas</button>';
  };

  V.ajustes = function () {
    const p = S.profile || {}, st = S.settings;
    const tog = (k, on, lbl, sub) => '<button class="li" data-a="toggle" data-k="' + k + '" role="switch" aria-checked="' + on + '"><div class="grow col" style="gap:2px"><span style="font-size:15px;font-weight:500">' + lbl + '</span><span class="xs muted">' + sub + '</span></div><span style="width:50px;height:30px;border-radius:15px;background:' + (on ? 'var(--pine)' : 'var(--m0)') + ';position:relative;transition:background-color 220ms ease;flex-shrink:0"><span style="position:absolute;top:3px;left:' + (on ? 23 : 3) + 'px;width:24px;height:24px;border-radius:12px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left 220ms var(--ease)"></span></span></button>';
    return '<div class="row"><button class="icon-btn" data-a="back" aria-label="Volver">' + ic('left', 18, 2) + '</button><h1 class="h1 grow" style="font-size:26px">Ajustes</h1></div>' +
      '<section class="col" style="gap:8px"><span class="h3" style="font-size:14px">Perfil</span><div class="card tight">' +
      '<label class="field"><span>Nombre</span><input class="input" data-c="prof" data-k="name" value="' + esc(p.name) + '"></label>' +
      '<div class="grid3"><label class="field"><span>Edad</span><input class="input" inputmode="numeric" data-c="prof" data-k="age" value="' + esc(p.age) + '"></label><label class="field"><span>Altura (cm)</span><input class="input" inputmode="numeric" data-c="prof" data-k="height" value="' + esc(p.height) + '"></label><label class="field"><span>Sexo</span><select class="input" data-c="prof" data-k="sex">' + ['Hombre', 'Mujer', 'Otro'].map((s) => '<option' + (p.sex === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></label></div></div></section>' +
      '<section class="col" style="gap:8px"><span class="h3" style="font-size:14px">Apariencia</span><div class="seg" role="radiogroup" aria-label="Tema" style="grid-template-columns:repeat(3,1fr)">' +
      [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map((t) => '<button role="radio" aria-checked="' + (st.theme === t[0]) + '" class="' + (st.theme === t[0] ? 'on' : '') + '" data-a="theme" data-v="' + t[0] + '">' + t[1] + '</button>').join('') +
      '</div><span class="xs muted">Automático sigue el modo claro u oscuro de tu teléfono.</span></section>' +
      '<section class="col" style="gap:8px"><span class="h3" style="font-size:14px">Entrenamiento</span><div class="list">' +
      '<div class="li"><div class="grow col" style="gap:2px"><span style="font-size:15px;font-weight:500">Descanso por defecto</span><span class="xs muted">Para ejercicios fuera de un plan</span></div><button class="icon-btn" style="width:40px;height:40px;background:var(--bg)" data-a="rest-def" data-d="-15" aria-label="Menos descanso">−</button><span style="min-width:60px;text-align:center;font-weight:600">' + fmtSecs(st.rest) + '</span><button class="icon-btn" style="width:40px;height:40px;background:var(--bg)" data-a="rest-def" data-d="15" aria-label="Más descanso">+</button></div>' +
      tog('sound', st.sound, 'Sonido al terminar el descanso', 'Suena aunque el teléfono esté en silencio solo si el volumen está activo') +
      tog('awake', st.awake, 'Mantener pantalla encendida', 'Durante la sesión, para ver el cronómetro') + '</div></section>' +
      '<section class="col" style="gap:8px"><span class="h3" style="font-size:14px">Tus datos</span><div class="card tight small muted lh">Todo se guarda solo en este dispositivo. Exporta una copia de vez en cuando (por ejemplo a iCloud Drive) para no perder tu historial si cambias de teléfono.</div>' +
      '<div class="grid2"><button class="btn white" data-a="export">' + ic('down', 18) + 'Exportar</button><label class="btn white" style="cursor:pointer">' + ic('up', 18) + 'Importar<input type="file" accept="application/json" class="sr" data-c="import"></label></div>' +
      (S.photos.length ? '<button class="btn white" data-a="photos-zip">' + ic('camera', 18) + 'Descargar mis ' + S.photos.length + ' fotos (.zip)</button>' : '') +
      '<button class="btn danger" data-a="wipe">Borrar todos los datos</button></section>' +
      '<div class="center xs faint" style="padding:8px 0"><span class="brand" style="font-size:16px;color:var(--ink)">howser<b>fit</b></span><br>Versión ' + VERSION + ' · ' + S.sessions.length + ' sesiones guardadas</div>';
  };

  /* ---------- router y render ---------- */
  function parseRoute() {
    const raw = location.hash.replace(/^#\/?/, '') || 'hoy';
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const q = {}; (qs || '').split('&').forEach((kv) => { if (kv) { const [k, v] = kv.split('='); q[decodeURIComponent(k)] = decodeURIComponent(v || ''); } });
    return { name: parts[0] || 'hoy', parts: parts.slice(1), q };
  }
  const TABBED = ['hoy', 'explorar', 'progreso', 'planes'];
  let lastRoute = '';
  let vtBusy = false, firstPaint = true, renderSeq = 0;
  function render(enter) {
    const r = parseRoute();
    if (!S.profile && ['onboarding', 'medidas', 'asistente'].indexOf(r.name) < 0) r.name = 'onboarding';
    const view = V[r.name] || V.hoy;
    const key = r.name + '/' + r.parts.join('/');
    if (key !== lastRoute) { enter = true; lastRoute = key; }
    const showTab = TABBED.indexOf(r.name) >= 0 || (r.name === 'sesion' && !S.active && !UI.summary);
    const tabName = r.name;
    let html = '<main class="screen' + (enter ? ' enter' : '') + (showTab ? '' : ' notab') + (S.active && S.active.restEnd && r.name === 'sesion' ? ' resting' : '') + '"' + (r.name === 'onboarding' && UI.onb === 0 ? ' style="min-height:100dvh"' : '') + '>' + view(r) + '</main>' + (showTab ? tabbar(tabName) : '') + restBar();
    if (UI.sheet) html += '<div class="backdrop" data-a="sheet-close"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + UI.sheet + '</div>';
    let applied = false;
    const seq = ++renderSeq;
    const apply = () => { if (applied || seq !== renderSeq) return; applied = true; $app.innerHTML = html; hydratePhotos(); if (enter) window.scrollTo(0, 0); };
    if (firstPaint) { firstPaint = false; apply(); return; }
    setTimeout(apply, 400);
    if (enter && !vtBusy && document.visibilityState === 'visible' && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try {
        vtBusy = true;
        const vt = document.startViewTransition(apply);
        const done = () => { vtBusy = false; };
        vt.ready.catch(() => {}); vt.updateCallbackDone.catch(apply);
        vt.finished.then(done, done);
      } catch (e) { vtBusy = false; apply(); }
    } else apply();
  }
  function go(path) { if (location.hash === '#/' + path) render(false); else location.hash = '#/' + path; }
  window.addEventListener('hashchange', () => { UI.sheet = null; UI.selSet = null; render(true); });

  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => { t.style.transition = 'opacity 300ms ease'; t.style.opacity = '0'; }, 2200); setTimeout(() => t.remove(), 2600);
  }
  function sheet(html) { UI.sheet = html; render(false); }
  function confirmSheet(title, text, okLbl, okAction, okData, danger) {
    sheet('<span class="h2">' + esc(title) + '</span><span class="small muted lh">' + esc(text) + '</span><button class="btn ' + (danger ? 'danger' : 'primary') + '" data-a="' + okAction + '"' + (okData ? ' data-id="' + esc(okData) + '"' : '') + '>' + esc(okLbl) + '</button><button class="btn ghost" data-a="sheet-close">Cancelar</button>');
  }

  /* ---------- fotos ---------- */
  const photoURL = new Map();
  function hydratePhotos() {
    $app.querySelectorAll('img[data-photo]').forEach((img) => {
      const id = img.dataset.photo;
      if (photoURL.has(id)) { img.src = photoURL.get(id); return; }
      DB.get('photo:' + id).then((b) => { if (b) { const u = URL.createObjectURL(b); photoURL.set(id, u); img.src = u; } });
    });
  }
  function dateKey(ts) { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function weightAt(ts) { let w = null; S.bodyweight.forEach((b) => { if (b.date <= ts + DAY) w = b.kg; }); return w; }
  function slug(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-'); }
  function photoFileName(p) { return dateKey(p.date) + '_' + slug(p.pose) + '_' + p.id.slice(-4) + '.jpg'; }
  function loadImg(blob) {
    return new Promise((res, rej) => { const u = URL.createObjectURL(blob), i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
  }

  // Compartir necesita un toque directo en iPhone: primero se prepara el archivo y luego se ofrece el botón.
  function offerShare(files, title, preview) {
    UI.share = { files, title };
    sheet('<span class="h2">' + esc(title) + '</span>' + (preview || '') +
      '<span class="small muted lh">En iPhone puedes elegir “Guardar imagen”, guardarlo en Archivos o iCloud Drive, o enviarlo por AirDrop a tu Mac. En Android, Google Drive o Fotos. En computadora se descarga.</span>' +
      '<button class="btn primary" data-a="do-share">' + ic('share', 18) + 'Guardar o compartir</button><button class="btn ghost" data-a="sheet-close">Cerrar</button>');
  }
  async function shareFiles(files, title) {
    if (navigator.canShare && navigator.canShare({ files })) {
      try { await navigator.share({ files, title }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    files.forEach((f, i) => setTimeout(() => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    }, i * 300));
  }

  // ZIP sin compresión (las fotos ya vienen comprimidas en JPEG).
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function makeZip(entries) {
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    entries.forEach((e) => {
      const nm = enc.encode(e.name), crc = crc32(e.data), n = e.data.length;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(12, 0x21, true);
      h.setUint32(14, crc, true); h.setUint32(18, n, true); h.setUint32(22, n, true); h.setUint16(26, nm.length, true);
      parts.push(new Uint8Array(h.buffer), nm, e.data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(14, 0x21, true);
      c.setUint32(16, crc, true); c.setUint32(20, n, true); c.setUint32(24, n, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), nm);
      off += 30 + nm.length + n;
    });
    const cs = central.reduce((a, b) => a + b.length, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, cs, true); end.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
  }
  async function zipPhotos() {
    toast('Preparando tus fotos…');
    const entries = [], meta = [];
    for (const p of S.photos) {
      const b = await DB.get('photo:' + p.id); if (!b) continue;
      entries.push({ name: 'fotos/' + photoFileName(p), data: new Uint8Array(await b.arrayBuffer()) });
      meta.push({ archivo: photoFileName(p), fecha: new Date(p.date).toISOString(), pose: p.pose, peso_kg: weightAt(p.date) });
    }
    entries.push({ name: 'fotos/datos.json', data: new TextEncoder().encode(JSON.stringify({ nombre: S.profile && S.profile.name, fotos: meta }, null, 2)) });
    const zip = makeZip(entries);
    offerShare([new File([zip], 'howserfit-fotos-' + dateKey(now()) + '.zip', { type: 'application/zip' })], meta.length + ' fotos listas');
  }

  // Imagen comparativa antes / después (1080 × 1350, formato vertical para redes).
  async function makeComparison(aId, bId) {
    const pa = S.photos.find((p) => p.id === aId), pb = S.photos.find((p) => p.id === bId);
    const [ia, ib] = await Promise.all([DB.get('photo:' + aId).then(loadImg), DB.get('photo:' + bId).then(loadImg)]);
    try { await document.fonts.load('600 40px "Inter Tight"'); } catch (e) { /* fuente del sistema */ }
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), F = '"Inter Tight", -apple-system, system-ui, sans-serif';
    x.fillStyle = '#F3F2EF'; x.fillRect(0, 0, W, H);
    x.font = '600 54px ' + F; x.fillStyle = '#161616'; x.textBaseline = 'alphabetic';
    x.fillText('howser', 56, 108); const wd = x.measureText('howser').width; x.fillStyle = '#1F3B33'; x.fillText('fit', 56 + wd - 2, 108);
    const pad = 56, gap = 20, top = 150, ph = 930, pw = (W - pad * 2 - gap) / 2;
    [[ia, pa, 'ANTES'], [ib, pb, 'DESPUÉS']].forEach(([img, p, lbl], i) => {
      const px = pad + i * (pw + gap);
      x.save(); x.beginPath(); if (x.roundRect) x.roundRect(px, top, pw, ph, 28); else x.rect(px, top, pw, ph); x.clip();
      const k = Math.max(pw / img.width, ph / img.height), dw = img.width * k, dh = img.height * k;
      x.drawImage(img, px + (pw - dw) / 2, top + (ph - dh) / 2, dw, dh); x.restore();
      x.fillStyle = i ? '#1F3B33' : '#6B6964'; x.font = '700 26px ' + F; x.fillText(lbl, px, top + ph + 56);
      x.fillStyle = '#161616'; x.font = '500 32px ' + F;
      const w = weightAt(p.date);
      x.fillText(fmtDate(p.date, { day: 'numeric', month: 'short', year: 'numeric' }) + (w ? ' · ' + fmt(w) + ' kg' : ''), px, top + ph + 100);
    });
    const wa = weightAt(pa.date), wb = weightAt(pb.date), weeks = Math.max(1, Math.round((pb.date - pa.date) / (7 * DAY)));
    x.fillStyle = '#1F3B33'; x.fillRect(0, H - 110, W, 110);
    x.fillStyle = '#FFFFFF'; x.font = '600 36px ' + F;
    x.fillText((wa && wb && wa !== wb ? (wb - wa >= 0 ? '+' : '−') + fmt(Math.abs(Math.round((wb - wa) * 10) / 10)) + ' kg · ' : '') + weeks + (weeks === 1 ? ' semana' : ' semanas') + ' de progreso', pad, H - 42);
    return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
  }
  function cmpSheet() {
    const c = UI.cmp, ph = S.photos.slice().sort((p, q) => p.date - q.date);
    const row = (k, lbl) => '<span class="label">' + lbl + '</span><div class="scrollx" style="margin:0 -20px">' + ph.map((p) => '<button class="photo" style="width:84px;flex-shrink:0;outline:' + (c[k] === p.id ? '3px solid var(--pine-ink)' : 'none') + ';outline-offset:-3px" data-a="cmp-pick" data-k="' + k + '" data-id="' + p.id + '" aria-pressed="' + (c[k] === p.id) + '"><img data-photo="' + p.id + '" alt="Foto del ' + fmtDate(p.date) + '"><span>' + fmtDate(p.date, { day: 'numeric', month: 'short' }) + '</span></button>').join('') + '</div>';
    return '<span class="h2">Antes y después</span><span class="small muted lh">Elige dos fotos. Creamos una imagen lista para guardar como referencia o testimonio.</span>' + row('a', 'Antes') + row('b', 'Después') +
      '<button class="btn primary" data-a="cmp-make"' + (c.a && c.b && c.a !== c.b ? '' : ' disabled') + '>Crear imagen</button><button class="btn ghost" data-a="sheet-close">Cerrar</button>';
  }

  function savePhoto(file, pose) {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1280, k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob((b) => { const id = uid(); DB.set('photo:' + id, b).then(() => { S.photos.push({ id, date: now(), pose: pose || 'Frente' }); save(); toast('Foto guardada'); render(false); }); }, 'image/jpeg', 0.82);
    };
    img.onerror = () => toast('No pudimos leer esa imagen');
    img.src = url;
  }

  /* ---------- sesión: acciones ---------- */
  function startSession(sess) {
    if (S.active) { toast('Ya tienes una sesión en curso'); go('sesion'); return; }
    S.active = sess; UI.summary = null; save(true); unlockAudio(); keepAwake(); go('sesion');
  }
  function completeSet() {
    const a = S.active, e = a.exs[a.ei]; let ci = UI.selSet != null ? UI.selSet : curSetIdx(e);
    if (ci < 0) return;
    e.sets[ci].done = true; UI.selSet = null;
    const rest = e.rest || S.settings.rest;
    const lastOfAll = a.exs.every((x) => x.sets.every((s) => s.done));
    if (rest > 0 && !lastOfAll) { a.restEnd = now() + rest * 1000; a.restTotal = rest * 1000; UI.alarmFired = false; }
    if (curSetIdx(e) < 0 && a.ei < a.exs.length - 1) { setTimeout(() => { if (S.active === a && curSetIdx(a.exs[a.ei]) < 0) { a.ei++; save(); render(false); toast('Siguiente: ' + (EX[a.exs[a.ei].ex] || {}).name); } }, 900); }
    if (navigator.vibrate) navigator.vibrate(30);
    save(); render(false);
    if (lastOfAll) setTimeout(() => finishPrompt(), 400);
  }
  function finishPrompt() {
    const a = S.active; if (!a) return;
    const c = sessCounts(a);
    sheet('<span class="h2">' + (c.d === c.t ? '¡Sesión completa!' : 'Finalizar sesión') + '</span><span class="small muted lh">' + (c.d === c.t ? 'Completaste las ' + c.t + ' series. Guardamos tu sesión y calculamos tu progresión.' : 'Llevas ' + c.d + ' de ' + c.t + ' series. Solo guardamos las series completadas.') + '</span>' +
      '<button class="btn primary" data-a="finish-ok"' + (c.d ? '' : ' disabled') + '>Guardar sesión</button>' + (c.d === c.t ? '' : '<button class="btn white" data-a="sheet-close">Seguir entrenando</button>') + '<button class="btn ghost" style="color:var(--clay)" data-a="discard">Descartar sesión</button>');
  }
  function finishSession() {
    const a = S.active; if (!a) return;
    const exs = a.exs.map((e) => ({ ex: e.ex, sets: e.sets.filter((s) => s.done).map((s) => ({ kg: s.kg || 0, reps: s.reps || 0, done: true })) })).filter((e) => e.sets.length);
    const prs = [];
    exs.forEach((e) => { const ex = EX[e.ex]; if (!ex || ex.type !== 'w') return; const prev = bestOf(e.ex); const bestNow = e.sets.reduce((b, s) => { const v = e1rm(s.kg, s.reps); return v > b.e ? { e: v, s } : b; }, { e: 0 }); if (prev && bestNow.e > prev.e + 0.01) prs.push({ name: ex.name, txt: fmt(bestNow.s.kg) + ' × ' + bestNow.s.reps }); });
    const rec = { id: a.id, start: a.start, end: now(), name: a.name, day: a.day, planId: a.planId, exs };
    if (exs.length) S.sessions.push(rec);
    if (S.plan && a.day != null && a.planId === S.plan.id) S.plan.next = (a.day + 1) % S.plan.days.length;
    UI.summary = { name: a.name, dur: rec.end - rec.start, sets: exs.reduce((n, e) => n + e.sets.length, 0), vol: volume(exs), prs };
    S.active = null; UI.sheet = null; UI.dayPick = null; releaseAwake(); save(true); go('sesion'); render(false);
  }

  /* ---------- acciones (clic) ---------- */
  const A = {
    'onb-next': () => { UI.onb = 1; render(true); },
    'onb-back': () => { UI.onb = Math.max(0, UI.onb - 1); render(true); },
    'onb-sex': (el) => { UI.onbData.sex = el.dataset.v; render(false); },
    'onb-save': () => {
      const d = UI.onbData;
      if (!d.name.trim()) { toast('Escribe tu nombre'); return; }
      S.profile = { name: d.name.trim(), sex: d.sex, age: d.age, height: d.height, weight: d.weight, created: now() };
      if (num(d.weight) > 0) S.bodyweight.push({ date: now(), kg: num(d.weight) });
      save(true); UI.onb = 2; render(true);
    },
    'hide-install': () => { try { localStorage.setItem('hf_hide_install', '1'); } catch (e) { /* sin acceso */ } render(false); },
    'day-pick': (el) => { UI.dayPick = +el.dataset.i; render(false); },
    'start-day': (el) => { const i = +el.dataset.i, d = S.plan.days[i]; startSession(sessFromItems(d.name, d.items, i)); },
    'start-free': () => startSession(sessFromItems('Entrenamiento libre', [], null)),
    'start-with': (el) => startSession(sessFromItems('Entrenamiento libre', [{ ex: el.dataset.id, sets: 3, rmin: EX[el.dataset.id].type === 't' ? 30 : 8, rmax: EX[el.dataset.id].type === 't' ? 60 : 12, rest: S.settings.rest }], null)),
    'add-active': (el) => { S.active.exs.push(mkSessEx(el.dataset.id)); S.active.ei = S.active.exs.length - 1; save(); toast('Añadido a tu sesión'); go('sesion'); },
    'mod': (el) => { UI.mod = el.dataset.v; render(false); },
    'group': (el) => { UI.group = el.dataset.v; render(false); },
    'pick-cancel': () => history.back(),
    'pick-ex': (el) => {
      const id = el.dataset.id, pick = parseRoute().q.pick || '';
      if (pick === 'add' && S.active) { S.active.exs.push(mkSessEx(id)); S.active.ei = S.active.exs.length - 1; save(); go('sesion'); }
      else if (pick === 'swap' && S.active) { const e = S.active.exs[S.active.ei]; const ne = mkSessEx(id, { sets: e.sets.length, rmin: e.rmin, rmax: e.rmax, rest: e.rest }); ne.sets.forEach((s, i) => { if (e.sets[i] && e.sets[i].done) { /* las series hechas se pierden al cambiar */ } }); S.active.exs[S.active.ei] = ne; save(); go('sesion'); }
      else if (pick.indexOf('day:') === 0 && S.plan) { const di = +pick.slice(4); const ex = EX[id]; S.plan.days[di].items.push({ ex: id, sets: 3, rmin: ex.type === 't' ? 30 : 10, rmax: ex.type === 't' ? 60 : 12, rest: 90 }); save(); go('plan'); }
      else if (pick.indexOf('item:') === 0 && S.plan) { const [di, ii] = pick.slice(5).split('-').map(Number); S.plan.days[di].items[ii].ex = id; save(); go('plan'); }
      else go('ejercicio/' + id);
    },
    'back': () => { if (history.length > 1) history.back(); else go('hoy'); },
    'hero': (el) => { UI.heroTab = +el.dataset.v; render(false); },
    'goto-ex': (el) => { const i = +el.dataset.i; if (i < 0 || i >= S.active.exs.length) return; S.active.ei = i; UI.selSet = null; save(); render(false); },
    'sel-set': (el) => { const i = +el.dataset.i; UI.selSet = i < 0 ? null : i; render(false); },
    'toggle-set': (el) => { const e = S.active.exs[S.active.ei], i = +el.dataset.i; if (e.sets[i].done) { e.sets[i].done = false; UI.selSet = null; save(); render(false); } else { UI.selSet = i; completeSet(); } },
    'step': (el) => {
      const e = S.active.exs[S.active.ei], ex = EX[e.ex] || { inc: 2.5, type: 'w' };
      let ci = UI.selSet != null ? UI.selSet : curSetIdx(e); if (ci < 0) return;
      const s = e.sets[ci], d = +el.dataset.d;
      if (el.dataset.f === 'kg') s.kg = Math.max(0, Math.round((num(s.kg) + d * (ex.inc || 2.5)) * 100) / 100);
      else s.reps = Math.max(0, num(s.reps) + d * (ex.type === 't' ? (e.rmax >= 300 ? 60 : 5) : 1));
      if (el.dataset.f === 'kg') e.sets.forEach((x, j) => { if (j > ci && !x.done) x.kg = s.kg; });
      save(); render(false);
    },
    'complete': () => completeSet(),
    'add-set': () => { const e = S.active.exs[S.active.ei]; const l = e.sets[e.sets.length - 1] || { kg: 0, reps: e.rmax }; e.sets.push({ kg: l.kg, reps: l.reps, done: false, prev: null }); save(); render(false); },
    'del-set': () => { const e = S.active.exs[S.active.ei]; if (e.sets.length > 1) { let i = -1; for (let j = e.sets.length - 1; j >= 0; j--) if (!e.sets[j].done) { i = j; break; } e.sets.splice(i < 0 ? e.sets.length - 1 : i, 1); UI.selSet = null; save(); render(false); } },
    'rest': (el) => { const a = S.active, d = +el.dataset.d; if (!d) a.restEnd = null; else { a.restEnd = Math.max(now(), a.restEnd + d * 1000); a.restTotal = Math.max(a.restTotal, a.restEnd - now()); } save(); render(false); },
    'finish': () => finishPrompt(),
    'finish-ok': () => finishSession(),
    'discard': () => confirmSheet('¿Descartar la sesión?', 'Se perderán las series de esta sesión. No se puede deshacer.', 'Descartar', 'discard-ok', null, true),
    'discard-ok': () => { S.active = null; UI.sheet = null; releaseAwake(); save(true); toast('Sesión descartada'); go('hoy'); },
    'summary-ok': () => { UI.summary = null; go('hoy'); },
    'prog-tab': (el) => { UI.progTab = el.dataset.v; if (parseRoute().name === 'progreso') render(false); },
    'del-session': (el) => confirmSheet('¿Eliminar esta sesión?', 'Se borrará del historial y de tus estadísticas.', 'Eliminar', 'del-session-ok', el.dataset.id, true),
    'del-session-ok': (el) => { S.sessions = S.sessions.filter((s) => s.id !== el.dataset.id); UI.sheet = null; save(true); toast('Sesión eliminada'); go('progreso'); },
    'photo-open': (el) => { const p = S.photos.find((x) => x.id === el.dataset.id); if (!p) return; sheet('<div class="photo" style="aspect-ratio:3/4"><img data-photo="' + p.id + '" alt="Foto de progreso"></div><div class="between"><span class="small muted">' + esc(p.pose) + ' · ' + cap(fmtDate(p.date, { weekday: 'long', day: 'numeric', month: 'long' })) + '</span><button class="btn sm danger" data-a="photo-del" data-id="' + p.id + '">Eliminar</button></div><button class="btn primary" data-a="photo-share" data-id="' + p.id + '">' + ic('share', 18) + 'Guardar o compartir</button>'); },
    'photo-share': async (el) => { const p = S.photos.find((x) => x.id === el.dataset.id); const b = await DB.get('photo:' + p.id); if (b) offerShare([new File([b], photoFileName(p), { type: 'image/jpeg' })], 'Foto lista'); },
    'photos-zip': () => zipPhotos(),
    'do-share': () => { if (UI.share) shareFiles(UI.share.files, UI.share.title); },
    'cmp-open': () => { const ph = S.photos.slice().sort((p, q) => p.date - q.date); UI.cmp = { a: ph[0] && ph[0].id, b: ph[ph.length - 1] && ph[ph.length - 1].id }; sheet(cmpSheet()); },
    'cmp-pick': (el) => { UI.cmp[el.dataset.k] = el.dataset.id; sheet(cmpSheet()); },
    'cmp-make': async () => {
      toast('Creando tu imagen…');
      try {
        const blob = await makeComparison(UI.cmp.a, UI.cmp.b);
        const url = URL.createObjectURL(blob);
        offerShare([new File([blob], 'howserfit-antes-despues-' + dateKey(now()) + '.jpg', { type: 'image/jpeg' })], 'Tu antes y después', '<img src="' + url + '" alt="Imagen comparativa antes y después" style="width:100%;border-radius:16px;display:block">');
      } catch (e) { toast('No pudimos crear la imagen'); }
    },
    'theme': (el) => { S.settings.theme = el.dataset.v; applyTheme(); save(); render(false); },
    'install': async () => { if (!deferredInstall) return; deferredInstall.prompt(); try { await deferredInstall.userChoice; } catch (e) { /* cancelado */ } deferredInstall = null; render(false); },
    'photo-del': (el) => { const id = el.dataset.id; S.photos = S.photos.filter((p) => p.id !== id); DB.del('photo:' + id); UI.sheet = null; save(); render(false); },
    'plan-goal': (el) => { UI.planGoal = el.dataset.v; render(false); },
    'tpl-open': (el) => {
      const t = D.TEMPLATES.find((x) => x.id === el.dataset.id);
      sheet('<span class="eyebrow">' + esc(t.goal) + ' · ' + esc(t.perWeek) + '</span><span class="h2">' + esc(t.name) + '</span><span class="small muted lh">' + esc(t.desc) + '</span>' +
        t.days.map((d) => '<div class="card tight"><div class="between"><span class="h3">' + esc(d.name) + '</span><span class="xs muted">' + esc(d.focus) + '</span></div><span class="xs muted lh">' + d.items.map((x) => (EX[x.ex] || {}).name + ' ' + planMeta(x)).join(' · ') + '</span></div>').join('') +
        '<button class="btn primary" data-a="tpl-use" data-id="' + t.id + '">' + (S.plan ? 'Cambiar a este plan' : 'Usar este plan') + '</button><button class="btn ghost" data-a="sheet-close">Cerrar</button>');
    },
    'tpl-use': (el) => { const t = D.TEMPLATES.find((x) => x.id === el.dataset.id); S.plan = clonePlan(t); UI.sheet = null; save(true); toast('Plan activado'); go('hoy'); },
    'item-open': (el) => {
      const di = +el.dataset.d, ii = +el.dataset.i, it = S.plan.days[di].items[ii], ex = EX[it.ex] || {};
      const st = (f, lbl, step) => '<div class="between"><span style="font-weight:500">' + lbl + '</span><div class="row" style="gap:6px"><button class="icon-btn" style="background:var(--card)" data-a="item-step" data-d="' + di + '" data-i="' + ii + '" data-f="' + f + '" data-s="' + (-step) + '" aria-label="Menos">−</button><span style="min-width:64px;text-align:center;font-weight:600;font-size:17px">' + (f === 'rest' || (ex.type === 't' && f !== 'sets') ? fmtSecs(it[f]) : it[f]) + '</span><button class="icon-btn" style="background:var(--card)" data-a="item-step" data-d="' + di + '" data-i="' + ii + '" data-f="' + f + '" data-s="' + step + '" aria-label="Más">+</button></div></div>';
      const tStep = ex.type === 't' ? (it.rmax >= 300 ? 60 : 5) : 1;
      sheet('<span class="h2">' + esc(ex.name) + '</span>' + st('sets', 'Series', 1) + st('rmin', ex.type === 't' ? 'Tiempo mínimo' : 'Reps mínimas', tStep) + st('rmax', ex.type === 't' ? 'Tiempo máximo' : 'Reps máximas', tStep) + st('rest', 'Descanso', 15) +
        '<div class="grid2"><a class="btn white" href="#/explorar?pick=item:' + di + '-' + ii + '">' + ic('swap', 18) + 'Cambiar</a><button class="btn danger" data-a="item-del" data-d="' + di + '" data-i="' + ii + '">' + ic('trash', 18) + 'Quitar</button></div><button class="btn primary" data-a="sheet-close">Listo</button>');
    },
    'item-step': (el) => { const it = S.plan.days[+el.dataset.d].items[+el.dataset.i], f = el.dataset.f; it[f] = Math.max(f === 'sets' ? 1 : 0, it[f] + +el.dataset.s); if (it.rmin > it.rmax) { if (f === 'rmin') it.rmax = it.rmin; else it.rmin = it.rmax; } save(); A['item-open'](el); },
    'item-del': (el) => { S.plan.days[+el.dataset.d].items.splice(+el.dataset.i, 1); UI.sheet = null; save(); render(false); },
    'plan-delete': () => confirmSheet('¿Quitar tu plan?', 'Tu historial se conserva. Podrás crear otro plan cuando quieras.', 'Quitar plan', 'plan-delete-ok', null, true),
    'plan-delete-ok': () => { S.plan = null; UI.sheet = null; save(true); go('planes'); },
    'wiz-back': () => { if (UI.wiz.step === 0) { if (history.length > 1) history.back(); else go('hoy'); return; } UI.wiz.step--; render(true); },
    'wiz-opt': (el) => {
      const w = UI.wiz, q = WQ[w.step], v = el.dataset.v;
      if (q.multi) {
        let l = w.lim.slice();
        if (v === 'Ninguna') l = ['Ninguna']; else { l = l.filter((x) => x !== 'Ninguna'); const i = l.indexOf(v); if (i >= 0) l.splice(i, 1); else l.push(v); if (!l.length) l = ['Ninguna']; }
        w.lim = l; render(false);
      } else { w.r[q.id] = v; render(false); setTimeout(() => { w.step++; render(true); }, 200); }
    },
    'wiz-done': () => {
      const w = UI.wiz, tpl = pickTemplate(w.r);
      UI.wizPlan = clonePlan(tpl, { lim: w.lim, level: w.r.nivel, minutes: parseInt(w.r.min || '60', 10), goal: w.r.obj, dias: w.r.dias });
      w.step = 6; render(true);
    },
    'wiz-reset': () => { UI.wiz = { step: 0, r: {}, lim: ['Ninguna'] }; UI.wizPlan = null; render(true); },
    'wiz-accept': () => { S.plan = UI.wizPlan; UI.wizPlan = null; UI.wiz = { step: 0, r: {}, lim: ['Ninguna'] }; save(true); toast('¡Plan listo! Empieza cuando quieras'); go('hoy'); },
    'med-sel': (el) => { UI.med.sel = +el.dataset.i; render(false); },
    'med-kg': (el) => { UI.med.kg = Math.max(0, Math.round((num(UI.med.kg) + +el.dataset.d) * 10) / 10); render(false); },
    'med-step': (el) => { const k = el.dataset.k, m = UI.med; const base = m.v[k] != null ? m.v[k] : ({ chest: 95, arm: 32, waist: 85, hip: 95, thigh: 55, calf: 36 })[k]; m.v[k] = Math.max(0, Math.round((base + +el.dataset.d) * 10) / 10); m.sel = MZ.findIndex((z) => z[0] === k); render(false); },
    'med-save': () => {
      const m = UI.med, rec = { date: now() }; let any = false;
      MZ.forEach((z) => { if (m.v[z[0]] != null) { rec[z[0]] = m.v[z[0]]; any = true; } });
      const sameDay = (arr) => arr.length && new Date(arr[arr.length - 1].date).toDateString() === new Date().toDateString();
      if (any) { if (sameDay(S.measures)) S.measures[S.measures.length - 1] = rec; else S.measures.push(rec); }
      if (num(m.kg) > 0) { const bw = { date: now(), kg: num(m.kg) }; if (sameDay(S.bodyweight)) S.bodyweight[S.bodyweight.length - 1] = bw; else S.bodyweight.push(bw); }
      UI.med = null; save(true); toast('Medidas guardadas'); UI.progTab = 'cuerpo'; go(S.profile ? 'progreso' : 'onboarding');
    },
    'toggle': (el) => { S.settings[el.dataset.k] = !S.settings[el.dataset.k]; save(); render(false); },
    'rest-def': (el) => { S.settings.rest = clamp(S.settings.rest + +el.dataset.d, 15, 600); save(); render(false); },
    'export': () => exportData(),
    'wipe': () => confirmSheet('¿Borrar todos los datos?', 'Se eliminarán tu perfil, plan, sesiones, medidas y fotos de este dispositivo. No se puede deshacer.', 'Borrar todo', 'wipe-ok', null, true),
    'wipe-ok': () => { S.photos.forEach((p) => DB.del('photo:' + p.id)); S = blank(); applyTheme(); UI.sheet = null; UI.onb = 0; save(true); go('onboarding'); },
    'sheet-close': () => { UI.sheet = null; render(false); }
  };

  document.addEventListener('click', (ev) => {
    unlockAudio();
    const el = ev.target.closest('[data-a]');
    if (!el || el.disabled) return;
    const fn = A[el.dataset.a];
    if (fn) { if (el.tagName === 'A' && el.dataset.a !== 'prog-tab') ev.preventDefault(); fn(el, ev); }
  });
  document.addEventListener('input', (ev) => {
    const el = ev.target; const c = el.dataset && el.dataset.c; if (!c) return;
    if (c === 'search') { UI.q = el.value; const box = document.getElementById('exlist'); if (box) box.innerHTML = exList(parseRoute().q.pick || ''); }
    else if (c === 'onb') UI.onbData[el.dataset.k] = el.value;
    else if (c === 'prof') { S.profile[el.dataset.k] = el.value; save(); }
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target; const c = el.dataset && el.dataset.c; if (!c) return;
    if (c === 'setval') {
      const e = S.active.exs[S.active.ei]; let ci = UI.selSet != null ? UI.selSet : curSetIdx(e); if (ci < 0) return;
      e.sets[ci][el.dataset.f] = Math.max(0, num(el.value));
      if (el.dataset.f === 'kg') e.sets.forEach((x, j) => { if (j > ci && !x.done) x.kg = e.sets[ci].kg; });
      save(); render(false);
    } else if (c === 'med-kg') { UI.med.kg = num(el.value); render(false); }
    else if (c === 'med-v') { const v = el.value.trim(); UI.med.v[el.dataset.k] = v === '' ? null : num(v); render(false); }
    else if (c === 'prof') { S.profile[el.dataset.k] = el.value; save(); }
    else if (c === 'photo' && el.files && el.files[0]) savePhoto(el.files[0], el.dataset.pose === 'Añadir' ? 'Frente' : el.dataset.pose);
    else if (c === 'import' && el.files && el.files[0]) importData(el.files[0]);
  });

  /* ---------- copia de seguridad ---------- */
  async function exportData() {
    const photos = {};
    for (const p of S.photos) { const b = await DB.get('photo:' + p.id); if (b) photos[p.id] = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); }
    const blob = new Blob([JSON.stringify({ app: 'howserfit', exported: new Date().toISOString(), state: S, photos })], { type: 'application/json' });
    const name = 'howserfit-copia-' + dateKey(now()) + '.json';
    offerShare([new File([blob], name, { type: 'application/json' })], 'Copia de seguridad lista');
  }
  function importData(file) {
    const fr = new FileReader();
    fr.onload = async () => {
      try {
        const data = JSON.parse(fr.result);
        if (!data || data.app !== 'howserfit' || !data.state) throw new Error('formato');
        S = Object.assign(blank(), data.state);
        for (const id in (data.photos || {})) { const res = await fetch(data.photos[id]); await DB.set('photo:' + id, await res.blob()); }
        save(true); toast('Datos restaurados'); go('hoy'); render(true);
      } catch (e) { toast('Ese archivo no es una copia válida de Howserfit'); }
    };
    fr.readAsText(file);
  }

  /* ---------- reloj, sonido y pantalla ---------- */
  let actx = null;
  function unlockAudio() { if (actx || !S.settings.sound) return; try { actx = new (window.AudioContext || window.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain(); g.gain.value = 0; o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.01); } catch (e) { actx = null; } }
  function beep() {
    if (!S.settings.sound || !actx) return;
    try { if (actx.state === 'suspended') actx.resume(); [0, 0.28, 0.56].forEach((t, i) => { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = i === 2 ? 1175 : 880; o.type = 'sine'; g.gain.setValueAtTime(0.0001, actx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.35, actx.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + t + 0.22); o.connect(g).connect(actx.destination); o.start(actx.currentTime + t); o.stop(actx.currentTime + t + 0.25); }); } catch (e) { /* sin audio */ }
  }
  let wake = null;
  async function keepAwake() { if (!S.settings.awake || !S.active || !('wakeLock' in navigator) || wake) return; try { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } catch (e) { wake = null; } }
  function releaseAwake() { if (wake) { wake.release().catch(() => {}); wake = null; } }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { keepAwake(); render(false); } else save(true); });

  setInterval(() => {
    const a = S.active; if (!a) return;
    document.querySelectorAll('[data-live="elapsed"]').forEach((n) => { n.textContent = clock(now() - a.start); });
    if (a.restEnd) {
      const rem = a.restEnd - now();
      const t = document.querySelector('[data-live="rest"]'), b = document.querySelector('[data-live="restbar"]');
      if (t) t.textContent = clock(rem);
      if (b) b.style.transform = 'scaleX(' + clamp(rem / (a.restTotal || 1), 0, 1) + ')';
      if (rem <= 0 && !UI.alarmFired) {
        UI.alarmFired = true; a.restEnd = null; save(); beep(); if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        toast('¡Descanso terminado! A por la siguiente serie'); render(false);
      }
    }
  }, 250);

  /* ---------- inicio ---------- */
  async function init() {
    try {
      const st = await DB.get('state');
      if (st) S = Object.assign(blank(), st);
      else { const ls = localStorage.getItem('hf_state'); if (ls) S = Object.assign(blank(), JSON.parse(ls)); }
    } catch (e) { try { const ls = localStorage.getItem('hf_state'); if (ls) S = Object.assign(blank(), JSON.parse(ls)); } catch (e2) { /* estado nuevo */ } }
    S.settings = Object.assign(blank().settings, S.settings || {});
    applyTheme();
    booted = true;
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    if (!location.hash) location.replace('#/' + (S.profile ? 'hoy' : 'onboarding'));
    render(true);
    if (S.active) keepAwake();
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  init();
})();
