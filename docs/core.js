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

  const parseLines = text => String(text).split('\n').map(s => s.trim()).filter(Boolean);

  // ---------- פיצול טקסט חופשי למצרכים ----------
  // מפרידים לפי שורה, לפי פסיק, ובשורה רצופה (הכתבה) גם לפי תחילת כמות חדשה.
  const COMMA = /(?<!\d),|,(?!\d)|[;،]/;                  // "1,5" הוא מספר, לא הפרדה
  const PREPARED = /^(קצו[צץ]|מגורד|מנופ|פרוס|טחו[נן]|מומס|רך$|רכה$|רכים$|רכות$|חתו[כך]|קלו[פף]|מבושל|מרוסק|כתוש|טרי|קר$|קרה$|קרים$|חם$|חמה$|חמים$|גדול|קטנ|קטן|בינונ)/;
  const NEVER_AFTER = new Set(['או', 'עד', 'עם', 'של', 'לפי', 'בערך', 'כמו', 'בלי', 'מתוך']);
  const ONE_WORDS = new Set(['אחד', 'אחת']);              // "2 תפוחים אחד גדול" הוא לא מצרך חדש

  // האם במקום j מתחיל מצרך חדש? מחזיר את המילה לשימוש (בלי ו' החיבור), או null.
  function startAt(tokens, j) {
    if (NEVER_AFTER.has(tokens[j - 1]) || ONE_WORDS.has(tokens[j])) return null;
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
      while (j < tokens.length && !startAt(tokens, j)) j++;
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
      for (const part of line.split(COMMA).map(s => s.trim()).filter(Boolean)) {
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

  return { parseIngredient, parseIngredients, parseSteps, parseTags, formatQty, ingredientParts, formatIngredient, matches, validRecipe, mergeBackup, applyRemote, uploadable, tombstone, batches };
})();

if (typeof module !== 'undefined') module.exports = Core;
