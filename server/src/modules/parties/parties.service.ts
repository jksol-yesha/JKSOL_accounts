import { db } from '../../db';
import { parties, transactions } from '../../db/schema';
import { eq, and, desc, or, ilike } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { DELETED_STATUS, isNotDeleted } from '../../shared/soft-delete';

const buildDeletedPartyValue = (
    value: string | null | undefined,
    maxLength: number,
    fallbackLabel: string,
    deletedAt: number
) => {
    const suffix = ` [DELETED ${deletedAt}]`;
    const trimmedValue = String(value || '').trim();
    const baseValue = trimmedValue.slice(0, Math.max(0, maxLength - suffix.length)).trim();
    return `${baseValue || fallbackLabel}${suffix}`;
};

export async function createParty(data: any) {
    const [result] = await db.insert(parties).values({
        orgId: data.orgId,
        companyName: data.companyName,
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address,
        gstNo: data.gstNo || '',
        gstName: data.gstName || '',
        status: data.isActive ? 1 : 2,
        createdBy: data.userId,
    });

    const insertedId = result.insertId;
    const [newParty] = await db.select().from(parties).where(eq(parties.id, insertedId));

    await AuditService.log(data.orgId, 'party', insertedId, 'create', data.userId, null, newParty);

    return newParty;
}

export async function getAllParties(
    orgId: number,
    status?: 1 | 2 | 3
) {
    let conditions = [eq(parties.orgId, orgId), isNotDeleted(parties)];

    if (status) {
        conditions.push(eq(parties.status, status));
    }

    const result = await db
        .select({
            id: parties.id,
            orgId: parties.orgId,
            companyName: parties.companyName,
            name: parties.name,
            email: parties.email,
            phone: parties.phone,
            address: parties.address,
            gstNo: parties.gstNo,
            gstName: parties.gstName,
            status: parties.status,
            createdAt: parties.createdAt,
            updatedAt: parties.updatedAt
        })
        .from(parties)
        .where(and(...conditions))
        .orderBy(desc(parties.createdAt));

    return result.map(p => ({
        ...p,
        isActive: p.status === 1
    }));
}

export async function updateParty(id: number, data: any, orgId: number, userId: number) {
    const [oldParty] = await db.select().from(parties).where(and(eq(parties.id, id), isNotDeleted(parties)));
    if (!oldParty) throw new Error("Party not found");

    const updateData: any = {};
    if (data.companyName !== undefined) updateData.companyName = data.companyName;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.gstNo !== undefined) updateData.gstNo = data.gstNo;
    if (data.gstName !== undefined) updateData.gstName = data.gstName;
    if (data.isActive !== undefined) updateData.status = data.isActive ? 1 : 2;

    await db.update(parties)
        .set(updateData)
        .where(and(eq(parties.id, id), eq(parties.orgId, orgId)));

    const [updatedParty] = await db.select().from(parties).where(eq(parties.id, id));

    if (updatedParty) {
        await AuditService.log(orgId, 'party', id, 'update', userId, oldParty, updatedParty);
    }

    return {
        ...(updatedParty || oldParty),
        isActive: (updatedParty ? updatedParty.status : oldParty.status) === 1
    };
}

export async function deleteParty(id: number, orgId: number, userId?: number) {
    const [party] = await db.select().from(parties).where(and(eq(parties.id, id), isNotDeleted(parties)));
    if (!party) throw new Error("Party not found");

    if (party.orgId !== orgId) throw new Error("Unauthorized access to this party");

    const [usage] = await db.select({ id: transactions.id })
        .from(transactions)
        .where(and(
            eq(transactions.orgId, orgId),
            eq(transactions.contactId, id),
            isNotDeleted(transactions)
        ))
        .limit(1);

    if (usage) {
        throw new Error("Cannot delete this party because it is used in associated records (Transactions).");
    }

    const deletedAt = Date.now();

    await db.update(parties)
        .set({
            companyName: buildDeletedPartyValue(party.companyName, 255, 'Party', deletedAt),
            name: buildDeletedPartyValue(party.name, 255, 'Party', deletedAt),
            gstName: buildDeletedPartyValue(party.gstName, 255, party.companyName || 'Party', deletedAt),
            status: DELETED_STATUS,
            updatedAt: new Date()
        })
        .where(and(eq(parties.id, id), eq(parties.orgId, orgId)));

    if (userId) {
        await AuditService.log(orgId, 'party', id, 'delete', userId, party, null);
    }
}
