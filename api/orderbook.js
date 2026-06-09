// /api/orderbook?code=005930  — 네이버 5단계 호가 프록시
// Verified 2026-06: /api/stock/{code}/askingPrice — returns sellInfo[5] + buyInfos[5]

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code || !/^[0-9A-Z]{6}$/.test(code)) {
    return res.status(400).json({ error: 'invalid code' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate');

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Mobile Safari/537.36',
    'Referer': `https://m.stock.naver.com/domestic/stock/${code}/total`,
    'Accept': 'application/json'
  };

  try {
    const r = await fetch(`https://m.stock.naver.com/api/stock/${code}/askingPrice`, { headers });
    if (!r.ok) return res.status(502).json({ error: 'naver ' + r.status });
    const j = await r.json();

    const num = v => {
      if (v == null) return 0;
      const n = parseFloat(String(v).replace(/,/g, ''));
      return isFinite(n) ? n : 0;
    };

    // sellInfo / buyInfos: 5단계 호가
    // 개장 직후/시간외에는 일부 슬롯이 price:"" count:"0" 으로 비어옴 → 필터링 필수
    const sellRaw = (j.sellInfo || [])
      .map(x => ({ price: num(x.price), qty: num(x.count) }))
      .filter(x => x.price > 0);
    const buyRaw = (j.buyInfos || [])
      .map(x => ({ price: num(x.price), qty: num(x.count) }))
      .filter(x => x.price > 0);

    // asks: 매도1(best, lowest)부터 정렬 / bids: 매수1(best, highest)부터
    const asks = [...sellRaw].sort((a, b) => a.price - b.price);
    const bids = [...buyRaw].sort((a, b) => b.price - a.price);

    // 양쪽 모두 비었으면 에러 (장 시작 전 / 휴장)
    if (asks.length === 0 && bids.length === 0) {
      return res.status(200).json({
        code,
        asks: [],
        bids: [],
        totalAsk: num(j.totalSell),
        totalBid: num(j.totalBuy),
        lastClose: num(j.lastClosePrice),
        empty: true,
        reason: '호가 데이터 없음 (장 시작 전 또는 휴장 가능성)',
        ts: Date.now()
      });
    }

    res.status(200).json({
      code,
      asks,
      bids,
      askLevels: asks.length,
      bidLevels: bids.length,
      totalAsk: num(j.totalSell),
      totalBid: num(j.totalBuy),
      lastClose: num(j.lastClosePrice),
      ts: Date.now()
    });
  } catch (e) {
    res.status(500).json({ error: String(e), code });
  }
}
