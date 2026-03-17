import { CategoryService } from './category.service';
import type { ElysiaContext } from '../../shared/auth.middleware';
import { db } from '../../db';
import { categories } from '../../db/schema';
import { eq } from 'drizzle-orm';

export const getCategories = async ({ body, set, user, orgId, branchId }: ElysiaContext & { body: { branchId?: number | number[] | 'all', orgId?: number } }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");

    // orgId and branchId are now from context
    const finalOrgId = body.orgId || orgId;
    const finalBranchId = body.branchId ?? branchId;

    if ((!finalBranchId && finalBranchId !== 0) || (Array.isArray(finalBranchId) && finalBranchId.length === 0)) {
        set.status = 400;
        return { message: "Branch ID is required (header/body)" };
    }

    // Branch access check for MEMBERS
    if (user.role === 'member') {
        if (finalBranchId === 'all') {
            if (!user.branchIds || user.branchIds.length === 0) {
                set.status = 403;
                return { success: false, message: 'Forbidden: You have no assigned branches' };
            }
        } else if (Array.isArray(finalBranchId)) {
            const allowed = finalBranchId.some(bid => user.branchIds.includes(Number(bid)));
            if (!allowed) {
                set.status = 403;
                return { success: false, message: 'Forbidden: You do not have access to selected branches' };
            }
        } else if (!user.branchIds.includes(finalBranchId)) {
            set.status = 403;
            return { success: false, message: 'Forbidden: You do not have access to this branch' };
        }
    }

    const items = await CategoryService.getAll(finalOrgId, finalBranchId, user);
    return {
        success: true,
        data: items
    };
};

export const createCategory = async ({ body, set, user, orgId, branchId }: ElysiaContext & { body: any }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        const finalBranchId = body.branchId || branchId;

        if (!finalBranchId) {
            set.status = 400;
            return { message: "Branch ID is required" };
        }

        // Branch access check for MEMBERS
        if (user.role === 'member' && !user.branchIds.includes(finalBranchId)) {
            set.status = 403;
            return { success: false, message: 'Forbidden: You do not have access to this branch' };
        }

        const newCategory = await CategoryService.create({ ...body, orgId, branchId: finalBranchId }, user.id);
        return {
            success: true,
            data: newCategory
        };
    } catch (e: any) {
        if (e.code === 'ER_DUP_ENTRY' || e.message?.includes('Duplicate entry') || (e.cause && e.cause.code === 'ER_DUP_ENTRY')) {
            set.status = 409;
            return { message: "Category with this name already exists in this branch." };
        }
        set.status = 500;
        return { message: "An unexpected error occurred. Please try again." };
    }
};

export const updateCategory = async ({ params: { id }, body, user, orgId, set }: ElysiaContext & { params: { id: string }, body: any }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    const catId = Number(id);

    // 1. Fetch Category to get Branch ID
    const [category] = await db.select({ branchId: categories.branchId }).from(categories).where(eq(categories.id, catId));
    if (!category) {
        set.status = 404;
        return { success: false, message: "Category not found" };
    }

    // 2. Check Permission (Branch-level for MEMBERS)
    if (user.role === 'member' && !user.branchIds.includes(category.branchId || 0)) {
        set.status = 403;
        return { success: false, message: 'Forbidden: You do not have access to this branch' };
    }

    const updated = await CategoryService.update(catId, body, user.id);
    return { success: true, data: updated };
};

export const deleteCategory = async ({ body, user, orgId, set }: ElysiaContext & { body: { id: number } }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        const id = Number(body.id);

        // 1. Fetch Category to get Branch ID
        const [category] = await db.select({ branchId: categories.branchId }).from(categories).where(eq(categories.id, id));

        if (!category) {
            set.status = 404;
            return { success: false, message: "Category not found" };
        }

        // 2. Restrict Deletion for Members (Owners/Admins only)
        if (user.role === 'member') {
            set.status = 403;
            return { success: false, message: "Action Prohibited: Only Owners and Admins can delete categories." };
        }

        await CategoryService.delete(id, user.id);
        return { success: true, message: "Category deleted successfully" };
    } catch (e: any) {
        console.error("Delete category error:", e);
        const errCode = e.code || e.cause?.code;
        const errMessage = e.message || "";
        const causeMessage = e.cause?.message || "";

        if (
            errCode === 'ER_ROW_IS_REFERENCED' ||
            errCode === 'ER_ROW_IS_REFERENCED_2' ||
            errMessage.includes('foreign key constraint fails') ||
            causeMessage.includes('foreign key constraint fails') ||
            errMessage.includes('constraint') ||
            causeMessage.includes('constraint') ||
            e.errno === 1451 ||
            e.cause?.errno === 1451
        ) {
            set.status = 400; // Bad Request
            return {
                success: false,
                message: "Cannot delete this category because it is used in associated records (Transactions). Please modify the Status to 'Inactive' instead."
            };
        }
        if (errMessage.includes('Category not found')) {
            set.status = 404;
            return { success: false, message: e.message };
        }
        set.status = 500;
        return { success: false, message: "Failed to delete category: " + (errMessage) + (e.cause ? " | Cause: " + e.cause.message : "") };
    }
};

export const createSubCategory = async ({ body, set, user }: ElysiaContext & { body: any }) => {
    if (!user) throw new Error("Unauthorized");
    try {
        const newSub = await CategoryService.createSub(body);
        return { success: true, data: newSub };
    } catch (e: any) {
        if (e.code === 'ER_DUP_ENTRY' || e.message?.includes('Duplicate entry') || (e.cause && e.cause.code === 'ER_DUP_ENTRY')) {
            set.status = 409;
            return { message: "Subcategory with this name already exists." };
        }
        set.status = 500;
        console.error("Subcategory create error:", e);
        return { message: "An unexpected error occurred. Please try again." };
    }
};

export const updateSubCategory = async ({ params: { id }, body, user }: ElysiaContext & { params: { id: string }, body: any }) => {
    if (!user) throw new Error("Unauthorized");
    const updated = await CategoryService.updateSub(Number(id), body);
    return { success: true, data: updated };
};

export const deleteSubCategory = async ({ params: { id }, set, user }: ElysiaContext & { params: { id: string } }) => {
    if (!user) throw new Error("Unauthorized");
    try {
        await CategoryService.deleteSub(Number(id));
        return { success: true, message: "Subcategory deleted successfully" };
    } catch (e: any) {
        console.error("Delete subcategory error:", e);
        const errCode = e.code || e.cause?.code;
        const errMessage = e.message || "";
        const causeMessage = e.cause?.message || "";

        if (
            errCode === 'ER_ROW_IS_REFERENCED' ||
            errCode === 'ER_ROW_IS_REFERENCED_2' ||
            errMessage.includes('foreign key constraint fails') ||
            causeMessage.includes('foreign key constraint fails') ||
            errMessage.includes('constraint') ||
            causeMessage.includes('constraint') ||
            e.errno === 1451 ||
            e.cause?.errno === 1451
        ) {
            set.status = 400;
            return {
                success: false,
                message: "Cannot delete this subcategory because it is used in associated records (Transactions). Please modify Status to 'Inactive'."
            };
        }
        set.status = 500;
        return { success: false, message: "Failed to delete subcategory: " + errMessage + (e.cause ? " | Cause: " + e.cause.message : "") };
    }
};
