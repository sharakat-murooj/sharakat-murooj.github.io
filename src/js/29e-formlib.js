/* =====================================================================
   مكتبة النماذج: كل نماذج المنظومة فارغة للتنزيل Word أو PDF، بالتنسيق
   والخطوط والألوان نفسها التي تصدر بها من داخل السجلات.
   ===================================================================== */
const FORM_BLANK_REC = () => ({ id: '__blank', code: '', title: '', partnerId: null, partnerName: '', department: '', departments: [], owners: [], forms: {}, evals: [], attachments: [], renewals: [], cooperationAreas: '', outputs: '', expectedImpact: '', blank: true });
let FORM_BLANK = false;
/* يُفرغ القيم الافتراضية في المستند: الشرطات تصبح خطوط كتابة */
function formBlankHTML(kind, key) {
  FORM_BLANK = true;
  try {
    let h = formDocHTML(kind, FORM_BLANK_REC(), key, null);
    ['لا توجد مبررات مكتوبة.', 'لا توجد ملاحظات.', 'لم يُكتب الغرض.', 'لم يُوصف الأثر المتوقع.', 'مسودة — لم يُعتمد', 'لم تُقيَّم', 'لم يُقيَّم'].forEach((t) => { h = h.split(t).join(''); });
    h = h.replace(/>مسودة</g, '><');
    h = h.replace(/>—</g, '><span class="fd-blank"></span><').replace(/>\s*—\s*</g, '><span class="fd-blank"></span><');
    return h;
  } finally { FORM_BLANK = false; }
}
const formLibList = () => Object.entries(FORMS).filter(([, F]) => F && F.title).map(([k, F]) => ({ k, F, kind: F.kind || (['methodology', 'initialEval', 'alignment'].includes(k) ? 'proposal' : 'partnership'), step: F.step && typeof wfStep === 'function' ? wfStep(F.step) : null }))
  .sort((a, b) => ((a.step && a.step.n) || 99) - ((b.step && b.step.n) || 99));

function renderFormLib(el) {
  if (!(can('edit.partnership') || can('manage.lists'))) { el.innerHTML = noAccessHTML(); return; }
  const L_ = formLibList();
  el.innerHTML = `<div class="ph"><div><h1>النماذج</h1><p>كل نماذج المنظومة فارغة وجاهزة للتعبئة، بالتنسيق والخط والألوان نفسها التي تصدر بها من السجلات. نزّلها Word للتعديل أو PDF للطباعة.</p></div></div>
    <div class="fl-grid">${L_.map(({ k, F, step }) => `<article class="fl-card">
      <div class="fl-top"><span class="fl-ic">${icon(F.ic || 'file')}</span><span class="fl-no">${esc(F.no || '')}</span></div>
      <h3>${esc(F.title)}</h3>
      <p class="fl-meta">${step ? `الخطوة ${step.n} من مسار المذكرة: ${esc(step.t)}` : F.periodic ? 'تقييم دوري للشراكة' : 'نموذج مساند'}</p>
      <div class="fl-acts"><button type="button" class="btn sm" data-flview="${k}">${icon('eye')} معاينة</button><button type="button" class="btn sm" data-flword="${k}">${icon('download')} Word</button><button type="button" class="btn sm primary" data-flpdf="${k}">${icon('print')} PDF</button></div>
    </article>`).join('')}</div>`;
  const it = (k) => L_.find((x) => x.k === k);
  el.onclick = (e) => {
    const v = e.target.closest('[data-flview]'), w = e.target.closest('[data-flword]'), p = e.target.closest('[data-flpdf]');
    if (v) { const x = it(v.dataset.flview); const m = Modal.open({ title: x.F.title, size: 'xl', body: `<div class="fl-prev">${formBlankHTML(x.kind, x.k)}</div>`, foot: `<button class="btn" data-mclose>إغلاق</button><button class="btn" data-flword="${x.k}">${icon('download')} Word</button><button class="btn primary" data-flpdf="${x.k}">${icon('print')} PDF</button>` }); hydrateFiles(m.el); m.el.addEventListener('click', (ev) => { const a = ev.target.closest('[data-flword],[data-flpdf]'); if (!a) return; m.close(); if (a.dataset.flword) formLibWord(it(a.dataset.flword)); else formLibPdf(it(a.dataset.flpdf)); }); return; }
    if (w) return formLibWord(it(w.dataset.flword));
    if (p) return formLibPdf(it(p.dataset.flpdf));
  };
}
function formLibPdf(x) {
  let host = $('#formPrint'); if (host) host.remove();
  host = document.createElement('div'); host.id = 'formPrint'; host.innerHTML = formBlankHTML(x.kind, x.k);
  document.body.appendChild(host); hydrateFiles(host);
  document.documentElement.classList.add('printing-form');
  const prev = document.title; document.title = `${x.F.title} — نموذج فارغ`;
  const done = () => { document.documentElement.classList.remove('printing-form'); host.remove(); document.title = prev; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 350);
}
function formLibWord(x) { FORM_BLANK = true; try { wordFormBlank(x.kind, FORM_BLANK_REC(), x.k); } finally { FORM_BLANK = false; } }
function wordFormBlank(kind, rec, key) {
  /* يعيد استخدام wordForm مع تفريغ القيم */
  const keep = window.download;
  window.download = (name, blob) => blob.text().then((t) => keep(`${FORMS[key].short || FORMS[key].title} — نموذج فارغ.doc`, new Blob([t.replace(/>—</g, '>&nbsp;<').replace(/>\s*—\s*</g, '>&nbsp;<')], { type: 'application/msword' })));
  try { wordForm(kind, rec, key, null); } finally { window.download = keep; }
}
