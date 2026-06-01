# MTA Trading — Vercel 배포 가이드

엑셀 위장 모의투자 툴을 Vercel에 올려서 **네이버 실시간 시세 + 5단계 호가 + 코스피/코스닥 전체 종목**을 받아옵니다.

## 폴더 구조

```
mta-trading-deploy/
├── index.html         ← 엑셀 위장 모의투자 툴 (단일 페이지)
├── api/
│   ├── quote.js       ← /api/quote?code=005930  (현재가)
│   ├── orderbook.js   ← /api/orderbook?code=005930  (5단계 호가)
│   └── stocks.js      ← /api/stocks  (코스피/코스닥 전체 종목 마스터)
├── vercel.json
├── package.json
└── README.md
```

## 배포 방법 — GitHub 업로드 (CLI 불필요)

### 1) GitHub 새 저장소 생성

1. https://github.com → 로그인 → 우상단 `+` → **New repository**
2. Repository name: `mta-trading` (아무 이름)
3. Public 또는 Private 둘 다 OK
4. **Create repository** 클릭
5. 새 저장소 페이지에서 **uploading an existing file** 링크 클릭

### 2) 파일 업로드

`mta-trading-deploy` 폴더 안의 모든 항목을 드래그&드롭:
- `index.html`
- `api` 폴더 (orderbook.js, quote.js, stocks.js 포함)
- `vercel.json`
- `package.json`
- `README.md`

**Commit changes** 클릭.

### 3) Vercel 배포

1. https://vercel.com → **Sign Up** (GitHub로 로그인하면 권한 자동 연결)
2. 대시보드 → **Add New** → **Project**
3. **Import Git Repository** 섹션에서 방금 만든 `mta-trading` 선택 → **Import**
4. Configure 화면에서 아무것도 안 건드리고 **Deploy** 클릭
5. 1~3분 후 `https://mta-trading-xxx.vercel.app` URL 발급

## 테스트 절차

배포 URL 접속 후:

1. 첫 로딩 시 상태바: "전체 종목 마스터 로드 중... (코스피+코스닥 약 2400종목)"
2. 그 다음: "실시간 시세 로드 중... (N종목)"
3. 마지막: "시세 로드 완료: N/N — UNIVERSE 2400종목"
4. **현재가/호가** 시트 → 삼성전자 선택 → **실제 네이버 5단계 호가** 표시 확인
5. 호가 헤더에 "(실시간 네이버)" 표시되어야 정상

## 디버깅

호가/시세가 안 나오면 F12 → Network 탭:

- `GET /api/quote?code=005930` → `{price: 349500, name: "삼성전자", ...}` 확인
- `GET /api/orderbook?code=005930` → `{asks: [{price, qty}, ...], bids: [...]}` 확인
- `GET /api/stocks` → `{kospi: [...], kosdaq: [...], total: 2400+}` 확인

응답 비어있으면 → 콘솔 로그 확인 + 알려주세요. 네이버가 엔드포인트 바꿨을 가능성.

## 검증된 네이버 엔드포인트 (2026-06 기준)

- 시세: `https://polling.finance.naver.com/api/realtime/domestic/stock/{code}`
  - 필드: `closePriceRaw`, `compareToPreviousClosePriceRaw`, `openPriceRaw`, `highPriceRaw`, `lowPriceRaw`, `accumulatedTradingVolumeRaw`, `fluctuationsRatioRaw`
- 5호가: `https://m.stock.naver.com/api/stock/{code}/askingPrice`
  - 응답: `{sellInfo: [{price, count, rate}×5], buyInfos: [{price, count, rate}×5], totalSell, totalBuy, lastClosePrice}`
- 종목 마스터: `https://m.stock.naver.com/api/stocks/marketValue/{KOSPI|KOSDAQ}?page=N&pageSize=100`
  - 응답: `{stocks: [{itemCode, stockName, marketValue, ...}]}`

## 주의

- 네이버 폴링/호가 엔드포인트는 **비공식**입니다. 약관상 회색지대로 데모/개인용으로만 사용.
- 시세 지연: 통상 15초 ~ 1분.
- 장 마감 후/주말: 데이터가 정적 (직전 거래일 종가).
- 캐싱: 종목 마스터는 localStorage에 24시간 캐시. 새로 받으려면 브라우저 개발자도구 → Application → Local Storage → `_mta_universe_v1` 삭제 후 새로고침.
- Vercel 무료 티어: 함수 100K호출/월, 100GB 대역폭/월.
