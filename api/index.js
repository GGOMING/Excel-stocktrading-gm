// /api/index  — KOSPI/KOSDAQ 실시간 지수
// Verified 2026-06: /api/realtime/domestic/index/{KOSPI|KOSDAQ}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=60');

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Mobile Safari/537.36',
    'Referer': 'https://m.stock.naver.com/',
    'Accept': 'application/json'
  };

  const num = v => {
    if (v == null) return null;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : null;
  };

  async function fetchIndex(name) {
    try {
      const r = await fetch(`https://polling.finance.naver.com/api/realtime/domestic/index/${name}`, { headers });
      if (!r.ok) return null;
      const j = await r.json();
      const d = j?.datas?.[0];
      if (!d) return null;
      const sign = (d.compareToPreviousPrice?.code === '5' || d.compareToPreviousPrice?.code === '4') ? -1 : 1;
      const value = num(d.closePriceRaw);
      const change = num(d.compareToPreviousClosePriceRaw) != null ? num(d.compareToPreviousClosePriceRaw) * sign : 0;
      return {
        name,
        value,
        prevClose: value != null ? value - change : null,
        change,
        changePct: num(d.fluctuationsRatioRaw) != null ? num(d.fluctuationsRatioRaw) * sign : 0,
        open: num(d.openPriceRaw),
        high: num(d.highPriceRaw),
        low: num(d.lowPriceRaw),
        volume: num(d.accumulatedTradingVolumeRaw),
        amount: num(d.accumulatedTradingValueRaw),
        marketStatus: d.marketStatus || '',
        tradedAt: d.localTradedAt || ''
      };
    } catch (e) {
      return null;
    }
  }

  try {
    const [kospi, kosdaq] = await Promise.all([
      fetchIndex('KOSPI'),
      fetchIndex('KOSDAQ')
    ]);
    res.status(200).json({ KOSPI: kospi, KOSDAQ: kosdaq, ts: Date.now() });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
