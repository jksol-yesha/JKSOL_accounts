function testExtraction(combinedText) {
    let narration = combinedText;
    let closingBalance = null;
    let amount1 = null;

    const tokens = combinedText.split(/\s+/);
    if (tokens.length > 0) {
      const lastToken = tokens[tokens.length - 1];
      const isAmountToken = (str) => /^[\d,]+\.\d{2}$/.test(str);

      if (isAmountToken(lastToken)) {
        const secondLast = tokens[tokens.length - 2];
        let successfullyParsed = false;
        
        if (secondLast && isAmountToken(secondLast)) {
          if (secondLast.replace(/,/g, '').length < 15) {
            closingBalance = lastToken;
            amount1 = secondLast;
            successfullyParsed = true;
          }
        }
        
        if (!successfullyParsed && secondLast) {
          const fusedRemarkAmt = secondLast.match(/^(.+?)([\d,]+\.\d{2})$/);
          if (fusedRemarkAmt) {
             const extractedAmt = fusedRemarkAmt[2];
             if (extractedAmt.replace(/,/g, '').length < 15) {
                closingBalance = lastToken;
                amount1 = extractedAmt;
             }
          }
        }
      } else {
        const fusedRegex = /^([\d,]+\.\d{2})([\d,]+\.\d{2})$/;
        const fusedMatch = lastToken.match(fusedRegex);
        if (fusedMatch) {
          const amt1 = fusedMatch[1];
          if (amt1.replace(/,/g, '').length < 15) {
            amount1 = amt1;
            closingBalance = fusedMatch[2];
          }
        } else {
          const superFused = lastToken.match(/^(.+?)([\d,]+\.\d{2})([\d,]+\.\d{2})$/);
          if (superFused) {
             const extractedAmt = superFused[2];
             if (extractedAmt.replace(/,/g, '').length < 15) {
                amount1 = extractedAmt;
                closingBalance = superFused[3];
             }
          }
        }
      }
    }
    console.log({ combinedText, amount1, closingBalance });
}

testExtraction("TRF TO FD no. 183710003876 22500000.00 2177915.89");
testExtraction("TRF TO FD no. 18371000387622500000.00 2177915.89"); // Fused ID + Amount
testExtraction("TRF TO FD no. 183710003876 22500000.002177915.89"); // Fused Amount + Balance
testExtraction("TRF TO FD no. 18371000387622500000.002177915.89"); // Super Fused
testExtraction("TRF TO FD no. 183710003876 22500000.00 2177915.89 Cr"); // With Cr
testExtraction("TRF TO FD no. 183710003876 22500000.0 2177915.89"); // Missing decimal digit
