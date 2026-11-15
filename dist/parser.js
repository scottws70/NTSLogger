/*
 * NTS Radiogram parser, check calculator, and formatter.
 *
 * Takes a pasted blob of one or more radiograms (in almost any spacing:
 * one field per line, the whole message on one line, or a mix) and returns
 * structured messages. Also understands traffic already sent in book form
 * ("BOOK OF 3 ...  NR 1 ...  NR 2 ...").
 */
(function (root) {
  'use strict';

  const PREC_MAP = {
    EMERGENCY: 'EMERGENCY', EMERG: 'EMERGENCY', E: 'EMERGENCY',
    PRIORITY: 'P', P: 'P', ROUTINE: 'R', R: 'R', WELFARE: 'W', W: 'W'
  };
  const PREC_RANK = { EMERGENCY: 0, P: 1, W: 2, R: 3 };

  const PREC = '(EMERGENCY|EMERG|PRIORITY|ROUTINE|WELFARE|R|P|W|E)';
  const HX = '((?:HX[A-G](?:\\s*\\d+)?[\\s,]+)*)';
  // A callsign must contain at least one letter and one digit, so an address
  // line like "123 W MAIN ST" is never mistaken for a preamble.
  const STATION = '([A-Z0-9\\/]*\\d[A-Z0-9\\/]*[A-Z][A-Z0-9\\/]*|[A-Z0-9\\/]*[A-Z][A-Z0-9\\/]*\\d[A-Z0-9\\/]*)';
  const CHECK = '(ARL\\s*\\d+|\\d+)(?![A-Z0-9])';
  const NRPFX = '(?:NR\\.?|NUMBER:?|MSG|NO\\.|#)?\\s*';

  const START_RE = new RegExp('^\\s*' + NRPFX + '(\\d{1,5})[\\s,]+(?:(TEST)\\s+)?' + PREC + '[\\s,]+' + HX + STATION + '[\\s,]+' + CHECK + '[\\s,]*(.*)$');
  // In a book header, precedence, HX and station of origin are optional: any of them may vary per message.
  const BOOK_PRE_RE = new RegExp('^\\s*(?:(TEST)\\s+)?(?:' + PREC + '[\\s,]+)?' + HX + '(?:' + STATION + '[\\s,]+)?' + CHECK + '[\\s,]*(.*)$');
  const BOOK_RE = /^\s*BOOK\s+(?:OF\s+)?(\d{1,3})\b[\s,]*(.*)$/;
  const VAR_RE = /^\s*(?:NR\.?|NUMBER:?|#)\s*(\d{1,5})\b[\s,]*(.*)$/;
  const END_LINE_RE = /^\s*(AR|NNNN|EOM|END|SK|AR\s+K|AR\s+SK|\+|#+|-{3,}|={3,}|\*{3,})\s*$/;
  const BT_SPLIT_RE = /(?:^|\s)BT(?=\s|$)/;

  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const DATE_RE = /(?<![A-Z0-9])(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUNE?|JULY?|AUG(?:UST)?|SEPT?(?:EMBER)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\.?\s*(\d{1,2})(?![0-9])|(?<![0-9\/])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![0-9\/])/;
  const TIME_RE = /^(\d{3,4}|\d{1,2}:\d{2})([ZL]|UTC|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT)?$/;
  const TZ_TOKEN_RE = /^(Z|L|UTC|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT)$/;

  const STATES = new Set(('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR VI GU AS MP ' +
    'AB BC MB NB NL NS NT NU ON PE QC SK YT').split(' '));
  const STATE_NAMES = {
    ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR', CALIFORNIA: 'CA', COLORADO: 'CO', CONNECTICUT: 'CT', DELAWARE: 'DE',
    FLORIDA: 'FL', GEORGIA: 'GA', HAWAII: 'HI', IDAHO: 'ID', ILLINOIS: 'IL', INDIANA: 'IN', IOWA: 'IA', KANSAS: 'KS', KENTUCKY: 'KY',
    LOUISIANA: 'LA', MAINE: 'ME', MARYLAND: 'MD', MASSACHUSETTS: 'MA', MICHIGAN: 'MI', MINNESOTA: 'MN', MISSISSIPPI: 'MS', MISSOURI: 'MO',
    MONTANA: 'MT', NEBRASKA: 'NE', NEVADA: 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
    'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', OHIO: 'OH', OKLAHOMA: 'OK', OREGON: 'OR', PENNSYLVANIA: 'PA', 'RHODE ISLAND': 'RI',
    'SOUTH CAROLINA': 'SC', 'SOUTH DAKOTA': 'SD', TENNESSEE: 'TN', TEXAS: 'TX', UTAH: 'UT', VERMONT: 'VT', VIRGINIA: 'VA',
    WASHINGTON: 'WA', 'WEST VIRGINIA': 'WV', WISCONSIN: 'WI', WYOMING: 'WY'
  };
  const STREET_SUFFIX = new Set(('ST STREET AVE AV AVENUE RD ROAD DR DRIVE LN LANE BLVD CT COURT WAY PL PLACE CIR CIRCLE PKWY HWY ' +
    'TER TERR TRL TRAIL SQ LOOP RUN PIKE ROW PATH XING APT UNIT STE SUITE LOT BOX').split(' '));
  const PHONE_RE = /(?:\b(?:TEL|PHONE|PH|TELEPHONE|CELL)\b[:.\s]*)?\(?(?<![0-9])(\d{3})\)?[\s.\-\/]*(\d{3})[\s.\-]*(\d{4})(?![0-9])(?:\s*(?:X|EXT)\.?\s*(\d+))?/;

  // ---------- helpers ----------

  function normCheck(c) {
    if (!c) return '';
    const s = String(c).toUpperCase().trim();
    const m = /^ARL\s*(\d+)$/.exec(s);
    if (m) return 'ARL ' + parseInt(m[1], 10);
    if (/^\d+$/.test(s)) return String(parseInt(s, 10));
    return s;
  }

  function textWords(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean);
  }

  /** NTS check: number of words (groups) in the text, prefixed "ARL" when ARL numbered texts are used. */
  function computeCheck(text) {
    const w = textWords(text);
    if (!w.length) return '0';
    return (w.includes('ARL') ? 'ARL ' : '') + w.length;
  }

  function checkNumber(c) {
    const m = /(\d+)/.exec(c || '');
    return m ? parseInt(m[1], 10) : NaN;
  }

  function squash(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeInput(raw) {
    let t = String(raw || '').toUpperCase()
      .replace(/\r\n?/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/[‐-―]/g, '-')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/ /g, ' ');
    t = t.replace(/^[ ]*>+[ ]?/gm, '');            // e-mail quote markers
    t = t.replace(/^[ ]*(<BT>|=|BREAK)[ ]*$/gm, 'BT'); // alternate break markers on their own line
    t = t.replace(/<BT>/g, ' BT ');
    // Break run-together traffic onto separate lines before each "NR n prec" or "BOOK OF n"
    t = t.replace(/[ ]+(?=NR\.?\s?\d{1,5}[ ,]+(?:TEST\s+)?(?:EMERGENCY|EMERG|PRIORITY|ROUTINE|WELFARE|R|P|W|E)[ ,])/g, '\n');
    t = t.replace(/[ ]+(?=BOOK\s+OF\s+\d)/g, '\n');
    return t;
  }

  function fmtDateParts(mon, day) {
    return MONTHS[mon - 1] + ' ' + parseInt(day, 10);
  }

  function dateFromMatch(dm) {
    if (dm[1]) {
      const idx = MONTHS.indexOf(dm[1].slice(0, 3));
      return fmtDateParts(idx + 1, dm[2]);
    }
    const mon = parseInt(dm[3], 10), day = parseInt(dm[4], 10);
    if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) return fmtDateParts(mon, day);
    return dm[0];
  }

  /** Split the tail of a preamble into place of origin, time filed, date, and whatever follows the date. */
  function parsePlaceTimeDate(rest) {
    let head = rest, remainder = '', date = '';
    const dm = DATE_RE.exec(rest);
    if (dm) {
      head = rest.slice(0, dm.index);
      remainder = rest.slice(dm.index + dm[0].length).replace(/^\s*,?\s*(19|20)\d\d(?![0-9])/, '');
      date = dateFromMatch(dm);
    }
    let toks = head.trim().split(/\s+/).filter(Boolean);
    let time = '';
    // time filed is normally the last token before the date
    for (let i = toks.length - 1; i >= 0; i--) {
      let tok = toks[i], used = 1;
      if (TZ_TOKEN_RE.test(tok) && i > 0 && /^\d{3,4}$/.test(toks[i - 1])) { tok = toks[i - 1] + tok; used = 2; i--; }
      if (TIME_RE.test(tok)) {
        time = tok.replace(/^(\d{1,2}):(\d{2})/, (m, h, mm) => h.padStart(2, '0') + mm);
        const after = toks.slice(i + used);
        toks = toks.slice(0, i);
        if (!dm && after.length) remainder = after.join(' ');
        else if (after.length) toks = toks.concat(after);
        break;
      }
      if (dm) continue; // with a date found, keep scanning back a little for the time
      break;
    }
    return { place: toks.join(' ').replace(/,\s*$/, ''), time, date, remainder: remainder.replace(/^[\s,]+/, '') };
  }

  // ---------- address ----------

  /**
   * Radiograms spell out e-mail addresses the way hams send them: "JSMITH ATSIGN GMAIL DOT COM"
   * (or "AT SIGN"). Find such an address so it can be filed as the e-mail — it is kept exactly
   * as written, not converted to "@" form. DOT only counts as part of the address when it's
   * joined to the ATSIGN run, so a street like "DOT RD" is left alone.
   */
  const SPOKEN_EMAIL_RE = /(?:[A-Z0-9._%+\-]+\s+DOT\s+)*[A-Z0-9._%+\-]+\s*\bAT\s?SIGN\b\s*[A-Z0-9\-]+(?:(?:\s*\.\s*|\s+DOT\s+)[A-Z0-9\-]+)*/i;
  function findSpokenEmail(s) {
    const m = SPOKEN_EMAIL_RE.exec(String(s || ''));
    return m ? { email: squash(m[0]).toUpperCase(), rest: squash(s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)) } : null;
  }

  function emptyAddress() {
    return { name: '', street: '', city: '', state: '', zip: '', phone: '', email: '' };
  }

  function extractPhone(s) {
    const m = PHONE_RE.exec(s);
    if (!m) return null;
    let phone = m[1] + ' ' + m[2] + ' ' + m[3];
    if (m[4]) phone += ' X' + m[4];
    return { phone, rest: squash(s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)) };
  }

  function matchCityLine(line) {
    let m = /^(.*?)[\s,]+([A-Z]{2})\.?(?:[\s,]+(\d{5})(?:-?(\d{4}))?)?$/.exec(line);
    if (m && STATES.has(m[2]) && m[1].trim()) {
      return { city: m[1].replace(/,$/, '').trim(), state: m[2], zip: m[3] ? m[3] + (m[4] ? '-' + m[4] : '') : '' };
    }
    m = /^(.*?)[\s,]+([A-Z]+(?: [A-Z]+)?)(?:[\s,]+(\d{5})(?:-?(\d{4}))?)?$/.exec(line);
    if (m) {
      // try full state names, longest first ("NEW YORK" before "YORK")
      for (const nm of Object.keys(STATE_NAMES).sort((a, b) => b.length - a.length)) {
        const re = new RegExp('^(.*?)[\\s,]+' + nm + '(?:[\\s,]+(\\d{5})(?:-?(\\d{4}))?)?$');
        const mm = re.exec(line);
        if (mm && mm[1].trim()) return { city: mm[1].replace(/,$/, '').trim(), state: STATE_NAMES[nm], zip: mm[2] ? mm[2] + (mm[3] ? '-' + mm[3] : '') : '' };
      }
    }
    // zip only, e.g. "COLUMBUS 43215"
    m = /^(.*?)[\s,]+(\d{5})(?:-?(\d{4}))?$/.exec(line);
    if (m && m[1].trim() && !/^\d+$/.test(m[1].trim())) return { city: m[1].trim(), state: '', zip: m[2] + (m[3] ? '-' + m[3] : '') };
    return null;
  }

  function parseAddressOneLine(line, a, warnings) {
    let s = line;
    const sp = findSpokenEmail(s);
    const em = /\S+@\S+/.exec(s);
    if (sp) { a.email = sp.email; s = sp.rest; }
    else if (em) { a.email = em[0].toLowerCase(); s = squash(s.replace(em[0], ' ')); }
    const ph = extractPhone(s);
    if (ph) { a.phone = ph.phone; s = ph.rest; }
    const toks = s.split(' ').filter(Boolean);
    let stateIdx = -1;
    for (let i = toks.length - 1; i >= 1; i--) {
      if (/^\d{5}(-\d{4})?$/.test(toks[i]) && STATES.has(toks[i - 1])) { stateIdx = i - 1; a.zip = toks[i]; break; }
    }
    if (stateIdx < 0) {
      for (let i = toks.length - 1; i >= 2; i--) if (STATES.has(toks[i])) { stateIdx = i; break; }
    }
    if (stateIdx < 0) { a.name = s; warnings.push('Address not split into parts — please check'); return a; }
    a.state = toks[stateIdx];
    const before = toks.slice(0, stateIdx);
    const hn = before.findIndex((t, i) => i > 0 && /^\d+[A-Z]?$/.test(t));
    if (hn > 0) {
      a.name = before.slice(0, hn).join(' ');
      const after = before.slice(hn);
      let si = -1;
      for (let i = after.length - 2; i >= 1; i--) if (STREET_SUFFIX.has(after[i])) { si = i; break; }
      if (si < 0) si = Math.max(0, after.length - 2);
      a.street = after.slice(0, si + 1).join(' ');
      a.city = after.slice(si + 1).join(' ');
    } else {
      a.name = before.slice(0, -1).join(' ');
      a.city = before.slice(-1).join(' ');
    }
    warnings.push('Address was on one line — split automatically, please check');
    return a;
  }

  function parseAddress(str, warnings, notes) {
    const a = emptyAddress();
    let lines = String(str || '').split('\n').map(squash).filter(Boolean);
    lines = lines.filter(l => {
      if (/^OP\s*NOTES?\b/.test(l)) { notes.push(l.replace(/^OP\s*NOTES?\b[:\s]*/, '')); return false; }
      return true;
    });
    if (!lines.length) { warnings.push('No address found'); return a; }
    lines[0] = lines[0].replace(/^TO\b[:\s]*/, '');
    if (!lines[0]) lines.shift();
    if (lines.length === 1 && lines[0].split(' ').length > 4) return parseAddressOneLine(lines[0], a, warnings);

    const rest = [];
    for (let l of lines) {
      const sp = findSpokenEmail(l);
      if (sp) {
        a.email = sp.email;
        l = sp.rest.replace(/^E-?MAIL\b[:\s]*/, '');
        if (!l) continue;
      }
      if (/@/.test(l) || /^E-?MAIL\b/.test(l)) { a.email = l.replace(/^E-?MAIL\b[:\s]*/, '').replace(/\s+/g, '').toLowerCase(); continue; }
      const ph = extractPhone(l);
      if (ph && (ph.rest === '' || !/^\d/.test(l) || /^(TEL|PHONE|PH|CELL)/.test(l))) {
        a.phone = ph.phone;
        if (!ph.rest) continue;
        l = ph.rest;
      }
      rest.push(l);
    }
    let ci = -1, city = null;
    for (let i = rest.length - 1; i >= 1; i--) {
      city = matchCityLine(rest[i]);
      if (city) { ci = i; break; }
    }
    if (ci < 0 && rest.length === 1) {
      city = matchCityLine(rest[0]);
      if (city) { ci = 0; }
    }
    if (ci >= 0) {
      Object.assign(a, city);
      if (ci > 0) {
        a.name = rest[0];
        a.street = rest.slice(1, ci).concat(rest.slice(ci + 1)).join('\n');
      }
    } else {
      a.name = rest[0] || '';
      a.street = rest.slice(1).join('\n');
      if (rest.length > 1) warnings.push('City / state not recognized in address');
    }
    return a;
  }

  // ---------- body (address / text / signature) ----------

  function cleanSig(sig, notes) {
    let s = String(sig || '');
    const op = /\bOP\s*NOTES?\b[:\s]*([\s\S]*)$/.exec(s);
    if (op) { notes.push(squash(op[1])); s = s.slice(0, op.index); }
    let lines = s.split('\n').map(squash).filter(l => l && !END_LINE_RE.test(l));
    s = lines.join('\n');
    for (;;) {
      const n = s.replace(/[\s]+(AR|NNNN|EOM|SK|AR K)\s*$/, '').replace(/^\s*(AR|NNNN|EOM)\s*$/, '');
      if (n === s) break;
      s = n;
    }
    return s.trim();
  }

  function splitTextSig(s, check, warnings) {
    const words = textWords(s);
    const n = checkNumber(check);
    if (n > 0 && words.length > n) {
      warnings.push('Only one BT found — signature separated using the check');
      return { text: words.slice(0, n).join(' '), sig: words.slice(n).join(' ') };
    }
    const lines = String(s).split('\n').map(squash).filter(Boolean);
    if (lines.length > 1) {
      warnings.push('Only one BT found — last line taken as the signature');
      return { text: lines.slice(0, -1).join(' '), sig: lines[lines.length - 1] };
    }
    warnings.push('Only one BT found — no signature separated');
    return { text: squash(s), sig: '' };
  }

  function splitBody(bodyText, check, warnings, notes) {
    const segs = bodyText.split(BT_SPLIT_RE);
    let addr = segs[0] || '', text = '', sig = '';
    if (segs.length >= 3) {
      text = squash(segs[1]);
      sig = segs[2];
      if (segs.length > 3) {
        const extra = squash(segs.slice(3).join(' ').replace(/\b(AR|NNNN|EOM)\b/g, ''));
        if (extra) notes.push(extra);
      }
    } else if (segs.length === 2) {
      const ts = splitTextSig(segs[1], check, warnings);
      text = ts.text; sig = ts.sig;
    } else {
      warnings.push('No BT found — address, text and signature could not be separated');
    }
    return { addr, text, sig: cleanSig(sig, notes) };
  }

  function finalize(m, warnings) {
    m.checkCalc = computeCheck(m.text);
    m.checkGiven = normCheck(m.check);
    if (!m.checkGiven) m.check = m.checkCalc;
    else m.check = m.checkGiven;
    m.checkMismatch = !!m.checkGiven && m.checkGiven !== m.checkCalc;
    if (m.checkMismatch) warnings.push('Check ' + m.checkGiven + ' does not match counted ' + m.checkCalc);
    if (!m.text) warnings.push('No text found');
    if (!m.date) warnings.push('No date found in preamble');
    m.warnings = warnings;
    return m;
  }

  function blankMsg() {
    return {
      nr: '', test: false, prec: 'R', hx: '', station: '', check: '', place: '', time: '', date: '',
      to: emptyAddress(), text: '', sig: '', opNote: ''
    };
  }

  function parseMessageBlock(lines) {
    const warnings = [], notes = [];
    const m = START_RE.exec(lines[0]);
    const msg = blankMsg();
    msg.nr = String(parseInt(m[1], 10));
    msg.test = !!m[2];
    msg.prec = PREC_MAP[m[3]] || 'R';
    msg.hx = squash(m[4].replace(/,/g, ' '));
    msg.station = m[5];
    msg.check = normCheck(m[6]);
    const ptd = parsePlaceTimeDate(m[7] || '');
    msg.place = ptd.place; msg.time = ptd.time; msg.date = ptd.date;
    const body = [ptd.remainder].concat(lines.slice(1)).join('\n');
    const b = splitBody(body, msg.check, warnings, notes);
    msg.to = parseAddress(b.addr, warnings, notes);
    msg.text = b.text; msg.sig = b.sig;
    msg.opNote = notes.filter(Boolean).join(' / ');
    return finalize(msg, warnings);
  }

  const HX_TOK_RE = /^HX[A-G]\d*$/;
  const PREC_TOK_RE = /^(EMERGENCY|PRIORITY|ROUTINE|WELFARE|R|P|W)$/;
  function isCallTok(t) {
    return /^[A-Z0-9\/]+$/.test(t) && /\d/.test(t) && /[A-Z]/.test(t) && !/^\d+(ST|ND|RD|TH)$/.test(t);
  }

  /**
   * Read the preamble parts that differ between book messages from the start of an
   * "NR n ..." line: precedence, HX, station of origin, time filed, date — in that order.
   * Stops at the first word that isn't one of those, which begins the address.
   */
  function parseVarPreamble(rest) {
    const toks = String(rest || '').trim().split(/\s+/).filter(Boolean);
    const own = {};
    let i = 0;
    const isPre = t => t && (HX_TOK_RE.test(t) || isCallTok(t) || TIME_RE.test(t));
    if (toks[i] && PREC_TOK_RE.test(toks[i]) && (toks.length === i + 1 || isPre(toks[i + 1]))) { own.prec = PREC_MAP[toks[i]]; i++; }
    const hx = [];
    while (toks[i] && HX_TOK_RE.test(toks[i])) {
      hx.push(toks[i++]);
      if (toks[i] && /^\d{1,3}$/.test(toks[i])) hx.push(toks[i++]);
    }
    if (hx.length) own.hx = hx.join(' ');
    if (toks[i] && isCallTok(toks[i]) && !TIME_RE.test(toks[i])) own.station = toks[i++];
    let tail = toks.slice(i).join(' ');
    const lead = DATE_RE.exec(tail);
    const tm = /^(\S+)(?:\s+(Z|L|UTC|GMT))?\s*/.exec(tail);
    if (tm && TIME_RE.test(tm[1] + (tm[2] || '')) && (/[A-Z]$/.test(tm[1] + (tm[2] || '')) || (lead && lead.index === tm[0].length))) {
      own.time = tm[1] + (tm[2] || '');
      tail = tail.slice(tm[0].length);
    }
    const dm = DATE_RE.exec(tail);
    if (dm && dm.index === 0) { own.date = dateFromMatch(dm); tail = tail.slice(dm[0].length); }
    return { own, rest: tail.replace(/^[\s,]+/, '') };
  }

  function parseBookBlock(lines) {
    const hm = BOOK_RE.exec(lines[0]);
    const count = parseInt(hm[1], 10);
    const base = blankMsg();
    const bookWarn = [];
    let remainder = '';
    const pm = BOOK_PRE_RE.exec(hm[2] || '');
    if (pm) {
      base.test = !!pm[1];
      base.prec = PREC_MAP[pm[2]] || 'R';
      base.hx = squash((pm[3] || '').replace(/,/g, ' '));
      base.station = pm[4] || '';
      base.check = normCheck(pm[5]);
      const ptd = parsePlaceTimeDate(pm[6] || '');
      base.place = ptd.place; base.time = ptd.time; base.date = ptd.date;
      remainder = ptd.remainder;
    } else {
      remainder = hm[2] || '';
      if (remainder.trim()) bookWarn.push('Book preamble not recognized');
    }
    const body = [remainder].concat(lines.slice(1)).join('\n').split('\n');
    const common = [];
    const vars = [];
    for (const line of body) {
      const sm = START_RE.exec(line);
      if (sm) {
        // a variable part sent with its own full preamble
        const ptd = parsePlaceTimeDate(sm[7] || '');
        vars.push({ nr: String(parseInt(sm[1], 10)), lines: [ptd.remainder], own: { prec: PREC_MAP[sm[3]], hx: squash(sm[4]), station: sm[5], check: normCheck(sm[6]), place: ptd.place, time: ptd.time, date: ptd.date } });
        continue;
      }
      const vm = VAR_RE.exec(line);
      if (vm) {
        const vp = parseVarPreamble(vm[2]);
        vars.push({ nr: String(parseInt(vm[1], 10)), lines: [vp.rest], own: vp.own });
        continue;
      }
      if (vars.length) vars[vars.length - 1].lines.push(line);
      else common.push(line);
    }

    const cNotes = [];
    let csegs = common.join('\n').split(BT_SPLIT_RE);
    if (csegs.length && !csegs[0].trim()) csegs = csegs.slice(1);
    let cText = squash(csegs[0] || ''), cSig = csegs[1] || '';
    if (csegs.length === 1 && cText && checkNumber(base.check) > 0 && textWords(cText).length > checkNumber(base.check)) {
      const ts = splitTextSig(csegs[0], base.check, []);
      cText = ts.text; cSig = ts.sig;
    }

    const parsedVars = vars.map(v => {
      const segs = v.lines.join('\n').split(BT_SPLIT_RE);
      return { v, addr: segs[0] || '', text: segs[1] !== undefined ? squash(segs[1]) : '', sig: segs[2] || '', extra: segs.slice(3).join(' ') };
    });
    // Addresses-first order: the shared text and signature trail after the last address.
    if (!cText && parsedVars.length > 1) {
      const last = parsedVars[parsedVars.length - 1];
      const othersHaveText = parsedVars.slice(0, -1).some(p => p.text);
      if (last.text && !othersHaveText) {
        cText = last.text; cSig = last.sig; last.text = ''; last.sig = '';
      }
    }
    cSig = cleanSig(cSig, cNotes);

    if (vars.length !== count) bookWarn.push('Book says ' + count + ' messages but ' + vars.length + ' were found');

    const out = parsedVars.map(p => {
      const warnings = bookWarn.slice(), notes = cNotes.slice();
      const msg = Object.assign(blankMsg(), base, p.v.own ? Object.fromEntries(Object.entries(p.v.own).filter(([, val]) => val)) : {});
      msg.nr = p.v.nr;
      msg.to = parseAddress(p.addr, warnings, notes);
      msg.text = p.text || cText;
      msg.sig = cleanSig(p.sig, notes) || cSig;
      if (p.extra.trim()) notes.push(squash(p.extra));
      msg.opNote = notes.filter(Boolean).join(' / ');
      msg.fromBook = true;
      // a variable text gets its own check
      if (p.text && !(p.v.own && p.v.own.check)) msg.check = '';
      return finalize(msg, warnings);
    });
    return out;
  }

  /**
   * Parse a pasted blob. Returns { messages: [...], ignored: [lines that weren't part of any message] }.
   */
  function parseTraffic(raw) {
    const lines = normalizeInput(raw).split('\n');
    const blocks = [];
    const ignored = [];
    let cur = null;
    for (const line of lines) {
      if (BOOK_RE.test(line)) {
        cur = { kind: 'book', lines: [line], count: parseInt(BOOK_RE.exec(line)[1], 10), vars: 0, ended: false };
        blocks.push(cur);
        continue;
      }
      if (cur && cur.kind === 'book' && !cur.ended && (VAR_RE.test(line) || START_RE.test(line)) && cur.vars < cur.count) {
        cur.vars++; cur.lines.push(line); continue;
      }
      if (START_RE.test(line)) {
        cur = { kind: 'msg', lines: [line], ended: false };
        blocks.push(cur);
        continue;
      }
      if (END_LINE_RE.test(line)) { if (cur) cur.ended = true; continue; }
      if (cur && !cur.ended) { cur.lines.push(line); continue; }
      if (line.trim()) ignored.push(line.trim());
    }
    const messages = [];
    blocks.forEach((b, bi) => {
      if (b.kind === 'book') {
        parseBookBlock(b.lines).forEach(m => { m.importBook = bi; messages.push(m); });
      } else {
        messages.push(parseMessageBlock(b.lines));
      }
    });
    return { messages, ignored };
  }

  // ---------- formatting / grouping ----------

  function precLabel(p) {
    return p === 'EMERGENCY' ? 'EMERGENCY' : (p || 'R');
  }

  function preambleLine(m, opts) {
    const parts = [];
    if (!(opts && opts.noNumber)) parts.push('NR ' + m.nr);
    if (m.test) parts.push('TEST');
    parts.push(precLabel(m.prec));
    if (m.hx) parts.push(m.hx);
    parts.push(m.station, m.check, m.place, m.time, m.date);
    return parts.filter(Boolean).join(' ');
  }

  function textLines(text, per) {
    const w = textWords(text), out = [];
    for (let i = 0; i < w.length; i += (per || 5)) out.push(w.slice(i, i + (per || 5)).join(' '));
    return out;
  }

  function addressLines(a) {
    a = a || {};
    const out = [];
    if (a.name) out.push(a.name);
    if (a.street) a.street.split('\n').forEach(l => l && out.push(l));
    const csz = [a.city, a.state, a.zip].filter(Boolean).join(' ');
    if (csz) out.push(csz);
    if (a.phone) out.push(a.phone);
    if (a.email) out.push(a.email);
    return out;
  }

  function formatRadiogram(m) {
    const out = [preambleLine(m)];
    addressLines(m.to).forEach(l => out.push(l));
    out.push('BT');
    textLines(m.text).forEach(l => out.push(l));
    out.push('BT');
    String(m.sig || '').split('\n').forEach(l => l && out.push(l));
    if (m.opNote) out.push('OP NOTE ' + m.opNote);
    out.push('AR');
    return out.join('\n');
  }

  /**
   * Messages can be booked when the check, place of origin, text and signature match
   * (grouping by the way they're going is done by the caller). Precedence, HX, station
   * of origin, time and date may differ; those go on each message's NR line.
   */
  function bookKey(m) {
    return [m.test ? 'T' : '', normCheck(m.check), squash(m.place), squash(m.text), squash(m.sig)].join('|');
  }

  const VAR_FIELDS = ['prec', 'hx', 'station', 'time', 'date'];
  function varValue(m, k) { return k === 'prec' ? precLabel(m.prec) : squash(m[k]); }

  /** Which of precedence / HX / station / time / date differ between the messages of a book. */
  function bookVarying(msgs) {
    return VAR_FIELDS.filter(k => new Set(msgs.map(m => varValue(m, k))).size > 1);
  }

  /** The shared part of a book's preamble: only the fields that are the same for every message. */
  function bookCommon(msgs) {
    const f = msgs[0], vary = new Set(bookVarying(msgs));
    const parts = [];
    if (f.test) parts.push('TEST');
    ['prec', 'hx', 'station'].forEach(k => { if (!vary.has(k)) parts.push(varValue(f, k)); });
    parts.push(normCheck(f.check), f.place);
    ['time', 'date'].forEach(k => { if (!vary.has(k)) parts.push(varValue(f, k)); });
    return parts.filter(Boolean).join(' ');
  }

  /** A book message's own NR line: its number plus whichever preamble fields vary. */
  function bookNrLine(m, varying) {
    return ['NR ' + m.nr].concat(varying.map(k => varValue(m, k))).filter(Boolean).join(' ');
  }

  function formatBook(msgs) {
    const f = msgs[0];
    const varying = bookVarying(msgs);
    const out = ['BOOK OF ' + msgs.length + ' ' + bookCommon(msgs), 'BT'];
    textLines(f.text).forEach(l => out.push(l));
    out.push('BT');
    String(f.sig || '').split('\n').forEach(l => l && out.push(l));
    msgs.forEach(m => {
      out.push(bookNrLine(m, varying));
      addressLines(m.to).forEach(l => out.push(l));
      if (m.opNote) out.push('OP NOTE ' + m.opNote);
    });
    out.push('AR');
    return out.join('\n');
  }

  const API = {
    parseTraffic, computeCheck, normCheck, formatRadiogram, formatBook, bookKey, preambleLine,
    bookVarying, bookCommon, bookNrLine, findSpokenEmail,
    addressLines, textLines, textWords, parseAddress, PREC_RANK, MONTHS, STATES, precLabel
  };
  root.NTS = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
