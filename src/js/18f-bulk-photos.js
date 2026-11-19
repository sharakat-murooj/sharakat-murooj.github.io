/* =====================================================================
   رفع صور كل الشراكات دفعة واحدة من مجلدات
   - مجلد لكل شراكة باسمها كما في المنصة (أو باسم الجهة، أو برمز الشراكة مثل PT-2026-001).
   - يُختار المجلد الرئيسي، أو تُسحب المجلدات إلى النافذة.
   - تُعرض المطابقة للمراجعة (ويمكن تغيير الشراكة لأي مجلد) قبل الرفع.
   - تُضاف الصور إلى «صور الشراكة»، وتُتجاوز الصور الموجودة بالاسم نفسه، وتصبح الأولى غلافًا إن لم يكن للشراكة غلاف.
   ===================================================================== */
const BP_IMG = /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i;
function bpCandidates() { return D.partnerships.filter((p) => showDemo() || !p.demo); }
/* مطابقة اسم مجلد بشراكة: الرمز، ثم اسم الشراكة، ثم اسم الجهة وأسماؤها البديلة */
function bpMatch(name) {
  const n = normAr(name), list = bpCandidates();
  if (!n) return { ids: [] };
  const code = name.match(/PT-\d{4}-\d{3}/i);
  if (code) { const p = list.find((x) => (x.code || '').toUpperCase() === code[0].toUpperCase()); if (p) return { ids: [p.id], how: 'الرمز' }; }
  let m = list.filter((p) => normAr(p.title) === n);
  if (m.length) return { ids: m.map((p) => p.id), how: 'اسم الشراكة' };
  m = list.filter((p) => { const pr = partnerById(p.partnerId); return pr && (normAr(pr.name) === n || (pr.aliases || []).some((a) => normAr(a) === n)); });
  if (m.length) return { ids: m.map((p) => p.id), how: 'اسم الجهة' };
  // بلا الأقواس: «المركز الوطني لكفاءة وترشيد المياه» تطابق «… (مائي)»
  const bare = (s) => normAr(String(s || '').replace(/\(.*?\)/g, ''));
  m = list.filter((p) => bare(p.title) === bare(name) || bare(partnerName(p)) === bare(name));
  if (m.length) return { ids: m.map((p) => p.id), how: 'اسم مقارب' };
  return { ids: [] };
}
/* تجميع الملفات حسب المجلد: يُجرَّب كل مستوى من الأعمق إلى الأعلى حتى يطابق شراكة */
function bpGroup(entries) {
  const groups = new Map();
  for (const { file, path } of entries) {
    if (!BP_IMG.test(file.name) && !/^image\//.test(file.type)) continue;
    const segs = path.split('/').slice(0, -1).filter(Boolean);
    if (!segs.length) continue;
    let key = segs[segs.length - 1], hit = null;
    for (let i = segs.length - 1; i >= 0; i--) { const r = bpMatch(segs[i]); if (r.ids.length) { key = segs[i]; hit = r; break; } }
    if (!groups.has(key)) groups.set(key, { folder: key, files: [], match: hit || bpMatch(key) });
    groups.get(key).files.push(file);
  }
  return [...groups.values()].sort((a, b) => (b.match.ids.length === 1) - (a.match.ids.length === 1) || a.folder.localeCompare(b.folder, 'ar'));
}
/* قراءة مجلدات مسحوبة إلى النافذة */
async function bpReadDrop(items) {
  const out = [];
  const walk = (entry, path) => new Promise((res) => {
    if (entry.isFile) entry.file((f) => { out.push({ file: f, path: path + f.name }); res(); }, () => res());
    else if (entry.isDirectory) {
      const rd = entry.createReader(), all = [];
      const next = () => rd.readEntries(async (ents) => { if (!ents.length) { for (const e of all) await walk(e, path + entry.name + '/'); res(); } else { all.push(...ents); next(); } }, () => res());
      next();
    } else res();
  });
  for (const it of [...items]) { const e = it.webkitGetAsEntry && it.webkitGetAsEntry(); if (e) await walk(e, ''); }
  return out;
}

function bulkPhotosDialog() {
  let groups = [];
  const m = Modal.open({
    title: 'رفع صور الشراكات من مجلدات', size: 'lg', cls: 'bp-dlg',
    body: `<div class="bp-intro">
        <p>جهّز مجلدًا رئيسيًا فيه <b>مجلد لكل شراكة</b> يحمل اسمها كما يظهر في المنصة (أو اسم الجهة، أو رمز الشراكة مثل <span dir="ltr">PT-2026-001</span>)، وضع صور كل شراكة داخل مجلدها.</p>
        <ul class="bp-tree"><li>📁 صور الشراكات</li><li class="sub">📁 بنك البلاد <small>— صور هذه الشراكة بداخله</small></li><li class="sub">📁 جامعة الجوف</li><li class="sub">📁 <span dir="ltr">PT-2026-014</span></li></ul>
      </div>
      <label class="bp-drop" data-bpdrop>${icon('upload')}<b>اختر المجلد الرئيسي</b><span>أو اسحب المجلدات إلى هنا</span><input type="file" hidden webkitdirectory directory multiple data-bpin></label>
      <div data-bpout></div>`,
    foot: `<button class="btn primary" data-bpgo disabled>${icon('upload')} رفع الصور</button><button class="btn ghost" data-mclose>إغلاق</button>`,
  });
  const out = m.el.querySelector('[data-bpout]'), go = m.el.querySelector('[data-bpgo]'), drop = m.el.querySelector('[data-bpdrop]');
  const opts = bpCandidates().slice().sort((a, b) => partnerName(a).localeCompare(partnerName(b), 'ar'));
  const optHTML = (sel) => `<option value="">— تجاهل هذا المجلد —</option>${opts.map((p) => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(partnerName(p))}${p.title && p.title !== partnerName(p) ? ' — ' + esc(p.title) : ''} · ${esc(p.code || '')}</option>`).join('')}`;
  const draw = () => {
    if (!groups.length) { out.innerHTML = '<div class="note warn" style="margin-top:12px">' + icon('alert') + '<span>لم أجد صورًا داخل مجلدات. تأكد أن الصور داخل مجلد لكل شراكة.</span></div>'; go.disabled = true; return; }
    groups.forEach((g) => { if (g.pick === undefined) g.pick = g.match.ids.length === 1 ? g.match.ids[0] : ''; });
    const ok = groups.filter((g) => g.pick), nImg = ok.reduce((t, g) => t + g.files.length, 0);
    out.innerHTML = `<div class="bp-sum"><span><b>${groups.length}</b> مجلد</span><span><b>${ok.length}</b> مطابق</span><span><b>${groups.length - ok.length}</b> بلا مطابقة</span><span><b>${nImg}</b> صورة ستُرفع</span></div>
      <div class="bp-list">${groups.map((g, i) => {
        const st = g.pick ? (g.match.ids.includes(g.pick) && g.match.ids.length === 1 ? `<span class="chip ok plain">طابق ${esc(g.match.how)}</span>` : '<span class="chip gold plain">اختيار يدوي</span>') : g.match.ids.length > 1 ? '<span class="chip warn plain">أكثر من شراكة — اختر</span>' : '<span class="chip warn plain">لا يطابق — اختر أو تجاهل</span>';
        return `<div class="bp-row ${g.pick ? '' : 'off'}"><div class="bp-f"><b>📁 ${esc(g.folder)}</b><span>${plural(g.files.length, 'صورة واحدة', 'صورتان', 'صور', 'صورة')}</span></div>
          <select class="in" data-bpsel="${i}">${g.match.ids.length > 1 && !g.pick ? `<option value="">— اختر من ${g.match.ids.length} شراكات للجهة —</option>` : ''}${optHTML(g.pick)}</select>${st}</div>`;
      }).join('')}</div>`;
    go.disabled = !nImg;
    out.querySelectorAll('[data-bpsel]').forEach((s) => { s.onchange = () => { groups[+s.dataset.bpsel].pick = s.value; draw(); }; });
  };
  const load = (entries) => { groups = bpGroup(entries); draw(); };
  m.el.querySelector('[data-bpin]').onchange = (e) => load([...e.target.files].map((f) => ({ file: f, path: f.webkitRelativePath || f.name })));
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = async (e) => { e.preventDefault(); drop.classList.remove('over'); load(await bpReadDrop(e.dataTransfer.items)); };
  go.onclick = async () => {
    const todo = groups.filter((g) => g.pick && g.files.length);
    const byP = new Map(); todo.forEach((g) => { byP.set(g.pick, [...(byP.get(g.pick) || []), ...g.files]); });
    const total = [...byP.values()].reduce((t, f) => t + f.length, 0);
    go.disabled = true; m.el.querySelectorAll('select,input').forEach((x) => { x.disabled = true; });
    out.insertAdjacentHTML('afterbegin', `<div class="bp-prog"><div><i style="width:0"></i></div><span>جارٍ الرفع… 0 / ${total}</span></div>`);
    const bar = out.querySelector('.bp-prog i'), lab = out.querySelector('.bp-prog span');
    let done = 0, added = 0, skipped = 0, failed = 0; const touched = [];
    for (const [pid, files] of byP) {
      const p = D.partnerships.find((x) => x.id === pid); if (!p) continue;
      const have = new Set((p.attachments || []).filter((a) => a.category === 'صور الشراكة').map((a) => normAr(a.name)));
      const add = [];
      for (const f of files) {
        if (have.has(normAr(f.name))) skipped++;
        else {
          try { const rec = await saveUpload(f); add.push({ id: uid('att'), fileId: rec.id, name: rec.name, type: rec.type, size: rec.size, category: 'صور الشراكة', addedAt: nowISO(), by: Session.userName() }); have.add(normAr(f.name)); }
          catch (_) { failed++; }
        }
        done++; bar.style.width = Math.round((done / total) * 100) + '%'; lab.textContent = `جارٍ الرفع… ${done} / ${total}`;
      }
      if (!add.length) continue;
      p.attachments = [...(p.attachments || []), ...add];
      if (!p.coverFileId || p.coverFileId.startsWith('lib:')) p.coverFileId = add[0].fileId;
      await Repo.save('partnerships', p);
      await Repo.log('partnership.files', 'partnership', p.id, p.code, `رفع جماعي من مجلد: ${add.length} صورة إلى «صور الشراكة»`);
      added += add.length; touched.push(p);
    }
    lab.textContent = `اكتمل: رُفعت ${added} صورة إلى ${touched.length} شراكة${skipped ? ` · تُجووزت ${skipped} موجودة مسبقًا` : ''}${failed ? ` · تعذّر ${failed}` : ''}`;
    go.textContent = 'تم'; go.disabled = false; go.onclick = () => { m.close(); route(); };
    toast(`رُفعت ${added} صورة إلى ${touched.length} شراكة`);
  };
}
