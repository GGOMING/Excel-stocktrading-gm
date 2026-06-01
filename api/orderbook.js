// /api/orderbook?code=005930  — 네이버 10단계 호가 프록시
// m.stock.naver.com 의 integration / marketCondition 엔드포인트 시도

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code || !/^[0-9A-Z]{6}$/.test(code)) {
    return res.status(400).json({ error: 'invalid code' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate');

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
    'Referer': `https://m.stock.naver.com/domestic/stock/${code}/total`,
    'Accept': 'application/json',
    'Accept-Language': 'ko-KR,ko;q=0.9'
  };

  // 후보 엔드포인트 (변동성 대비 여러 개 시도)
  const candidates = [
    `https://m.stock.naver.com/api/stock/${code}/integration`,
    `https://m.stock.naver.com/api/stock/${code}/marketCondition`,
    `https://api.stock.naver.com/stock/${code}/integration`
  ];

  let raw = null, hitUrl = null, lastError = null;
  for (const url of candidates) {
    try {
      const r = await fetch(url, { headers });
      if (!r.ok) { lastError = `${url} -> ${r.status}`; continue; }
      const j = await r.json();
      raw = j;
      hitUrl = url;
      break;
    } catch (e) {
      lastError = String(e);
    }
  }

  if (!raw) {
    return res.status(502).json({ error: 'all endpoints failed', lastError });
  }

  // 호가 리스트 찾기 (필드명이 자주 바뀌므로 광범위 탐색)
  const list =
       raw?.marketCondition?.askingPrice?.askingPriceList
    || raw?.askingPrice?.askingPriceList
    || raw?.integrationInfo?.marketCondition?.askingPrice?.askingPriceList
    || raw?.askingPriceList
    || [];

  const num = v => {
    if (v == null) return 0;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : 0;
  };

  const asks = [];
  const bids = [];
  for (let i = 0; i < Math.min(10, list.length); i++) {
    const it = list[i] || {};
    asks.push({
      price: num(it.askPrice || it.askingPrice || it.ask),
      qty: num(it.askQuantity || it.askRemainQuantity || it.askRestQuantity || it.askQty)
    });
    bids.push({
      price: num(it.bidPrice || it.biddingPrice || it.bid),
      qty: num(it.bidQuantity || it.bidRemainQuantity || it.bidRestQuantity || it.bidQty)
    });
  }

  // 추가 정보 (있으면)
  const summary = {
    totalAskQty: num(raw?.marketCondition?.askingPrice?.totalAskingPriceAskQuantity),
    totalBidQty: num(raw?.marketCondition?.askingPrice?.totalAskingPriceBidQuantity)
  };

  res.status(200).json({
    code,
    asks,
    bids,
    summary,
    hitUrl,
    ts: Date.now(),
    _raw_keys: Object.keys(raw || {})  // 디버깅: 응답 최상위 키
  });
}
