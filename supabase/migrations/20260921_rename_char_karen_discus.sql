-- Rename the achievement-only shop character from Карен to DISCUS.
-- Display name only; item id stays char_karen.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

update club_private.shop_catalog
set
  name = 'DISCUS',
  revision = revision + 1
where id = 'char_karen'
  and name is distinct from 'DISCUS';

commit;
