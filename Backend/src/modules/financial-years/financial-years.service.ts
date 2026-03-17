
import { db } from '../../db';
import { financialYears } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';

export class FinancialYearService {
    static async getAll(orgId: number) {
        return await db.query.financialYears.findMany({
            where: and(
                eq(financialYears.orgId, orgId),
                eq(financialYears.status, 1)
            ),
            orderBy: [desc(financialYears.startDate)]
        });
    }

    static async getById(id: number) {
        return await db.query.financialYears.findFirst({
            where: eq(financialYears.id, id)
        });
    }
}
