import { db } from "./src/db/index.ts";
import { sql } from "drizzle-orm";

async function run() {
  try {
    const query = sql`
CREATE TABLE \`imported_statements\` (
	\`id\` bigint unsigned AUTO_INCREMENT NOT NULL,
	\`org_id\` bigint unsigned NOT NULL,
	\`branch_id\` bigint unsigned NOT NULL,
	\`financial_year_id\` bigint unsigned NOT NULL,
	\`filename\` varchar(255) NOT NULL,
	\`target_account_id\` bigint unsigned,
	\`imported_by\` bigint unsigned NOT NULL,
	\`imported_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	\`transaction_count\` int NOT NULL DEFAULT 0,
	\`status\` int NOT NULL DEFAULT 1,
	CONSTRAINT \`imported_statements_id\` PRIMARY KEY(\`id\`)
);
    `;
    await db.execute(query);
    
    await db.execute(sql`ALTER TABLE \`imported_statements\` ADD CONSTRAINT \`imported_statements_org_id_organizations_id_fk\` FOREIGN KEY (\`org_id\`) REFERENCES \`organizations\`(\`id\`) ON DELETE no action ON UPDATE no action;`);
    await db.execute(sql`ALTER TABLE \`imported_statements\` ADD CONSTRAINT \`imported_statements_branch_id_branches_id_fk\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE no action ON UPDATE no action;`);
    await db.execute(sql`ALTER TABLE \`imported_statements\` ADD CONSTRAINT \`imported_statements_financial_year_id_financial_years_id_fk\` FOREIGN KEY (\`financial_year_id\`) REFERENCES \`financial_years\`(\`id\`) ON DELETE no action ON UPDATE no action;`);
    await db.execute(sql`ALTER TABLE \`imported_statements\` ADD CONSTRAINT \`imported_statements_imported_by_users_id_fk\` FOREIGN KEY (\`imported_by\`) REFERENCES \`users\`(\`id\`) ON DELETE no action ON UPDATE no action;`);
    await db.execute(sql`CREATE INDEX \`idx_imp_stmt_org_branch\` ON \`imported_statements\` (\`org_id\`,\`branch_id\`);`);
    await db.execute(sql`CREATE INDEX \`idx_imp_stmt_fy\` ON \`imported_statements\` (\`financial_year_id\`);`);
    console.log("Table created successfully");
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
