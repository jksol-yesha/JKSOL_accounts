import { Elysia, t } from 'elysia';
import * as CategoryController from './category.controller.ts';
import { authMiddleware } from '../../shared/auth.middleware';
import { createCategorySchema, updateCategorySchema, createSubCategorySchema, updateSubCategorySchema } from './category.schema';

export const categoryRoutes = new Elysia({ prefix: '/categories' })
    .use(authMiddleware)
    .post('/category-list', CategoryController.getCategories, {
        validateAccess: 'org',
        body: t.Object({
            branchId: t.Optional(t.Union([t.Numeric(), t.Literal('all'), t.Array(t.Numeric())])),
            orgId: t.Optional(t.Numeric())
        })
    })
    .post('/', CategoryController.createCategory, {
        validateAccess: 'branch',
        body: createCategorySchema
    })
    .put('/:id', CategoryController.updateCategory, {
        validateAccess: 'org',
        params: t.Object({
            id: t.String()
        }),
        body: updateCategorySchema
    })
    .post('/delete', CategoryController.deleteCategory, {
        validateAccess: 'org',
        body: t.Object({
            id: t.Numeric()
        })
    })
    .post('/sub', CategoryController.createSubCategory, {
        validateAccess: 'org',
        body: createSubCategorySchema
    })
    .put('/sub/:id', CategoryController.updateSubCategory, {
        validateAccess: 'org',
        params: t.Object({
            id: t.String()
        }),
        body: updateSubCategorySchema
    })
    .delete('/sub/:id', CategoryController.deleteSubCategory, {
        validateAccess: 'org',
        params: t.Object({
            id: t.String()
        })
    });
