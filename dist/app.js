/* NTS Traffic Logger — application UI and storage. */
'use strict';

// =====================================================================
// Storage
// =====================================================================
const STORE_KEY = 'ntslogger.v1';
const DEFAULT_STORE = {
  version: 1,
  settings: {
    call: '', name: '', city: '', state: '', nextNr: 1,
    zips: '', cities: '',
    theme: 'auto', dayBoundary: 'local', overdueHours: 48, clock: '24'
  },
  nets: [],
  messages: []
};

function normalizeStore(d) {
  const s = JSON.parse(JSON.stringify(DEFAULT_STORE));
  if (d && typeof d === 'object') {
    Object.assign(s.settings, d.settings || {});
    s.nets = Array.isArray(d.nets) ? d.nets : [];
    s.messages = Array.isArray(d.messages) ? d.messages : [];
  }
  s.messages.forEach(m => { m.to = Object.assign({ name: '', street: '', city: '', state: '', zip: '', phone: '', email: '' }, m.to || {}); });
  return s;
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalizeStore(JSON.parse(raw));
  } catch (e) { console.error(e); }
  return normalizeStore(null);
}

let S = loadStore();

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
  catch (e) { toast('Could not save: ' + e.message); }
}

// =====================================================================
// Small helpers
// =====================================================================
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const squash = s => String(s || '').replace(/\s+/g, ' ').trim();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, '0');
const nowIso = () => new Date().toISOString();
const DAY = 86400000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function utcDateStr(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
function utcTimeStr(d) { return pad(d.getUTCHours()) + pad(d.getUTCMinutes()); }
function fmtUtc(iso) { if (!iso) return ''; const d = new Date(iso); return utcDateStr(d) + ' ' + utcTimeStr(d) + 'Z'; }
function fmtUtcShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const s = NTS.MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ' ' + utcTimeStr(d) + 'Z';
  return d.getUTCFullYear() === new Date().getUTCFullYear() ? s : s + ' ' + d.getUTCFullYear();
}
function radioDate(d) { return NTS.MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate(); }
function localTime(d, secs) {
  const opts = { hour: '2-digit', minute: '2-digit', hour12: S.settings.clock === '12' };
  if (secs) opts.second = '2-digit';
  return d.toLocaleTimeString([], opts);
}
function msgNrNum(m) { const n = parseInt(m.nr, 10); return isNaN(n) ? 1e9 : n; }

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
  toast('Copied to clipboard');
}

async function saveTextFile(name, text, mime) {
  const T = window.__TAURI__;
  if (T && T.dialog && T.core) {
    const path = await T.dialog.save({ defaultPath: name });
    if (!path) return false;
    await T.core.invoke('write_text_file', { path, contents: text });
    return true;
  }
  const blob = new Blob([text], { type: mime || 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  return true;
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCsv(rows) { return rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'; }

// ---------- day boundaries (local or UTC per settings) ----------
function useUtcDays() { return S.settings.dayBoundary === 'utc'; }
function dayStart(t) {
  const d = new Date(t);
  return useUtcDays() ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) : new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function makeDay(y, m, d) { return useUtcDays() ? Date.UTC(y, m, d) : new Date(y, m, d).getTime(); }
function parts(t) {
  const d = new Date(t);
  return useUtcDays() ? { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay() }
    : { y: d.getFullYear(), m: d.getMonth(), d: d.getDate(), wd: d.getDay() };
}
function dateInputToStart(v) { if (!v) return null; const [y, m, d] = v.split('-').map(Number); return makeDay(y, m - 1, d); }
function dayLabel(t) { const p = parts(t); return p.y + '-' + pad(p.m + 1) + '-' + pad(p.d); }

// ---------- UTC date/time input ----------
function utcField(key, iso) {
  const d = iso ? new Date(iso) : new Date();
  return `<div class="utc-field" data-utc="${key}">
    <input type="date" class="d" value="${utcDateStr(d)}">
    <input class="t" maxlength="5" value="${utcTimeStr(d)}" placeholder="HHMM" title="UTC time, HHMM">
    <button type="button" class="btn sm" data-utcnow>Now</button></div>`;
}
function readUtc(el) {
  if (!el) return null;
  const dv = $('.d', el).value;
  let tv = $('.t', el).value.replace(/[^0-9]/g, '');
  if (!dv) return null;
  if (tv.length === 3) tv = '0' + tv;
  if (tv.length !== 4) return null;
  const [y, m, d] = dv.split('-').map(Number);
  const h = +tv.slice(0, 2), mi = +tv.slice(2);
  if (h > 23 || mi > 59) return null;
  return new Date(Date.UTC(y, m - 1, d, h, mi)).toISOString();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-utcnow]');
  if (!b) return;
  const f = b.closest('.utc-field'), d = new Date();
  $('.d', f).value = utcDateStr(d);
  $('.t', f).value = utcTimeStr(d);
});

// =====================================================================
// Messages: routing, grouping, descriptions
// =====================================================================
function getMsg(id) { return S.messages.find(m => m.id === id); }
function waitingMsgs() { return S.messages.filter(m => m.status === 'waiting'); }

function zipList() { return String(S.settings.zips || '').split(/[,\s]+/).map(s => s.trim()).filter(Boolean); }
function cityList() { return String(S.settings.cities || '').toUpperCase().split(',').map(squash).filter(Boolean); }

function autoRoute(m) {
  const z = String(m.to.zip || '').slice(0, 5);
  if (z && zipList().some(p => z.startsWith(p))) return 'deliver';
  const city = squash(m.to.city).toUpperCase();
  if (city) {
    const cs = squash(city + ' ' + (m.to.state || '')).toUpperCase();
    if (cityList().some(c => c === cs || c === city)) return 'deliver';
  }
  return 'relay';
}
function routeOf(m) { return m.route === 'deliver' || m.route === 'relay' ? m.route : autoRoute(m); }

function precRank(m) { return (NTS.PREC_RANK[m.prec] ?? 3) + (m.test ? 10 : 0); }
function precShort(p) { return p === 'EMERGENCY' ? 'EMG' : (p || 'R'); }

function sortMsgs(list) {
  return list.slice().sort((a, b) => precRank(a) - precRank(b)
    || String(a.to.zip || '~').localeCompare(String(b.to.zip || '~'))
    || String(a.station).localeCompare(String(b.station))
    || msgNrNum(a) - msgNrNum(b));
}

/**
 * Sort messages into route groups (Deliver, Relay by state) and, within each
 * group, gather messages that share everything but number and address into books.
 */
function groupTraffic(msgs) {
  const groups = new Map();
  for (const m of msgs) {
    const r = routeOf(m);
    const key = r === 'deliver' ? 'D' : 'R:' + (m.to.state || '~');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  const keys = Array.from(groups.keys()).sort((a, b) => (a === 'D' ? -1 : b === 'D' ? 1 : a.localeCompare(b)));
  return keys.map(key => {
    const list = sortMsgs(groups.get(key));
    const byBook = new Map();
    list.forEach(m => { const k = NTS.bookKey(m); if (!byBook.has(k)) byBook.set(k, []); byBook.get(k).push(m); });
    const items = [], done = new Set();
    list.forEach(m => {
      const k = NTS.bookKey(m), members = byBook.get(k);
      if (members.length > 1) {
        if (!done.has(k)) { done.add(k); items.push({ book: members }); }
      } else items.push({ msg: m });
    });
    const st = key.slice(2);
    const label = key === 'D' ? 'Deliver — my area' : (st === '~' ? 'Relay — destination state unknown' : 'Relay — ' + st);
    return { key, label, route: key === 'D' ? 'deliver' : 'relay', items, count: list.length };
  });
}

function sourceText(m) {
  if (m.origin === 'originated') return 'Originated ' + fmtUtcShort(m.originatedUtc);
  const r = m.received || {};
  return 'From ' + (r.from || '?') + (r.net ? ' on ' + r.net : '') + (r.utc ? ' ' + fmtUtcShort(r.utc) : '');
}
function inTime(m) { return m.origin === 'originated' ? m.originatedUtc : (m.received && m.received.utc) || m.created; }
function lastTime(m) { return (m.status !== 'waiting' && m.disp && m.disp.utc) || inTime(m); }

function dispText(m) {
  const d = m.disp || {};
  if (m.status === 'relayed') return 'Relayed to ' + (d.to || '?') + (d.net ? ' on ' + d.net : '') + ' ' + fmtUtcShort(d.utc);
  if (m.status === 'delivered') return 'Delivered' + (d.method ? ' by ' + d.method.toLowerCase() : '') + (d.to ? ' to ' + d.to : '') + ' ' + fmtUtcShort(d.utc);
  if (m.status === 'serviced') return 'Undeliverable' + (d.reason ? ' (' + d.reason.toLowerCase() + ')' : '') + (d.to ? ', service msg to ' + d.to : '') + ' ' + fmtUtcShort(d.utc);
  return 'Waiting';
}
function statusBadge(m) {
  const map = { waiting: ['warn', 'Waiting'], relayed: ['acc', 'Relayed'], delivered: ['ok', 'Delivered'], serviced: ['bad', 'Undeliverable'] };
  const [c, l] = map[m.status] || ['', m.status];
  return `<span class="badge ${c}">${l}</span>`;
}
function destText(m) { return [m.to.city, m.to.state, m.to.zip].filter(Boolean).join(' '); }
function hoursWaiting(m) { const t = inTime(m); return t ? Math.max(0, Math.floor((Date.now() - new Date(t)) / 3600000)) : 0; }
function ageText(h) { return h < 1 ? 'new' : h < 48 ? h + 'h' : Math.floor(h / 24) + 'd'; }

// =====================================================================
// Modals
// =====================================================================
function openModal({ title, body, foot, cls }) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${cls || ''}" role="dialog" aria-modal="true">
    <div class="modal-head"><h2>${title}</h2><button class="x" data-close aria-label="Close">×</button></div>
    <div class="modal-body">${body}</div>
    ${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
  $('#modal-root').appendChild(back);
  back.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(back); });
  const first = $('input:not([type=checkbox]):not([type=radio]), select, textarea', back);
  if (first) setTimeout(() => first.focus(), 30);
  return back;
}
function closeModal(el) { if (el && el.parentNode) el.remove(); }
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { const all = $$('#modal-root .modal-back'); if (all.length) closeModal(all[all.length - 1]); }
});

function askConfirm(title, message, okLabel, danger) {
  return new Promise(resolve => {
    const el = openModal({
      title: esc(title), cls: 'narrow', body: `<p style="margin:0">${message}</p>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(okLabel || 'OK')}</button>`
    });
    let done = false;
    $('[data-ok]', el).addEventListener('click', () => { done = true; closeModal(el); resolve(true); });
    new MutationObserver((_, obs) => { if (!el.isConnected) { obs.disconnect(); if (!done) resolve(false); } })
      .observe($('#modal-root'), { childList: true });
  });
}

// =====================================================================
// Message form (single entry and edit)
// =====================================================================
function blankMessage() {
  return {
    id: '', nr: '', test: false, prec: 'R', hx: '', station: '', check: '', place: '', time: '', date: '',
    to: { name: '', street: '', city: '', state: '', zip: '', phone: '', email: '' },
    text: '', sig: '', opNote: '', route: 'auto', origin: 'received',
    received: { from: '', net: '', utc: null }, originatedUtc: null, status: 'waiting', disp: null
  };
}

function msgFormHtml(m, opts) {
  opts = opts || {};
  const r = m.received || {};
  const d = m.disp || {};
  const calc = NTS.computeCheck(m.text);
  const precOpt = (v, l) => `<option value="${v}" ${m.prec === v ? 'selected' : ''}>${l}</option>`;
  return `<form class="msgform" autocomplete="off" onsubmit="return false">
    ${opts.showSource ? `<fieldset>
      <legend>Source</legend>
      <div class="radio-row" style="margin-bottom:10px">
        <label><input type="radio" name="origin" value="received" ${m.origin !== 'originated' ? 'checked' : ''}> Received from another station</label>
        <label><input type="radio" name="origin" value="originated" ${m.origin === 'originated' ? 'checked' : ''}> I originated this message</label>
      </div>
      <div class="form-grid src-recv ${m.origin === 'originated' ? 'hidden' : ''}">
        <label class="f c3">Received from (callsign)<input class="up" data-f="r.from" list="dl-stations" value="${esc(r.from)}"></label>
        <label class="f c4">Net<input data-f="r.net" list="dl-nets" value="${esc(r.net)}"></label>
        <div class="c5"><label class="f">Received (UTC date / time)</label>${utcField('recv', r.utc)}</div>
      </div>
      <div class="form-grid src-orig ${m.origin === 'originated' ? '' : 'hidden'}">
        <div class="c5"><label class="f">Originated (UTC date / time)</label>${utcField('orig', m.originatedUtc)}</div>
      </div>
    </fieldset>` : ''}
    <fieldset>
      <legend>Preamble</legend>
      <div class="preamble-grid">
        <label class="f">Number<input class="up mono" data-f="nr" value="${esc(m.nr)}"></label>
        <label class="f">Precedence<select data-f="prec">${precOpt('R', 'R — Routine')}${precOpt('W', 'W — Welfare')}${precOpt('P', 'P — Priority')}${precOpt('EMERGENCY', 'EMERGENCY')}</select></label>
        <label class="f">HX<input class="up mono" data-f="hx" value="${esc(m.hx)}" placeholder="HXG"></label>
        <label class="f">Station of origin<input class="up mono" data-f="station" value="${esc(m.station)}"></label>
        <label class="f">Check<input class="up mono" data-f="check" value="${esc(m.check)}"></label>
        <label class="f">Place of origin<input class="up" data-f="place" value="${esc(m.place)}"></label>
        <label class="f">Time<input class="up mono" data-f="time" value="${esc(m.time)}" placeholder="1830Z"></label>
        <label class="f">Date<input class="up mono" data-f="date" value="${esc(m.date)}" placeholder="NOV 11"></label>
        <div class="span-all small check-hint"></div>
        <label class="span-all check-box small muted"><input type="checkbox" data-f="test" ${m.test ? 'checked' : ''}> TEST message</label>
      </div>
    </fieldset>
    <fieldset>
      <legend>Address</legend>
      <div class="form-grid">
        <label class="f c6">Name<input class="up" data-f="to.name" value="${esc(m.to.name)}"></label>
        <label class="f c6">Street<textarea class="up" rows="1" data-f="to.street">${esc(m.to.street)}</textarea></label>
        <label class="f c4">City<input class="up" data-f="to.city" value="${esc(m.to.city)}"></label>
        <label class="f c1">State<input class="up" data-f="to.state" maxlength="2" value="${esc(m.to.state)}"></label>
        <label class="f c2">ZIP<input class="mono" data-f="to.zip" value="${esc(m.to.zip)}"></label>
        <label class="f c2">Phone<input class="mono" data-f="to.phone" value="${esc(m.to.phone)}"></label>
        <label class="f c3">Email<input data-f="to.email" value="${esc(m.to.email)}"></label>
      </div>
    </fieldset>
    <fieldset>
      <legend>Text <span class="muted small word-count"></span></legend>
      <textarea class="up msgtext" data-f="text" spellcheck="false">${esc(m.text)}</textarea>
      <div class="form-grid" style="margin-top:10px">
        <label class="f c6">Signature<textarea class="up" rows="2" data-f="sig">${esc(m.sig)}</textarea></label>
        <label class="f c6">Op note<textarea class="up" rows="2" data-f="opNote">${esc(m.opNote)}</textarea></label>
      </div>
    </fieldset>
    <div class="form-grid">
      <label class="f c4">Sort under<select data-f="route">
        <option value="auto" ${!m.route || m.route === 'auto' ? 'selected' : ''}>Automatic (by delivery area)</option>
        <option value="deliver" ${m.route === 'deliver' ? 'selected' : ''}>Deliver — I will deliver it</option>
        <option value="relay" ${m.route === 'relay' ? 'selected' : ''}>Relay — pass it on</option>
      </select></label>
    </div>
    ${opts.showDisp && m.status !== 'waiting' ? `<fieldset style="margin-top:12px">
      <legend>${m.status === 'relayed' ? 'Relayed' : m.status === 'delivered' ? 'Delivered' : 'Undeliverable'}</legend>
      <div class="form-grid">
        <label class="f c3">${m.status === 'delivered' ? 'Delivered to' : 'Station'}<input class="${m.status === 'delivered' ? '' : 'up'}" data-f="d.to" value="${esc(d.to)}"></label>
        ${m.status === 'delivered' ? `<label class="f c3">Method<select data-f="d.method">${DELIVERY_METHODS.map(x => `<option ${x === d.method ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`
        : `<label class="f c3">Net<input data-f="d.net" list="dl-nets" value="${esc(d.net)}"></label>`}
        <div class="c6"><label class="f">UTC date / time</label>${utcField('disp', d.utc)}</div>
        <label class="f c12">Note<input data-f="d.note" value="${esc(d.note)}"></label>
      </div>
    </fieldset>` : ''}
  </form>`;
}

function bindMsgForm(root, opts) {
  opts = opts || {};
  const f = k => $(`[data-f="${k}"]`, root);
  const checkEl = f('check'), textEl = f('text');
  let checkTouched = !!opts.keepCheck;
  const update = () => {
    const calc = NTS.computeCheck(textEl.value.toUpperCase());
    const words = NTS.textWords(textEl.value).length;
    $('.word-count', root).textContent = '— ' + words + ' word' + (words === 1 ? '' : 's');
    if (!checkTouched) checkEl.value = textEl.value.trim() ? calc : '';
    const given = NTS.normCheck(checkEl.value);
    const hint = $('.check-hint', root);
    if (given && textEl.value.trim() && given !== calc) {
      hint.innerHTML = `<span class="badge warn">Check ${esc(given)} does not match the text — counted ${esc(calc)}</span> <button type="button" class="btn sm" data-usecalc>Use ${esc(calc)}</button>`;
    } else hint.innerHTML = textEl.value.trim() ? `<span class="muted">Check counted from text: ${esc(calc)}</span>` : '';
  };
  textEl.addEventListener('input', update);
  checkEl.addEventListener('input', () => { checkTouched = !!checkEl.value.trim(); update(); });
  root.addEventListener('click', e => {
    if (e.target.closest('[data-usecalc]')) { checkTouched = false; checkEl.value = ''; update(); }
  });
  $$('input[name=origin]', root).forEach(rb => rb.addEventListener('change', () => {
    const orig = $('input[name=origin]:checked', root).value === 'originated';
    $('.src-recv', root).classList.toggle('hidden', orig);
    $('.src-orig', root).classList.toggle('hidden', !orig);
    if (orig) {
      const d = new Date();
      if (!f('nr').value) f('nr').value = S.settings.nextNr || 1;
      if (!f('station').value) f('station').value = S.settings.call || '';
      if (!f('place').value) f('place').value = squash((S.settings.city || '') + ' ' + (S.settings.state || ''));
      if (!f('time').value) f('time').value = utcTimeStr(d) + 'Z';
      if (!f('date').value) f('date').value = radioDate(d);
    }
  }));
  update();
}

function readMsgForm(root, base) {
  const f = k => $(`[data-f="${k}"]`, root);
  const v = k => { const el = f(k); return el ? el.value : undefined; };
  const U = k => squash(v(k)).toUpperCase();
  const m = JSON.parse(JSON.stringify(base));
  m.nr = U('nr'); m.prec = v('prec'); m.hx = U('hx'); m.station = U('station');
  m.place = U('place'); m.time = U('time'); m.date = U('date');
  m.test = f('test').checked;
  m.to = {
    name: U('to.name'), street: String(v('to.street') || '').toUpperCase().split('\n').map(squash).filter(Boolean).join('\n'),
    city: U('to.city'), state: U('to.state'), zip: squash(v('to.zip')), phone: squash(v('to.phone')), email: /\bAT\s?SIGN\b/i.test(v('to.email')) ? squash(v('to.email')).toUpperCase() : squash(v('to.email')).toLowerCase()
  };
  m.text = U('text');
  m.sig = String(v('sig') || '').toUpperCase().split('\n').map(squash).filter(Boolean).join('\n');
  m.opNote = U('opNote');
  m.route = v('route') || 'auto';
  m.checkCalc = NTS.computeCheck(m.text);
  m.check = NTS.normCheck(U('check')) || m.checkCalc;
  m.checkMismatch = !!m.text && m.check !== m.checkCalc;
  const originEl = $('input[name=origin]:checked', root);
  if (originEl) {
    m.origin = originEl.value;
    if (m.origin === 'originated') { m.originatedUtc = readUtc($('[data-utc=orig]', root)) || nowIso(); m.received = null; }
    else { m.received = { from: U('r.from'), net: squash(v('r.net')), utc: readUtc($('[data-utc=recv]', root)) || nowIso() }; m.originatedUtc = null; }
  }
  if (m.status !== 'waiting' && f('d.to')) {
    m.disp = Object.assign({}, m.disp || {}, {
      to: m.status === 'delivered' ? squash(v('d.to')) : U('d.to'),
      utc: readUtc($('[data-utc=disp]', root)) || (m.disp && m.disp.utc) || nowIso(),
      note: squash(v('d.note'))
    });
    if (f('d.net')) m.disp.net = squash(v('d.net'));
    if (f('d.method')) m.disp.method = v('d.method');
  }
  const errors = [];
  if (!m.nr) errors.push('Message number is required');
  if (!m.to.name) errors.push('Addressee name is required');
  if (!m.text) errors.push('Message text is required');
  return { msg: m, errors };
}

function bumpNextNr(m) {
  if (m.origin !== 'originated') return;
  const n = parseInt(m.nr, 10);
  if (!isNaN(n) && n >= (parseInt(S.settings.nextNr, 10) || 1)) S.settings.nextNr = n + 1;
}

// =====================================================================
// Message view / edit / disposition
// =====================================================================
const DELIVERY_METHODS = ['Phone', 'Email', 'In person', 'Mail / postcard', 'Text message', 'Radio', 'Other'];
const SERVICE_REASONS = ['Bad address', 'No phone / wrong number', 'Unable to reach addressee', 'Addressee refused', 'Other'];

function historyHtml(m) {
  const items = [];
  if (m.origin === 'originated') items.push(`<li><b>Originated</b> ${esc(fmtUtc(m.originatedUtc))}</li>`);
  else {
    const r = m.received || {};
    items.push(`<li><b>Received</b> from <b>${esc(r.from || '?')}</b>${r.net ? ' on ' + esc(r.net) : ''} at ${esc(fmtUtc(r.utc))}</li>`);
  }
  if (m.status !== 'waiting' && m.disp) {
    const d = m.disp;
    let s = '';
    if (m.status === 'relayed') s = `<b>Relayed</b> to <b>${esc(d.to || '?')}</b>${d.net ? ' on ' + esc(d.net) : ''} at ${esc(fmtUtc(d.utc))}`;
    if (m.status === 'delivered') s = `<b>Delivered</b>${d.method ? ' by ' + esc(d.method.toLowerCase()) : ''}${d.to ? ' to <b>' + esc(d.to) + '</b>' : ''} at ${esc(fmtUtc(d.utc))}`;
    if (m.status === 'serviced') s = `<b>Undeliverable</b>${d.reason ? ' — ' + esc(d.reason) : ''}${d.to ? '; service message to <b>' + esc(d.to) + '</b>' : ''}${d.net ? ' on ' + esc(d.net) : ''} at ${esc(fmtUtc(d.utc))}`;
    if (d.note) s += ` <span class="muted">— ${esc(d.note)}</span>`;
    items.push(`<li>${s}</li>`);
  } else {
    const h = hoursWaiting(m);
    items.push(`<li><span class="badge ${h >= S.settings.overdueHours ? 'bad' : 'warn'}">Waiting ${ageText(h)}</span> — sorted under <b>${routeOf(m) === 'deliver' ? 'Deliver' : 'Relay'}</b></li>`);
  }
  return `<ul class="history">${items.join('')}</ul>`;
}

function openView(id) {
  const m = getMsg(id);
  if (!m) return;
  const waiting = m.status === 'waiting';
  const el = openModal({
    title: `NR ${esc(m.nr)} <span class="prec prec-${m.prec}">${esc(precShort(m.prec))}</span> ${statusBadge(m)}`,
    body: `${m.checkMismatch ? `<p style="margin:0 0 8px"><span class="badge warn">Check ${esc(m.check)} — counted ${esc(m.checkCalc || NTS.computeCheck(m.text))}</span></p>` : ''}
      <pre class="radiogram">${esc(NTS.formatRadiogram(m))}</pre>
      <h3 style="margin:14px 0 4px">History</h3>${historyHtml(m)}`,
    foot: `<div class="left"><button class="btn danger" data-a="delete">Delete</button>${!waiting ? '<button class="btn" data-a="unclose">Return to waiting</button>' : ''}</div>
      <button class="btn" data-a="copy">Copy</button><button class="btn" data-a="edit">Edit</button>
      ${waiting ? '<button class="btn" data-a="service">Undeliverable…</button><button class="btn primary" data-a="relay">Relay…</button><button class="btn primary" data-a="deliver">Deliver…</button>' : ''}`
  });
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'copy') return copyText(NTS.formatRadiogram(m));
    if (a === 'edit') { closeModal(el); return openEdit(id); }
    if (a === 'relay' || a === 'deliver' || a === 'service') { closeModal(el); return openDisposition(a, [id]); }
    if (a === 'unclose') {
      if (await askConfirm('Return to waiting', `Put NR ${esc(m.nr)} back on the waiting list? The ${m.status === 'relayed' ? 'relay' : 'delivery'} record will be cleared.`, 'Return to waiting')) {
        m.status = 'waiting'; m.disp = null; save(); closeModal(el); renderAll(); toast('Returned to waiting');
      }
    }
    if (a === 'delete') {
      if (await askConfirm('Delete message', `Delete NR ${esc(m.nr)} to ${esc(m.to.name)} from the log? It will no longer count in reports.`, 'Delete', true)) {
        S.messages = S.messages.filter(x => x.id !== id); sel.delete(id); save(); closeModal(el); renderAll(); toast('Message deleted');
      }
    }
  });
}

function openEdit(id, onSaved) {
  const m = getMsg(id) || (pendingImport && pendingImport.find(x => x.id === id));
  if (!m) return;
  const inPreview = !getMsg(id);
  const el = openModal({
    title: `Edit NR ${esc(m.nr)}`, cls: 'wide',
    body: msgFormHtml(m, { showSource: !inPreview, showDisp: !inPreview }) + '<div class="form-errors"></div>',
    foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save</button>`
  });
  bindMsgForm(el, { keepCheck: true });
  $('[data-save]', el).addEventListener('click', () => {
    const { msg, errors } = readMsgForm(el, m);
    if (errors.length) { $('.form-errors', el).innerHTML = `<ul class="warnlist">${errors.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`; return; }
    msg.warnings = (m.warnings || []).filter(w => !/check|address|signature|BT|text|date/i.test(w));
    if (msg.checkMismatch) msg.warnings.push('Check ' + msg.check + ' does not match counted ' + msg.checkCalc);
    Object.assign(m, msg);
    if (!inPreview) { bumpNextNr(m); save(); renderAll(); toast('Saved'); }
    closeModal(el);
    if (onSaved) onSaved(m);
  });
}

function openDisposition(kind, ids) {
  const msgs = ids.map(getMsg).filter(Boolean);
  if (!msgs.length) return;
  const n = msgs.length;
  const title = (kind === 'relay' ? 'Relay ' : kind === 'deliver' ? 'Deliver ' : 'Undeliverable — ') + (n === 1 ? 'NR ' + esc(msgs[0].nr) : n + ' messages');
  const list = `<div class="small muted" style="margin-bottom:10px;max-height:120px;overflow:auto">${msgs.map(m =>
    `<div><span class="mono">NR ${esc(m.nr)}</span> → ${esc(m.to.name)}${destText(m) ? ', ' + esc(destText(m)) : ''}${m.to.phone ? ' · ' + esc(m.to.phone) : ''}</div>`).join('')}</div>`;
  let fields = '';
  if (kind === 'relay') {
    fields = `<div class="form-grid">
      <label class="f c4">Relayed to (callsign)<input class="up" data-f="to" list="dl-stations"></label>
      <label class="f c4">Net<input data-f="net" list="dl-nets"></label>
      <div class="c4"><label class="f">UTC date / time</label>${utcField('when')}</div>
      <label class="f c12">Note<input data-f="note"></label></div>`;
  } else if (kind === 'deliver') {
    fields = `<div class="form-grid">
      <label class="f c4">Delivered to<input data-f="to" value="${n === 1 ? esc(msgs[0].to.name) : ''}" placeholder="${n === 1 ? '' : 'Each addressee'}"></label>
      <label class="f c4">Method<select data-f="method">${DELIVERY_METHODS.map(x => `<option>${x}</option>`).join('')}</select></label>
      <div class="c4"><label class="f">UTC date / time</label>${utcField('when')}</div>
      <label class="f c12">Note<input data-f="note" placeholder="e.g. left voicemail, spoke with spouse"></label></div>`;
  } else {
    fields = `<div class="form-grid">
      <label class="f c4">Reason<select data-f="reason">${SERVICE_REASONS.map(x => `<option>${x}</option>`).join('')}</select></label>
      <label class="f c4">Service message sent to<input class="up" data-f="to" list="dl-stations" placeholder="Originating station"></label>
      <label class="f c4">Net<input data-f="net" list="dl-nets"></label>
      <div class="c6"><label class="f">UTC date / time</label>${utcField('when')}</div>
      <label class="f c12">Note<input data-f="note"></label></div>`;
  }
  const el = openModal({
    title, body: list + fields + '<div class="form-errors"></div>',
    foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" data-ok>${kind === 'relay' ? 'Log as relayed' : kind === 'deliver' ? 'Log as delivered' : 'Log as undeliverable'}</button>`
  });
  if (kind === 'deliver' && n === 1 && msgs[0].to.phone) $('[data-f=method]', el).value = 'Phone';
  else if (kind === 'deliver' && n === 1 && msgs[0].to.email) $('[data-f=method]', el).value = 'Email';
  $('[data-ok]', el).addEventListener('click', () => {
    const g = k => { const x = $(`[data-f="${k}"]`, el); return x ? squash(x.value) : ''; };
    const utc = readUtc($('[data-utc=when]', el));
    const errs = [];
    if (!utc) errs.push('Enter a valid UTC date and time (HHMM)');
    if (kind === 'relay' && !g('to')) errs.push('Enter the station you relayed to');
    if (errs.length) { $('.form-errors', el).innerHTML = `<ul class="warnlist">${errs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`; return; }
    msgs.forEach(m => {
      if (kind === 'relay') { m.status = 'relayed'; m.disp = { to: g('to').toUpperCase(), net: g('net'), utc, note: g('note') }; }
      else if (kind === 'deliver') { m.status = 'delivered'; m.disp = { to: g('to') || m.to.name, method: g('method'), utc, note: g('note') }; }
      else { m.status = 'serviced'; m.disp = { reason: g('reason'), to: g('to').toUpperCase(), net: g('net'), utc, note: g('note') }; }
      sel.delete(m.id);
    });
    save(); closeModal(el); renderAll();
    toast((n === 1 ? 'NR ' + msgs[0].nr : n + ' messages') + (kind === 'relay' ? ' logged as relayed' : kind === 'deliver' ? ' logged as delivered' : ' logged as undeliverable'));
  });
}

// =====================================================================
// Header + Dashboard
// =====================================================================
const sel = new Set();

function renderClock() {
  const d = new Date();
  $('#top-clock').innerHTML = `<b>${esc(localTime(d))}</b> local · <b>${utcTimeStr(d)}Z</b> ${utcDateStr(d)}`;
  if ($('#view-dashboard').classList.contains('active')) {
    $('#dash-date').textContent = d.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    $('#dash-local').textContent = localTime(d, true);
    $('#dash-local-tz').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    $('#dash-utc').textContent = pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()) + 'Z';
    $('#dash-utc-date').textContent = d.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) + ' · ' + radioDate(d);
  }
}

function netOccurrences(days) {
  const now = Date.now(), out = [];
  const base = new Date();
  for (const net of S.nets) {
    if (!net.time || !net.days || !net.days.length) continue;
    const [h, mi] = String(net.time).split(':').map(Number);
    if (isNaN(h)) continue;
    const dur = (parseInt(net.dur, 10) || 60) * 60000;
    for (let i = -1; i <= days; i++) {
      let start, wd;
      if (net.tz === 'utc') {
        start = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + i, h, mi || 0);
        wd = new Date(start).getUTCDay();
      } else {
        start = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i, h, mi || 0).getTime();
        wd = new Date(start).getDay();
      }
      if (net.days.includes(wd) && start + dur > now) out.push({ net, start, end: start + dur });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

function renderNets() {
  const ul = $('#dash-nets');
  if (!S.nets.length) {
    ul.innerHTML = `<li class="muted">No nets set up yet. <a href="#" data-goto="settings" data-anchor="nets-anchor">Add the nets you check into</a>.</li>`;
    return;
  }
  const occ = netOccurrences(7).slice(0, 40);
  const keepScroll = ul.scrollTop;
  requestAnimationFrame(() => { ul.scrollTop = keepScroll; });
  if (!occ.length) { ul.innerHTML = '<li class="muted">No nets scheduled in the next week.</li>'; return; }
  const now = Date.now();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  ul.innerHTML = occ.map(o => {
    const s = new Date(o.start);
    const sd = new Date(s); sd.setHours(0, 0, 0, 0);
    const dd = Math.round((sd - today) / DAY);
    const day = dd === 0 ? 'Today' : dd === 1 ? 'Tomorrow' : s.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    let badge;
    if (o.start <= now) badge = '<span class="badge ok">On now</span>';
    else {
      const mins = Math.round((o.start - now) / 60000);
      const txt = mins < 60 ? 'in ' + mins + 'm' : mins < 24 * 60 ? 'in ' + Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm' : 'in ' + Math.round(mins / 1440) + 'd';
      badge = `<span class="badge ${mins <= 60 ? 'warn' : ''}">${txt}</span>`;
    }
    return `<li><div class="net-when">${esc(localTime(s))}<span class="day">${day} · ${utcTimeStr(s)}Z</span></div>
      <div><div class="net-name">${esc(o.net.name || 'Unnamed net')}</div><div class="net-meta">${esc([o.net.freq, o.net.notes].filter(Boolean).join(' · '))}</div></div>
      <div class="net-badge">${badge}</div></li>`;
  }).join('');
}

function eventsBetween(from, to) {
  const ev = [];
  const inR = iso => { if (!iso) return false; const t = new Date(iso).getTime(); return t >= from && t < to; };
  for (const m of S.messages) {
    if (m.origin === 'originated') { if (inR(m.originatedUtc)) ev.push({ type: 'orig', t: m.originatedUtc, m, station: '', net: '' }); }
    else if (m.received && inR(m.received.utc)) ev.push({ type: 'rcvd', t: m.received.utc, m, station: m.received.from, net: m.received.net });
    if (m.status !== 'waiting' && m.disp && inR(m.disp.utc)) {
      const type = m.status === 'relayed' ? 'sent' : m.status === 'delivered' ? 'dlvd' : 'svc';
      ev.push({ type, t: m.disp.utc, m, station: m.disp.to, net: m.disp.net || '', method: m.disp.method || '' });
    }
  }
  return ev.sort((a, b) => new Date(a.t) - new Date(b.t));
}
function countEvents(ev) {
  const c = { orig: 0, rcvd: 0, sent: 0, dlvd: 0, svc: 0 };
  ev.forEach(e => c[e.type]++);
  c.total = c.orig + c.rcvd + c.sent + c.dlvd;
  return c;
}

function renderTiles() {
  const w = waitingMsgs();
  const relay = w.filter(m => routeOf(m) === 'relay').length;
  const deliver = w.length - relay;
  const hot = w.filter(m => m.prec === 'P' || m.prec === 'EMERGENCY').length;
  const overdue = w.filter(m => hoursWaiting(m) >= S.settings.overdueHours).length;
  const t0 = dayStart(Date.now());
  const c = countEvents(eventsBetween(t0, t0 + DAY));
  const tile = (num, lbl, cls) => `<div class="tile ${cls || ''}"><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`;
  $('#dash-tiles').innerHTML =
    tile(relay, 'Waiting to relay', relay ? 'accent' : '') +
    tile(deliver, 'Waiting to deliver', deliver ? 'accent' : '') +
    tile(hot, 'Priority / Emergency', hot ? 'hot' : '') +
    tile(overdue, `Waiting ${S.settings.overdueHours}h or more`, overdue ? 'hot' : '') +
    tile(c.rcvd, 'Received today') + tile(c.sent, 'Relayed today') + tile(c.dlvd, 'Delivered today') + tile(c.orig, 'Originated today');
}

function rowHtml(m, nrLine) {
  const h = hoursWaiting(m);
  const over = h >= S.settings.overdueHours;
  return `<div class="msg-row" data-id="${m.id}">
    <input type="checkbox" class="sel" ${sel.has(m.id) ? 'checked' : ''} aria-label="Select NR ${esc(m.nr)}">
    <span class="prec prec-${m.prec}" title="Precedence">${esc(precShort(m.prec))}</span>
    <span class="nr">${esc(m.nr)}</span>
    <div class="dest">
      <div class="who">${esc(m.to.name || '(no name)')}${m.to.phone ? ' <span class="muted small mono">' + esc(m.to.phone) + '</span>' : ''}${m.checkMismatch ? ' <span class="badge warn">check?</span>' : ''}${m.test ? ' <span class="badge">TEST</span>' : ''}</div>
      <div class="where">${nrLine ? '<span class="mono">' + esc(nrLine) + '</span> · ' : ''}${esc(destText(m) || 'no city / state')} · ${nrLine ? '' : esc(m.station) + ' ' + esc(m.place) + ' · '}${esc(sourceText(m))}</div>
    </div>
    <div class="acts"><span class="badge ${over ? 'bad' : ''}" title="Time waiting">${ageText(h)}</span>
      <button class="btn sm" data-act="relay">Relay</button><button class="btn sm" data-act="deliver">Deliver</button></div>
  </div>`;
}

function renderWaiting() {
  const q = squash($('#wait-search').value).toUpperCase();
  let w = waitingMsgs();
  if (q) w = w.filter(m => [m.nr, m.station, m.place, m.to.name, m.to.city, m.to.state, m.to.zip, m.text, m.received && m.received.from, m.received && m.received.net].join(' ').toUpperCase().includes(q));
  for (const id of Array.from(sel)) { const m = getMsg(id); if (!m || m.status !== 'waiting') sel.delete(id); }
  const host = $('#wait-list');
  if (!w.length) {
    host.innerHTML = `<div class="empty">${q ? 'Nothing matches the filter.' : 'No traffic waiting. Use <a href="#" data-goto="entry">Enter Traffic</a> to paste or type messages.'}</div>`;
  } else {
    host.innerHTML = groupTraffic(w).map(g => `<div class="group">
      <div class="group-head"><span>${esc(g.label)}</span><span class="count">${g.count} message${g.count === 1 ? '' : 's'}</span></div>
      ${g.items.map(it => it.msg ? rowHtml(it.msg) : bookHtml(it.book, g.route)).join('')}
    </div>`).join('');
  }
  updateSelButtons();
}

function bookHtml(members, route) {
  const f = members[0];
  const ids = members.map(m => m.id).join(',');
  const varying = NTS.bookVarying(members);
  return `<div class="book" data-ids="${ids}">
    <div class="book-head"><span class="title">BOOK OF ${members.length}</span>
      <span class="pre">${esc(NTS.bookCommon(members))}</span><span class="spacer" style="flex:1"></span>
      <button class="btn sm" data-bookact="copy">Copy as book</button>
      <button class="btn sm" data-bookact="select">Select</button>
      <button class="btn sm primary" data-bookact="${route === 'deliver' ? 'deliver' : 'relay'}">${route === 'deliver' ? 'Deliver all…' : 'Relay book…'}</button></div>
    <div class="book-text">${esc(f.text)}${f.sig ? ' — ' + esc(f.sig.replace(/\n/g, ' ')) : ''}</div>
    ${members.map(m => rowHtml(m, NTS.bookNrLine(m, varying))).join('')}
  </div>`;
}

function updateSelButtons() {
  const n = sel.size;
  ['#wait-relay', '#wait-deliver', '#wait-service'].forEach(s => { $(s).disabled = !n; });
  $('#wait-relay').textContent = n ? `Relay ${n}…` : 'Relay selected…';
  $('#wait-deliver').textContent = n ? `Deliver ${n}…` : 'Deliver selected…';
}

function renderDashboard() {
  renderClock(); renderNets(); renderTiles(); renderWaiting();
}

// =====================================================================
// Paste / import
// =====================================================================
let pendingImport = null;
let pendingIgnored = [];

function pasteOrigin() { return $('input[name=paste-origin]:checked').value; }

function parsePaste() {
  const raw = $('#paste-text').value;
  if (!raw.trim()) { toast('Paste some traffic first'); return; }
  const res = NTS.parseTraffic(raw);
  const existing = new Set(S.messages.map(m => [m.nr, m.station, m.date].join('|')));
  const seen = new Set();
  pendingImport = res.messages.map(p => {
    const m = Object.assign(blankMessage(), p, { id: uid() });
    const key = [m.nr, m.station, m.date].join('|');
    m.include = true;
    if (existing.has(key)) { m.include = false; m.warnings = (m.warnings || []).concat('Already in your log — skipped'); }
    else if (seen.has(key)) { m.include = false; m.warnings = (m.warnings || []).concat('Duplicate in this paste — skipped'); }
    seen.add(key);
    return m;
  });
  pendingIgnored = res.ignored;
  renderPreview();
}

function renderPreview() {
  const host = $('#paste-preview');
  if (!pendingImport) { host.classList.add('hidden'); return; }
  host.classList.remove('hidden');
  if (!pendingImport.length) {
    host.innerHTML = `<h2>Nothing recognized</h2><p class="muted">No radiogram preambles were found. Each message needs to start with a preamble such as <span class="mono">NR 123 R W1AW 15 NEWINGTON CT NOV 10</span>.</p>`;
    return;
  }
  const inc = pendingImport.filter(m => m.include);
  const groups = groupTraffic(inc);
  const books = groups.reduce((a, g) => a + g.items.filter(i => i.book).length, 0);
  const needs = inc.filter(m => (m.warnings || []).length).length;
  const relay = inc.filter(m => routeOf(m) === 'relay').length;
  let bookNo = 0;
  const rows = [];
  groups.forEach(g => {
    rows.push(`<tr><td colspan="9" style="background:var(--panel-2);font-weight:650">${esc(g.label)} <span class="muted small">(${g.count})</span></td></tr>`);
    g.items.forEach(it => {
      const list = it.msg ? [it.msg] : it.book;
      const tag = it.book ? `<span class="badge acc">Book ${String.fromCharCode(65 + (bookNo++ % 26))}</span>` : '';
      list.forEach(m => rows.push(previewRow(m, tag)));
    });
  });
  pendingImport.filter(m => !m.include).forEach(m => rows.push(previewRow(m, '')));
  host.innerHTML = `
    <div class="panel-head"><h2>Preview</h2><span class="spacer"></span>
      <span class="muted">${inc.length} message${inc.length === 1 ? '' : 's'} · ${relay} to relay · ${inc.length - relay} to deliver · ${books} book${books === 1 ? '' : 's'}${needs ? ` · <span style="color:var(--warn)">${needs} to check</span>` : ''}</span>
      <button class="btn primary" id="paste-commit" ${inc.length ? '' : 'disabled'}>Add ${inc.length} to Waiting</button></div>
    ${pendingIgnored.length ? `<details style="margin-bottom:10px"><summary class="small" style="color:var(--warn);cursor:pointer">${pendingIgnored.length} line${pendingIgnored.length === 1 ? ' was' : 's were'} not part of any message</summary><pre class="radiogram small" style="margin-top:6px">${esc(pendingIgnored.join('\n'))}</pre></details>` : ''}
    <div class="table-wrap"><table class="t"><thead><tr><th></th><th>Book</th><th>NR</th><th>Prec</th><th>Origin</th><th>Check</th><th>To</th><th>Text</th><th></th></tr></thead>
    <tbody>${rows.join('')}</tbody></table></div>
    <p class="hint">Click a row to correct it. Messages that share the same preamble, text and signature and go the same way are grouped into books automatically.</p>`;
}

function previewRow(m, tag) {
  const w = m.warnings || [];
  const words = NTS.textWords(m.text);
  return `<tr class="click ${m.include ? '' : 'excluded'}" data-pid="${m.id}">
    <td><input type="checkbox" class="pinc" ${m.include ? 'checked' : ''} aria-label="Include"></td>
    <td>${tag}</td>
    <td class="mono">${esc(m.nr)}</td>
    <td><span class="prec prec-${m.prec}">${esc(precShort(m.prec))}</span> <span class="small mono">${esc(m.hx)}</span></td>
    <td class="small">${esc(m.station)}<br><span class="muted">${esc([m.place, m.time, m.date].filter(Boolean).join(' '))}</span></td>
    <td class="mono">${esc(m.check)}${m.checkMismatch ? `<br><span class="badge warn">counted ${esc(m.checkCalc)}</span>` : ''}</td>
    <td class="small"><b>${esc(m.to.name)}</b><br>${esc(m.to.street.replace(/\n/g, ', '))}${m.to.street ? '<br>' : ''}${esc(destText(m))}${m.to.phone ? '<br><span class="mono">' + esc(m.to.phone) + '</span>' : ''}</td>
    <td class="small mono">${esc(words.slice(0, 10).join(' '))}${words.length > 10 ? ' …' : ''}<br><span class="muted">${esc((m.sig || '').replace(/\n/g, ' '))}</span>
      ${w.length ? `<ul class="warnlist">${w.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</td>
    <td><button class="btn sm" data-pedit>Edit</button></td></tr>`;
}

function commitPaste() {
  if (!pendingImport) return;
  const origin = pasteOrigin();
  const from = squash($('#paste-from').value).toUpperCase();
  const net = squash($('#paste-net').value);
  const utc = readUtc($('#paste-utc .utc-field'));
  if (!utc) { toast('Enter a valid UTC date and time'); return; }
  const inc = pendingImport.filter(m => m.include);
  if (origin === 'received' && !from && !confirmNoFrom()) return;
  const created = nowIso();
  inc.forEach(p => {
    const m = Object.assign({}, p);
    delete m.include; delete m.importBook; delete m.fromBook;
    m.origin = origin;
    if (origin === 'originated') { m.originatedUtc = utc; m.received = null; bumpNextNr(m); }
    else { m.received = { from, net, utc }; m.originatedUtc = null; }
    m.status = 'waiting'; m.disp = null; m.created = created;
    S.messages.push(m);
  });
  save();
  pendingImport = null; pendingIgnored = [];
  $('#paste-text').value = '';
  renderPreview();
  renderAll();
  toast(inc.length + ' message' + (inc.length === 1 ? '' : 's') + ' added to Waiting');
  showView('dashboard');
}
let warnedNoFrom = false;
function confirmNoFrom() {
  if (warnedNoFrom) return true;
  warnedNoFrom = true;
  toast('Tip: fill in "Received from" — click Add again to save without it');
  $('#paste-from').focus();
  return false;
}

// =====================================================================
// Single radiogram entry
// =====================================================================
let singleBase = null;
function renderSingle(keep) {
  const host = $('#single-form-host');
  const base = blankMessage();
  if (keep) {
    base.origin = keep.origin;
    if (keep.received) base.received = { from: keep.received.from, net: keep.received.net, utc: keep.received.utc };
  }
  if (base.origin === 'originated') {
    const d = new Date();
    Object.assign(base, { nr: String(S.settings.nextNr || 1), station: S.settings.call || '', place: squash((S.settings.city || '') + ' ' + (S.settings.state || '')), time: utcTimeStr(d) + 'Z', date: radioDate(d) });
  }
  singleBase = base;
  host.innerHTML = `<div class="panel-head"><h2>Single radiogram</h2></div>${msgFormHtml(base, { showSource: true })}
    <div class="form-errors"></div>
    <div class="btn-row" style="margin-top:12px">
      <button class="btn primary" data-s="wait">Save to Waiting</button>
      <button class="btn" data-s="relay">Save &amp; log relayed…</button>
      <button class="btn" data-s="deliver">Save &amp; log delivered…</button>
      <span class="spacer" style="flex:1"></span>
      <button class="btn" data-s="clear">Clear</button>
    </div>`;
  bindMsgForm(host);
}
function saveSingle(action) {
  const host = $('#single-form-host');
  if (action === 'clear') return renderSingle();
  const { msg, errors } = readMsgForm(host, singleBase);
  if (errors.length) { $('.form-errors', host).innerHTML = `<ul class="warnlist">${errors.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`; return; }
  msg.id = uid(); msg.status = 'waiting'; msg.disp = null; msg.created = nowIso(); msg.warnings = [];
  S.messages.push(msg);
  bumpNextNr(msg);
  save();
  renderAll();
  renderSingle(msg);
  toast('NR ' + msg.nr + ' saved');
  if (action === 'relay' || action === 'deliver') openDisposition(action, [msg.id]);
}

// =====================================================================
// Log
// =====================================================================
function logRows() {
  const st = $('#log-status').value;
  const q = squash($('#log-search').value).toUpperCase();
  const from = dateInputToStart($('#log-from').value);
  const toStart = dateInputToStart($('#log-to').value);
  let list = S.messages.filter(m => {
    if (st === 'closed' && m.status === 'waiting') return false;
    if (['relayed', 'delivered', 'serviced', 'waiting'].includes(st) && m.status !== st) return false;
    const t = new Date(lastTime(m)).getTime();
    if (from != null && t < from) return false;
    if (toStart != null && t >= toStart + DAY) return false;
    if (q) {
      const hay = [m.nr, m.station, m.place, m.to.name, m.to.city, m.to.state, m.to.zip, m.text, m.sig,
        m.received && m.received.from, m.received && m.received.net, m.disp && m.disp.to, m.disp && m.disp.net].join(' ').toUpperCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  return list.sort((a, b) => new Date(lastTime(b)) - new Date(lastTime(a)));
}

function renderLog() {
  const list = logRows();
  const host = $('#log-table');
  if (!list.length) { host.innerHTML = '<div class="empty">No messages match.</div>'; return; }
  host.innerHTML = `<table class="t"><thead><tr><th>Last activity</th><th>Status</th><th>NR</th><th>Prec</th><th>Origin</th><th>To</th><th>In</th><th>Out</th></tr></thead><tbody>
    ${list.map(m => `<tr class="click" data-id="${m.id}">
      <td class="mono nowrap">${esc(fmtUtc(lastTime(m)))}</td>
      <td>${statusBadge(m)}</td>
      <td class="mono">${esc(m.nr)}</td>
      <td><span class="prec prec-${m.prec}">${esc(precShort(m.prec))}</span></td>
      <td class="small">${esc(m.station)}<br><span class="muted">${esc(m.place)}</span></td>
      <td class="small"><b>${esc(m.to.name)}</b><br><span class="muted">${esc(destText(m))}</span></td>
      <td class="small">${esc(sourceText(m))}</td>
      <td class="small">${m.status === 'waiting' ? '<span class="muted">—</span>' : esc(dispText(m))}</td></tr>`).join('')}
    </tbody></table><p class="hint">${list.length} message${list.length === 1 ? '' : 's'}</p>`;
}

function messagesCsv(list) {
  const head = ['Status', 'NR', 'Precedence', 'HX', 'Station of Origin', 'Check', 'Place of Origin', 'Time Filed', 'Date',
    'To Name', 'To Street', 'To City', 'To State', 'To ZIP', 'To Phone', 'To Email', 'Text', 'Signature', 'Op Note',
    'Source', 'Received From', 'Received Net', 'Received UTC', 'Originated UTC',
    'Out Station / Delivered To', 'Out Net', 'Delivery Method', 'Out UTC', 'Out Note'];
  const rows = list.map(m => [m.status, m.nr, m.prec, m.hx, m.station, m.check, m.place, m.time, m.date,
    m.to.name, m.to.street.replace(/\n/g, ', '), m.to.city, m.to.state, m.to.zip, m.to.phone, m.to.email, m.text, (m.sig || '').replace(/\n/g, ' '), m.opNote,
    m.origin, m.received ? m.received.from : '', m.received ? m.received.net : '', m.received ? fmtUtc(m.received.utc) : '', fmtUtc(m.originatedUtc),
    m.disp ? m.disp.to : '', m.disp ? m.disp.net : '', m.disp ? m.disp.method || '' : '', m.disp ? fmtUtc(m.disp.utc) : '', m.disp ? [m.disp.reason, m.disp.note].filter(Boolean).join(' — ') : '']);
  return toCsv([head].concat(rows));
}

// =====================================================================
// Reports
// =====================================================================
function periodRange() {
  const p = $('#rep-period').value;
  const now = Date.now(), t0 = dayStart(now), n = parts(now);
  switch (p) {
    case 'today': return [t0, t0 + DAY, 'Today'];
    case 'yesterday': return [t0 - DAY, t0, 'Yesterday'];
    case 'week': { const s = makeDay(n.y, n.m, n.d - n.wd); return [s, makeDay(n.y, n.m, n.d - n.wd + 7), 'This week']; }
    case 'month': return [makeDay(n.y, n.m, 1), makeDay(n.y, n.m + 1, 1), new Date(n.y, n.m, 1).toLocaleDateString([], { month: 'long', year: 'numeric' })];
    case 'lastmonth': return [makeDay(n.y, n.m - 1, 1), makeDay(n.y, n.m, 1), new Date(n.y, n.m - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' })];
    case 'year': return [makeDay(n.y, 0, 1), makeDay(n.y + 1, 0, 1), String(n.y)];
    case 'all': return [0, 8.64e15, 'All time'];
    case 'custom': {
      const f = dateInputToStart($('#rep-from').value), t = dateInputToStart($('#rep-to').value);
      return [f == null ? 0 : f, t == null ? 8.64e15 : t + DAY, ($('#rep-from').value || '…') + ' to ' + ($('#rep-to').value || '…')];
    }
  }
  return [0, 8.64e15, 'All time'];
}

function tally(list, keyFn) {
  const map = new Map();
  list.forEach(e => { const k = keyFn(e) || '(none)'; map.set(k, (map.get(k) || 0) + 1); });
  return map;
}

function renderReports() {
  const [from, to, label] = periodRange();
  const ev = eventsBetween(from, to);
  const c = countEvents(ev);
  const tile = (num, lbl, cls) => `<div class="tile ${cls || ''}"><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`;

  // by net
  const nets = new Map();
  ev.forEach(e => {
    if (!['rcvd', 'sent'].includes(e.type)) return;
    const k = e.net || '(no net)';
    const r = nets.get(k) || { rcvd: 0, sent: 0 };
    r[e.type]++; nets.set(k, r);
  });
  const stations = new Map();
  ev.forEach(e => {
    if (!['rcvd', 'sent'].includes(e.type)) return;
    const k = e.station || '(unknown)';
    const r = stations.get(k) || { rcvd: 0, sent: 0 };
    r[e.type]++; stations.set(k, r);
  });
  const methods = tally(ev.filter(e => e.type === 'dlvd'), e => e.method);
  const precs = tally(ev.filter(e => e.type === 'rcvd' || e.type === 'orig'), e => ({ R: 'Routine', W: 'Welfare', P: 'Priority', EMERGENCY: 'Emergency' }[e.m.prec] || e.m.prec));
  const days = new Map();
  ev.forEach(e => {
    const k = dayLabel(new Date(e.t).getTime());
    const r = days.get(k) || { orig: 0, rcvd: 0, sent: 0, dlvd: 0, svc: 0 };
    r[e.type]++; days.set(k, r);
  });
  const maxDay = Math.max(1, ...Array.from(days.values()).map(r => r.orig + r.rcvd + r.sent + r.dlvd));
  const twoCol = (title, map, h1, h2) => {
    const rows = Array.from(map.entries()).sort((a, b) => (b[1].rcvd + b[1].sent) - (a[1].rcvd + a[1].sent));
    return `<div><h3 style="margin-bottom:6px">${title}</h3>${rows.length ? `<table class="t"><thead><tr><th></th><th class="num">${h1}</th><th class="num">${h2}</th></tr></thead><tbody>
      ${rows.map(([k, r]) => `<tr><td>${esc(k)}</td><td class="num">${r.rcvd}</td><td class="num">${r.sent}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">None</p>'}</div>`;
  };
  const oneCol = (title, map) => {
    const rows = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    return `<div><h3 style="margin-bottom:6px">${title}</h3>${rows.length ? `<table class="t"><tbody>${rows.map(([k, n]) => `<tr><td>${esc(k)}</td><td class="num">${n}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">None</p>'}</div>`;
  };
  const bplPts = c.orig + c.dlvd;
  const waiting = waitingMsgs().length;

  $('#rep-body').innerHTML = `
    <p class="muted" style="margin:0 0 10px">${esc(label)} · ${useUtcDays() ? 'UTC days' : 'local days'}</p>
    <div class="report-big">
      ${tile(c.rcvd, 'Received')}${tile(c.sent, 'Relayed (sent)')}${tile(c.dlvd, 'Delivered')}${tile(c.orig, 'Originated')}
      ${tile(c.total, 'Total handled', 'accent')}${tile(c.svc, 'Undeliverable')}
    </div>
    <p class="hint" style="margin-top:8px">Total = originated + received + sent + delivered, the same way the ARRL Station Activity Report counts it.
      BPL needs 500 total, or 100 originated + delivered — this period: <b>${c.total}</b> total, <b>${bplPts}</b> originated + delivered.
      ${waiting ? `${waiting} message${waiting === 1 ? ' is' : 's are'} still waiting.` : ''}</p>
    <div class="grid-2" style="margin-top:14px">
      ${twoCol('By net', nets, 'Received', 'Relayed')}
      ${twoCol('By station', stations, 'Received from', 'Relayed to')}
      ${oneCol('Deliveries by method', methods)}
      ${oneCol('Received &amp; originated by precedence', precs)}
    </div>
    <h3 style="margin:16px 0 6px">By day</h3>
    ${days.size ? `<div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th class="num">Rcvd</th><th class="num">Sent</th><th class="num">Dlvd</th><th class="num">Orig</th><th class="num">Total</th><th class="bar-cell"></th></tr></thead><tbody>
      ${Array.from(days.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([d, r]) => {
        const tot = r.orig + r.rcvd + r.sent + r.dlvd;
        return `<tr><td class="mono">${d}</td><td class="num">${r.rcvd}</td><td class="num">${r.sent}</td><td class="num">${r.dlvd}</td><td class="num">${r.orig}</td><td class="num"><b>${tot}</b></td><td class="bar-cell"><div class="bar" style="width:${(tot / maxDay * 100).toFixed(1)}%"></div></td></tr>`;
      }).join('')}</tbody></table></div>` : '<p class="muted small">No traffic in this period.</p>'}`;
}

function reportSummaryText() {
  const [from, to, label] = periodRange();
  const c = countEvents(eventsBetween(from, to));
  return [
    'NTS traffic — ' + (S.settings.call || 'my station') + ' — ' + label,
    'Originated: ' + c.orig,
    'Received:   ' + c.rcvd,
    'Sent:       ' + c.sent,
    'Delivered:  ' + c.dlvd,
    'Total:      ' + c.total,
    c.svc ? 'Undeliverable: ' + c.svc : ''
  ].filter(Boolean).join('\n');
}

// =====================================================================
// Settings
// =====================================================================
const SETTINGS_FIELDS = { call: 'set-call', name: 'set-name', city: 'set-city', state: 'set-state', nextNr: 'set-nextnr', zips: 'set-zips', cities: 'set-cities', theme: 'set-theme', dayBoundary: 'set-day', overdueHours: 'set-overdue', clock: 'set-clock' };
const UPPER_SETTINGS = new Set(['call', 'city', 'state', 'cities']);

function fillSettings() {
  for (const [k, id] of Object.entries(SETTINGS_FIELDS)) $('#' + id).value = S.settings[k] ?? '';
  renderNetsTable();
  const n = S.messages.length;
  $('#bk-info').textContent = n + ' message' + (n === 1 ? '' : 's') + ' · ' + S.nets.length + ' net' + (S.nets.length === 1 ? '' : 's') + ' stored';
}

function bindSettings() {
  for (const [k, id] of Object.entries(SETTINGS_FIELDS)) {
    $('#' + id).addEventListener('input', e => {
      let v = e.target.value;
      if (UPPER_SETTINGS.has(k)) v = v.toUpperCase();
      if (k === 'nextNr' || k === 'overdueHours') v = parseInt(v, 10) || (k === 'nextNr' ? 1 : 48);
      S.settings[k] = v;
      save();
      if (k === 'theme') applyTheme();
      if (k === 'call') $('#hdr-call').textContent = S.settings.call;
      clearTimeout(bindSettings._t);
      bindSettings._t = setTimeout(renderAll, 250);
    });
  }
}

function renderNetsTable() {
  const t = $('#nets-table');
  if (!S.nets.length) { t.innerHTML = '<tbody><tr><td class="muted">No nets yet — click “+ Add net”.</td></tr></tbody>'; return; }
  t.innerHTML = `<thead><tr><th style="min-width:160px">Net name</th><th>Days</th><th>Start</th><th>Zone</th><th>Length (min)</th><th>Frequency / mode</th><th>Notes / my role</th><th></th></tr></thead><tbody>
    ${S.nets.map(n => `<tr data-net="${n.id}">
      <td><input data-k="name" value="${esc(n.name)}" placeholder="e.g. Ohio Single Sideband Net"></td>
      <td><div class="days">${WEEKDAYS.map((d, i) => `<label>${d[0]}<input type="checkbox" data-day="${i}" ${n.days.includes(i) ? 'checked' : ''} title="${d}"></label>`).join('')}</div></td>
      <td><input type="time" data-k="time" value="${esc(n.time)}"></td>
      <td><select data-k="tz"><option value="local" ${n.tz !== 'utc' ? 'selected' : ''}>Local</option><option value="utc" ${n.tz === 'utc' ? 'selected' : ''}>UTC</option></select></td>
      <td><input type="number" min="5" step="5" data-k="dur" value="${esc(n.dur || 60)}" style="width:70px"></td>
      <td><input data-k="freq" value="${esc(n.freq)}" placeholder="3.972 LSB"></td>
      <td><input data-k="notes" value="${esc(n.notes)}" placeholder="Liaison to 8RN"></td>
      <td><button class="btn sm danger" data-netdel>Remove</button></td></tr>`).join('')}</tbody>`;
}

function bindNetsTable() {
  const t = $('#nets-table');
  t.addEventListener('input', e => {
    const tr = e.target.closest('tr[data-net]');
    if (!tr) return;
    const n = S.nets.find(x => x.id === tr.dataset.net);
    if (e.target.dataset.k) n[e.target.dataset.k] = e.target.value;
    if (e.target.dataset.day != null) {
      const d = +e.target.dataset.day;
      n.days = e.target.checked ? Array.from(new Set(n.days.concat(d))).sort() : n.days.filter(x => x !== d);
    }
    save(); renderNets(); refreshDatalists();
  });
  t.addEventListener('change', e => { if (e.target.matches('select, input[type=checkbox]')) t.dispatchEvent(new Event('input', { bubbles: true })); });
  t.addEventListener('click', async e => {
    if (!e.target.closest('[data-netdel]')) return;
    const tr = e.target.closest('tr[data-net]');
    const n = S.nets.find(x => x.id === tr.dataset.net);
    if (await askConfirm('Remove net', `Remove “${esc(n.name || 'this net')}” from your nets? Messages already logged on it keep the net name.`, 'Remove', true)) {
      S.nets = S.nets.filter(x => x !== n); save(); renderNetsTable(); renderNets();
    }
  });
  $('#net-add').addEventListener('click', () => {
    S.nets.push({ id: uid(), name: '', days: [], time: '19:00', tz: 'local', dur: 60, freq: '', notes: '' });
    save(); renderNetsTable();
    const rows = $$('#nets-table tr[data-net]');
    $('input[data-k=name]', rows[rows.length - 1]).focus();
  });
}

function applyTheme() {
  const t = S.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

async function saveBackup() {
  const name = 'nts-traffic-backup-' + utcDateStr(new Date()) + '.json';
  try { if (await saveTextFile(name, JSON.stringify(S, null, 1), 'application/json')) toast('Backup saved'); }
  catch (e) { toast('Backup failed: ' + e); }
}

async function restoreBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.messages) || !data.settings) throw new Error('Not an NTS Traffic Logger backup');
    const ok = await askConfirm('Restore backup', `Replace everything currently stored (${S.messages.length} messages) with this backup (${data.messages.length} messages)?`, 'Replace', true);
    if (!ok) return;
    S = normalizeStore(data); save(); applyTheme(); fillSettings(); renderAll(); toast('Backup restored');
  } catch (e) { toast('Could not restore: ' + e.message); }
}

// =====================================================================
// Shared rendering / navigation
// =====================================================================
function refreshDatalists() {
  const freq = new Map();
  S.messages.forEach(m => {
    [m.received && m.received.from, m.status === 'relayed' && m.disp && m.disp.to].forEach(c => { if (c) freq.set(c, (freq.get(c) || 0) + 1); });
  });
  $('#dl-stations').innerHTML = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 300).map(([c]) => `<option value="${esc(c)}">`).join('');
  const nets = new Set(S.nets.map(n => n.name).filter(Boolean));
  S.messages.forEach(m => { if (m.received && m.received.net) nets.add(m.received.net); if (m.disp && m.disp.net) nets.add(m.disp.net); });
  $('#dl-nets').innerHTML = Array.from(nets).map(n => `<option value="${esc(n)}">`).join('');
}

function currentView() { const v = $('.view.active'); return v ? v.id.replace('view-', '') : 'dashboard'; }

function renderAll() {
  $('#hdr-call').textContent = S.settings.call || '';
  refreshDatalists();
  renderDashboard();
  const v = currentView();
  if (v === 'log') renderLog();
  if (v === 'reports') renderReports();
  if (v === 'entry' && pendingImport) renderPreview();
}

function showView(name, anchor) {
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'log') renderLog();
  if (name === 'reports') renderReports();
  if (name === 'settings') fillSettings();
  if (name === 'dashboard') renderDashboard();
  if (anchor) { const a = document.getElementById(anchor); if (a) a.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  else window.scrollTo(0, 0);
}

function init() {
  applyTheme();
  $('#paste-utc').innerHTML = utcField('paste');
  renderSingle();
  bindSettings();
  bindNetsTable();

  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button[data-view]'); if (b) showView(b.dataset.view); });
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-goto]');
    if (g) { e.preventDefault(); showView(g.dataset.goto, g.dataset.anchor); }
  });

  // waiting list
  $('#wait-list').addEventListener('click', e => {
    const bookBtn = e.target.closest('[data-bookact]');
    if (bookBtn) {
      const ids = bookBtn.closest('.book').dataset.ids.split(',');
      const a = bookBtn.dataset.bookact;
      if (a === 'copy') return copyText(NTS.formatBook(ids.map(getMsg)));
      if (a === 'select') { const all = ids.every(id => sel.has(id)); ids.forEach(id => all ? sel.delete(id) : sel.add(id)); return renderWaiting(); }
      return openDisposition(a, ids);
    }
    const row = e.target.closest('.msg-row');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.classList.contains('sel')) { e.target.checked ? sel.add(id) : sel.delete(id); updateSelButtons(); return; }
    const act = e.target.closest('[data-act]');
    if (act) return openDisposition(act.dataset.act, [id]);
    openView(id);
  });
  $('#wait-search').addEventListener('input', renderWaiting);
  $('#wait-selall').addEventListener('click', () => {
    const rows = $$('#wait-list .msg-row').map(r => r.dataset.id);
    const all = rows.length && rows.every(id => sel.has(id));
    rows.forEach(id => all ? sel.delete(id) : sel.add(id));
    renderWaiting();
  });
  $('#wait-relay').addEventListener('click', () => openDisposition('relay', Array.from(sel)));
  $('#wait-deliver').addEventListener('click', () => openDisposition('deliver', Array.from(sel)));
  $('#wait-service').addEventListener('click', () => openDisposition('service', Array.from(sel)));

  // entry
  $('#entry-tabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-sub]');
    if (!b) return;
    $$('#entry-tabs button').forEach(x => x.classList.toggle('active', x === b));
    $('#entry-paste').classList.toggle('hidden', b.dataset.sub !== 'paste');
    $('#entry-single').classList.toggle('hidden', b.dataset.sub !== 'single');
  });
  $$('input[name=paste-origin]').forEach(r => r.addEventListener('change', () => {
    const orig = pasteOrigin() === 'originated';
    $$('#paste-recv label').forEach(l => l.classList.toggle('hidden', orig));
  }));
  $('#paste-parse').addEventListener('click', parsePaste);
  $('#paste-clear').addEventListener('click', () => { $('#paste-text').value = ''; pendingImport = null; renderPreview(); });
  $('#paste-preview').addEventListener('click', e => {
    if (e.target.id === 'paste-commit') return commitPaste();
    const tr = e.target.closest('tr[data-pid]');
    if (!tr) return;
    const m = pendingImport.find(x => x.id === tr.dataset.pid);
    if (e.target.classList.contains('pinc')) { m.include = e.target.checked; return renderPreview(); }
    openEdit(m.id, () => renderPreview());
  });
  $('#single-form-host').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) saveSingle(b.dataset.s); });

  // log
  ['#log-status', '#log-from', '#log-to'].forEach(s => $(s).addEventListener('change', renderLog));
  $('#log-search').addEventListener('input', renderLog);
  $('#log-table').addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr) openView(tr.dataset.id); });
  $('#log-csv').addEventListener('click', async () => {
    const list = logRows();
    if (await saveTextFile('nts-traffic-log-' + utcDateStr(new Date()) + '.csv', messagesCsv(list), 'text/csv')) toast(list.length + ' messages exported');
  });

  // reports
  $('#rep-period').addEventListener('change', () => { $('#rep-custom').classList.toggle('hidden', $('#rep-period').value !== 'custom'); renderReports(); });
  ['#rep-from', '#rep-to'].forEach(s => $(s).addEventListener('change', renderReports));
  $('#rep-copy').addEventListener('click', () => copyText(reportSummaryText()));
  $('#rep-csv').addEventListener('click', async () => {
    const [from, to] = periodRange();
    const ev = eventsBetween(from, to);
    const names = { orig: 'Originated', rcvd: 'Received', sent: 'Relayed', dlvd: 'Delivered', svc: 'Undeliverable' };
    const rows = [['UTC', 'Event', 'NR', 'Precedence', 'Station of Origin', 'To', 'Destination', 'Station', 'Net', 'Method']]
      .concat(ev.map(e => [fmtUtc(e.t), names[e.type], e.m.nr, e.m.prec, e.m.station, e.m.to.name, destText(e.m), e.station || '', e.net || '', e.method || '']));
    if (await saveTextFile('nts-traffic-report-' + utcDateStr(new Date()) + '.csv', toCsv(rows), 'text/csv')) toast('Report exported');
  });

  // backup
  $('#bk-save').addEventListener('click', saveBackup);
  $('#bk-load').addEventListener('click', () => $('#bk-file').click());
  $('#bk-file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) restoreBackup(f); });

  renderAll();
  setInterval(renderClock, 1000);
  setInterval(() => { renderNets(); renderTiles(); }, 60000);

  if (!S.settings.call) {
    toast('Welcome! Start in Settings with your callsign and nets.');
  }
}

document.addEventListener('DOMContentLoaded', init);
