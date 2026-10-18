-- Keep historical explicit-consent timestamps unchanged. New sessions record
-- notice display separately and do not claim a checkbox was accepted.
begin;
alter table public.conversations alter column consent_at drop not null;
alter table public.conversations add column if not exists data_collection_notice_at timestamptz;
comment on column public.conversations.consent_at is 'Historical explicit checkbox consent only; null for sessions created without a checkbox.';
comment on column public.conversations.data_collection_notice_at is 'When the app recorded the displayed learning-analysis notice for a new session.';
commit;
