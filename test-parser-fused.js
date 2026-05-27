const isAmountToken = (str) => /^[\d,]+\.\d{2}$/.test(str);
const secondLast = "18371000387622500000.00";
console.log("isAmountToken:", isAmountToken(secondLast));

if (isAmountToken(secondLast)) {
   if (secondLast.replace(/,/g, '').length < 15) {
       console.log("Valid Amount");
   } else {
       console.log("Failed Length Check! Does not fall to else if!");
       // THIS IS WHERE IT DIES
   }
} else if (secondLast) {
   const fusedRemarkAmt = secondLast.match(/^(.+?)([\d,]+\.\d{2})$/);
   console.log("Fallback", fusedRemarkAmt);
}
