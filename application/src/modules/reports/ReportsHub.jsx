import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, 
    PieChart, 
    BarChart3, 
    ListTree, 
    Landmark, 
    Users, 
    ShoppingBag, 
    ArrowLeftRight,
    TrendingUp
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import PageContentShell from '../../components/layout/PageContentShell';

const ReportCard = ({ title, description, icon: Icon, id, path }) => {
    const navigate = useNavigate();
    
    return (
        <div 
            onClick={() => navigate(path || `/reports/view/${id}`)}
            className="group flex flex-col p-4 md:p-5 bg-white border border-gray-200 rounded-lg cursor-pointer hover:shadow-xl hover:border-primary/20 transition-all duration-300"
        >
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 flex-none flex items-center justify-center rounded-md bg-slate-50 text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Icon size={20} strokeWidth={2} />
                </div>
                <h3 className="text-sm font-bold text-slate-800">{title}</h3>
            </div>
            <p className="text-xs font-medium text-slate-500 leading-relaxed group-hover:text-slate-600">
                {description}
            </p>
        </div>
    );
};

const ReportsHub = () => {
    return (
        <div className="flex flex-col h-full min-h-0 bg-slate-50/30">
            <div className="flex-none">
                <PageHeader
                    title="Financial Reports"
                    breadcrumbs={['Portal', 'Reports Hub']}
                />
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 md:px-4 xl:px-6 pt-4 pb-10 animate-in fade-in duration-500">
                <div className="space-y-6">
                    
                    {/* Section: Financial Statements */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                            <Landmark size={18} className="text-primary" />
                            <h2 className="text-[13px] font-extrabold text-slate-700 uppercase tracking-widest">Financial Statements</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
                            <ReportCard
                                id="pl"
                                title="Profit & Loss"
                                description="Calculate net profit or loss over a defined period based on income and expense transactions."
                                icon={TrendingUp}
                            />
                        </div>
                    </div>

                    {/* Section: Transaction Insights */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                            <ArrowLeftRight size={18} className="text-primary" />
                            <h2 className="text-[13px] font-extrabold text-slate-700 uppercase tracking-widest">Transaction Ledgers</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
                            <ReportCard
                                id="summary"
                                title="Transaction Summary"
                                description="A high-level aggregated summary of all transaction activities, categorized by primary types."
                                icon={PieChart}
                            />
                            <ReportCard
                                id="detailed"
                                title="Detailed Transactions"
                                description="A chronological, itemized list of every transaction logged within the system."
                                icon={ListTree}
                            />
                            <ReportCard
                                id="debit_credit"
                                title="Debit/Credit Ledger"
                                description="A classic dual-entry ledger view showing debits, credits, and running balances."
                                icon={BarChart3}
                            />
                        </div>
                    </div>

                    {/* Section: Entity Insights */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                            <LayoutDashboard size={18} className="text-primary" />
                            <h2 className="text-[13px] font-extrabold text-slate-700 uppercase tracking-widest">Entity Insights</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
                            <ReportCard
                                id="category"
                                title="Category-wise Overview"
                                description="Analyze cash flow broken down explicitly by account categories and sub-categories."
                                icon={ShoppingBag}
                            />
                            <ReportCard
                                id="account"
                                title="Account-wise Overview"
                                description="View transaction histories and balances isolated by specific bank or cash accounts."
                                icon={Landmark}
                            />
                            <ReportCard
                                id="party"
                                title="Party-wise Overview"
                                description="Track all transactional activities associated with specific third-party contacts and clients."
                                icon={Users}
                            />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ReportsHub;
