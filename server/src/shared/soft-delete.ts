import { sql } from 'drizzle-orm';

export const ACTIVE_STATUS = 1;
export const INACTIVE_STATUS = 2;
export const DELETED_STATUS = 3;

type SoftDeleteTable = {
    status: unknown;
};

export const isActiveStatus = (status: unknown) => Number(status) === ACTIVE_STATUS;

export const isNotDeleted = (table: SoftDeleteTable) => sql`${table.status as any} != ${DELETED_STATUS}`;
