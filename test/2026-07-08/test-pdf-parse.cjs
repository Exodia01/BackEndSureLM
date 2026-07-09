const { PDFParse } = require('pdf-parse');

const parser = new PDFParse({
  url: "S:\\BackEndSureLM\\test\\Kotak_Premier_Life_Plan_-_Brochure_-_18th_June_2020.pdf"
});

parser.getText().then(data => {
  console.log(data.text.length);
}).catch(err => console.error(err));
