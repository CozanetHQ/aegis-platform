-- 001_fix_primary_wallet_flag.sql
-- Data backfill for the isPrimary bug fixed in wallet-vault-use-cases.ts
-- (generateWalletsForIdentity previously set isPrimary: true for every
-- blockchain). Confirmed live: all 9 existing wallet rows across 3
-- identities had is_primary = true. This sets exactly one primary wallet
-- per aegis_id (ETHEREUM, matching PRIMARY_BLOCKCHAIN in wallet-entity.ts).
--
-- NOTE: this repo has no prior tracked schema migrations (the wallets /
-- vault_keys / wallet_states tables predate this file) — flagged as a
-- separate gap, not addressed here.

update wallets
set is_primary = (blockchain = 'ETHEREUM');
