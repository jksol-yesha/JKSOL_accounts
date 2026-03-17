
import { FinancialYearService } from './financial-years.service';
import type { ElysiaContext } from '../../shared/auth.middleware';

export const getFinancialYears = async ({ set, user, orgId }: ElysiaContext) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        const years = await FinancialYearService.getAll(orgId);
        return { success: true, data: years };
    } catch (error) {
        console.error('Get Financial Years Error:', error);
        set.status = 500;
        return { success: false, message: 'Failed to fetch financial years' };
    }
};
