/* =====================================================================
   مقترحات الجهات الخارجية
   - ?propose=… : نموذج «اقتراح شراكة» لجهة من خارج المؤسسة، بلا حساب. يصل المقترح إلى «المقترحات الواردة».
   - ?track=…   : صفحة متابعة المقترح: الحالة والرسائل الموجهة للجهة فقط.
   - الإعدادات ← «مقترحات الجهات الخارجية»: إنشاء روابط الدعوة ومتابعتها وإيقافها.
   ===================================================================== */
const EXT_STATUS = { submitted: ['تم الاستلام', 'وصل مقترحكم وسيُدرس قريبًا.', 1], review: ['قيد الدراسة', 'تدرس إدارة الشراكات مقترحكم.', 2], info: ['مطلوب معلومات إضافية', 'تواصلت معكم إدارة الشراكات لاستكمال بعض البيانات.', 2], accepted: ['مقبول مبدئيًا', 'قُبل المقترح مبدئيًا، وستتواصل معكم إدارة الشراكات للخطوات التالية.', 3], converted: ['مقبول — بدأت إجراءات الشراكة', 'بدأت إجراءات الشراكة رسميًا.', 3], rejected: ['نعتذر عن عدم القبول', 'شكرًا لاهتمامكم؛ لم يُقبل المقترح في الوقت الحالي.', 3] };
const extEsc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
function extShell(inner) {
  const old = $('#extPage'); if (old) old.remove();
  if (window.__SBX) { /* الاستعراض: الصفحة الخارجية فوق النسخة المعزولة دون إزالتها */ }
  else { const b = $('#boot'); if (b) b.remove(); ['#app', '#shkLogin', '#shkSplash'].forEach((s) => { const e = $(s); if (e) e.remove(); }); document.documentElement.classList.remove('sp-lock'); }
  const logo = (ASSET_IMG['murooj-logo'] || {}).src;
  const d = document.createElement('div'); d.className = 'ext-page' + (window.__SBX ? ' ext-overlay' : ''); d.id = 'extPage';
  d.innerHTML = `<header class="ext-hd">${logo ? `<img src="${logo}" alt="">` : ''}<span>منظومة الشراكات</span></header><main class="ext-main">${inner}</main><footer class="ext-ft">مؤسسة مروج الأهلية — إدارة الشراكات</footer>`;
  document.body.appendChild(d); return d;
}
const extMsg = (t, s) => extShell(`<div class="ext-card ext-center"><span class="ext-ic">${icon('info')}</span><h1>${extEsc(t)}</h1><p>${extEsc(s || 'تواصل مع إدارة الشراكات في مؤسسة مروج الأهلية للحصول على رابط جديد.')}</p></div>`);
/* مرفقات الجهة الخارجية: حتى 5 ميجابايت للملف و10 ملفات */
const EXT_MAX_FILE = 5 * 1024 * 1024, EXT_MAX_FILES = 10;
const extFmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' م.ب' : Math.max(1, Math.round(n / 1024)) + ' ك.ب');
function extFilesHTML(id) {
  return `<div class="ext-files" id="${id}"><label class="ext-drop"><input type="file" multiple hidden>${icon('upload')}<span><b>إرفاق ملفات</b><small>عرض تقديمي، ملف تعريفي، خطاب… حتى 5 ميجابايت للملف</small></span></label><ul class="ext-flist"></ul></div>`;
}
/* يربط صندوق الملفات ويعيد دالة تُرجع الملفات المختارة */
function extFilesBind(box) {
  const files = [];
  const draw = () => { box.querySelector('.ext-flist').innerHTML = files.map((f, i) => `<li><span class="ext-fic">${icon('file')}</span><b title="${extEsc(f.name)}">${extEsc(f.name)}</b><small>${extFmtSize(f.size)}</small><button type="button" data-rm="${i}" aria-label="إزالة">${icon('x')}</button></li>`).join(''); };
  const add = async (list) => {
    for (let f of list) {
      if (files.length >= EXT_MAX_FILES) { alert('الحد الأقصى 10 ملفات.'); break; }
      if (/^image\//.test(f.type) && typeof compressImage === 'function') { try { f = await compressImage(f); } catch (_) { /* */ } }
      if (f.size > EXT_MAX_FILE) { alert(`حجم «${f.name}» أكبر من 5 ميجابايت.`); continue; }
      files.push(f);
    }
    draw();
  };
  const inp = box.querySelector('input[type=file]');
  inp.onchange = () => { add([...inp.files]); inp.value = ''; };
  box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('over'); });
  box.addEventListener('dragleave', () => box.classList.remove('over'));
  box.addEventListener('drop', (e) => { e.preventDefault(); box.classList.remove('over'); add([...e.dataTransfer.files]); });
  box.querySelector('.ext-flist').onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b) { files.splice(+b.dataset.rm, 1); draw(); } };
  box.__add = add;
  return () => files;
}
/* رفع الملفات إلى الخادم بمفتاح الدعوة أو المتابعة، ويعيد معرّفاتها */
async function extUpload(key, files, onStep, { rpc = 'shk_ext_file_put', prefix = 'f-ext-', max = 'الحد الأقصى 10 ملفات.', nonce = null } = {}) {
  const ids = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i]; onStep && onStep(i + 1, files.length);
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(f); });
    const id = prefix + [...crypto.getRandomValues(new Uint8Array(10))].map((x) => x.toString(16).padStart(2, '0')).join('');
    const r = await Cloud.rpc(rpc, { p_key: key, p_id: id, p_meta: { name: f.name, type: f.type || 'application/octet-stream', size: f.size }, p_data: b64, ...(nonce ? { p_nonce: nonce } : {}) });
    if (!r || r.error) throw new Error(r && r.error === 'too_many' ? max : r && r.error === 'busy' ? 'وصل الرابط إلى حده اليومي من المرفقات؛ أرسلوا المقترح دون مرفقات أو حاولوا غدًا.' : `تعذّر رفع «${f.name}».`);
    ids.push(id);
  }
  return ids;
}
/* تشغيل دالة البريد لإرسال ما في الطابور (لا تحمل عنوانًا ولا نصًا؛ ترسل ما أعدّته قاعدة البيانات فقط) */
function extMailKick() { try { if (!Cloud.on || !Cloud.url) return; fetch(`${Cloud.url}/functions/v1/shk-mail`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: Cloud.key, Authorization: `Bearer ${Cloud.key}` }, body: '{}', keepalive: true }).catch(() => {}); } catch (_) { /* */ } }
/* من المنصة: بعد تغيير حالة مقترح خارجي برسالة مرئية للجهة يصلها بريد بالتحديث */
async function extMailUpdate(x, to, message) {
  if (!x || !x.external || !Cloud.on || window.__SBX) return;
  try { const r = await Cloud.rpc('shk_mail_ext_update', { p_token: Cloud.token(), p_proposal: x.id, p_status: to, p_message: message || '' }); if (r && r.queued) { extMailKick(); toast('أُرسل تحديث الحالة إلى بريد مقدم المقترح'); } } catch (_) { /* البريد غير مُعد بعد */ }
}
/* عند الإقلاع: تعيد false إن عُرضت صفحة خارجية وتوقف الإقلاع العادي */
async function extBoot() {
  const q = new URLSearchParams(location.search), inv = q.get('propose'), trk = q.get('track');
  if (!inv && !trk) return true;
  if (!Cloud.on) { extMsg('الرابط يعمل على المنصة المشتركة فقط'); return false; }
  if (trk) { await extTrackPage(trk); return false; }
  let r; try { r = await Cloud.rpc('shk_invite_check', { p_invite: inv }); } catch (_) { extMsg('تعذّر فتح الرابط', 'تحقق من الاتصال بالإنترنت ثم أعد فتح الرابط.'); return false; }
  if (!r || r.error) { extMsg({ expired: 'انتهت صلاحية رابط الدعوة', revoked: 'أُوقف رابط الدعوة', used: 'استُخدم رابط الدعوة من قبل' }[r && r.error] || 'رابط الدعوة غير صالح'); return false; }
  extFormPage(inv, r); return false;
}
function extFormPage(inv, info, opts = {}) {
  const sectors = (info.sectors && info.sectors.length ? info.sectors : ['حكومي', 'شبه حكومي', 'خاص', 'غير ربحي', 'تعليمي']);
  const pub = info.kind === 'public', goals = !pub && Array.isArray(info.goals) ? info.goals.filter(Boolean) : [];
  const nonce = pub ? [...crypto.getRandomValues(new Uint8Array(12))].map((x) => x.toString(16).padStart(2, '0')).join('') : null;
  const initsOf = (g) => { const code = (String(g || '').match(/^([A-Z]{1,3}\d?)\s*[:：]/) || [])[1] || ''; const l = ((info.goalInits || {})[code]) || (typeof GOAL_INITS_DEF !== 'undefined' ? GOAL_INITS_DEF[code] : null) || []; return l.map((t, i) => [`${code}.I${i + 1}`, t]); };
  const F = [
    ['h', 'بيانات الجهة'],
    ['partnerName', 'اسم الجهة', 'text', true, info.label || ''], ['partnerSector', 'قطاع الجهة', 'select', false, '', sectors], ['about', 'نبذة عن الجهة', 'area', false],
    ['h', 'مقدم الطلب'],
    ['requesterName', 'الاسم', 'text', true], ['requesterTitle', 'المنصب', 'text', false], ['requesterEmail', 'البريد الإلكتروني', 'email', true, '', null, 'تصلكم عليه رسالة بالاستلام وبكل تحديث لحالة المقترح.'], ['contactPhone', 'رقم الجوال', 'tel', false],
    ...(goals.length ? [['h', 'الارتباط بالاستراتيجية'], ['strategicGoal', 'الهدف الاستراتيجي الذي يخدمه المقترح', 'goal', false], ['initiative', 'المبادرة', 'init', false, '', null, 'اختياري — تتبع الهدف المختار.']] : []),
    ['h', 'المقترح'],
    ['targets', 'مجالات التعاون المقترحة', 'area', true, '', null, 'كل مجال في سطر (مثال: حملات تشجير مشتركة).'], ['addedValue', 'القيمة المضافة والأثر المتوقع', 'area', false], ['duration', 'المدة المقترحة للشراكة', 'text', false], ['notes', 'ملاحظات إضافية', 'area', false],
  ];
  const field = ([k, l, t, req, def = '', opts, hint]) => k === 'h' ? `<h2>${l}</h2>` : `<label class="ext-f ${t === 'area' || t === 'goal' || t === 'init' ? 'full' : ''}"><span>${l}${req ? ' <i>*</i>' : ''}</span>${t === 'area' ? `<textarea data-k="${k}" rows="4">${extEsc(def)}</textarea>` : t === 'goal' ? `<select data-k="${k}"><option value="">اختر الهدف</option>${goals.map((o) => `<option>${extEsc(o)}</option>`).join('')}</select>` : t === 'init' ? `<select data-k="${k}" disabled><option value="">اختر الهدف أولًا</option></select>` : t === 'select' ? `<select data-k="${k}"><option value="">اختر</option>${opts.map((o) => `<option>${extEsc(o)}</option>`).join('')}</select>` : `<input data-k="${k}" type="${t}" value="${extEsc(def)}" ${t === 'email' || t === 'tel' ? 'dir="ltr"' : ''}>`}${hint ? `<small>${hint}</small>` : ''}<em class="err"></em></label>`;
  const orgN = extEsc((info.org && info.org.name) || 'مؤسسة مروج الأهلية');
  const d = extShell(`<div class="ext-card"><div class="ext-intro"><small>${pub ? `${orgN} · إدارة الشراكات` : `دعوة من ${orgN}`}</small><h1>${pub ? `اقترح شراكة مع ${orgN}` : 'اقتراح شراكة'}</h1><p>${pub ? 'نرحّب بالجهات الحكومية والخاصة وغير الربحية والتعليمية الراغبة في الشراكة معنا في تنمية الغطاء النباتي. عبّئوا النموذج وسيصل مباشرة إلى إدارة الشراكات' : 'يسعدنا اهتمامكم بالشراكة مع المؤسسة. عبّئوا النموذج وسيصل مباشرة إلى إدارة الشراكات'}، وتحصلون بعد الإرسال على رابط لمتابعة المقترح${info.mail ? '، وتصلكم التحديثات على بريدكم الإلكتروني' : ' والرد عليه'}.</p></div>
    <form class="ext-form" novalidate><input type="text" data-k="website" name="website" tabindex="-1" autocomplete="off" class="ext-hp" aria-hidden="true">${F.map(field).join('')}<h2>المرفقات <small>(اختياري)</small></h2>${extFilesHTML('exFiles')}<div class="ext-actions"><button type="submit" class="btn primary">${icon('send')} إرسال المقترح</button></div></form></div>`);
  const form = d.querySelector('form'), getFiles = extFilesBind(d.querySelector('#exFiles'));
  const gSel = form.querySelector('[data-k="strategicGoal"]'), iSel = form.querySelector('[data-k="initiative"]');
  if (gSel && iSel) gSel.onchange = () => { const L_ = initsOf(gSel.value); iSel.disabled = !gSel.value || !L_.length; iSel.innerHTML = `<option value="">${!gSel.value ? 'اختر الهدف أولًا' : L_.length ? 'اختر المبادرة' : 'لا توجد مبادرات لهذا الهدف'}</option>${L_.map(([c, t]) => `<option value="${extEsc(t)}">${extEsc(c)} — ${extEsc(t)}</option>`).join('')}`; };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = {}; form.querySelectorAll('[data-k]').forEach((x) => { data[x.dataset.k] = x.value.trim(); });
    let bad = false;
    form.querySelectorAll('.ext-f').forEach((f) => { f.classList.remove('bad'); f.querySelector('.err').textContent = ''; });
    F.filter((x) => x[0] !== 'h' && x[3]).forEach(([k, l]) => { if (!data[k]) { const f = form.querySelector(`[data-k="${k}"]`).closest('.ext-f'); f.classList.add('bad'); f.querySelector('.err').textContent = `يلزم ${l}.`; bad = true; } });
    if (data.requesterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.requesterEmail)) { const f = form.querySelector('[data-k="requesterEmail"]').closest('.ext-f'); f.classList.add('bad'); f.querySelector('.err').textContent = 'صيغة البريد غير صحيحة.'; bad = true; }
    if (bad) { const f = form.querySelector('.ext-f.bad'); f && f.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    data.contactName = data.requesterName; data.contactEmail = data.requesterEmail;
    const btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'جارٍ الإرسال…';
    let r; try {
      const fl = getFiles();
      if (opts.submit) r = await opts.submit(data, fl);
      else { if (nonce) data._nonce = nonce; data.files = await extUpload(inv, fl, (n, t) => { btn.textContent = `جارٍ رفع الملفات ${n} / ${t}…`; }, { nonce }); btn.textContent = 'جارٍ الإرسال…'; r = await Cloud.rpc('shk_ext_submit', { p_invite: inv, p_data: data }); if (r && r.mailed) extMailKick(); }
    } catch (e) { r = { error: 'net', msg: e && e.message }; }
    if (!r || r.error) { btn.disabled = false; btn.innerHTML = `${icon('send')} إرسال المقترح`; alert(r && r.error === 'missing' ? 'استكملوا الحقول المطلوبة.' : r && r.error === 'invalid' ? 'انتهت صلاحية رابط الدعوة.' : r && r.error === 'busy' ? 'استقبل الرابط عددًا كبيرًا من المقترحات اليوم؛ حاولوا مرة أخرى غدًا.' : (r && r.msg) || 'تعذّر الإرسال، حاولوا مرة أخرى.'); return; }
    const link = `${location.origin}${location.pathname}?track=${r.track}`;
    if (!opts.submit) history.replaceState(null, '', location.pathname + '?track=' + r.track);
    d.querySelector('.ext-main').innerHTML = `<div class="ext-card ext-center"><span class="ext-ic ok">${icon('check')}</span><h1>وصل مقترحكم</h1><p>رقم المقترح <b dir="ltr">${extEsc(r.ref)}</b>.${r.mailed ? ` أرسلنا رسالة تأكيد إلى <b dir="ltr">${extEsc(data.requesterEmail)}</b>، وستصلكم عليه تحديثات الحالة.` : ''} احتفظوا برابط المتابعة لمعرفة الحالة ورد إدارة الشراكات:</p>
      <div class="ext-link"><input readonly value="${extEsc(link)}"><button type="button" class="btn" data-copy>${icon('copy')} نسخ</button></div><a class="btn primary" href="${extEsc(link)}">متابعة المقترح</a></div>`;
    d.querySelector('[data-copy]').onclick = async (ev) => { const i = d.querySelector('.ext-link input'); i.select(); try { await navigator.clipboard.writeText(i.value); } catch (_) { document.execCommand('copy'); } ev.target.closest('button').textContent = 'نُسخ'; };
  };
}
async function extTrackPage(trk, opts = {}) {
  let r; try { r = opts.status ? opts.status() : await Cloud.rpc('shk_ext_status', { p_track: trk }); } catch (_) { extMsg('تعذّر فتح صفحة المتابعة', 'تحقق من الاتصال بالإنترنت ثم أعد المحاولة.'); return; }
  if (!r || r.error) { extMsg('رابط المتابعة غير صالح'); return; }
  const S = EXT_STATUS[r.status] || EXT_STATUS.submitted, step = S[2];
  const steps = [['تم الاستلام', 1], ['قيد الدراسة', 2], ['القرار', 3]];
  const msgs = (r.events || []).filter((e) => e.message).slice().reverse();
  const fmt = (t) => { try { return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(t)); } catch (_) { return String(t || '').slice(0, 10); } };
  const last = (r.events || [])[(r.events || []).length - 1], replied = r.status === 'submitted' && last && last.type === 'resubmitted';
  const ask = r.canReply ? [...(r.events || [])].reverse().find((e) => e.type === 'status' && e.to === 'info') : null;
  const d = extShell(`<div class="ext-card"><div class="ext-intro"><small>متابعة مقترح شراكة · ${extEsc(r.org || 'مؤسسة مروج الأهلية')}</small><h1>${extEsc(r.partnerName || '')}</h1><p>رقم المقترح <b dir="ltr">${extEsc(r.ref || '')}</b> · قُدّم في ${fmt(r.submittedAt)}</p></div>
    <ol class="ext-steps">${steps.map(([l, n]) => `<li class="${n < step ? 'd' : n === step ? 'c' : ''} ${n === 3 && step === 3 ? (r.status === 'rejected' ? 'no' : 'yes') : ''}"><i>${n < step || (n === 3 && step === 3) ? '✓' : n}</i><span>${n === 3 && step === 3 ? S[0] : l}</span></li>`).join('')}</ol>
    <div class="ext-status st-${extEsc(r.status)}"><b>${replied ? 'وصل ردّكم' : S[0]}</b><p>${replied ? 'أُرسل ردّكم إلى إدارة الشراكات وسيُستكمل دراسة المقترح.' : S[1]}</p></div>
    ${r.canReply ? `<section class="ext-reply" id="exReply"><h2>${icon('msg')} ردّكم على طلب الاستكمال</h2>${ask && ask.message ? `<blockquote>${extEsc(ask.message).replace(/\n/g, '<br>')}</blockquote>` : ''}
      <label class="ext-f full"><span>الرد</span><textarea rows="4" id="exReplyT" placeholder="اكتبوا ردّكم أو المعلومات المطلوبة…"></textarea><em class="err"></em></label>${extFilesHTML('exReplyF')}
      <div class="ext-actions"><button type="button" class="btn primary" id="exReplyGo">${icon('send')} إرسال الرد</button></div></section>` : ''}
    <h2>المراسلات</h2>${msgs.length ? `<ul class="ext-msgs">${msgs.map((e) => `<li class="${e.type === 'resubmitted' ? 'mine' : ''}"><small>${e.type === 'resubmitted' ? 'ردّكم · ' : ''}${fmt(e.at)}${e.to && EXT_STATUS[e.to] ? ' · ' + EXT_STATUS[e.to][0] : ''}</small><p>${extEsc(e.message).replace(/\n/g, '<br>')}</p></li>`).join('')}</ul>` : '<p class="ext-faint">لا توجد رسائل بعد. ستظهر هنا ردود إدارة الشراكات.</p>'}
    ${(r.files || []).length ? `<h2>الملفات المرسلة</h2><ul class="ext-flist ro">${r.files.map((f) => `<li><span class="ext-fic">${icon('file')}</span><b>${extEsc(f.name)}</b><small>${extFmtSize(+f.size || 0)}</small></li>`).join('')}</ul>` : ''}
    <div class="ext-actions"><button type="button" class="btn" ${opts.status ? 'disabled' : 'onclick="location.reload()"'}>${icon('history')} تحديث</button></div></div>`);
  if (!r.canReply) return;
  const getFiles = extFilesBind(d.querySelector('#exReplyF')), go = d.querySelector('#exReplyGo'), ta = d.querySelector('#exReplyT');
  go.onclick = async () => {
    const msg = ta.value.trim(), fl = getFiles(), f = ta.closest('.ext-f');
    f.classList.remove('bad'); f.querySelector('.err').textContent = '';
    if (!msg && !fl.length) { f.classList.add('bad'); f.querySelector('.err').textContent = 'اكتبوا ردًّا أو أرفقوا ملفًا.'; return; }
    go.disabled = true; go.textContent = 'جارٍ الإرسال…';
    let res; try {
      if (opts.reply) res = await opts.reply(msg, fl);
      else { const ids = await extUpload(trk, fl, (n, t) => { go.textContent = `جارٍ رفع الملفات ${n} / ${t}…`; }); res = await Cloud.rpc('shk_ext_reply', { p_track: trk, p_message: msg, p_files: ids }); }
    } catch (e) { res = { error: 'net', msg: e && e.message }; }
    if (!res || res.error) { go.disabled = false; go.innerHTML = `${icon('send')} إرسال الرد`; alert(res && res.error === 'closed' ? 'لم يعد المقترح بانتظار ردّكم.' : (res && res.msg) || 'تعذّر الإرسال، حاولوا مرة أخرى.'); return; }
    extTrackPage(trk, opts);
  };
}

/* ===== الإعدادات ← مقترحات الجهات الخارجية ===== */
const EXT_DUR = {
  private: [['1', 'يوم'], ['7', 'أسبوع'], ['30', 'شهر'], ['90', '3 أشهر'], ['date', 'حتى تاريخ']],
  public: [['90', '3 أشهر'], ['180', '6 أشهر'], ['365', 'سنة'], ['730', 'سنتان'], ['open', 'مفتوح حتى أوقفه'], ['date', 'حتى تاريخ']],
};
function extExpiry(st) {
  if (st.days === 'open') return new Date(Date.now() + 3650 * 864e5);
  if (st.days === 'date') { if (!st.date) return null; const d = new Date(st.date + 'T23:59:59'); return d > new Date() ? d : null; }
  return new Date(Date.now() + (+st.days) * 864e5);
}
function setExtTab(b) {
  if (!Cloud.on && !window.__SBX) { b.innerHTML = `<div class="panel"><div class="panel-b">${emptyHTML({ ic: 'send', title: 'روابط الجهات الخارجية تعمل على المنصة المشتركة', text: 'افتح المنصة من رابطها على الإنترنت وسجّل الدخول بحساب إدارة الشراكات.' })}</div></div>`; return; }
  const st = { kind: 'private', label: '', days: '30', date: '', uses: '1', made: null, madeKind: '', list: null, err: '', mail: null, mailErr: '', mailEdit: null, mailMsg: '' };
  const pub = () => st.kind === 'public';
  const maxDate = () => isoDate(new Date(Date.now() + (pub() ? 3650 : 180) * 864e5));
  const mailHTML = () => {
    if (window.__SBX) return '';
    const m = st.mailEdit || st.mail;
    if (!m) return `<div class="panel"><div class="panel-h"><h3>${icon('mail')} البريد الإلكتروني للمراسلات</h3></div><div class="panel-b">${st.mailErr ? `<div class="note warn">${icon('alert')}<span>${esc(st.mailErr)}</span></div>` : '<p class="muted small">جارٍ التحميل…</p>'}</div></div>`;
    const pv = m.provider || 'gmail';
    const sec = pv === 'resend' ? 'مفتاح Resend API' : pv === 'gmail' ? 'كلمة مرور التطبيق (App Password)' : 'كلمة المرور';
    return `<div class="panel ml-panel"><div class="panel-h"><h3>${icon('mail')} البريد الإلكتروني للمراسلات</h3><span class="sub">تصل منه لمقدم المقترح رسالة بالاستلام وبكل تحديث لحالة مقترحه — للرابط العام والخاص</span></div><div class="panel-b">
      <label class="row ml-on"><span class="switch"><input type="checkbox" data-ml="enabled" ${m.enabled ? 'checked' : ''}><i></i></span><b>${m.enabled ? 'المراسلة بالبريد مفعّلة' : 'المراسلة بالبريد متوقفة'}</b></label>
      <div class="ex-grid ml-grid">
        <div class="field"><label>طريقة الإرسال</label><select class="in" data-ml="provider">${[['gmail', 'Gmail / Google Workspace'], ['smtp', 'خادم بريد آخر (SMTP)'], ['resend', 'خدمة Resend']].map(([k, l]) => `<option value="${k}" ${pv === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label>البريد المرسِل</label><input class="in" dir="ltr" type="email" data-ml="fromEmail" value="${esc(m.fromEmail || '')}" placeholder="partnerships@example.org"></div>
        <div class="field"><label>اسم المرسِل</label><input class="in" data-ml="fromName" value="${esc(m.fromName || '')}" placeholder="${esc(D.settings.org.name)} — إدارة الشراكات"></div>
        ${pv === 'smtp' ? `<div class="field"><label>خادم SMTP</label><input class="in" dir="ltr" data-ml="smtpHost" value="${esc(m.smtpHost || '')}" placeholder="mail.example.org"></div>
        <div class="field"><label>المنفذ</label><input class="in" dir="ltr" type="number" data-ml="smtpPort" value="${esc(m.smtpPort || 465)}"><span class="hint">يُنصح بـ 465 (SSL)؛ المنفذ 587 غير مدعوم على الخادم.</span></div>
        <div class="field"><label>اسم المستخدم</label><input class="in" dir="ltr" data-ml="smtpUser" value="${esc(m.smtpUser || '')}" placeholder="عادةً البريد نفسه"></div>` : ''}
        <div class="field"><label>${sec}</label><input class="in" dir="ltr" type="password" autocomplete="new-password" data-ml="secret" value="${esc(m.secret || '')}" placeholder="${m.hasSecret ? '•••••••• محفوظة — اكتب جديدة لتغييرها' : 'لم تُحفظ بعد'}">
          <span class="hint">${pv === 'gmail' ? 'من حساب Google ← الأمان ← التحقق بخطوتين ← كلمات مرور التطبيقات. ' : pv === 'resend' ? 'من resend.com ← API Keys، بعد توثيق نطاق البريد. ' : ''}تُحفظ على الخادم في جدول مغلق ولا تظهر مرة أخرى لأي أحد.</span></div>
        <div class="field"><label>رابط المنصة في الرسائل</label><input class="in" dir="ltr" data-ml="siteUrl" value="${esc(m.siteUrl || (location.origin + location.pathname))}"><span class="hint">يُبنى منه رابط متابعة المقترح داخل الرسالة.</span></div>
      </div>
      ${st.mailMsg ? `<div class="note ${/تعذّر|خطأ/.test(st.mailMsg) ? 'warn' : ''}">${icon('info')}<span>${esc(st.mailMsg)}</span></div>` : ''}
      <div class="ml-acts"><button type="button" class="btn primary" data-mlsave>${icon('check')} حفظ إعداد البريد</button>
        <span class="ml-test"><input class="in" dir="ltr" type="email" id="mlTo" placeholder="بريدك لاستلام رسالة تجريبية"><button type="button" class="btn" data-mltest ${st.mail && st.mail.enabled && st.mail.hasSecret ? '' : 'disabled'}>${icon('send')} رسالة تجريبية</button></span></div>
      ${st.mail ? `<div class="ml-stats"><span>أُرسلت خلال 7 أيام: <b>${st.mail.sent7}</b></span><span>بالانتظار: <b>${st.mail.pending}</b></span>${st.mail.failed ? `<span class="bad">تعذّر إرسالها: <b>${st.mail.failed}</b></span>` : ''}${st.mail.updatedAt ? `<span>آخر تعديل: ${esc(fmtDT(st.mail.updatedAt))}</span>` : ''}</div>
      ${(st.mail.recent || []).length ? `<details class="ml-log"><summary>آخر الرسائل</summary><ul>${st.mail.recent.map((x) => `<li class="${x.sent ? 'ok' : x.err ? 'bad' : ''}"><span dir="ltr">${esc(x.to)}</span><small>${esc({ received: 'تأكيد استلام', update: 'تحديث حالة', test: 'تجريبية' }[x.kind] || x.kind)} · ${esc(fmtDT(x.at))}</small><em>${x.sent ? 'أُرسلت' : x.err ? esc(x.err) : 'بالانتظار'}</em></li>`).join('')}</ul></details>` : ''}` : ''}
      <p class="xs muted" style="margin-top:10px">يلزم مرة واحدة: تشغيل ملف <span dir="ltr">supabase/external_links_v2.sql</span> ونشر دالة <span dir="ltr">shk-mail</span> على Supabase.</p>
    </div></div>`;
  };
  const draw = () => {
    const ex = extExpiry(st);
    b.innerHTML = `<div class="panel sh-new"><div class="panel-h"><h3>${icon('send')} رابط مقترحات لجهات خارجية</h3><span class="sub">تقترح الجهة شراكة دون حساب، وتتابع الرد من رابط خاص بها</span></div><div class="panel-b">
      <div class="ex-grid">
        <div class="field"><label for="exKind">نوع الرابط</label><select class="in" id="exKind">
          <option value="private" ${!pub() ? 'selected' : ''}>رابط خاص — لجهة محددة</option>
          <option value="public" ${pub() ? 'selected' : ''}>رابط عام — للنشر (تويتر، الموقع، النشرات…)</option></select>
          <span class="hint">${pub() ? 'يفتحه أي أحد ويرسل مقترحًا، بلا حد لعدد المقترحات. لا يعرض النموذج الأهداف الاستراتيجية ولا المبادرات.' : 'يُرسل لجهة بعينها، ويعرض النموذج الهدف الاستراتيجي والمبادرة لتختار منها الجهة.'}</span></div>
        <div class="field"><label for="exLabel">${pub() ? 'اسم داخلي للرابط (لا يظهر للزائر)' : 'اسم الجهة المدعوة'}</label><input class="in" id="exLabel" maxlength="120" placeholder="${pub() ? 'مثال: حملة تويتر — موسم التشجير' : 'مثال: شركة …'}" value="${esc(st.label)}"><span class="hint">${pub() ? 'يساعدك على تمييز مصدر المقترحات في «المقترحات الواردة».' : 'يظهر مسبقًا في خانة «اسم الجهة» ويمكنها تعديله.'}</span></div>
        <div class="field"><label>صلاحية الرابط</label><div class="sh-chips">${EXT_DUR[st.kind].map(([k, l]) => `<button type="button" class="ff-chip ${st.days === k ? 'on' : ''}" data-exd="${k}">${l}</button>`).join('')}${st.days === 'date' ? `<input class="in" type="date" id="exDate" min="${isoDate(new Date(Date.now() + 864e5))}" max="${maxDate()}" value="${esc(st.date)}">` : ''}</div>
          <span class="hint">${ex ? (st.days === 'open' ? 'يبقى الرابط مفتوحًا حتى توقفه من القائمة أدناه' : `ينتهي الرابط ${esc(fmtDT(ex.toISOString()))} — ويمكن إيقافه في أي وقت من القائمة أدناه`) : 'اختر تاريخ الانتهاء من التقويم'}</span></div>
        ${pub() ? '<div class="field"><label>عدد المقترحات</label><div class="in ex-ro">غير محدود</div><span class="hint">مع حد يومي آلي لمنع الرسائل المزعجة.</span></div>' : `<div class="field"><label>عدد المقترحات المسموح بها من الرابط</label><div class="sh-chips">${[['1', 'مقترح واحد'], ['5', 'حتى 5'], ['50', 'مفتوح']].map(([k, l]) => `<button type="button" class="ff-chip ${st.uses === k ? 'on' : ''}" data-exu="${k}">${l}</button>`).join('')}</div></div>`}
      </div>
      ${st.err ? `<div class="note warn">${icon('alert')}<span>${esc(st.err)}</span></div>` : ''}
      <div class="ex-make"><button type="button" class="btn primary" data-exmake ${ex ? '' : 'disabled'}>${icon('plus')} ${pub() ? 'إنشاء الرابط العام' : 'إنشاء رابط الدعوة'}</button></div>
      ${st.made ? `<div class="sh-made"><b>${icon('check')} الرابط جاهز — ${st.madeKind === 'public' ? 'انشره حيث تشاء' : 'انسخه وأرسله للجهة'}</b><div class="sh-url"><input class="in" readonly value="${esc(st.made)}" id="exUrl"><button type="button" class="btn" data-excopy>${icon('copy')} نسخ</button></div><small>تصل المقترحات إلى «المقترحات الواردة» بوسم «جهة خارجية»، والرسالة التي تكتبها عند تغيير حالة المقترح تظهر لمقدمه في صفحة المتابعة وتصله على بريده إن كان البريد مفعّلًا.</small></div>` : ''}
    </div></div>
    <div class="panel"><div class="panel-h"><h3>الروابط</h3><span class="sub">${st.list ? st.list.length : '…'}</span></div><div class="panel-b">${!st.list ? '<p class="muted small">جارٍ التحميل…</p>' : !st.list.length ? '<p class="muted small">لم يُنشأ أي رابط بعد.</p>' : `<div class="tbl-wrap"><table class="tbl sh-tbl"><thead><tr><th>الرابط</th><th>النوع</th><th>الاستخدام</th><th>ينتهي</th><th>الحالة</th><th></th></tr></thead><tbody>${st.list.map((x) => { const live = !x.revoked && new Date(x.expires) > new Date() && x.uses < x.max, isPub = x.kind === 'public'; return `<tr class="${live ? '' : 'off'}"><td><b>${esc(x.label || (isPub ? 'رابط عام' : 'جهة خارجية'))}</b><small class="muted xs" style="display:block">${esc(fmtDT(x.at))}</small></td><td>${isPub ? '<span class="chip gold plain">عام</span>' : '<span class="chip plain">خاص</span>'}</td><td class="small">${isPub ? `${x.uses} مقترح` : `${x.uses} من ${x.max >= 50 ? '∞' : x.max}`}</td><td class="small">${new Date(x.expires) - Date.now() > 3000 * 864e5 ? 'مفتوح' : esc(fmtDT(x.expires))}</td><td>${x.revoked ? '<span class="chip">موقوف</span>' : live ? '<span class="chip ok">سارٍ</span>' : '<span class="chip">منتهٍ</span>'}</td><td>${live ? `<button type="button" class="btn sm ghost" data-exrevoke="${esc(x.id)}">${icon('x')} إيقاف</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`}</div></div>
    ${mailHTML()}`;
  };
  const demo = !!window.__SBX; window.__extDemoList = window.__extDemoList || [];
  const load = async () => { if (demo) { st.list = window.__extDemoList.slice(); draw(); return; } try { st.list = await Cloud.rpc('shk_invite_list', { p_token: Cloud.token() }); } catch (e) { st.list = []; st.err = e.code === 'forbidden' ? 'متاح لإدارة الشراكات ومدير النظام.' : 'لم تُفعَّل روابط الجهات الخارجية على الخادم بعد — يلزم تشغيل ملف supabase/external_proposals.sql مرة واحدة.'; } draw(); };
  const loadMail = async () => { if (demo) return; try { st.mail = await Cloud.rpc('shk_mail_get', { p_token: Cloud.token() }); st.mailErr = ''; } catch (e) { st.mail = null; st.mailErr = e.code === 'forbidden' ? 'إعداد البريد متاح لإدارة الشراكات ومدير النظام.' : 'لم يُفعَّل البريد على الخادم بعد — شغّل ملف supabase/external_links_v2.sql مرة واحدة في Supabase ← SQL Editor، ثم انشر دالة shk-mail.'; } draw(); };
  const mailVals = () => { const o = { ...(st.mailEdit || st.mail || {}) }; b.querySelectorAll('[data-ml]').forEach((i) => { o[i.dataset.ml] = i.type === 'checkbox' ? i.checked : i.value; }); return o; };
  draw(); load(); loadMail();
  b.oninput = (e) => { if (e.target.id === 'exLabel') st.label = e.target.value; if (e.target.id === 'exDate') { st.date = e.target.value; draw(); } if (e.target.dataset && e.target.dataset.ml) st.mailEdit = mailVals(); };
  b.onchange = (e) => {
    if (e.target.id === 'exKind') { st.kind = e.target.value; st.days = pub() ? 'open' : '30'; st.date = ''; draw(); return; }
    if (e.target.dataset.ml === 'provider' || e.target.dataset.ml === 'enabled') { st.mailEdit = mailVals(); draw(); }
  };
  b.onclick = async (e) => {
    const d = e.target.closest('[data-exd]'); if (d) { st.days = d.dataset.exd; draw(); return; }
    const u = e.target.closest('[data-exu]'); if (u) { st.uses = u.dataset.exu; draw(); return; }
    if (e.target.closest('[data-excopy]')) { const i = $('#exUrl', b); i.select(); try { await navigator.clipboard.writeText(i.value); } catch (_) { document.execCommand('copy'); } toast('نُسخ الرابط'); return; }
    if (e.target.closest('[data-exmake]')) {
      const ex = extExpiry(st); if (!ex) return;
      if (demo) { st.made = `${location.origin.replace(/^null|^about:?/, 'https://sharakat-murooj.github.io')}/?propose=a1b2c3d4e5f6…`; st.madeKind = st.kind; window.__extDemoList.unshift({ id: 'demo', kind: st.kind, label: st.label || '', at: nowISO(), expires: ex.toISOString(), max: pub() ? 1000000 : +st.uses, uses: 0, revoked: false }); await load(); return; }
      try {
        const r = await Cloud.rpc('shk_invite_create', { p_token: Cloud.token(), p_label: st.label.trim(), p_expires_at: ex.toISOString(), p_uses: pub() ? 1000000 : +st.uses, ...(pub() ? { p_kind: 'public' } : {}) });
        st.made = `${location.origin}${location.pathname}?propose=${r.token}`; st.madeKind = st.kind; st.err = '';
        await Repo.log('invite.create', 'invite', r.id, st.label.trim() || (pub() ? 'رابط عام' : 'جهة خارجية'), `${pub() ? 'رابط عام — ' : ''}${st.days === 'open' ? 'مفتوح حتى الإيقاف' : 'حتى ' + fmtDT(ex.toISOString())}`);
      } catch (err) { st.err = err.code === 'forbidden' ? 'متاح لإدارة الشراكات ومدير النظام.' : pub() ? 'تعذّر إنشاء الرابط العام — يلزم تشغيل ملف supabase/external_links_v2.sql مرة واحدة في Supabase.' : 'تعذّر إنشاء الرابط.'; }
      await load(); return;
    }
    const rv = e.target.closest('[data-exrevoke]');
    if (rv && await confirmDlg('إيقاف الرابط؟ لن يستطيع أحد إرسال مقترحات جديدة به (روابط المتابعة تبقى تعمل).', { ok: 'إيقاف', danger: true })) {
      try { await Cloud.rpc('shk_invite_revoke', { p_token: Cloud.token(), p_id: rv.dataset.exrevoke }); toast('أُوقف الرابط'); } catch (_) { toast('تعذّر الإيقاف', 'err'); }
      await load(); return;
    }
    if (e.target.closest('[data-mlsave]')) {
      const v = mailVals();
      if (v.enabled && !v.fromEmail) { st.mailEdit = v; st.mailMsg = 'تعذّر الحفظ: أدخل البريد المرسِل.'; draw(); return; }
      if (v.enabled && !v.secret && !(st.mail && st.mail.hasSecret)) { st.mailEdit = v; st.mailMsg = 'تعذّر الحفظ: أدخل كلمة المرور أو المفتاح.'; draw(); return; }
      try {
        await Cloud.rpc('shk_mail_set', { p_token: Cloud.token(), p_cfg: { enabled: !!v.enabled, provider: v.provider, fromEmail: v.fromEmail, fromName: v.fromName, smtpHost: v.smtpHost || '', smtpPort: v.smtpPort || 465, smtpUser: v.smtpUser || '', secret: v.secret || '', siteUrl: v.siteUrl } });
        await Repo.log('settings.update', 'settings', 'mail', 'البريد الإلكتروني للمراسلات', `${v.enabled ? 'مفعّل' : 'متوقف'} — ${v.fromEmail}`);
        st.mailEdit = null; st.mailMsg = 'حُفظ إعداد البريد.'; toast('حُفظ إعداد البريد');
      } catch (err) { st.mailEdit = v; st.mailMsg = err.code === 'forbidden' ? 'تعذّر الحفظ: متاح لإدارة الشراكات.' : /bad_email/.test(err.message || '') ? 'تعذّر الحفظ: البريد المرسِل غير صحيح.' : 'تعذّر الحفظ — تأكد من تشغيل ملف external_links_v2.sql.'; }
      await loadMail(); return;
    }
    if (e.target.closest('[data-mltest]')) {
      const to = ($('#mlTo', b) || {}).value || '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to.trim())) { toast('اكتب بريدًا صحيحًا لاستلام الرسالة التجريبية', 'err'); return; }
      try {
        const r = await Cloud.rpc('shk_mail_test', { p_token: Cloud.token(), p_to: to.trim() });
        if (r && r.error) { st.mailMsg = 'فعّل البريد واحفظه أولًا.'; draw(); return; }
        st.mailMsg = 'جارٍ إرسال الرسالة التجريبية…'; draw();
        let res = null; try { res = await (await fetch(`${Cloud.url}/functions/v1/shk-mail`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: Cloud.key, Authorization: `Bearer ${Cloud.key}` }, body: '{}' })).json(); } catch (_) { res = null; }
        st.mailMsg = !res ? 'تعذّر الوصول إلى دالة shk-mail — تأكد من نشرها على Supabase وإيقاف «Verify JWT».' : res.sent ? `أُرسلت الرسالة التجريبية إلى ${to.trim()} — تحقّق من صندوق الوارد (والرسائل غير المرغوبة).` : 'تعذّر الإرسال — راجع «آخر الرسائل» لمعرفة السبب.';
      } catch (_) { st.mailMsg = 'تعذّر الإرسال.'; }
      await loadMail();
    }
  };
}

/* الاستعراض: إرسال المقترح ومتابعته داخل النسخة المعزولة (بلا خادم) */
async function extDemoSubmit(data) {
  const t = nowISO(), n = D.proposals.filter((x) => x.external).length + 1;
  const rec = { ...data, id: uid('pr-ext'), ref: `EXT-${today().getFullYear()}-${String(n).padStart(4, '0')}`, status: 'submitted', external: true, extLabel: data.partnerName, department: 'جهة خارجية', createdAt: t, submittedAt: t, updatedAt: t, createdByRole: 'external', demo: false, partnershipId: null, attachments: [],
    events: [{ id: uid('ev'), at: t, by: data.requesterName, role: 'external', type: 'submitted', message: 'قُدّم المقترح عبر رابط الدعوة الخارجي' }] };
  await Repo.save('proposals', rec);
  await notify([{ grp: 'partnerships' }], { t: `مقترح شراكة من جهة خارجية ${rec.ref}`, b: `جهة خارجية — ${rec.partnerName}`, href: '#/proposals/' + rec.id, ic: 'send' });
  return { ref: rec.ref, track: 'demo' };
}
function extDemoStatus() {
  const x = D.proposals.filter((p) => p.external).pop(); if (!x) return { error: 'invalid' };
  return { ref: x.ref, partnerName: x.partnerName, status: x.status, submittedAt: x.submittedAt, org: D.settings.org.name, canReply: x.status === 'info', files: (x.attachments || []).filter((a) => a.category === 'مرفقات الجهة الخارجية').map((a) => ({ name: a.name, size: a.size })), events: (x.events || []).filter((e) => ['status', 'submitted', 'resubmitted'].includes(e.type) && (e.vis || 'all') === 'all').map((e) => ({ at: e.at, type: e.type, to: e.to, message: e.message })) };
}
/* الاستعراض: رد الجهة على طلب الاستكمال داخل النسخة المعزولة */
async function extDemoReply(msg) {
  const x = D.proposals.filter((p) => p.external).pop(); if (!x || x.status !== 'info') return { error: 'closed' };
  x.status = 'submitted'; x.updatedAt = nowISO();
  x.events = [...(x.events || []), { id: uid('ev'), at: nowISO(), by: x.requesterName, role: 'external', type: 'resubmitted', vis: 'all', message: msg }];
  await Repo.save('proposals', x);
  await notify([{ grp: 'partnerships' }], { t: `ردّت الجهة الخارجية على طلب الاستكمال: ${x.ref}`, b: `جهة خارجية — ${x.partnerName}`, href: '#/proposals/' + x.id, ic: 'msg' });
  return { ok: true };
}
