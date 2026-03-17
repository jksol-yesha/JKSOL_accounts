import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/layout/PageHeader';
import PageContentShell from '../../components/layout/PageContentShell';
import { NewCategoryCard, NewSubCategoryCard } from './components/CategoryCard';
import CategoryRegistry from './components/CategoryRegistry';
import QuickAddSubModal from './components/QuickAddSubModal';
import EditCategoryModal from './components/EditCategoryModal';
import EditSubCategoryModal from './components/EditSubCategoryModal';
import apiService from '../../services/api';
import { useBranch } from '../../context/BranchContext';

const Category = () => {
    const { selectedBranch, getBranchFilterValue, branches } = useBranch();
    const showBranchColumn = false;
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
    const cacheKey = `categories:registry:${selectedBranch?.id || 'all'}`;

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
        } catch (error) {
            // Ignore cache parse errors and continue with live fetch
        }
    }, [cacheKey]);

    const fetchCategories = async (signal) => {
        const branchFilter = 'all'; // Bypass global branch filter: Always fetch 'all' branches

        setLoading(true);
        try {
            // If branchFilter is an array (multi-branch or 'all'), we need to group identical categories.
            // If it's a single branch, we just use the response.
            // But we can safely use the grouping logic for both to maintain structure cleanly.
            const isMultiBranch = Array.isArray(branchFilter);

            // In multi-branch, we may fire Promise.all in the future, but right now the backend
            // might just return a flat list if branchFilter contains multiple IDs (e.g. backend handles it)
            // Or if backend expects single branch, we must do Promise.all like Accounts.
            // Let's modify let's assume the API might be called with Array like in Accounts.
            let allCats = [];
            if (isMultiBranch) {
                const responses = await Promise.all(
                    branchFilter.map(bId => apiService.categories.getAll({ branchId: bId }, { signal }))
                );
                responses.forEach((res, index) => {
                    const branchCats = (res && Array.isArray(res.data)) ? res.data : (Array.isArray(res) ? res : []);
                    const targetBId = String(branchFilter[index]);
                    const fallbackName = branches.find(b => String(b.id) === targetBId)?.name || 'Unknown Branch';
                    // Inject branch name so we can trace it
                    branchCats.forEach(c => {
                        c._sourceBranchId = c.branchId || targetBId;
                        c._sourceBranchName = c.branch?.name || branches.find(b => String(b.id) === String(c.branchId))?.name || fallbackName;
                    });
                    allCats.push(...branchCats);
                });
            } else {
                const response = await apiService.categories.getAll(
                    { branchId: branchFilter },
                    { signal }
                );
                let branchCats = (response && Array.isArray(response.data)) ? response.data : (Array.isArray(response) ? response : []);
                const targetBId = String(branchFilter);
                const fallbackName = branches.find(b => String(b.id) === targetBId)?.name || 'Unknown Branch';
                branchCats.forEach(c => {
                    c._sourceBranchId = c.branchId || targetBId;
                    c._sourceBranchName = c.branch?.name || branches.find(b => String(b.id) === String(c.branchId))?.name || fallbackName;
                });
                allCats = branchCats;
            }

            const groupedCats = new Map();
            const groupedSubs = new Map();

            allCats.forEach(c => {
                const catNameKey = (c.name || '').toLowerCase().trim();

                if (!groupedCats.has(catNameKey)) {
                    groupedCats.set(catNameKey, {
                        ...c,
                        type: c.txnType ? (c.txnType.charAt(0).toUpperCase() + c.txnType.slice(1)) : 'Expense',
                        branchNames: [c._sourceBranchName],
                        branchIds: [c._sourceBranchId]
                    });
                } else {
                    const existing = groupedCats.get(catNameKey);
                    if (!existing.branchIds.includes(c._sourceBranchId)) {
                        existing.branchNames.push(c._sourceBranchName);
                        existing.branchIds.push(c._sourceBranchId);
                    }
                }

                if (c.subCategories) {
                    c.subCategories.forEach(s => {
                        // Unique sub category key = Parent Name + Sub Name
                        const subNameKey = (s.name || '').toLowerCase().trim();
                        const uniqueSubKey = `${catNameKey}-${subNameKey}`;

                        // We use the first found parent ID as the definitive 'parentId' for the UI 
                        // It doesn't matter much internally as CreateTransaction matches by name anyway mapped back to single branch.
                        if (!groupedSubs.has(uniqueSubKey)) {
                            groupedSubs.set(uniqueSubKey, {
                                ...s,
                                parentId: groupedCats.get(catNameKey).id,
                                categoryId: groupedCats.get(catNameKey).id,
                                parentName: c.name,
                                branchNames: [c._sourceBranchName],
                                branchIds: [c._sourceBranchId]
                            });
                        } else {
                            const existingSub = groupedSubs.get(uniqueSubKey);
                            if (!existingSub.branchIds.includes(c._sourceBranchId)) {
                                existingSub.branchNames.push(c._sourceBranchName);
                                existingSub.branchIds.push(c._sourceBranchId);
                            }
                        }
                    });
                }
            });

            // Clean up temporary internal variables
            const flatCats = Array.from(groupedCats.values()).map(({ _sourceBranchId, _sourceBranchName, ...rest }) => rest);
            const flatSubs = Array.from(groupedSubs.values()).map(({ _sourceBranchId, _sourceBranchName, parentName, ...rest }) => rest);

            setCategories(flatCats);
            setSubCategories(flatSubs);
            try {
                sessionStorage.setItem(cacheKey, JSON.stringify({
                    categories: flatCats,
                    subCategories: flatSubs
                }));
            } catch (error) {
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
        fetchCategories(controller.signal);
        return () => controller.abort();
    }, [cacheKey, selectedBranch?.id ? String(selectedBranch.id) : null, getBranchFilterValue]);

    const handleCreateCategory = async (catData, targetBranchIds) => {
        const allBranchIds = (branches || []).map(b => Number(b.id)).filter(Boolean);
        const effectiveBranchIds = allBranchIds.length > 0
            ? allBranchIds
            : (targetBranchIds || []).map(Number).filter(Boolean);

        if (effectiveBranchIds.length === 0) {
            alert("No branches found to create category.");
            return;
        }

        try {
            await Promise.all(effectiveBranchIds.map(async (bId) => {
                const payload = {
                    ...catData,
                    txnType: (catData.type || 'expense').toLowerCase(),
                    branchId: bId
                };
                delete payload.type;
                await apiService.categories.create(payload);
            }));

            fetchCategories();
        } catch (error) {
            console.error("Failed to create category:", error);
            alert(error.response?.data?.message || "Failed to create category");
        }
    };

    const handleCreateSubCategory = async (subData) => {
        try {
            const sourceParentCat = categories.find(c => String(c.id) === String(subData.parentId));
            if (!sourceParentCat) {
                alert("Parent category not found.");
                return;
            }

            const allBranchIds = (branches || []).map(b => Number(b.id)).filter(Boolean);
            const targetIds = allBranchIds.length > 0
                ? allBranchIds
                : ((sourceParentCat.branchIds || [sourceParentCat._sourceBranchId || selectedBranch?.id])
                    .map(Number)
                    .filter(Boolean));

            for (const bId of targetIds) {
                let localParentId = subData.parentId;

                // If executing across multiple branches, we need to map the parent ID for each specific branch
                if (targetIds.length > 1) {
                    // Fetch categories for target branch to find the matching parent by name
                    const bCatsRes = await apiService.categories.getAll({ branchId: bId });
                    const bCats = (bCatsRes && Array.isArray(bCatsRes.data)) ? bCatsRes.data : (Array.isArray(bCatsRes) ? bCatsRes : []);
                    const localCat = bCats.find(c => c.name?.toLowerCase().trim() === sourceParentCat.name?.toLowerCase().trim());

                    if (localCat) {
                        localParentId = localCat.id;
                    } else {
                        console.warn(`Skipping sub-category creation in branch ${bId}: Parent category '${sourceParentCat.name}' not found.`);
                        continue; // Skip if parent does not exist in target branch
                    }
                }

                const payload = {
                    categoryId: Number(localParentId),
                    name: subData.name
                };
                await apiService.categories.createSub(payload);
            }

            fetchCategories();
        } catch (error) {
            console.error("Failed to create subcategory:", error);
            alert(error.response?.data?.message || "Failed to create subcategory");
        }
    };

    const handleUpdateCategory = async (id, updatedData, targetBranchIds, originalCategory) => {
        try {
            const payload = { ...updatedData };
            if (payload.type) {
                payload.txnType = payload.type.toLowerCase();
                delete payload.type;
            }

            // Update each selected branch's version of this category
            const existingBranchIds = (originalCategory?.branchIds || []).map(Number).filter(Boolean);

            for (const bId of targetBranchIds) {
                if (existingBranchIds.includes(Number(bId))) {
                    // Find the category in this branch to get its specific ID
                    const bCatsRes = await apiService.categories.getAll({ branchId: bId });
                    const bCats = (bCatsRes?.data || []);
                    const match = bCats.find(c => c.name?.toLowerCase().trim() === originalCategory.name?.toLowerCase().trim());
                    if (match) {
                        await apiService.categories.update(match.id, payload);
                    }
                } else {
                    // New branch selected — create there
                    const createPayload = { ...payload, branchId: Number(bId) };
                    await apiService.categories.create(createPayload);
                }
            }

            // Delete from de-selected branches
            const removedBranchIds = existingBranchIds.filter(bId => !targetBranchIds.map(Number).includes(Number(bId)));
            for (const bId of removedBranchIds) {
                const bCatsRes = await apiService.categories.getAll({ branchId: bId });
                const bCats = (bCatsRes?.data || []);
                const match = bCats.find(c => c.name?.toLowerCase().trim() === originalCategory.name?.toLowerCase().trim());
                if (match) {
                    await apiService.categories.delete(match.id);
                }
            }

            fetchCategories();
        } catch (error) {
            console.error("Failed to update category:", error);
            alert(error.response?.data?.message || error.message || "Failed to update category");
        }
    };

    const handleUpdateSubCategory = async (id, updatedData, targetBranchIds, originalSubCategory) => {
        try {
            const existingBranchIds = (originalSubCategory?.branchIds || []).map(Number).filter(Boolean);

            for (const bId of targetBranchIds) {
                if (existingBranchIds.includes(Number(bId))) {
                    // Find the sub-category in this branch
                    const bCatsRes = await apiService.categories.getAll({ branchId: bId });
                    const bCats = (bCatsRes?.data || []);
                    let matchSub = null;
                    for (const cat of bCats) {
                        const sub = (cat.subCategories || []).find(s => s.name?.toLowerCase().trim() === originalSubCategory.name?.toLowerCase().trim());
                        if (sub) { matchSub = sub; break; }
                    }
                    if (matchSub) {
                        await apiService.categories.updateSub(matchSub.id, updatedData);
                    }
                } else {
                    // New branch — create sub-category there: find parent cat first
                    const bCatsRes = await apiService.categories.getAll({ branchId: bId });
                    const bCats = (bCatsRes?.data || []);
                    const parentCat = categories.find(c => String(c.id) === String(originalSubCategory.categoryId || originalSubCategory.parentId));
                    if (parentCat) {
                        const matchParent = bCats.find(c => c.name?.toLowerCase().trim() === parentCat.name?.toLowerCase().trim());
                        if (matchParent) {
                            await apiService.categories.createSub({ categoryId: matchParent.id, name: updatedData.name || originalSubCategory.name });
                        }
                    }
                }
            }

            // Delete sub-category from de-selected branches
            const removedBranchIds = existingBranchIds.filter(bId => !targetBranchIds.map(Number).includes(Number(bId)));
            for (const bId of removedBranchIds) {
                const bCatsRes = await apiService.categories.getAll({ branchId: bId });
                const bCats = (bCatsRes?.data || []);
                let matchSub = null;
                for (const cat of bCats) {
                    const sub = (cat.subCategories || []).find(s => s.name?.toLowerCase().trim() === originalSubCategory.name?.toLowerCase().trim());
                    if (sub) { matchSub = sub; break; }
                }
                if (matchSub) {
                    await apiService.categories.deleteSub(matchSub.id);
                }
            }

            fetchCategories();
        } catch (error) {
            console.error("Failed to update subcategory:", error);
            alert(error.response?.data?.message || error.message || "Failed to update sub-category");
        }
    };

    const handleDeleteCategory = async (id) => {
        if (window.confirm('Delete this category?')) {
            try {
                await apiService.categories.delete(id);
                fetchCategories();
            } catch (error) {
                console.error("Failed to delete category:", error);
                const msg = error.response?.data?.message || error.message || "Failed to delete category";
                alert(msg);
            }
        }
    };

    const handleDeleteSubCategory = async (id) => {
        if (window.confirm('Delete sub-category?')) {
            try {
                await apiService.categories.deleteSub(id);
                fetchCategories();
            } catch (error) {
                console.error("Failed to delete subcategory:", error);
                const msg = error.response?.data?.message || error.message || "Failed to delete subcategory";
                alert(msg);
            }
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
            const targetBranchIds = (subCategory?.branchIds || []).map(Number).filter(Boolean);
            await handleUpdateSubCategory(
                subCategory.id,
                { status: newStatus },
                targetBranchIds,
                subCategory
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0 category-laptop-page-grid">
                    {/* Left Panel: Creation Forms */}
                    <div className="lg:col-span-4 flex flex-col space-y-6 lg:sticky lg:top-8 print:hidden category-laptop-left-panel">
                        <NewCategoryCard
                            selectedBranch={selectedBranch}
                            branches={branches}
                            onCategoryCreate={handleCreateCategory}
                        />
                        <div className="">
                            <NewSubCategoryCard
                                selectedBranch={selectedBranch}
                                branches={branches}
                                categories={categories}
                                onSubCategoryCreate={handleCreateSubCategory}
                            />
                        </div>
                    </div>

                    {/* Right Panel: Registry Table */}
                    <div className="lg:col-span-8 lg:h-full lg:min-h-0 lg:overflow-hidden min-h-[400px] print:w-full category-laptop-right-panel">
                        <CategoryRegistry
                            categories={categories}
                            subCategories={subCategories}
                            onDeleteCategory={handleDeleteCategory}
                            onDeleteSubCategory={handleDeleteSubCategory}
                            onToggleStatus={handleToggleStatus}
                            onToggleSubStatus={handleToggleSubStatus}
                            onQuickAddSub={handleOpenQuickAdd}
                            onEditCategory={handleOpenEdit}
                            onEditSubCategory={handleOpenEditSub}
                            pageSize={pageSize}
                            setPageSize={setPageSize}
                            showBranchColumn={showBranchColumn}
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
                    // Default quick add maps to the current single branch or parent category's logic.
                    const targetBranchId = selectedBranch?.id === 'all' || selectedBranch?.id === 'multi'
                        ? 'all-selection'
                        : selectedBranch?.id?.toString();
                    await handleCreateSubCategory({ parentId: selectedCategory.id, ...subData }, targetBranchId);
                }}
            />

            <EditCategoryModal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                category={selectedCategory}
                branches={branches}
                onSave={handleUpdateCategory}
            />

            <EditSubCategoryModal
                isOpen={isEditSubOpen}
                onClose={() => setIsEditSubOpen(false)}
                subCategory={selectedSubCategory}
                branches={branches}
                onSave={handleUpdateSubCategory}
            />
        </PageContentShell>
    );
};

export default Category;
