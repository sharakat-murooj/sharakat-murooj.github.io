/* =====================================================================
   تصدير النماذج إلى Word بتصميم المنظومة: شريط أخضر للعنوان، أرقام أقسام
   ذهبية، خلايا عناوين بيج، رؤوس جداول خضراء، وخيارات ☐/☑ — كله بجداول
   يقرؤها Word كما هي (بلا flex أو grid أو تدرّجات).
   ===================================================================== */
const WD = { pri: '#0F4433', pri2: '#1A5C46', gold: '#A47C32', goldL: '#D9C08A', beige: '#F4EFE4', line: '#D9D1BF', ink: '#14201B', mut: '#5C6861', font: "'IBM Plex Sans Arabic','Expo Arabic','Segoe UI','Sakkal Majalla',Arial,sans-serif" };
function wordDocHTML(kind, rec, key, evalIdx = null) {
  const F = FORMS[key], R = fRecInfo(kind, rec);
  const st = F.periodic ? (evalIdx !== null ? (rec.evals || [])[evalIdx] : null) : formOf(rec, key);
  const d = (st && st.data) || {}, blank = typeof FORM_BLANK !== 'undefined' && FORM_BLANK;
  const logo = (ASSET_IMG['murooj-logo'] || {}).src;
  const step = F.step && typeof wfStep === 'function' ? wfStep(F.step) : null;
  const E = (v) => esc(v == null ? '' : String(v)).replace(/\n/g, '<br>');
  const empty = '<span style="color:#B8B0A0">&nbsp;</span>';
  const box = (on) => `<span style="font-family:'Segoe UI Symbol',Arial;font-size:13pt;color:${on ? WD.pri : '#9AA9A3'}">${on ? '☑' : '☐'}</span>`;
  const cell = (f) => {
    const v = d[f.k];
    if (f.type === 'chips' || f.type === 'multi') { const vals = f.type === 'multi' ? (v || []) : [v]; return (f.opts || []).map((o) => `${box(vals.includes(o))}&nbsp;${esc(o)}`).join('&nbsp;&nbsp;&nbsp; '); }
    if (f.type === 'select') return v ? esc(v) : empty;
    if (f.type === 'number') return v ? sar(v) : empty;
    if (f.type === 'date') return v ? fmtDate(v) + 'م' : empty;
    if (f.type === 'sign') return st && st.status === 'done' ? `معتمد إلكترونيًا — ${esc(st.by)} — ${fmtDT(st.at)}` : empty;
    return v ? E(v) : empty;
  };
  const th = (t, w = '', al = 'right') => `<td ${w ? `width="${w}"` : ''} style="background:${WD.pri};color:#fff;font-weight:bold;padding:6pt 8pt;border:1px solid ${WD.pri};text-align:${al};${w ? `width:${w};` : ''}">${t}</td>`;
  const td = (t, extra = '', w = '') => `<td ${w ? `width="${w}"` : ''} style="border:1px solid ${WD.line};padding:6pt 8pt;vertical-align:top;${extra}">${t}</td>`;
  const tbl = (rows, extra = '') => `<table dir="rtl" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin:4pt 0 10pt;${extra}">${rows}</table>`;
  const secs = F.sections(R, rec);
  let n = 0;
  const secHead = (t, note) => { n++; return `<table dir="rtl" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin:16pt 0 6pt"><tr><td style="width:30pt;padding:0 0 4pt;border-bottom:2px solid ${WD.gold}"><span dir="ltr" style="background:${WD.gold};color:#fff;font-weight:bold;padding:2pt 7pt;font-size:11pt;white-space:nowrap">${String(n).padStart(2, '0')}</span></td><td style="padding:0 6pt 4pt;border-bottom:2px solid ${WD.gold};color:${WD.pri};font-size:15pt;font-weight:bold">${esc(t)}</td></tr></table>${note ? `<p style="color:${WD.mut};font-size:10.5pt;margin:0 0 6pt">${esc(note)}</p>` : ''}`; };
  const body = secs.map((s) => {
    let h = secHead(s.t, s.note);
    const simple = s.fields.filter((f) => !['checklist', 'scores', 'clauses', 'stratcheck'].includes(f.type) && !(f.type === 'textarea' && f.n));
    const numbered = s.fields.filter((f) => f.type === 'textarea' && f.n);
    if (simple.length) h += tbl(simple.map((f) => `<tr>${td(`<b style="color:${WD.pri}">${esc(f.l || '')}</b>`, `background:${WD.beige};width:30%`, '30%')}${td(cell(f), `width:70%;${f.type === 'textarea' && blank ? 'height:60pt;' : blank ? 'height:20pt;' : ''}`, '70%')}</tr>`).join(''));
    if (numbered.length) h += tbl(`<tr>${th('م', '6%', 'center')}${th('البند', '28%')}${th('الوصف')}</tr>` + numbered.map((f, i) => `<tr style="${i % 2 ? `background:#FBF9F4` : ''}">${td(f.n, 'text-align:center;font-weight:bold')}${td(`<b>${esc(f.l)}</b>`)}${td(d[f.k] ? E(d[f.k]) : empty, blank ? 'height:48pt' : '')}</tr>`).join(''));
    s.fields.filter((f) => f.type === 'checklist').forEach((f) => { const v = d[f.k] || {}; h += tbl(`<tr>${th('م', '6%', 'center')}${th('عنصر المراجعة')}${f.weights ? th('الوزن', '12%', 'center') : ''}${f.opts.map(([, l]) => th(l, '10%', 'center')).join('')}${th('الملاحظات', '22%')}</tr>` + f.items.map((it, i) => `<tr style="${i % 2 ? 'background:#FBF9F4' : ''}">${td(i + 1, 'text-align:center')}${td(esc(it))}${f.weights ? td(`<span dir="ltr" style="white-space:nowrap">${f.weights[i]}%</span>`, 'text-align:center') : ''}${f.opts.map(([k]) => td(box((v[i] || {}).v === k), 'text-align:center')).join('')}${td(E((v[i] || {}).n || ''))}</tr>`).join('')); });
    s.fields.filter((f) => f.type === 'scores').forEach((f) => { const v = d[f.k] || {}; const sc = blank ? null : evalScore(d); h += tbl(`<tr>${th('المعيار')}${th('الوزن', '12%', 'center')}${[1, 2, 3, 4, 5].map((x) => th(x, '6%', 'center')).join('')}${th('ملاحظات', '22%')}</tr>` + f.items.map((c, i) => `<tr style="${i % 2 ? 'background:#FBF9F4' : ''}">${td(`<b>${esc(c.l)}</b><br><span style="color:${WD.mut};font-size:10pt">${esc(c.d || '')}</span>`)}${td(`<span dir="ltr" style="white-space:nowrap">${c.w}%</span>`, 'text-align:center')}${[1, 2, 3, 4, 5].map((x) => td(box(+((v[c.k] || {}).v) === x), 'text-align:center')).join('')}${td(E((v[c.k] || {}).n || ''))}</tr>`).join('') + `<tr>${td('<b>الدرجة الموزونة</b>', `background:${WD.beige}`)}${td('', `background:${WD.beige}`)}<td colspan="5" style="border:1px solid ${WD.line};background:${WD.beige};text-align:center;font-weight:bold;color:${WD.pri}">${sc === null ? '____ %' : sc + '%'}</td>${td('', `background:${WD.beige}`)}</tr>`); });
    s.fields.filter((f) => f.type === 'clauses').forEach((f) => { const v = d[f.k] || []; const G = goalCodes(); const rows = v.length ? v : Array.from({ length: blank ? 8 : 0 }, () => ({ text: '', goals: [] })); h += tbl(`<tr>${th('م', '5%', 'center')}${th('بند المذكرة')}${G.map((g) => th(`<span dir="ltr" style="white-space:nowrap">${esc(g.k)}</span>`, '8%', 'center')).join('')}${th('ملاحظات', '18%')}</tr>` + rows.map((r, i) => `<tr>${td(i + 1, 'text-align:center')}${td(r.text ? E(r.text) : empty, blank ? 'height:26pt' : '')}${G.map((g) => td(box((r.goals || []).includes(g.k)), 'text-align:center')).join('')}${td(E(r.note || ''))}</tr>`).join(''));
      h += `<p style="font-size:10pt;color:${WD.mut};margin:2pt 0 8pt">${G.map((g) => `<b style="color:${WD.pri}">${esc(g.k)}:</b> ${esc(g.t.replace(/^[A-Z]{1,3}\d?\s*[:：]\s*/, ''))}`).join('<br>')}</p>`; });
    s.fields.filter((f) => f.type === 'stratcheck').forEach((f) => { const v = d[f.k] || {}; const T = v.target && typeof stratTarget === 'function' ? stratTarget(v.target) : null; const items = T ? stratItems(v.target) : [1, 2, 3, 4].map(() => ({ t: '' })); const ch = v.checks || []; const k = items.filter((_, i) => ch[i]).length;
      h += tbl(`<tr>${td(`<b style="color:${WD.pri}">الهدف أو المبادرة</b>`, `background:${WD.beige};width:30%`, '30%')}${td(T ? `<b>${esc(T.goal.k)}</b> — ${esc(T.label)}` : empty, 'height:20pt')}</tr>`) + tbl(`<tr>${th('م', '6%', 'center')}${th('عنصر قائمة التحقق')}${th('متحقق', '12%', 'center')}</tr>` + items.map((it, i) => `<tr>${td(i + 1, 'text-align:center')}${td(it.t ? esc(it.t) : empty, T ? '' : 'height:20pt')}${td(box(!!ch[i]), 'text-align:center')}</tr>`).join('') + `<tr><td colspan="3" style="border:1px solid ${WD.line};background:${WD.beige};padding:6pt 8pt;font-weight:bold;color:${WD.pri}">${T ? `النتيجة: ${k} من ${items.length} — ${k / items.length >= STRAT_PASS ? 'تُحتسب تابعة' : 'دون الحد (75%)'}` : 'النتيجة: ____ من 4 — تُعدّ الشراكة تابعة إذا تحققت 3 عناصر على الأقل (75%)'}</td></tr>`); });
    return h;
  }).join('');
  const head = `<table dir="rtl" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;border-bottom:3px solid ${WD.pri}"><tr>
      <td style="padding:0 0 8pt;vertical-align:middle">${logo ? `<img src="${logo}" height="52" style="height:52px">` : ''}</td>
      <td style="padding:0 8pt 8pt;vertical-align:middle"><b style="font-size:14pt;color:${WD.pri}">${esc(D.settings.org.name)}</b><br><span style="color:${WD.mut}">${esc(D.settings.org.dept)}</span></td>
      <td style="padding:0 0 8pt;vertical-align:middle;text-align:left;color:${WD.mut};font-size:10.5pt">رقم النموذج: <b style="color:${WD.ink}">${st && st.no ? esc(st.no) : '______________'}</b><br>التاريخ: <b style="color:${WD.ink}">${st && st.at && !blank ? fmtDate(st.at) + 'م' : '____ / ____ / ________'}</b></td></tr></table>
    <table dir="rtl" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin:10pt 0 4pt"><tr><td style="background:${WD.pri};padding:14pt 16pt;border-right:6pt solid ${WD.gold}">
      <span style="color:${WD.goldL};font-size:10.5pt;font-weight:bold">${step ? `الخطوة ${step.n}: ${esc(step.t)}` : F.periodic ? 'تقييم دوري للشراكة' : esc(D.settings.org.platform)}</span><br>
      <span style="color:#fff;font-size:19pt;font-weight:bold">${esc(F.title)}</span><br>
      <span style="color:#C7D6CD;font-size:11pt">${blank ? 'الجهة الشريكة: ____________________________' : `الجهة الشريكة: ${esc(R.name || '')}`}</span></td></tr></table>`;
  const sigs = tbl(`<tr>${['أعدّه', 'الاعتماد', 'التوقيع'].map((l, i) => `<td style="border-top:2px solid ${WD.pri};padding:6pt 8pt;width:33%;vertical-align:top"><span style="color:${WD.mut};font-size:10pt">${l}</span><br><b>${i === 0 && st && st.by && !blank ? esc(st.by) : i === 1 && st && st.status === 'done' && !blank ? 'مكتمل ومعتمد في المنظومة' : '&nbsp;'}</b><br>&nbsp;</td>`).join('<td style="width:8pt"></td>')}</tr>`, 'margin-top:22pt');
  const foot = `<p style="border-top:1px solid ${WD.line};margin-top:16pt;padding-top:4pt;color:#8C958E;font-size:9pt;text-align:center">${esc(D.settings.org.name)} · ${esc(D.settings.org.platform)} · ${esc(F.title)}</p>`;
  return head + body + sigs + foot;
}
function wordDocWrap(title, inner) {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(title)}</title>
    <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
    <style>@page WordSection1{size:595.3pt 841.9pt;margin:42pt 42pt 42pt 42pt}div.WordSection1{page:WordSection1}body{font-family:${WD.font};direction:rtl;font-size:12pt;color:${WD.ink}}p{margin:0}table{mso-table-lspace:0;mso-table-rspace:0}td{font-family:${WD.font};font-size:11.5pt;text-align:right}</style></head>
    <body dir="rtl" lang="AR-SA"><div class="WordSection1" dir="rtl">${inner}</div></body></html>`;
}
