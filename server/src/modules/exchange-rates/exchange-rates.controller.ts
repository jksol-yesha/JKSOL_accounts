import { ExchangeRateService } from '../../shared/exchange-rate.service';
import type { ElysiaContext } from '../../shared/auth.middleware';

export const getExchangeRate = async ({ query, user, orgId }: ElysiaContext & { query: { from: string, to: string } }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");

    const { from, to } = query;
    if (!from || !to) {
        throw new Error("Missing 'from' or 'to' currency parameters");
    }

    const rate = await ExchangeRateService.getRate(from, to, orgId);
    return {
        success: true,
        data: {
            from,
            to,
            rate
        }
    };
};
