function testExtraction(combinedText) {
    let narration = combinedText;
    let closingBalance = null;
    let amount1 = null;

    const tokens = combinedText.split(/\s+/);
    if (tokens.length > 0) {
      const lastToken = tokens[tokens.length - 1];
      const isAmountToken = (str) => /^[\d,]+\.\d{2}$/.test(str);

      if (isAmountToken(lastToken)) {
         closingBalance = lastToken;
         const secondLast = tokens[tokens.length - 2];
         if (secondLast && isAmountToken(secondLast)) {
             if (secondLast.replace(/,/g, '').length < 15) {
                 amount1 = secondLast;
                 narration = tokens.slice(0, -2).join(' ').trim();
             } else {
                 amount1 = null;
                 narration = tokens.slice(0, -1).join(' ').trim();
             }
         } else if (secondLast) {
             const match = secondLast.match(/^(.+?)([\d,]+\.\d{2})$/);
             if (match && match[2].replace(/,/g, '').length < 15) {
                 amount1 = match[2];
                 const remarks = tokens.slice(0, -2);
                 remarks.push(match[1]);
                 narration = remarks.join(' ').trim();
             } else {
                 amount1 = null;
                 narration = tokens.slice(0, -1).join(' ').trim();
             }
         }
      } else {
         const matchBal = lastToken.match(/([\d,]+\.\d{2})$/);
         if (matchBal) {
             closingBalance = matchBal[1];
             const restOfToken = lastToken.slice(0, -matchBal[1].length);
             
             if (isAmountToken(restOfToken)) {
                 if (restOfToken.replace(/,/g, '').length < 15) {
                     amount1 = restOfToken;
                     narration = tokens.slice(0, -1).join(' ').trim();
                 } else {
                     amount1 = null;
                     const remarks = tokens.slice(0, -1);
                     remarks.push(restOfToken);
                     narration = remarks.join(' ').trim();
                 }
             } else if (restOfToken) {
                 const matchAmt = restOfToken.match(/^(.+?)([\d,]+\.\d{2})$/);
                 if (matchAmt && matchAmt[2].replace(/,/g, '').length < 15) {
                     amount1 = matchAmt[2];
                     const remarks = tokens.slice(0, -1);
                     remarks.push(matchAmt[1]);
                     narration = remarks.join(' ').trim();
                 } else {
                     amount1 = null;
                     const remarks = tokens.slice(0, -1);
                     remarks.push(restOfToken);
                     narration = remarks.join(' ').trim();
                 }
             }
         }
      }
    }
    console.log({ amount1, closingBalance, narration });
}

testExtraction("TRF TO FD no. 183710003876 22500000.00 2177915.89");
testExtraction("TRF TO FD no. 18371000387622500000.00 2177915.89"); 
testExtraction("TRF TO FD no. 183710003876 22500000.002177915.89"); 
testExtraction("TRF TO FD no. 18371000387622500000.002177915.89"); 
testExtraction("TRF TO FD no. 18371000387622500000.002177915.89 Cr");
