-- =====================================================================
-- تقوية أمان المنظومة (تُشغَّل مرة واحدة في Supabase ← SQL Editor؛ آمنة للتكرار)
-- الخادم يرسل لكل جلسة ما تسمح به صلاحياتها فقط، بدل إرسال كل شيء وإخفائه في الواجهة:
--   • حساب «الاطلاع» (القيادة): بلا مسودات ولا سجل التغييرات (كما في صلاحياته).
--   • روابط الاطلاع المؤقتة: كذلك، وبلا بيانات التواصل ما لم يمنحها الرابط، وبلا
--     مستندات (الصور فقط)، وبلا بيانات مقدّمي المقترحات.
--   • الجميع: لا تصل نسخ كلمات المرور المحلية المخزّنة في الإعدادات إلى أي متصفح.
-- لا يغيّر شيئًا لإدارة الشراكات والفريق والإدارات (تُرسل لهم السجلات كاملة لأنهم يحفظون عليها).
-- =====================================================================

drop function if exists public.shk_redact(text, jsonb);

create or replace function public.shk_redact(p_col text, p_data jsonb, p_share boolean, p_contacts boolean) returns jsonb
language sql immutable set search_path = public as $$
  select case
    when p_data is null then null
    when p_col = 'settings' then p_data - 'auth'
    when not p_share then p_data
    when p_col = 'partnerships' then
      (case when p_contacts then p_data else p_data - array['contactName','contactEmail','contactPhone','contactTitle'] end)
      || jsonb_build_object('attachments', coalesce((
           select jsonb_agg(a) from jsonb_array_elements(case when jsonb_typeof(p_data->'attachments') = 'array' then p_data->'attachments' else '[]'::jsonb end) a
           where coalesce(a->>'type', '') like 'image/%'), '[]'::jsonb))
    when p_col = 'partners' then
      case when p_contacts then p_data else p_data - array['contactName','contactEmail','contactPhone','contacts','phone','email'] end
    when p_col = 'proposals' then
      p_data - array['requesterName','requesterEmail','requesterPhone','requesterTitle','contactName','contactEmail','contactPhone','attachments']
    else p_data
  end
$$;

create or replace function public.shk_pull(p_token text, p_since bigint default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me record; v boolean; sh boolean; ct boolean := false;
begin
  select * into me from shk_auth(p_token);
  v := me.grp = 'viewer';
  sh := me.account_id like 'share:%';
  if sh then
    select coalesce(s.sections ? 'contacts', false) into ct from shk_shares s where s.id = substr(me.account_id, 7);
  end if;
  return jsonb_build_object(
    'me', me.account_id,
    'rev', (select coalesce(max(rev), 0) from shk_records),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
                         'col', col, 'id', id,
                         'data', case when deleted then null
                                      when v and (col = 'audit' or (col = 'partnerships' and coalesce((data->>'isDraft')::boolean, false))) then null
                                      else shk_redact(col, data, sh, coalesce(ct, false)) end,
                         'deleted', deleted or (v and (col = 'audit' or (col = 'partnerships' and coalesce((data->>'isDraft')::boolean, false)))),
                         'rev', rev) order by rev)
                       from shk_records where rev > coalesce(p_since, 0)), '[]'::jsonb));
end $$;

-- الملفات: روابط الاطلاع المؤقتة لا تفتح إلا الصور (لا العقود والمستندات)
create or replace function public.shk_file_get(p_token text, p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me record; f record;
begin
  select * into me from shk_auth(p_token);
  select * into f from shk_files where id = p_id;
  if f.id is null then return null; end if;
  if me.account_id like 'share:%' and coalesce(f.meta->>'type', '') not like 'image/%' then return null; end if;
  return jsonb_build_object('id', f.id, 'meta', f.meta, 'data', f.data);
end $$;

revoke execute on function public.shk_redact(text, jsonb, boolean, boolean) from public, anon, authenticated;
grant execute on function public.shk_pull(text, bigint) to anon;
grant execute on function public.shk_file_get(text, text) to anon;

-- =====================================================================
-- (اختياري، بعد تعيين كلمة مرور مخصّصة لكل حساب من «الإعدادات ← الحسابات»)
-- إيقاف كلمات المرور الافتراضية نهائيًا: أي حساب بلا كلمة مرور مخصّصة لا يدخل حتى يعيّنها المسؤول.
-- أزل علامتي التعليق عن السطر التالي ثم شغّله:
-- delete from public.shk_defaults;
-- =====================================================================
