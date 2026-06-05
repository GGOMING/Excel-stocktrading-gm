// /api/chart?code=005930&days=480  — 일봉 OHLCV
// Verified 2026-06: api.stock.naver.com/chart/domestic/item/{code}/day?startDateTime=YYYYMMDD&endDateTime=YYYYMMDD

export default async function handler(req, res) {
  const { code } = req.query;
  const days = Math.max(30, Math.min(2000, parseInt(req.query.days) || 480));
  if (!code || !/^[0-9A-Z]{6}$/.test(code)) {
    return res.status(400).json({ error: 'invalid code' });
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Mobile Safari/537.36',
    'Referer': `https://m.stock.naver.com/domestic/stock/${code}/total`,
    'Accept': 'application/json'
  };

  const fmtDate = d => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  };

  // 주말/공휴일 감안해서 days * 1.5 정도 여유 있게 잡음
  const now = new Date();
  const end = fmtDate(now);
  const startDate = new Date(now.getTime() - days * 1.6 * 24 * 3600 * 1000);
  const start = fmtDate(startDate);

  try {
    const url = `https://api.stock.naver.com/chart/domestic/item/${code}/day?startDateTime=${start}&endDateTime=${end}`;
    const r = await fetch(url, { headers });
    if (!r.ok) return res.status(502).json({ error: 'naver ' + r.status });
    const arr = await r.json();
    if (!Array.isArray(arr)) return res.status(502).json({ error: 'unexpected', got: typeof arr });

    const data = arr.map(d => ({
      date: d.localDate,
      open: d.openPrice,
      high: d.highPrice,
      low: d.lowPrice,
      close: d.closePrice,
      volume: d.accumulatedTradingVolume,
      foreignRate: d.foreignRetentionRate
    })).filter(d => d.close != null);

    res.status(200).json({ code, data, count: data.length, ts: Date.now() });
  } catch (e) {
    res.status(500).json({ error: String(e), code });
  }
}
