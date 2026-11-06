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
    <div class="tags">${tags.map(t => `<button class="tag" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <ul id="list"></ul>`;

  const paint = () => {
    const shown = recipes.filter(r => Core.matches(r, homeState.query) && (!homeState.tag || (r.tags || []).includes(homeState.tag)));
    $('list').innerHTML = shown.length ? shown.map(r => `
      <li><a href="#/r/${encodeURIComponent(r.id)}">${thumb(r)}
        <div class="rowText"><div class="rowTitle">${esc(r.title)}</div><div class="meta">${esc(metaLine(r))}</div></div>
      </a></li>`).join('') : '<li class="empty">לא נמצאו מתכונים.</li>';
    view.querySelectorAll('.tag').forEach(b => b.classList.toggle('active', b.dataset.tag === homeState.tag));
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
    <h3>מצרכים</h3>
    <ul class="ingredients">${r.ingredients.map(i => `<li>${ingredientHtml(i)}</li>`).join('')}</ul>
    <h3>הכנה</h3>
    <ol class="steps">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    ${r.notes ? `<h3>הערות</h3><div class="notes">${esc(r.notes)}</div>` : ''}
    ${source ? `<h3>מקור</h3><a class="source" href="${esc(source)}" target="_blank" rel="noopener">${esc(source)}</a>` : ''}
    <div class="actions">
      <a class="btn secondary" href="#/edit/${encodeURIComponent(r.id)}">עריכה</a>
      <button class="btn danger" id="del">מחיקה</button>
    </div>`;
  $('del').onclick = async () => {
    if (!confirm(`למחוק את "${r.title}"? אי אפשר לבטל.`)) return;
    await deleteRecipe(r);
    toast('המתכון נמחק');
    goHome();
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
  let image = existing ? existing.image || '' : '';

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
  const startImage = image;
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
    localStorage.setItem(key, JSON.stringify(values()));
  });
  $('pick').onclick = () => $('file').click();
  $('clearImg').onclick = () => { image = ''; paintImage(); };
  $('file').onchange = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try { image = await resizeImage(file); paintImage(); } catch (err) { toast('לא הצלחתי לפתוח את התמונה'); }
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
      <h3>גיבוי</h3>
      <p>${recipes.length} מתכונים. הקובץ כולל את כל המתכונים והתמונות.</p>
      <button class="btn" id="exportBtn">ייצוא לקובץ</button>
      <button class="btn secondary" id="importBtn">ייבוא מקובץ</button>
      <input type="file" id="importFile" accept=".json,application/json" hidden>
    </div>`;

  if ($('syncBtn')) $('syncBtn').onclick = () => { toast('מסנכרן...'); sync(); };
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
  const [, page, id] = location.hash.split('/');
  const param = id ? decodeURIComponent(id) : null;
  const done = page === 'r' ? showRecipe(param)
    : page === 'new' ? showForm(null)
      : page === 'edit' ? showForm(param)
        : page === 'settings' ? showSettings()
          : showHome();
  done.catch(err => { console.error(err); view.innerHTML = `<p class="empty">משהו השתבש: ${esc(err.message)}</p>`; });
}

$('menuBtn').onclick = () => { location.hash = '#/settings'; };
window.addEventListener('hashchange', route);
window.addEventListener('online', sync);
document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });

connectFromLink().then(connected => {
  if (connected) toast('מחובר לחשבון Google');
  route();
  sync();
});

if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
