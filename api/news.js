// /api/news?code=005930&n=3  — 종목별 뉴스 기사
// Verified 2026-06: /api/news/stock/{code}?pageSize=N
// 응답: [{total, items:[{id, title, titleFull, body, officeName, datetime, mobileNewsUrl, imageOriginLink}]}, ...]
// (그룹/클러스터 구조 — 같은 사건을 다룬 여러 매체 묶음)

export default async function handler(req, res) {
  const { code } = req.query;
  const n = Math.max(1, Math.min(10, parseInt(req.query.n) || 3));
  if (!code || !/^[0-9A-Z]{6}$/.test(code)) {
    return res.status(400).json({ error: 'invalid code' });
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Mobile Safari/537.36',
    'Referer': `https://m.stock.naver.com/domestic/stock/${code}/news`,
    'Accept': 'application/json'
  };

  const decode = s => {
    if (!s) return '';
    return String(s)
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ').trim();
  };

  try {
    // 그룹 단위로 오므로 넉넉히 받아서 첫 n개 articles 추출
    const r = await fetch(`https://m.stock.naver.com/api/news/stock/${code}?pageSize=${n * 3}`, { headers });
    if (!r.ok) return res.status(502).json({ error: 'naver ' + r.status });
    const groups = await r.json();
    if (!Array.isArray(groups)) return res.status(502).json({ error: 'unexpected format' });

    const articles = [];
    const seenIds = new Set();
    for (const g of groups) {
      for (const item of (g.items || [])) {
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        const ts = item.datetime || '';
        const date = ts.length === 12
          ? `${ts.slice(4,6)}/${ts.slice(6,8)} ${ts.slice(8,10)}:${ts.slice(10,12)}`
          : ts;
        articles.push({
          id: item.id,
          title: decode(item.titleFull || item.title || ''),
          summary: decode(item.body || '').slice(0, 180),
          office: item.officeName || '',
          datetime: date,
          url: item.mobileNewsUrl || '',
          image: item.imageOriginLink || ''
        });
        if (articles.length >= n) break;
      }
      if (articles.length >= n) break;
    }

    res.status(200).json({ code, articles, ts: Date.now() });
  } catch (e) {
    res.status(500).json({ error: String(e), code });
  }
}
