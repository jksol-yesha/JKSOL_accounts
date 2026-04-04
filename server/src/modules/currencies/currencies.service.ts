import { CurrencyMasterService } from '../../shared/currency-master.service';

export class CurrenciesService {
    static async getAll() {
        return CurrencyMasterService.getAll();
    }
}
