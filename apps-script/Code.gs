// מתכונים - צד שרת. סקריפט Apps Script עצמאי בחשבון Google שלי.
// כל מתכון הוא קובץ JSON אחד בתיקייה "מתכונים" בדרייב, כולל התמונה.
// מתכון שנמחק נשאר כקובץ קטן עם deleted: true, כדי שהמחיקה תגיע לכל המכשירים.

const FOLDER_NAME = 'מתכונים';
const MARGIN_MS = 5 * 60 * 1000;   // חפיפה בין סנכרונים. קבלת מתכון פעמיים לא מזיקה, פספוס כן.

// ---------- התקנה (מריצים פעם אחת מהעורך) ----------

function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('KEY')) {
    props.setProperty('KEY', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  }
  if (!props.getProperty('FOLDER_ID')) {
    props.setProperty('FOLDER_ID', DriveApp.createFolder(FOLDER_NAME).getId());
  }
  Logger.log('הכל מוכן. עכשיו פורסים (Deploy) ומריצים showLink.');
}

// מדפיס את קישור החיבור לאפליקציה. מריצים אחרי הפריסה.
function showLink() {
  const key = PropertiesService.getScriptProperties().getProperty('KEY');
  const url = ScriptApp.getService().getUrl();
  if (!key || !url) { Logger.log('קודם מריצים setup ופורסים (Deploy).'); return; }
  Logger.log('https://vadimrokhlin-cpu.github.io/recipes/#api=' + encodeURIComponent(url) + '&key=' + key);
}

// ---------- API ----------

function doGet() { return json_({ ok: true }); }

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (x) { return json_({ error: 'bad request' }); }
  const props = PropertiesService.getScriptProperties();
  if (!body.key || body.key !== props.getProperty('KEY')) return json_({ error: 'unauthorized' });

  if (body.fetchUrl) return json_(fetchPage_(body.fetchUrl));

  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    return json_(sync_(DriveApp.getFolderById(props.getProperty('FOLDER_ID')), body));
  } finally {
    lock.releaseLock();
  }
}

// מביא דף מתכון והתמונה הראשית שלו. דפדפן לא יכול לקרוא אתר אחר ישירות, לכן זה נעשה כאן.
function fetchPage_(url) {
  if (!/^https?:\/\//i.test(url)) return { fetchError: 'bad url' };
  const options = { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) Mobile' } };
  const res = UrlFetchApp.fetch(url, options);
  if (res.getResponseCode() >= 400) return { fetchError: 'http ' + res.getResponseCode() };
  const html = res.getContentText();
  const out = { html: html };
  const m = /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i.exec(html);
  if (m) {
    try {
      const img = UrlFetchApp.fetch(m[1], options);
      const blob = img.getBlob();
      if (img.getResponseCode() < 400 && blob.getBytes().length < 3000000) {
        out.image = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
      }
    } catch (x) { /* בלי תמונה */ }
  }
  return out;
}

// מקבל שינויים מהמכשיר, ומחזיר את מה שהשתנה בדרייב מאז הסנכרון הקודם שלו.
// בהתנגשות מנצחת הגרסה עם updatedAt מאוחר יותר.
function sync_(folder, body) {
  const now = Date.now();
  const files = {};
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (/\.json$/.test(f.getName())) files[f.getName()] = f;
  }

  const done = [], written = {};
  (body.changes || []).forEach(r => {
    if (!r || typeof r.id !== 'string' || !/^[\w-]+$/.test(r.id) || !r.updatedAt) return;
    const name = r.id + '.json';
    const existing = files[name];
    const text = JSON.stringify(r);
    if (!existing) {
      files[name] = folder.createFile(name, text, 'application/json');
      written[name] = true;
    } else {
      const cur = read_(existing);
      if (!cur || (cur.updatedAt || 0) < r.updatedAt) {
        existing.setContent(text);
        written[name] = true;
      }
    }
    done.push(r.id);
  });

  const out = { now: now, done: done, changed: [] };
  if (body.pull !== false) {
    const since = (body.since || 0) - MARGIN_MS;
    Object.keys(files).forEach(name => {
      if (written[name] || files[name].getLastUpdated().getTime() < since) return;
      const r = read_(files[name]);
      if (r) out.changed.push(r);
    });
  }
  return out;
}

function read_(file) {
  try { return JSON.parse(file.getBlob().getDataAsString('UTF-8')); } catch (x) { return null; }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
