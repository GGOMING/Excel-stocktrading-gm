// /api/stocks  — KRX 전 종목 마스터 (KOSPI + KOSDAQ + ETF + ETN)
// Verified 2026-06:
//   주식: m.stock.naver.com/api/stocks/marketValue/{KOSPI|KOSDAQ}?page=N&pageSize=100
//   ETF:  finance.naver.com/api/sise/etfItemList.nhn?etfType=0  (EUC-KR)
//   ETN:  finance.naver.com/api/sise/etnItemList.nhn  (EUC-KR)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=300');

  const mHeaders = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Mobile Safari/537.36',
    'Referer': 'https://m.stock.naver.com/',
    'Accept': 'application/json'
  };
  const fHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
    'Referer': 'https://finance.naver.com/sise/etf.naver',
    'Accept': 'application/json, text/javascript, */*; q=0.01'
  };

  const num = v => {
    if (v == null) return 0;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : 0;
  };

  // EUC-KR JSON 디코딩 (Naver legacy endpoint)
  async function fetchEucKrJson(url, headers) {
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(url + ' -> ' + r.status);
    const buf = await r.arrayBuffer();
    const decoder = new TextDecoder('euc-kr');
    const text = decoder.decode(buf);
    return JSON.parse(text);
  }

  // ===== 주식 (코스피/코스닥) =====
  async function fetchStockPage(market, page) {
    try {
      const url = `https://m.stock.naver.com/api/stocks/marketValue/${market}?page=${page}&pageSize=100`;
      const r = await fetch(url, { headers: mHeaders });
      if (!r.ok) return [];
      const j = await r.json();
      return j?.stocks || [];
    } catch { return []; }
  }

  async function fetchStockMarket(market) {
    const pages = Array.from({ length: 30 }, (_, i) => i + 1);
    const results = await Promise.all(pages.map(p => fetchStockPage(market, p)));
    const flat = results.flat();
    const seen = new Set();
    const out = [];
    for (const s of flat) {
      if (seen.has(s.itemCode)) continue;
      seen.add(s.itemCode);
      const sign = (s.compareToPreviousPrice?.code === '5' || s.compareToPreviousPrice?.code === '4') ? -1 : 1;
      const price = num(s.closePrice);
      const change = num(s.compareToPreviousClosePrice) * sign;
      out.push({
        code: s.itemCode,
        name: s.stockName,
        type: 'STOCK',
        market,
        marketCap: num(s.marketValue),
        price, prevClose: price - change, change,
        changePct: num(s.fluctuationsRatio) * sign,
        volume: num(s.accumulatedTradingVolume),
        amount: num(s.accumulatedTradingValue),
        tradedAt: s.localTradedAt || ''
      });
    }
    return out;
  }

  // ===== ETF =====
  async function fetchETFs() {
    try {
      const j = await fetchEucKrJson('https://finance.naver.com/api/sise/etfItemList.nhn?etfType=0', fHeaders);
      const list = j?.result?.etfItemList || [];
      const tabName = { 1:'국내시장지수', 2:'국내업종/테마', 3:'국내파생', 4:'해외주식', 5:'원자재', 6:'채권', 7:'기타' };
      return list.map(s => {
        const sign = (String(s.risefall) === '4' || String(s.risefall) === '5') ? -1 : 1;
        const price = num(s.nowVal);
        const change = num(s.changeVal); // 부호 이미 포함되어 있음 (음수)
        return {
          code: s.itemcode,
          name: s.itemname,
          type: 'ETF',
          market: 'ETF',
          subCategory: tabName[s.etfTabCode] || '-',
          marketCap: num(s.marketSum),
          price, prevClose: price - change, change,
          changePct: num(s.changeRate),
          volume: num(s.quant),
          amount: num(s.amonut), // 백만원
          nav: num(s.nav)
        };
      });
    } catch (e) {
      console.error('ETF fetch failed:', e.message);
      return [];
    }
  }

  // ===== ETN =====
  async function fetchETNs() {
    try {
      const j = await fetchEucKrJson('https://finance.naver.com/api/sise/etnItemList.nhn', fHeaders);
      const list = j?.result?.etnItemList || [];
      return list.map(s => {
        const price = num(s.nowVal);
        const change = num(s.changeVal);
        return {
          code: s.itemcode,
          name: s.itemname,
          type: 'ETN',
          market: 'ETN',
          marketCap: num(s.marketSum),
          price, prevClose: price - change, change,
          changePct: num(s.changeRate),
          volume: num(s.accQuant),
          amount: num(s.accAmount)
        };
      });
    } catch (e) {
      console.error('ETN fetch failed:', e.message);
      return [];
    }
  }

  try {
    const [kospi, kosdaq, etf, etn] = await Promise.all([
      fetchStockMarket('KOSPI'),
      fetchStockMarket('KOSDAQ'),
      fetchETFs(),
      fetchETNs()
    ]);
    res.status(200).json({
      kospi, kosdaq, etf, etn,
      counts: {
        kospi: kospi.length,
        kosdaq: kosdaq.length,
        etf: etf.length,
        etn: etn.length,
        total: kospi.length + kosdaq.length + etf.length + etn.length
      },
      ts: Date.now()
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
