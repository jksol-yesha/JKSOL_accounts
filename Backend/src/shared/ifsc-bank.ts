const BANK_REGISTRY: Record<string, { bankName: string; bankLogoKey: string | null }> = {
    HDFC: { bankName: 'HDFC Bank', bankLogoKey: 'hdfc' },
    ICIC: { bankName: 'ICICI Bank', bankLogoKey: 'icici' },
    UTIB: { bankName: 'Axis Bank', bankLogoKey: 'axis' },
    BARB: { bankName: 'Bank of Baroda', bankLogoKey: 'bob' },
    SBIN: { bankName: 'State Bank of India', bankLogoKey: null },
    PUNB: { bankName: 'Punjab National Bank', bankLogoKey: null },
    KKBK: { bankName: 'Kotak Mahindra Bank', bankLogoKey: null },
    YESB: { bankName: 'Yes Bank', bankLogoKey: null },
    IDIB: { bankName: 'Indian Bank', bankLogoKey: null },
    IDFB: { bankName: 'IDFC First Bank', bankLogoKey: null },
    CNRB: { bankName: 'Canara Bank', bankLogoKey: null },
    UBIN: { bankName: 'Union Bank of India', bankLogoKey: null },
    IOBA: { bankName: 'Indian Overseas Bank', bankLogoKey: null },
    BKID: { bankName: 'Bank of India', bankLogoKey: null },
    MAHB: { bankName: 'Bank of Maharashtra', bankLogoKey: null },
    PSIB: { bankName: 'Punjab & Sind Bank', bankLogoKey: null },
    INDB: { bankName: 'IndusInd Bank', bankLogoKey: null },
    CSBK: { bankName: 'CSB Bank', bankLogoKey: null },
    KVBL: { bankName: 'Karur Vysya Bank', bankLogoKey: null },
    FDRL: { bankName: 'Federal Bank', bankLogoKey: null },
    SIBL: { bankName: 'South Indian Bank', bankLogoKey: null },
    TMBL: { bankName: 'Tamilnad Mercantile Bank', bankLogoKey: null },
    RATN: { bankName: 'RBL Bank', bankLogoKey: null },
    DBSS: { bankName: 'DBS Bank India', bankLogoKey: null },
    FINO: { bankName: 'Fino Payments Bank', bankLogoKey: null },
    IPOS: { bankName: 'India Post Payments Bank', bankLogoKey: null },
    AUBL: { bankName: 'AU Small Finance Bank', bankLogoKey: null },
    ESFB: { bankName: 'Equitas Small Finance Bank', bankLogoKey: null },
    SVCB: { bankName: 'SVC Co-operative Bank', bankLogoKey: null },
    NKGS: { bankName: 'NKGSB Co-operative Bank', bankLogoKey: null },
};

export const resolveBankFromIfsc = (ifsc?: string | null) => {
    const normalizedIfsc = String(ifsc || '').trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalizedIfsc)) {
        return {
            ifsc: normalizedIfsc || null,
            bankCode: null,
            bankName: null,
            bankLogoKey: null
        };
    }

    const bankCode = normalizedIfsc.slice(0, 4);
    const matched = BANK_REGISTRY[bankCode] || null;

    return {
        ifsc: normalizedIfsc,
        bankCode,
        bankName: matched?.bankName || null,
        bankLogoKey: matched?.bankLogoKey || null
    };
};
