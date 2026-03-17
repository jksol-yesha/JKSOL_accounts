# Database Index Inventory

This document lists the indexes currently defined in the backend schema.

Primary source of truth:
- [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts)

Manual tables outside the main Drizzle schema:
- [manual_migration.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/manual_migration.ts)
- [manual_create_otps.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/manual_create_otps.ts)

## Notes

- `uniqueIndex(...)` means a unique index / unique key.
- Primary keys are not repeated below unless they are relevant to a manual table note.
- This doc reflects the current schema definitions, not every historical migration that created and later dropped an index.

## users

- `uk_user_email` on `(email)`
- `idx_user_role_id` on `(role_id)`

Source: [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts#L29)

## roles

- `uk_role_name` on `(name)`

Source: [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts#L39)

## refresh_tokens

- `uk_refresh_token` on `(token)`

Source: [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts#L51)

## organizations

- `idx_org_name` on `(name)`

Source: [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts#L67)

## transaction_types

- `uk_txn_type_name` on `(name)`

Source: [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts#L89)

## branches

- `uk_branch_org_code` on `(org_id, code)`
- `idx_branch_org` on `(org_id)`

Source: [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts#L107)

## accounts

- `uk_acc_branch_name` on `(branch_id, name)`
- `idx_acc_org_branch` on `(org_id, branch_id)`
- `idx_acc_org_created` on `(org_id, created_at)`
- `idx_acc_org_status_created` on `(org_id, status, created_at)`
- `idx_acc_type` on `(account_type)`
- `idx_acc_subtype` on `(subtype)`

Source: [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts#L136)

## categories

- `uk_cat_org_type_name` on `(org_id, branch_id, txn_type_id, name)`
- `idx_cat_org_type` on `(org_id, txn_type_id)`
- `idx_cat_branch` on `(branch_id)`

Source: [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts#L178)

## sub_categories

- `uk_subcat_cat_name` on `(category_id, name)`
- `idx_subcat_cat` on `(category_id)`

Source: [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts#L192)

## financial_years

- `uk_fy_org_name` on `(org_id, name)`

Source: [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts#L227)

## transactions

- `idx_tx_org_branch_date` on `(org_id, branch_id, txn_date)`
- `idx_tx_org_fy_branch` on `(org_id, financial_year_id, branch_id)`
- `idx_tx_org_fy_date_created` on `(org_id, financial_year_id, txn_date, created_at)`
- `idx_tx_org_fy_branch_date_created` on `(org_id, financial_year_id, branch_id, txn_date, created_at)`
- `idx_tx_org_status_date` on `(org_id, status, txn_date)`
- `idx_tx_contact_id` on `(contact_id)`

Source: [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts#L278)

## parties

- `idx_party_org_branch` on `(org_id, branch_id)`

Source: [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts#L304)

## transaction_entries

- `idx_tx_ent_tx_id` on `(transaction_id)`
- `idx_tx_ent_acc_id` on `(account_id)`
- `idx_tx_ent_tx_acc_id` on `(transaction_id, account_id)`

Source: [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts#L334)

## monthly_branch_summary

- `uk_mbs_org_branch_date` on `(org_id, branch_id, year_month, currency_code)`
- `idx_mbs_fy` on `(financial_year_id)`

Source: [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts#L361)

## yearly_branch_summary

- `uk_ybs_org_branch_fy` on `(org_id, branch_id, financial_year_id, currency_code)`

Source: [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts#L386)

## exchange_rates

- `uk_fx_org_date_pair` on `(org_id, rate_date, from_currency, to_currency)`
- `idx_fx_org_date` on `(org_id, rate_date)`

Source: [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts#L400)

## audit_logs

- `idx_audit_org_entity` on `(org_id, entity, entity_id)`
- `idx_audit_org_time` on `(org_id, action_at)`

Source: [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts#L469)

## organization_invitations

- `uk_inv_email_org_status` on `(email, org_id, status)`
- `idx_inv_email_str` on `(email)`
- `idx_inv_org` on `(org_id)`

Source: [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts#L500)

## currencies

- `uk_currency_code` on `(code)`

Source: [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts#L527)

## countries

- No secondary indexes defined in the current schema.

Source: [schema.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/schema.ts)

## Manual Tables

### user_branch_roles

Defined outside the main Drizzle schema in the manual migration.

- `uk_user_branch` on `(user_id, branch_id)`
- `idx_ubr_org` on `(org_id)`

Source: [manual_migration.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/manual_migration.ts#L20)

### otps

Created manually.

- `idx_otp_email` on `(email)`

Source: [manual_create_otps.ts](/Users/erasoft/Desktop/Dashboard%205%2027%207%204%202%202%207%208%2014%206%203%203%205/Auth_api%202/src/db/manual_create_otps.ts#L14)
