export function maskPhone(phone) {
  if (!phone || phone.length < 4) return '***';
  var maskedDigits = '*'.repeat(phone.length - 2);
  return '+' + maskedDigits + phone.slice(-2);
}

export function maskIncome(income) {
  if (income === null || income === undefined) return '$XXX,XXX';
  var formatted = income.toLocaleString();
  var parts = formatted.split(',');
  
  if (parts.length >= 2) {
    return '$' + '*'.repeat(Math.min(2, parts[0].length)) + parts.slice(1).join(',');
  }
  
  return '$XXX';
}

export function maskEmail(email) {
  if (!email || email.length < 5) return '***@***.***';
  
  var segments = email.split('@');
  var local = segments[0];
  var domain = segments[1];
  
  if (!domain) return email;
  
  var maskedLocal = local.length <= 2 ? '**' : local[0] + '*'.repeat(local.length - 2) + local.slice(-1);
  var domainParts = domain.split('.');
  
  if (domainParts.length >= 2) {
    var firstPart = domainParts[0];
    var maskedDomain = firstPart.length <= 2 ? '**' : firstPart[0] + '*'.repeat(firstPart.length - 2) + firstPart.slice(-1);
    return maskedLocal + '@' + maskedDomain + '.' + domainParts.slice(1).join('.');
  }
  
  return email;
}

export function maskPii(text) {
  var phonePattern = /\+?[\d\s-]{7,}\d/g;
  var emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  
  return text.replace(phonePattern, '***PHONE***').replace(emailPattern, '***EMAIL***');
}
