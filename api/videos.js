const fs = require('fs');
const path = require('path');

function norm(v) {
  return {
    id: String(v.id || v.embed || v.direct || '').slice(-16),
    title: v.title || '',
    category: v.category || 'Umum',
    embed: v.embed || v.embedUrl || '',
    direct: v.direct || '',
    date: v.date || '',
    source: v.source || ''
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const file = path.join(process.cwd(), 'data', 'videos.json');
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const q = (req.query.q || '').toLowerCase();
    const cat = (req.query.cat || '').toLowerCase();
    const limit = Math.min(parseInt(req.query.limit || '20', 10) || 20, 100);
    const page = Math.max(parseInt(req.query.page || '1', 10) || 1, 1);
    let list = raw.map(norm);
    if (cat) list = list.filter(v => (v.category || '').toLowerCase() === cat);
    if (q) list = list.filter(v => (v.title + ' ' + v.category).toLowerCase().includes(q));
    const total = list.length;
    const start = (page - 1) * limit;
    return res.status(200).json({
      ok: true,
      total,
      page,
      limit,
      items: list.slice(start, start + limit)
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
