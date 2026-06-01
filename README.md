# 🎬 CineSpark

> **시네마틱 AI 영화 포털** — 스크린의 모든 여운을 기록하고 탐색하는 나만의 시네마 아카이브 공간

---

## 📖 프로젝트 소개

CineSpark는 한국영화진흥위원회(KOBIS) Open API의 실시간 데이터와 TMDB(The Movie Database)의 풍부한 시각적 자산(포스터, 백드롭 이미지, 평점, 줄거리)을 유기적으로 결합하여 사용자에게 몰입감 넘치는 영화 탐색 경험을 선사합니다. 

사용자가 단어 몇 개나 투박한 한 줄 평을 입력하면, 세계적인 영화 평론가 수준의 깊이와 정교함을 지닌 **3줄 분량의 품격 있는 AI 평론문으로 확장**시켜 줍니다. 프리미엄 글래스모피즘(Glassmorphism) UI와 부드러운 마이크로 애니메이션으로 무장된 고품격 웹 애플리케이션입니다.

---

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| 📊 **실시간 박스오피스** | KOBIS API 기반 일별 박스오피스 TOP 10 순위 및 누적 관객 수 정보 실시간 제공 |
| 🖼️ **TMDB 비주얼 연동** | 영화별 고화질 포스터, 모달 배경용 와이드 백드롭 이미지, 실시간 평점 및 줄거리 자동 매핑 |
| 🎥 **유튜브 공식 예고편** | 영화 제목과 매칭되는 유튜브 공식 예고편을 모달 내 16:9 반응형 뷰어로 자동 탐색 및 즉시 재생 |
| 🤖 **Gemini AI 평론 파트너** | 150자 이내의 한 줄 평을 입력하면 영화의 상세 스펙 정보를 결합(RAG 스타일)하여 세련된 영화 비평 작성 |
| ⚡ **계층형 인메모리 캐싱** | 외부 API 레이턴시를 최소화하기 위한 데이터 특징별 다차원 메모리 캐시 및 누수 방지 자동 클린업 탑재 |
| 🔐 **보안 환경 구축** | Bearer 인증 토큰 런타임 동적 획득 방식 채택, 프롬프트 인젝션 이스케이프 및 강력한 XSS 방지 필터 적용 |
| 📖 **나의 시네마 아지트** | 로컬-퍼스트 디지털 티켓북(TMDB 포스터 자동 연동 & 블러 백드롭), 다이어리, 버킷리스트 및 **상세 창 원클릭 아지트 저장 연계** 탑재 |
| 📋 **초고속 관람 프리셋 (1번)** | 티켓 발행 시 자주 사용하는 극장, 좌석, 동반자, 간식 조합을 불러오는 프리셋 템플릿(나홀로 극장, 커플석, OTT 등) 및 나만의 커스텀 프리셋 저장 기능 탑재 |
| 💬 **시네필 비평 가이드 (3번)** | 다이어리 작성 시 영화 생각을 자극하는 3가지 고차원 성찰 프롬프트(🎬 최고의 1분, 💬 명대사 & 메시지, ❤️ 소중한 이에게) 원클릭 템플릿 인젝터 및 작성글 덮어쓰기 보호 장치 탑재 |

---

## 🛠️ 기술 스택

### Backend
- **Node.js** + **Express.js** — 고성능 웹 서버 및 API 라우팅
- **axios** — 비동기 외부 API 오케스트레이션 (KOBIS, TMDB, Gemini API)
- **dotenv** — 환경변수 관리 및 크레덴셜 격리
- **express-rate-limit** — 서비스 남용 및 API 과부하 방지를 위한 IP별 요청 제한 알고리즘

### Frontend
- **Vanilla HTML5 / CSS3 / ES6+ JavaScript** (`public/` 디렉터리)
- **Aesthetics & UI**: 시네마틱 다크모드, CSS Glassmorphism, Shimmer 이펙트 기반 Skeleton UI, Staggered Fade-in 모션 적용
- **Google Fonts** (`Outfit`, `Inter`, `Noto Sans KR`), **FontAwesome Icons**

### 외부 연동 API
- **KOBIS Open API** (영화진흥위원회) — 박스오피스 실시간 통계 및 영화 명세
- **TMDB API** (The Movie Database) — 고화질 포스터, 백드롭 미디어 및 해외 평점, 줄거리
- **Google Gemini 1.5 Flash API** — 비정형 감상평의 비평문 고도화 생성을 위한 거대 언어 모델

---

## 📁 프로젝트 구조

```
cinesparks-app/
├── server.js               # 백엔드 코어 (API 라우팅, 캐싱, TMDB/Gemini 연동, 보안 미들웨어, 포스터 검색 API)
├── verify.js               # KOBIS/Gemini/TMDB 백엔드 API 기능 무결성 검증용 통합 테스트 슈트
├── test_console_errors.js  # 크롬 헤드리스 모드 기반 브라우저 콘솔 런타임 예외 정밀 추적 검증기
├── test_ticket_poster.js   # 디지털 티켓북 TMDB 포스터 검색 및 카러셀 보관함 로컬 영속화 통합 검증기
├── test_movie_to_ticket.js # 영화 상세 모달 ➡️ 아지트 티켓북 자동 완성 연계 흐름 시나리오 검증기
├── package.json            # 프로젝트 메타데이터 및 스크립트, 의존 패키지 목록 명세
├── .env                    # 보안 크레덴셜 환경변수 (⚠️ 절대 Git 저장소에 커밋하지 마십시오)
├── .gitignore              # 민감 설정 및 의존 라이브러리 자동 업로드 방지 쉴드
└── public/
    ├── index.html          # 스크린의 모든 여운을 기록하는 인라인 폴백 탑재 시네마 포털 뷰
    └── app.js              # 프론트엔드 통합 비즈니스 로직 (아지트 제어, 유튜브 연계, 디바운스 디텍터)
```

---

## 🚀 시작하기

### 사전 요구사항

- [Node.js](https://nodejs.org/) v18 이상
- KOBIS Open API 키 ([KOBIS 홈페이지에서 무료 발급](https://www.kobis.or.kr/kobisopenapi/homepg/apiservice/searchServiceInfo.do))
- TMDB API 키 ([TMDB 개발자 포털에서 무료 발급](https://www.themoviedb.org/settings/api))
- Google Gemini API 키 ([Google AI Studio에서 무료 발급](https://aistudio.google.com/app/apikey))

### 설치

```bash
# 저장소 복사
git clone <repository-url>
cd cinesparks-app

# 의존 패키지 설치
npm install
```

### 환경변수 설정

프로젝트 루트 폴더에 `.env` 파일을 생성하고 다음과 같이 고유 키 값들을 매핑합니다.

```env
# 구동 서버 포트
PORT=5000

# 보안 인증 토큰 (클라이언트-서버 핸드셰이크 인증용)
APP_AUTH_TOKEN=your_app_auth_token_here

# KOBIS Open API 키
KOBIS_API_KEY=your_kobis_api_key_here

# Google Gemini API 키
GEMINI_API_KEY=your_gemini_api_key_here

# TMDB API 키 (입력하지 않으면 기본 프리미엄 연동 키가 활성화됩니다)
TMDB_API_KEY=your_tmdb_api_key_here
```

### 실행 명령어

```bash
npm start         # 프로덕션 서버 구동
npm run dev       # 개발자 서버 구동 (서버 코드 변경 시 실시간 오토-리로드 제공)
npm test          # API 및 응답 스펙 무결성 자율 테스트
```

서버 구동 후 브라우저에서 **`http://localhost:5000`** 으로 접속하여 사용해보실 수 있습니다.

---

## 📡 API 엔드포인트 명세

CineSparks의 내부 보호 API들을 호출하려면 `Authorization: Bearer <토큰>` 헤더를 주입해야 합니다. 프론트엔드는 시작 시 `/api/init`를 통해 안전하게 토큰을 받아 메모리에 소유합니다.

### 0. 토큰 핸드셰이크 초기화
* **HTTP Method**: `GET`
* **Path**: `/api/init`
* **설명**: 프론트엔드가 메모리에만 저장할 일회성 보안 인증 토큰을 동적으로 교부합니다.
* **응답 예시**:
  ```json
  { "token": "AQ.Ab8RN6KDOFQVE0lfqjLrmViS0QBh..." }
  ```

### 1. 시네마틱 박스오피스 TOP 10 조회
* **HTTP Method**: `GET`
* **Path**: `/api/boxoffice?targetDt=YYYYMMDD`
* **파라미터**: `targetDt` (조회 타겟 날짜 8자리 숫자)
* **설명**: 지정 날짜의 실시간 영화 순위에 더해 각 영화별 TMDB 포스터 이미지 및 해외 실시간 별점 평점까지 완전히 병합한 프리미엄 리스트를 도출합니다.
* **응답 예시**:
  ```json
  {
    "success": true,
    "fromCache": false,
    "latency": "252ms",
    "data": [
      {
        "rank": "1",
        "rankInten": "0",
        "rankOldAndNew": "OLD",
        "movieCd": "20240101",
        "movieNm": "범죄도시 4",
        "openDt": "2024-04-24",
        "audiCnt": "120,450",
        "audiAcc": "11,204,500",
        "poster": "https://image.tmdb.org/t/p/w500/poster_path.jpg",
        "backdrop": "https://image.tmdb.org/t/p/w1280/backdrop_path.jpg",
        "rating": "8.2"
      }
    ]
  }
  ```

### 2. 영화 상세 프로필 및 미디어 자산 조회
* **HTTP Method**: `GET`
* **Path**: `/api/movie?movieCd=XXXXXXXX`
* **파라미터**: `movieCd` (영화 고유 번호)
* **설명**: 감독, 배우진 등의 기본 메타 데이터뿐 아니라 TMDB 기반의 고유 한국어 줄거리(Overview)와 백드롭 배경 이미지까지 종합하여 큐레이션합니다.
* **응답 예시**:
  ```json
  {
    "success": true,
    "fromCache": true,
    "latency": "1ms",
    "data": {
      "movieCd": "20240101",
      "movieNm": "범죄도시 4",
      "movieNmEn": "The Roundup: Punishment",
      "showTm": "109",
      "genres": "액션, 범죄",
      "directors": "허명행",
      "actors": "마동석, 김무열, 박지환",
      "nations": "한국",
      "companys": "(주)빅펀치픽쳐스 (제작)",
      "poster": "https://image.tmdb.org/t/p/w500/poster_path.jpg",
      "backdrop": "https://image.tmdb.org/t/p/w1280/backdrop_path.jpg",
      "rating": "8.2",
      "overview": "신종 마약 사건 해결 뒤 수년이 흐르고, 마석도 형사는 새로운 범죄 조직의 실체를 쫓기 시작한다..."
    }
  }
  ```

### 2.5. 티켓북용 영화 포스터 검색
* **HTTP Method**: `GET`
* **Path**: `/api/search-poster?movieNm=XXXXXXXX`
* **파라미터**: `movieNm` (검색할 영화 제목)
* **설명**: 사용자가 수동으로 티켓을 생성할 때 해당 영화 제목에 매칭되는 TMDB 포스터의 실시간 이미지 주소를 찾아 도출합니다.
* **응답 예시**:
  ```json
  {
    "success": true,
    "poster": "https://image.tmdb.org/t/p/w500/evoEi8SBSvIIEveM3V6nCJ6vKj8.jpg"
  }
  ```

### 3. AI 감상평 평론문 생성 및 확장
* **HTTP Method**: `POST`
* **Path**: `/api/review`
* **요청 바디 (JSON)**:
  ```json
  {
    "movieNm": "범죄도시 4",
    "directors": "허명행",
    "actors": "마동석, 김무열",
    "genres": "액션",
    "userComment": "타격감 엄청나고 마동석 묵직한 주먹 연기 여전해서 통쾌하네요!"
  }
  ```
* **설명**: 사용자의 한 줄 감상을 기반으로 영화 스펙과 감독, 배우 특징을 RAG 형태로 기획 구성하여 Gemini 1.5 Flash에 질의합니다.
* **응답 예시**:
  ```json
  {
    "success": true,
    "review": "영화 《범죄도시 4》는 액션 장르 고유의 쾌감을 극대화한 통쾌한 명작입니다. 특히 '타격감 엄청나고 마동석 묵직한 주먹 연기 여전해서 통쾌하다'는 극찬처럼, 감독 허명행의 정교한 무술 연출 아래 마동석 배우 특유의 압도적인 아우라가 빛을 발합니다. 오락성 뿐 아니라 캐릭터 서사까지 빈틈없이 결합해 극장의 생동감을 오롯이 만끽하게 하는 진정한 웰메이드 영화입니다.",
    "simulated": false
  }
  ```

---

## ⚙️ 캐싱 레이어 맵

레이턴시 극대화와 외부 API 콜 세이버를 위해 엄격한 타임아웃(TTL)이 내재화된 캐싱 시스템을 도입하였습니다:

| 데이터 분류 | 캐시 유효 시간 (TTL) | 주요 특징 |
|------|------|------|
| **박스오피스 리스트** | 6시간 (21,600초) | 동일 날짜에 대한 빈번한 순위 갱신 요청 완화 |
| **영화 상세 프로필** | 24시간 (86,400초) | 정적 정보로 한 번 로드 시 최적 속도로 런타임 캐싱 처리 |
| **TMDB 이미지 자산** | 24시간 (86,400초) | 영화명 검색에 수반되는 네트워크 비용 최소화 |

---

## 🛡️ 완벽한 보안 & 데이터 안정성 설계

* **동적 토큰 핸드셰이크**: 프론트엔드 빌드 타임 하드코딩 토큰 노출을 완전히 근절하고, 부트스트랩 API(/api/init)를 통해 안전하게 핸드셰이크를 거친 런타임 메모리 토큰으로 검증합니다.
* **IP별 Rate-Limiter 보호**: 악의적인 공격 및 트래픽 남용을 사전에 원천 차단하기 위해 `express-rate-limit` 모듈을 도입하여 전체 API 호출(분당 60회) 및 고비용 AI 평론 요청(분당 5회)으로 다이나믹 제한을 걸어두었습니다.
* **보안 Sanitization 필터링**: 프롬프트 인젝션 및 특수 코드가 주입되는 비정상 요청을 방어하기 위해 특수문자 전역 이스케이프 로직을 백엔드 비즈니스 레이어에 탑재했습니다.
* **XSS 인젝션 차단**: 프론트엔드로 수신된 텍스트가 웹 UI의 HTML 요소로 직접 바인딩될 때 생기는 위협을 제거하기 위해 프론트 전용 `escapeHtml()` 필터를 구현했습니다.

---

## 📜 라이선스 안내

본 애플리케이션은 포트폴리오 및 교육 연구용으로 구축되었습니다.  
데이터는 영화진흥위원회(KOBIS) Open API 및 TMDB API 가이드라인을 따르며, 상업적 이용 시 각 API 라이선스 규정을 필히 확인하시기 바랍니다.

---

<p align="center">Premium Engineered with ❤️ using Node.js + TMDB Media Synergy + Google Gemini 1.5</p>
