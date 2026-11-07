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

function scale(line, f, s) {
  n++;
  assert.strictEqual(C.formatIngredient(C.scaleIngredient(C.parseIngredient(line), f)), s, line);
}
scale('2 כוסות קמח', 2, '4 כוסות קמח');
scale('חצי כוס שמן', 2, '1 כוס שמן');
scale('כוס קמח', 1.5, '1½ כוסות קמח');
scale('1 כוס קמח', 0.5, '½ כוס קמח');
scale('2-3 שיני שום', 2, '4-6 שיני שום');
scale('500 גרם עוף', 1.4, '700 גרם עוף');
scale('137 גרם קמח', 1.5, '205 גרם קמח');
scale('60 גרם קמח', 1.1, '66 גרם קמח');
scale('מלח לפי הטעם', 3, 'מלח לפי הטעם');
scale('1/3 כוס שמן', 1.5, '½ כוס שמן');
scale('3 ביצים', 1.5, '4½ ביצים');
scale('150 גרם (1 1/2 כוסות) שיבולת שועל', 2, '300 גרם (3 כוסות) שיבולת שועל');
scale('1 ביצה (אולי 2)', 2, '2 ביצה (אולי 2)');
scale('12 גרם (1 כף מעט גדושה) מלח', 2, '24 גרם (2 כפות מעט גדושה) מלח');
scale('2 כוסות קמח', 1, '2 כוסות קמח');

function step(text, f, s) { n++; assert.strictEqual(C.scaleStep(text, f), s); }
step('מוסיפים 2 כוסות קמח', 2, 'מוסיפים 4 כוסות קמח');
step('אופים 45 דקות ב-180 מעלות', 2, 'אופים 45 דקות ב-180 מעלות');
step('מוסיפים 3-4 כפות מים', 2, 'מוסיפים 6-8 כפות מים');
step('תבנית 20 על 20', 2, 'תבנית 20 על 20');
step('מוסיפים 1-2 כפיות חלב', 2, 'מוסיפים 2-4 כפיות חלב');
step('כוסות קמח', 2, 'כוסות קמח');

function items(lines, stepText, expected) {
  n++;
  assert.deepStrictEqual(C.stepIngredients(lines.map(C.parseIngredient), stepText).map(i => i.item), expected, stepText);
}
items(['2 כוסות קמח', '1 כוס סוכר'], 'מערבבים את הקמח עם מים', ['קמח']);
items(['1 כוס קמח שקדים', '60 גרם קמח קוקוס'], 'מוסיפים קמח שקדים', ['קמח שקדים']);
items(['1 כוס קמח שקדים', '60 גרם קמח קוקוס'], 'מוסיפים את קמח הקוקוס', ['קמח קוקוס']);
items(['2 ביצים', '1 כוס חלב'], 'טורפים את הביצים והחלב', ['ביצים', 'חלב']);
items(['1 כוס מים'], 'שוטפים במים', ['מים']);
items(['1 בצל, קצוץ'], 'מטגנים את הבצל', ['בצל, קצוץ']);
items(['מלח לפי הטעם'], 'מוסיפים מלח', ['מלח לפי הטעם']);
items(['קליפה מגוררת מלימון'], 'מערבבים', []);

function times(text, expected) {
  n++;
  assert.deepStrictEqual(C.findTimers(text).map(t => [t.text.trim(), t.seconds]), expected, text);
}
times('אופים 45 דקות', [['45 דקות', 2700]]);
times('אופים 25-30 דקות', [['25-30 דקות', 1500]]);
times('אופים 35 עד 40 דקות', [['35 עד 40 דקות', 2100]]);
times('בתנור ל-180 מעלות', []);
times('מערבבים כ-10 דקות', [['כ-10 דקות', 600]]);
times('שמים ל-20 דקות', [['ל-20 דקות', 1200]]);
times('מחכים 10 דק ואז', [['10 דק', 600]]);
times("מחכים 10 דק' ואז", [["10 דק'", 600]]);
times('לשעה וחצי', [['לשעה וחצי', 5400]]);
times('כשעה', [['כשעה', 3600]]);
times('שעתיים במקרר', [['שעתיים', 7200]]);
times('חצי שעה', [['חצי שעה', 1800]]);
times('מקררים 2 שעות ואז 5 דקות', [['2 שעות', 7200], ['5 דקות', 300]]);
times('טוחנים 10 שניות', [['10 שניות', 10]]);
times('מערבבים חמש דקות', [['חמש דקות', 300]]);
times('נשמר 5 ימים', []);
times('משעה', []);
times('מחממים תנור', []);

n += 4;
assert.strictEqual(C.formatClock(90), '1:30');
assert.strictEqual(C.formatClock(3725), '1:02:05');
assert.strictEqual(C.formatClock(0), '0:00');
assert.strictEqual(C.formatClock(59.2), '1:00');

function shop(line, s) { n++; assert.strictEqual(C.shoppingName(C.parseIngredient(line)), s, line); }
shop('2 כוסות קמח', 'קמח');
shop('2 כפות שמן זית איכותי', 'שמן זית');
shop('1 בצל, קצוץ', 'בצל');
shop('מלח לפי הטעם', 'מלח');
shop('חצי כוס (120 מ"ל) מים רותחים', 'מים');
shop('150 גרם (1 1/2 כוסות) שיבולת שועל', 'שיבולת שועל');
shop('3 כפות אבקת פסיליום', 'קליפות פסיליום');
shop('50 גרם קליפות פסיליום', 'קליפות פסיליום');
shop('1 כף אלולוז (למילוי)', 'אלולוז');
shop('חופן אגוזי פקאן', 'אגוזי פקאן');
shop('2 תפוחים ירוקים גדולים', 'תפוחים ירוקים');
shop('1 כוס חלב קר', 'חלב');
shop('100 גרם שוקולד מריר', 'שוקולד מריר');
shop('200 גרם חמאה רכה', 'חמאה');
shop('חם', 'חם');
shop('2 כפות קקאו לציפוי', 'קקאו');

n += 6;
assert.ok(C.isStaple('מלח אטלנטי', ['מלח']));
assert.ok(C.isStaple('מים', ['מלח', 'מים']));
assert.ok(!C.isStaple('מלחייה', ['מלח']));
assert.ok(!C.isStaple('שמן זית', ['מלח']));
assert.ok(C.isStaple('פלפל שחור גרוס', ['פלפל שחור']));
assert.ok(!C.isStaple('פלפל אדום', ['פלפל שחור']));

const DAY = 864e5, NOW = 2e12;
const rr = (id, lastCookedAt, tags = []) => ({ id, title: id, tags, lastCookedAt, ingredients: [{ item: 'x' }] });
n++; assert.deepStrictEqual(C.forgotten([{ id: 'rules', title: 'עקרונות', tags: [], ingredients: [] }], 2e12), [], 'rules card not suggested');
n += 8;
const picks = (list, c) => C.forgotten(list, NOW, c).map(x => x.id);
assert.deepStrictEqual(picks([rr('a', NOW - 90 * DAY), rr('b', null)]), ['a', 'b']);
assert.deepStrictEqual(picks([rr('a', NOW - 10 * DAY)]), [], 'recent is not forgotten');
assert.deepStrictEqual(picks([rr('a', null, ['לבדיקה'])]), [], 'incomplete not suggested');
assert.deepStrictEqual(picks([{ ...rr('a', null), deleted: true }]), []);
assert.strictEqual(picks([rr('a', null), rr('b', null), rr('c', null)]).length, 2);
assert.deepStrictEqual(picks([]), []);
const many = Array.from({ length: 30 }, (_, i) => rr('r' + i, null));
assert.deepStrictEqual(C.forgotten(many, NOW).map(x => x.id), C.forgotten(many, NOW + 1000).map(x => x.id), 'stable within a day');
assert.notDeepStrictEqual(C.forgotten(many, NOW).map(x => x.id), C.forgotten(many, NOW + 5 * DAY).map(x => x.id), 'changes between days');

function ago(days, s) { n++; assert.strictEqual(C.timeAgo(NOW - days * DAY, NOW), s); }
ago(0, 'היום'); ago(1, 'אתמול'); ago(2, 'לפני יומיים'); ago(5, 'לפני 5 ימים'); ago(8, 'לפני שבוע'); ago(15, 'לפני שבועיים');
ago(25, 'לפני 3 שבועות'); ago(40, 'לפני חודש'); ago(65, 'לפני חודשיים'); ago(100, 'לפני 3 חודשים'); ago(370, 'לפני שנה'); ago(800, 'לפני שנתיים'); ago(1200, 'לפני 3 שנים');

split('150 גרם (1 1/2 כוסות) שיבולת שועל', ['150 גרם (1 1/2 כוסות) שיבולת שועל']);
split('1/2 כוס טחינה (רצוי טחינה מלאה, נוזלית וחלקה)', ['½ כוס טחינה (רצוי טחינה מלאה, נוזלית וחלקה)']);
split('3 כוסות (720 מ"ל) מים חמימים', ['3 כוסות (720 מ"ל) מים חמימים']);
split('1/3 כוס שמן קוקוס, או שמן זית עדין', ['⅓ כוס שמן קוקוס, או שמן זית עדין']);
split('2 כוסות קמח (מנופה), כוס סוכר', ['2 כוסות קמח (מנופה)', '1 כוס סוכר']);

const nadav = `<html><head><title>x</title><meta property="og:title" content="ממרח חלווה-פרג אקספרס (ללא בישול) - נדב דהן"><script>var a="<li>לא</li>"</script></head><body>
<ul><li>תפריט</li></ul><p>סיפור על המתכון, עם מצרכים טובים</p>
<p class="paragraph"><b>מרכיבים:</b></p><ul><li>1/2 כוס טחינה גולמית</li><li>קורט מלח &amp; פלפל</li></ul>
<p class="paragraph"><b>לציפוי:</b></p><ul><li>3 כפות אבקת פסיליום</li></ul>
<p class="paragraph"><b>הוראות הכנה:</b></p><ol><li><b>הערבוב:</b> בקערה קטנה שמים הכל 10 דקות.</li><li>מערבבים את אבקת הפסיליום.</li></ol>
<p><b>הערות:</b></p><ul><li><b>אחסון:</b> במקרר.</li></ul>
<p><b>ערכים תזונתיים:</b></p><ul><li>חלבון 3</li></ul><ul><li>פוטר</li></ul></body></html>`;
const pn = C.parseRecipeHtml(nadav);
n += 5;
assert.strictEqual(pn.title, 'ממרח חלווה-פרג אקספרס (ללא בישול)');
assert.deepStrictEqual(pn.ingredients, ['1/2 כוס טחינה גולמית', 'קורט מלח & פלפל', '3 כפות קליפות פסיליום']);
assert.deepStrictEqual(pn.steps, ['הערבוב: בקערה קטנה שמים הכל 10 דקות.', 'מערבבים את קליפות הפסיליום.']);
assert.strictEqual(pn.notes[0], 'אחסון: במקרר.');
assert.ok(pn.notes[1].includes('אבקת פסיליום'));

const omer = `<title>חלב מרוכז - עומר מילר</title><meta property="og:description" content="מצרכים 1 ליטר"><h2>חלב מרוכז</h2><h2>מצרכים</h2><ul><li>1 ליטר שמנת 38%</li></ul><h2>שלבים</h2><ol><li>יוצקים למחבת.</li></ol><p>&nbsp;</p><p>סוף הפוסט</p><ul><li>קישור אחר</li></ul>`;
const po = C.parseRecipeHtml(omer);
n += 3;
assert.strictEqual(po.title, 'חלב מרוכז');
assert.deepStrictEqual(po.ingredients, ['1 ליטר שמנת 38%']);
assert.deepStrictEqual(po.steps, ['יוצקים למחבת.']);

n++; assert.deepStrictEqual(C.parseRecipeHtml('<p>סתם דף</p><ul><li>א</li></ul>').ingredients, []);

split('1 כף פלפל ארבע עונות', ['1 כף פלפל ארבע עונות']);
const tofu = C.parseRecipeHtml('<p><b>מרכיבים:</b> <b>לבסיס: </b>(כ-4 מנות)</p><ul><li>1 חבילה טופו</li><li>הערה: אפשר גם אחר</li></ul><p><b>הוראות הכנה:</b></p><ol><li>אופים.</li><li>למתכון נוסף לחצו פה.</li></ol>');
n += 3;
assert.deepStrictEqual(tofu.ingredients, ['1 חבילה טופו']);
assert.deepStrictEqual(tofu.notes, ['הערה: אפשר גם אחר']);
assert.deepStrictEqual(tofu.steps, ['אופים.']);
n++; assert.deepStrictEqual(C.parseRecipeHtml('<h2>מצרכים</h2><ul><li>תפריט</li><li>איפוס</li></ul>').ingredients, [], 'no steps means not a recipe');

const pasted = 'עוגת גזר\nמתכון מעולה!\n\nמצרכים:\n- 2 כוסות קמח\n• 3 גזרים\n\nאופן ההכנה:\n1. מערבבים\n2. אופים 40 דקות\n';
const pt = C.parseRecipeText(pasted);
n += 3;
assert.strictEqual(pt.title, 'עוגת גזר');
assert.deepStrictEqual(pt.ingredients, ['2 כוסות קמח', '3 גזרים']);
assert.deepStrictEqual(C.parseSteps(pt.steps.join('\n')), ['מערבבים', 'אופים 40 דקות']);
n++; assert.deepStrictEqual(C.parseRecipeText('רק טקסט בלי כותרות').ingredients, []);

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
