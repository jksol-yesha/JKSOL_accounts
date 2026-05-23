const fs = require('fs');
const pdf = require('pdf-parse');

const buffer = fs.readFileSync('/Users/erasoft/Downloads/AXIS.pdf');

pdf(buffer).then(function(data) {
    console.log(data.text);
});
