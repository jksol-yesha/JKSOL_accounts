const ROW_START = /^(?:(\d+)\s*)?(\d{2}\.\d{2}\.\d{4})(.*)$/;
console.log("No dot:", "15 13.03.2026".match(ROW_START) !== null);
console.log("With dot:", "15. 13.03.2026".match(ROW_START) !== null);
console.log("With space:", "15     13.03.2026".match(ROW_START) !== null);
