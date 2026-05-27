async function run() {
    const block = {
        serialNo: 15,
        dateStr: '13.03.2026',
        textLines: ['TRF TO FD no. 183710003876', '22500000.00', '2177915.89'],
        startLineIdx: 0
    };

    let combinedText = block.textLines.join(' ').trim();
    combinedText = combinedText.replace(/(\d+\.\d)\s+(\d)$/g, '$1$2').replace(/(\d+\.)\s+(\d{1,2})$/g, '$1$2');

    let narration = combinedText;
    let closingBalance = null;
    let amount1 = null;

    const tokens = combinedText.split(/\s+/);
    console.log("Tokens:", tokens);

    if (tokens.length > 0) {
      const lastToken = tokens[tokens.length - 1];
      const isAmountToken = (str: string) => /^[\d,]+\.\d{2}$/.test(str);

      if (isAmountToken(lastToken)) {
        const secondLast = tokens[tokens.length - 2];
        console.log("lastToken:", lastToken, "secondLast:", secondLast);
        if (secondLast && isAmountToken(secondLast)) {
          if (secondLast.replace(/,/g, '').length < 15) {
            closingBalance = lastToken;
            amount1 = secondLast;
            narration = tokens.slice(0, -2).join(' ').trim();
            console.log("Case 1 Match! amount1:", amount1, "balance:", closingBalance, "narration:", narration);
          } else {
             console.log("Case 1 Failed length check");
          }
        }
      }
    }
}

run();
