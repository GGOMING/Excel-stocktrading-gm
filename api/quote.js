// /api/quote?code=005930  — 네이버 폴링 시세 프록시
// Verified 2026-06: closePriceRaw / compareToPreviousClosePriceRaw / openPriceRaw / highPriceRaw / lowPriceRaw / accumulatedTradingVolumeRaw / accumulatedTradingValueRaw

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code || !/^[0-9A-Z]{6}$/.test(code)) {
    return res.status(400).json({ error: 'invalid code' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate');

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Mobile Safari/537.36',
    'Referer': 'https://m.stock.naver.com/',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9'
  };

  try {
    const r = await fetch(`https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`, { headers });
    if (!r.ok) return res.status(502).json({ error: 'naver ' + r.status });
    const j = await r.json();
    const d = j?.datas?.[0];
    if (!d) return res.status(502).json({ error: 'no datas', topKeys: Object.keys(j || {}) });

    const num = v => {
      if (v == null) return null;
      const n = parseFloat(String(v).replace(/,/g, ''));
      return isFinite(n) ? n : null;
    };

    const price = num(d.closePriceRaw);
    const prevCloseChange = num(d.compareToPreviousClosePriceRaw);
    const sign = (d.compareToPreviousPrice?.code === '5' || d.compareToPreviousPrice?.code === '4') ? -1 : 1;
    const change = prevCloseChange != null ? prevCloseChange * sign : 0;
    const prevClose = price != null && change != null ? price - change : null;

    const out = {
      code,
      name: d.stockName || '',
      market: d.stockExchangeType?.nameEng || '',
      price,
      prevClose,
      change,
      changePct: num(d.fluctuationsRatioRaw) != null ? num(d.fluctuationsRatioRaw) * sign : (num(d.fluctuationsRatio) || 0) * sign,
      open: num(d.openPriceRaw),
      high: num(d.highPriceRaw),
      low: num(d.lowPriceRaw),
      volume: num(d.accumulatedTradingVolumeRaw),
      amount: num(d.accumulatedTradingValueRaw),
      marketStatus: d.marketStatus || '',
      tradedAt: d.localTradedAt || '',
      marketCap: num(d.marketValueFullRaw),
      ts: Date.now()
    };

    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: String(e), code });
  }
}
