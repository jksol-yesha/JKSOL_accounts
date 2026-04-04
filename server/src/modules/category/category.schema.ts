
import { t } from 'elysia';

export const createCategorySchema = t.Object({
    name: t.String({ minLength: 1, maxLength: 120 }),
    // Allow either ID (number) or Name (string) for flexibility during migration
    txnType: t.Optional(t.Union([t.Literal('Income'), t.Literal('Expense'), t.Literal('Investment'), t.Literal('income'), t.Literal('expense'), t.Literal('investment')])), // Case insensitive handling in service? I should Normalize there.
    txnTypeId: t.Optional(t.Numeric()),
    orgId: t.Optional(t.Numeric()),
});

export const updateCategorySchema = t.Object({
    name: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
    txnType: t.Optional(t.Union([t.Literal('income'), t.Literal('expense'), t.Literal('investment')])),
    status: t.Optional(t.Union([t.Literal(1), t.Literal(2)])),
});

export const createSubCategorySchema = t.Object({
    categoryId: t.Numeric(),
    name: t.String({ minLength: 1, maxLength: 120 }),
});

export const updateSubCategorySchema = t.Object({
    name: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
    status: t.Optional(t.Union([t.Literal(1), t.Literal(2)])),
});
