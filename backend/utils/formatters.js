/**
 * Helper to convert number to Indian currency words
 */
export function numberToWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  function convert_less_than_thousand(num) {
    if (num === 0) return '';
    let res = '';
    if (num >= 100) {
      res += ones[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 10 && num <= 19) {
      res += teens[num - 10] + ' ';
    } else if (num >= 20 || num === 10) {
      res += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    }
    if (num >= 1 && num <= 9) {
      res += ones[num] + ' ';
    }
    return res;
  }

  amount = Math.floor(amount);
  if (amount === 0) return 'Zero';
  
  let result = '';
  // Convert based on Indian system: Crores, Lakhs, Thousands, Hundreds
  const crores = Math.floor(amount / 10000000);
  amount %= 10000000;
  const lakhs = Math.floor(amount / 100000);
  amount %= 100000;
  const thousands = Math.floor(amount / 1000);
  amount %= 1000;
  
  if (crores > 0) result += convert_less_than_thousand(crores) + 'Crore ';
  if (lakhs > 0) result += convert_less_than_thousand(lakhs) + 'Lakh ';
  if (thousands > 0) result += convert_less_than_thousand(thousands) + 'Thousand ';
  if (amount > 0) result += convert_less_than_thousand(amount);

  return result.trim();
}

/**
 * Format a date for display
 */
export function formatDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function formatCompactDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
}
