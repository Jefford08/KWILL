const TIME_ZONE = process.env.APP_TIMEZONE || 'Asia/Manila';

const isoFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

function today() {
  return isoFormatter.format(new Date());
}

function monthStart() {
  return today().slice(0, 8) + '01';
}

const displayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
});

function formatDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(`${String(isoDate).slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? String(isoDate) : displayFormatter.format(d);
}

module.exports = { TIME_ZONE, today, monthStart, formatDate };
