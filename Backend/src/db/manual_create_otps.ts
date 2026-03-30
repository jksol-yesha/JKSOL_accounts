import { connection } from "./index";

async function main() {
    console.log("Creating 'otps' table...");
    try {
        const [result] = await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`otps\` (
        \`id\` bigint unsigned AUTO_INCREMENT NOT NULL PRIMARY KEY,
        \`email\` varchar(190) NOT NULL,
        \`otp\` varchar(6) NOT NULL,
        \`expires_at\` datetime NOT NULL,
        \`is_used\` boolean NOT NULL DEFAULT false,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_otp_email\` (\`email\`)
      );
    `);
        console.log("Table 'otps' created or already exists.", result);
    } catch (err) {
        console.error("Error creating table:", err);
    } finally {
        await connection.end();
    }
}

main();
