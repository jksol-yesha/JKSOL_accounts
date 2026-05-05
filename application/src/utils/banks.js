export const COMMON_BANKS = [
    // 🇮🇳 INDIA BANKS
    { name: "State Bank of India", country: "IN", domain: "sbi.co.in", swift: "SBININBB" },
    { name: "HDFC Bank", country: "IN", domain: "hdfcbank.com", swift: "HDFCINBB" },
    { name: "ICICI Bank", country: "IN", domain: "icicibank.com", swift: "ICICINBB" },
    { name: "Axis Bank", country: "IN", domain: "axisbank.com", swift: "AXISINBB" },
    { name: "Kotak Mahindra Bank", country: "IN", domain: "kotak.com", swift: "KKBKINBB" },
    { name: "Punjab National Bank", country: "IN", domain: "pnbindia.in", swift: "PUNBINBB" },
    { name: "Bank of Baroda", country: "IN", domain: "bankofbaroda.in", swift: "BARBINBB" },
    { name: "Canara Bank", country: "IN", domain: "canarabank.com", swift: "CNRBINBB" },
    { name: "Union Bank of India", country: "IN", domain: "unionbankofindia.co.in", swift: "UBININBB" },
    { name: "Indian Bank", country: "IN", domain: "indianbank.in", swift: "IDIBINBB" },
    { name: "Bank of India", country: "IN", domain: "bankofindia.co.in", swift: "BKIDINBB" },
    { name: "Central Bank of India", country: "IN", domain: "centralbankofindia.co.in", swift: "CBININBB" },
    { name: "UCO Bank", country: "IN", domain: "ucobank.com", swift: "UCBAINBB" },
    { name: "Punjab & Sind Bank", country: "IN", domain: "psbindia.com", swift: "PSIBINBB" },
    { name: "IDBI Bank", country: "IN", domain: "idbibank.in", swift: "IBKLINBB" },
    { name: "Yes Bank", country: "IN", domain: "yesbank.in", swift: "YESBINBB" },
    { name: "IndusInd Bank", country: "IN", domain: "indusind.com", swift: "INDBINBB" },
    { name: "RBL Bank", country: "IN", domain: "rblbank.com", swift: "RATNINBB" },
    { name: "Federal Bank", country: "IN", domain: "federalbank.co.in", swift: "FDRLINBB" },
    { name: "South Indian Bank", country: "IN", domain: "southindianbank.com", swift: "SIBLINBB" },
    { name: "Bandhan Bank", country: "IN", domain: "bandhanbank.com", swift: "BANDINBB" },
    { name: "AU Small Finance Bank", country: "IN", domain: "aubank.in", swift: "AUBLINBB" },
    { name: "Ujjivan Small Finance Bank", country: "IN", domain: "ujjivansfb.in", swift: "UJVNINBB" },
    { name: "Equitas Small Finance Bank", country: "IN", domain: "equitasbank.com", swift: "ESFBINBB" },
  
    // 🇺🇸 USA BANKS
    { name: "JPMorgan Chase", country: "US", domain: "chase.com", swift: "CHASUS33" },
    { name: "Bank of America", country: "US", domain: "bankofamerica.com", swift: "BOFAUS3N" },
    { name: "Wells Fargo", country: "US", domain: "wellsfargo.com", swift: "WFBIUS6S" },
    { name: "Citibank", country: "US", domain: "citibank.com", swift: "CITIUS33" },
    { name: "U.S. Bank", country: "US", domain: "usbank.com", swift: "USBKUS44" },
    { name: "PNC Bank", country: "US", domain: "pnc.com", swift: "PNCCUS33" },
    { name: "Capital One", country: "US", domain: "capitalone.com", swift: "NFBKUS33" },
    { name: "TD Bank (US)", country: "US", domain: "tdbank.com", swift: "NRTHUS33" },
    { name: "Truist Bank", country: "US", domain: "truist.com", swift: "SNTRUS3A" },
    { name: "Goldman Sachs Bank", country: "US", domain: "goldmansachs.com", swift: "GSUS33" },
    { name: "Morgan Stanley Bank", country: "US", domain: "morganstanley.com", swift: "MSNYUS33" },
    { name: "American Express Bank", country: "US", domain: "americanexpress.com", swift: "AEIBUS33" },
    { name: "HSBC Bank USA", country: "US", domain: "us.hsbc.com", swift: "MRMDUS33" },
    { name: "Charles Schwab Bank", country: "US", domain: "schwab.com", swift: "SCHWUS33" },
    { name: "Ally Bank", country: "US", domain: "ally.com", swift: "ALLYUS33" },
    { name: "Discover Bank", country: "US", domain: "discover.com", swift: "IRVTUS3N" },
    { name: "Fifth Third Bank", country: "US", domain: "53.com", swift: "FTBCUS3C" },
    { name: "KeyBank", country: "US", domain: "key.com", swift: "KEYBUS33" },
    { name: "Regions Bank", country: "US", domain: "regions.com", swift: "UPNBUS44" },
    { name: "Huntington Bank", country: "US", domain: "huntington.com", swift: "HUNTUS33" },
    
    // 🌐 OTHER/USER BANKS
    { name: "Wio Bank", country: "AE", domain: "wio.io", swift: "" },
    { name: "NJ India", country: "IN", domain: "njgroup.in", swift: "" }
];

/**
 * Perform a robust fuzzy match on a given bank name or alias.
 * Returns the matching bank object or null.
 */
export const getBankDetailsByName = (searchName) => {
    if (!searchName || typeof searchName !== 'string') return null;
    
    // Normalize string: lowercase, remove non-alphanumerics, and handle specific abbreviations
    const normalized = searchName.trim().toLowerCase().replace(/[^a-z0-9 ]/gi, '');
    
    // Specific aliases that might completely obscure the exact name
    const ALIAS_MAP = {
        'sbi': 'state bank of india',
        'pnb': 'punjab national bank',
        'bob': 'bank of baroda',
        'yes': 'yes bank',
        'yesb': 'yes bank',
        'cbi': 'central bank of india',
        'aubank': 'au small finance bank',
        'idfc': 'idfc first bank', // handled optionally later if IDFC is added
        'boa': 'bank of america',
        'chase': 'jpmorgan chase',
        'amex': 'american express bank',
        'wio': 'wio bank',
        'nj': 'nj india'
    };

    // Check if the exact alias matches
    const mappedSearch = ALIAS_MAP[normalized] || normalized;

    // 1. Exact or startsWith match
    const perfectMatch = COMMON_BANKS.find(
        b => b.name.toLowerCase() === mappedSearch || 
             b.swift.toLowerCase() === mappedSearch
    );
    if (perfectMatch) return perfectMatch;

    // 2. Contains match
    for (const bank of COMMON_BANKS) {
        const lowerBankName = bank.name.toLowerCase();
        
        // e.g. "HDFC" matches "HDFC Bank"
        if (lowerBankName.includes(mappedSearch) || mappedSearch.includes(lowerBankName)) {
            return bank;
        }

        // Special handling for acronyms missing 'bank' word
        if (mappedSearch.length > 2) {
            const strippedBankName = lowerBankName.replace(' bank', '').trim();
            if (strippedBankName && (strippedBankName.includes(mappedSearch) || mappedSearch.includes(strippedBankName))) {
                return bank;
            }
        }
    }

    return null;
};

/**
 * Get the Hunter.io logo URL for a valid bank name or explicit alias strictly.
 */
export const getBankLogoAPIUrl = (bankName) => {
    const bank = getBankDetailsByName(bankName);
    
    if (bank && bank.domain) {
        return `https://logos.hunter.io/${bank.domain}`;
    }
    return null;
};
