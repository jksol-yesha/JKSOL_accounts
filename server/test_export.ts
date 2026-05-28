import { exportReport } from './src/modules/reports/reports.controller';

async function test() {
  const req = {
    body: {
      type: 'Profit/Loss',
      branchId: 'all',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      format: 'pdf'
    },
    set: {},
    headers: {},
    user: { role: 'admin', branchIds: [] },
    orgId: 1,
    branchId: 'all'
  };
  
  try {
    const res = await exportReport(req as any);
    console.log("Success generated");
  } catch (e) {
    console.error("FAILED:", e);
  }
}

test();
