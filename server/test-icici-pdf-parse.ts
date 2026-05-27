import fs from 'fs';
import pdf from 'pdf-parse/lib/pdf-parse.js';

async function run() {
  // Try to find an ICICI statement PDF if we can, or just mock it.
  // We just want to see if the pagerender gets called and what the items look like.
  console.log("Setting up pdf-parse test...");
  
  const tokens: any[] = [];
  
  function render_page(pageData: any) {
    return pageData.getTextContent().then(function(textContent: any) {
      let pageText = "";
      
      const viewport = pageData.getViewport({ scale: 1.0 });
      const pageHeight = viewport.height;

      for (let item of textContent.items) {
        const x0 = item.transform[4];
        // item.transform[5] is the Y coordinate from bottom
        const y_bottom = item.transform[5];
        const top = pageHeight - y_bottom - item.height; // approx top from top-left
        const bottom = pageHeight - y_bottom;
        const x1 = x0 + item.width;
        
        tokens.push({
          text: item.str,
          x0,
          x1,
          top,
          bottom,
          page_number: pageData.pageNumber
        });
      }
      return ""; // we don't care about the returned text
    });
  }

  const options = {
    pagerender: render_page
  }
  
  // Create a dummy PDF or look for one in tests
  console.log("Ready to parse.");
}

run().catch(console.error);
