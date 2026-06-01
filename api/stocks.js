// /api/stocks  — 코스피/코스닥 전체 종목 + 현재가/등락률/거래량 일괄
// Verified 2026-06: /api/stocks/marketValue/{KOSPI|KOSDAQ}?page=N&pageSize=100

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=300');

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Mobile Safari/537.36',
    'Referer': 'https://m.stock.naver.com/',
    'Accept': 'application/json'
  };

  const num = v => {
    if (v == null) return 0;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : 0;
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
    const pages = Array.from({ length: 25 }, (_, i) => i + 1);
    const results = await Promise.all(pages.map(p => fetchPage(market, p)));
    const flat = results.flat();
    const seen = new Set();
    const dedup = [];
    for (const s of flat) {
      if (seen.has(s.itemCode)) continue;
      seen.add(s.itemCode);
      const sign = (s.compareToPreviousPrice?.code === '5' || s.compareToPreviousPrice?.code === '4') ? -1 : 1;
      const price = num(s.closePrice);
      const change = num(s.compareToPreviousClosePrice) * sign;
      const prevClose = price - change;
      dedup.push({
        code: s.itemCode,
        name: s.stockName,
        market,
        marketCap: num(s.marketValue),   // 단위: 백만원
        price,
        prevClose,
        change,
        changePct: num(s.fluctuationsRatio) * sign,
        volume: num(s.accumulatedTradingVolume),
        amount: num(s.accumulatedTradingValue),   // 단위: 백만원
        tradedAt: s.localTradedAt || ''
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
      kospi, kosdaq,
      total: kospi.length + kosdaq.length,
      ts: Date.now()
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
