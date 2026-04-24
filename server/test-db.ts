import { config } from 'dotenv';
config();

import { db } from './server/src/db/index.ts';
import { parties } from './server/src/db/schema.ts';

async function run() {
  try {
    await db.insert(parties).values({
        orgId: 2,
        companyName: 'aa',
        name: 'aa',
        email: '',
        phone: '',
        address: '',
        gstNo: '',
        gstName: '',
        status: 1,
        createdBy: 39,
    });
    console.log("Success!");
  } catch (e: any) {
    console.log("Error logic caught something:");
    if (e.cause) console.log("CAUSE:", e.cause.message || e.cause.code || e.cause);
    else console.log(e.message);
  }
  process.exit(0);
}
run();
