import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/layout/PageHeader';
import PageContentShell from '../../components/layout/PageContentShell';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { NewCategoryCard, NewSubCategoryCard } from './components/CategoryCard';
import CategoryRegistry from './components/CategoryRegistry';
import QuickAddSubModal from './components/QuickAddSubModal';
import EditCategoryModal from './components/EditCategoryModal';
import EditSubCategoryModal from './components/EditSubCategoryModal';
import apiService from '../../services/api';
import { useBranch } from '../../context/BranchContext';
import { useYear } from '../../context/YearContext';
import { useToast } from '../../context/ToastContext';

const createInitialDeleteDialog = () => ({
    open: false,
    type: null,
    id: null,
    name: '',
    loading: false
});

const isUsedCategoryDeleteError = (message) => {
    const value = String(message || '');
    return /cannot delete this (category|subcategory) because it is used in associated records/i.test(value)
        || /modify (the )?status to 'inactive'/i.test(value);
};

const Category = () => {
    const { selectedBranch, loading: branchLoading } = useBranch();
    const { selectedYear } = useYear();
    const { showToast } = useToast();
    const [categories, setCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isEditSubOpen, setIsEditSubOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedSubCategory, setSelectedSubCategory] = useState(null);
    const [pageSize, setPageSize] = useState(20);
    const [deleteDialog, setDeleteDialog] = useState(createInitialDeleteDialog);
    const cacheKey = `categories:registry:v6:${selectedBranch?.id || 'all'}`;

    const extractCategoryErrorMessage = (error, fallbackMessage) => {
        return error?.response?.data?.message || error?.message || fallbackMessage;
    };

    const normalizeCategoryListResponse = (response) => {
        if (Array.isArray(response)) return response;
        if (response && Array.isArray(response.data)) return response.data;
        if (response?.success && Array.isArray(response.data)) return response.data;
        return [];
    };

    const normalizeCategoryType = (value = '') => String(value).trim().toLowerCase();

    const toCategoryTypeLabel = (value = '') => {
        const normalized = normalizeCategoryType(value);
        if (normalized === 'income') return 'Income';
        if (normalized === 'investment') return 'Investment';
        return 'Expense';
    };

    const getCategoryTypeValue = (category = {}) => (
        category?.type ||
        category?.txnType ||
        category?.transactionType?.name ||
        ''
    );

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(cacheKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.categories)) {
                setCategories(parsed.categories);
            }
            if (Array.isArray(parsed?.subCategories)) {
                setSubCategories(parsed.subCategories);
            }
            if (Array.isArray(parsed?.categories) || Array.isArray(parsed?.subCategories)) {
                setHasFetchedOnce(true);
            }
        } catch {
            // Ignore cache parse errors and continue with live fetch
        }
    }, [cacheKey]);

    const fetchCategories = async (signal) => {
        setLoading(true);
        try {
            const response = await apiService.categories.getAll({}, { signal });
            let allCats = normalizeCategoryListResponse(response);

            // Clean up missing transactionCounts and lastUsedDates
            allCats.forEach(c => {
                c.transactionCount = Number(c.transactionCount || 0);
                c.lastUsedDate = c.lastUsedDate || '';
                c.type = toCategoryTypeLabel(getCategoryTypeValue(c));

                if (Array.isArray(c.subCategories)) {
                    c.subCategories = c.subCategories.map((sub) => ({
                        ...sub,
                        categoryId: c.id,
                        parentId: c.id,
                        parentName: c.name,
                        parentType: c.type,
                        transactionCount: Number(sub.transactionCount || 0),
                        lastUsedDate: sub.lastUsedDate || ''
                    }));
                }
            });

            // Extract subCategories out for flat registry table mapping
            const allSubs = allCats.flatMap(c => c.subCategories || []);

            setCategories(allCats);
            setSubCategories(allSubs);

            try {
                sessionStorage.setItem(cacheKey, JSON.stringify({
                    categories: allCats,
                    subCategories: allSubs
                }));
            } catch {
                // Ignore storage errors
            }
        } catch (error) {
            if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') return;
            console.error("Failed to fetch categories:", error);
            setCategories([]);
            setSubCategories([]);
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
                setHasFetchedOnce(true);
            }
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        if (!branchLoading && selectedBranch?.id) {
            fetchCategories(controller.signal);
        }
        return () => controller.abort();
    }, [cacheKey, branchLoading, selectedBranch?.id ? String(selectedBranch.id) : null]);

    const handleCreateCategory = async (catData) => {
        try {
            const payload = {
                ...catData,
                txnType: (catData.type || 'expense').toLowerCase()
            };
            delete payload.type;
            await apiService.categories.create(payload);
            fetchCategories();
        } catch (error) {
            console.error("Failed to create category:", error);
            throw new Error(extractCategoryErrorMessage(error, "Failed to create category"));
        }
    };

    const handleCreateSubCategory = async (subData) => {
        try {
            const payload = {
                categoryId: Number(subData.parentId),
                name: subData.name
            };
            await apiService.categories.createSub(payload);
            fetchCategories();
        } catch (error) {
            console.error("Failed to create subcategory:", error);
            throw new Error(extractCategoryErrorMessage(error, "Failed to create subcategory"));
        }
    };

    const handleUpdateCategory = async (id, updatedData) => {
        try {
            const payload = { ...updatedData };
            if (payload.type) {
                payload.txnType = payload.type.toLowerCase();
                delete payload.type;
            }
            await apiService.categories.update(id, payload);
            fetchCategories();
        } catch (error) {
            console.error("Failed to update category:", error);
            throw new Error(extractCategoryErrorMessage(error, "Failed to update category"));
        }
    };

    const handleUpdateSubCategory = async (id, updatedData) => {
        try {
            await apiService.categories.updateSub(id, updatedData);
            fetchCategories();
        } catch (error) {
            console.error("Failed to update subcategory:", error);
            throw new Error(extractCategoryErrorMessage(error, "Failed to update sub-category"));
        }
    };

    const deleteCategoryById = async (id) => {
        try {
            await apiService.categories.delete(id);
            await fetchCategories();
        } catch (error) {
            console.error("Failed to delete category:", error);
            const msg = error.response?.data?.message || error.message || "Failed to delete category";
            throw new Error(msg);
        }
    };

    const deleteSubCategoryById = async (id) => {
        try {
            await apiService.categories.deleteSub(id);
            await fetchCategories();
        } catch (error) {
            console.error("Failed to delete subcategory:", error);
            const msg = error.response?.data?.message || error.message || "Failed to delete subcategory";
            throw new Error(msg);
        }
    };

    const handleDeleteCategory = (id) => {
        const targetCategory = categories.find((cat) => String(cat.id) === String(id));
        setDeleteDialog({
            open: true,
            type: 'category',
            id,
            name: targetCategory?.name || '',
            loading: false
        });
    };

    const handleDeleteSubCategory = (id) => {
        const targetSubCategory = subCategories.find((sub) => String(sub.id) === String(id));
        setDeleteDialog({
            open: true,
            type: 'subcategory',
            id,
            name: targetSubCategory?.name || '',
            loading: false
        });
    };

    const handleCloseDeleteDialog = () => {
        setDeleteDialog((current) => (
            current.loading ? current : createInitialDeleteDialog()
        ));
    };

    const handleConfirmDelete = async () => {
        const { id, type } = deleteDialog;
        if (!id || !type) return;

        setDeleteDialog((current) => ({ ...current, loading: true }));

        try {
            if (type === 'subcategory') {
                await deleteSubCategoryById(id);
            } else {
                await deleteCategoryById(id);
            }

            setDeleteDialog(createInitialDeleteDialog());
        } catch (error) {
            const msg = error?.message || "Failed to delete category";
            setDeleteDialog(createInitialDeleteDialog());
            showToast(
                msg,
                'error',
                isUsedCategoryDeleteError(msg)
                    ? {
                        persistent: true,
                        duration: 0
                    }
                    : undefined
            );
        }
    };

    const handleToggleStatus = async (id, newStatus) => {
        try {
            await apiService.categories.update(id, { status: newStatus });
            fetchCategories();
        } catch (error) {
            console.error("Failed to update status:", error);
        }
    };

    const handleToggleSubStatus = async (subCategory, newStatus) => {
        try {
            await handleUpdateSubCategory(
                subCategory.id,
                { status: newStatus }
            );
        } catch (error) {
            console.error("Failed to update sub-category status:", error);
        }
    };

    const handleOpenQuickAdd = (parent) => {
        setSelectedCategory(parent);
        setIsQuickAddOpen(true);
    };

    const handleOpenEdit = (category) => {
        setSelectedCategory(category);
        setIsEditOpen(true);
    };

    const handleOpenEditSub = (sub) => {
        setSelectedSubCategory(sub);
        setIsEditSubOpen(true);
    };

    const deleteTargetLabel = deleteDialog.type === 'subcategory' ? 'Sub-Category' : 'Category';
    const deleteTargetDescriptor = deleteDialog.type === 'subcategory' ? 'sub-category' : 'category';
    const deleteDialogMessage = deleteDialog.name
        ? `Are you sure you want to archive "${deleteDialog.name}"? It will be hidden from active lists.`
        : `Are you sure you want to archive this ${deleteTargetDescriptor}? It will be hidden from active lists.`;

    return (
        <PageContentShell
            header={(
                <PageHeader
                    title="Category Management"
                    breadcrumbs={['Apps', 'Categories']}
                />
            )}
            className="category-laptop-page-shell"
            contentClassName="category-laptop-page-content flex flex-col"
            cardClassName="bg-transparent border-none shadow-none overflow-visible lg:overflow-hidden"
        >
            <style>{`
                @media print {
                    @page { margin: 12mm; }
                    body { background: white !important; }
                    .print\\:hidden { display: none !important; }
                    .print\\:w-full { width: 100% !important; }
                    .print\\:block { display: block !important; }
                    /* Reset Grid for Print to allow full width */
                    .grid { display: block !important; }
                    .lg\\:col-span-8 { width: 100% !important; max-width: none !important; }
                }
            `}</style>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0 items-start category-laptop-page-grid">
                {/* Left Panel: Creation Forms */}
                <div className="lg:col-span-4 flex flex-col space-y-6 lg:sticky lg:top-8 print:hidden category-laptop-left-panel">
                    <NewCategoryCard
                        onCategoryCreate={handleCreateCategory}
                    />
                    <div className="">
                        <NewSubCategoryCard
                            categories={categories}
                            onSubCategoryCreate={handleCreateSubCategory}
                        />
                    </div>
                </div>

                {/* Right Panel: Registry Table */}
                <div className="lg:col-span-8 lg:min-h-0 min-h-[400px] self-start print:w-full category-laptop-right-panel">
                    <CategoryRegistry
                        categories={categories}
                        subCategories={subCategories}
                        selectedYearId={selectedYear?.id}
                        onDeleteCategory={handleDeleteCategory}
                        onDeleteSubCategory={handleDeleteSubCategory}
                        onToggleStatus={handleToggleStatus}
                        onToggleSubStatus={handleToggleSubStatus}
                        onQuickAddSub={handleOpenQuickAdd}
                        onEditCategory={handleOpenEdit}
                        onEditSubCategory={handleOpenEditSub}
                        pageSize={pageSize}
                        setPageSize={setPageSize}
                        loading={loading}
                        hasFetchedOnce={hasFetchedOnce}
                    />
                </div>
            </div>

            {/* Modals */}
            <QuickAddSubModal
                isOpen={isQuickAddOpen}
                onClose={() => setIsQuickAddOpen(false)}
                parentCategory={selectedCategory}
                onSave={async (subData) => {
                    await handleCreateSubCategory({ parentId: selectedCategory.id, ...subData });
                }}
            />

            <EditCategoryModal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                category={selectedCategory}
                onSave={handleUpdateCategory}
            />

            <EditSubCategoryModal
                isOpen={isEditSubOpen}
                onClose={() => setIsEditSubOpen(false)}
                subCategory={selectedSubCategory}
                onSave={handleUpdateSubCategory}
            />

            <ConfirmDialog
                open={deleteDialog.open}
                title={`Delete ${deleteTargetLabel}`}
                message={deleteDialogMessage}
                confirmLabel={`Yes, Delete ${deleteTargetLabel}`}
                isSubmitting={deleteDialog.loading}
                onCancel={handleCloseDeleteDialog}
                onConfirm={handleConfirmDelete}
            />
        </PageContentShell>
    );
};

export default Category;
