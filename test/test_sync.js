// סימולציה של סנכרון: שני מכשירים מול השרת האמיתי (Code.gs) עם דרייב מדומה.
// הרצה: node test/test_sync.js
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const Core = require('../docs/core.js');

let clock = 1000000;
const files = [];
function fakeFile(name, text) {
  const f = {
    name, text, updated: clock,
    getName: () => f.name,
    getLastUpdated: () => new Date(f.updated),
    getBlob: () => ({ getDataAsString: () => f.text }),
    setContent(t) { f.text = t; f.updated = clock; },
  };
  return f;
}
const folder = {
  getFiles() { let i = 0; return { hasNext: () => i < files.length, next: () => files[i++] }; },
  createFile(name, text) { const f = fakeFile(name, text); files.push(f); return f; },
};
const props = { KEY: 'secret', FOLDER_ID: 'folder' };
const fetched = [];
const sandbox = {
  Date: class extends Date { static now() { return clock; } },
  JSON, Object,
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k], setProperty: (k, v) => { props[k] = v; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  DriveApp: { getFolderById: () => folder, createFolder: () => ({ getId: () => 'folder' }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ setMimeType: () => t }) },
  Utilities: { getUuid: () => 'u-u', base64Encode: () => 'QUJD' },
  Logger: { log() {} },
  UrlFetchApp: {
    fetch(url) {
      fetched.push(url);
      const page = '<meta property="og:image" content="https://x.test/a.jpg"><h2>מצרכים</h2>';
      return {
        getResponseCode: () => (url.includes('blocked') ? 403 : 200),
        getContentText: () => page,
        getBlob: () => ({ getBytes: () => [1, 2], getContentType: () => 'image/jpeg' }),
      };
    },
  },
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8'), sandbox);
const call = body => JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify(body) } }));

// מכשיר מדומה, באותו סדר פעולות כמו app.js
class Device {
  constructor() { this.db = new Map(); this.since = 0; }
  save(r) { this.db.set(r.id, { ingredients: [], steps: [], ...r, updatedAt: ++clock, dirty: true }); }
  remove(id) { this.db.set(id, Core.tombstone(this.db.get(id), ++clock)); }
  view(id) { const r = this.db.get(id); return r && !r.deleted ? r : undefined; }
  sync() {
    const dirty = [...this.db.values()].filter(r => r.dirty);
    const sent = new Map(dirty.map(r => [r.id, r.updatedAt]));
    const res = call({ key: 'secret', since: this.since, changes: dirty.map(Core.uploadable) });
    assert.ok(!res.error);
    res.done.forEach(id => { const r = this.db.get(id); if (r.updatedAt === sent.get(id)) delete r.dirty; });
    Core.applyRemote([...this.db.values()], res.changed).forEach(r => this.db.set(r.id, r));
    this.since = res.now;
    return res;
  }
}

clock += 10 * 60 * 1000;
assert.ok(call({ key: 'wrong', changes: [] }).error, 'wrong key refused');
assert.ok(call({ changes: [] }).error, 'missing key refused');
assert.strictEqual(files.length, 0);

const phone = new Device(), pc = new Device();

// מתכון עובר מהטלפון למחשב
phone.save({ id: 'a', title: 'עוגה' });
phone.sync();
assert.strictEqual(files.length, 1);
assert.ok(!phone.db.get('a').dirty, 'clean after upload');
assert.ok(!files[0].text.includes('dirty'), 'dirty flag not stored');
pc.sync();
assert.strictEqual(pc.view('a').title, 'עוגה');

// עריכה עוברת חזרה
clock += 10 * 60 * 1000;
pc.save({ ...pc.db.get('a'), title: 'עוגת גזר' });
pc.sync();
clock += 10 * 60 * 1000;
phone.sync();
assert.strictEqual(phone.view('a').title, 'עוגת גזר');

// התנגשות: הגרסה המאוחרת מנצחת, בכל סדר סנכרון
clock += 10 * 60 * 1000;
phone.save({ ...phone.db.get('a'), title: 'ישן' });
pc.save({ ...pc.db.get('a'), title: 'חדש' });
pc.sync();
phone.sync();
assert.strictEqual(phone.view('a').title, 'חדש');
assert.ok(!phone.db.get('a').dirty);
assert.strictEqual(JSON.parse(files[0].text).title, 'חדש');

// מחיקה מגיעה למכשיר השני, ולא חוזרת
clock += 10 * 60 * 1000;
pc.remove('a');
pc.sync();
clock += 10 * 60 * 1000;
phone.sync();
assert.strictEqual(phone.view('a'), undefined);
assert.ok(JSON.parse(files[0].text).deleted);
assert.strictEqual(JSON.parse(files[0].text).image, undefined);
phone.sync();
assert.strictEqual(phone.view('a'), undefined, 'stays deleted');

// סנכרון נוסף בלי שינוי לא כותב כלום
clock += 10 * 60 * 1000;
phone.save({ id: 'b', title: 'מרק' });
phone.sync();
const stamp = files[1].updated;
clock += 1000;
phone.db.get('b').dirty = true;
phone.sync();
assert.strictEqual(files[1].updated, stamp, 'same version not rewritten');

// עריכה במהלך סנכרון לא מאבדת את הסימון
const r = phone.db.get('b');
assert.ok(Core.applyRemote([{ ...r, updatedAt: 9e12 }], [r]).length === 0, 'older remote ignored');

// מזהה לא חוקי לא יוצר קובץ
const before = files.length;
call({ key: 'secret', changes: [{ id: '../x', updatedAt: 1 }] });
assert.strictEqual(files.length, before);

// הבאת דף: רק עם מפתח, ורק כתובות אינטרנט
assert.ok(call({ key: 'wrong', fetchUrl: 'https://x.test/r' }).error);
assert.strictEqual(fetched.length, 0, 'no fetch without key');
assert.strictEqual(call({ key: 'secret', fetchUrl: 'file:///etc/passwd' }).fetchError, 'bad url');
assert.strictEqual(call({ key: 'secret', fetchUrl: 'https://x.test/blocked' }).fetchError, 'http 403');
const page = call({ key: 'secret', fetchUrl: 'https://x.test/r' });
assert.ok(page.html.includes('מצרכים'));
assert.strictEqual(page.image, 'data:image/jpeg;base64,QUJD');

// מכשיר חדש מקבל הכל, כולל סימוני מחיקה
const fresh = new Device();
fresh.sync();
assert.strictEqual(fresh.view('b').title, 'מרק');
assert.strictEqual(fresh.view('a'), undefined);

// חלוקה למנות
const big = 'x'.repeat(3e6);
const parts = Core.batches([{ id: '1', image: big }, { id: '2', image: big }, { id: '3' }]);
assert.deepStrictEqual(parts.map(p => p.length), [1, 2]);
assert.strictEqual(Core.batches(Array.from({ length: 45 }, (_, i) => ({ id: String(i) }))).length, 3);
assert.deepStrictEqual(Core.batches([]), []);

// שחזור מגיבוי של מתכון שנמחק מנצח את סימון המחיקה
const del = Core.tombstone({ id: 'c', title: 'x', ingredients: [], steps: [], updatedAt: 5 }, 50);
const back = { id: 'c', title: 'x', ingredients: [], steps: [], updatedAt: 5 };
const res = Core.mergeBackup([del], [back]);
assert.strictEqual(res.write.length, 1);
assert.ok(res.write[0].updatedAt > 50);

console.log('ALL OK');
