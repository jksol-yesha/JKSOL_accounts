import * as AccountService from './accounts.service';
import { successResponse } from '../../shared/response';
import type { AuthenticatedUser, ElysiaContext } from '../../shared/auth.middleware';
import { db } from '../../db';
import { accounts } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

import { isNotDeleted } from '../../shared/soft-delete';

export const getAccounts = async ({ user, orgId, body, headers }: ElysiaContext & { body: { status?: 1 | 2, financialYearId?: number } }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");

    const targetCurrency = headers['x-base-currency'];

    // Pass orgId and user to service
    const accounts = await AccountService.getAllAccounts(
        orgId,
        body.status,
        targetCurrency,
        user,
        body.financialYearId ? Number(body.financialYearId) : undefined
    );
    return successResponse('Accounts retrieved successfully', accounts);
};

export const createAccount = async ({ body, user, orgId, headers, set }: ElysiaContext & { body: any }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");

    const targetCurrency = headers['x-base-currency'];

    // Pass account data to service
    const newAccount = await AccountService.createAccount({
        ...body,
        orgId,
        userId: user.id,

        // Explicitly ensuring types
        accountType: Number(body.accountType),
        subtype: (body.subtype !== undefined && body.subtype !== null) ? Number(body.subtype) : null,
        currencyCode: body.currencyCode,
        fxRate: body.fxRate,
        targetCurrency: typeof targetCurrency === 'string' ? targetCurrency : undefined,
        description: body.description,
        accountHolderName: (body.accountHolderName || body.account_holder_name || ''),
        bankName: (body.bankName || body.bank_name || null),
        accountNumber: (body.accountNumber || body.account_no || body.account_number || null),
        ifsc: (body.ifsc || null),
        zipCode: (body.zipCode || body.zip_code || null),
        bankBranchName: (body.bankBranchName || body.bank_branch_name || body.bank_branch || null),
        isActive: body.isActive !== undefined ? body.isActive : true,
        openingBalance: body.openingBalance,
        openingBalanceDate: body.openingBalanceDate
    });



    return successResponse('Account created successfully', newAccount);
};

export const updateAccount = async ({ params, body, user, orgId, set }: ElysiaContext & { params: { id: string }, body: any }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    const id = parseInt(params.id);

    // 1. Fetch Account
    const [account] = await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.id, id), isNotDeleted(accounts)));
    if (!account) {
        set.status = 404;
        return { success: false, message: "Account not found" };
    }

    const updated = await AccountService.updateAccount(id, {
        ...body,
        accountType: body.accountType ? Number(body.accountType) : undefined,
        subtype: body.subtype ? Number(body.subtype) : undefined,
        accountHolderName: (body.accountHolderName ?? body.account_holder_name),
        bankName: (body.bankName ?? body.bank_name),
        accountNumber: (body.accountNumber || body.account_no || body.account_number || undefined),
        ifsc: (body.ifsc || undefined),
        zipCode: (body.zipCode || body.zip_code || undefined),
        bankBranchName: (body.bankBranchName || body.bank_branch_name || body.bank_branch || undefined)
    }, orgId, user.id);

    const updatedWithEditor = {
        ...updated,
        lastEditor: {
            id: user.id,
            fullName: (user as any).fullName || (user as any).name || (user as any).email || null
        }
    };



    return successResponse('Account updated successfully', updatedWithEditor);
};

export const updateOpeningBalance = async ({ params, body, orgId }: ElysiaContext & { params: { id: string }, body: any }) => {
    if (!orgId) throw new Error("Organization not identified");
    const id = parseInt(params.id);
    const updated = await AccountService.updateOpeningBalance(id, body, orgId);
    return successResponse('Opening balance updated successfully', updated);
};

export const getAccountNetSettlement = async ({ params, user, orgId, headers }: ElysiaContext & { params: { id: string } }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    const id = parseInt(params.id);
    const targetCurrency = headers['x-base-currency'];
    const data = await AccountService.getAccountNetSettlement(
        id,
        orgId,
        typeof targetCurrency === 'string' ? targetCurrency : undefined,
        user
    );
    return successResponse('Account net settlement retrieved successfully', data);
};

export const deleteAccount = async ({ body, user, orgId, set }: ElysiaContext & { body: { id: number } }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        const id = body.id;

        // 1. Fetch Account
        const [account] = await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.id, id), isNotDeleted(accounts)));

        if (!account) {
            set.status = 404;
            return { success: false, message: "Account not found" };
        }

        // 2. Restrict Deletion for Members (Owners/Admins only)
        if (user.role === 'member') {
            set.status = 403;
            return { success: false, message: "Action Prohibited: Only Owners and Admins can delete accounts." };
        }

        await AccountService.deleteAccount(id, orgId, user.id);



        return successResponse('Account archived successfully');
    } catch (e: any) {
        console.error("Delete account error:", e);
        // Robust check for FK constraints
        const errMessage = e.message || "";
        const causeMessage = e.cause?.message || "";
        const errCode = e.code || e.cause?.code;

        if (
            errCode === 'ER_ROW_IS_REFERENCED' ||
            errCode === 'ER_ROW_IS_REFERENCED_2' ||
            errMessage.includes('foreign key constraint fails') ||
            causeMessage.includes('foreign key constraint fails') ||
            errMessage.includes('used in associated records') ||
            errMessage.includes('constraint') ||
            (errMessage.includes('Failed query') && errMessage.includes('delete from'))
        ) {
            set.status = 400;
            return {
                success: false,
                message: errMessage.includes('used in associated records')
                    ? e.message
                    : "Cannot delete this account because it is used in associated records. Please modify Status to 'Inactive' instead."
            };
        }
        throw e;
    }
};
