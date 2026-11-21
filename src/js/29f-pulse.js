/* =====================================================================
   نبض الشراكة + ذاكرة الجهة
   - النبض: آخر نشاط حقيقي في الشراكة (اجتماع، خطوة في مسار المذكرة، تقييم، تجديد، إنجاز ميداني،
     تقرير، توقيع). تعديل الحقول أو رفع مستندات الأرشيف لا يُعد نشاطًا مع الشريك.
     نشطة ≤ 45 يومًا · هادئة ≤ 120 يومًا · خاملة أكثر من ذلك.
   - ذاكرة الجهة: «جهّزني للاجتماع» — صفحة واحدة عن الجهة: آخر ما اتُّفق عليه، الالتزامات المفتوحة،
     آخر النشاط، ضباط الاتصال، الملفات الأساسية؛ و«تسجيل اجتماع» يحفظ ما اتُّفق عليه والخطوات التالية.
   ===================================================================== */
const PULSE_LV = [
  { k: 'live', l: 'نشطة', max: 45, d: 'نشاط خلال آخر 45 يومًا' },
  { k: 'calm', l: 'هادئة', max: 120, d: 'لا نشاط منذ أكثر من 45 يومًا' },
  { k: 'dorm', l: 'خاملة', max: Infinity, d: 'لا نشاط منذ أكثر من 120 يومًا' },
];
const PULSE_FILE_CATS = ['تقرير الشراكة العام', 'تقييم الشراكة'];
/* أحداث الشراكة الحقيقية مرتبة من الأحدث */
function pulseEvents(p) {
  const ev = [], add = (at, t, ic, kind) => { const d = parseDate(String(at || '').slice(0, 10)); if (d && d <= today()) ev.push({ at: String(at).slice(0, 10), t, ic, kind }); };
  (p.meetings || []).forEach((m) => add(m.date, `اجتماع${m.title ? ': ' + m.title : ''}`, 'users', 'meeting'));
  Object.entries((p.wf && p.wf.steps) || {}).forEach(([id, s]) => { if (s && s.status === 'done' && s.at && !s.direct) { const st = (typeof WF_STEPS !== 'undefined' ? WF_STEPS : []).find((x) => x.id === id); add(s.at, `مسار المذكرة: ${st ? st.t : id}`, 'layers', 'wf'); } });
  (p.evals || []).filter((e) => e.status === 'done').forEach((e) => add(e.at, 'تقييم الشراكة', 'star', 'eval'));
  (p.renewals || []).forEach((r) => add(r.at || r.from, 'تجديد الشراكة', 'history', 'renew'));
  D.achievements.filter((a) => a.partnershipId === p.id && (showDemo() || !a.demo)).forEach((a) => add(a.date, `إنجاز: ${a.title || ''}`, 'award', 'story'));
  (p.attachments || []).filter((a) => PULSE_FILE_CATS.includes(a.category) || /بوابة|الشريك/.test(a.by || '')).forEach((a) => add(a.addedAt, `${a.category}: ${a.name}`, 'file', 'file'));
  if (p.stage === 'signed' && p.startDate) add(p.startDate, 'توقيع الشراكة', 'flag', 'sign');
  return ev.sort((a, b) => (a.at < b.at ? 1 : -1));
}
function pulseOf(p) {
  const ev = pulseEvents(p), last = ev[0] || null;
  const days = last ? daysBetween(parseDate(last.at), today()) : null;
  const lv = days === null ? PULSE_LV[2] : PULSE_LV.find((x) => days <= x.max);
  return { last, days, lv, ev };
}
const pulseApplies = (p) => !p.isDraft && !['ended', 'cancel'].includes(pStatus(p));
function pulseDotHTML(p) {
  if (!pulseApplies(p)) return '';
  const P = pulseOf(p);
  return `<span class="pulse-dot ${P.lv.k}" title="نبض الشراكة: ${P.lv.l}${P.last ? ` — آخر نشاط قبل ${plural(P.days, 'يوم واحد', 'يومين', 'أيام', 'يومًا')}: ${esc(P.last.t)}` : ' — لا نشاط مسجّل'}"><i></i>${P.lv.l}</span>`;
}
function pulseFactHTML(p) {
  if (!pulseApplies(p)) return '';
  const P = pulseOf(p);
  const sub = P.last ? `آخر نشاط ${P.days === 0 ? 'اليوم' : 'قبل ' + plural(P.days, 'يوم واحد', 'يومين', 'أيام', 'يومًا')}` : 'لا نشاط مسجّل';
  return `<a class="pfx pulse ${P.lv.k}" href="#follow" data-anchor-to="follow" title="${esc(P.last ? P.last.t : '')}"><span class="pfx-ic"><span class="pulse-wave"><i></i><i></i><i></i></span></span><span class="pfx-b"><small>نبض الشراكة</small><b>${P.lv.l}</b><em>${sub}</em></span></a>`;
}

/* ===== ذاكرة الجهة ===== */
function memLines(s) { return String(s || '').split('\n').map((x) => x.replace(/^\s*[-•*\d.)]+\s*/, '').trim()).filter(Boolean); }
function memOpenItems(list) {
  const out = [];
  list.forEach((p) => (p.meetings || []).forEach((m) => memLines(m.next).forEach((t, i) => { if (!(m.done || []).includes(i)) out.push({ p, m, i, t }); })));
  return out.sort((a, b) => ((a.m.due || '9') < (b.m.due || '9') ? -1 : 1));
}
function partnerMemoryHTML(pr, list, { print = false } = {}) {
  const contacts = can('view.contacts');
  const meets = list.flatMap((p) => (p.meetings || []).map((m) => ({ p, m }))).sort((a, b) => (a.m.date < b.m.date ? 1 : -1));
  const last = meets[0];
  const open = memOpenItems(list);
  const evs = list.flatMap((p) => pulseEvents(p).map((e) => ({ ...e, p }))).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 7);
  const files = list.flatMap((p) => (p.attachments || []).filter((a) => ['الاتفاقية', 'مستندات مسار المذكرة'].includes(a.category)).map((a) => ({ a, p }))).slice(0, 6);
  const ppl = contacts ? [...new Map(list.filter((p) => p.contactName || p.contactEmail || p.contactPhone).map((p) => [(p.contactName || '') + (p.contactEmail || ''), p])).values()] : [];
  const st = (p) => { const s = pStatus(p), dl = daysLeft(p); return `${statusLabel(s)}${dl !== null && ['active', 'soon'].includes(s) ? ` · متبقٍ ${plural(dl, 'يوم واحد', 'يومان', 'أيام', 'يومًا')}` : ''}`; };
  const sec = (ic, t, body) => `<section class="mem-sec"><h4>${icon(ic)} ${t}</h4>${body}</section>`;
  return `<div class="mem ${print ? 'mem-print' : ''}">
    <div class="mem-head">${plateHTML(pr, 56)}<div><small>ذاكرة الجهة · ${fmtDate(isoDate(today()))}</small><h3>${esc(pr ? pr.name : partnerName(list[0]))}</h3>
      <div class="mem-pts">${list.map((p) => `<span>${esc(p.code || '')} · ${esc(p.classification || 'شراكة')} · ${st(p)} ${pulseDotHTML(p)}</span>`).join('')}</div></div></div>
    <div class="mem-grid">
      ${sec('msg', 'آخر ما اتفقنا عليه', last ? `<div class="mem-last"><b>${fmtDate(last.m.date)}${last.m.title ? ' — ' + esc(last.m.title) : ''}</b>${last.m.attendees ? `<small>الحضور: ${esc(last.m.attendees)}</small>` : ''}<p>${esc(last.m.agreed || '—').replace(/\n/g, '<br>')}</p></div>` : '<p class="mem-empty">لا اجتماعات مسجّلة بعد. سجّل أول اجتماع ليبدأ بناء ذاكرة العلاقة.</p>')}
      ${sec('check', `الالتزامات المفتوحة${open.length ? ` <em>${open.length}</em>` : ''}`, open.length ? `<ul class="mem-open">${open.map((o) => `<li><label><input type="checkbox" data-memdone="${esc(o.p.id)}|${esc(o.m.id)}|${o.i}" ${print || !can('edit.partnership') ? 'disabled' : ''}><span>${esc(o.t)}</span></label>${o.m.due ? `<small class="${o.m.due < isoDate(today()) ? 'late' : ''}">حتى ${fmtDate(o.m.due)}</small>` : ''}</li>`).join('')}</ul>` : '<p class="mem-empty">لا التزامات مفتوحة.</p>')}
      ${sec('history', 'آخر النشاط', evs.length ? `<ul class="mem-tl">${evs.map((e) => `<li><time>${fmtDate(e.at, 'short')}</time><span>${esc(e.t)}</span></li>`).join('')}</ul>` : '<p class="mem-empty">لا نشاط مسجّل.</p>')}
      ${contacts ? sec('users', 'ضباط الاتصال', ppl.length ? `<ul class="mem-ppl">${ppl.map((p) => `<li><b>${esc(p.contactName || '—')}</b>${p.contactPhone ? `<a href="tel:${esc(p.contactPhone)}" class="num">${esc(p.contactPhone)}</a>` : ''}${p.contactEmail ? `<a href="mailto:${esc(p.contactEmail)}" dir="ltr">${esc(p.contactEmail)}</a>` : ''}</li>`).join('')}</ul>` : '<p class="mem-empty">لم تُسجَّل بيانات تواصل.</p>') : ''}
      ${sec('file', 'الملفات الأساسية', files.length ? `<ul class="mem-files">${files.map(({ a }) => `<li>${print ? `<span>${esc(a.name)}</span>` : `<button type="button" class="linkbtn" data-viewf="${esc(a.fileId)}">${esc(a.name)}</button>`}<small>${esc(a.category)}</small></li>`).join('')}</ul>` : '<p class="mem-empty">لا ملفات اتفاقية مرفوعة.</p>')}
      ${meets.length > 1 ? sec('layers', 'الاجتماعات السابقة', `<ul class="mem-tl">${meets.slice(1, 6).map(({ m }) => `<li><time>${fmtDate(m.date, 'short')}</time><span>${esc(m.title || memLines(m.agreed)[0] || 'اجتماع')}</span></li>`).join('')}</ul>`) : ''}
    </div></div>`;
}
function partnerMemoryDialog(p) {
  const pr = partnerById(p.partnerId);
  const list = D.partnerships.filter((x) => x.partnerId === p.partnerId && !x.isDraft && (showDemo() || !x.demo));
  if (!list.includes(p)) list.unshift(p);
  const edit = can('edit.partnership');
  const m = Modal.open({ title: 'ذاكرة الجهة — جهّزني للاجتماع', size: 'lg', cls: 'mem-dlg', body: partnerMemoryHTML(pr, list),
    foot: `${edit ? `<button class="btn primary" data-memnew>${icon('plus')} تسجيل اجتماع</button>` : ''}<button class="btn" data-memprint>${icon('print')} طباعة</button><button class="btn ghost" data-mclose>إغلاق</button>` });
  hydrateFiles(m.el);
  m.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-memprint]')) return memPrint(pr, list);
    if (e.target.closest('[data-memnew]')) { m.close(); return meetingDialog(p, list); }
    const vf = e.target.closest('[data-viewf]'); if (vf) return viewStored(vf.dataset.viewf);
  });
  m.el.addEventListener('change', async (e) => {
    const c = e.target.closest('[data-memdone]'); if (!c) return;
    const [pid, mid, i] = c.dataset.memdone.split('|'); const x = D.partnerships.find((y) => y.id === pid); const mt = x && (x.meetings || []).find((y) => y.id === mid); if (!mt) return;
    mt.done = c.checked ? [...new Set([...(mt.done || []), +i])] : (mt.done || []).filter((k) => k !== +i);
    await Repo.save('partnerships', x); await Repo.log('partnership.meeting', 'partnership', x.id, x.code, `${c.checked ? 'إنجاز' : 'إعادة فتح'} التزام: ${memLines(mt.next)[+i] || ''}`);
    c.closest('li').classList.toggle('done', c.checked); toast(c.checked ? 'سُجّل إنجاز الالتزام' : 'أُعيد فتح الالتزام');
  });
}
function memPrint(pr, list) {
  const host = document.createElement('div'); host.id = 'memPrint'; host.innerHTML = partnerMemoryHTML(pr, list, { print: true });
  document.body.appendChild(host); document.documentElement.classList.add('printing-mem');
  const done = () => { document.documentElement.classList.remove('printing-mem'); host.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); setTimeout(() => window.print(), 150);
}
function meetingDialog(p, list) {
  list = list || [p];
  const m = Modal.open({ title: 'تسجيل اجتماع', cls: 'mt-dlg', body: `<div class="grid2">
      ${list.length > 1 ? `<div class="field span2"><label>الشراكة</label><select class="in" id="mtP">${list.map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.code || '')} — ${esc(x.title || partnerName(x))}</option>`).join('')}</select></div>` : ''}
      <div class="field"><label>تاريخ الاجتماع</label><input class="in" type="date" id="mtD" value="${isoDate(today())}" max="${isoDate(today())}"></div>
      <div class="field"><label>الموضوع (اختياري)</label><input class="in" id="mtT" placeholder="مثل: اجتماع تفعيل المذكرة"></div>
      <div class="field span2"><label>الحضور</label><input class="in" id="mtA" placeholder="أسماء الحضور من الطرفين"></div>
      <div class="field span2"><label>ما اتُّفق عليه <i class="req">*</i></label><textarea class="in" id="mtG" rows="3" placeholder="أهم ما اتُّفق عليه في الاجتماع"></textarea><span class="err">اكتب ما اتُّفق عليه.</span></div>
      <div class="field span2"><label>الخطوات التالية والالتزامات</label><textarea class="in" id="mtN" rows="3" placeholder="كل التزام في سطر — مثل: إرسال خطة التشجير (الشريك)"></textarea><span class="hint">تظهر التزاماتٍ مفتوحة في «ذاكرة الجهة» حتى تُعلَّم منجزة.</span></div>
      <div class="field"><label>موعد الخطوات التالية</label><input class="in" type="date" id="mtDue"></div>
    </div>`, foot: `<button class="btn primary" data-ok>${icon('check')} حفظ الاجتماع</button><button class="btn ghost" data-mclose>إلغاء</button>` });
  m.el.querySelector('[data-ok]').onclick = async () => {
    const v = (id) => (m.el.querySelector('#' + id) || {}).value || '';
    if (!v('mtG').trim()) { m.el.querySelector('#mtG').closest('.field').classList.add('invalid'); return; }
    const x = D.partnerships.find((y) => y.id === (v('mtP') || p.id));
    const rec = { id: uid('mt'), date: v('mtD') || isoDate(today()), title: v('mtT').trim(), attendees: v('mtA').trim(), agreed: v('mtG').trim(), next: v('mtN').trim(), due: v('mtDue'), done: [], by: Session.userName(), createdAt: nowISO() };
    x.meetings = [...(x.meetings || []), rec];
    await Repo.save('partnerships', x);
    await Repo.log('partnership.meeting', 'partnership', x.id, x.code + ' — ' + (x.title || ''), `تسجيل اجتماع ${fmtDate(rec.date)}${rec.title ? ': ' + rec.title : ''}`);
    m.close(); toast('سُجّل الاجتماع في ذاكرة الجهة'); if (typeof rerenderKeep === 'function' && location.hash.includes(x.id)) rerenderKeep();
  };
}
/* قسم الاجتماعات داخل «المتابعة» في صفحة الشراكة */
function meetingsSectionHTML(p) {
  const ms = (p.meetings || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const edit = can('edit.partnership');
  return `<div class="mt-sec"><div class="mt-h"><h3>${icon('users')} سجل الاجتماعات</h3><div class="mt-acts"><button type="button" class="btn sm" data-memopen>${icon('msg')} ذاكرة الجهة</button>${edit ? `<button type="button" class="btn sm primary" data-mtnew>${icon('plus')} تسجيل اجتماع</button>` : ''}</div></div>
    ${ms.length ? `<ol class="mt-list">${ms.map((m) => `<li><time>${fmtDate(m.date)}</time><div><b>${esc(m.title || 'اجتماع')}</b>${m.attendees ? `<small>الحضور: ${esc(m.attendees)}</small>` : ''}<p>${esc(m.agreed).replace(/\n/g, '<br>')}</p>${memLines(m.next).length ? `<ul>${memLines(m.next).map((t, i) => `<li class="${(m.done || []).includes(i) ? 'done' : ''}">${esc(t)}</li>`).join('')}</ul>` : ''}</div></li>`).join('')}</ol>` : '<p class="muted small">لم تُسجَّل اجتماعات بعد. سجّل الاجتماعات لتبني ذاكرة العلاقة مع الجهة ويظهر نبض الشراكة.</p>'}</div>`;
}
