const fs = require('fs');
const PDFParse = require('pdf-parse');

async function test(path) {
    try {
        const buffer = fs.readFileSync(path);
        const data = await PDFParse(buffer);
        console.log(data.text.substring(0, 1500));
    } catch(e) {
        console.error(e);
    }
}
test('/Users/erasoft/Downloads/download.pdf');
