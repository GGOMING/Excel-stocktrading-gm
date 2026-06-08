// /api/news?code=005930&n=3  — 종목별 뉴스 (ETF/ETN은 대표 편입종목 뉴스로 대체)
// Verified 2026-06: /api/news/stock/{code}?pageSize=N

// 인기 ETF/ETN 대표 편입종목 매핑 (Naver가 holdings API 미공개라서 하드코딩)
const ETF_REPRESENTATIVES = {
  // 코스피200 추종
  '069500': ['005930', '000660', '035420'],  // KODEX 200
  '102110': ['005930', '000660', '035420'],  // TIGER 200
  '152100': ['005930', '000660', '035420'],  // ARIRANG 200
  '226490': ['005930', '000660', '035420'],  // KODEX KOSPI
  '278530': ['005930', '000660', '035420'],  // KODEX 200TR
  '122630': ['005930', '000660', '035420'],  // KODEX 레버리지
  '252670': ['005930', '000660', '035420'],  // KODEX 200선물인버스2X
  '114800': ['005930', '000660', '035420'],  // KODEX 인버스
  '252710': ['005930', '000660', '035420'],  // TIGER 200선물인버스2X
  // 코스닥150
  '233740': ['247540', '086520', '091990'],  // KODEX 코스닥150
  '229200': ['247540', '086520', '091990'],  // TIGER 코스닥150
  '251340': ['247540', '086520', '091990'],  // KODEX 코스닥150선물인버스
  // 반도체
  '091160': ['005930', '000660', '009150'],  // KODEX 반도체
  '091230': ['005930', '000660', '009150'],  // TIGER 반도체
  '396500': ['005930', '000660', '009150'],  // TIGER 반도체TOP10
  '305540': ['005930', '000660', '009150'],  // KODEX 반도체
  // 2차전지
  '305720': ['373220', '006400', '051910'],  // KODEX 2차전지산업
  '364980': ['373220', '006400', '051910'],  // TIGER KRX2차전지K-뉴딜
  '305540': ['373220', '006400', '247540'],  // KODEX 2차전지핵심소재
  // 자동차
  '091180': ['005380', '000270', '012330'],  // KODEX 자동차
  // 금융/은행
  '091170': ['105560', '055550', '316140'],  // KODEX 은행
  '091220': ['105560', '055550', '316140'],  // TIGER 은행
  '139220': ['105560', '055550', '316140'],  // TIGER 200금융
  // 바이오/헬스케어
  '091990': ['207940', '068270', '196170'],  // KODEX 바이오
  '266390': ['207940', '068270', '196170'],  // TIGER 헬스케어
  '143860': ['207940', '068270', '196170'],  // KOSEF 미국S&P500
  // 인터넷/IT
  '364690': ['035420', '035720', '376300'],  // TIGER KRX인터넷K-뉴딜
  '157450': ['035420', '035720'],            // TIGER 소프트웨어
  // 화학/소재
  '139250': ['051910', '011170', '009830'],  // TIGER 200화학에너지
  '117700': ['005490', '003490', '028050'],  // KODEX 철강
  // 미디어/엔터/게임
  '157500': ['041510', '035900', '352820'],  // KODEX 미디어&엔터
  '157490': ['251270', '293490', '112040'],  // TIGER 소프트웨어
  '364990': ['251270', '293490', '112040'],  // TIGER KRX게임K-뉴딜
  // 미국 주요 ETF (한국 뉴스 매핑 어려움 → 그대로 사용)
  // 360750 TIGER 미국S&P500, 133690 TIGER 미국나스닥100 등은 매핑 안 함
};

export default async function handler(req, res) {
  const { code } = req.query;
  const n = Math.max(1, Math.min(20, parseInt(req.query.n) || 3));
  const targetDate = (req.query.date || '').replace(/[^0-9]/g, '');  // YYYYMMDD
  if (!code || !/^[0-9A-Z]{6}$/.test(code)) {
    return res.status(400).json({ error: 'invalid code' });
  }
  if (targetDate && !/^\d{8}$/.test(targetDate)) {
    return res.status(400).json({ error: 'date must be YYYYMMDD' });
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Mobile Safari/537.36',
    'Referer': `https://m.stock.naver.com/domestic/stock/${code}/news`,
    'Accept': 'application/json'
  };

  const decode = s => {
    if (!s) return '';
    return String(s)
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  };

  async function fetchPage(targetCode, page, pageSize) {
    try {
      const r = await fetch(`https://m.stock.naver.com/api/news/stock/${targetCode}?pageSize=${pageSize}&page=${page}`, { headers });
      if (!r.ok) return [];
      const groups = await r.json();
      if (!Array.isArray(groups)) return [];
      const out = [];
      const seen = new Set();
      for (const g of groups) {
        for (const item of (g.items || [])) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          const ts = item.datetime || '';
          const date = ts.length === 12
            ? `${ts.slice(4,6)}/${ts.slice(6,8)} ${ts.slice(8,10)}:${ts.slice(10,12)}`
            : ts;
          out.push({
            id: item.id,
            title: decode(item.titleFull || item.title || ''),
            summary: decode(item.body || '').slice(0, 180),
            office: item.officeName || '',
            datetime: date,
            url: item.mobileNewsUrl || '',
            image: item.imageOriginLink || '',
            _src: targetCode,
            _rawTs: ts
          });
        }
      }
      return out;
    } catch (e) {
      return [];
    }
  }

  async function fetchOne(targetCode, n) { return fetchPage(targetCode, 1, n * 3); }

  // 페이지네이션 검색: 특정 날짜 또는 그 이전까지 거슬러 찾기
  async function searchByDate(targetCode, date, want, maxPages = 60) {
    const found = [];
    const seen = new Set();
    let scannedPages = 0;
    let lastBatchDate = null;
    for (let page = 1; page <= maxPages; page++) {
      scannedPages = page;
      const articles = await fetchPage(targetCode, page, 10);
      if (articles.length === 0) break;
      for (const a of articles) {
        const d = (a._rawTs || '').slice(0, 8);
        if (d === date && !seen.has(a.id)) {
          seen.add(a.id);
          found.push(a);
        }
      }
      if (found.length >= want) break;
      // 페이지가 모두 타겟 날짜보다 오래된 게 되면 더 이상 안 나옴
      const oldestInPage = articles
        .map(a => (a._rawTs || '').slice(0, 8))
        .filter(Boolean)
        .sort()[0];
      lastBatchDate = oldestInPage;
      if (oldestInPage && oldestInPage < date) break;
    }
    return { articles: found, scannedPages, lastBatchDate };
  }

  try {
    const reps = ETF_REPRESENTATIVES[code];
    let articles;
    let mode = 'direct';
    let scanMeta = null;

    if (targetDate) {
      // ===== 특정 날짜 검색 =====
      mode = reps ? 'etf_date' : 'date';
      const sources = reps && reps.length > 0 ? reps : [code];
      const perSource = Math.max(2, Math.ceil(n / sources.length) + 1);
      const results = await Promise.all(
        sources.map(c => searchByDate(c, targetDate, perSource, 60))
      );
      // 종목별 round-robin
      articles = [];
      const seenIds = new Set();
      let cursor = 0;
      const maxCur = Math.max(...results.map(r => r.articles.length));
      while (articles.length < n && cursor < maxCur) {
        for (let i = 0; i < sources.length && articles.length < n; i++) {
          const a = results[i].articles[cursor];
          if (!a || seenIds.has(a.id)) continue;
          seenIds.add(a.id);
          articles.push(a);
        }
        cursor++;
      }
      // 최신순(해당일 안에서)
      articles.sort((a, b) => (b._rawTs || '').localeCompare(a._rawTs || ''));
      scanMeta = {
        targetDate,
        sources,
        scannedPages: results.map(r => r.scannedPages),
        lastBatchDate: results.map(r => r.lastBatchDate)
      };
    } else if (reps && reps.length > 0) {
      // ETF: 대표 편입종목 뉴스 병렬 fetch
      mode = 'etf_constituents';
      const perStock = Math.ceil(n / reps.length) + 1;
      const lists = await Promise.all(reps.map(c => fetchOne(c, perStock + 2)));
      articles = [];
      const seenIds = new Set();
      let cursor = 0;
      while (articles.length < n && cursor < perStock + 2) {
        for (let i = 0; i < reps.length && articles.length < n; i++) {
          const item = lists[i][cursor];
          if (!item || seenIds.has(item.id)) continue;
          seenIds.add(item.id);
          articles.push(item);
        }
        cursor++;
      }
      articles.sort((a, b) => (b._rawTs || '').localeCompare(a._rawTs || ''));
    } else {
      // 일반 종목: 최신
      articles = await fetchOne(code, n * 3);
      articles = articles.slice(0, n);
    }

    res.status(200).json({
      code,
      mode,
      representatives: reps || null,
      articles,
      scanMeta,
      ts: Date.now()
    });
  } catch (e) {
    res.status(500).json({ error: String(e), code });
  }
}
