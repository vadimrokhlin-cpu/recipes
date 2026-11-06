// בדיקות ללוגיקה. הרצה: node test/test_core.js
const assert = require('assert');
const C = require('../docs/core.js');
let n = 0;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

function ing(line, qty, unit, item, qtyMax = null) {
  n++;
  const r = C.parseIngredient(line);
  try {
    if (qty === null) assert.strictEqual(r.qty, null); else near(r.qty, qty);
    if (qtyMax === null) assert.strictEqual(r.qtyMax, null); else near(r.qtyMax, qtyMax);
    assert.strictEqual(r.unit ? r.unit.one : null, unit);
    assert.strictEqual(r.item, item);
    assert.strictEqual(r.raw, line.trim());
  } catch (e) { console.error('FAIL:', line, JSON.stringify(r)); throw e; }
}

ing('2 כוסות קמח', 2, 'כוס', 'קמח');
ing('1/2 כוס סוכר', 0.5, 'כוס', 'סוכר');
ing('½ כוס שמן', 0.5, 'כוס', 'שמן');
ing('1½ כוסות חלב', 1.5, 'כוס', 'חלב');
ing('1 1/2 כוסות חלב', 1.5, 'כוס', 'חלב');
ing('1.5 כוסות חלב', 1.5, 'כוס', 'חלב');
ing('1,5 כוסות חלב', 1.5, 'כוס', 'חלב');
ing('2 וחצי כוסות קמח', 2.5, 'כוס', 'קמח');
ing('כוס וחצי קמח', 1.5, 'כוס', 'קמח');
ing('כוס קמח', 1, 'כוס', 'קמח');
ing('כפית סוכר', 1, 'כפית', 'סוכר');
ing('חצי כוס שמן', 0.5, 'כוס', 'שמן');
ing('רבע כוס מים', 0.25, 'כוס', 'מים');
ing('שתי כפות דבש', 2, 'כף', 'דבש');
ing('חצי לימון', 0.5, null, 'לימון');
ing('3 ביצים', 3, null, 'ביצים');
ing('500 גרם עוף', 500, 'גרם', 'עוף');
ing('500גרם עוף', 500, 'גרם', 'עוף');
ing('100 ג\' חמאה', 100, 'גרם', 'חמאה');
ing('1 ק"ג תפוחי אדמה', 1, 'ק"ג', 'תפוחי אדמה');
ing('1 ק״ג תפוחי אדמה', 1, 'ק"ג', 'תפוחי אדמה');
ing('חצי קילו בשר', 0.5, 'ק"ג', 'בשר');
ing('200 מ"ל שמנת', 200, 'מ"ל', 'שמנת');
ing('2 שיני שום', 2, 'שן', 'שום');
ing('2-3 שיני שום', 2, 'שן', 'שום', 3);
ing('2 עד 3 שיני שום', 2, 'שן', 'שום', 3);
ing('קורט מלח', 1, 'קורט', 'מלח');
ing('חבילה של אטריות', 1, 'חבילה', 'אטריות');
ing('- 2 כוסות קמח', 2, 'כוס', 'קמח');
ing('• 2 כוסות קמח', 2, 'כוס', 'קמח');
ing('קמח - 2 כוסות', 2, 'כוס', 'קמח');
ing('קמח: 2 כוסות', 2, 'כוס', 'קמח');
ing('עגבניות 3', 3, null, 'עגבניות');
ing('מלח לפי הטעם', null, null, 'מלח לפי הטעם');
ing('פלפל שחור', null, null, 'פלפל שחור');
ing('כוסברה קצוצה', null, null, 'כוסברה קצוצה');
ing('כוס', null, null, 'כוס');
ing('3', null, null, '3');
ing('2 כוסות', null, null, '2 כוסות');

function split(text, expected) {
  n++;
  assert.deepStrictEqual(C.parseIngredients(text).map(C.formatIngredient), expected, text);
}
split('2 כוסות קמח\nכוס סוכר', ['2 כוסות קמח', '1 כוס סוכר']);
split('2 כוסות קמח, כוס סוכר, 3 ביצים', ['2 כוסות קמח', '1 כוס סוכר', '3 ביצים']);
split('2 כוסות קמח,כוס סוכר', ['2 כוסות קמח', '1 כוס סוכר']);
split('1,5 כוסות חלב, מלח', ['1½ כוסות חלב', 'מלח']);
split('קמח, מלח, פלפל', ['קמח', 'מלח', 'פלפל']);
split('שתי כוסות קמח כוס סוכר שלוש ביצים', ['2 כוסות קמח', '1 כוס סוכר', '3 ביצים']);
split('2 כוסות קמח ושתי כפות סוכר', ['2 כוסות קמח', '2 כפות סוכר']);
split('2 כוסות קמח וחצי כוס סוכר', ['2 כוסות קמח', '½ כוס סוכר']);
split('כוס קמח וכוס סוכר', ['1 כוס קמח', '1 כוס סוכר']);
split('2 וחצי כוסות קמח 3 ביצים 200 גרם חמאה רכה', ['2½ כוסות קמח', '3 ביצים', '200 גרם חמאה רכה']);
split('1 בצל, קצוץ', ['1 בצל, קצוץ']);
split('2 שיני שום, כתושות, כוס מים', ['2 שיני שום, כתושות', '1 כוס מים']);
split('1 כף שמן או 1 כף חמאה', ['1 כף שמן או 1 כף חמאה']);
split('2 עד 3 שיני שום', ['2-3 שיני שום']);
split('2 תפוחים אחד גדול', ['2 תפוחים אחד גדול']);
split('פחית טונה 160 גרם', ['1 פחית טונה 160 גרם']);
split('קמח - 2 כוסות', ['2 כוסות קמח']);
split('מיץ משני לימונים', ['מיץ משני לימונים']);
split('מלח לפי הטעם', ['מלח לפי הטעם']);
split('1 ק"ג קמח 00 קורט מלח', ['1 ק"ג קמח 00', '1 קורט מלח']);

function fmt(q, s) { n++; assert.strictEqual(C.formatQty(q), s); }
fmt(1, '1'); fmt(2, '2'); fmt(0.5, '½'); fmt(1.5, '1½'); fmt(1 / 3, '⅓'); fmt(0.75, '¾');
fmt(2.999, '3'); fmt(0.37, '0.37'); fmt(137.4, '137'); fmt(0.25, '¼');

function line(l, s) { n++; assert.strictEqual(C.formatIngredient(C.parseIngredient(l)), s); }
line('2 כוסות קמח', '2 כוסות קמח');
line('כוס קמח', '1 כוס קמח');
line('חצי כוס שמן', '½ כוס שמן');
line('2-3 שיני שום', '2-3 שיני שום');
line('מלח לפי הטעם', 'מלח לפי הטעם');

n++; assert.deepStrictEqual(C.parseSteps('1. מחממים\n\n2) מערבבים\nאופים'), ['מחממים', 'מערבבים', 'אופים']);
n++; assert.deepStrictEqual(C.parseTags('מהיר, שבת,מהיר'), ['מהיר', 'שבת']);

const r = { title: 'עוגת גזר', tags: ['אפיה'], ingredients: [{ item: 'קמח' }] };
n += 5;
assert.ok(C.matches(r, 'גזר')); assert.ok(C.matches(r, 'אפיה')); assert.ok(C.matches(r, 'קמח גזר'));
assert.ok(!C.matches(r, 'עוף')); assert.ok(C.matches(r, ''));

n += 3;
const a = { id: 'a', title: 'x', ingredients: [], steps: [], updatedAt: 5 };
const m = C.mergeBackup([a], [{ ...a, updatedAt: 3 }, { ...a, id: 'b' }, { id: 'c' }]);
assert.deepStrictEqual(m.write.map(x => x.id), ['b']);
assert.strictEqual(m.skipped, 2);
assert.strictEqual(C.mergeBackup([a], [{ ...a, updatedAt: 9 }]).write.length, 1);

console.log(`ALL OK (${n} checks)`);
