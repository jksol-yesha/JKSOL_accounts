import mysql from 'mysql2/promise';

async function main() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "jksol_accounts",
        port: Number(process.env.DB_PORT) || 3307,
    });

    try {
        const [rows] = await connection.query('SELECT id, preferences FROM users WHERE preferences IS NOT NULL') as any;
        const validKeys = new Set(['currency', 'dateFormat', 'numberFormat', 'timeZone', 'exchangeRate']);
        
        let fixed = 0;

        for (const row of rows) {
            const raw = row.preferences;
            let parsed: any = null;
            try {
                parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            } catch {
                await connection.query('UPDATE users SET preferences = NULL WHERE id = ?', [row.id]);
                console.log(`User ${row.id}: Wiped (unparseable)`);
                fixed++;
                continue;
            }

            if (!parsed || typeof parsed !== 'object') {
                await connection.query('UPDATE users SET preferences = NULL WHERE id = ?', [row.id]);
                console.log(`User ${row.id}: Wiped (not an object)`);
                fixed++;
                continue;
            }

            const allKeys = Object.keys(parsed);
            // Corrupted if ANY key is numeric
            const hasNumericKeys = allKeys.some(k => /^\d+$/.test(k));

            if (hasNumericKeys) {
                // Reconstruct from numeric-indexed chars
                const numericKeys = allKeys.filter(k => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
                const chars = numericKeys.map(k => parsed[k]);
                const reconstructed = chars.join('');
                
                let realPrefs: any = {};
                try {
                    realPrefs = JSON.parse(reconstructed);
                } catch {}

                // Also extract any valid named keys that may have already been added
                for (const k of allKeys) {
                    if (validKeys.has(k)) realPrefs[k] = parsed[k];
                }

                // Clean to only valid keys
                const cleaned: any = {};
                for (const k of validKeys) {
                    if (realPrefs[k]) cleaned[k] = realPrefs[k];
                }

                if (Object.keys(cleaned).length > 0) {
                    await connection.query('UPDATE users SET preferences = ? WHERE id = ?', [JSON.stringify(cleaned), row.id]);
                    console.log(`User ${row.id}: Fixed =>`, cleaned);
                } else {
                    await connection.query('UPDATE users SET preferences = NULL WHERE id = ?', [row.id]);
                    console.log(`User ${row.id}: Wiped (no valid prefs)`);
                }
                fixed++;
            } else {
                // Check that all existing keys are valid
                const cleaned: any = {};
                for (const k of allKeys) {
                    if (validKeys.has(k)) cleaned[k] = parsed[k];
                }
                if (JSON.stringify(cleaned) !== JSON.stringify(parsed)) {
                    await connection.query('UPDATE users SET preferences = ? WHERE id = ?', [JSON.stringify(cleaned), row.id]);
                    console.log(`User ${row.id}: Cleaned extra keys =>`, cleaned);
                    fixed++;
                } else {
                    console.log(`User ${row.id}: OK =>`, parsed);
                }
            }
        }

        console.log(`\nDone. Total fixed: ${fixed}`);
    } finally {
        await connection.end();
    }
}

main();
