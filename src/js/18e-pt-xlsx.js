/* =====================================================================
   نموذج Excel لكل شراكة: تنزيل ببياناتها، ثم رفعه بعد التحديث
   - ورقة «بيانات الشراكة»: حقل في كل صف (الحقل · القيمة · إرشاد التعبئة).
   - عمود A مخفي يحمل مفتاح الحقل، والخلية A2 تحمل معرّف الشراكة؛ فلا يُطابق الملف إلا شراكته.
   - القوائم المنسدلة من «القوائم» في المنصة (ورقة مخفية).
   - عند الرفع تُعرض الفروق حقلًا حقلًا للمراجعة قبل الحفظ، ويُسجَّل التحديث في سجل التغييرات.
   - لا تُصدَّر بيانات التواصل ولا الحقول الداخلية لمن لا يملك صلاحيتها، ولا تُحدَّث من الملف.
   ===================================================================== */
const PX_MARK = 'shk-pt-v1';
function pxFields() {
  const contacts = can('view.contacts'), internal = can('view.internal');
  const st = (D.settings.stages || []);
  return [
    { sec: 'البيانات الأساسية' },
    { k: 'code', l: 'رمز الشراكة', ro: 1, get: (p) => p.code || '' },
    { k: 'partner', l: 'الجهة الشريكة', ro: 1, get: (p) => partnerName(p), h: 'للاطلاع — تغيير الجهة من صفحة التعديل في المنصة' },
    { k: 'status', l: 'حالة السريان', ro: 1, get: (p) => statusLabel(pStatus(p)), h: 'تُحسب تلقائيًا من التواريخ والمرحلة' },
    { k: 'title', l: 'اسم الشراكة', h: 'يُستخدم اسم الجهة إن تُرك فارغًا' },
    { k: 'sector', l: 'القطاع', list: L('sectors'), get: (p) => pSector(p), h: 'اختر من القائمة · يُحفظ على مستوى الجهة' },
    { k: 'classification', l: 'تصنيف المذكرة', list: L('classifications'), h: 'اختر من القائمة' },
    { k: 'categories', l: 'تصنيف الشراكة', multi: 1, h: `افصل بين القيم بـ «،» — المتاح: ${L('categories').join('، ')}` },
    { k: 'region', l: 'المنطقة', list: typeof KSA_REGION_NAMES !== 'undefined' ? KSA_REGION_NAMES : [], h: 'اختر من القائمة' },
    { sec: 'الفترة والتفعيل' },
    { k: 'startDate', l: 'تاريخ بدء الشراكة', date: 1, h: 'تاريخ بصيغة يوم/شهر/سنة، مثل 15/03/2026' },
    { k: 'endDate', l: 'تاريخ انتهاء الشراكة', date: 1, h: 'لا يسبق تاريخ البدء' },
    { k: 'activation', l: 'تفعيل الشراكة', list: L('activation'), h: 'اختر من القائمة' },
    { k: 'stage', l: 'مرحلة الشراكة', list: st.map((x) => x.label), get: (p) => stageLabel(p.stage), set: (v) => (st.find((x) => x.label === v) || {}).id, h: 'اختر من القائمة' },
    { sec: 'مجالات التعاون والأثر' },
    { k: 'cooperationAreas', l: 'مجالات التعاون', long: 1, h: 'كل بند في سطر مستقل (Alt+Enter لسطر جديد داخل الخلية)' },
    { k: 'expectedImpact', l: 'الأثر المتوقع وكيف يخدم المؤسسة', long: 1, h: 'كل بند في سطر مستقل' },
    { k: 'outputs', l: 'المخرجات (إسناد مشاريع، بناء مبادرات)', long: 1, h: 'كل مخرج في سطر مستقل' },
    ...(internal ? [{ k: 'notes', l: 'الملاحظات', long: 1 }, { k: 'recommendations', l: 'التوصيات', long: 1 }, { k: 'challenges', l: 'التحديات', long: 1 }] : []),
    { sec: 'الفريق والإدارات' },
    { k: 'owners', l: 'المسؤول من إدارة الشراكات', multi: 1, h: `افصل بين الأسماء بـ «،» — الفريق: ${L('team').join('، ')}` },
    { k: 'departments', l: 'التقاطع مع الإدارات', multi: 1, h: 'افصل بين الإدارات بـ «،»' },
    ...(contacts ? [{ sec: 'ضابط الاتصال لدى الجهة' }, { k: 'contactName', l: 'ضابط الاتصال' }, { k: 'contactEmail', l: 'البريد الإلكتروني', h: 'name@example.com' }, { k: 'contactPhone', l: 'رقم الجوال', h: '05XXXXXXXX' }] : []),
    { sec: 'العرض في الواجهة' },
    { k: 'showcaseGoal', l: 'الهدف المختصر للعرض', h: 'جملة واحدة' },
    { k: 'hl.value', l: 'أبرز نتيجة — الرقم', get: (p) => (p.highlight || {}).value || '', h: 'نتيجة متحققة فعلًا، مثل 4,800' },
    { k: 'hl.label', l: 'أبرز نتيجة — الوحدة', get: (p) => (p.highlight || {}).label || '', h: 'مثل: شجرة محلية' },
    { k: 'hl.text', l: 'أبرز نتيجة — الوصف', get: (p) => (p.highlight || {}).text || '' },
  ];
}
const pxVal = (f, p) => (f.get ? f.get(p) : f.multi ? (p[f.k] || []).join('، ') : p[f.k] == null ? '' : String(p[f.k]));

function exportPartnershipXlsx(p) {
  const S = xlStyles(), org = D.settings.org, F = pxFields();
  const T = {
    key: S.get({ font: { sz: 8, color: 'FFBBBBBB' }, border: 'none' }),
    title: S.get({ font: { b: 1, sz: 17, color: XL_C.petrol }, border: 'none', align: { wrap: false } }),
    sub: S.get({ font: { sz: 10, color: XL_C.mut }, border: 'none', align: { wrap: false } }),
    band: S.get({ fill: XL_C.gold, border: 'none' }),
    note: S.get({ font: { sz: 10, color: XL_C.ink }, fill: XL_C.sand, border: 'none', align: { v: 'center', indent: 1 } }),
    head: S.get({ font: { b: 1, sz: 10.5, color: XL_C.white }, fill: XL_C.petrol, align: { h: 'center' } }),
    sec: S.get({ font: { b: 1, sz: 11.5, color: XL_C.petrol }, fill: 'FFEAF2EF', border: 'bottom', bcolor: XL_C.petrol2 }),
    lab: S.get({ font: { b: 1, sz: 10.5, color: XL_C.petrol }, align: { v: 'top' } }),
    val: S.get({ font: { sz: 10.5 }, fill: 'FFFFFDF6', align: { v: 'top' } }),
    date: S.get({ font: { sz: 10.5 }, fill: 'FFFFFDF6', numFmt: 'dd/mm/yyyy', align: { h: 'right', v: 'top' } }),
    ro: S.get({ font: { sz: 10.5, color: XL_C.mut }, fill: 'FFF1F3F2', align: { v: 'top' } }),
    hint: S.get({ font: { sz: 9, color: XL_C.mut }, align: { v: 'top' } }),
  };
  const W = [3, 30, 72, 40];
  const rows = [
    { ht: 32, cells: [{ v: PX_MARK, s: T.key }, { v: `نموذج بيانات الشراكة — ${partnerName(p)}`, s: T.title }] },
    { ht: 20, cells: [{ v: p.id, s: T.key }, { v: `${p.code || ''}${p.title && p.title !== partnerName(p) ? ' · ' + p.title : ''} · ${org.name} — صُدّر في ${fmtDT(nowISO())}`, s: T.sub }] },
    { ht: 5, cells: [{ v: '', s: T.key }, { v: '', s: T.band }, { v: '', s: T.band }, { v: '', s: T.band }] },
    { ht: 46, cells: [{ v: '', s: T.key }, { v: 'عدّل عمود «القيمة» فقط (الخلايا الملوّنة)، ثم احفظ الملف وأعده إلى فريق الشراكات ليُرفع من صفحة الشراكة ← «نموذج Excel» ← «رفع نموذج محدَّث». الخلايا الرمادية للاطلاع ولا تُحدَّث. لا تغيّر ترتيب الصفوف ولا اسم الورقة.', s: T.note }] },
    { ht: 26, cells: [{ v: '', s: T.key }, { v: 'الحقل', s: T.head }, { v: 'القيمة', s: T.head }, { v: 'إرشاد التعبئة', s: T.head }] },
  ];
  const merges = ['B1:D1', 'B2:D2', 'B4:D4'], valid = [], lists = [];
  F.forEach((f) => {
    const r = rows.length + 1;
    if (f.sec) { rows.push({ ht: 24, cells: [{ v: '', s: T.key }, { v: f.sec, s: T.sec }, { v: '', s: T.sec }, { v: '', s: T.sec }] }); merges.push(`B${r}:D${r}`); return; }
    const v = pxVal(f, p);
    const cell = f.date ? { v: xlDate(v) || '', s: T.date } : { v, s: f.ro ? T.ro : T.val };
    rows.push({ ht: f.long ? xlHt([v], [W[2]], 40, 260) : xlHt([v, f.h || ''], [W[2], W[3]], 24, 80), cells: [{ v: f.k, s: T.key }, { v: f.l, s: T.lab }, cell, { v: f.h || '', s: T.hint }] });
    if (f.list && f.list.length && !f.ro) { lists.push(f.list); const c = colName(lists.length - 1); valid.push({ ref: `C${r}`, f: `'القوائم'!$${c}$1:$${c}$${f.list.length}` }); }
  });
  rows.push({ ht: 10, cells: [] }, { cells: [{ v: '', s: T.key }, { v: `${org.name} · ${org.platform}`, s: T.hint }] });
  const sheet = { name: 'بيانات الشراكة', tab: XL_C.petrol, cols: W, hiddenCols: [0], rows, merges, valid, freeze: { row: 5 }, active: true };
  const n = Math.max(1, ...lists.map((l) => l.length));
  const lsheet = { name: 'القوائم', hidden: true, cols: lists.map(() => 30), rows: Array.from({ length: n }, (_, i) => ({ cells: lists.map((l) => (l[i] != null ? { v: l[i] } : null)) })) };
  download(`نموذج-شراكة-${(p.code || '').replace(/[^\w-]/g, '')}-${partnerName(p).replace(/[\\/:*?"<>|]/g, '').slice(0, 40)}.xlsx`, xlBook(lists.length ? [sheet, lsheet] : [sheet], S));
  Repo.log('partnership.export', 'partnership', p.id, p.code, 'تنزيل نموذج Excel ببيانات الشراكة');
  toast('نُزِّل نموذج Excel ببيانات الشراكة');
}

/* قراءة قيمة الخلية حسب نوع الحقل */
function pxParse(f, raw) {
  let v = String(raw == null ? '' : raw).replace(/_x000D_/g, '').replace(/\r\n?/g, '\n').trim();
  if (f.date) {
    if (!v) return { v: '' };
    if (/^\d+(\.\d+)?$/.test(v)) { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(+v) * 864e5); return { v: d.toISOString().slice(0, 10) }; }
    let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); if (m) return { v: `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` };
    m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/); if (m) return { v: `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` };
    return { err: `«${v}» ليس تاريخًا مفهومًا` };
  }
  if (f.multi) return { v: v ? [...new Set(v.split(/[،,;\n]+/).map((x) => x.trim()).filter(Boolean))] : [] };
  if (f.set) { if (!v) return { v: '' }; const id = f.set(v); return id ? { v: id } : { err: `«${v}» ليست من القائمة` }; }
  if (f.k === 'contactEmail' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { err: `«${v}» ليس بريدًا صحيحًا` };
  if (f.k === 'contactPhone') v = v.replace(/\.0$/, '').replace(/^5(\d{8})$/, '05$1');
  return { v };
}
const pxCur = (f, p) => (f.k === 'sector' ? pSector(p) : f.k.startsWith('hl.') ? (p.highlight || {})[f.k.slice(3)] || '' : f.multi ? (p[f.k] || []) : p[f.k] == null ? '' : p[f.k]);
const pxShow = (f, v) => { if (Array.isArray(v)) return v.join('، '); if (f.set) return stageLabel(v); if (f.date) return v ? fmtDate(v) : ''; return String(v || ''); };

async function importPartnershipXlsx(p, file) {
  let rows;
  try { rows = await readXlsxFirstSheet(file); } catch (e) { return toast(e.message, 'err'); }
  if (((rows[1] || {}).A || '') !== PX_MARK) return toast('هذا الملف ليس نموذج بيانات شراكة من المنصة. نزّل النموذج من صفحة الشراكة ثم عدّله.', 'err');
  const id = (rows[2] || {}).A;
  let t = D.partnerships.find((x) => x.id === id);
  if (!t) return toast('الشراكة التي يخصها هذا الملف غير موجودة في المنصة (ربما حُذفت).', 'err');
  if (t.id !== p.id && !(await confirmDlg(`هذا الملف يخص شراكة أخرى: <b>${esc(t.code || '')} — ${esc(partnerName(t))}</b>.<br>هل تريد مراجعة تحديثه لتلك الشراكة؟`, { title: 'ملف لشراكة أخرى', ok: 'متابعة' }))) return;
  const F = pxFields().filter((f) => f.k && !f.ro), byK = Object.fromEntries(F.map((f) => [f.k, f]));
  const ch = [], errs = [];
  Object.keys(rows).map(Number).filter((r) => r > 5).forEach((r) => {
    const f = byK[(rows[r] || {}).A]; if (!f) return;
    const res = pxParse(f, rows[r].C);
    if (res.err) return errs.push(`${f.l}: ${res.err}`);
    const old = pxCur(f, t), same = Array.isArray(old) ? old.join('|') === res.v.join('|') : String(old || '').replace(/\r/g, '').trim() === String(res.v || '').trim();
    if (!same) ch.push({ f, old, v: res.v });
  });
  const sd = (ch.find((c) => c.f.k === 'startDate') || {}).v ?? t.startDate, ed = (ch.find((c) => c.f.k === 'endDate') || {}).v ?? t.endDate;
  if (sd && ed && ed < sd) errs.push('تاريخ الانتهاء يسبق تاريخ البدء — لن يُحدَّث التاريخان.');
  const bad = sd && ed && ed < sd ? new Set(['startDate', 'endDate']) : new Set();
  const list = ch.filter((c) => !bad.has(c.f.k));
  if (!list.length) return toast(errs.length ? 'لم يُحدَّث شيء: ' + errs.join(' · ') : 'لا توجد تغييرات في الملف عن بيانات الشراكة الحالية.', errs.length ? 'err' : 'ok');
  const m = Modal.open({
    title: `مراجعة التحديث من Excel — ${partnerName(t)}`, size: 'lg', cls: 'px-dlg',
    body: `<p class="small muted" style="margin-bottom:10px">${plural(list.length, 'حقل واحد تغيّر', 'حقلان تغيّرا', 'حقول تغيّرت', 'حقلًا تغيّر')} عن البيانات الحالية. ألغِ تحديد ما لا تريد اعتماده.</p>
      ${errs.length ? `<div class="note warn" style="margin-bottom:10px">${icon('alert')}<span>${errs.map(esc).join('<br>')}</span></div>` : ''}
      <div class="px-tbl"><table><thead><tr><th></th><th>الحقل</th><th>الحالي</th><th>الجديد من الملف</th></tr></thead><tbody>
      ${list.map((c, i) => `<tr><td><input type="checkbox" checked data-pxi="${i}"></td><th>${esc(c.f.l)}</th><td class="px-old">${esc(pxShow(c.f, c.old)) || '<i>فارغ</i>'}</td><td class="px-new">${esc(pxShow(c.f, c.v)) || '<i>يُفرَّغ</i>'}</td></tr>`).join('')}
      </tbody></table></div>`,
    foot: `<button class="btn primary" data-ok>${icon('check')} اعتماد التحديث</button><button class="btn ghost" data-mclose>إلغاء</button>`,
  });
  m.el.querySelector('[data-ok]').onclick = async () => {
    const pick = list.filter((_, i) => m.el.querySelector(`[data-pxi="${i}"]`).checked);
    if (!pick.length) return m.close();
    for (const c of pick) {
      const k = c.f.k;
      if (k === 'sector') { const pr = partnerById(t.partnerId); if (pr) { pr.sector = c.v; await Repo.save('partners', pr); } }
      else if (k.startsWith('hl.')) { t.highlight = { value: '', label: '', text: '', ...(t.highlight || {}) }; t.highlight[k.slice(3)] = c.v; if (!t.highlight.value) t.highlight = null; }
      else t[k] = c.v;
    }
    if (!(t.title || '').trim()) t.title = partnerName(t);
    t.updatedAt = nowISO(); t.updatedBy = Session.userName();
    await Repo.save('partnerships', t);
    await Repo.log('partnership.update', 'partnership', t.id, t.code + ' — ' + t.title, 'تحديث من نموذج Excel: ' + pick.map((c) => c.f.l).join('، '));
    m.close(); toast(`حُدِّث ${plural(pick.length, 'حقل واحد', 'حقلان', 'حقول', 'حقلًا')} من ملف Excel`);
    if (t.id === p.id) rerenderKeep(); else go('#/partnerships/' + t.id);
  };
}

function ptXlsxDialog(p) {
  const m = Modal.open({
    title: 'نموذج Excel للشراكة', cls: 'px-menu',
    body: `<p class="small muted" style="line-height:1.9;margin-bottom:14px">نزّل ملف Excel فيه كل بيانات هذه الشراكة، وأرسله لمن يحدّثها. بعد إعادته ارفعه هنا: تُعرض التغييرات للمراجعة قبل الحفظ، ويُسجَّل التحديث في سجل التغييرات.</p>
      <div class="px-acts"><button class="px-act" data-pxdl>${icon('download')}<b>تنزيل النموذج ببيانات الشراكة</b><span>ملف xlsx بقوائم منسدلة وإرشادات تعبئة</span></button>
      <label class="px-act">${icon('upload')}<b>رفع نموذج محدَّث</b><span>يُطابَق مع الشراكة تلقائيًا</span><input type="file" hidden accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-pxup></label></div>`,
  });
  m.el.querySelector('[data-pxdl]').onclick = () => { m.close(); exportPartnershipXlsx(p); };
  m.el.querySelector('[data-pxup]').onchange = (e) => { const f = e.target.files[0]; if (!f) return; m.close(); importPartnershipXlsx(p, f); };
}
