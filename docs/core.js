// לוגיקה טהורה של מתכונים, בלי דפדפן: קריאת שורת מצרך בעברית והצגת כמויות.
// כמות נשמרת תמיד כמספר, כדי שאפשר יהיה להכפיל אותה. השורה המקורית נשמרת ב-raw.
const Core = (() => {
  const UNITS = [
    ['כוס', 'כוסות', ['כוס', 'כוסות']],
    ['כוסית', 'כוסיות', ['כוסית', 'כוסיות']],
    ['כף', 'כפות', ['כף', 'כפות']],
    ['כפית', 'כפיות', ['כפית', 'כפיות']],
    ['גרם', 'גרם', ['גרם', 'גרמים', 'גר', "גר'", "ג'", 'ג']],
    ['ק"ג', 'ק"ג', ['ק"ג', 'קג', 'קילו', 'קילוגרם']],
    ['מ"ל', 'מ"ל', ['מ"ל', 'מל']],
    ['ליטר', 'ליטר', ['ליטר', 'ליטרים']],
    ['יחידה', 'יחידות', ['יחידה', 'יחידות']],
    ['חבילה', 'חבילות', ['חבילה', 'חבילות']],
    ['אריזה', 'אריזות', ['אריזה', 'אריזות']],
    ['שקית', 'שקיות', ['שקית', 'שקיות']],
    ['פחית', 'פחיות', ['פחית', 'פחיות']],
    ['קופסה', 'קופסאות', ['קופסה', 'קופסא', 'קופסאות']],
    ['גביע', 'גביעים', ['גביע', 'גביעים']],
    ['מיכל', 'מיכלים', ['מיכל', 'מיכלים']],
    ['בקבוק', 'בקבוקים', ['בקבוק', 'בקבוקים']],
    ['שן', 'שיני', ['שן', 'שיני', 'שיניים']],
    ['פרוסה', 'פרוסות', ['פרוסה', 'פרוסות']],
    ['צרור', 'צרורות', ['צרור', 'צרורות']],
    ['ענף', 'ענפים', ['ענף', 'ענפים']],
    ['חופן', 'חופנים', ['חופן', 'חופנים']],
    ['קורט', 'קורטים', ['קורט']],
    ['קמצוץ', 'קמצוצים', ['קמצוץ']],
  ];
  const UNIT_BY_WORD = new Map();
  UNITS.forEach(([one, many, words]) => words.forEach(w => UNIT_BY_WORD.set(w, { one, many })));

  const GLYPHS = { '½': 1 / 2, '¼': 1 / 4, '¾': 3 / 4, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 1 / 8 };
  const WORDS = {
    'חצי': 1 / 2, 'רבע': 1 / 4, 'שליש': 1 / 3, 'אחד': 1, 'אחת': 1, 'שני': 2, 'שתי': 2, 'שניים': 2, 'שתיים': 2,
    'שלוש': 3, 'שלושה': 3, 'ארבע': 4, 'ארבעה': 4, 'חמש': 5, 'חמישה': 5, 'שש': 6, 'שישה': 6, 'שבע': 7, 'שבעה': 7,
    'שמונה': 8, 'תשע': 9, 'תשעה': 9, 'עשר': 10, 'עשרה': 10,
  };
  const AND_FRACTION = { 'וחצי': 1 / 2, 'ורבע': 1 / 4, 'ושליש': 1 / 3 };

  const parseFraction = t => { const m = /^(\d+)\/(\d+)$/.exec(t); return m && +m[2] ? +m[1] / +m[2] : null; };

  function parseAtom(t) {
    if (!t) return null;
    if (/^\d+([.,]\d+)?$/.test(t)) return parseFloat(t.replace(',', '.'));
    const f = parseFraction(t);
    if (f !== null) return f;
    if (t in GLYPHS) return GLYPHS[t];
    const mixed = /^(\d+)([½¼¾⅓⅔⅛])$/.exec(t);
    if (mixed) return +mixed[1] + GLYPHS[mixed[2]];
    return t in WORDS ? WORDS[t] : null;
  }

  // קורא מספר החל מ-tokens[i]. מחזיר {value, next} או null.
  function readNumber(tokens, i) {
    const value = parseAtom(tokens[i]);
    if (value === null) return null;
    let v = value, next = i + 1;
    if (/^\d+$/.test(tokens[i]) && parseFraction(tokens[next] || '') !== null) v += parseFraction(tokens[next++]);
    else if (tokens[next] in AND_FRACTION) v += AND_FRACTION[tokens[next++]];
    return { value: v, next };
  }

  // קורא כמות: מספר או טווח (2-3, 2 עד 3).
  function readAmount(tokens, i) {
    const range = /^(\d+(?:[.,]\d+)?)[-–](\d+(?:[.,]\d+)?)$/.exec(tokens[i] || '');
    if (range) return { qty: parseAtom(range[1]), qtyMax: parseAtom(range[2]), next: i + 1 };
    const a = readNumber(tokens, i);
    if (!a) return null;
    if (['-', '–', 'עד'].includes(tokens[a.next])) {
      const b = readNumber(tokens, a.next + 1);
      if (b) return { qty: a.value, qtyMax: b.value, next: b.next };
    }
    return { qty: a.value, qtyMax: null, next: a.next };
  }

  // קורא כמות + יחידה מ-tokens[i]. מחזיר {qty, qtyMax, unit, next} או null.
  function readMeasure(tokens, i) {
    const amount = readAmount(tokens, i);
    if (amount) {
      const unit = UNIT_BY_WORD.get(tokens[amount.next]) || null;
      return { ...amount, unit, next: amount.next + (unit ? 1 : 0) };
    }
    const unit = UNIT_BY_WORD.get(tokens[i]);    // "כוס קמח" = כוס אחת, "כוס וחצי קמח" = 1.5
    if (!unit) return null;
    const extra = AND_FRACTION[tokens[i + 1]];
    return { qty: 1 + (extra || 0), qtyMax: null, unit, next: i + (extra ? 2 : 1) };
  }

  function clean(line) {
    return String(line).trim()
      .replace(/^[-•*·]\s+/, '')
      .replace(/[״”“]/g, '"').replace(/[׳’`]/g, "'")
      .replace(/(\d)([א-ת])/g, '$1 $2')
      .replace(/\s+/g, ' ');
  }

  const dropOf = tokens => (tokens[0] === 'של' ? tokens.slice(1) : tokens);

  function parseIngredient(line) {
    const raw = String(line).trim();
    const text = clean(raw);
    const tokens = text.split(' ');

    const lead = readMeasure(tokens, 0);
    if (lead) {
      const rest = dropOf(tokens.slice(lead.next));
      if (rest.length) return { qty: lead.qty, qtyMax: lead.qtyMax, unit: lead.unit, item: rest.join(' '), raw };
    }
    // הכמות בסוף השורה: "קמח - 2 כוסות", "קמח: 2 כוסות", "עגבניות 3"
    for (let k = 1; k < tokens.length; k++) {
      if (!/\d|[½¼¾⅓⅔⅛]/.test(tokens[k])) continue;
      const tail = readMeasure(tokens, k);
      if (tail && tail.next === tokens.length) {
        const item = tokens.slice(0, k).join(' ').replace(/\s*[-–:]$/, '').trim();
        if (item) return { qty: tail.qty, qtyMax: tail.qtyMax, unit: tail.unit, item, raw };
      }
    }
    return { qty: null, qtyMax: null, unit: null, item: text, raw };
  }

  function formatQty(q) {
    if (q === null || q === undefined) return '';
    if (q >= 20) return String(Math.round(q));
    const whole = Math.floor(q + 1e-9), frac = q - whole;
    const options = [[0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'], [1, '']];
    for (const [v, glyph] of options) {
      if (Math.abs(frac - v) < 0.02) {
        const w = v === 1 ? whole + 1 : whole;
        return glyph ? (w ? w + glyph : glyph) : String(w);
      }
    }
    return String(+q.toFixed(2));
  }

  // מחזיר {amount, rest}. המסך חייב להציג את amount בבידוד משמאל לימין,
  // אחרת בתוך טקסט עברי "1½" מתהפך ל-"½1" ו-"2-3" ל-"3-2".
  function ingredientParts(ing) {
    if (ing.qty === null || ing.qty === undefined) return { amount: '', unit: '', rest: ing.item };
    const top = ing.qtyMax === null || ing.qtyMax === undefined ? ing.qty : ing.qtyMax;
    const amount = formatQty(ing.qty) + (top !== ing.qty ? '-' + formatQty(top) : '');
    const unit = ing.unit ? (top > 1 ? ing.unit.many : ing.unit.one) : '';
    return { amount, unit, rest: ing.item };
  }

  function formatIngredient(ing) {
    const p = ingredientParts(ing);
    return [p.amount, p.unit, p.rest].filter(Boolean).join(' ');
  }

  // ---------- התאמת כמויות ----------
  const FRACTION_GRID = [0, 1 / 8, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1];

  // מעגל לכמות שאפשר למדוד במטבח: לא "137.4 גרם" ולא "1.37 כוסות".
  function roundAmount(q, unit) {
    const weight = unit && ['גרם', 'מ"ל'].includes(unit.one);
    if (weight && q >= 100) return Math.round(q / 5) * 5;
    if (q >= 10) return Math.round(q);
    const whole = Math.floor(q), frac = q - whole;
    const near = FRACTION_GRID.reduce((a, b) => (Math.abs(b - frac) < Math.abs(a - frac) ? b : a));
    return Math.max(whole + near, 1 / 8);
  }

  function formatMeasure(qty, unit) {
    const word = unit ? (qty > 1 ? unit.many : unit.one) : '';
    return [formatQty(qty), word].filter(Boolean).join(' ');
  }

  // מעדכן גם כמות בסוגריים, כמו "150 גרם (1 1/2 כוסות) שיבולת שועל".
  function scaleParens(item, factor) {
    return item.replace(/\(([^()]*)\)/g, (whole, inside) => {
      const tokens = inside.trim().split(/\s+/);
      const m = readMeasure(tokens, 0);
      if (!m || !m.unit) return whole;
      const rest = tokens.slice(m.next);
      return '(' + [formatMeasure(roundAmount(m.qty * factor, m.unit), m.unit), ...rest].join(' ') + ')';
    });
  }

  function scaleIngredient(ing, factor) {
    if (factor === 1 || ing.qty === null || ing.qty === undefined) return ing;
    const has = ing.qtyMax !== null && ing.qtyMax !== undefined;
    return {
      ...ing,
      qty: roundAmount(ing.qty * factor, ing.unit),
      qtyMax: has ? roundAmount(ing.qtyMax * factor, ing.unit) : null,
      item: scaleParens(ing.item, factor),
    };
  }

  // מעדכן כמויות שכתובות בתוך שלב. זמנים וטמפרטורות לא משתנים, כי הם לא כתובים ביחידות מידה.
  function scaleStep(text, factor) {
    if (factor === 1) return text;
    const words = [...UNIT_BY_WORD.keys()].sort((a, b) => b.length - a.length).join('|').replace(/"/g, '["״]');
    const re = new RegExp(`(?<![\\d.,/])(\\d+(?:[.,]\\d+)?(?:/\\d+)?)(?:\\s*[-–]\\s*(\\d+(?:[.,]\\d+)?))?\\s+(${words})(?![א-ת])`, 'g');
    return text.replace(re, (whole, a, b, word) => {
      const unit = UNIT_BY_WORD.get(word.replace('״', '"'));
      const low = parseAtom(a);
      if (low === null || !unit) return whole;
      const scaledLow = roundAmount(low * factor, unit);
      if (b === undefined) return formatMeasure(scaledLow, unit);
      const top = roundAmount(parseAtom(b) * factor, unit);
      return `${formatQty(scaledLow)}-${formatMeasure(top, unit)}`;
    });
  }

  // ---------- מצרכים בתוך שלב ----------
  const SKIP_WORDS = new Set(['קצת', 'מעט', 'תוספות', 'אהובות', 'טיפונת', 'הרבה', 'קערה', 'גרידה', 'קליפה']);

  function keyWords(item) {
    return item.replace(/\([^)]*\)/g, ' ').replace(/[,:].*$/, ' ').split(/\s+/).filter(w => w.length > 1).slice(0, 2);
  }

  const hasWord = (text, word) => new RegExp(`(?:^|[^א-ת])(?:[והבלמשכ]{0,2})${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![א-ת])`).test(text);

  // אילו מצרכים מוזכרים בשלב? מצרכים עם אותה מילה ראשונה ("קמח שקדים", "קמח קוקוס") דורשים גם את המילה השנייה.
  function stepIngredients(ingredients, step) {
    const firstCount = new Map();
    ingredients.forEach(i => { const f = keyWords(i.item)[0]; firstCount.set(f, (firstCount.get(f) || 0) + 1); });
    return ingredients.filter(i => {
      const [first, second] = keyWords(i.item);
      if (!first || SKIP_WORDS.has(first) || !hasWord(step, first)) return false;
      return firstCount.get(first) === 1 || !second || hasWord(step, second);
    });
  }

  // ---------- טיימרים ----------
  const NUMBER = '\\d+(?:[.,]\\d+)?';
  const NUM_WORDS = 'שתי|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר|עשרים|שלושים|ארבעים|חמישים';
  const WORD_VALUE = { 'שתי': 2, 'שלוש': 3, 'ארבע': 4, 'חמש': 5, 'שש': 6, 'שבע': 7, 'שמונה': 8, 'תשע': 9, 'עשר': 10, 'עשרים': 20, 'שלושים': 30, 'ארבעים': 40, 'חמישים': 50 };
  const UNIT_SECONDS = [[/^שני/, 1], [/^דק/, 60], [/^שע/, 3600]];
  const TIME_RE = new RegExp(
    `(?<![\\d.,א-ת/])(?:[כלבו]-?)?(?:`
    + `(${NUMBER}|${NUM_WORDS})(?:\\s*(?:[-–]|עד)\\s*(${NUMBER}|${NUM_WORDS}))?\\s*(דקות|דקה|דק'|דק׳|דק|שעות|שניות)(?![א-ת])`
    + `|(שעה וחצי|שעה ורבע|שעתיים וחצי|שעתיים|חצי שעה|רבע שעה|שעה)(?![א-ת])`
    + `)`, 'g');
  const FIXED_TIMES = { 'שעה וחצי': 5400, 'שעה ורבע': 4500, 'שעתיים וחצי': 9000, 'שעתיים': 7200, 'חצי שעה': 1800, 'רבע שעה': 900, 'שעה': 3600 };

  const numberValue = t => (t in WORD_VALUE ? WORD_VALUE[t] : parseFloat(t.replace(',', '.')));

  // מחזיר את הזמנים שכתובים בשלב: מיקום, טקסט ושניות. בטווח מתחילים מהזמן הקצר, ובודקים מוקדם.
  function findTimers(text) {
    const out = [];
    for (const m of text.matchAll(TIME_RE)) {
      let seconds;
      if (m[4]) seconds = FIXED_TIMES[m[4]];
      else seconds = numberValue(m[1]) * UNIT_SECONDS.find(([re]) => re.test(m[3]))[1];
      if (seconds > 0) out.push({ start: m.index, end: m.index + m[0].length, text: m[0], seconds });
    }
    return out;
  }

  function formatClock(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    const two = n => String(n).padStart(2, '0');
    return h ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`;
  }

  // ---------- ייבוא מתכון מדף אינטרנט או מטקסט ----------
  const INGREDIENT_HEADING = /^(ה?מרכיבים|ה?מצרכים|רכיבים|חומרים)(\s|\(|:|$)/;
  const STEPS_HEADING = /^(הוראות הכנה|הוראות ההכנה|אופן ההכנה|אופן הכנה|דרך ההכנה|ההכנה|הכנה|שלבים|שלבי הכנה|איך מכינים)(\s|\(|:|$)/;
  const NOTES_HEADING = /^(הערות|טיפים|אחסון|וריאציות)(\s|\(|$)/;
  const STOP_HEADING = /^(ערכים תזונתיים|תגובות|מתכונים נוספים|עוד מתכונים|אולי יעניין|כתבו|שתפו)/;

  function decodeEntities(s) {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '–', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', frac12: '½', frac14: '¼', frac34: '¾' };
    return s.replace(/&(#x?[0-9a-f]+|[a-z0-9]+);/gi, (whole, e) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
      }
      return e.toLowerCase() in named ? named[e.toLowerCase()] : whole;
    });
  }

  const htmlText = s => decodeEntities(s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').replace(/\s+([,.:;])/g, '$1').trim();

  function headingKind(text) {
    const t = text.replace(/[:：*\s]+$/, '').replace(/^[*\s]+/, '');
    if (t.length > 45) return null;
    if (INGREDIENT_HEADING.test(t)) return 'ingredients';
    if (STEPS_HEADING.test(t)) return 'steps';
    if (NOTES_HEADING.test(t)) return 'notes';
    return STOP_HEADING.test(t) ? 'stop' : null;
  }

  // עובר על בלוקים לפי הסדר: כותרת מצרכים, רשימה, כותרת הכנה, רשימה, הערות.
  function walkBlocks(blocks) {
    const out = { ingredients: [], steps: [], notes: [] };
    let state = null, listStarted = false;
    for (const b of blocks) {
      const kind = headingKind(b.text);
      if (kind === 'ingredients' && state !== 'steps' && state !== 'notes') { state = 'ingredients'; continue; }
      if (kind === 'steps' && out.ingredients.length) { state = 'steps'; listStarted = false; continue; }
      if (kind === 'notes' && state === 'steps') { state = 'notes'; continue; }
      if (kind === 'stop' && out.steps.length) break;
      if (!state || !b.text) continue;
      const isList = b.tag === 'li', subHeading = /[:：]$/.test(b.text) && b.text.length < 60;
      if (state === 'ingredients') {
        if (/^הערה/.test(b.text)) out.notes.push(b.text);
        else if (!subHeading && (isList || b.text.length < 80)) out.ingredients.push(b.text);
      } else if (state === 'steps') {
        if (isList) { out.steps.push(b.text); listStarted = true; }
        else if (listStarted) break;
        else if (!subHeading && b.text.length > 15) out.steps.push(b.text);
      } else if (isList) {
        out.notes.push(b.text);
      } else {
        break;
      }
    }
    return out;
  }

  // תמיד קליפות פסיליום. המקור נשאר בהערות.
  function preferHusks(recipe) {
    const fix = s => s.replace(/אבקת פסיליום/g, 'קליפות פסיליום').replace(/אבקת הפסיליום/g, 'קליפות הפסיליום');
    const had = [...recipe.ingredients, ...recipe.steps].some(s => /אבקת ה?פסיליום/.test(s));
    if (!had) return recipe;
    return {
      ...recipe,
      ingredients: recipe.ingredients.map(fix),
      steps: recipe.steps.map(fix),
      notes: [...recipe.notes, 'במקור כתוב אבקת פסיליום, והוחלף לקליפות.'],
    };
  }

  function parseRecipeHtml(html) {
    const meta = name => {
      const m = new RegExp(`<meta[^>]+property=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i').exec(html);
      return m ? decodeEntities(m[1]) : '';
    };
    const tag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    const title = (meta('og:title') || (tag ? htmlText(tag[1]) : '')).replace(/\s+[-–|]\s+[^-–|]*$/, '').trim();
    const body = html.replace(/<(script|style|noscript|svg|head)\b[\s\S]*?<\/\1>/gi, ' ');
    const blocks = [];
    for (const m of body.matchAll(/<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
      blocks.push({ tag: m[1].toLowerCase(), text: htmlText(m[2]) });
    }
    const found = walkBlocks(blocks);
    found.steps = found.steps.filter(s => !/לחצו (פה|כאן)/.test(s));
    // בלי שלבים זו לא באמת קריאה של מתכון, אלא כנראה תפריט של האתר.
    if (!found.steps.length) found.ingredients = [];
    return preferHusks({ title, ...found });
  }

  function parseRecipeText(text) {
    const lines = parseLines(text).map(s => s.replace(/^[-•*·]\s*/, ''));
    const first = lines.findIndex(l => headingKind(l) === 'ingredients');
    const title = first > 0 && lines[0].length < 70 ? lines[0] : '';
    return preferHusks({ title, ...walkBlocks(lines.map(t => ({ tag: 'li', text: t }))) });
  }

  // ---------- רשימת קניות ----------
  const TAIL_WORDS = /^(קצו[צץ]\S*|מגורד\S*|מנופ\S*|פרוס\S*|טחו[נן]\S*|מומס\S*|מופשר\S*|שטופ\S*|קלופ\S*|מסונ\S*|חתוכ\S*|רותח\S*|חמימ\S*|חמים|חם|חמה|קר|קרה|קרים|קרות|רך|רכה|רכים|רכות|טבעי|טבעית|טבעיים|טהור|טהורה|איכותי|איכותית|אמיתי|אמיתית|טרי|טריה|טרייה|טריים|בשל|בשלה|בשלים|בשלות|בשלות|גדול|גדולה|גדולים|גדולות|קטן|קטנה|קטנים|קטנות|בינוני|בינונית|בינוניים|בינוניות)$/;
  const CUT_FROM = new Set(['לפי', 'לציפוי', 'לקישוט', 'למילוי', 'לבצק', 'לזיגוג', 'למריחה', 'לשימון', 'להמסה', 'לסחיטת']);

  // שם מוצר נקי לרשימת הקניות: בלי כמות, הכנה ואיכות, כדי שיתחבר להיסטוריה של הרשימה.
  function shoppingName(ing) {
    if (/פסיליו/.test(ing.item)) return 'קליפות פסיליום';   // תמיד קליפות, גם כשהמתכון אומר אבקה
    const tokens = ing.item.replace(/\([^)]*\)/g, ' ').replace(/[,:].*$/, ' ').split(/\s+/).filter(Boolean);
    const cut = tokens.findIndex((t, n) => n > 0 && CUT_FROM.has(t));
    const kept = cut > 0 ? tokens.slice(0, cut) : tokens;
    while (kept.length > 1 && TAIL_WORDS.test(kept[kept.length - 1])) kept.pop();
    return kept.join(' ');
  }

  const DEFAULT_STAPLES = ['מים', 'מלח', 'פלפל שחור'];

  // "מלח" תופס גם "מלח אטלנטי", אבל לא מוצר שרק מכיל את האותיות.
  const isStaple = (name, staples) => staples.some(s => s && hasWord(name, s));

  // ---------- מזמן לא הכנת ----------
  const DAY = 24 * 60 * 60 * 1000;
  const FORGOTTEN_AFTER_DAYS = 60;

  const seededOrder = (id, seed) => {
    let h = seed;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 2147483647;
    return (h * 16807) % 2147483647;
  };

  // בוחר מתכונים להזכיר. קודם מה שבושל ונשכח, אחר כך מה שעוד לא בושל. מתחלף כל יום.
  function forgotten(recipes, now, count = 2) {
    const today = Math.floor(now / DAY);
    const pool = recipes.filter(r => !r.deleted && (r.ingredients || []).length && !(r.tags || []).includes('לבדיקה'));   // כרטיס עקרונות בלי מצרכים הוא לא מתכון
    const old = pool.filter(r => r.lastCookedAt && now - r.lastCookedAt >= FORGOTTEN_AFTER_DAYS * DAY);
    const never = pool.filter(r => !r.lastCookedAt);
    const shuffled = list => [...list].sort((a, b) => seededOrder(a.id, today) - seededOrder(b.id, today));
    return [...shuffled(old), ...shuffled(never)].slice(0, count);
  }

  function timeAgo(then, now) {
    const days = Math.floor((now - then) / DAY);
    if (days < 1) return 'היום';
    if (days === 1) return 'אתמול';
    if (days === 2) return 'לפני יומיים';
    if (days < 7) return `לפני ${days} ימים`;
    if (days < 14) return 'לפני שבוע';
    if (days < 21) return 'לפני שבועיים';
    if (days < 30) return `לפני ${Math.floor(days / 7)} שבועות`;
    const months = Math.floor(days / 30.44);
    if (months <= 1) return 'לפני חודש';
    if (months === 2) return 'לפני חודשיים';
    if (months < 12) return `לפני ${months} חודשים`;
    const years = Math.floor(days / 365.25);
    if (years <= 1) return 'לפני שנה';
    if (years === 2) return 'לפני שנתיים';
    return `לפני ${years} שנים`;
  }

  const parseLines = text => String(text).split('\n').map(s => s.trim()).filter(Boolean);

  // ---------- פיצול טקסט חופשי למצרכים ----------
  // מפרידים לפי שורה, לפי פסיק, ובשורה רצופה (הכתבה) גם לפי תחילת כמות חדשה.
  const COMMA = /(?<!\d),|,(?!\d)|[;،]/;                  // "1,5" הוא מספר, לא הפרדה

  // מפצל לפי פסיקים, אבל לא בתוך סוגריים: "טחינה (רצוי גולמית, נוזלית)" הוא מצרך אחד.
  function splitCommas(line) {
    const parts = [];
    let depth = 0, cur = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '(') depth++;
      if (c === ')') depth = Math.max(0, depth - 1);
      if (!depth && COMMA.test(line.slice(Math.max(0, i - 1), i + 2)) && /[,;،]/.test(c) && !(/\d/.test(line[i - 1] || '') && /\d/.test(line[i + 1] || ''))) {
        parts.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    parts.push(cur);
    return parts.map(s => s.trim()).filter(Boolean);
  }
  const PREPARED = /^(או |מעורבב|מיובש|מושר|מסונ|שטוף|קלוי|למריחה|לקישוט|לציפוי|למילוי|לבצק|קצו[צץ]|מגורד|מנופ|פרוס|טחו[נן]|מומס|רך$|רכה$|רכים$|רכות$|חתו[כך]|קלו[פף]|מבושל|מרוסק|כתוש|טרי|קר$|קרה$|קרים$|חם$|חמה$|חמים$|גדול|קטנ|קטן|בינונ)/;
  const NEVER_AFTER = new Set(['או', 'עד', 'עם', 'של', 'לפי', 'בערך', 'כמו', 'בלי', 'מתוך']);
  const ONE_WORDS = new Set(['אחד', 'אחת']);              // "2 תפוחים אחד גדול" הוא לא מצרך חדש
  const NOT_AN_AMOUNT = new Set(['עונות', 'תבלינים', 'סוגי']);   // "פלפל ארבע עונות"

  // האם במקום j מתחיל מצרך חדש? מחזיר את המילה לשימוש (בלי ו' החיבור), או null.
  function startAt(tokens, j) {
    if (NEVER_AFTER.has(tokens[j - 1]) || ONE_WORDS.has(tokens[j]) || NOT_AN_AMOUNT.has(tokens[j + 1])) return null;
    if (parseAtom(tokens[j - 1]) && NEVER_AFTER.has(tokens[j - 2])) return null;   // "או 1 כף חמאה"
    const words = tokens[j].length > 1 && tokens[j][0] === 'ו' ? [tokens[j], tokens[j].slice(1)] : [tokens[j]];
    for (const word of words) {
      const probe = [...tokens];
      probe[j] = word;
      const m = readMeasure(probe, j);
      if (m && m.qty > 0 && m.next < tokens.length) return word;
    }
    return null;
  }

  function splitRun(piece) {
    const tokens = clean(piece).split(' ');
    if (!readMeasure(tokens, 0)) return [piece];            // שורה שלא מתחילה בכמות נשארת כמו שהיא
    const out = [];
    let start = 0;
    while (start < tokens.length) {
      const first = readMeasure(tokens, start);
      let j = (first ? first.next : start) + 1;             // לפחות מילה אחת של שם המצרך
      let depth = 0;
      const open = t => (t.match(/\(/g) || []).length - (t.match(/\)/g) || []).length;
      for (let k = start; k < j && k < tokens.length; k++) depth += open(tokens[k]);
      while (j < tokens.length && (depth > 0 || !startAt(tokens, j))) depth += open(tokens[j++]);
      if (j < tokens.length) tokens[j] = startAt(tokens, j);
      out.push(tokens.slice(start, j).join(' '));
      start = j;
    }
    return out;
  }

  function splitIngredients(text) {
    const out = [];
    for (const line of parseLines(text)) {
      const pieces = [];
      for (const part of splitCommas(line)) {
        if (pieces.length && PREPARED.test(part)) pieces[pieces.length - 1] += ', ' + part;
        else pieces.push(part);
      }
      pieces.forEach(p => out.push(...splitRun(p)));
    }
    return out;
  }

  const parseIngredients = text => splitIngredients(text).map(parseIngredient);
  const parseSteps = text => parseLines(text).map(s => s.replace(/^\d+\s*[.)-]\s*/, '')).filter(Boolean);
  const parseTags = text => [...new Set(String(text).split(/[,،\n]/).map(s => s.trim()).filter(Boolean))];

  const normalize = s => String(s).toLowerCase().replace(/[״"׳'\-]/g, '').replace(/\s+/g, ' ').trim();

  function matches(recipe, query) {
    const words = normalize(query).split(' ').filter(Boolean);
    if (!words.length) return true;
    const hay = normalize([recipe.title, ...(recipe.tags || []), ...(recipe.ingredients || []).map(i => i.item)].join(' '));
    return words.every(w => hay.includes(w));
  }

  function validRecipe(r) {
    return !!r && typeof r.id === 'string' && !!r.id && typeof r.title === 'string'
      && Array.isArray(r.ingredients) && Array.isArray(r.steps);
  }

  // ייבוא גיבוי: מוסיף חדשים ומעדכן רק כשהגיבוי חדש יותר, כך ששום דבר לא נדרס בטעות.
  function mergeBackup(existing, incoming) {
    const byId = new Map(existing.map(r => [r.id, r]));
    const write = [];
    let skipped = 0;
    for (const r of incoming) {
      if (!validRecipe(r)) { skipped++; continue; }
      const cur = byId.get(r.id);
      if (cur && cur.deleted) write.push({ ...r, updatedAt: Math.max(r.updatedAt || 0, cur.updatedAt + 1) });
      else if (!cur || (r.updatedAt || 0) > (cur.updatedAt || 0)) write.push(r);
      else skipped++;
    }
    return { write, skipped };
  }

  // ---------- סנכרון ----------
  // בהתנגשות מנצחת הגרסה עם updatedAt מאוחר יותר.
  function applyRemote(local, remote) {
    const byId = new Map(local.map(r => [r.id, r]));
    return remote.filter(r => {
      if (!validRecipe(r)) return false;
      const cur = byId.get(r.id);
      return !cur || (r.updatedAt || 0) > (cur.updatedAt || 0);
    });
  }

  function uploadable(r) {
    const { dirty, ...clean } = r;
    return clean;
  }

  // מתכון שנמחק נשאר כסימון קטן, כדי שהמחיקה תגיע לכל המכשירים.
  const tombstone = (r, now) => ({ id: r.id, title: '', ingredients: [], steps: [], deleted: true, updatedAt: now, dirty: true });

  // מחלק את ההעלאה למנות, כי בקשה אחת עם הרבה תמונות יכולה להיכשל.
  function batches(list, maxChars = 4e6, maxCount = 20) {
    const out = [];
    let cur = [], size = 0;
    for (const r of list) {
      const n = JSON.stringify(r).length;
      if (cur.length && (size + n > maxChars || cur.length >= maxCount)) { out.push(cur); cur = []; size = 0; }
      cur.push(r);
      size += n;
    }
    if (cur.length) out.push(cur);
    return out;
  }

  return { parseIngredient, parseIngredients, parseSteps, parseTags, formatQty, ingredientParts, formatIngredient, matches, validRecipe, mergeBackup, applyRemote, uploadable, tombstone, batches, scaleIngredient, scaleStep, stepIngredients, findTimers, formatClock, parseRecipeHtml, parseRecipeText, shoppingName, DEFAULT_STAPLES, isStaple, forgotten, timeAgo };
})();

if (typeof module !== 'undefined') module.exports = Core;
