import { getBankDetailsByName, getBankLogoAPIUrl } from './application/src/utils/banks.js';
console.log("Wio Bank Result:", getBankDetailsByName("Wio Bank"));
console.log("Wio Bank URL:", getBankLogoAPIUrl("Wio Bank"));
