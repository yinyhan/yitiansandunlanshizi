// utils/date.js
// 日期格式化与简单计算

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function format(date, fmt = 'YYYY-MM-DD') {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return fmt
    .replace('YYYY', d.getFullYear())
    .replace('MM', pad(d.getMonth() + 1))
    .replace('DD', pad(d.getDate()))
    .replace('HH', pad(d.getHours()))
    .replace('mm', pad(d.getMinutes()));
}

function today() {
  return format(new Date(), 'YYYY-MM-DD');
}

function diffDays(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

module.exports = { format, today, diffDays, pad };
