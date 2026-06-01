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

    // sellInfo: [{price, count, rate}] — 5단계 (낮은가→높은가 OR 높은가→낮은가, 확인 필요)
    // buyInfos: [{price, count, rate}]
    // 네이버 응답에서 sellInfo는 매도1(낮은가)부터 매도5(높은가)? 실제로는 매도5→매도1 순서로 옴
    // buyInfos는 매수1(높은가)부터 매수5(낮은가) 순서
    const sellRaw = (j.sellInfo || []).map(x => ({ price: num(x.price), qty: num(x.count) }));
    const buyRaw = (j.buyInfos || []).map(x => ({ price: num(x.price), qty: num(x.count) }));

    // asks: 매도1(best ask, lowest)부터 매도5
    // bids: 매수1(best bid, highest)부터 매수5
    // sellRaw 정렬: 높은가→낮은가 (네이버 UI 순서). asks는 낮은가→높은가가 자연스러움
    const asks = [...sellRaw].sort((a, b) => a.price - b.price);
    const bids = [...buyRaw].sort((a, b) => b.price - a.price);

    res.status(200).json({
      code,
      asks,            // [매도1(best, lowest) ... 매도5(highest)]
      bids,            // [매수1(best, highest) ... 매수5(lowest)]
      totalAsk: num(j.totalSell),
      totalBid: num(j.totalBuy),
      lastClose: num(j.lastClosePrice),
      ts: Date.now()
    });
  } catch (e) {
    res.status(500).json({ error: String(e), code });
  }
}
