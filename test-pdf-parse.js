const pdf = require('pdf-parse');

pdf("S:\\BackEndSureLM\\test\\Kotak_Premier_Life_Plan_-_Brochure_-_18th_June_2020.pdf").then(data => {
  console.log(data.text.length);
}).catch(err => console.error(err));
