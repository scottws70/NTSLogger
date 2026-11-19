/*
 * Print a radiogram on the traditional paper form (landscape), or save it as a PDF
 * through the system print dialog.
 */
(function () {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const BASE_TITLE = document.title;

  function radioDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return NTS.MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate();
  }
  function radioTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + 'Z';
  }
  function precWord(p) {
    return ({ R: 'ROUTINE', W: 'WELFARE', P: 'PRIORITY', EMERGENCY: 'EMERGENCY' })[p] || p || '';
  }

  /** The form's HTML for message m. me = { call, name, city, state } (the receiving station). */
  function formHtml(m, me) {
    me = me || {};
    const words = NTS.textWords(m.text);
    const rows = Math.max(5, Math.ceil(words.length / 5));
    // Shorter rows for a long text, so the form still fits on one landscape page (to about 70 words).
    const rowH = Math.max(0.2, Math.min(0.29, 2.8 / rows)).toFixed(3) + 'in';
    let grid = '';
    for (let r = 0; r < rows; r++) {
      grid += `<tr style="height:${rowH}">`;
      for (let c = 0; c < 5; c++) grid += `<td>${esc(words[r * 5 + c] || '')}</td>`;
      grid += '</tr>';
    }

    const recv = m.origin !== 'originated' && m.received ? m.received : null;
    const sent = m.status === 'relayed' && m.disp ? m.disp : null;

    const notes = [];
    if (m.opNote) notes.push('OP NOTE: ' + m.opNote);
    if (recv && recv.net) notes.push('Received on ' + recv.net);
    if (sent && sent.net) notes.push('Sent on ' + sent.net);
    if (m.status === 'delivered' && m.disp) {
      notes.push('Delivered' + (m.disp.to ? ' to ' + m.disp.to : '') + (m.disp.method ? ' by ' + String(m.disp.method).toLowerCase() : '') +
        (m.disp.utc ? ' ' + radioDate(m.disp.utc) + ' ' + radioTime(m.disp.utc) : ''));
    }
    if (m.status === 'serviced' && m.disp) notes.push('Undeliverable' + (m.disp.reason ? ': ' + m.disp.reason : '') + (m.disp.to ? ' (serviced to ' + m.disp.to + ')' : ''));
    if (m.disp && m.disp.note) notes.push(m.disp.note);

    const to = NTS.addressLines(m.to);
    const cityState = [me.city, me.state].filter(Boolean).join(' ');

    return `
<div class="rg">
  <table class="rg-t rg-head"><tr>
    <td class="rg-title"><div class="rg-l1">The American Radio Relay League</div><div class="rg-l2">RADIOGRAM</div><div class="rg-l3">Via Amateur Radio</div></td>
  </tr></table>
  <table class="rg-t rg-pre">
    <colgroup><col style="width:8.9%"><col style="width:12.2%"><col style="width:5.4%"><col style="width:15.8%"><col style="width:10.9%"><col style="width:23.4%"><col style="width:11.9%"><col style="width:11.5%"></colgroup>
    <tr class="rg-lbl"><td>Number</td><td>Precedence</td><td>HX</td><td>Station of Origin</td><td>Check</td><td>Place of Origin</td><td>Time Filed</td><td>Date</td></tr>
    <tr class="rg-val"><td>${esc(m.nr)}</td><td>${esc(precWord(m.prec))}</td><td>${esc(m.hx)}</td><td>${esc(m.station)}</td><td>${esc(m.check)}</td><td>${esc(m.place)}</td><td>${esc(m.time)}</td><td>${esc(m.date)}</td></tr>
  </table>
  <table class="rg-t rg-to">
    <colgroup><col style="width:53.2%"><col style="width:46.8%"></colgroup>
    <tr class="rg-lbl"><td class="rg-left"><b>To:</b></td><td class="rg-left">This Radiogram Message was received at:</td></tr>
    <tr><td class="rg-addr">${to.map(l => `<div>${esc(l)}</div>`).join('')}</td>
      <td class="rg-at">
        <div><span>Amateur Station:</span> ${esc(me.call)}</div>
        <div><span>Name:</span> ${esc(me.name)}</div>
        <div><span>Street Address:</span></div>
        <div><span>City, State Zip:</span> ${esc(cityState)}</div>
        <div><span>Telephone No:</span></div>
      </td></tr>
  </table>
  <table class="rg-t rg-text"><colgroup><col style="width:21.1%"><col style="width:21.3%"><col style="width:18%"><col style="width:16.3%"><col style="width:23.3%"></colgroup>${grid}</table>
  <table class="rg-t rg-sig">
    <colgroup><col style="width:21.1%"><col></colgroup>
    <tr><td class="rg-lbl rg-siglbl">SIGNATURE:</td><td class="rg-sigval">${esc(m.sig)}</td></tr>
  </table>
  <table class="rg-t rg-log">
    <colgroup><col style="width:8.9%"><col style="width:17.6%"><col style="width:15.8%"><col style="width:10.9%"><col style="width:7%"><col style="width:16.4%"><col style="width:11.9%"><col style="width:11.5%"></colgroup>
    <tr class="rg-lbl"><td colspan="2" class="rg-right">FROM STATION</td><td>DATE</td><td>TIME</td><td colspan="2" class="rg-right">TO STATION</td><td>DATE</td><td>TIME</td></tr>
    <tr class="rg-val"><td class="rg-left rg-lbl">REC'D:</td><td>${esc(recv && recv.from)}</td><td>${esc(recv && radioDate(recv.utc))}</td><td>${esc(recv && radioTime(recv.utc))}</td>
      <td class="rg-left rg-lbl">SENT:</td><td>${esc(sent && sent.to)}</td><td>${esc(sent && radioDate(sent.utc))}</td><td>${esc(sent && radioTime(sent.utc))}</td></tr>
  </table>
  <table class="rg-t rg-foot">
    <colgroup><col style="width:53.2%"><col style="width:46.8%"></colgroup>
    <tr><td class="rg-free">A licensed Amateur Radio Operator handled this message free of charge. As such messages are handled solely for the pleasure of operating, a "Ham" Operator can accept no compensation. A return message may be filed with the Ham delivering this message to you.</td>
      <td class="rg-notes">${notes.map(n => `<div>${esc(n)}</div>`).join('')}</td></tr>
  </table>
</div>`;
  }

  /** Put the form for message m on the page and open the print dialog (which can also save a PDF). */
  function printRadiogram(m, me) {
    let host = document.getElementById('print-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'print-host';
      document.body.appendChild(host);
    }
    // The form stays in #print-host (shown only when printing) until the next print, since
    // some webviews return from print() before the dialog is finished.
    host.innerHTML = formHtml(m, me);
    // Name the PDF after the message when the dialog offers to save one.
    document.title = 'Radiogram NR ' + (m.nr || '') + (m.to && m.to.name ? ' - ' + m.to.name : '');
    const restore = () => { document.title = BASE_TITLE; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    setTimeout(restore, 120000);
    setTimeout(() => window.print(), 50);
  }

  window.RADIOGRAM = { formHtml, printRadiogram };
})();
