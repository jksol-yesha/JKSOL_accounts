const lastToken = "18371000387622500000.002177915.89";
const superFused = lastToken.match(/^(.+?)([\d,]+\.\d{2})([\d,]+\.\d{2})$/);
if (superFused) {
    console.log("Super Fused 1:", superFused[1]);
    console.log("Super Fused 2:", superFused[2]);
    console.log("Super Fused 3:", superFused[3]);
    if (superFused[2].replace(/,/g, '').length < 15) {
       console.log("Length OK");
    } else {
       console.log("Length FAILED! Row skipped!");
    }
}
