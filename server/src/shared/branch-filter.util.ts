
import { eq, and, inArray, SQL } from 'drizzle-orm';
import { transactions, accounts } from '../db/schema';

export const getBranchFilter = (
    table: typeof transactions | typeof accounts,
    orgId: number,
    branchId: number | number[] | 'all' | null,
    user: { role: string; branchIds: any }
): SQL | undefined => {
    const filters: (SQL | undefined)[] = [eq(table.orgId, orgId)];

    // Convert user branchIds to array of numbers
    const userBranchIds = typeof user.branchIds === 'string'
        ? user.branchIds.split(',').filter(Boolean).map(Number)
        : (Array.isArray(user.branchIds) ? user.branchIds : []);

    if (branchId === 'all' || branchId === null) {
        // Aggregation mode
        if (user.role === 'member') {
            // Members can only aggregate across branches they have access to
            if (userBranchIds.length > 0) {
                filters.push(inArray(table.branchId, userBranchIds));
            } else {
                // If no branches assigned, they see nothing
                filters.push(eq(table.branchId, -1));
            }
        }
        // Owners/Admins get no branch filter (all branches in org)
    } else if (Array.isArray(branchId)) {
        // Specific list of branches
        if (user.role === 'member') {
            const allowedRequested = branchId.filter(id => userBranchIds.includes(id));
            filters.push(inArray(table.branchId, allowedRequested.length > 0 ? allowedRequested : [-1]));
        } else {
            filters.push(inArray(table.branchId, branchId));
        }
    } else {
        // Single branch mode
        const bid = Number(branchId);
        if (user.role === 'member' && !userBranchIds.includes(bid)) {
            filters.push(eq(table.branchId, -1)); // Unauthorized
        } else {
            filters.push(eq(table.branchId, bid));
        }
    }

    return and(...filters.filter((f): f is SQL => f !== undefined));
};
