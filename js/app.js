'use strict';
/* =====================================================================
   Pády – Czech cases practice app
   Everything runs on your device. Exercises live in /data/*.json.
   ===================================================================== */

const APP_VERSION = '2.0.0';
const STORE_KEY = 'czcases.v1';

const CASES = [
  { k: 'nom', n: 1, en: 'Nominative',   cz: 'Nominativ',    q: 'kdo? co?' },
  { k: 'gen', n: 2, en: 'Genitive',     cz: 'Genitiv',      q: 'koho? čeho?' },
  { k: 'dat', n: 3, en: 'Dative',       cz: 'Dativ',        q: 'komu? čemu?' },
  { k: 'acc', n: 4, en: 'Accusative',   cz: 'Akuzativ',     q: 'koho? co?' },
  { k: 'voc', n: 5, en: 'Vocative',     cz: 'Vokativ',      q: 'oslovujeme, voláme' },
  { k: 'loc', n: 6, en: 'Locative',     cz: 'Lokál',        q: '(o) kom? (o) čem?' },
  { k: 'ins', n: 7, en: 'Instrumental', cz: 'Instrumentál', q: '(s) kým? (s) čím?' },
];
const CASE = Object.fromEntries(CASES.map(c => [c.k, c]));
const GENDER = { Ma: 'Masculine animate (Mž)', Mi: 'Masculine inanimate (Mn)', F: 'Feminine (F)', N: 'Neuter (N)' };
const CATS = { nouns: 'Nouns', adjectives: 'Adjectives', pronouns: 'Pronouns', prepositions: 'Prepositions', phrases: 'Whole phrases' };
const TYPES = {
  fill: 'Fill in the blank', prepcase: 'Which case?', chooseprep: 'Choose the preposition', choose: 'Choose the form',
  decline: 'Decline the word', phrase: 'Decline the phrase', translate: 'Translate', error: 'Spot the error',
};

const MIN = 60e3, DAY = 864e5;
// Leitner boxes: after a correct answer an item in box b comes back after INTERVAL_DAYS[b] days.
const INTERVAL_DAYS = [0, 0, 1, 3, 7, 16, 35];
const MAX_BOX = 6, MASTERED_BOX = 4;

let EX = [], BYID = {}, RULES = {}, TABLES = {}, PREPS = {};
let S;            // saved state (progress + settings)
let Q = null;     // current session
let lastMode = null;
let refTab = 'acc';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------------------------- storage ---------------------------- */
function defaultState() {
  return { v: 1, items: {}, days: [], settings: { lenient: true, hints: true, len: 20, mixLen: 40, num: 'both' } };
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return mergeState(JSON.parse(raw));
  } catch (e) { /* ignore */ }
  return defaultState();
}
function mergeState(o) {
  const d = defaultState();
  if (!o || typeof o !== 'object' || typeof o.items !== 'object') throw new Error('Not a progress file');
  return { v: 1, items: o.items || {}, days: Array.isArray(o.days) ? o.days : [], settings: { ...d.settings, ...(o.settings || {}) } };
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked */ }
}
function dayKey(t = new Date()) {
  const d = new Date(t);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function endOfToday() { const d = new Date(); d.setHours(23, 59, 59, 999); return +d; }

/* ---------------------------- loading ---------------------------- */
async function getJSON(path) {
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) throw new Error(path + ' → HTTP ' + r.status);
  try { return await r.json(); } catch (e) { throw new Error(path + ' is not valid JSON: ' + e.message); }
}

async function init() {
  S = loadState();
  try {
    const idx = await getJSON('data/index.json');
    [RULES, TABLES, PREPS] = await Promise.all(['rules', 'tables', 'prepositions'].map(n => getJSON('data/' + n + '.json')));
    const lists = await Promise.all(idx.exercises.map(f => getJSON('data/' + f)));
    EX = lists.flat();
    BYID = Object.fromEntries(EX.map(e => [e.id, e]));
  } catch (err) {
    const box = $('#loadError');
    box.innerHTML = `<h2>Could not load the exercises</h2>
      <p>${esc(err.message)}</p>
      <p class="muted">If you opened <b>index.html</b> by double-clicking it, the browser blocks the data files.
      Start the app with <b>start.bat</b> instead (see README), or open the hosted version.</p>`;
    show('loadError');
    return;
  }
  bindUI();
  show('home');
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

/* ---------------------------- navigation ---------------------------- */
function show(id) {
  $$('.screen').forEach(s => (s.hidden = s.id !== id));
  document.body.classList.toggle('in-session', id === 'practice');
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.go === id));
  if (id === 'home') renderHome();
  if (id === 'progress') renderProgress();
  if (id === 'reference') renderReference();
  if (id === 'settings') renderSettings();
  window.scrollTo(0, 0);
}

function bindUI() {
  document.addEventListener('click', ev => {
    const go = ev.target.closest('[data-go]');
    if (go) { show(go.dataset.go); return; }
    const m = ev.target.closest('[data-mode]');
    if (m) { startSession(m.dataset.mode, m.dataset.case); return; }
  });
  $('#ansForm').addEventListener('submit', onSubmit);
  $('#quitBtn').addEventListener('click', () => (Q && Q.results.length ? finishSession() : show('home')));
  $('#againBtn').addEventListener('click', () => lastMode && startSession(lastMode.mode, lastMode.caseKey));

  $('#setLenient').addEventListener('change', e => { S.settings.lenient = e.target.checked; save(); });
  $('#setHints').addEventListener('change', e => { S.settings.hints = e.target.checked; save(); });
  $('#setLen').addEventListener('change', e => { S.settings.len = +e.target.value; save(); });
  $('#setMixLen').addEventListener('change', e => { S.settings.mixLen = +e.target.value; save(); });
  $$('#numSeg button').forEach(b => b.addEventListener('click', () => { S.settings.num = b.dataset.num; save(); renderHome(); }));
  $('#exportBtn').addEventListener('click', exportProgress);
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', importProgress);
  $('#resetBtn').addEventListener('click', resetProgress);
}

/* ---------------------------- stats helpers ---------------------------- */
function item(id) { return S.items[id]; }
function isDue(e, until = Date.now()) { const it = item(e.id); return !!it && it.due <= until; }
function isWeak(e) {
  const it = item(e.id);
  if (!it) return false;
  return (it.b <= 2 && it.w > 0) || (it.n >= 2 && it.c / it.n < 0.7);
}
function agg(list) {
  let n = 0, c = 0, seen = 0, mast = 0, due = 0;
  const eod = endOfToday();
  for (const e of list) {
    const it = item(e.id);
    if (!it) continue;
    seen++; n += it.n; c += it.c;
    if (it.b >= MASTERED_BOX) mast++;
    if (it.due <= eod) due++;
  }
  return { total: list.length, seen, n, c, mast, due, acc: n ? c / n : null };
}
function streak() {
  const days = new Set(S.days);
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let k = 0;
  while (days.has(dayKey(d))) { k++; d.setDate(d.getDate() - 1); }
  return k;
}
const pct = x => (x == null ? '–' : Math.round(x * 100) + '%');
function barClass(x) { return x == null ? '' : x < 0.6 ? 'low' : x < 0.85 ? 'mid' : 'high'; }
function barRow(label, a, extra = '') {
  const w = a.acc == null ? 0 : Math.round(a.acc * 100);
  return `<div class="barrow"><div class="lab"><span>${label}</span><span>${pct(a.acc)} · ${a.seen}/${a.total} seen${extra}</span></div>
    <div class="bar"><div class="${barClass(a.acc)}" style="width:${w}%"></div></div></div>`;
}

/* ---------------------------- home ---------------------------- */
function renderHome() {
  const a = agg(EX);
  $('#homeStats').innerHTML = `
    <div class="stat"><b>🔥 ${streak()}</b><span>day streak</span></div>
    <div class="stat"><b>${a.due}</b><span>due today</span></div>
    <div class="stat"><b>${a.mast}</b><span>mastered of ${EX.length}</span></div>`;
  const w = EX.filter(isWeak).length;
  $('#weakInfo').textContent = w ? `${w} item${w > 1 ? 's' : ''} you often get wrong` : 'nothing yet – make some mistakes first 🙂';

  const num = S.settings.num || 'both';
  $$('#numSeg button').forEach(b => b.classList.toggle('on', b.dataset.num === num));
  const byNum = e => num === 'both' || (e.num || 'sg') === num;
  const tile = (attrs, n, title, sub, list, cls = '') => {
    const s = agg(list);
    const done = s.total ? Math.round((s.mast / s.total) * 100) : 0;
    return `<button class="casebtn ${cls}" ${attrs}><span class="num">${n}</span><b>${title}</b>
      <small>${sub}</small><small>${s.seen}/${s.total} seen · ${pct(s.acc)}${s.due ? ` · ${s.due} due` : ''}</small>
      <span class="mini"><div style="width:${done}%"></div></span></button>`;
  };
  let html = CASES.map(c => {
    const list = EX.filter(e => e.case === c.k && byNum(e));
    if (!list.length) return `<button class="casebtn" disabled><span class="num">${c.n}</span><b>${c.en}</b><small>no ${num === 'pl' ? 'plural' : ''} exercises yet</small></button>`;
    return tile(`data-mode="case" data-case="${c.k}"`, c.n + '.', c.en, `${c.cz} · ${c.q}`, list);
  }).join('');
  html += tile('data-mode="all"', '🔀', 'All cases mixed', `${S.settings.mixLen || 40} exercises from all 7 cases`, EX.filter(byNum), 'all');
  $('#caseGrid').innerHTML = html;
}

/* ---------------------------- sessions ---------------------------- */
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// Take new items round-robin across groups (exercise types, or cases), so a session
// never starts with 20 of the same kind.
function roundRobin(list, keepOrder, key = e => e.type) {
  const groups = {};
  for (const e of list) (groups[key(e)] ||= []).push(e);
  const gs = Object.values(groups).map(g => (keepOrder ? g : shuffle(g)));
  const out = [];
  while (gs.some(g => g.length)) for (const g of shuffle(gs)) if (g.length) out.push(g.shift());
  return out;
}
// Avoid the same exercise type twice in a row where possible.
function spread(list) {
  const out = [], rest = list.slice();
  while (rest.length) {
    const prev = out[out.length - 1];
    let i = rest.findIndex(e => !prev || e.type !== prev.type);
    if (i < 0) i = 0;
    out.push(rest.splice(i, 1)[0]);
  }
  return out;
}

function buildSession(mode, caseKey) {
  let pool = EX, allowNew = true, n = S.settings.len;
  const num = S.settings.num || 'both';
  const byNum = e => num === 'both' || (e.num || 'sg') === num;
  if (mode === 'case') pool = EX.filter(e => e.case === caseKey && byNum(e));
  if (mode === 'all') { pool = EX.filter(byNum); n = S.settings.mixLen || 40; }
  if (mode === 'preps') pool = EX.filter(e => e.cat === 'prepositions');
  if (mode === 'weak') { pool = EX.filter(isWeak); allowNew = false; }
  if (mode === 'quick') n = 12;
  const mixCases = mode === 'all' || mode === 'quick' || mode === 'preps';

  const now = Date.now();
  let pick = pool.filter(e => isDue(e, now)).sort((a, b) => item(a.id).due - item(b.id).due).slice(0, n);
  if (allowNew && pick.length < n) {
    const freshList = pool.filter(e => !item(e.id));
    // one case: new items in file order (singular before plural, easy before hard), mixed by type;
    // several cases: spread the new items evenly over the cases
    const fresh = mixCases
      ? roundRobin(freshList, false, e => e.case)
      : roundRobin(freshList, true);
    pick = pick.concat(fresh.slice(0, n - pick.length));
  }
  if (pick.length < n) {
    const chosen = new Set(pick);
    const extra = shuffle(pool.filter(e => item(e.id) && !chosen.has(e)))
      .sort((a, b) => item(a.id).b - item(b.id).b);
    pick = pick.concat(extra.slice(0, n - pick.length));
  }
  return spread(shuffle(pick));
}

function startSession(mode, caseKey) {
  const list = buildSession(mode, caseKey);
  lastMode = { mode, caseKey };
  if (!list.length) {
    show('home');
    $('#weakInfo').textContent = mode === 'weak' ? 'No weak spots right now – well done!' : 'Nothing to practise here yet.';
    return;
  }
  Q = { list: list.map(e => ({ e, retry: false })), i: 0, results: [], requeued: new Set(), answered: false };
  show('practice');
  renderQuestion();
}

/* ---------------------------- answer checking ---------------------------- */
function stripAccents(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC'); }
function norm(s) {
  return String(s).normalize('NFC').toLowerCase()
    .replace(/[„“”"'’‘.,!?;:()]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function tidy(s) { return s.replace(/ +([.?!,])/g, '$1'); }
// Put the answer into the blanks of the prompt: "Vidím ___ ___ ___ ." + "toho dobrého studenta"
function fillBlanks(prompt, answer, wrap) {
  const blanks = (prompt.match(/___/g) || []).length;
  const words = answer.split(' ');
  let out;
  if (blanks > 1 && blanks === words.length) {
    let i = 0;
    out = prompt.replace(/___/g, () => (wrap ? wrap(words[i++]) : words[i++]));
  } else {
    out = prompt.replace(/___( ___)*/, wrap ? wrap(answer) : answer);
  }
  return tidy(out);
}
function caseFromInput(raw) {
  const s = stripAccents(norm(raw)).replace(/\b(pad|case)\b/g, '').replace(/\s/g, '');
  if (/^[1-7]$/.test(s)) return CASES[+s - 1].k;
  const map = [['nom', 'nom'], ['prvni', 'nom'], ['gen', 'gen'], ['druh', 'gen'], ['dat', 'dat'], ['tret', 'dat'],
    ['acc', 'acc'], ['aku', 'acc'], ['akk', 'acc'], ['ctvrt', 'acc'], ['voc', 'voc'], ['vok', 'voc'], ['pat', 'voc'],
    ['loc', 'loc'], ['lok', 'loc'], ['sest', 'loc'], ['ins', 'ins'], ['sedm', 'ins']];
  const hit = map.find(([p]) => s.startsWith(p));
  return hit ? hit[1] : null;
}
function check(e, raw) {
  if (e.type === 'prepcase') return { ok: caseFromInput(raw) === e.answers[0] };
  const inputs = [raw];
  if (e.type === 'translate') {
    const m = norm(raw).match(/^(já|ja|ty|on|ona|ono|my|vy|oni|ony) (.+)$/);
    if (m) inputs.push(m[2]);
  }
  const cands = e.answers.slice();
  if (['fill', 'phrase', 'chooseprep', 'choose'].includes(e.type)) cands.push(...e.answers.map(a => fillBlanks(e.prompt, a)));
  if (e.type === 'error' && e.full) cands.push(e.full);
  const ni = inputs.map(norm), nc = cands.map(norm);
  if (ni.some(i => nc.includes(i))) return { ok: true };
  const si = ni.map(stripAccents), sc = nc.map(stripAccents);
  if (si.some(i => sc.includes(i))) return S.settings.lenient ? { ok: true, accent: true } : { ok: false, accentOnly: true };
  return { ok: false };
}

/* ---------------------------- spaced repetition ---------------------------- */
function grade(e, ok, retry) {
  const now = Date.now();
  const it = S.items[e.id] || (S.items[e.id] = { b: 0, due: 0, n: 0, c: 0, w: 0 });
  it.n++; it.last = now;
  if (ok) {
    it.c++;
    if (retry) { it.b = 1; it.due = now + DAY; }               // corrected after a mistake: see it again tomorrow
    else { it.b = Math.min(MAX_BOX, Math.max(1, it.b) + 1); it.due = now + INTERVAL_DAYS[it.b] * DAY; }
  } else {
    it.w++; it.b = 1; it.due = now + 10 * MIN;                   // wrong: back to box 1, due again in 10 minutes
  }
  const today = dayKey();
  if (!S.days.includes(today)) S.days.push(today);
  if (S.days.length > 800) S.days = S.days.slice(-800);
  save();
}

/* ---------------------------- question screen ---------------------------- */
function blanksHTML(prompt) {
  return esc(tidy(prompt)).replace(/___/g, '<span class="blank">&nbsp;</span>');
}
function promptHTML(e) {
  const hint = S.settings.hints && e.hint && e.type !== 'translate' ? `<div class="hint">${esc(e.hint)}</div>` : '';
  const pl = e.num === 'pl' ? '<span class="badge">plural</span>' : '';
  switch (e.type) {
    case 'fill':
    case 'phrase':
      return `<div class="cz big" id="sentence">${blanksHTML(e.prompt)}</div><div class="base">→ <b class="cz">${esc(e.base)}</b>${pl}</div>${hint}`;
    case 'chooseprep':
      return `<div class="instr">Choose the right preposition</div><div class="cz big" id="sentence">${blanksHTML(e.prompt)}</div>${hint}`;
    case 'choose':
      return `<div class="instr">Choose the right form</div><div class="cz big" id="sentence">${blanksHTML(e.prompt)}</div>${hint}`;
    case 'prepcase':
      return `<div class="instr">${esc(e.prompt)}</div><div class="cz huge">${esc(e.base)}</div>${hint}`;
    case 'translate':
      return `<div class="instr">${esc(e.prompt)}</div><div class="en big">${esc(e.base)}</div>`;
    case 'error':
      return `<div class="instr">${esc(e.prompt)} <br>Type the corrected word.</div><div class="cz big">${esc(e.base)}</div>${hint}`;
    case 'decline':
    default:
      return `<div class="instr">${esc(e.prompt)}</div><div class="cz huge">${esc(e.base)}</div>`;
  }
}
function placeholderFor(e) {
  return { fill: 'Type the missing form', phrase: 'Type all the words', translate: 'Type the Czech sentence',
    error: 'Type the corrected word', chooseprep: '…or type it', decline: 'Type the form' }[e.type] || 'Type your answer';
}

function renderQuestion() {
  const { e } = Q.list[Q.i];
  Q.answered = false;
  $('#qCount').textContent = `${Q.i + 1} / ${Q.list.length}`;
  $('#pbarFill').style.width = (Q.i / Q.list.length) * 100 + '%';
  const rc = CASE[e.case];
  $('#qMeta').textContent = `${rc.n}. ${rc.en}${e.num === 'pl' ? ' plural' : ''} · ${TYPES[e.type] || e.type}${Q.list[Q.i].retry ? ' · try again' : ''}`;
  $('#qBody').innerHTML = promptHTML(e);

  const chips = $('#chips');
  chips.innerHTML = '';
  if (e.type === 'prepcase') {
    chips.innerHTML = CASES.map(c => `<button type="button" class="chip" data-val="${c.k}">${c.n}.<small>${c.en.slice(0, 3)}</small></button>`).join('');
  } else if ((e.type === 'chooseprep' || e.type === 'choose') && e.options) {
    chips.innerHTML = shuffle(e.options).map(o => `<button type="button" class="chip" data-val="${esc(o)}">${esc(o)}</button>`).join('');
  }
  chips.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
    if (Q.answered) return;
    answer(b.dataset.val, b);
  }));

  const inp = $('#ans');
  inp.value = '';
  inp.className = '';
  inp.readOnly = false;
  inp.hidden = e.type === 'prepcase';
  inp.placeholder = placeholderFor(e);
  $('#checkBtn').textContent = 'Check';
  $('#checkBtn').hidden = e.type === 'prepcase';
  $('#fb').hidden = true;
  $('#fb').innerHTML = '';
  if (!inp.hidden && e.type !== 'chooseprep' && e.type !== 'choose') inp.focus({ preventScroll: true });
}

function onSubmit(ev) {
  ev.preventDefault();
  if (!Q) return;
  if (Q.answered) { next(); return; }
  const raw = $('#ans').value.trim();
  if (!raw) { $('#ans').focus(); return; }
  answer(raw);
}

function answer(raw, chipEl) {
  const entry = Q.list[Q.i], e = entry.e;
  const r = check(e, raw);
  Q.answered = true;
  const before = S.items[e.id] ? { ...S.items[e.id] } : null;
  grade(e, r.ok, entry.retry);
  let insertedAt = -1;
  if (!r.ok && !Q.requeued.has(e.id)) {
    Q.requeued.add(e.id);
    insertedAt = Math.min(Q.list.length, Q.i + 4);
    Q.list.splice(insertedAt, 0, { e, retry: true });
  }
  Q.results.push({ id: e.id, ok: r.ok, raw });
  Q.undo = { before, insertedAt, entry };

  // visual state
  const inp = $('#ans');
  inp.readOnly = true;
  inp.classList.add(r.ok ? 'ok' : 'bad');
  if (chipEl) {
    chipEl.classList.add(r.ok ? 'right' : 'wrong');
    if (!inp.hidden) inp.value = raw;
  }
  if (!r.ok) {
    $$('#chips .chip').forEach(c => { if (e.answers.includes(c.dataset.val)) c.classList.add('right'); });
  }
  const sentence = $('#sentence');
  if (sentence) {
    // show the correct form inside the sentence
    sentence.innerHTML = fillBlanks(esc(e.prompt), esc(e.answers[0]), w => `<span class="blank filled">${w}</span>`);
  }

  $('#qCount').textContent = `${Q.i + 1} / ${Q.list.length}`;
  $('#checkBtn').hidden = false;
  $('#checkBtn').textContent = Q.i + 1 >= Q.list.length ? 'Finish' : 'Next →';
  const fb = $('#fb');
  fb.innerHTML = feedbackHTML(e, r, raw);
  fb.hidden = false;
  const override = $('#overrideBtn');
  if (override) override.addEventListener('click', overrideCorrect);

  if (r.ok) {
    if (inp.hidden || e.type === 'chooseprep' || e.type === 'choose') $('#checkBtn').focus({ preventScroll: true });
  } else {
    inp.blur();                                   // close the keyboard so the explanation is readable
    setTimeout(() => fb.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
}

// "I was right" – count the answer as correct (typo in the data, or another valid form).
function overrideCorrect() {
  const { before, insertedAt, entry } = Q.undo;
  const e = entry.e;
  if (before) S.items[e.id] = before; else delete S.items[e.id];
  if (insertedAt >= 0) { Q.list.splice(insertedAt, 1); Q.requeued.delete(e.id); }
  grade(e, true, entry.retry);
  Q.results[Q.results.length - 1].ok = true;
  $('#fb').innerHTML = `<div class="fb-ok">✓ Counted as correct</div><div class="fb-line muted small">If the app was wrong, you can add your answer to the "answers" list of exercise <b>${esc(e.id)}</b>.</div>`;
  $('#ans').className = 'ok';
  $('#qCount').textContent = `${Q.i + 1} / ${Q.list.length}`;
  $('#checkBtn').textContent = Q.i + 1 >= Q.list.length ? 'Finish' : 'Next →';
}

function next() {
  Q.i++;
  if (Q.i >= Q.list.length) finishSession();
  else { renderQuestion(); window.scrollTo(0, 0); }
}

/* ---------------------------- feedback ---------------------------- */
function displayAnswer(e, a) {
  a = a ?? e.answers[0];
  if (e.type === 'prepcase') { const c = CASE[a]; return c ? `${c.n}. ${c.en} (${c.cz})` : a; }
  return a;
}
// Mark the part of the correct answer that differs from what was typed (usually the ending).
function diffHTML(typed, correct) {
  const a = stripAccents(typed.toLowerCase()), b = stripAccents(correct.toLowerCase());
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i] && typed[i]?.toLowerCase() === correct[i].toLowerCase()) i++;
  if (i === correct.length) return esc(correct);
  return esc(correct.slice(0, i)) + '<mark>' + esc(correct.slice(i)) + '</mark>';
}
function caseLine(e) {
  const rule = RULES[e.rule];
  const ck = (rule && rule.case) || e.case;
  const c = CASE[ck];
  let s = `${c.en} ${e.num === 'pl' ? 'plural' : 'singular'} · ${c.n}. pád (${c.q})`;
  if (e.g && GENDER[e.g]) s += ` · ${GENDER[e.g]}`;
  return s;
}
function feedbackHTML(e, r, raw) {
  const correct = displayAnswer(e);
  const others = e.answers.slice(1).map(a => displayAnswer(e, a));
  const next = `<button class="btn primary" type="button" onclick="document.getElementById('ansForm').requestSubmit()">${Q.i + 1 >= Q.list.length ? 'Finish' : 'Next →'}</button>`;
  if (r.ok) {
    let s = `<div class="fb-ok">✓ Správně!</div>`;
    if (r.accent) s += `<div class="fb-line">With accents: <b class="cz">${esc(correct)}</b></div>`;
    if (others.length) s += `<div class="fb-line muted small">Also correct: ${others.map(esc).join(' · ')}</div>`;
    return s;
  }
  const rule = RULES[e.rule];
  const ruleCase = (rule && rule.case) || e.case;
  const table = TABLES[`${ruleCase}-${e.num || 'sg'}`];
  return `
    <div class="fb-bad">✗ Not quite${r.accentOnly ? ' – only the accents (háčky / čárky) differ' : ''}</div>
    <div class="cmp">
      <div><span class="lbl">You</span><span class="cz wrong">${esc(e.type === 'prepcase' ? displayAnswer(e, caseFromInput(raw) || raw) : raw)}</span></div>
      <div><span class="lbl">Correct</span><span class="cz right">${e.type === 'prepcase' ? esc(correct) : diffHTML(raw, correct)}</span></div>
    </div>
    ${others.length ? `<div class="fb-line muted small">Also correct: ${others.map(esc).join(' · ')}</div>` : ''}
    ${e.full ? `<div class="fb-line">Whole sentence: <b class="cz">${esc(e.full)}</b></div>` : ''}
    <div class="why">
      <div class="why-head">${esc(caseLine(e))}</div>
      <p>${esc(e.explain)}</p>
      ${rule ? `<div class="rule"><b>Rule: ${esc(rule.title)}</b><br>${esc(rule.explain)}</div>
      <div class="tip">💡 ${esc(rule.tip)}</div>` : ''}
    </div>
    ${table ? tableHTML(table, e.g) : ''}
    ${next}
    <div class="fb-actions"><button type="button" class="linkbtn" id="overrideBtn">I was right – count it as correct</button></div>`;
}

/* ---------------------------- declension table ---------------------------- */
function ends(form) { return esc(form).replace(/\[([^\]]+)\]/g, '<mark>$1</mark>'); }
function tableHTML(t, g) {
  return `<div class="tablewrap"><table class="decl">
    <caption>${esc(t.title)}</caption>
    <thead><tr><th></th>${t.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${t.rows.map(r => `<tr class="${r.g === g ? 'hl' : ''}"><th>${esc(r.label)}<small>${esc(r.name)}</small></th>
      ${r.cells.map(cell => `<td>${cell.map(f => `<div>${ends(f)}</div>`).join('')}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div>`;
}

/* ---------------------------- end of session ---------------------------- */
function finishSession() {
  const res = Q.results;
  const firstTry = new Map();
  for (const r of res) if (!firstTry.has(r.id)) firstTry.set(r.id, r.ok);
  const okCount = [...firstTry.values()].filter(Boolean).length;
  const wrongIds = [...firstTry].filter(([, ok]) => !ok).map(([id]) => id);
  const total = firstTry.size;
  const ratio = total ? okCount / total : 0;
  const msg = ratio === 1 ? 'Výborně! Perfect round. 🎉' : ratio >= 0.8 ? 'Skvělé! Great work.' : ratio >= 0.5 ? 'Dobře – keep going!' : 'Good practice – the mistakes will come back soon so you can fix them.';
  $('#doneBody').innerHTML = `
    <div class="card"><div class="huge">${okCount} / ${total}</div><div>correct on the first try</div><p>${msg}</p>
    <p class="muted small">🔥 Streak: ${streak()} day${streak() === 1 ? '' : 's'}</p></div>
    ${wrongIds.length ? `<h3>To review</h3>${wrongIds.map(id => {
      const e = BYID[id];
      return `<div class="rulecard"><div class="cz"><b>${esc(e.type === 'translate' ? e.base : e.base || '')}</b> → <b class="cz">${esc(displayAnswer(e))}</b></div>
        <div class="muted small">${esc(e.explain)}</div></div>`;
    }).join('')}` : ''}`;
  Q = null;
  show('done');
}

/* ---------------------------- progress screen ---------------------------- */
function renderProgress() {
  const all = agg(EX);
  let html = `<div class="stats">
      <div class="stat"><b>🔥 ${streak()}</b><span>day streak</span></div>
      <div class="stat"><b>${all.due}</b><span>due today</span></div>
      <div class="stat"><b>${pct(all.acc)}</b><span>accuracy</span></div></div>
    <p class="muted small">${all.n} answers so far · ${all.seen} of ${all.total} exercises seen · ${all.mast} mastered (box ${MASTERED_BOX}+).</p>
    <h3>By case</h3>`;
  for (const c of CASES) {
    const list = EX.filter(e => e.case === c.k);
    if (!list.length) { html += `<div class="barrow"><div class="lab"><span>${c.n}. ${c.en}</span><span>coming soon</span></div></div>`; continue; }
    const a = agg(list);
    html += barRow(`${c.n}. ${c.en}`, a, ` · ${a.due} due`);
  }
  html += `<h3>By category</h3>`;
  for (const [k, label] of Object.entries(CATS)) {
    const list = EX.filter(e => e.cat === k);
    if (list.length) html += barRow(label, agg(list));
  }
  html += `<h3>By rule <span class="muted small">(weakest first)</span></h3>`;
  const byRule = {};
  for (const e of EX) (byRule[e.rule] ||= []).push(e);
  const rows = Object.entries(byRule).map(([r, list]) => ({ r, a: agg(list) }))
    .sort((x, y) => (x.a.acc ?? 2) - (y.a.acc ?? 2));
  for (const { r, a } of rows) html += barRow(esc(RULES[r]?.title || r), a);
  $('#progBody').innerHTML = html;
}

/* ---------------------------- reference ---------------------------- */
function renderReference() {
  const tabs = CASES.map(c => ({ k: c.k, label: `${c.n}. ${c.en.slice(0, 3)}` })).concat([{ k: 'preps', label: 'All prepositions' }]);
  $('#refTabs').innerHTML = tabs.map(t => `<button class="tab ${t.k === refTab ? 'on' : ''}" data-tab="${t.k}">${t.label}</button>`).join('');
  $$('#refTabs .tab').forEach(b => b.addEventListener('click', () => { refTab = b.dataset.tab; renderReference(); }));

  if (refTab === 'preps') {
    $('#refBody').innerHTML = CASES.map(c => (PREPS[c.k] || []).length
      ? `<h3>${c.n}. ${c.en} <span class="muted small">${c.q}</span></h3>${prepList(PREPS[c.k])}` : '').join('');
    return;
  }
  const c = CASE[refTab];
  let html = `<h3>${c.n}. ${c.en} · ${c.cz} <span class="muted small">${c.q}</span></h3>`;
  const tables = Object.entries(TABLES).filter(([, t]) => t.case === c.k);
  if (!tables.length && !EX.some(e => e.case === c.k)) html += `<p class="muted">Tables for this case are coming soon.</p>`;
  for (const [, t] of tables) {
    html += tableHTML(t, null);
    if (t.notes) html += `<ul class="notes">${t.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`;
    if (t.examples) html += `<p><b>Examples:</b> ${t.examples.map(x => `<span class="cz">${esc(x)}</span>`).join(' · ')}</p>`;
  }
  const rules = Object.entries(RULES).filter(([, r]) => r.case === c.k);
  if (rules.length) {
    html += `<h3>Rules</h3>` + rules.map(([, r]) => `<div class="rulecard"><b>${esc(r.title)}</b><div>${esc(r.explain)}</div><div class="tip">💡 ${esc(r.tip)}</div></div>`).join('');
  }
  if ((PREPS[c.k] || []).length) html += `<h3>Prepositions + ${c.en.toLowerCase()}</h3>${prepList(PREPS[c.k])}`;
  else if (c.k === 'nom' || c.k === 'voc') html += `<p class="muted">No prepositions take the ${c.en.toLowerCase()}.</p>`;
  $('#refBody').innerHTML = html;
}
function prepList(list) {
  return list.map(p => `<div class="prep"><b class="cz">${esc(p.p)}</b> <span class="muted">${esc(p.en)}</span>
    ${p.two ? `<span class="tag">also + ${CASE[p.two].en.toLowerCase()}</span>` : ''}
    <div class="ex cz">${esc(p.ex)}</div></div>`).join('');
}

/* ---------------------------- settings & backup ---------------------------- */
function renderSettings() {
  $('#setLenient').checked = !!S.settings.lenient;
  $('#setHints').checked = !!S.settings.hints;
  $('#setLen').value = String(S.settings.len);
  $('#setMixLen').value = String(S.settings.mixLen || 40);
  $('#aboutLine').textContent = `App version ${APP_VERSION} · ${EX.length} exercises loaded`;
}
function exportProgress() {
  const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pady-progress-${dayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  $('#backupMsg').textContent = 'Saved to your Downloads folder.';
}
function importProgress(ev) {
  const f = ev.target.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      S = mergeState(JSON.parse(rd.result));
      save();
      $('#backupMsg').textContent = `✓ Imported progress for ${Object.keys(S.items).length} exercises.`;
      renderSettings();
    } catch (err) {
      $('#backupMsg').textContent = '✗ That file is not a Pády progress file.';
    }
    ev.target.value = '';
  };
  rd.readAsText(f);
}
let resetArmed = null;
function resetProgress() {
  const b = $('#resetBtn');
  if (!resetArmed) {
    b.textContent = 'Tap again to erase everything';
    resetArmed = setTimeout(() => { resetArmed = null; b.textContent = 'Erase all progress'; }, 4000);
    return;
  }
  clearTimeout(resetArmed); resetArmed = null;
  const settings = S.settings;
  S = defaultState(); S.settings = settings; save();
  b.textContent = 'Erase all progress';
  $('#backupMsg').textContent = 'All progress erased.';
}

init();
