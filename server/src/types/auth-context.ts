export interface AuthContext {
    auth: {
        userId: number;
        orgId: number;
        role: string;
        email: string;
    };
    branchId: number | null;
    body: any;
    query: Record<string, string | undefined>;
    params: Record<string, string>;
    set: any;
}
