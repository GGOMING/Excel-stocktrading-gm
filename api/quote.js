// /api/quote?code=005930  — 네이버 폴링 시세 프록시
// CORS 우회 + User-Agent/Referer 위장 + 응답 정규화

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code || !/^[0-9A-Z]{6}$/.test(code)) {
    return res.status(400).json({ error: 'invalid code' });
  }

  // CORS 허용
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate');

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
    'Referer': 'https://finance.naver.com/',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9'
  };

  try {
    // 1차: 폴링 엔드포인트 (가장 가벼움)
    const url1 = `https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`;
    const r1 = await fetch(url1, { headers });
    const t1 = await r1.text();

    let pollData = null;
    try { pollData = JSON.parse(t1); } catch (e) { /* JSONP 등 */ }

    const datas = pollData?.datas
              || pollData?.result?.areas?.[0]?.datas
              || [];
    const d = datas[0] || {};

    // 2차: m.stock 통합 엔드포인트 (시가/고가/저가 등 풍부)
    let stockInfo = {};
    try {
      const url2 = `https://m.stock.naver.com/api/stock/${code}/basic`;
      const r2 = await fetch(url2, { headers });
      if (r2.ok) stockInfo = await r2.json();
    } catch (e) { /* optional */ }

    // 정규화
    const num = v => {
      if (v == null) return null;
      const s = String(v).replace(/,/g, '');
      const n = parseFloat(s);
      return isFinite(n) ? n : null;
    };

    const price = num(d.nv) ?? num(stockInfo.closePrice);
    const prevClose = num(d.pcv) ?? num(d.sv) ?? num(stockInfo.compareToPreviousClosePrice && stockInfo.closePrice && (stockInfo.closePrice - stockInfo.compareToPreviousClosePrice));
    const change = num(d.cv) ?? (price != null && prevClose != null ? price - prevClose : null);
    const changePct = num(d.cr) ?? (change != null && prevClose ? (change / prevClose) * 100 : null);

    const normalized = {
      code,
      name: d.nm || stockInfo.stockName || '',
      price,
      prevClose,
      change,
      changePct,
      open: num(d.ov) ?? num(stockInfo.openPrice),
      high: num(d.hv) ?? num(stockInfo.highPrice),
      low: num(d.lv) ?? num(stockInfo.lowPrice),
      volume: num(d.aq) ?? num(stockInfo.accumulatedTradingVolume),
      amount: num(d.aa) ?? num(stockInfo.accumulatedTradingValue),
      upper: num(d.ul) ?? null,
      lower: num(d.ll) ?? null,
      marketStatus: d.ms || stockInfo.tradingHaltYn || '',
      ts: Date.now(),
      _raw: { polling: d, basic: stockInfo }  // 디버깅용
    };

    res.status(200).json(normalized);
  } catch (e) {
    res.status(500).json({ error: String(e), code });
  }
}
