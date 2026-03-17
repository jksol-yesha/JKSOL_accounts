import { mysqlTable, bigint, int, varchar, datetime, timestamp, mysqlEnum, uniqueIndex, text, char, index, decimal, date, boolean, longtext, json, primaryKey } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const users = mysqlTable("users", {
  id: bigint("id", { mode: "number", unsigned: true }).primaryKey().autoincrement(),
  fullName: varchar("full_name", { length: 150 }),
  email: varchar("email", { length: 190 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  status: int("status").notNull().default(1),
  roleId: bigint("role_id", { mode: "number", unsigned: true }).references(() => roles.id), // NEW: Role ID
  orgIds: text("org_ids"), // Comma-separated org IDs
  branchIds: text("branch_ids"), // Comma-separated branch IDs
  lastLoginAt: datetime("last_login_at"),
  verificationToken: varchar("verification_token", { length: 255 }),
  // Preserving legacy columns to avoid data loss during push
  resetToken: varchar("reset_token", { length: 255 }),
  resetExpiresAt: datetime("reset_expires_at"),
  profilePhoto: longtext("profile_photo"),
  createdBy: bigint("created_by", { mode: "number", unsigned: true }), // Self-referencing users.id
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // OTP Fields
  otp: varchar("otp", { length: 6 }),
  otpExpiresAt: datetime("otp_expires_at"),
  otpIsUsed: boolean("otp_is_used").notNull().default(false),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
}, (table) => {
  return {
    ukUserEmail: uniqueIndex("uk_user_email").on(table.email),
    idxUserRoleId: index("idx_user_role_id").on(table.roleId),
  }
});

export const roles = mysqlTable("roles", {
  id: bigint("id", { mode: "number", unsigned: true }).primaryKey().autoincrement(),
  name: varchar("name", { length: 50 }).notNull(),
}, (table) => {
  return {
    ukRoleName: uniqueIndex("uk_role_name").on(table.name),
  }
});

export const refreshTokens = mysqlTable("refresh_tokens", {
  id: bigint("id", { mode: "number", unsigned: true }).primaryKey().autoincrement(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => users.id),
  token: varchar("token", { length: 255 }).notNull(),
  expiresAt: datetime("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    ukRefreshToken: uniqueIndex("uk_refresh_token").on(table.token),
  }
});

export const organizations = mysqlTable("organizations", {
  id: bigint("id", { mode: "number", unsigned: true }).primaryKey().autoincrement(),
  name: varchar("name", { length: 150 }).notNull(),
  logo: longtext("logo"), // Stores Base64 or URL
  baseCurrency: char("base_currency", { length: 3 }).notNull().default('USD'),
  timezone: varchar("timezone", { length: 64 }).notNull().default('Asia/Kolkata'),
  status: int("status").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").onUpdateNow(),
}, (table) => {
  return {
    // ukOrgName: uniqueIndex("uk_org_name").on(table.name),
    idxOrgName: index("idx_org_name").on(table.name), // Changed to normal index for faster lookups but allowing duplicates
  }
});

// DELETED: userOrganizations table

// RBAC Tables

// DELETED: RBAC Tables (roles, permissions, role_permissions)

// ... existing code ...
// DELETED userRoles table
// export const userRoles = ...

// NEW: Branch Roles Table
// DELETED: userBranchRoles table

export const transactionTypes = mysqlTable("transaction_types", {
  id: bigint("id", { mode: "number", unsigned: true }).primaryKey().autoincrement(),
  name: varchar("name", { length: 50 }).notNull(), // 'Income', 'Expense', 'Investment'
}, (table) => {
  return {
    ukTxnTypeName: uniqueIndex("uk_txn_type_name").on(table.name),
  }
});

export const branches = mysqlTable("branches", {
  id: bigint("id", { mode: "number", unsigned: true }).primaryKey().autoincrement(),
  orgId: bigint("org_id", { mode: "number", unsigned: true }).notNull().default(1).references(() => organizations.id),
  name: varchar("name", { length: 150 }).notNull(),
  code: varchar("code", { length: 30 }),
  currencyCode: char("currency_code", { length: 3 }).notNull(),
  country: varchar("country", { length: 80 }),
  state: varchar("state", { length: 100 }),
  status: int("status").notNull().default(1),
  defaultGstRate: decimal("default_gst_rate", { precision: 5, scale: 2 }).default('0'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").onUpdateNow(),
}, (table) => {
  return {
    ukBranchOrgCode: uniqueIndex("uk_branch_org_code").on(table.orgId, table.code),
    idxBranchOrg: index("idx_branch_org").on(table.orgId),
  }
});


export const accounts = mysqlTable("accounts", {
  id: bigint("id", { mode: "number", unsigned: true }).primaryKey().autoincrement(),
  orgId: bigint("org_id", { mode: "number", unsigned: true }).notNull().references(() => organizations.id),
  branchId: bigint("branch_id", { mode: "number", unsigned: true }).notNull().references(() => branches.id),
  name: varchar("name", { length: 120 }).notNull(),
  accountType: int("account_type").notNull(), // 1=Asset, 2=Liability, etc.
  subtype: int("subtype"), // Allowed NULL
  parentAccountId: bigint("parent_account_id", { mode: "number", unsigned: true }), // For hierarchy
  openingBalance: decimal("opening_balance", { precision: 18, scale: 2 }).notNull().default('0'),
  openingBalanceDate: date("opening_balance_date", { mode: 'string' }).notNull(),
  accountNumber: varchar("account_number", { length: 50 }),
  currencyId: bigint("currency_id", { mode: "number", unsigned: true }).references(() => currencies.id),
  ifsc: varchar("ifsc", { length: 20 }),
  zipCode: varchar("zip_code", { length: 20 }),
  bankBranchName: varchar("bank_branch_name", { length: 120 }),
  description: varchar("description", { length: 255 }),

  status: int("status").notNull().default(1),
  createdBy: bigint("created_by", { mode: "number", unsigned: true }).references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").onUpdateNow(),
}, (table) => {
  return {
    ukAccBranchName: uniqueIndex("uk_acc_branch_name").on(table.branchId, table.name),
    idxAccOrgBranch: index("idx_acc_org_branch").on(table.orgId, table.branchId),
    idxAccOrgCreated: index("idx_acc_org_created").on(table.orgId, table.createdAt),
    idxAccOrgStatusCreated: index("idx_acc_org_status_created").on(table.orgId, table.status, table.createdAt),
    idxAccType: index("idx_acc_type").on(table.accountType),
    idxAccSubtype: index("idx_acc_subtype").on(table.subtype),
  }
});

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  parentAccount: one(accounts, {
    fields: [accounts.parentAccountId],
    references: [accounts.id],
    relationName: 'parentChild'
  }),
  childAccounts: many(accounts, {
    relationName: 'parentChild'
  }),
  currency: one(currencies, {
    fields: [accounts.currencyId],
    references: [currencies.id],
  }),
  branch: one(branches, {
    fields: [accounts.branchId],
    references: [branches.id],
  }),
  creator: one(users, {
    fields: [accounts.createdBy],
    references: [users.id],
  }),
}));

export const categories = mysqlTable("categories", {
  id: bigint("id", { mode: "number", unsigned: true }).primaryKey().autoincrement(),
  orgId: bigint("org_id", { mode: "number", unsigned: true }).notNull().default(1).references(() => organizations.id),
  branchId: bigint("branch_id", { mode: "number", unsigned: true }).notNull().references(() => branches.id),
  txnTypeId: bigint("txn_type_id", { mode: "number", unsigned: true }).notNull().references(() => transactionTypes.id),
  name: varchar("name", { length: 120 }).notNull(),
  status: int("status").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    ukCatOrgTypeName: uniqueIndex("uk_cat_org_type_name").on(table.orgId, table.branchId, table.txnTypeId, table.name),
    idxCatOrgType: index("idx_cat_org_type").on(table.orgId, table.txnTypeId),
    idxCatBranch: index("idx_cat_branch").on(table.branchId),
  }
});

export const subCategories = mysqlTable("sub_categories", {
  id: bigint("id", { mode: "number", unsigned: true }).primaryKey().autoincrement(),
  categoryId: bigint("category_id", { mode: "number", unsigned: true }).notNull().references(() => categories.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 120 }).notNull(),
  status: int("status").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    ukSubcatCatName: uniqueIndex("uk_subcat_cat_name").on(table.categoryId, table.name),
    idxSubcatCat: index("idx_subcat_cat").on(table.categoryId),
  }
});

import { relations } from 'drizzle-orm';

export const categoriesRelations = relations(categories, ({ many, one }) => ({
  subCategories: many(subCategories),
  transactionType: one(transactionTypes, {
    fields: [categories.txnTypeId],
    references: [transactionTypes.id],
  }),
}));

export const subCategoriesRelations = relations(subCategories, ({ one }) => ({
  category: one(categories, {
    fields: [subCategories.categoryId],
    references: [categories.id],
  }),
}));

export const financialYears = mysqlTable("financial_years", {
  id: bigint("id", { mode: "number", unsigned: true }).primaryKey().autoincrement(),
  orgId: bigint("org_id", { mode: "number", unsigned: true }).notNull().default(1).references(() => organizations.id),
  name: varchar("name", { length: 30 }).notNull(), // e.g. "2024-2025"
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  isCurrent: mysqlEnum("is_current", ['yes', 'no']).notNull().default('no'),
  status: int("status").notNull().default(1),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").onUpdateNow(),
}, (table) => {
  return {
    ukFyOrgName: uniqueIndex("uk_fy_org_name").on(table.orgId, table.name),
  }
});

export const transactions = mysqlTable("transactions", {
  id: bigint("id", { mode: "number", unsigned: true }).primaryKey().autoincrement(),
  orgId: bigint("org_id", { mode: "number", unsigned: true }).notNull().default(1).references(() => organizations.id),
  branchId: bigint("branch_id", { mode: "number", unsigned: true }).notNull().references(() => branches.id),
  financialYearId: bigint("financial_year_id", { mode: "number", unsigned: true }).notNull().references(() => financialYears.id),

  name: varchar("name", { length: 255 }).notNull().default("Transaction"), // New field with default
  txnDate: date("txn_date", { mode: "string" }).notNull(),

  txnTypeId: bigint("txn_type_id", { mode: "number", unsigned: true }).references(() => transactionTypes.id),

  categoryId: bigint("category_id", { mode: "number", unsigned: true }).references(() => categories.id),
  subCategoryId: bigint("sub_category_id", { mode: "number", unsigned: true }).references(() => subCategories.id),
  contactId: bigint("contact_id", { mode: "number", unsigned: true }),

  notes: text("notes"),

  referenceNo: varchar("reference_no", { length: 80 }),

  currencyId: bigint("currency_id", { mode: "number", unsigned: true }).references(() => currencies.id),
  fxRate: decimal("fx_rate", { precision: 18, scale: 8 }).notNull().default('1'),

  // Total Amount for display/indexing (sum of debits or credits)
  // totalAmount REMOVED (Redundant with amountLocal)

  amountLocal: decimal("amount_local", { precision: 18, scale: 2 }).notNull().default('0'),
  amountBase: decimal("amount_base", { precision: 18, scale: 2 }).notNull().default('0'),

  // GST / Tax Fields
  isTaxable: boolean("is_taxable").notNull().default(false),
  gstType: int("gst_type"), // 1 for INTRA, 0 for INTER
  gstRate: decimal("gst_rate", { precision: 5, scale: 2 }),
  cgstAmount: decimal("cgst_amount", { precision: 12, scale: 2 }),
  sgstAmount: decimal("sgst_amount", { precision: 12, scale: 2 }),
  igstAmount: decimal("igst_amount", { precision: 12, scale: 2 }),
  gstTotal: decimal("gst_total", { precision: 12, scale: 2 }),
  finalAmount: decimal("final_amount", { precision: 12, scale: 2 }),

  attachmentPath: varchar("attachment_path", { length: 255 }),

  status: int("status").notNull().default(0), // 0 for draft, 1 for posted, 2 for void

  createdBy: bigint("created_by", { mode: "number", unsigned: true }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").onUpdateNow(),
}, (table) => {
  return {
    idxTxOrgBranchDate: index("idx_tx_org_branch_date").on(table.orgId, table.branchId, table.txnDate),
    idxTxOrgFyBranch: index("idx_tx_org_fy_branch").on(table.orgId, table.financialYearId, table.branchId),
    idxTxOrgFyDateCreated: index("idx_tx_org_fy_date_created").on(table.orgId, table.financialYearId, table.txnDate, table.createdAt),
    idxTxOrgFyBranchDateCreated: index("idx_tx_org_fy_branch_date_created").on(table.orgId, table.financialYearId, table.branchId, table.txnDate, table.createdAt),
    idxTxOrgStatusDate: index("idx_tx_org_status_date").on(table.orgId, table.status, table.txnDate),
    idxTxContactId: index("idx_tx_contact_id").on(table.contactId),
  }
});

export const parties = mysqlTable("parties", {
  id: bigint("id", { mode: "number", unsigned: true }).primaryKey().autoincrement(),
  orgId: bigint("org_id", { mode: "number", unsigned: true }).notNull().references(() => organizations.id),
  branchId: bigint("branch_id", { mode: "number", unsigned: true }).notNull().references(() => branches.id),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 190 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  address: text("address").notNull(),
  state: varchar("state", { length: 100 }),
  gstNo: varchar("gst_no", { length: 50 }).notNull(),
  gstName: varchar("gst_name", { length: 255 }).notNull(),
  status: int("status").notNull().default(1), // 1 = active, 2 = inactive
  createdBy: bigint("created_by", { mode: "number", unsigned: true }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").onUpdateNow(),
}, (table) => {
  return {
    idxPartyOrgBranch: index("idx_party_org_branch").on(table.orgId, table.branchId),
  }
});

export const partiesRelations = relations(parties, ({ one }) => ({
  organization: one(organizations, {
    fields: [parties.orgId],
    references: [organizations.id],
  }),
  branch: one(branches, {
    fields: [parties.branchId],
    references: [branches.id],
  }),
  creator: one(users, {
    fields: [parties.createdBy],
    references: [users.id],
  }),
}));

export const transactionEntries = mysqlTable("transaction_entries", {
  id: bigint("id", { mode: "number", unsigned: true }).primaryKey().autoincrement(),
  transactionId: bigint("transaction_id", { mode: "number", unsigned: true }).notNull().references(() => transactions.id, { onDelete: 'cascade' }),
  accountId: bigint("account_id", { mode: "number", unsigned: true }).notNull(),

  debit: decimal("debit", { precision: 18, scale: 2 }).notNull().default('0'),
  credit: decimal("credit", { precision: 18, scale: 2 }).notNull().default('0'),

  description: varchar("description", { length: 255 }),
}, (table) => {
  return {
    idxTxEntTxId: index("idx_tx_ent_tx_id").on(table.transactionId),
    idxTxEntAccId: index("idx_tx_ent_acc_id").on(table.accountId),
    idxTxEntTxAccId: index("idx_tx_ent_tx_acc_id").on(table.transactionId, table.accountId),
  }
});

export const monthlyBranchSummary = mysqlTable("monthly_branch_summary", {
  id: bigint("id", { mode: "number", unsigned: true }).primaryKey().autoincrement(),
  orgId: bigint("org_id", { mode: "number", unsigned: true }).notNull().default(1).references(() => organizations.id),
  branchId: bigint("branch_id", { mode: "number", unsigned: true }).notNull().references(() => branches.id),
  financialYearId: bigint("financial_year_id", { mode: "number", unsigned: true }).notNull().references(() => financialYears.id),
  yearMonth: varchar("year_month", { length: 7 }).notNull(), // YYYY-MM
  currencyCode: char("currency_code", { length: 3 }).notNull(),

  income: decimal("income", { precision: 18, scale: 2 }).notNull().default('0'),
  expense: decimal("expense", { precision: 18, scale: 2 }).notNull().default('0'),
  investment: decimal("investment", { precision: 18, scale: 2 }).notNull().default('0'),
  investmentReturn: decimal("investment_return", { precision: 18, scale: 2 }).notNull().default('0'),

  openingBalance: decimal("opening_balance", { precision: 18, scale: 2 }).notNull().default('0'),
  closingBalance: decimal("closing_balance", { precision: 18, scale: 2 }).notNull().default('0'),

  status: int("status").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").onUpdateNow(),
}, (table) => {
  return {
    ukMbsOrgBranchDate: uniqueIndex("uk_mbs_org_branch_date").on(table.orgId, table.branchId, table.yearMonth, table.currencyCode),
    idxMbsFy: index("idx_mbs_fy").on(table.financialYearId),
  }
});

export const yearlyBranchSummary = mysqlTable("yearly_branch_summary", {
  id: bigint("id", { mode: "number", unsigned: true }).primaryKey().autoincrement(),
  orgId: bigint("org_id", { mode: "number", unsigned: true }).notNull().default(1).references(() => organizations.id),
  branchId: bigint("branch_id", { mode: "number", unsigned: true }).notNull().references(() => branches.id),
  financialYearId: bigint("financial_year_id", { mode: "number", unsigned: true }).notNull().references(() => financialYears.id),
  currencyCode: char("currency_code", { length: 3 }).notNull(),

  income: decimal("income", { precision: 18, scale: 2 }).notNull().default('0'),
  expense: decimal("expense", { precision: 18, scale: 2 }).notNull().default('0'),
  investment: decimal("investment", { precision: 18, scale: 2 }).notNull().default('0'),
  investmentReturn: decimal("investment_return", { precision: 18, scale: 2 }).notNull().default('0'),

  openingBalance: decimal("opening_balance", { precision: 18, scale: 2 }).notNull().default('0'),
  closingBalance: decimal("closing_balance", { precision: 18, scale: 2 }).notNull().default('0'),

  status: int("status").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").onUpdateNow(),
}, (table) => {
  return {
    ukYbsOrgBranchFy: uniqueIndex("uk_ybs_org_branch_fy").on(table.orgId, table.branchId, table.financialYearId, table.currencyCode),
  }
});

export const exchangeRates = mysqlTable("exchange_rates", {
  id: bigint("id", { mode: "number", unsigned: true }).primaryKey().autoincrement(),
  orgId: bigint("org_id", { mode: "number", unsigned: true }).notNull().references(() => organizations.id),
  rateDate: date("rate_date", { mode: "string" }).notNull(),
  fromCurrency: char("from_currency", { length: 3 }).notNull(),
  toCurrency: char("to_currency", { length: 3 }).notNull(),
  rate: decimal("rate", { precision: 18, scale: 8 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    ukFxOrgDatePair: uniqueIndex("uk_fx_org_date_pair").on(table.orgId, table.rateDate, table.fromCurrency, table.toCurrency),
    idxFxOrgDate: index("idx_fx_org_date").on(table.orgId, table.rateDate),
  }
});

export const financialYearsRelations = relations(financialYears, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  branch: one(branches, {
    fields: [transactions.branchId],
    references: [branches.id],
  }),
  financialYear: one(financialYears, {
    fields: [transactions.financialYearId],
    references: [financialYears.id],
  }),
  transactionType: one(transactionTypes, {
    fields: [transactions.txnTypeId],
    references: [transactionTypes.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  subCategory: one(subCategories, {
    fields: [transactions.subCategoryId],
    references: [subCategories.id],
  }),
  currency: one(currencies, {
    fields: [transactions.currencyId],
    references: [currencies.id],
  }),
  entries: many(transactionEntries),
  creator: one(users, {
    fields: [transactions.createdBy],
    references: [users.id],
  }),
}));

export const transactionEntriesRelations = relations(transactionEntries, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionEntries.transactionId],
    references: [transactions.id],
  }),
  account: one(accounts, {
    fields: [transactionEntries.accountId],
    references: [accounts.id],
  }),
}));

export const transactionTypesRelations = relations(transactionTypes, ({ many }) => ({
  categories: many(categories),
  transactions: many(transactions),
}));

export const auditLogs = mysqlTable("audit_logs", {
  id: bigint("id", { mode: "number", unsigned: true }).primaryKey().autoincrement(),
  orgId: bigint("org_id", { mode: "number", unsigned: true }).notNull().references(() => organizations.id),
  entity: varchar("entity", { length: 50 }).notNull(), // 'transaction','account','category',etc
  entityId: bigint("entity_id", { mode: "number", unsigned: true }), // Made nullable to avoid truncation warning
  action: varchar("action", { length: 50 }).notNull(), // 'create','update','delete','approve'
  oldValue: json("old_value_json"),
  newValue: json("new_value_json"),
  actionBy: bigint("action_by", { mode: "number", unsigned: true }).notNull(),
  actionAt: datetime("action_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    idxAuditOrgEntity: index("idx_audit_org_entity").on(table.orgId, table.entity, table.entityId),
    idxAuditOrgTime: index("idx_audit_org_time").on(table.orgId, table.actionAt),
  }
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.actionBy],
    references: [users.id],
  }),
}));

// DELETED: rolesRelations

export const organizationInvitations = mysqlTable("organization_invitations", {
  id: bigint("id", { mode: "number", unsigned: true }).primaryKey().autoincrement(),
  orgId: bigint("org_id", { mode: "number", unsigned: true }).notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  inviterId: bigint("inviter_id", { mode: "number", unsigned: true }).notNull(),
  email: varchar("email", { length: 190 }).notNull(),
  roleId: bigint("role_id", { mode: "number", unsigned: true }).references(() => roles.id), // NEW: Role ID

  // V2: Multi-Branch Support for Members (branchIds is comma-separated string)
  branchIds: text("branch_ids").notNull().default(""),

  status: mysqlEnum("status", ['pending', 'accepted', 'rejected']).notNull().default('pending'),
  token: varchar("token", { length: 100 }),
  expiresAt: datetime("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").onUpdateNow(),
}, (table) => {
  return {
    ukInvEmailOrgStatus: uniqueIndex("uk_inv_email_org_status").on(table.email, table.orgId, table.status),
    idxInvEmailStr: index("idx_inv_email_str").on(table.email),
    idxInvOrg: index("idx_inv_org").on(table.orgId),
  }
});

export const organizationInvitationsRelations = relations(organizationInvitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationInvitations.orgId],
    references: [organizations.id],
  }),
  inviter: one(users, {
    fields: [organizationInvitations.inviterId],
    references: [users.id],
  }),
}));

export const currencies = mysqlTable("currencies", {
  id: bigint("id", { mode: "number", unsigned: true }).primaryKey().autoincrement(),
  code: varchar("code", { length: 3 }).notNull(),
  name: varchar("name", { length: 50 }).notNull(),
  symbol: varchar("symbol", { length: 5 }),
  status: int("status").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").onUpdateNow(),
}, (table) => {
  return {
    ukCurrencyCode: uniqueIndex("uk_currency_code").on(table.code),
  }
});

export const countries = mysqlTable("countries", {
  id: int("id").primaryKey().autoincrement(),
  countryName: varchar("country_name", { length: 100 }).notNull(),
  countryCode: char("country_code", { length: 2 }).notNull(),
  countryCurrency: char("country_currency", { length: 3 }),
});
