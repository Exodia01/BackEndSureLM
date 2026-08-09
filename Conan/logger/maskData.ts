export function maskPhone(phone: string) {
  if (!phone || phone.length < 4) return '***';
  const maskedDigits = '*'.repeat(phone.length - 2);
  return '+' + maskedDigits + phone.slice(-2);
}

export function maskIncome(income: number | null | undefined) {
  if (income === null || income === undefined) return '$XXX,XXX';
  const formatted = income.toLocaleString();
  const parts = formatted.split(',');
  
  if (parts.length >= 2) {
    return '$' + '*'.repeat(Math.min(2, parts[0].length)) + parts.slice(1).join(',');
  }
  
  return '$XXX';
}

export function maskEmail(email: string) {
  if (!email || email.length < 5) return '***@***.***';
  
  const segments = email.split('@');
  const local = segments[0];
  const domain = segments[1];
  
  if (!domain) return email;
  
  const maskedLocal = local.length <= 2 ? '**' : local[0] + '*'.repeat(local.length - 2) + local.slice(-1);
  const domainParts = domain.split('.');
  
  if (domainParts.length >= 2) {
    const firstPart = domainParts[0];
    const maskedDomain = firstPart.length <= 2 ? '**' : firstPart[0] + '*'.repeat(firstPart.length - 2) + firstPart.slice(-1);
    return maskedLocal + '@' + maskedDomain + '.' + domainParts.slice(1).join('.');
  }
  
  return email;
}

export function maskPii(text: string) {
  const phonePattern = /\+?[\d\s-]{7,}\d/g;
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  
  return text.replace(phonePattern, '***PHONE***').replace(emailPattern, '***EMAIL***');
}
