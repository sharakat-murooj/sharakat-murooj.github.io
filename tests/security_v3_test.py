"""اختبار حدود الصلاحيات على الخادم (security_v3.sql) مباشرة على Postgres المحلي.
يتطلب: Postgres محلي عليه schema.sql + security_hardening.sql + external_links_v2.sql + security_v3.sql
(PGHOST/PGPORT أو SHK_PG). لا يعتمد على المتصفح: يحاكي مهاجمًا يستدعي الدوال مباشرة."""
import json, os, sys
import psycopg2

H = os.environ.get('SHK_PG', '/var/lib/postgresql/shk')
c = psycopg2.connect(host=H, port=54329, user='postgres', dbname='postgres'); c.autocommit = True
cur = c.cursor()
ok = fail = 0
def check(name, cond):
    global ok, fail
    print(('PASS ' if cond else 'FAIL ') + name); ok += bool(cond); fail += (not cond)
def q(sql, *a):
    cur.execute(sql, a); return cur.fetchone()[0] if cur.description else None
def sess(acc, grp):
    tk = 'tk-' + acc.replace(':', '-')
    q("insert into shk_sessions (token_hash, account_id, grp, expires_at) values (shk_hash_token(%s), %s, %s, now() + interval '1 hour') on conflict (token_hash) do nothing", tk, acc, grp)
    return tk
def push(tk, rows):
    try: return q("select shk_push(%s, %s::jsonb)", tk, json.dumps(rows))
    except psycopg2.Error as e: return 'ERR:' + str(e).split('\n')[0]
def rec(col, id_):
    cur.execute("select data, deleted from shk_records where col=%s and id=%s", (col, id_)); return cur.fetchone()

# بيانات أولية بصلاحية الإدارة
adm = sess('admin', 'admin'); team = sess('team:t1', 'team'); dept = sess('dept:الإدارة أ', 'dept'); share = sess('share:sx', 'viewer')
q("select shk_push(%s, %s::jsonb)", adm, json.dumps([
    {'col': 'partnerships', 'id': 'sv3-p', 'data': {'id': 'sv3-p', 'code': 'PT-T', 'title': 'أصلية', 'wf': {}, 'attachments': []}},
    {'col': 'proposals', 'id': 'sv3-x1', 'data': {'id': 'sv3-x1', 'department': 'الإدارة أ', 'status': 'submitted', 'title': 'لي'}},
    {'col': 'proposals', 'id': 'sv3-x2', 'data': {'id': 'sv3-x2', 'department': 'الإدارة ب', 'status': 'submitted', 'title': 'لغيري'}},
    {'col': 'audit', 'id': 'sv3-a', 'data': {'id': 'sv3-a', 'action': 'x'}},
    {'col': 'partners', 'id': 'sv3-pr', 'data': {'id': 'sv3-pr', 'name': 'جهة'}}]))
sett = rec('settings', 'main')[0] or {}
lists0 = json.dumps(sett.get('lists'), sort_keys=True)

# 1) الإدارة لا تضيف حسابات عبر القوائم ولا تغيّر بيانات الجهة، لكن تنبيهاتها تُحفظ
bad = dict(sett); bad['lists'] = {**(sett.get('lists') or {}), 'departments': ['مخترق']}; bad['org'] = {'name': 'X'}; bad['notifs'] = [{'id': 'n-sv3'}]
push(dept, [{'col': 'settings', 'id': 'main', 'data': bad}])
s2 = rec('settings', 'main')[0]
check('dept cannot change lists (no new accounts)', json.dumps(s2.get('lists'), sort_keys=True) == lists0)
check('dept cannot change org', s2.get('org') == sett.get('org'))
check('dept notifications still saved', any(n.get('id') == 'n-sv3' for n in s2.get('notifs') or []))
check('injected dept account not known', q("select shk_account_known('dept:مخترق')") is False)
# 2) الفريق: لا قوائم، ويحفظ غيرها
bad2 = dict(s2); bad2['lists'] = {'team': ['دخيل']}; bad2['homeNote'] = 'sv3'
push(team, [{'col': 'settings', 'id': 'main', 'data': bad2}])
s3 = rec('settings', 'main')[0]
check('team cannot change lists', json.dumps(s3.get('lists'), sort_keys=True) == lists0)
check('team other settings saved', s3.get('homeNote') == 'sv3')
check('team cannot delete settings', (push(team, [{'col': 'settings', 'id': 'main', 'deleted': True}]) or {}) and rec('settings', 'main')[1] is False)
# 3) سجل التغييرات
push(team, [{'col': 'audit', 'id': 'sv3-a', 'data': {'id': 'sv3-a', 'action': 'محرّف'}}]); push(dept, [{'col': 'audit', 'id': 'sv3-a', 'deleted': True}])
check('audit cannot be rewritten or deleted by non-admin', rec('audit', 'sv3-a') == ({'id': 'sv3-a', 'action': 'x'}, False))
push(dept, [{'col': 'audit', 'id': 'sv3-a2', 'data': {'id': 'sv3-a2', 'action': 'new'}}])
check('dept can append audit', rec('audit', 'sv3-a2') is not None)
# 4) الإدارة والشراكات
push(dept, [{'col': 'partnerships', 'id': 'sv3-p', 'data': {'id': 'sv3-p', 'code': 'PT-T', 'title': 'محرّفة', 'wf': {'steps': {'x': 1}}, 'attachments': [{'id': 'a1'}]}}])
d = rec('partnerships', 'sv3-p')[0]
check('dept cannot change partnership fields', d['title'] == 'أصلية')
check('dept workflow step + attachment saved', d['wf'] == {'steps': {'x': 1}} and d['attachments'] == [{'id': 'a1'}])
push(dept, [{'col': 'partnerships', 'id': 'sv3-p', 'deleted': True}, {'col': 'partnerships', 'id': 'sv3-new', 'data': {'id': 'sv3-new'}}])
check('dept cannot delete or create partnerships', rec('partnerships', 'sv3-p')[1] is False and rec('partnerships', 'sv3-new') is None)
push(team, [{'col': 'partnerships', 'id': 'sv3-p', 'deleted': True}])
check('team cannot delete partnerships', rec('partnerships', 'sv3-p')[1] is False)
push(team, [{'col': 'partnerships', 'id': 'sv3-p', 'data': {**d, 'title': 'عدّلها الفريق'}}])
check('team can edit partnerships', rec('partnerships', 'sv3-p')[0]['title'] == 'عدّلها الفريق')
push(dept, [{'col': 'partners', 'id': 'sv3-pr', 'data': {'id': 'sv3-pr', 'name': '<img src=x onerror=alert(1)>'}}])
check('dept cannot edit partners', rec('partners', 'sv3-pr')[0]['name'] == 'جهة')
# 5) المقترحات
push(dept, [{'col': 'proposals', 'id': 'sv3-x2', 'data': {'id': 'sv3-x2', 'department': 'الإدارة ب', 'status': 'accepted'}}])
check("dept cannot edit another department's proposal", rec('proposals', 'sv3-x2')[0]['status'] == 'submitted')
push(dept, [{'col': 'proposals', 'id': 'sv3-x1', 'data': {'id': 'sv3-x1', 'department': 'الإدارة أ', 'status': 'submitted', 'title': 'عدّلته'}}])
check('dept can edit own proposal', rec('proposals', 'sv3-x1')[0]['title'] == 'عدّلته')
push(dept, [{'col': 'proposals', 'id': 'sv3-x3', 'data': {'id': 'sv3-x3', 'department': 'الإدارة أ', 'status': 'draft'}}])
check('dept can create own proposal', rec('proposals', 'sv3-x3') is not None)
push(dept, [{'col': 'proposals', 'id': 'sv3-x4', 'data': {'id': 'sv3-x4', 'department': 'الإدارة ب', 'status': 'draft'}}])
check('dept cannot create proposal for another department', rec('proposals', 'sv3-x4') is None)
# 6) الملفات
q("select shk_file_put(%s, 'sv3-f-doc', '{\"type\":\"application/pdf\"}'::jsonb, 'ORIG')", adm)
q("select shk_file_put(%s, 'sv3-f-img', '{\"type\":\"image/png\"}'::jsonb, 'IMG')", adm)
q("insert into shk_file_chunks (id, n, data) values ('sv3-f-doc', 0, 'SECRET') on conflict do nothing")
q("select shk_file_put(%s, 'sv3-f-doc', '{}'::jsonb, 'HACKED')", team)
check('team cannot overwrite existing file', q("select data from shk_files where id='sv3-f-doc'") == 'ORIG')
q("select shk_file_chunk_put(%s, 'sv3-f-doc', 0, 'HACKED')", dept)
check('dept cannot overwrite chunks of existing file', q("select data from shk_file_chunks where id='sv3-f-doc' and n=0") == 'SECRET')
q("select shk_file_del(%s, 'sv3-f-doc')", team)
check('team cannot delete files', q("select count(*) from shk_files where id='sv3-f-doc'") == 1)
q("select shk_file_put(%s, 'sv3-f-new', '{}'::jsonb, 'NEW')", dept)
check('dept can upload new file', q("select count(*) from shk_files where id='sv3-f-new'") == 1)
# 7) روابط الاطلاع
ids = q("select shk_file_ids(%s)", share)
check('share link file list hides documents', 'sv3-f-doc' not in ids and 'sv3-f-img' in ids)
check('share link cannot read document chunks', q("select shk_file_chunk_get(%s, 'sv3-f-doc', 0)", share) is None)
check('team still reads chunks', q("select shk_file_chunk_get(%s, 'sv3-f-doc', 0)", team) == 'SECRET')
check('share link cannot push', str(push(share, [{'col': 'news', 'id': 'sv3-n', 'data': {}}])).startswith('ERR'))
# 8) الدخول: القفل لكل عنوان على حدة
def ip(x): q("select set_config('request.headers', %s, false)", json.dumps({'cf-connecting-ip': x}))
n0 = q("select count(*) from shk_login_fails_ip")
q("select shk_login(%s, 'x')", 'team:' + 'A' * 5000); q("select shk_login('team:غير-موجود', 'x')")
check('login with huge/unknown id adds no rows', q("select count(*) from shk_login_fails_ip") == n0)
q("delete from shk_login_fails_ip where account_id='viewer'")
ip('6.6.6.6')
for _ in range(5): q("select shk_login('viewer', 'wrong')")
check('5 wrong attempts lock the attacker address', (q("select shk_login('viewer', 'wrong')") or {}).get('error') == 'locked')
ip('10.0.0.7')
r = q("select shk_login('viewer', 'wrong')") or {}
check('owner on another address is NOT locked out', r.get('error') == 'bad_login')
vpw = json.load(open(os.environ['SHK_TEST_PW'])).get('viewer') if os.environ.get('SHK_TEST_PW') else None
if vpw:
    r = q("select shk_login('viewer', %s)", vpw) or {}
    check('owner logs in with the right password while attacker is locked', bool(r.get('token')))
    if r.get('token'): q("select shk_logout(%s)", r['token'])
ip('6.6.6.6')
q("update shk_login_fails_ip set locked_until = now() - interval '1 second' where account_id='viewer' and ip='6.6.6.6'")
q("select shk_login('viewer', 'wrong')")
check('one wrong attempt after lock expiry does not re-lock', q("select locked_until from shk_login_fails_ip where account_id='viewer' and ip='6.6.6.6'") is None)
q("insert into shk_login_fails_ip (account_id, ip, fails, last_at) select 'viewer', 'd' || g, 3, now() from generate_series(1, 100) g on conflict do nothing")
ip('10.0.0.8')
check('distributed attack (300+ fails/hour) triggers the global lock', (q("select shk_login('viewer', 'wrong')") or {}).get('error') == 'locked')
q("delete from shk_login_fails_ip where account_id='viewer'"); q("select set_config('request.headers', '', false)")

# 9) روابط الاطلاع: الأقسام على الخادم
q("insert into shk_shares (id, token_hash, sections, expires_at) values ('sv3s', 'h-sv3s', '[\"dashboard\",\"partnerships\"]', now() + interval '1 day') on conflict (id) do update set sections = excluded.sections")
shs = sess('share:sv3s', 'viewer')
q("select shk_push(%s, %s::jsonb)", adm, json.dumps([
    {'col': 'partnerships', 'id': 'sv3-q', 'data': {'id': 'sv3-q', 'title': 'ش', 'forms': {'mou': {'data': {'x': 'نص المذكرة'}}}, 'meetings': [{'t': 'اجتماع سري'}],
        'wf': {'steps': {'s1': {'status': 'done', 'by': 'فلان', 'note': 'ملاحظة داخلية', 'depts': {'إدارة': {'at': 't', 'by': 'ب', 'note': 'ن'}}}}}}},
    {'col': 'proposals', 'id': 'sv3-y', 'data': {'id': 'sv3-y', 'status': 'review', 'department': 'د', 'reasons': 'أسباب داخلية', 'events': [{'type': 'status', 'by': 'فلان', 'note': 'x', 'at': 't'}, {'type': 'note', 'vis': 'internal', 'at': 't'}]}},
    {'col': 'news', 'id': 'sv3-nw', 'data': {'id': 'sv3-nw', 't': 'خبر'}}]))
rows = {(r['col'], r['id']): r for r in q("select shk_pull(%s, 0)", shs)['rows']}
pq = rows[('partnerships', 'sv3-q')]['data']; st1 = pq['wf']['steps']['s1']
check('share: no forms (MOU texts) and no meetings', 'forms' not in pq and 'meetings' not in pq)
check('share: workflow keeps status, drops names and notes', st1.get('status') == 'done' and 'by' not in st1 and 'note' not in st1 and st1['depts']['إدارة'] == {'at': 't'})
py = rows[('proposals', 'sv3-y')]['data']
check('share: proposals without text, names or internal events', 'reasons' not in py and py['events'] == [{'type': 'status', 'at': 't'}])
check('share: news not sent when its sections are off', rows[('news', 'sv3-nw')]['deleted'] is True)
check('share: audit and notifications never sent', all(r['deleted'] for k, r in rows.items() if k[0] == 'audit') and 'notifs' not in (rows.get(('settings', 'main')) or {}).get('data', {}))
q("update shk_shares set sections='[\"calendar\"]' where id='sv3s'")
pq2 = {(r['col'], r['id']): r for r in q("select shk_pull(%s, 0)", shs)['rows']}[('partnerships', 'sv3-q')]['data']
check('share: meetings only with the calendar section', pq2.get('meetings') == [{'t': 'اجتماع سري'}])
q("update shk_shares set sections='[\"process\"]' where id='sv3s'")
check('share: process-only link gets no partnerships', {(r['col'], r['id']): r for r in q("select shk_pull(%s, 0)", shs)['rows']}[('partnerships', 'sv3-q')]['deleted'] is True)
check('normal account still gets full record', 'forms' in {(r['col'], r['id']): r for r in q("select shk_pull(%s, 0)", team)['rows']}[('partnerships', 'sv3-q')]['data'])
q("delete from shk_shares where id='sv3s'")

# 10) الرفع الخارجي: سقف المساحة وتنظيف اليتيم
q("insert into shk_invites (id, token_hash, kind, expires_at, max_uses) values ('sv3i', shk_hash_token('sv3-key'), 'private', now() + interval '1 day', 5) on conflict (id) do nothing")
big = 'A' * 6900000
res = [q("select shk_ext_file_put('sv3-key', %s, '{}'::jsonb, %s)", f'f-ext-sv3q{i:03d}', big).get('error') for i in range(10)]
check('per-link daily byte cap stops large uploads', 'busy' in res and res[0] is None)
q("insert into shk_files (id, meta, data, created_by, created_at) values ('f-ext-sv3old1', '{}', 'x', 'ext-inv:zz', now() - interval '5 days'), ('f-ext-sv3old2', '{}', 'x', 'ext-inv:zz', now() - interval '5 days')")
q("select shk_push(%s, %s::jsonb)", adm, json.dumps([{'col': 'proposals', 'id': 'sv3-z', 'data': {'id': 'sv3-z', 'attachments': [{'fileId': 'f-ext-sv3old2'}]}}]))
q("select shk_ext_file_put('sv3-key', 'f-ext-sv3tiny1', '{}'::jsonb, 'x')")
check('orphan external files older than 3 days are cleaned', q("select count(*) from shk_files where id='f-ext-sv3old1'") == 0)
check('attached external file is kept', q("select count(*) from shk_files where id='f-ext-sv3old2'") == 1)
q("delete from shk_files where id like 'f-ext-sv3%%'"); q("delete from shk_invites where id='sv3i'")

# تنظيف
q("delete from shk_records where id like 'sv3-%%'"); q("delete from shk_files where id like 'sv3-%%'"); q("delete from shk_file_chunks where id like 'sv3-%%'")
q("delete from shk_sessions where token_hash in (select shk_hash_token(x) from unnest(%s::text[]) x)", [adm, team, dept, share])
s4 = rec('settings', 'main')[0]; s4.pop('homeNote', None); s4['notifs'] = [n for n in s4.get('notifs') or [] if n.get('id') != 'n-sv3']
q("update shk_records set data=%s::jsonb where col='settings' and id='main'", json.dumps(s4))
print(f'SUMMARY {ok} / {ok + fail}')
sys.exit(1 if fail else 0)
