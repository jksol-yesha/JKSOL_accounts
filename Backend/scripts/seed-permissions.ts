
import { db } from '../src/db';
import { permissions } from '../src/db/schema';

const PERMISSIONS = [
    // Dashboard
    { permKey: 'DASHBOARD_VIEW', description: 'View Dashboard' },

    // Transactions
    { permKey: 'TXN_VIEW', description: 'View Transactions' },
    { permKey: 'TXN_CREATE', description: 'Create Transactions' },
    { permKey: 'TXN_EDIT', description: 'Edit Transactions' },
    { permKey: 'TXN_DELETE', description: 'Delete Transactions' },

    // Categories
    { permKey: 'CATEGORY_VIEW', description: 'View Categories' },
    { permKey: 'CATEGORY_CREATE', description: 'Create Categories' },
    { permKey: 'CATEGORY_EDIT', description: 'Edit Categories' },
    { permKey: 'CATEGORY_DELETE', description: 'Delete Categories' },

    // Accounts
    { permKey: 'ACCOUNT_VIEW', description: 'View Accounts' },
    { permKey: 'ACCOUNT_CREATE', description: 'Create Accounts' },
    { permKey: 'ACCOUNT_EDIT', description: 'Edit Accounts' },
    { permKey: 'ACCOUNT_DELETE', description: 'Delete Accounts' },

    // Reports
    { permKey: 'REPORT_VIEW', description: 'View Reports' },

    // Settings / Admin
    { permKey: 'SETTINGS_MANAGE', description: 'Manage Organization Settings' },
    { permKey: 'USER_MANAGE', description: 'Manage Users and Roles' },
];

async function seedPermissions() {
    console.log("Seeding Permissions...");

    for (const p of PERMISSIONS) {
        await db.insert(permissions)
            .values(p)
            .onDuplicateKeyUpdate({ set: { description: p.description } });
    }

    console.log("Permissions Seeded Successfully.");
}

seedPermissions().then(() => process.exit(0)).catch(console.error);
