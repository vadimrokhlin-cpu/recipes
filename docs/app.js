// אפליקציית מתכונים: מסכים, שמירה בטלפון (IndexedDB) וסנכרון לדרייב. הלוגיקה עצמה ב-core.js.
const $ = id => document.getElementById(id);
const view = $('view');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- שמירה ----------
// שם ייחודי: הדומיין משותף עם אפליקציית הקניות.
const DB_NAME = 'recipes-app', STORE = 'recipes';
let dbPromise;

function db() {
  dbPromise = dbPromise || new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(mode, work) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const result = work(t.objectStore(STORE));
    t.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
    t.onerror = t.onabort = () => reject(t.error);
  });
}

const allRecords = () => tx('readonly', s => s.getAll());      // כולל סימוני מחיקה
const allRecipes = async () => (await allRecords()).filter(r => !r.deleted);
const getRecipe = async id => {
  const r = await tx('readonly', s => s.get(id));
  return r && !r.deleted ? r : undefined;
};
const putRecords = list => tx('readwrite', s => list.forEach(r => s.put(r)));

async function saveRecipes(list) {
  await putRecords(list.map(r => ({ ...r, dirty: true })));
  scheduleSync();
}

const deleteRecipe = r => saveRecipes([Core.tombstone(r, Date.now())]);

// ---------- סנכרון לדרייב ----------
const CFG_KEY = 'recipes-cfg', SYNC_KEY = 'recipes-sync';
const syncState = { running: false, again: false, timer: null, error: '' };

const readJson = key => { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } };
const readSession = key => { try { return JSON.parse(sessionStorage.getItem(key)); } catch (e) { return null; } };
const config = () => readJson(CFG_KEY);
const syncInfo = () => readJson(SYNC_KEY) || { since: 0, lastOk: 0 };

function scheduleSync() {
  clearTimeout(syncState.timer);
  syncState.timer = setTimeout(sync, 1500);
}

async function postSync(cfg, body) {
  const res = await fetch(cfg.api, { method: 'POST', body: JSON.stringify({ key: cfg.key, ...body }), signal: AbortSignal.timeout(120000) });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function applyResponse(res, sent) {
  const records = await allRecords();
  const byId = new Map(records.map(r => [r.id, r]));
  const clean = [];
  for (const id of res.done) {
    const r = byId.get(id);
    if (r && r.dirty && r.updatedAt === sent.get(id)) { delete r.dirty; clean.push(r); }   // עריכה תוך כדי סנכרון נשארת ממתינה
  }
  const incoming = Core.applyRemote(records, res.changed);
  await putRecords([...clean, ...incoming]);
  return incoming.length;
}

async function sync() {
  const cfg = config();
  if (!cfg || !navigator.onLine) return;
  if (syncState.running) { syncState.again = true; return; }
  syncState.running = true;
  let received = 0;
  try {
    const info = syncInfo();
    const dirty = (await allRecords()).filter(r => r.dirty);
    const parts = Core.batches(dirty);
    if (!parts.length) parts.push([]);
    let now = info.since;
    for (let i = 0; i < parts.length; i++) {
      const sent = new Map(parts[i].map(r => [r.id, r.updatedAt]));
      const res = await postSync(cfg, { since: info.since, pull: i === parts.length - 1, changes: parts[i].map(Core.uploadable) });
      received += await applyResponse(res, sent);
      now = res.now;
    }
    localStorage.setItem(SYNC_KEY, JSON.stringify({ since: now, lastOk: Date.now() }));
    syncState.error = '';
  } catch (err) {
    syncState.error = err.message;
    console.warn('sync failed', err);
  } finally {
    syncState.running = false;
  }
  if (syncState.again) { syncState.again = false; scheduleSync(); }
  const page = location.hash.split('/')[1];
  if ((received && !page) || page === 'settings') route();
}

// קישור החיבור מגיע בצורה #api=...&key=... ונשמר רק בטלפון.
async function connectFromLink() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.get('api') || !params.get('key')) return false;
  localStorage.setItem(CFG_KEY, JSON.stringify({ api: params.get('api'), key: params.get('key') }));
  localStorage.removeItem(SYNC_KEY);
  history.replaceState(null, '', location.pathname);
  await putRecords((await allRecords()).map(r => ({ ...r, dirty: true })));
  return true;
}

// ---------- עזרים ----------
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 3000);
}

function chrome(title, { back = null, add = false } = {}) {
  $('title').textContent = title;
  document.title = title;
  $('backBtn').hidden = !back;
  $('backBtn').onclick = back;
  $('addBtn').hidden = !add;
  window.scrollTo(0, 0);
}

const goHome = () => { location.hash = '#/'; };
const thumb = r => (r.image
  ? `<img class="thumb" src="${esc(r.image)}" alt="">`
  : `<div class="thumb" aria-hidden="true">${esc(r.title.trim().charAt(0))}</div>`);

function metaLine(r) {
  const parts = [];
  if (r.minutes) parts.push(`${r.minutes} דק'`);
  if (r.servings) parts.push(`${r.servings} מנות`);
  parts.push(...(r.tags || []));
  return parts.join(' · ');
}

const amountHtml = p => (p.amount ? `<bdi dir="ltr">${esc(p.amount)}</bdi>` : '');
const ingredientHtml = i => {
  const p = Core.ingredientParts(i);
  return [amountHtml(p), esc(p.unit), esc(p.rest)].filter(Boolean).join(' ');
};

const safeUrl = u => (/^https?:\/\//i.test(u || '') ? u : '');
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const collator = new Intl.Collator('he');

// ---------- בית ----------
function remindersHtml(recipes) {
  const now = Date.now(), picks = Core.forgotten(recipes, now);
  if (!picks.length) return '';
  const heading = picks.some(r => r.lastCookedAt) ? 'מזמן לא הכנת' : 'אולי היום?';
  return `<section class="reminders"><h3>${heading}</h3>${picks.map(r => `
    <a href="#/r/${encodeURIComponent(r.id)}"><span>${esc(r.title)}</span>
      <span class="when">${r.lastCookedAt ? esc(Core.timeAgo(r.lastCookedAt, now)) : 'עוד לא הכנת'}</span></a>`).join('')}</section>`;
}

const homeState = { query: '', tag: '' };

async function showHome() {
  chrome('מתכונים', { add: true });
  const recipes = (await allRecipes()).sort((a, b) => collator.compare(a.title, b.title));
  const tags = [...new Set(recipes.flatMap(r => r.tags || []))].sort(collator.compare);
  if (homeState.tag && !tags.includes(homeState.tag)) homeState.tag = '';

  if (!recipes.length) {
    view.innerHTML = '<p class="empty">עוד אין מתכונים.<br>לוחצים על הפלוס כדי להוסיף את הראשון.</p>';
    return;
  }
  view.innerHTML = `
    <input id="search" type="search" placeholder="חיפוש לפי שם, מצרך או תגית" autocomplete="off" value="${esc(homeState.query)}">
    ${remindersHtml(recipes)}
    <div class="tags">${tags.map(t => `<button class="tag" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <ul id="list"></ul>`;

  const paint = () => {
    const shown = recipes.filter(r => Core.matches(r, homeState.query) && (!homeState.tag || (r.tags || []).includes(homeState.tag)));
    $('list').innerHTML = shown.length ? shown.map(r => `
      <li><a href="#/r/${encodeURIComponent(r.id)}">${thumb(r)}
        <div class="rowText"><div class="rowTitle">${esc(r.title)}</div><div class="meta">${esc(metaLine(r))}</div></div>
      </a></li>`).join('') : '<li class="empty">לא נמצאו מתכונים.</li>';
    view.querySelectorAll('.tag').forEach(b => b.classList.toggle('active', b.dataset.tag === homeState.tag));
    const reminders = view.querySelector('.reminders');
    if (reminders) reminders.hidden = !!(homeState.query.trim() || homeState.tag);
  };
  $('search').oninput = e => { homeState.query = e.target.value; paint(); };
  view.querySelector('.tags').onclick = e => {
    const tag = e.target.dataset.tag;
    if (tag === undefined) return;
    homeState.tag = homeState.tag === tag ? '' : tag;
    paint();
  };
  paint();
}

// ---------- התאמת כמויות ----------
// נשמר לכל מתכון רק עד סגירת האפליקציה, כדי שההתאמה תישאר גם במצב בישול.
const factorKey = id => `recipes-factor-${id}`;
const getFactor = id => +sessionStorage.getItem(factorKey(id)) || 1;
const setFactor = (id, f) => sessionStorage.setItem(factorKey(id), String(f));

function parseAmount(text) {
  const parsed = Core.parseIngredient(`${String(text).trim().replace(',', '.')} x`);
  return parsed.qty > 0 ? parsed.qty : null;
}

function askAmount(label, value) {
  const dlg = $('amountDialog'), input = $('amountInput');
  $('amountLabel').textContent = label;
  input.value = value;
  dlg.returnValue = '';
  dlg.showModal();
  input.select();
  return new Promise(resolve => {
    dlg.onclose = () => resolve(dlg.returnValue === 'ok' ? parseAmount(input.value) : null);
  });
}

function stepHtml(text, recipe, stepIndex) {
  let html = '', at = 0;
  for (const t of Core.findTimers(text)) {
    html += esc(text.slice(at, t.start))
      + `<button type="button" class="timerBtn" data-seconds="${t.seconds}" data-label="${esc(t.text)}" data-title="${esc(recipe.title)}" data-recipe="${esc(recipe.id)}" data-step="${stepIndex}">${esc(t.text)}</button>`;
    at = t.end;
  }
  return html + esc(text.slice(at));
}

function paintScaler(r) {
  const f = getFactor(r.id), box = $('scaler');
  const servings = r.servings ? roundServings(r.servings * f) : null;
  box.innerHTML = `
    <button class="step" data-delta="-1" aria-label="פחות">−</button>
    <span class="value">${servings ? `${servings} מנות` : `פי ${esc(Core.formatQty(f))}`}</span>
    <button class="step" data-delta="1" aria-label="יותר">+</button>
    ${f !== 1 ? '<button class="reset">איפוס</button>' : ''}`;
  const list = view.querySelector('.ingredients');
  list.classList.toggle('scaled', f !== 1);
  list.innerHTML = r.ingredients.map((i, n) => `<li data-n="${n}" class="${i.qty === null ? '' : 'tappable'}">${ingredientHtml(Core.scaleIngredient(i, f))}</li>`).join('');
  view.querySelector('.steps').innerHTML = r.steps.map((s, n) => `<li>${stepHtml(Core.scaleStep(s, f), r, n)}</li>`).join('');
}

const roundServings = s => Math.round(s * 2) / 2;

function bindScaler(r) {
  const repaint = f => { setFactor(r.id, f); paintScaler(r); };
  $('scaler').onclick = e => {
    const f = getFactor(r.id);
    if (e.target.classList.contains('reset')) { repaint(1); return; }
    const delta = +e.target.dataset.delta;
    if (!delta) return;
    if (r.servings) repaint(Math.max(1, roundServings(r.servings * f) + delta) / r.servings);
    else repaint(Math.max(0.5, Math.round((f + delta * 0.5) * 2) / 2));
  };
  view.querySelector('.ingredients').onclick = async e => {
    const li = e.target.closest('li');
    if (!li) return;
    const ing = r.ingredients[+li.dataset.n];
    if (ing.qty === null) return;
    const shown = Core.scaleIngredient(ing, getFactor(r.id));
    const p = Core.ingredientParts(shown);
    const name = ing.item.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    const amount = await askAmount(`כמה ${name} יש לך? (${p.unit || 'יחידות'})`, Core.formatQty(shown.qty));
    if (amount) repaint(amount / ing.qty);
  };
}

// ---------- מתכון ----------
async function showRecipe(id) {
  const r = await getRecipe(id);
  if (!r) { goHome(); return; }
  chrome(r.title, { back: goHome });
  const source = safeUrl(r.source);
  view.innerHTML = `
    ${r.image ? `<img class="hero" src="${esc(r.image)}" alt="">` : ''}
    <h2>${esc(r.title)}</h2>
    <div class="meta">${esc(metaLine(r))}</div>
    ${r.lastCookedAt ? `<div class="cookedLine">בישלת ${esc(Core.timeAgo(r.lastCookedAt, Date.now()))}${r.cookedCount > 1 ? `, ${r.cookedCount} פעמים עד היום` : ''}</div>` : ''}
    <div class="primaryRow">
      <a class="btn" href="#/cook/${encodeURIComponent(r.id)}">התחלת בישול</a>
      <a class="btn secondary" href="#/shop/${encodeURIComponent(r.id)}">לקניות</a>
    </div>
    <h3>מצרכים</h3>
    <div class="scaler" id="scaler"></div>
    <ul class="ingredients"></ul>
    <p class="hint">לוחצים על מצרך כדי להתאים הכל לפי מה שיש לך.</p>
    <h3>הכנה</h3>
    <ol class="steps"></ol>
    ${r.notes ? `<h3>הערות</h3><div class="notes">${esc(r.notes)}</div>` : ''}
    ${source ? `<h3>מקור</h3><a class="source" href="${esc(source)}" target="_blank" rel="noopener">${esc(source)}</a>` : ''}
    <div class="actions">
      <a class="btn secondary" href="#/edit/${encodeURIComponent(r.id)}">עריכה</a>
      <button class="btn danger" id="del">מחיקה</button>
    </div>
    <button class="linkBtn" id="cookedToday">בישלתי היום</button>`;
  paintScaler(r);
  bindScaler(r);
  $('cookedToday').onclick = async () => {
    await markCooked(r);
    toast('נשמר');
    showRecipe(id);
  };
  $('del').onclick = async () => {
    if (!confirm(`למחוק את "${r.title}"? אי אפשר לבטל.`)) return;
    await deleteRecipe(r);
    toast('המתכון נמחק');
    goHome();
  };
}

// ---------- טיימרים ----------
const TIMERS_KEY = 'recipes-timers';
let timers = readJson(TIMERS_KEY) || [];
let audioCtx = null, lastRing = 0;

const saveTimers = () => localStorage.setItem(TIMERS_KEY, JSON.stringify(timers));

// צליל נוצר כאן בקוד, כך שאין קובץ שצריך להוריד.
function wavUrl(seconds, sample) {
  const rate = 8000, count = Math.floor(rate * seconds);
  const bytes = new DataView(new ArrayBuffer(44 + count * 2));
  const text = (at, s) => [...s].forEach((c, i) => bytes.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF'); bytes.setUint32(4, 36 + count * 2, true); text(8, 'WAVEfmt ');
  bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 1, true);
  bytes.setUint32(24, rate, true); bytes.setUint32(28, rate * 2, true);
  bytes.setUint16(32, 2, true); bytes.setUint16(34, 16, true);
  text(36, 'data'); bytes.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) bytes.setInt16(44 + i * 2, sample(i / rate) * 32767, true);
  const raw = Array.from(new Uint8Array(bytes.buffer), b => String.fromCharCode(b)).join('');
  return 'data:audio/wav;base64,' + btoa(raw);
}

// צליל כמעט לא נשמע: כל עוד הוא מתנגן, Android לא מקפיא את האפליקציה כשיוצאים ממנה.
const QUIET_SOUND = () => wavUrl(1, t => (Math.floor(t * 8000) % 2 ? 0.0004 : -0.0004));
const ALARM_SOUND = () => wavUrl(1.6, t => (t % 0.4 < 0.22 ? Math.sin(2 * Math.PI * 880 * t) * 0.9 : 0));
let player = null, playerMode = '';

function setSound(mode) {
  if (!mode) {
    if (player) player.pause();
    playerMode = '';
    return;
  }
  player = player || Object.assign(new Audio(), { loop: true });
  if (playerMode !== mode) {
    player.src = mode === 'alarm' ? ALARM_SOUND() : QUIET_SOUND();
    playerMode = mode;
  }
  if (player.paused) player.play().catch(() => { /* עוד אין לחיצה של המשתמש */ });
}

function syncSound() {
  const done = timers.some(t => t.endAt <= Date.now());
  setSound(done ? 'alarm' : timers.length ? 'quiet' : '');
  if ('mediaSession' in navigator && window.MediaMetadata && timers.length) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: done ? 'הזמן נגמר' : 'טיימר פועל', artist: timers[0].title || 'מתכונים' });
  }
}

const timerHash = t => `#/cook/${encodeURIComponent(t.recipeId)}/${t.step}`;

async function notifyTimer(t) {
  if (!document.hidden || !('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification('הזמן נגמר', {
      body: `${t.label} · ${t.title}`, tag: t.id, renotify: true, requireInteraction: true,
      vibrate: [400, 200, 400, 200, 400], icon: 'icon-192.png', data: { hash: t.recipeId ? timerHash(t) : '#/' },
    });
  } catch (e) { /* הצלצול נשאר */ }
}

async function clearNotification(id) {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
  const reg = await navigator.serviceWorker.ready;
  (await reg.getNotifications({ tag: id })).forEach(n => n.close());
}

function startTimer(seconds, label, title, recipeId, step) {
  try {               // צליל מותר רק אחרי לחיצה של המשתמש, לכן פותחים אותו כאן
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
  } catch (e) { /* בלי צליל, הרטט וההבהוב נשארים */ }
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  timers.push({ id: newId(), label, title, recipeId, step, endAt: Date.now() + seconds * 1000 });
  saveTimers();
  paintTimers();
  syncSound();
}

function beep() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  [0, 0.25, 0.5].forEach(at => {
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.25;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + at);
    osc.stop(audioCtx.currentTime + at + 0.15);
  });
}

function paintTimers() {
  const box = $('timers'), now = Date.now();
  box.hidden = !timers.length;
  document.body.classList.toggle('hasTimers', timers.length > 0);
  box.innerHTML = timers.map(t => {
    const left = (t.endAt - now) / 1000;
    return `<div class="timer${left <= 0 ? ' done' : ''}${t.recipeId ? ' canOpen' : ''}" data-open="${esc(t.id)}">
      <span class="clock">${left <= 0 ? 'הזמן נגמר' : Core.formatClock(left)}</span>
      <span class="name">${esc(t.label)}<small>${esc(t.title)}</small></span>
      <button data-id="${esc(t.id)}">${left <= 0 ? 'סגירה' : 'ביטול'}</button>
    </div>`;
  }).join('');
}

function tickTimers() {
  if (!timers.length) return;
  paintTimers();
  syncSound();
  timers.filter(t => t.endAt <= Date.now() && !t.notified).forEach(t => {
    t.notified = true;
    saveTimers();
    notifyTimer(t);
  });
  if (timers.some(t => t.endAt <= Date.now()) && Date.now() - lastRing > 2000) {
    lastRing = Date.now();
    if (!player || player.paused) beep();
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  }
}

// ---------- מצב בישול ----------
let wakeLock = null, cooking = false;

async function keepAwake() {
  if (!cooking || wakeLock || !('wakeLock' in navigator) || document.hidden) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) { /* המכשיר סירב, למשל בסוללה נמוכה: ממשיכים בלי */ }
}

function stopCooking() {
  cooking = false;
  view.classList.remove('cooking');
  if (wakeLock) wakeLock.release();
}

const cookKey = id => `recipes-cook-${id}`;

function markCooked(r) {
  const now = Date.now();
  return saveRecipes([{ ...r, lastCookedAt: now, cookedCount: (r.cookedCount || 0) + 1, updatedAt: now }]);
}

async function showCook(id, stepFromTimer) {
  const r = await getRecipe(id);
  if (!r) { goHome(); return; }
  cooking = true;
  keepAwake();
  view.classList.add('cooking');
  const f = getFactor(id);
  const state = readSession(cookKey(id)) || { step: 0, checked: [] };
  if (stepFromTimer !== undefined && stepFromTimer !== '') {
    state.step = Math.max(0, +stepFromTimer || 0);
    history.replaceState(null, '', `#/cook/${encodeURIComponent(id)}`);
  }
  const toRecipe = () => { location.hash = `#/r/${encodeURIComponent(id)}`; };
  const items = r.ingredients.map(i => Core.scaleIngredient(i, f));

  const paint = () => {
    const step = Math.min(state.step, r.steps.length - 1), last = step === r.steps.length - 1;
    sessionStorage.setItem(cookKey(id), JSON.stringify(state));
    chrome(`שלב ${step + 1} מתוך ${r.steps.length}`, { back: toRecipe });
    const here = Core.stepIngredients(items, r.steps[step]);
    const open = view.querySelector('.cookAll') && view.querySelector('.cookAll').open;
    view.innerHTML = `
      <div class="cookText">${stepHtml(Core.scaleStep(r.steps[step], f), r, step)}</div>
      ${here.length ? `<ul class="stepItems">${here.map(i => `<li>${ingredientHtml(i)}</li>`).join('')}</ul>` : ''}
      <details class="cookAll"${open ? ' open' : ''}>
        <summary>כל המצרכים</summary>
        ${items.map((i, n) => `<label><input type="checkbox" data-n="${n}"${state.checked.includes(n) ? ' checked' : ''}><span>${ingredientHtml(i)}</span></label>`).join('')}
      </details>
      <div class="cookNav">
        <button class="btn secondary" id="prev"${step ? '' : ' disabled'}>הקודם</button>
        <button class="btn" id="next">${last ? 'סיימתי' : 'הבא'}</button>
      </div>`;
    $('prev').onclick = () => go(-1);
    $('next').onclick = () => (last ? finish() : go(1));
  };
  const go = d => {
    state.step = Math.max(0, Math.min(r.steps.length - 1, state.step + d));
    paint();
  };
  const finish = async () => {
    if (confirm(`בישלת את "${r.title}"?`)) {
      await markCooked(r);
      toast('נשמר. בתיאבון!');
    }
    sessionStorage.removeItem(cookKey(id));
    toRecipe();
  };

  view.onchange = e => {
    if (e.target.type !== 'checkbox') return;
    const n = +e.target.dataset.n;
    state.checked = e.target.checked ? [...state.checked, n] : state.checked.filter(x => x !== n);
    sessionStorage.setItem(cookKey(id), JSON.stringify(state));
  };
  // בעברית הדפדוף הוא מימין לשמאל: החלקה ימינה מעבירה לשלב הבא.
  let touchX = null;
  view.ontouchstart = e => { touchX = e.touches[0].clientX; };
  view.ontouchend = e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 70) go(dx > 0 ? 1 : -1);
  };
  paint();
}

// ---------- ייבוא מקישור או מטקסט ----------
// התוצאה נכנסת לטופס רגיל כטיוטה, כדי שאפשר יהיה לבדוק ולתקן לפני השמירה.
function openDraft(parsed, source, image) {
  const draft = {
    title: parsed.title, ingredients: parsed.ingredients.join('\n'), steps: parsed.steps.join('\n'),
    notes: parsed.notes.join('\n'), source: source || '', image: image || '',
  };
  localStorage.setItem(draftKey(null), JSON.stringify(draft));
  location.hash = '#/new';
}

async function pageImage(dataUrl) {
  if (!dataUrl) return '';
  try {
    return await resizeImage(await (await fetch(dataUrl)).blob());
  } catch (e) {
    return '';     // מתכון בלי תמונה עדיף על ייבוא שנכשל
  }
}

async function showImport() {
  chrome('ייבוא מתכון', { back: () => { location.hash = '#/new'; } });
  const cfg = config();
  view.innerHTML = `
    <div class="card importCard">
      <h3>מקישור</h3>
      ${cfg ? `<input type="url" id="importUrl" dir="ltr" placeholder="https://..." autocomplete="off">
      <button class="btn" id="fetchBtn">הבאת המתכון</button>` : '<p class="warn">צריך קודם לחבר את חשבון Google.</p>'}
    </div>
    <div class="card importCard">
      <h3>הדבקת טקסט</h3>
      <p>מתאים לפייסבוק ואינסטגרם. עדיף שהטקסט יכלול כותרות כמו "מצרכים" ו"אופן ההכנה".</p>
      <textarea id="importText" aria-label="טקסט המתכון"></textarea>
      <button class="btn secondary" id="pasteBtn">המשך</button>
    </div>`;

  if (cfg) {
    $('fetchBtn').onclick = async () => {
      const url = $('importUrl').value.trim();
      if (!/^https?:\/\//i.test(url)) { toast('צריך קישור מלא שמתחיל ב-https'); return; }
      $('fetchBtn').disabled = true;
      $('fetchBtn').textContent = 'מביא...';
      try {
        const res = await postSync(cfg, { fetchUrl: url });
        if (res.fetchError) throw new Error(/^http 4/.test(res.fetchError) ? 'blocked' : res.fetchError);
        if (!res.html) throw new Error('old server');
        const parsed = Core.parseRecipeHtml(res.html);
        if (!parsed.ingredients.length) throw new Error('not found');
        openDraft(parsed, url, await pageImage(res.image));
        return;
      } catch (err) {
        const message = {
          blocked: 'האתר חסם את הגישה. אפשר להעתיק את הטקסט ולהדביק למטה.',
          'old server': 'צריך לעדכן קודם את הסקריפט ב-Google.',
          'not found': 'לא מצאתי מתכון בדף. אפשר להעתיק את הטקסט ולהדביק למטה.',
        }[err.message] || `הייבוא נכשל: ${err.message}`;
        toast(message);
      }
      $('fetchBtn').disabled = false;
      $('fetchBtn').textContent = 'הבאת המתכון';
    };
  }
  $('pasteBtn').onclick = () => {
    const text = $('importText').value;
    if (!text.trim()) { toast('אין טקסט'); return; }
    const parsed = Core.parseRecipeText(text);
    if (!parsed.ingredients.length) {
      toast('לא זיהיתי כותרות, אז כל הטקסט נכנס לשלבים. כדאי לסדר לפני השמירה.');
      openDraft({ title: '', ingredients: [], steps: text.split('\n').filter(l => l.trim()), notes: [] });
      return;
    }
    openDraft(parsed);
  };
}

// ---------- שליחה לרשימת הקניות ----------
// החיבור נקרא מאפליקציית הקניות, שיושבת באותו דומיין. לא משנים שם כלום, רק קוראים את הכתובת והמפתח.
const STAPLES_KEY = 'recipes-staples';
const staples = () => readJson(STAPLES_KEY) || Core.DEFAULT_STAPLES;
const saveStaples = list => localStorage.setItem(STAPLES_KEY, JSON.stringify(list));
const shoppingConfig = () => readJson('fs_cfg');
const shoppingLists = () => (readJson('fs_db') || {}).lists || ['קניות'];
const norm = s => String(s).replace(/\s+/g, ' ').trim().toLowerCase();

async function showShop(id) {
  const r = await getRecipe(id);
  if (!r) { goHome(); return; }
  const toRecipe = () => { location.hash = `#/r/${encodeURIComponent(id)}`; };
  chrome('שליחה לקניות', { back: toRecipe });
  const cfg = shoppingConfig();
  if (!cfg) {
    view.innerHTML = '<p class="empty">אפליקציית הקניות עוד לא מחוברת בטלפון הזה.<br>פותחים אותה פעם אחת, וחוזרים לכאן.</p>';
    return;
  }

  const f = getFactor(id), lists = shoppingLists(), seen = new Set();
  const rows = r.ingredients.flatMap(i => {
    const name = Core.shoppingName(i), key = norm(name);
    if (seen.has(key)) return [];
    seen.add(key);
    const scaled = Core.scaleIngredient(i, f), p = Core.ingredientParts(scaled);
    return [{ name, amount: [p.amount, p.unit].filter(Boolean).join(' ') }];
  });

  view.innerHTML = `
    <p class="meta">${esc(r.title)}. מה שמסומן יישלח לרשימה. מה שיש בבית, מורידים את הסימון.</p>
    ${lists.length > 1 ? `<label>רשימה<select id="shopList">${lists.map(l => `<option${l === 'קניות' ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>` : ''}
    <div id="shopRows">${rows.map((row, n) => {
    const home = Core.isStaple(row.name, staples());
    return `<div class="shopRow${home ? ' off' : ''}" data-n="${n}">
        <input type="checkbox" aria-label="לשלוח"${home ? '' : ' checked'}>
        <input type="text" value="${esc(row.name)}" aria-label="שם המוצר">
        <span class="shopAmount">${esc(row.amount)}</span>
        <button type="button" class="${home ? 'on' : ''}" aria-label="תמיד יש בבית" title="תמיד יש בבית">🏠</button>
      </div>`;
  }).join('')}</div>
    <p class="hint">🏠 = תמיד יש בבית. בפעם הבאה המוצר לא יסומן.</p>
    <div class="actions"><button class="btn" id="send"></button></div>`;

  const boxes = () => [...view.querySelectorAll('.shopRow')];
  const paintCount = () => {
    const count = boxes().filter(b => b.querySelector('[type=checkbox]').checked && b.querySelector('[type=text]').value.trim()).length;
    $('send').textContent = `שליחת ${count} מוצרים`;
    $('send').disabled = !count;
  };
  $('shopRows').onchange = e => {
    if (e.target.type === 'checkbox') e.target.closest('.shopRow').classList.toggle('off', !e.target.checked);
    paintCount();
  };
  $('shopRows').oninput = paintCount;
  $('shopRows').onclick = e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const row = btn.closest('.shopRow'), name = row.querySelector('[type=text]').value.trim();
    const on = !btn.classList.contains('on');
    btn.classList.toggle('on', on);
    saveStaples(on ? [...new Set([...staples(), name])] : staples().filter(s => !Core.isStaple(name, [s])));
    const box = row.querySelector('[type=checkbox]');
    box.checked = !on;
    row.classList.toggle('off', on);
    paintCount();
  };
  paintCount();

  $('send').onclick = async () => {
    const list = $('shopList') ? $('shopList').value : lists[0];
    const names = [...new Set(boxes()
      .filter(b => b.querySelector('[type=checkbox]').checked)
      .map(b => b.querySelector('[type=text]').value.replace(/\s+/g, ' ').trim())
      .filter(Boolean))];
    const ops = names.map(name => ({
      type: 'upsert', id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      list, name, checked: false, base: 0,
    }));
    $('send').disabled = true;
    $('send').textContent = 'שולח...';
    try {
      const res = await fetch(cfg.api, { method: 'POST', body: JSON.stringify({ key: cfg.key, ops }), signal: AbortSignal.timeout(60000) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast(`נשלחו ${ops.length} מוצרים לרשימה "${list}"`);
      toRecipe();
    } catch (err) {
      toast('השליחה נכשלה. בדוק שיש אינטרנט ונסה שוב.');
      paintCount();
    }
  };
}

// ---------- הוספה ועריכה ----------
const draftKey = id => `recipes-draft-${id || 'new'}`;

function resizeImage(file) {
  return createImageBitmap(file).then(bitmap => {
    const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.78);
  });
}

function parsedPreview(text) {
  return Core.parseIngredients(text).map(i => {
    if (i.qty === null) return `<li class="noQty">${esc(i.item)} (בלי כמות)</li>`;
    const p = Core.ingredientParts(i);
    return `<li><b>${amountHtml(p)}${p.unit ? ' ' + esc(p.unit) : ''}</b> · ${esc(p.rest)}</li>`;
  }).join('');
}

async function showForm(id) {
  const existing = id ? await getRecipe(id) : null;
  if (id && !existing) { goHome(); return; }
  const key = draftKey(id);
  const fromRecipe = r => ({
    title: r.title, servings: r.servings ?? '', minutes: r.minutes ?? '', tags: (r.tags || []).join(', '),
    ingredients: r.ingredients.map(i => i.raw || Core.formatIngredient(i)).join('\n'),
    steps: r.steps.join('\n'), notes: r.notes || '', source: r.source || '',
  });
  const blank = { title: '', servings: '', minutes: '', tags: '', ingredients: '', steps: '', notes: '', source: '' };
  const start = existing ? fromRecipe(existing) : blank;
  let draft = null;
  try { draft = JSON.parse(localStorage.getItem(key)); } catch (e) { /* טיוטה פגומה: מתעלמים */ }
  const f = { ...start, ...(draft || {}) };
  let image = (draft && draft.image) || (existing ? existing.image || '' : '');

  const leave = () => {
    localStorage.removeItem(key);
    location.hash = id ? `#/r/${encodeURIComponent(id)}` : '#/';
  };
  const back = () => {
    if (!isDirty() || confirm('לצאת בלי לשמור? השינויים יימחקו.')) leave();
  };
  chrome(existing ? 'עריכת מתכון' : 'מתכון חדש', { back });

  view.innerHTML = `
    <form id="form" autocomplete="off">
      ${existing ? '' : '<a class="importLink" href="#/import">ייבוא מקישור או הדבקת טקסט</a>'}
      <label>שם המתכון<input type="text" name="title" required value="${esc(f.title)}"></label>
      <label>תמונה <small>(לא חובה)</small>
        <div class="imageRow">
          <span id="imgPreview"></span>
          <button type="button" class="btn secondary small" id="pick">בחירת תמונה</button>
          <button type="button" class="btn secondary small" id="clearImg" hidden>הסרה</button>
        </div>
      </label>
      <input type="file" id="file" accept="image/*" hidden>
      <div class="pair">
        <label>מנות<input type="number" name="servings" min="1" inputmode="numeric" value="${esc(f.servings)}"></label>
        <label>זמן (דקות)<input type="number" name="minutes" min="1" inputmode="numeric" value="${esc(f.minutes)}"></label>
      </div>
      <label>תגיות <small>(מופרדות בפסיק)</small><input type="text" name="tags" value="${esc(f.tags)}"></label>
      <label>מצרכים <small>(בשורות, בפסיקים או ברצף)</small><textarea name="ingredients" required>${esc(f.ingredients)}</textarea></label>
      <ul class="parsed" id="parsed"></ul>
      <label>שלבי הכנה <small>(כל שלב בשורה)</small><textarea name="steps" required>${esc(f.steps)}</textarea></label>
      <label>הערות <small>(לא חובה)</small><textarea name="notes" style="min-height:80px">${esc(f.notes)}</textarea></label>
      <label>קישור למקור <small>(לא חובה)</small><input type="url" name="source" dir="ltr" value="${esc(f.source)}"></label>
      <div class="actions"><button class="btn" type="submit">שמירה</button></div>
    </form>`;

  const form = $('form');
  const values = () => Object.fromEntries(new FormData(form).entries());
  const startJson = JSON.stringify(start);
  const startImage = existing ? existing.image || '' : '';
  const saveDraft = () => localStorage.setItem(key, JSON.stringify({ ...values(), image }));
  function isDirty() { return JSON.stringify({ ...start, ...values() }) !== startJson || image !== startImage; }

  const paintImage = () => {
    $('imgPreview').innerHTML = image ? `<img class="thumb" src="${esc(image)}" alt="">` : '';
    $('clearImg').hidden = !image;
    $('pick').textContent = image ? 'החלפה' : 'בחירת תמונה';
  };
  const paintParsed = () => { $('parsed').innerHTML = parsedPreview(form.ingredients.value); };
  paintImage();
  paintParsed();

  form.addEventListener('input', () => {
    paintParsed();
    saveDraft();
  });
  $('pick').onclick = () => $('file').click();
  $('clearImg').onclick = () => { image = ''; paintImage(); saveDraft(); };
  $('file').onchange = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try { image = await resizeImage(file); paintImage(); saveDraft(); } catch (err) { toast('לא הצלחתי לפתוח את התמונה'); }
  };

  form.onsubmit = async e => {
    e.preventDefault();
    const v = values();
    const now = Date.now();
    const recipe = {
      ...(existing || { id: newId(), createdAt: now, lastCookedAt: null, cookedCount: 0 }),
      title: v.title.trim(),
      image,
      servings: v.servings ? +v.servings : null,
      minutes: v.minutes ? +v.minutes : null,
      tags: Core.parseTags(v.tags),
      ingredients: Core.parseIngredients(v.ingredients),
      steps: Core.parseSteps(v.steps),
      notes: v.notes.trim(),
      source: v.source.trim(),
      updatedAt: now,
    };
    try {
      await saveRecipes([recipe]);
    } catch (err) {
      toast('השמירה נכשלה: ' + err.message);
      return;
    }
    localStorage.removeItem(key);
    location.hash = `#/r/${encodeURIComponent(recipe.id)}`;
  };
}

// ---------- הגדרות וגיבוי ----------
async function showSettings() {
  chrome('הגדרות', { back: goHome });
  const recipes = await allRecipes();
  const pending = (await allRecords()).filter(r => r.dirty).length;
  const cfg = config(), info = syncInfo();
  const when = info.lastOk ? new Date(info.lastOk).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : 'עדיין לא';
  view.innerHTML = `
    <div class="card">
      <h3>חשבון Google</h3>
      ${cfg ? `
        <p>מחובר. סנכרון אחרון: ${esc(when)}. ממתינים להעלאה: ${pending}.</p>
        ${syncState.error ? `<p class="warn">הסנכרון האחרון נכשל: ${esc(syncState.error)}</p>` : ''}
        <button class="btn secondary" id="syncBtn">סנכרון עכשיו</button>`
    : '<p class="warn">לא מחובר. המתכונים שמורים רק בטלפון הזה. כדי לחבר, פותחים את קישור החיבור.</p>'}
    </div>
    <div class="card">
      <h3>תמיד יש בבית</h3>
      <p>מוצרים שלא יסומנו אוטומטית בשליחה לקניות. מופרדים בפסיק.</p>
      <textarea id="staples" aria-label="תמיד יש בבית">${esc(staples().join(', '))}</textarea>
    </div>
    <div class="card">
      <h3>גיבוי</h3>
      <p>${recipes.length} מתכונים. הקובץ כולל את כל המתכונים והתמונות.</p>
      <button class="btn" id="exportBtn">ייצוא לקובץ</button>
      <button class="btn secondary" id="importBtn">ייבוא מקובץ</button>
      <input type="file" id="importFile" accept=".json,application/json" hidden>
    </div>`;

  if ($('syncBtn')) $('syncBtn').onclick = () => { toast('מסנכרן...'); sync(); };
  $('staples').onchange = e => saveStaples(Core.parseTags(e.target.value));
  $('exportBtn').onclick = () => {
    const date = new Date().toLocaleDateString('sv');
    const blob = new Blob([JSON.stringify({ app: 'recipes', version: 1, recipes: recipes.map(Core.uploadable) }, null, 1)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${date}-recipes.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  $('importBtn').onclick = () => $('importFile').click();
  $('importFile').onchange = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = Array.isArray(data) ? data : data.recipes;
      if (!Array.isArray(incoming)) throw new Error('bad file');
      const { write, skipped } = Core.mergeBackup(await allRecords(), incoming);
      await saveRecipes(write);
      toast(`נוספו או עודכנו ${write.length} מתכונים, ${skipped} דולגו`);
      showSettings();
    } catch (err) {
      toast('הקובץ לא נראה כמו גיבוי מתכונים');
    }
  };
}

// ---------- ניווט ----------
function route() {
  const [, page, id, extra] = location.hash.split('/');
  const param = id ? decodeURIComponent(id) : null;
  stopCooking();
  view.onchange = view.ontouchstart = view.ontouchend = null;
  const done = page === 'r' ? showRecipe(param)
    : page === 'cook' ? showCook(param, extra)
      : page === 'shop' ? showShop(param)
        : page === 'import' ? showImport()
      : page === 'new' ? showForm(null)
        : page === 'edit' ? showForm(param)
          : page === 'settings' ? showSettings()
            : showHome();
  done.catch(err => { console.error(err); view.innerHTML = `<p class="empty">משהו השתבש: ${esc(err.message)}</p>`; });
}

$('menuBtn').onclick = () => { location.hash = '#/settings'; };
window.addEventListener('hashchange', route);
window.addEventListener('online', sync);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  sync();
  keepAwake();
  tickTimers();
});
document.addEventListener('click', e => {
  const t = e.target.closest('.timerBtn');
  if (t) startTimer(+t.dataset.seconds, t.dataset.label, t.dataset.title, t.dataset.recipe, +t.dataset.step);
  else if (timers.length) syncSound();     // אחרי פתיחה מחדש, הצליל חוזר בלחיצה הראשונה
});
$('timers').onclick = e => {
  const id = e.target.dataset.id;
  if (id) {
    timers = timers.filter(t => t.id !== id);
    saveTimers();
    paintTimers();
    syncSound();
    clearNotification(id);
    return;
  }
  const row = e.target.closest('.timer');
  const timer = row && timers.find(t => t.id === row.dataset.open);
  if (timer && timer.recipeId) {
    const target = timerHash(timer);
    if (location.hash === target) route();
    else location.hash = target;
  }
};
navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', e => {
  if (e.data && e.data.openHash) location.hash = e.data.openHash;
});
setInterval(tickTimers, 1000);
paintTimers();
syncSound();

connectFromLink().then(connected => {
  if (connected) toast('מחובר לחשבון Google');
  route();
  sync();
});

if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
