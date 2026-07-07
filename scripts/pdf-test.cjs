// pdf-parse v2.4.5 test
const { PDFParse } = require('pdf-parse');
const fs = require('fs');
async function test() { try { const data = await PDFParse.parse(fs.readFileSync('test/Kotak-e-Term-Plan-Brochure.pdf')); console.log('Pages:', data.numpages); process.exit(0); } catch (e) { console.error('Error:', e.message); process.exit(1); } }
if (typeof PDFParse.parse === 'function') { test(); } else { console.log('Static method not available'); }
