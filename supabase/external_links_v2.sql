-- ===== روابط الجهات الخارجية (الإصدار 2) + المراسلة بالبريد الإلكتروني =====
-- يُشغَّل مرة واحدة في Supabase ← SQL Editor بعد external_proposals.sql (آمن للتكرار).
-- 1) نوعان للرابط:
--    • خاص (private): لجهة محددة، صلاحيته حتى 180 يومًا، ويعرض النموذج الهدف الاستراتيجي والمبادرة.
--    • عام (public): للنشر (تويتر، الموقع…)، صلاحيته حتى 10 سنوات، عدد غير محدود من المقترحات،
--      ولا يعرض شيئًا من تفاصيل الاستراتيجية. عليه حدود يومية لمنع الإغراق.
-- 2) البريد: يصل مقدم المقترح بريد عند الاستلام وعند كل تحديث لحالة مقترحه، من البريد الذي تضيفه
--    إدارة الشراكات في المنصة (الإعدادات ← مقترحات الجهات الخارجية ← البريد الإلكتروني للمراسلات).
--    كلمة مرور البريد/مفتاح الإرسال تُحفظ هنا في جدول مغلق لا يقرؤه المتصفح أبدًا، وتستخدمها دالة shk-mail فقط.

alter table public.shk_invites add column if not exists kind text not null default 'private';

-- ===== إنشاء الرابط بنوعه =====
drop function if exists public.shk_invite_create(text, text, text, int);
create or replace function public.shk_invite_create(p_token text, p_label text, p_expires_at text, p_uses int, p_kind text default 'private') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me record; tk text; iid text; ex timestamptz := p_expires_at::timestamptz; k text := case when p_kind = 'public' then 'public' else 'private' end;
begin
  select * into me from shk_auth(p_token);
  if me.grp not in ('sys', 'admin') then raise exception 'forbidden' using errcode = 'P0001'; end if;
  if ex is null or ex <= now() or ex > now() + (case when k = 'public' then interval '3660 days' else interval '180 days' end) then raise exception 'bad_expiry' using errcode = 'P0001'; end if;
  tk := encode(extensions.gen_random_bytes(24), 'hex');
  iid := encode(extensions.gen_random_bytes(6), 'hex');
  insert into shk_invites (id, token_hash, label, created_by, expires_at, max_uses, kind)
    values (iid, shk_hash_token(tk), left(coalesce(p_label, ''), 120), me.account_id, ex,
      case when k = 'public' then 1000000 else greatest(1, least(coalesce(p_uses, 1), 50)) end, k);
  return jsonb_build_object('id', iid, 'token', tk);
end $$;

create or replace function public.shk_invite_list(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me record;
begin
  select * into me from shk_auth(p_token);
  if me.grp not in ('sys', 'admin') then raise exception 'forbidden' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'label', label, 'by', created_by, 'at', created_at, 'expires', expires_at,
      'max', max_uses, 'uses', uses, 'revoked', revoked, 'kind', kind) order by created_at desc) from shk_invites), '[]'::jsonb);
end $$;

-- فتح الرابط: الرابط العام لا يحمل أي تفاصيل استراتيجية؛ الخاص يحمل قائمة الأهداف والمبادرات
create or replace function public.shk_invite_check(p_invite text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i record; s jsonb;
begin
  select * into i from shk_invites where token_hash = shk_hash_token(p_invite);
  if i.id is null then return jsonb_build_object('error', 'invalid'); end if;
  if i.revoked then return jsonb_build_object('error', 'revoked'); end if;
  if i.expires_at <= now() then return jsonb_build_object('error', 'expired'); end if;
  if i.uses >= i.max_uses then return jsonb_build_object('error', 'used'); end if;
  select data into s from shk_records where col = 'settings' and id = 'main' and not deleted;
  return jsonb_build_object('kind', i.kind, 'label', case when i.kind = 'public' then '' else i.label end,
    'org', jsonb_build_object('name', s->'org'->'name', 'dept', s->'org'->'dept'), 'sectors', s->'lists'->'formSectors',
    'mail', exists (select 1 from shk_mail_config where id = 'main' and enabled))
    || case when i.kind = 'private' then jsonb_build_object('goals', coalesce(s->'lists'->'goals', '[]'::jsonb), 'goalInits', coalesce(s->'goalInits', '{}'::jsonb)) else '{}'::jsonb end;
end $$;

-- ===== مرفقات الجهة: لكل مقدِّم في الرابط العام حصته الخاصة (nonce) =====
drop function if exists public.shk_ext_file_put(text, text, jsonb, text);
create or replace function public.shk_ext_file_put(p_key text, p_id text, p_meta jsonb, p_data text, p_nonce text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i record; pid text; own text;
begin
  select * into i from shk_invites where token_hash = shk_hash_token(p_key);
  if i.id is not null and not i.revoked and i.expires_at > now() and i.uses < i.max_uses then
    own := 'ext-inv:' || i.id;
    if i.kind = 'public' then
      if coalesce(p_nonce, '') !~ '^[a-f0-9]{16,40}$' then return jsonb_build_object('error', 'bad_file'); end if;
      own := own || ':' || p_nonce;
      if (select count(*) from shk_files where created_by like 'ext-inv:' || i.id || ':%' and (meta->>'at')::timestamptz > now() - interval '1 day') >= 300 then return jsonb_build_object('error', 'busy'); end if;
    end if;
  else
    select proposal_id into pid from shk_ext_tracks where track_hash = shk_hash_token(p_key);
    if pid is null then return jsonb_build_object('error', 'invalid'); end if;
    own := 'ext-trk:' || pid;
  end if;
  if coalesce(p_id, '') !~ '^f-ext-[a-z0-9]{6,40}$' or p_data is null or length(p_data) > 7000000 then return jsonb_build_object('error', 'bad_file'); end if;
  if (select count(*) from shk_files where created_by = own) >= 10 then return jsonb_build_object('error', 'too_many'); end if;
  insert into shk_files (id, meta, data, created_by) values (p_id,
    jsonb_build_object('name', left(coalesce(p_meta->>'name', 'ملف'), 160), 'type', left(coalesce(p_meta->>'type', 'application/octet-stream'), 100), 'size', coalesce((p_meta->>'size')::bigint, 0), 'at', now()),
    p_data, own) on conflict (id) do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- ===== البريد الإلكتروني: الإعداد وطابور الرسائل =====
create table if not exists public.shk_mail_config (
  id         text primary key default 'main',
  enabled    boolean not null default false,
  provider   text not null default 'gmail',      -- gmail | smtp | resend
  from_email text not null default '',
  from_name  text not null default '',
  smtp_host  text not null default '',
  smtp_port  int  not null default 465,
  smtp_user  text not null default '',
  secret     text not null default '',            -- كلمة مرور التطبيق أو مفتاح Resend — لا تُعاد للمتصفح أبدًا
  site_url   text not null default '',
  updated_at timestamptz,
  updated_by text
);
create table if not exists public.shk_mail_queue (
  id         bigserial primary key,
  kind       text not null,                      -- received | update | test
  to_email   text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at    timestamptz,
  attempts   int not null default 0,
  last_error text
);
alter table public.shk_mail_config enable row level security;
alter table public.shk_mail_queue enable row level security;
revoke all on table public.shk_mail_config, public.shk_mail_queue from public, anon, authenticated;
revoke all on sequence public.shk_mail_queue_id_seq from public, anon, authenticated;

create or replace function public.shk_mail_get(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me record; c record;
begin
  select * into me from shk_auth(p_token);
  if me.grp not in ('sys', 'admin') then raise exception 'forbidden' using errcode = 'P0001'; end if;
  select * into c from shk_mail_config where id = 'main';
  return jsonb_build_object('enabled', coalesce(c.enabled, false), 'provider', coalesce(c.provider, 'gmail'), 'fromEmail', coalesce(c.from_email, ''), 'fromName', coalesce(c.from_name, ''),
    'smtpHost', coalesce(c.smtp_host, ''), 'smtpPort', coalesce(c.smtp_port, 465), 'smtpUser', coalesce(c.smtp_user, ''), 'hasSecret', coalesce(c.secret, '') <> '',
    'siteUrl', coalesce(c.site_url, ''), 'updatedAt', c.updated_at, 'updatedBy', c.updated_by,
    'pending', (select count(*) from shk_mail_queue where sent_at is null and attempts < 5),
    'failed', (select count(*) from shk_mail_queue where sent_at is null and attempts >= 5),
    'sent7', (select count(*) from shk_mail_queue where sent_at > now() - interval '7 days'),
    'recent', coalesce((select jsonb_agg(x order by (x->>'at') desc) from (select jsonb_build_object('at', created_at, 'kind', kind, 'to', to_email, 'sent', sent_at is not null, 'err', last_error) x
      from shk_mail_queue order by id desc limit 8) q), '[]'::jsonb));
end $$;

create or replace function public.shk_mail_set(p_token text, p_cfg jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me record; pv text := coalesce(p_cfg->>'provider', 'gmail');
begin
  select * into me from shk_auth(p_token);
  if me.grp not in ('sys', 'admin') then raise exception 'forbidden' using errcode = 'P0001'; end if;
  if pv not in ('gmail', 'smtp', 'resend') then raise exception 'bad_provider' using errcode = 'P0001'; end if;
  if coalesce(p_cfg->>'fromEmail', '') <> '' and p_cfg->>'fromEmail' !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'bad_email' using errcode = 'P0001'; end if;
  insert into shk_mail_config (id) values ('main') on conflict (id) do nothing;
  update shk_mail_config set
    enabled = coalesce((p_cfg->>'enabled')::boolean, false), provider = pv,
    from_email = left(trim(coalesce(p_cfg->>'fromEmail', '')), 160), from_name = left(trim(coalesce(p_cfg->>'fromName', '')), 120),
    smtp_host = left(trim(coalesce(p_cfg->>'smtpHost', '')), 160), smtp_port = coalesce(nullif(p_cfg->>'smtpPort', '')::int, 465),
    smtp_user = left(trim(coalesce(p_cfg->>'smtpUser', '')), 160),
    secret = case when coalesce(p_cfg->>'clearSecret', 'false') = 'true' then '' when coalesce(p_cfg->>'secret', '') <> '' then left(p_cfg->>'secret', 400) else secret end,
    site_url = left(trim(coalesce(p_cfg->>'siteUrl', '')), 300), updated_at = now(), updated_by = me.account_id
  where id = 'main';
  return jsonb_build_object('ok', true);
end $$;

-- إضافة رسالة لمقترح خارجي (داخلية): رابط متابعة جديد صالح يُرفق بكل رسالة
create or replace function public.shk_mail_enqueue_ext(p_pid text, p_kind text, p_status text, p_message text, p_track text default null) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare c record; d jsonb; tk text := p_track; em text;
begin
  select * into c from shk_mail_config where id = 'main';
  if c.id is null or not c.enabled then return false; end if;
  select data into d from shk_records where col = 'proposals' and id = p_pid and not deleted;
  if d is null or coalesce(d->>'external', '') <> 'true' then return false; end if;
  em := trim(coalesce(d->>'requesterEmail', d->>'contactEmail', ''));
  if em !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then return false; end if;
  if tk is null then
    tk := encode(extensions.gen_random_bytes(24), 'hex');
    insert into shk_ext_tracks (track_hash, proposal_id) values (shk_hash_token(tk), p_pid);
  end if;
  insert into shk_mail_queue (kind, to_email, payload) values (p_kind, em, jsonb_build_object(
    'ref', d->>'ref', 'partnerName', d->>'partnerName', 'requesterName', d->>'requesterName', 'status', p_status, 'message', left(coalesce(p_message, ''), 3000),
    'link', case when c.site_url <> '' then c.site_url || case when position('?' in c.site_url) > 0 then '&' else '?' end || 'track=' || tk else '' end,
    'org', (select data->'org'->>'name' from shk_records where col = 'settings' and id = 'main')));
  return true;
end $$;
revoke all on function public.shk_mail_enqueue_ext(text, text, text, text, text) from public, anon, authenticated;

-- من المنصة: بعد تغيير حالة مقترح خارجي برسالة مرئية للجهة
create or replace function public.shk_mail_ext_update(p_token text, p_proposal text, p_status text, p_message text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me record;
begin
  select * into me from shk_auth(p_token);
  if me.grp not in ('sys', 'admin', 'team') then raise exception 'forbidden' using errcode = 'P0001'; end if;
  if p_status not in ('submitted', 'review', 'info', 'accepted', 'converted', 'rejected') then return jsonb_build_object('queued', false); end if;
  return jsonb_build_object('queued', shk_mail_enqueue_ext(p_proposal, 'update', p_status, p_message));
end $$;

create or replace function public.shk_mail_test(p_token text, p_to text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me record; c record;
begin
  select * into me from shk_auth(p_token);
  if me.grp not in ('sys', 'admin') then raise exception 'forbidden' using errcode = 'P0001'; end if;
  if coalesce(p_to, '') !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'bad_email' using errcode = 'P0001'; end if;
  select * into c from shk_mail_config where id = 'main';
  if c.id is null or not c.enabled then return jsonb_build_object('error', 'disabled'); end if;
  insert into shk_mail_queue (kind, to_email, payload) values ('test', trim(p_to), jsonb_build_object('org', (select data->'org'->>'name' from shk_records where col = 'settings' and id = 'main'), 'link', c.site_url));
  return jsonb_build_object('ok', true);
end $$;

-- لدالة shk-mail فقط (بمفتاح الخدمة): حجز رسائل للإرسال ثم تسجيل النتيجة
create or replace function public.shk_mail_claim(p_n int default 10) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  with c as (select id from shk_mail_queue where sent_at is null and attempts < 5 and (claimed_at is null or claimed_at < now() - interval '2 minutes')
             order by id limit greatest(1, least(p_n, 20)) for update skip locked),
       u as (update shk_mail_queue q set claimed_at = now(), attempts = q.attempts + 1 from c where q.id = c.id returning q.id, q.kind, q.to_email, q.payload)
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'to', to_email, 'payload', payload) order by id), '[]'::jsonb) into r from u;
  return jsonb_build_object('items', r, 'config', (select jsonb_build_object('enabled', enabled, 'provider', provider, 'fromEmail', from_email, 'fromName', from_name,
    'smtpHost', smtp_host, 'smtpPort', smtp_port, 'smtpUser', smtp_user, 'secret', secret) from shk_mail_config where id = 'main'));
end $$;
create or replace function public.shk_mail_done(p_id bigint, p_error text) returns void
language sql security definer set search_path = public as $$
  update shk_mail_queue set sent_at = case when p_error is null then now() else null end, last_error = left(p_error, 500), claimed_at = null where id = p_id;
$$;
revoke all on function public.shk_mail_claim(int), public.shk_mail_done(bigint, text) from public, anon, authenticated;
grant execute on function public.shk_mail_claim(int), public.shk_mail_done(bigint, text) to service_role;

-- ===== إرسال المقترح (يحل محل نسخة external_proposals.sql) =====
create or replace function public.shk_ext_submit(p_invite text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare i record; pid text; tk text; ref text; n int; rec jsonb; t text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  k text; f jsonb := '{}'::jsonb; own text; keys text[] := array['partnerName','partnerSector','about','requesterName','requesterTitle','requesterEmail','contactName','contactEmail','contactPhone','targets','addedValue','duration','notes'];
begin
  select * into i from shk_invites where token_hash = shk_hash_token(p_invite) for update;
  if i.id is null or i.revoked or i.expires_at <= now() or i.uses >= i.max_uses then return jsonb_build_object('error', 'invalid'); end if;
  if coalesce(p_data->>'website', '') <> '' then return jsonb_build_object('error', 'missing'); end if; -- حقل فخ للبرامج الآلية
  if coalesce(trim(p_data->>'partnerName'), '') = '' or coalesce(trim(p_data->>'requesterName'), '') = '' or coalesce(trim(p_data->>'targets'), '') = ''
     or coalesce(trim(p_data->>'requesterEmail'), '') !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    return jsonb_build_object('error', 'missing');
  end if;
  if i.kind = 'public' then
    if (select count(*) from shk_records where col = 'proposals' and data->>'extInvite' = i.id and updated_at > now() - interval '1 day') >= 100 then return jsonb_build_object('error', 'busy'); end if;
    own := 'ext-inv:' || i.id || ':' || coalesce(p_data->>'_nonce', 'x');
  else
    own := 'ext-inv:' || i.id;
    keys := keys || array['strategicGoal', 'initiative'];
  end if;
  foreach k in array keys loop
    if p_data ? k then f := f || jsonb_build_object(k, left(coalesce(p_data->>k, ''), 4000)); end if;
  end loop;
  pid := 'pr-ext-' || encode(extensions.gen_random_bytes(6), 'hex');
  tk := encode(extensions.gen_random_bytes(24), 'hex');
  select count(*) + 1 into n from shk_records where col = 'proposals' and data->>'external' = 'true';
  ref := 'EXT-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
  rec := f || jsonb_build_object('id', pid, 'ref', ref, 'status', 'submitted', 'external', true, 'extInvite', i.id, 'extKind', i.kind, 'extLabel', i.label,
    'department', 'جهة خارجية', 'createdAt', t, 'submittedAt', t, 'updatedAt', t, 'createdByRole', 'external', 'demo', false, 'partnershipId', null, 'attachments', shk_ext_atts(p_data->'files', own, t),
    'events', jsonb_build_array(jsonb_build_object('id', 'ev-' || encode(extensions.gen_random_bytes(4), 'hex'), 'at', t, 'by', coalesce(f->>'requesterName', 'جهة خارجية'), 'role', 'external', 'type', 'submitted',
      'message', case when i.kind = 'public' then 'قُدّم المقترح عبر الرابط العام' else 'قُدّم المقترح عبر رابط الدعوة الخارجي' end)));
  insert into shk_records (col, id, data, deleted, rev, updated_at, updated_by) values ('proposals', pid, rec, false, nextval('shk_rev_seq'), now(), 'external:' || i.id);
  insert into shk_ext_tracks (track_hash, proposal_id) values (shk_hash_token(tk), pid);
  update shk_invites set uses = uses + 1 where id = i.id;
  perform shk_ext_notify('مقترح شراكة من جهة خارجية ' || ref, (case when i.kind = 'public' then 'الرابط العام — ' else 'جهة خارجية — ' end) || (f->>'partnerName'), '#/proposals/' || pid, 'send', coalesce(f->>'requesterName', 'جهة خارجية'));
  perform shk_mail_enqueue_ext(pid, 'received', 'submitted', '', tk);
  return jsonb_build_object('ref', ref, 'track', tk, 'mailed', exists (select 1 from shk_mail_config where id = 'main' and enabled));
end $$;

grant execute on function public.shk_invite_create(text, text, text, int, text), public.shk_invite_list(text), public.shk_invite_check(text),
  public.shk_ext_submit(text, jsonb), public.shk_ext_file_put(text, text, jsonb, text, text),
  public.shk_mail_get(text), public.shk_mail_set(text, jsonb), public.shk_mail_ext_update(text, text, text, text), public.shk_mail_test(text, text) to anon, authenticated;
