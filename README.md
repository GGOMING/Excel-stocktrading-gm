# MTA Trading — Vercel 배포 가이드

월간실적분석_v2.html을 Vercel에 올려서 네이버 시세/호가를 실시간으로 받아옵니다.

## 폴더 구조

```
mta-trading-deploy/
├── index.html         ← 엑셀 위장 모의투자 툴
├── api/
│   ├── quote.js       ← 네이버 폴링 시세 프록시 (/api/quote?code=005930)
│   └── orderbook.js   ← 네이버 10단계 호가 프록시 (/api/orderbook?code=005930)
├── vercel.json
└── package.json
```

## 배포 방법 (선택 A: 웹 업로드, 가장 쉬움)

1. https://vercel.com 가입 (GitHub/Google 로그인)
2. 대시보드 → **Add New → Project**
3. **Continue with Git Repository** 대신 아래 **Deploy without Git** 또는 GitHub에 폴더 푸시 후 Import
4. 폴더 통째로 드래그하거나 GitHub 연결
5. **Deploy** 클릭 → 1~2분 후 URL 발급 (예: `https://mta-trading-xxx.vercel.app`)

## 배포 방법 (선택 B: Vercel CLI, 더 빠름)

Node.js가 깔려있다면:

```bash
npm i -g vercel
cd "C:\Users\한화손해보험\Desktop\mta-trading-deploy"
vercel
# 첫 실행 시 로그인 → 프로젝트명 입력 → Deploy
```

배포 후 URL이 콘솔에 출력됩니다.

## 테스트 절차

배포 URL 접속 후:

1. ⚙ **API 설정** → 모드를 **naver**로 변경 → 저장
2. **현재가/호가** 시트로 이동 → 삼성전자(005930) 선택
3. 리본의 🔄 **새로고침** 클릭
4. 10단계 호가에 진짜 네이버 데이터가 떠야 정상

## 디버깅

배포 후 시세가 안 보이면 브라우저 개발자도구(F12) → **Network** 탭에서:

- `/api/quote?code=005930` → 200 응답이고 `price`에 숫자가 있는지
- `/api/orderbook?code=005930` → `asks/bids` 배열에 가격이 채워져 있는지

응답이 비어있다면 네이버가 엔드포인트/필드명을 바꾼 것 — `api/quote.js`와 `api/orderbook.js`의 응답 파싱 부분만 수정하면 됩니다. 응답에 `_raw`와 `_raw_keys` 디버깅 필드를 포함해뒀으니 실제 구조 확인 가능.

## 주의사항

- 네이버 폴링은 **비공식 엔드포인트**입니다. 약관상 회색지대이므로 데모/개인용으로만 사용.
- 실시간 시세 지연: 통상 15초 ~ 1분 정도 지연 가능.
- 장 마감 후/주말에는 데이터가 정적입니다 (전일 종가).
- Vercel 무료 티어: 함수 100K 호출/월, 100GB 대역폭/월 — 개인 시연용으론 충분.
