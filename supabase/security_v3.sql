-- =====================================================================
-- تقوية أمان المنظومة — الإصدار 3 (تُشغَّل في Supabase ← SQL Editor بعد security_hardening.sql
-- وexternal_links_v2.sql؛ آمنة للتكرار). تنقل حدود الصلاحيات من المتصفح إلى الخادم:
--   • روابط الاطلاع المؤقتة لا تصل إلى المستندات (الصور فقط) ولا إلى قائمة الملفات.
--   • الإدارات والفريق لا يستطيعون تغيير القوائم (ومنها قائمة الحسابات) ولا إعدادات الجهة.
--   • الإدارة: مقترحاتها فقط، وفي الشراكات خطوات المسار ومرفقاتها ونماذجها فقط، ولا حذف.
--   • الفريق: لا يحذف الشراكات (صلاحية إدارة الشراكات وحدها).
--   • سجل التغييرات: يُضاف إليه فقط، ولا يُعدَّل ولا يُحذف إلا من إدارة الشراكات.
--   • الملفات: غير إدارة الشراكات تضيف فقط (لا تستبدل ملفًا قائمًا ولا تحذفه).
--   • الدخول: القفل لكل جهاز على حدة (لا يستطيع أحد قفل حساب المدير على صاحبه).
--   • روابط الاطلاع: الخادم يرسل ما تحتاجه الأقسام المختارة فقط.
--   • الرفع الخارجي: سقف يومي للمساحة وتنظيف تلقائي للملفات اليتيمة.
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


grant execute on function public.shk_push(text, jsonb) to anon;
grant execute on function public.shk_file_put(text, text, jsonb, text) to anon;
grant execute on function public.shk_file_chunk_put(text, text, int, text) to anon;
grant execute on function public.shk_file_del(text, text) to anon;
grant execute on function public.shk_file_ids(text) to anon;
grant execute on function public.shk_file_chunk_get(text, text, int) to anon;

-- =====================================================================
-- الدخول: القفل لكل عنوان (جهاز) على حدة بدل قفل الحساب على الجميع
--   • 5 محاولات خاطئة من نفس العنوان ← يُقفل ذلك العنوان وحده 5 دقائق؛ صاحب الحساب يدخل من جهازه عاديًا.
--   • سقف احتياطي لهجوم موزّع واسع: 300 محاولة خاطئة على حساب واحد خلال ساعة من كل العناوين ← قفل 10 دقائق.
--   • المعرّفات الطويلة والحسابات غير الموجودة لا تُسجَّل (حماية الجدول من الإغراق).
-- =====================================================================
create table if not exists public.shk_login_fails_ip (
  account_id   text not null,
  ip           text not null,
  fails        int  not null default 0,
  locked_until timestamptz,
  last_at      timestamptz not null default now(),
  primary key (account_id, ip)
);
alter table public.shk_login_fails_ip enable row level security;
revoke all on table public.shk_login_fails_ip from public, anon, authenticated;

create or replace function public.shk_client_ip() returns text
language plpgsql stable set search_path = public as $$
declare h json;
begin
  begin h := nullif(current_setting('request.headers', true), '')::json; exception when others then h := null; end;
  if h is null then return 'na'; end if;
  -- cf-connecting-ip يضعه Cloudflare أمام Supabase ولا يستطيع المتصفح تزويره
  return left(coalesce(nullif(h->>'cf-connecting-ip', ''), nullif(h->>'x-real-ip', ''), nullif(trim(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1)), ''), 'na'), 64);
end $$;
revoke all on function public.shk_client_ip() from public, anon, authenticated;

create or replace function public.shk_login(p_id text, p_pw text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare g text; f record; tk text; addr text := shk_client_ip(); tot int; nf int;
begin
  if p_id is null or length(p_id) > 120 or p_pw is null or length(p_pw) > 200 then return jsonb_build_object('error', 'bad_login'); end if;
  g := shk_grp(p_id);
  if g is null or not shk_account_known(p_id) then return jsonb_build_object('error', 'bad_login'); end if;
  delete from shk_sessions where expires_at < now();
  delete from shk_login_fails_ip where last_at < now() - interval '1 day';
  select * into f from shk_login_fails_ip where account_id = p_id and ip = addr;
  if f.locked_until is not null and f.locked_until > now() then
    return jsonb_build_object('error', 'locked', 'wait', ceil(extract(epoch from (f.locked_until - now())))::int);
  end if;
  select coalesce(sum(fails), 0) into tot from shk_login_fails_ip where account_id = p_id and last_at > now() - interval '1 hour';
  if tot >= 300 then
    return jsonb_build_object('error', 'locked', 'wait', 600);
  end if;
  if not shk_check_pw(p_id, p_pw) then
    nf := case when f.account_id is null or (f.locked_until is not null and f.locked_until <= now()) then 1 else f.fails + 1 end;
    insert into shk_login_fails_ip as lf (account_id, ip, fails, locked_until, last_at)
      values (p_id, addr, nf, case when nf >= 5 then now() + interval '5 minutes' end, now())
      on conflict (account_id, ip) do update set fails = excluded.fails, locked_until = excluded.locked_until, last_at = now();
    return jsonb_build_object('error', 'bad_login');
  end if;
  delete from shk_login_fails_ip where account_id = p_id and ip = addr;
  delete from shk_login_fails where account_id = p_id;
  tk := encode(extensions.gen_random_bytes(32), 'hex');
  insert into shk_sessions (token_hash, account_id, grp, expires_at) values (shk_hash_token(tk), p_id, g, now() + interval '30 days');
  return jsonb_build_object('token', tk, 'id', p_id, 'grp', g);
end $$;
delete from public.shk_login_fails where length(account_id) > 120;
grant execute on function public.shk_login(text, text) to anon;

-- =====================================================================
-- روابط الاطلاع المؤقتة: الخادم يرسل ما تحتاجه الأقسام المختارة فقط
--   • لا تصل أبدًا: النماذج والمذكرات المُعدّة (forms)، وتعليقات ومرفقات خطوات المسار، والتنبيهات وإعدادات البريد،
--     وسجل التغييرات، والمسودات، وأسماء من أجرى كل إجراء على المقترحات وملاحظاتهم الداخلية.
--   • الاجتماعات (ذاكرة الجهة) مع «تقويم الشراكات» فقط.
--   • المقترحات مع «لوحة الأداء» أو «التقارير» أو «الرئيسية» فقط، ومن غير نصوصها ومقدّميها.
--   • الإنجازات والأخبار مع الأقسام التي تعرضها فقط.
--   • الشراكات والجهات لا تُرسل إن اقتصر الرابط على «مسار الشراكة».
-- =====================================================================
create or replace function public.shk_share_filter(p_col text, p_data jsonb, p_secs jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select case
    when p_data is null then null
    when p_col = 'audit' then null
    when p_col = 'settings' then p_data - array['auth', 'notifs', 'mail', 'liveCfg', 'session']
    when p_col in ('partnerships', 'partners')
         and not (p_secs ?| array['home', 'tale', 'dashboard', 'partnerships', 'partners', 'reports', 'stories', 'gallery', 'map', 'strategy', 'calendar', 'media']) then null
    when p_col = 'partnerships' then
      (p_data - array['forms', 'portalLinks', 'pulse'] - (case when p_secs ? 'calendar' then array[]::text[] else array['meetings'] end))
      || case when jsonb_typeof(p_data->'wf') = 'object' and jsonb_typeof(p_data->'wf'->'steps') = 'object' then
           jsonb_build_object('wf', (p_data->'wf') || jsonb_build_object('steps', (
             select coalesce(jsonb_object_agg(k, (case when jsonb_typeof(v) = 'object' then (v - array['note', 'notes', 'by', 'comment', 'msg']) || (case when jsonb_typeof(v->'depts') = 'object' then jsonb_build_object('depts', (select coalesce(jsonb_object_agg(dk, jsonb_build_object('at', dv->'at')), '{}'::jsonb) from jsonb_each(v->'depts') d(dk, dv))) else '{}'::jsonb end) else v end)), '{}'::jsonb)
             from jsonb_each(p_data->'wf'->'steps') e(k, v))))
         else '{}'::jsonb end
    when p_col = 'proposals' then
      case when not (p_secs ?| array['dashboard', 'reports', 'home']) then null
      else (p_data - array['targets', 'reasons', 'addedValue', 'notes', 'note', 'reviewNote', 'internalNote', 'messages', 'comments', 'replies', 'decisionNote', 'infoRequest'])
           || jsonb_build_object('events', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', e->'id', 'at', e->'at', 'type', e->'type', 'to', e->'to', 'from', e->'from', 'status', e->'status'))), '[]'::jsonb)
                        from jsonb_array_elements(case when jsonb_typeof(p_data->'events') = 'array' then p_data->'events' else '[]'::jsonb end) e
                        where coalesce(e->>'vis', '') <> 'internal'))
      end
    when p_col = 'achievements' and not (p_secs ?| array['home', 'tale', 'stories', 'gallery', 'reports', 'media', 'partnerships']) then null
    when p_col = 'news' and not (p_secs ?| array['home', 'stories']) then null
    else p_data
  end
$$;
revoke all on function public.shk_share_filter(text, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.shk_pull(p_token text, p_since bigint default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me record; v boolean; sh boolean; ct boolean := false; secs jsonb := '[]'::jsonb;
begin
  select * into me from shk_auth(p_token);
  v := me.grp = 'viewer';
  sh := me.account_id like 'share:%';
  if sh then
    select coalesce(s.sections, '[]'::jsonb) into secs from shk_shares s where s.id = substr(me.account_id, 7);
    secs := coalesce(secs, '[]'::jsonb); ct := secs ? 'contacts';
  end if;
  return jsonb_build_object(
    'me', me.account_id,
    'rev', (select coalesce(max(rev), 0) from shk_records),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('col', col, 'id', id, 'data', d, 'deleted', d is null, 'rev', rev) order by rev)
                       from (select col, id, rev,
                                    case when deleted then null
                                         when v and (col = 'audit' or (col = 'partnerships' and coalesce((data->>'isDraft')::boolean, false))) then null
                                         when sh then shk_share_filter(col, shk_redact(col, data, true, ct), secs)
                                         else shk_redact(col, data, false, ct) end as d
                               from shk_records where rev > coalesce(p_since, 0)) x), '[]'::jsonb));
end $$;
grant execute on function public.shk_pull(text, bigint) to anon;

-- =====================================================================
-- الرفع من الروابط الخارجية (رابط تقديم المقترح وبوابة الشريك): سقف للمساحة وتنظيف تلقائي
--   • سقف يومي عام: 250 ميجا لكل الرفع الخارجي، و60 ميجا يوميًا لكل رابط أو متابعة مقترح.
--   • رموز متابعة المقترح تقبل الرفع ما دام المقترح لم يُغلق (لم يُقبل نهائيًا أو يُرفض أو يُحوَّل لشراكة).
--   • الملفات المرفوعة التي لم تُرفق بأي سجل خلال 3 أيام تُحذف تلقائيًا.
-- =====================================================================
create or replace function public.shk_anon_quota(p_own text, p_len bigint) returns text
language plpgsql security definer set search_path = public as $$
begin
  -- تنظيف: ملفات خارجية يتيمة أقدم من 3 أيام (لم تُرفق بمقترح أو شراكة)
  delete from shk_files f where (f.id like 'f-ext-%' or f.id like 'f-ptl-%') and f.created_at < now() - interval '3 days'
    and f.id in (select id from shk_files where (id like 'f-ext-%' or id like 'f-ptl-%') and created_at < now() - interval '3 days' limit 50)
    and not exists (select 1 from shk_records r where not r.deleted and position(f.id in r.data::text) > 0);
  if (select coalesce(sum(length(data)), 0) from shk_files where (id like 'f-ext-%' or id like 'f-ptl-%') and created_at > now() - interval '1 day') + p_len > 250000000 then return 'busy'; end if;
  if (select coalesce(sum(length(data)), 0) from shk_files where (created_by = p_own or created_by like p_own || ':%') and created_at > now() - interval '1 day') + p_len > 60000000 then return 'busy'; end if;
  return null;
end $$;
revoke all on function public.shk_anon_quota(text, bigint) from public, anon, authenticated;

create or replace function public.shk_ext_file_put(p_key text, p_id text, p_meta jsonb, p_data text, p_nonce text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i record; pid text; own text; base text; q text; st text;
begin
  select * into i from shk_invites where token_hash = shk_hash_token(p_key);
  if i.id is not null and not i.revoked and i.expires_at > now() and i.uses < i.max_uses then
    own := 'ext-inv:' || i.id; base := own;
    if i.kind = 'public' then
      if coalesce(p_nonce, '') !~ '^[a-f0-9]{16,40}$' then return jsonb_build_object('error', 'bad_file'); end if;
      own := own || ':' || p_nonce;
      if (select count(*) from shk_files where created_by like 'ext-inv:' || i.id || ':%' and created_at > now() - interval '1 day') >= 300 then return jsonb_build_object('error', 'busy'); end if;
    end if;
  else
    select proposal_id into pid from shk_ext_tracks where track_hash = shk_hash_token(p_key);
    if pid is null then return jsonb_build_object('error', 'invalid'); end if;
    select data->>'status' into st from shk_records where col = 'proposals' and id = pid and not deleted;
    if st is null or st in ('converted', 'rejected', 'accepted') then return jsonb_build_object('error', 'invalid'); end if;
    own := 'ext-trk:' || pid; base := own;
  end if;
  if coalesce(p_id, '') !~ '^f-ext-[a-z0-9]{6,40}$' or p_data is null or length(p_data) > 7000000 then return jsonb_build_object('error', 'bad_file'); end if;
  if (select count(*) from shk_files where created_by = own) >= 10 then return jsonb_build_object('error', 'too_many'); end if;
  q := shk_anon_quota(base, length(p_data)); if q is not null then return jsonb_build_object('error', q); end if;
  insert into shk_files (id, meta, data, created_by) values (p_id,
    jsonb_build_object('name', left(coalesce(p_meta->>'name', 'ملف'), 160), 'type', left(coalesce(p_meta->>'type', 'application/octet-stream'), 100), 'size', coalesce((p_meta->>'size')::bigint, 0), 'at', now()),
    p_data, own) on conflict (id) do nothing;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.shk_ext_file_put(text, text, jsonb, text, text) to anon;

create or replace function public.shk_portal_file_put(p_key text, p_id text, p_meta jsonb, p_data text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g shk_portals; own text; q text;
begin
  select * into g from shk_portal_key(p_key); if g.id is null then return jsonb_build_object('error', 'invalid'); end if;
  own := 'portal:' || g.id;
  if coalesce(p_id, '') !~ '^f-ptl-[a-z0-9]{6,40}$' or p_data is null or length(p_data) > 11200000 then return jsonb_build_object('error', 'bad_file'); end if;
  if (select count(*) from shk_files where created_by = own) >= 80 then return jsonb_build_object('error', 'too_many'); end if;
  q := shk_anon_quota(own, length(p_data)); if q is not null then return jsonb_build_object('error', q); end if;
  insert into shk_files (id, meta, data, created_by) values (p_id,
    jsonb_build_object('name', left(coalesce(p_meta->>'name', 'ملف'), 160), 'type', left(coalesce(p_meta->>'type', 'application/octet-stream'), 100), 'size', coalesce((p_meta->>'size')::bigint, 0), 'at', now()),
    p_data, own) on conflict (id) do nothing;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.shk_portal_file_put(text, text, jsonb, text) to anon;
