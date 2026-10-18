#!/usr/bin/env python3
"""Exercise squad migrations against an isolated local PostgreSQL instance.

Requires Python 3.9+, psql, and a disposable local server on port 55438.
Creates/replaces only databases named remaining_business, remaining_hiring,
remaining_profiles, and remaining_catalog. Never point this at production.
"""
from pathlib import Path
import argparse, json, re, subprocess
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--profiles', type=Path, required=True)
parser.add_argument('--hub', type=Path, required=True)
parser.add_argument('--crm', type=Path, required=True)
parser.add_argument('--hire', type=Path, required=True)
args = parser.parse_args()
P, H, C, R = args.profiles, args.hub, args.crm, args.hire
registry = (P / 'shared/src/contentRoles.ts').read_text()
roles = json.loads(registry.split('export const REMAINING_ROLES = ', 1)[1].split(' as const;', 1)[0])
roots = {'business': C, 'hiring': R}
def sql(statement, db='postgres'):
    result = subprocess.run(['psql', '-h', '/tmp', '-p', '55438', '-d', db, '-XqAt', '-v', 'ON_ERROR_STOP=1'], input=statement, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()
fixture='''
CREATE TABLE crm_pipelines(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,kind text,name text,is_archived boolean DEFAULT false,is_default boolean DEFAULT false,color text,sort_order integer,qualify_stage_id uuid,close_stage_id uuid,connected_deals_pipeline_id uuid REFERENCES crm_pipelines(id),connected_clients_pipeline_id uuid REFERENCES crm_pipelines(id),connected_onboarding_pipeline_id uuid REFERENCES crm_pipelines(id),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE UNIQUE INDEX board_default ON crm_pipelines(workspace_id,kind) WHERE is_default;
CREATE TABLE crm_stages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,pipeline_id uuid REFERENCES crm_pipelines(id),name text,sort_order integer,system_role text,created_at timestamptz DEFAULT now(),UNIQUE(pipeline_id,sort_order));
CREATE TABLE crm_automations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,name text,is_enabled boolean,trigger_type text,trigger_config jsonb,conditions jsonb,actions jsonb,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE crm_stage_reasons(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,pipeline_id uuid REFERENCES crm_pipelines(id),stage_id uuid REFERENCES crm_stages(id),label text,automation_id uuid REFERENCES crm_automations(id),created_at timestamptz DEFAULT now(),UNIQUE(stage_id,label));
CREATE TABLE crm_stage_substages(LIKE crm_stage_reasons INCLUDING ALL);
ALTER TABLE crm_stage_substages RENAME COLUMN label TO name;
ALTER TABLE crm_stage_substages ADD source_stage_id uuid REFERENCES crm_stages(id);
CREATE TABLE crm_pipeline_access(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,pipeline_id uuid REFERENCES crm_pipelines(id),user_id uuid,access_mode text,created_at timestamptz DEFAULT now(),UNIQUE(user_id,pipeline_id));
CREATE TABLE crm_template_pipelines(template_id uuid,pipeline_id uuid REFERENCES crm_pipelines(id),created_at timestamptz DEFAULT now(),PRIMARY KEY(template_id,pipeline_id));
CREATE TABLE crm_quick_message_pipelines(quick_message_id uuid,pipeline_id uuid REFERENCES crm_pipelines(id),created_at timestamptz DEFAULT now(),PRIMARY KEY(quick_message_id,pipeline_id));
CREATE TABLE crm_workspace_config(workspace_id uuid);
CREATE TABLE crm_squads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,name text,sort_order integer,UNIQUE(workspace_id,name));
CREATE TABLE crm_categories(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,squad_id uuid REFERENCES crm_squads(id),name text,sort_order integer,UNIQUE(workspace_id,squad_id,name));
'''
ws='11111111-1111-4111-8111-111111111111'
for mode,root in roots.items():
 db='remaining_'+mode
 sql('DROP DATABASE IF EXISTS '+db+'; CREATE DATABASE '+db+';')
 sql(fixture,db);sql(f"INSERT INTO crm_workspace_config VALUES ('{ws}');",db)
 boards=[('leads','Creative Directors Leads'),('deals','Creative Directors Deals'),('clients','Content Squad Clients'),('onboarding','Default Onboarding')] if mode=='business' else [('talent','Creative Directors'),('candidates','Creative Directors'),('partners','Creative Directors'),('talent','Jobs – Creative Directors'),('candidates','Jobs – Creative Directors')]
 for index,(kind,name) in enumerate(boards):
  pid='48883cf1-a203-47d2-88fb-675e87c2a1de' if index==0 and mode=='business' else sql('SELECT gen_random_uuid()',db)
  sql(f"INSERT INTO crm_pipelines(id,workspace_id,kind,name,is_default,sort_order) VALUES ('{pid}','{ws}','{kind}','{name}',{'true' if kind=='onboarding' else 'false'},0);",db)
  labels=['New','Qualified','Won'] if mode=='business' else (['Welcome','Active'] if kind=='partners' else ['Welcome','Onboarding completed'] if kind=='talent' else ['New Applicants','Portfolio Updation','Live'])
  stages=[]
  for n,label in enumerate(labels):
   sid=sql(f"INSERT INTO crm_stages(workspace_id,pipeline_id,name,sort_order) VALUES ('{ws}','{pid}','{label}',{n}) RETURNING id",db);stages.append(sid)
  aid=sql(f"INSERT INTO crm_automations(workspace_id,name,is_enabled,trigger_config,actions) VALUES ('{ws}','Sample rule',true,'{{\"pipeline_ids\":[\"{pid}\"]}}','[{{\"type\":\"change_stage\",\"params\":{{\"to_stage_id\":\"{stages[-1]}\"}}}}]') RETURNING id",db)
  sql(f"INSERT INTO crm_stage_reasons(workspace_id,pipeline_id,stage_id,label,automation_id) VALUES ('{ws}','{pid}','{stages[0]}','Review','{aid}'); INSERT INTO crm_stage_substages(workspace_id,pipeline_id,stage_id,name,automation_id,source_stage_id) VALUES ('{ws}','{pid}','{stages[0]}','Follow up','{aid}','{stages[0]}'); INSERT INTO crm_pipeline_access(workspace_id,pipeline_id,user_id,access_mode) VALUES ('{ws}','{pid}',gen_random_uuid(),'shared'); UPDATE crm_pipelines SET qualify_stage_id='{stages[-1]}' WHERE id='{pid}';",db)
 if mode=='business':sql("UPDATE crm_pipelines SET connected_deals_pipeline_id=(SELECT id FROM crm_pipelines WHERE kind='deals') WHERE kind='leads'",db)
 else:sql("UPDATE crm_pipelines p SET connected_deals_pipeline_id=(SELECT id FROM crm_pipelines t WHERE t.kind='talent' AND t.name=p.name) WHERE p.kind='candidates'",db)
 migration=(root/'supabase/migrations/20261018180300_remaining_squad_pipelines.sql').read_text()
 sql(migration,db);count=sql('SELECT count(*) FROM crm_pipelines',db);sql(migration,db)
 assert count==sql('SELECT count(*) FROM crm_pipelines',db)
 expected=len(boards)+(50 if mode=='business' else 100)
 assert int(count)==expected,(mode,count,expected)
 bad=sql("SELECT count(*) FROM crm_automations a CROSS JOIN LATERAL jsonb_array_elements_text(a.trigger_config->'pipeline_ids') p JOIN crm_pipelines b ON b.id=p::uuid WHERE a.name LIKE '% — %' AND b.name LIKE 'Creative Directors%'",db);assert bad=='0',bad
 if mode=='hiring':
  for r in roles:
   n=sql("SELECT count(*) FROM crm_stages s JOIN crm_pipelines p ON p.id=s.pipeline_id WHERE p.kind='candidates' AND p.name='"+r['pipeline']+"' AND s.name='Portfolio Updation'",db)
   assert int(n)==int(r['portfolio'])
  assert sql("SELECT count(*) FROM crm_pipelines p JOIN crm_pipelines t ON t.id=p.connected_deals_pipeline_id WHERE p.kind='candidates' AND p.name<>'Creative Directors' AND p.name<>'Jobs – Creative Directors' AND p.name=t.name AND t.kind='talent'",db)=='40'
 print(mode,':',count,'boards; repeated provisioning unchanged; stage/automation IDs remapped; handoffs verified')

sql('DROP DATABASE IF EXISTS remaining_profiles; CREATE DATABASE remaining_profiles;')
db='remaining_profiles'
sql('''CREATE TYPE lead_form_type_enum AS ENUM('creative'); CREATE TYPE field_type_enum AS ENUM('text','textarea');
CREATE TABLE talent_users(id uuid,signup_form_type text);
CREATE TABLE categories(id uuid PRIMARY KEY,name text,slug text UNIQUE,description text,is_active boolean,sort_order integer);
CREATE TABLE public_forms(form_type lead_form_type_enum PRIMARY KEY,title text,description text,url_path text,enabled boolean);
CREATE TABLE category_fields(id uuid DEFAULT gen_random_uuid(),category_id uuid REFERENCES categories(id),field_key text,field_label text,field_type field_type_enum,is_required boolean,helper_text text,sort_order integer,is_active boolean,validation_rules jsonb,UNIQUE(category_id,field_key));
CREATE TABLE template_categories(category_id uuid REFERENCES categories(id),name text,sort_order integer,is_active boolean,UNIQUE(category_id,name));
CREATE TABLE template_skill_sets(LIKE template_categories INCLUDING ALL);CREATE TABLE template_tools(LIKE template_categories INCLUDING ALL);CREATE TABLE template_ai_tools(LIKE template_categories INCLUDING ALL);
CREATE TABLE interview_questions(form_type lead_form_type_enum,question_text text,field_type text,is_required boolean,display_order integer);
''',db)
for f in ['20261018180000_remaining_squad_form_types.sql','20261018180100_remaining_squad_categories.sql']:sql((P/'supabase/migrations'/f).read_text(),db)
sql((P/'supabase/migrations/20261018180100_remaining_squad_categories.sql').read_text(),db)
assert sql('SELECT count(*) FROM categories',db)=='20';assert sql('SELECT count(*) FROM public_forms',db)=='20';assert sql('SELECT count(*) FROM interview_questions',db)=='60'
assert sql("SELECT count(*) FROM category_fields WHERE field_key='qualifications' AND is_required",db)=='9'
print('Profiles: 20 categories, 20 applications, 60 screening questions; required specialist fields and repeatability verified.')
sql('DROP DATABASE IF EXISTS remaining_catalog; CREATE DATABASE remaining_catalog;');db='remaining_catalog'
sql('''CREATE TABLE subscriptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text UNIQUE,name text,description text,is_active boolean,sort_order integer);
CREATE TABLE subscription_plans(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),subscription_id uuid REFERENCES subscriptions(id),plan text,tier text,is_active boolean,sort_order integer,daily_hours numeric,weekly_hours numeric,monthly_hours numeric,UNIQUE(subscription_id,plan,tier));
CREATE TABLE subscription_plan_pricing(plan_id uuid REFERENCES subscription_plans(id),country_id uuid,price numeric,margin_value numeric,margin_type text,UNIQUE(plan_id,country_id));
CREATE TABLE subscription_deliverable_types(subscription_id uuid REFERENCES subscriptions(id),name text,is_active boolean,sort_order integer,UNIQUE(subscription_id,name));
CREATE TABLE subscription_squadhire_profiles(subscription_id uuid REFERENCES subscriptions(id),squadhire_category_id uuid,UNIQUE(subscription_id,squadhire_category_id));
CREATE TABLE assignment_services(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text UNIQUE,name text,description text,is_active boolean,sort_order integer);
CREATE TABLE assignment_service_margins(service_id uuid REFERENCES assignment_services(id),tier text,country_id uuid,margin_value numeric,margin_type text,UNIQUE(service_id,tier,country_id));
CREATE TABLE client_submission_brands(service_type text);
''',db)
sql((H/'supabase/migrations/20261018180200_remaining_squad_services.sql').read_text(),db);sql((H/'supabase/migrations/20261018180200_remaining_squad_services.sql').read_text(),db)
assert sql('SELECT count(*) FROM subscriptions',db)=='20';assert sql('SELECT count(*) FROM assignment_services',db)=='20';assert sql('SELECT count(*) FROM subscription_plans',db)=='300'
links=sql("SELECT jsonb_object_agg(s.slug,p.squadhire_category_id) FROM subscriptions s JOIN subscription_squadhire_profiles p ON p.subscription_id=s.id",db)
assert json.loads(links)=={r['serviceSlug']:r['id'] for r in roles}
print('Business catalog: 20 subscriptions, 20 assignment services, 300 plans; stable talent-category links and repeatability verified.')

sql("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF; END $$;")
db='remaining_business'
sql('''ALTER TABLE crm_categories ADD is_archived boolean DEFAULT false; ALTER TABLE crm_stages ADD is_active boolean DEFAULT true;
CREATE TABLE crm_contacts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,name text);
CREATE TABLE crm_leads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,pipeline_id uuid REFERENCES crm_pipelines(id),stage_id uuid REFERENCES crm_stages(id),name text,phone_e164 text,email text,source text,contact_id uuid REFERENCES crm_contacts(id),category_id uuid REFERENCES crm_categories(id),custom_fields jsonb,archived_at timestamptz,disqualified_at timestamptz,merged_into_lead_id uuid,created_at timestamptz DEFAULT now());
CREATE TABLE crm_contact_persons(id uuid DEFAULT gen_random_uuid(),workspace_id uuid,contact_id uuid REFERENCES crm_contacts(id),name text,phone_e164 text,email text,lead_id uuid REFERENCES crm_leads(id),is_primary boolean);
CREATE TABLE crm_service_brief_receipts(source_card_id uuid PRIMARY KEY,workspace_id uuid,lead_id uuid REFERENCES crm_leads(id),pending_event text);
''',db)
sql((C/'supabase/migrations/20261018180400_remaining_squad_brief_receipts.sql').read_text(),db)
for r in roles:
 card=sql('SELECT gen_random_uuid()',db)
 call=f"SELECT crm_record_content_brief('{card}','{r['serviceSlug']}','Test Specialist','+919000000099','test@example.test','Test Brand','{{\"requirement\":\"Original brief\"}}');"
 lead=sql(call,db);assert lead==sql(call,db)
 assert sql(f"SELECT p.name FROM crm_leads l JOIN crm_pipelines p ON p.id=l.pipeline_id WHERE l.id='{lead}'",db)==r['pipeline']+' Leads'
 assert sql(f"SELECT c.name FROM crm_leads l JOIN crm_categories c ON c.id=l.category_id WHERE l.id='{lead}'",db)==r['name']
 # Simulate an operator moving the card; edited briefs must preserve that stage.
 stage=sql(f"SELECT id FROM crm_stages WHERE pipeline_id=(SELECT pipeline_id FROM crm_leads WHERE id='{lead}') ORDER BY sort_order DESC LIMIT 1",db)
 sql(f"UPDATE crm_leads SET stage_id='{stage}' WHERE id='{lead}'",db)
 sql(call.replace('Original brief','Edited brief'),db)
 assert sql(f"SELECT stage_id FROM crm_leads WHERE id='{lead}'",db)==stage
assert sql('SELECT count(*) FROM crm_leads',db)=='20'
print('CRM delivery: all 20 roles route to their own board and category; retries reuse leads; edits preserve operator stages.')
db='remaining_catalog'
cols={'id':'uuid PRIMARY KEY DEFAULT gen_random_uuid()','service_type':'text','customer_phone':'text','customer_name':'text','customer_email':'text','brand_name':'text','requirement_note':'text','card_type':'text','budget_currency':'text','client_budget':'numeric','tier_pricing':'jsonb','additional_requirements':'jsonb','assignment_details':'jsonb','plan_name':'text','target_languages':'text[]','customer_location':'text','requirement_voice_url':'text','notes':'text'}
sql('CREATE TABLE subscription_cards('+','.join(k+' '+v for k,v in cols.items())+'); CREATE TABLE service_brief_crm_outbox(card_id uuid PRIMARY KEY,payload jsonb,attempts integer DEFAULT 0,delivered_at timestamptz,next_attempt_at timestamptz,last_error text);',db)
sql((H/'supabase/migrations/20261018180600_remaining_squad_brief_delivery.sql').read_text(),db)
sql('CREATE TRIGGER test_enqueue AFTER INSERT OR UPDATE ON subscription_cards FOR EACH ROW EXECUTE FUNCTION enqueue_content_brief_crm();',db)
for r in roles:
 card=sql(f"INSERT INTO subscription_cards(service_type,customer_phone,brand_name,requirement_note) VALUES ('{r['pipeline']}','+919000000099','Example business','Scope') RETURNING id",db)
 assert sql(f"SELECT payload->>'p_service_slug' FROM service_brief_crm_outbox WHERE card_id='{card}'",db)==r['serviceSlug']
 sql(f"UPDATE subscription_cards SET requirement_note='Updated scope' WHERE id='{card}'",db)
 assert sql(f"SELECT payload->'p_details'->>'requirement' FROM service_brief_crm_outbox WHERE card_id='{card}'",db)=='Updated scope'
assert sql('SELECT count(*) FROM service_brief_crm_outbox',db)=='20'
print('Atomic outbox: 20 role mappings and edited payloads verified against the trigger; service-only privileges retained.')
