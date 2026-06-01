// /api/stocks  — 코스피/코스닥 전체 종목 마스터 (병렬)
// Verified 2026-06: /api/stocks/marketValue/{KOSPI|KOSDAQ}?page=N&pageSize=100

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Mobile Safari/537.36',
    'Referer': 'https://m.stock.naver.com/',
    'Accept': 'application/json'
  };

  async function fetchPage(market, page) {
    try {
      const url = `https://m.stock.naver.com/api/stocks/marketValue/${market}?page=${page}&pageSize=100`;
      const r = await fetch(url, { headers });
      if (!r.ok) return [];
      const j = await r.json();
      return j?.stocks || [];
    } catch { return []; }
  }

  async function fetchMarket(market) {
    // 페이지 1-25 병렬 (코스피 약 900, 코스닥 약 1500 종목)
    const pages = Array.from({ length: 25 }, (_, i) => i + 1);
    const results = await Promise.all(pages.map(p => fetchPage(market, p)));
    const flat = results.flat();
    // 중복 제거
    const seen = new Set();
    const dedup = [];
    for (const s of flat) {
      if (seen.has(s.itemCode)) continue;
      seen.add(s.itemCode);
      dedup.push({
        code: s.itemCode,
        name: s.stockName,
        market: market,
        marketCap: parseFloat(String(s.marketValue || '0').replace(/,/g, '')) || 0
      });
    }
    return dedup;
  }

  try {
    const [kospi, kosdaq] = await Promise.all([
      fetchMarket('KOSPI'),
      fetchMarket('KOSDAQ')
    ]);
    res.status(200).json({
      kospi,
      kosdaq,
      total: kospi.length + kosdaq.length,
      ts: Date.now()
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
