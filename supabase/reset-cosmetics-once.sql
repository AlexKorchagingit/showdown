-- One-shot club reset: 1500 rubies and only the free character/background.
-- Idempotent: rows that already contain cosmetics-reset-v2 are left alone.

alter table public.users
  alter column owned_items set default array['cosmetics-reset-v2', 'char_base', 'bg_base']::text[];

update public.users
set
  ruby_balance = 1500,
  owned_items = array['cosmetics-reset-v2', 'char_base', 'bg_base']::text[],
  equipped_char = 'char_base',
  equipped_bg = 'bg_base',
  equipped_avatar = array['/showdown/avatars/default_cat.png', 'char_base', 'bg_base']::text[],
  pending_notifications = '[]'::jsonb
where not ('cosmetics-reset-v2' = any (owned_items));
