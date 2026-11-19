/*
 * Reference tab: ARL numbered radiogram texts and Q signals.
 * Sources: "NTS 2.0 Numbered Radiogram Texts" (Rev. 20230525) and the ARRL QN / Q signal lists.
 */
(function () {
  'use strict';

  const B = '_____'; // a blank to fill in

  // [number, text]; null text = reserved. HXD marks the text used with HXD.
  const ARL = [
    [1, 'Everyone safe here. Please don’t worry.'],
    [2, 'Coming home as soon as possible.'],
    [3, `Am in ${B} hospital. Receiving excellent care and recovering fine.`],
    [4, 'Only slight property damage here. Do not be concerned about disaster reports.'],
    [5, 'Am moving to new location. Send no further mail or communication. Will inform you of new address when relocated. Will contact you as soon as possible.'],
    [6, 'Will contact you as soon as possible.'],
    [7, 'Please reply by Amateur Radio through the amateur delivering this message. This is a free public service.'],
    [8, `Need additional ${B} mobile or portable equipment for immediate emergency use.`],
    [9, `Additional ${B} radio operators needed to assist with emergency at this location.`],
    [10, `Please contact ${B}. Advise to standby and provide further emergency information, instructions or assistance.`],
    [11, `Establish Amateur Radio emergency communications with ${B} on ${B} MHz.`],
    [12, 'Anxious to hear from you. No word in some time. Please contact me as soon as possible.'],
    [13, 'Medical emergency situation exists here.'],
    [14, `Situation here becoming critical. Losses and damage from ${B} increasing.`],
    [15, 'Please advise your condition and what help is needed.'],
    [16, 'Property damage very severe in this area.'],
    [17, `REACT communications services also available. Establish REACT communication with ${B} on channel ${B}.`],
    [18, `Please contact me as soon as possible at ${B}.`],
    [19, `Request health and welfare report on ${B}. (State name, address and telephone number)`],
    [20, `Temporarily stranded. Will need some assistance. Please contact me at ${B}.`],
    [21, 'Search and rescue assistance is needed by local authorities here. Advise availability.'],
    [22, 'Need accurate information on the extent and type of conditions now existing at your location. Please furnish this information and reply without delay.'],
    [23, 'Report at once the accessibility and best way to reach your location.'],
    [24, 'Evacuation of residents from this area urgently needed. Advise plans for help.'],
    [25, 'Furnish as soon as possible the weather conditions at your location.'],
    [26, 'Help and care for evacuation of sick and injured from this location needed at once.'],
    [27, 'I am safe and well.'],
    [28, 'Household safe and well.'],
    [29, 'Currently at shelter.'],
    [30, 'Currently at home.'],
    [31, 'Currently at family/friend’s house.'],
    [32, 'Currently at hotel.'],
    [33, 'Safe but moving to a safer location.'],
    [34, 'Evacuating to a shelter.'],
    [35, 'Evacuating to family member / friend’s house.'],
    [36, 'Evacuating and safe.'],
    [37, 'At home and plan to remain here.'],
    [38, 'Will contact you when able.'],
    [39, 'All communications are down.'],
    [40, 'Share this message with others.'],
    [41, `Received your message ${B} (number) for ${B} (addressee) from ${B} (station) ${B} on ${B} (date) ${B} (time). Relayed / delivered to ${B} (station) on ${B} (date) ${B} (time) via ${B} (net/method).`, 'HXD'],
    [42, null], [43, null], [44, null], [45, null],
    [46, 'Greetings on your birthday and best wishes for many more to come.'],
    [47, `Reference your message number ${B} to ${B} delivered on ${B} at ${B} UTC.`],
    [48, `Reference your message number ${B} to ${B} not delivered. Telephone ${B} (insert number as received) inoperative. Please give better address.`],
    [49, `Reference your message number ${B} to ${B}. Unable to contact addressee or receive confirmation of delivery.`],
    [50, 'Greetings by Amateur Radio.'],
    [51, `Greetings by Amateur Radio. This message is sent as a free public service by ham radio operators at ${B}. Am having a wonderful time.`],
    [52, 'Really enjoyed being with you. Looking forward to getting together again.'],
    [53, `Received your ${B}. It’s appreciated; many thanks.`],
    [54, 'Many thanks for your good wishes.'],
    [55, 'Good news is always welcome. Very delighted to hear about yours.'],
    [56, `Congratulations on your ${B}, a most worthy and deserved achievement.`],
    [57, 'Wish we could be together.'],
    [58, 'Have a wonderful time. Let us know when you return.'],
    [59, 'Congratulations on the new arrival. Hope mother and child are well.'],
    [60, `Wishing you the best of everything on ${B}.`],
    [61, 'Wishing you a very Merry Christmas and a Happy New Year.'],
    [62, `Greetings and best wishes to you for a pleasant ${B} holiday season.`],
    [63, 'Victory or defeat, our best wishes are with you. Hope you win.'],
    [64, `Arrived safely at ${B}.`],
    [65, `Arriving ${B} on ${B}. Please arrange to meet me there.`],
    [66, `DX QSLs are on hand for you at the ${B} QSL Bureau. Send ${B} self addressed envelopes.`],
    [67, `Your message number ${B} undeliverable because of ${B}. Please advise.`],
    [68, 'Sorry to hear you are ill. Best wishes for a speedy recovery.'],
    [69, `Welcome to the ${B}. We are glad to have you with us and hope you will enjoy the fun and fellowship of the organization.`],
    [70, `Thank you for the QSO on ${B} (frequency/band) ${B} (mode) at ${B} (time) ${B} (date).`],
    [71, `Order wire net established on ${B} (frequency) to coordinate and prioritize access to ${B} (digital network name) on ${B} (frequency) ${B} (mode).`],
    [72, `Establish communications with ${B} (name of EmComm group) on ${B} frequency ${B} mode.`],
    [73, `Establish communications with ${B} agency on channel ${B} (spell channel number) ${B} mode.`],
    [74, `Establish communications with ${B} agency on ${B} (frequency) ${B} (mode).`],
    [75, `Priority entry point frequencies established on ${B} (list frequencies and modes).`],
    [76, `Point to point circuit established on ${B} (frequency) ${B} (mode). Please establish liaison.`],
    [77, null],
    [78, `SITREP messages requested every ${B} (spell number) hours your location. Transmit to station (call sign) in ${B} (state/section).`],
    [79, `WXOBS messages requested every ${B} (spell number) hours your location. Transmit to station (call sign) in ${B} (state/section).`],
    [80, `OPRED messages requested your station. Update when changes occur. Transmit to station (call sign) in ${B} (state/section).`],
    [81, null],
    [82, `Digital Traffic Station connect/download frequency at ${B} (spell number) minute intervals requested in support of disaster operations.`],
    [83, `RRI Winlink gateway connect/download frequency at ${B} (spell number) minute intervals requested in support of disaster operations.`],
    [84, `Request activate ${B} Region Net until further notice.`],
    [85, `Request activate ${B} Area Net until further notice.`],
    [86, `Advise frequency and mode of ${B} state/section nets.`],
    [87, `Request assistance with establishment of a temporary message center at ${B} (address and/or agency).`],
    [88, `Welfare traffic being originated on ${B} (frequency/mode). Request assistance with NTS/RRI liaison.`],
    [89, `Priority and/or emergency traffic being originated on ${B} (frequency/mode). Request assistance with NTS/RRI liaison.`],
    [90, 'Please provide a list of stations operational on National SOS Radio Network.'],
    [91, 'Widespread disruptions to cellular data and public switched telephone network this location.'],
    [92, 'Widespread disruptions to Internet service this location.'],
    [93, 'The following broadcast stations are off-air in this area (list call sign, frequency/channel).'],
    [94, null], [95, null], [96, null], [97, null], [98, null], [99, null],
  ];

  // QN signals. ncs: meaning used only by the net control station; t: meaning anyone may use.
  const QN = [
    { c: 'QNA', ncs: 'Answer in prearranged order.' },
    { c: 'QNB', ncs: `Act as relay between ${B} and ${B}.` },
    { c: 'QNC', t: 'All net stations copy. I have a message for all net stations.' },
    { c: 'QND', ncs: 'Net is directed (controlled by net control station).' },
    { c: 'QNE', ncs: 'Entire net stand by.' },
    { c: 'QNF', t: 'Net is free (not controlled).' },
    { c: 'QNG', t: 'Take over as net control station.' },
    { c: 'QNH', t: 'Your net frequency is high.' },
    { c: 'QNI', ncs: 'Net stations report in.', t: 'I am reporting into the net. (Follow with a list of traffic or QRU.)' },
    { c: 'QNJ', t: `Can you copy me? Can you copy ${B}?` },
    { c: 'QNK', ncs: `Transmit message for ${B} to ${B}.` },
    { c: 'QNL', t: 'Your net frequency is low.' },
    { c: 'QNM', ncs: 'You are QRMing the net. Stand by.' },
    { c: 'QNN', t: `Net control station is ${B}. What station has net control?` },
    { c: 'QNO', t: 'Station is leaving the net.' },
    { c: 'QNP', t: `Unable to copy you. Unable to copy ${B}.` },
    { c: 'QNQ', ncs: `Move frequency to ${B} and wait for ${B} to finish handling traffic. Then send him traffic for ${B}.` },
    { c: 'QNR', t: `Answer ${B} and receive traffic.` },
    { c: 'QNS', ncs: 'Following stations are in the net. (Follow with list.)', t: 'Request list of stations in the net.' },
    { c: 'QNT', t: `I request permission to leave the net for ${B} minutes.` },
    { c: 'QNU', ncs: 'The net has traffic for you. Stand by.' },
    { c: 'QNV', ncs: `Establish contact with ${B} on this frequency. If successful, move to ${B} and send him traffic for ${B}.` },
    { c: 'QNW', t: `How do I route messages for ${B}?` },
    { c: 'QNX', ncs: 'You are excused from the net.', t: 'Request to be excused from the net.' },
    { c: 'QNY', ncs: `Shift to another frequency (or to ${B} kHz) to clear traffic with ${B}.` },
    { c: 'QNZ', t: 'Zero beat your signal with mine.' },
  ];

  const Q = [
    ['QRA', 'What is the name of your station?'],
    ['QRG', 'What’s my exact frequency?'],
    ['QRH', 'Does my frequency vary?'],
    ['QRI', 'How is my tone? (1–3)'],
    ['QRK', 'What is my signal intelligibility? (1–5)'],
    ['QRL', 'Are you busy?'],
    ['QRM', 'Is my transmission being interfered with?'],
    ['QRN', 'Are you troubled by static?'],
    ['QRO', 'Shall I increase transmitter power?'],
    ['QRP', 'Shall I decrease transmitter power?'],
    ['QRQ', 'Shall I send faster?'],
    ['QRS', 'Shall I send slower?'],
    ['QRT', 'Shall I stop sending?'],
    ['QRU', 'Have you anything for me?', 'Answer in negative: “I have nothing.”'],
    ['QRV', 'Are you ready?'],
    ['QRW', `Shall I tell ${B} you’re calling him?`],
    ['QRX', 'When will you call again?'],
    ['QRZ', 'Who is calling me?'],
    ['QSA', 'What is my signal strength? (1–5)'],
    ['QSB', 'Are my signals fading?'],
    ['QSD', 'Is my keying defective?'],
    ['QSG', `Shall I send ${B} messages at a time?`],
    ['QSK', 'Can you work break-in?'],
    ['QSL', 'Can you acknowledge receipt?'],
    ['QSM', 'Shall I repeat the last message sent?'],
    ['QSO', `Can you communicate with ${B} direct?`],
    ['QSP', `Will you relay to ${B}?`],
    ['QSV', 'Shall I send a series of V’s?'],
    ['QSW', `Will you transmit on ${B}?`],
    ['QSX', `Will you listen for ${B} on ${B}?`],
    ['QSY', 'Shall I change frequency?'],
    ['QSZ', 'Shall I send each word/group more than once?', `Answer: send twice or ${B}.`],
    ['QTA', `Shall I cancel number ${B}?`],
    ['QTB', 'Do you agree with my word count?', 'Answer negative. If no, respond NO, then the sender will send the first letter of all groups. Interrupt when the discrepancy is detected.'],
    ['QTC', 'How many messages have you to send?'],
    ['QTH', 'What is your location?'],
    ['QTR', 'What is your time?'],
    ['QTV', `Shall I stand guard for you ${B}?`],
    ['QTX', 'Will you keep your station open for further communication with me?'],
    ['QUA', `Have you news of ${B}?`],
  ];

  // Radiogram format. Text in `backticks` is shown in the message font.
  const PARTS = [
    ['Number', 'Your sequential message number (`NR 123`).'],
    ['Precedence', 'Routine (`R`), Welfare (`W`) or Priority (`P`), sent as a single letter. Emergency is always spelled out: `EMERGENCY`.'],
    ['Handling instructions (HX)', 'Optional. One or more of the HX codes below.'],
    ['Station of origin', 'Call sign of the station that put the message into radiogram form.'],
    ['Check', 'Word count of the message text. If an ARL text is used, put ARL before the count (`ARL 22`). See Counting the Check below.'],
    ['Place of origin', 'Where the message originates (`NEWINGTON CT`).'],
    ['Time filed', 'When the message was filed, as HHMM in UTC (Zulu) or local time. Say which: `1830Z`.'],
    ['Date', 'Month and day the message was written (`NOV 19`).'],
    ['To', 'The addressee, one item per line:', ['Name, and amateur call sign if any', 'Street address', 'City, state (two-letter abbreviation) and ZIP code', 'Telephone number, including area code', 'Email address']],
    ['Text', 'The message itself, between the two `BT`s. See Counting the Check below.'],
    ['Signature', 'The person who wrote the message, who may not be the station of origin. For a ham, give the name and call sign. For anyone else, give the name and a telephone number, including area code.'],
    ['Rec’d', 'Call sign of the operator you received the message from, with the date and time.'],
  ];

  // [code, meaning, common?]
  const HXS = [
    ['HXA', 'Collect landline delivery authorized by the addressee within X miles (`HXA25`). With no number, the authorization is unlimited.'],
    ['HXB', 'Cancel the message if it isn’t delivered within X hours of the filing time, and service the originating station (`HXB4`).'],
    ['HXC', 'Report the date and time of delivery (TOD) to the originating station.', true],
    ['HXD', 'Report to the originating station the station you received it from, with the date and time. Also report the station you relayed it to, with the date and time, or, if you delivered it, the date, time and method of delivery.'],
    ['HXE', 'The delivering station gets a reply from the addressee and originates a message back.'],
    ['HXF', 'Hold delivery until a given date (`HXF5` holds it until the 5th).'],
    ['HXG', 'Deliver by mail or landline; a toll call isn’t required. If there is any expense, cancel the message and service the originating station.', true],
  ];

  // [item, counts as]
  const COUNTS = [
    ['Telephone number with area code (`707 555 1212`)', '3 words'],
    ['Punctuation: `X` (X-ray) for a period, `QUERY` for a question mark', '1 word each'],
    ['Acronym, or a group of mixed letters and numbers (`ARRL`, `W1AW`)', '1 word'],
    ['ARL numbered text, spelled out, each word counted (`ARL FORTY SIX`)', '3 words'],
  ];

  const ONES = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
    'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  function spell(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''); }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Escape, then show each fill-in blank as a short underline.
  const fmt = s => esc(s).replace(/_{3,}/g, '<span class="ref-blank"></span>').replace(/`([^`]+)`/g, '<span class="mono ref-ex">$1</span>');
  const findText = (...a) => esc(a.flat().filter(Boolean).join(' ').replace(/`/g, '').toUpperCase());

  function arlTable() {
    return `<table class="t ref-t"><thead><tr><th class="num">#</th><th>Sent as</th><th>Meaning</th></tr></thead><tbody>${ARL.map(([n, t, hxd]) => {
      const words = 'ARL ' + spell(n);
      if (!t) return `<tr class="ref-reserved" data-find="${n} ${words} reserved"><td class="num mono">${n}</td><td class="mono">—</td><td class="muted"><i>Reserved for future use</i></td></tr>`;
      return `<tr data-find="${esc((n + ' ' + words + ' ' + t + (hxd ? ' HXD' : '')).toUpperCase())}"><td class="num mono">${n}</td><td class="mono ref-code">${words}</td><td>${fmt(t)}${hxd ? ' <span class="badge acc" title="New ARL text to be used with HXD">use with HXD</span>' : ''}</td></tr>`;
    }).join('')}</tbody></table>`;
  }

  function qnTable() {
    return `<table class="t ref-t"><thead><tr><th>Signal</th><th>Meaning</th></tr></thead><tbody>${QN.map(r => {
      const parts = [];
      if (r.ncs) parts.push(`<div><span class="badge warn" title="For use only by the net control station">NCS</span> ${fmt(r.ncs)}</div>`);
      if (r.t) parts.push(`<div>${fmt(r.t)}</div>`);
      return `<tr data-find="${esc((r.c + ' ' + (r.ncs || '') + ' ' + (r.t || '') + (r.ncs ? ' NCS' : '')).toUpperCase())}"><td class="mono ref-code">${r.c}</td><td>${parts.join('')}</td></tr>`;
    }).join('')}</tbody></table>`;
  }

  function qTable() {
    return `<table class="t ref-t"><thead><tr><th>Signal</th><th>Meaning</th></tr></thead><tbody>${Q.map(([c, t, note]) =>
      `<tr data-find="${esc((c + ' ' + t + ' ' + (note || '')).toUpperCase())}"><td class="mono ref-code">${c}</td><td>${fmt(t)}${note ? `<div class="muted small">${fmt(note)}</div>` : ''}</td></tr>`
    ).join('')}</tbody></table>`;
  }

  function partsTable() {
    return `<table class="t ref-t"><thead><tr><th>Part</th><th>What goes there</th></tr></thead><tbody>${PARTS.map(([p, t, lines]) =>
      `<tr data-find="${findText(p, t, lines)}"><td class="ref-part">${esc(p)}</td><td>${fmt(t)}${lines ? `<ul class="ref-lines">${lines.map(l => `<li>${fmt(l)}</li>`).join('')}</ul>` : ''}</td></tr>`
    ).join('')}</tbody></table>`;
  }

  function hxTable() {
    return `<table class="t ref-t"><thead><tr><th>Code</th><th>Meaning</th></tr></thead><tbody>${HXS.map(([c, t, common]) =>
      `<tr data-find="${findText(c, t, common ? 'COMMON' : '')}"><td class="mono ref-code">${c}</td><td>${fmt(t)}${common ? ' <span class="badge ok">common</span>' : ''}</td></tr>`
    ).join('')}</tbody></table>`;
  }

  function countTable() {
    return `<table class="t ref-t"><thead><tr><th>In the text</th><th>Counts as</th></tr></thead><tbody>${COUNTS.map(([t, n]) =>
      `<tr data-find="${findText(t, n, 'CHECK COUNT')}"><td>${fmt(t)}</td><td class="ref-nowrap">${esc(n)}</td></tr>`
    ).join('')}</tbody></table>`;
  }

  function render() {
    const host = document.getElementById('ref-host');
    if (!host || host.dataset.done) return;
    host.dataset.done = '1';
    host.innerHTML = `
      <div id="ref-arl">
        <div class="panel">
          <div class="panel-head"><h2>ARL Numbered Radiogram Texts</h2><span class="muted small">NTS 2.0 · Rev. 2023-05-25</span></div>
          <p class="small muted ref-intro">A common text can be sent as <b>ARL</b> and a spelled-out number in place of the words. Put <b>ARL</b> in the check (<span class="mono">ARL 4</span>) and before each spelled-out number in the text (<span class="mono">ARL FORTY SIX</span>). The delivering station reads the actual text to the addressee, not the number. Some texts need numbers or words filled into the blanks. ARRL has adopted the RRI numbered radiograms as written.</p>
          <div class="table-wrap">${arlTable()}</div>
          <p class="empty hidden ref-none">No ARL texts match.</p>
        </div>
      </div>
      <div id="ref-q" class="hidden">
        <div class="panel">
          <div class="panel-head"><h2>QN Signals for CW Net Use</h2><span class="spacer"></span><span class="badge warn">NCS</span><span class="muted small">for use only by the net control station</span></div>
          <div class="table-wrap">${qnTable()}</div>
          <p class="empty hidden ref-none">No QN signals match.</p>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>International Q Signals</h2></div>
          <p class="small muted ref-intro">A Q signal followed by <b>?</b> asks the question. Without the <b>?</b> it answers it affirmatively, unless noted otherwise.</p>
          <div class="table-wrap">${qTable()}</div>
          <p class="empty hidden ref-none">No Q signals match.</p>
        </div>
      </div>
      <div id="ref-fmt" class="hidden">
        <div class="panel">
          <div class="panel-head"><h2>Parts of a Radiogram</h2></div>
          <p class="small muted ref-intro">The preamble is sent in this order: <span class="mono ref-ex">NR 123 R HXG W1AW 15 NEWINGTON CT 1830Z NOV 19</span></p>
          <div class="table-wrap">${partsTable()}</div>
          <p class="empty hidden ref-none">No parts match.</p>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>Handling Instructions (HX)</h2><span class="spacer"></span><span class="badge ok">common</span><span class="muted small">most commonly used</span></div>
          <div class="table-wrap">${hxTable()}</div>
          <p class="empty hidden ref-none">No HX codes match.</p>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>Counting the Check</h2></div>
          <p class="small muted ref-intro">The check is the number of words in the text. These are easy to miscount:</p>
          <div class="table-wrap">${countTable()}</div>
          <p class="empty hidden ref-none">No counting rules match.</p>
        </div>
      </div>`;
  }

  function filter() {
    const q = (document.getElementById('ref-search').value || '').trim().toUpperCase();
    const words = q.split(/\s+/).filter(Boolean);
    const counts = {};
    document.querySelectorAll('#ref-host .panel').forEach(p => {
      let shown = 0;
      p.querySelectorAll('tbody tr').forEach(tr => {
        const hay = tr.dataset.find || '';
        const ok = !words.length || words.every(w => hay.includes(w));
        tr.classList.toggle('hidden', !ok);
        if (ok) shown++;
      });
      p.querySelector('.ref-none').classList.toggle('hidden', shown > 0);
      p.querySelector('.table-wrap').classList.toggle('hidden', shown === 0);
      counts[p.closest('[id^=ref-]').id] = (counts[p.closest('[id^=ref-]').id] || 0) + shown;
    });
    // Nothing on this list but matches on another: show that one.
    if (words.length) {
      const cur = document.querySelector('#ref-tabs button.active').dataset.sub;
      const other = SUBS.find(x => counts['ref-' + x]);
      if (!counts['ref-' + cur] && other) showSub(other);
    }
  }

  const SUBS = ['arl', 'q', 'fmt'];
  function showSub(sub) {
    document.querySelectorAll('#ref-tabs button[data-sub]').forEach(x => x.classList.toggle('active', x.dataset.sub === sub));
    SUBS.forEach(x => document.getElementById('ref-' + x).classList.toggle('hidden', sub !== x));
  }

  function bind() {
    document.getElementById('ref-tabs').addEventListener('click', e => {
      const b = e.target.closest('button[data-sub]');
      if (b) showSub(b.dataset.sub);
    });
    document.getElementById('ref-search').addEventListener('input', filter);
  }

  window.REF = { render, bind, spell };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { render(); bind(); });
  else { render(); bind(); }
})();
