-- =====================================================================
-- تقوية أمان المنظومة — الإصدار 3 (تُشغَّل في Supabase ← SQL Editor بعد security_hardening.sql
-- وexternal_links_v2.sql؛ آمنة للتكرار). تنقل حدود الصلاحيات من المتصفح إلى الخادم:
--   • روابط الاطلاع المؤقتة لا تصل إلى المستندات (الصور فقط) ولا إلى قائمة الملفات.
--   • الإدارات والفريق لا يستطيعون تغيير القوائم (ومنها قائمة الحسابات) ولا إعدادات الجهة.
--   • الإدارة: مقترحاتها فقط، وفي الشراكات خطوات المسار ومرفقاتها ونماذجها فقط، ولا حذف.
--   • الفريق: لا يحذف الشراكات (صلاحية إدارة الشراكات وحدها).
--   • سجل التغييرات: يُضاف إليه فقط، ولا يُعدَّل ولا يُحذف إلا من إدارة الشراكات.
--   • الملفات: غير إدارة الشراكات تضيف فقط (لا تستبدل ملفًا قائمًا ولا تحذفه).
--   • الدخول: يرفض المعرّفات الطويلة (حماية جدول المحاولات من الإغراق).
-- لا تغيير لإدارة الشراكات ومدير النظام.
-- تنبيه: لا تُعِد تشغيل schema.sql بعد هذا الملف؛ فهو يعيد النسخ القديمة من هذه الدوال.
-- =====================================================================

-- مفاتيح الإعدادات التي لا يغيّرها إلا إدارة الشراكات
create or replace function public.shk_settings_guard(p_grp text, p_old jsonb, p_new jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select case
    when p_grp in ('sys', 'admin') or p_new is null then p_new
    -- الإدارات: لا تكتب في الإعدادات إلا التنبيهات
    when p_grp = 'dept' then coalesce(p_old, '{}'::jsonb) || jsonb_build_object('notifs', coalesce(p_new->'notifs', p_old->'notifs', '[]'::jsonb))
    -- الفريق: كل شيء عدا القوائم والحسابات وبيانات الجهة والمبادرات
    else (p_new - array['lists', 'auth', 'org', 'goalInits'])
         || jsonb_strip_nulls(jsonb_build_object('lists', p_old->'lists', 'org', p_old->'org', 'goalInits', p_old->'goalInits'))
  end
$$;
revoke all on function public.shk_settings_guard(text, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.shk_push(p_token text, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me record; r jsonb; cur bigint; nr bigint; revs jsonb := '[]'::jsonb; conflicts jsonb := '[]'::jsonb; rejected jsonb := '[]'::jsonb;
        old record; del boolean; nd jsonb; mydept text;
begin
  select * into me from shk_auth(p_token);
  if me.grp = 'viewer' or me.account_id like 'share:%' then raise exception 'forbidden' using errcode = 'P0001'; end if;
  mydept := case when me.grp = 'dept' then substr(me.account_id, 6) end;
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    if (r->>'col') not in ('settings', 'partners', 'partnerships', 'proposals', 'achievements', 'news', 'audit') or coalesce(r->>'id', '') = '' then
      raise exception 'bad_row' using errcode = 'P0001';
    end if;
    del := coalesce((r->>'deleted')::boolean, false);
    nd := case when del then null else r->'data' end;
    select data, deleted into old from shk_records where col = r->>'col' and id = r->>'id' for update;

    if me.grp not in ('sys', 'admin') then
      -- السجل يُضاف إليه فقط، والإعدادات لا تُحذف
      if r->>'col' = 'audit' and (del or old.data is not null) then rejected := rejected || jsonb_build_object('col', r->>'col', 'id', r->>'id'); continue; end if;
      if r->>'col' = 'settings' and del then rejected := rejected || jsonb_build_object('col', r->>'col', 'id', r->>'id'); continue; end if;
      if r->>'col' = 'settings' then nd := shk_settings_guard(me.grp, old.data, nd); end if;
      if me.grp = 'team' and r->>'col' = 'partnerships' and del then rejected := rejected || jsonb_build_object('col', r->>'col', 'id', r->>'id'); continue; end if;
      if me.grp = 'dept' then
        if r->>'col' in ('partners', 'achievements', 'news') then rejected := rejected || jsonb_build_object('col', r->>'col', 'id', r->>'id'); continue; end if;
        if r->>'col' = 'proposals' then
          -- مقترحات الإدارة نفسها فقط، ولا تنقلها إلى إدارة أخرى، ولا تحذف مقترحًا قُدِّم
          if old.data is not null and coalesce(old.data->>'department', '') <> mydept then rejected := rejected || jsonb_build_object('col', r->>'col', 'id', r->>'id'); continue; end if;
          if nd is not null and coalesce(nd->>'department', '') <> mydept then rejected := rejected || jsonb_build_object('col', r->>'col', 'id', r->>'id'); continue; end if;
          if del and coalesce(old.data->>'status', 'draft') <> 'draft' then rejected := rejected || jsonb_build_object('col', r->>'col', 'id', r->>'id'); continue; end if;
        end if;
        if r->>'col' = 'partnerships' then
          -- لا إنشاء ولا حذف؛ والتعديل على خطوات المسار ومرفقاتها ونماذجها فقط
          if old.data is null or del then rejected := rejected || jsonb_build_object('col', r->>'col', 'id', r->>'id'); continue; end if;
          nd := old.data || jsonb_strip_nulls(jsonb_build_object('wf', nd->'wf', 'attachments', nd->'attachments', 'forms', nd->'forms',
                                                                  'updatedAt', nd->'updatedAt', 'updatedBy', nd->'updatedBy'));
        end if;
      end if;
    end if;

    if r->>'col' = 'settings' and r ? 'base' then
      select rev into cur from shk_records where col = 'settings' and id = r->>'id';
      if cur is not null and cur > coalesce((r->>'base')::bigint, 0) then
        conflicts := conflicts || jsonb_build_object('col', 'settings', 'id', r->>'id');
        continue;
      end if;
    end if;
    nr := nextval('shk_rev_seq');
    insert into shk_records (col, id, data, deleted, rev, updated_at, updated_by)
      values (r->>'col', r->>'id', nd, del, nr, now(), me.account_id)
      on conflict (col, id) do update set data = excluded.data, deleted = excluded.deleted, rev = excluded.rev,
              updated_at = excluded.updated_at, updated_by = excluded.updated_by;
    revs := revs || jsonb_build_object('col', r->>'col', 'id', r->>'id', 'rev', nr);
  end loop;
  return jsonb_build_object('revs', revs, 'conflicts', conflicts, 'rejected', rejected);
end $$;

-- الملفات: غير إدارة الشراكات تضيف فقط
create or replace function public.shk_file_put(p_token text, p_id text, p_meta jsonb, p_data text) returns void
language plpgsql security definer set search_path = public as $$
declare me record;
begin
  select * into me from shk_auth(p_token);
  if me.grp = 'viewer' or me.account_id like 'share:%' then raise exception 'forbidden' using errcode = 'P0001'; end if;
  if coalesce(p_id, '') = '' or length(p_id) > 200 or p_data is null or length(p_data) > 22000000 then raise exception 'bad_file' using errcode = 'P0001'; end if;
  if me.grp in ('sys', 'admin') then
    insert into shk_files (id, meta, data, created_by) values (p_id, coalesce(p_meta, '{}'::jsonb), p_data, me.account_id)
      on conflict (id) do update set meta = excluded.meta, data = excluded.data;
  else
    insert into shk_files (id, meta, data, created_by) values (p_id, coalesce(p_meta, '{}'::jsonb), p_data, me.account_id)
      on conflict (id) do nothing;
  end if;
end $$;

create or replace function public.shk_file_chunk_put(p_token text, p_id text, p_n int, p_data text) returns void
language plpgsql security definer set search_path = public as $$
declare me record;
begin
  select * into me from shk_auth(p_token);
  if me.grp = 'viewer' or me.account_id like 'share:%' then raise exception 'forbidden' using errcode = 'P0001'; end if;
  if coalesce(p_id, '') = '' or length(p_id) > 200 or p_n is null or p_n < 0 or p_n > 40 or p_data is null or length(p_data) > 6000000 then raise exception 'bad_file' using errcode = 'P0001'; end if;
  -- ملف اكتمل رفعه لا تُستبدل أجزاؤه إلا من إدارة الشراكات
  if me.grp not in ('sys', 'admin') and exists (select 1 from shk_files where id = p_id) then return; end if;
  insert into shk_file_chunks (id, n, data) values (p_id, p_n, p_data)
    on conflict (id, n) do update set data = excluded.data;
end $$;

create or replace function public.shk_file_del(p_token text, p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare me record;
begin
  select * into me from shk_auth(p_token);
  if me.grp not in ('sys', 'admin') then return; end if; /* لا خطأ: الواجهة تتجاهل التنظيف لغير الإدارة */
  delete from shk_files where id = p_id;
  delete from shk_file_chunks where id = p_id;
end $$;

-- روابط الاطلاع: لا قائمة ملفات إلا الصور، ولا أجزاء مستندات
create or replace function public.shk_file_ids(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me record;
begin
  select * into me from shk_auth(p_token);
  if me.account_id like 'share:%' then
    return coalesce((select jsonb_agg(id) from shk_files where coalesce(meta->>'type', '') like 'image/%'), '[]'::jsonb);
  end if;
  return coalesce((select jsonb_agg(id) from shk_files), '[]'::jsonb);
end $$;

create or replace function public.shk_file_chunk_get(p_token text, p_id text, p_n int) returns text
language plpgsql security definer set search_path = public as $$
declare me record;
begin
  select * into me from shk_auth(p_token);
  if me.account_id like 'share:%' and not exists (select 1 from shk_files where id = p_id and coalesce(meta->>'type', '') like 'image/%') then return null; end if;
  return (select data from shk_file_chunks where id = p_id and n = p_n);
end $$;

-- الدخول: نفس السلوك مع رفض المعرّفات الطويلة قبل تسجيل أي محاولة
create or replace function public.shk_login(p_id text, p_pw text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare g text; f record; tk text;
begin
  if p_id is null or length(p_id) > 120 or p_pw is null or length(p_pw) > 200 then return jsonb_build_object('error', 'bad_login'); end if;
  g := shk_grp(p_id);
  if g is null then return jsonb_build_object('error', 'bad_login'); end if;
  if not shk_account_known(p_id) then return jsonb_build_object('error', 'bad_login'); end if; /* حساب غير موجود لا يُنشئ سجل محاولات */
  delete from shk_sessions where expires_at < now();
  select * into f from shk_login_fails where account_id = p_id;
  if f.locked_until is not null and f.locked_until > now() then
    return jsonb_build_object('error', 'locked', 'wait', ceil(extract(epoch from (f.locked_until - now())))::int);
  end if;
  if not shk_check_pw(p_id, p_pw) then
    insert into shk_login_fails as lf (account_id, fails) values (p_id, 1)
      on conflict (account_id) do update set fails = case when lf.locked_until is not null and lf.locked_until <= now() then 1 else lf.fails + 1 end,
        locked_until = case when (case when lf.locked_until is not null and lf.locked_until <= now() then 1 else lf.fails + 1 end) >= 5 then now() + interval '5 minutes' else null end;
    return jsonb_build_object('error', 'bad_login');
  end if;
  delete from shk_login_fails where account_id = p_id;
  tk := encode(extensions.gen_random_bytes(32), 'hex');
  insert into shk_sessions (token_hash, account_id, grp, expires_at) values (shk_hash_token(tk), p_id, g, now() + interval '30 days');
  return jsonb_build_object('token', tk, 'id', p_id, 'grp', g);
end $$;
delete from public.shk_login_fails where length(account_id) > 120;

grant execute on function public.shk_push(text, jsonb) to anon;
grant execute on function public.shk_file_put(text, text, jsonb, text) to anon;
grant execute on function public.shk_file_chunk_put(text, text, int, text) to anon;
grant execute on function public.shk_file_del(text, text) to anon;
grant execute on function public.shk_file_ids(text) to anon;
grant execute on function public.shk_file_chunk_get(text, text, int) to anon;
grant execute on function public.shk_login(text, text) to anon;
