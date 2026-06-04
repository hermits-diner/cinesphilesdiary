# 🎬 Cinephile's Diary

> **시네마틱 AI 영화 비평 트레이너** — "스크린이 꺼진 후에도, 영화는 당신 안에 계속된다."

---

## 📖 프로젝트 소개

Cinephile's Diary는 한국영화진흥위원회(KOBIS) Open API의 실시간 데이터와 TMDB의 고화질 비주얼 자산을 결합한 시네필 전용 영화 다이어리 앱입니다.

**Supabase 기반 로그인 및 클라우드 동기화**를 지원하여, 어떤 기기에서도 본인의 다이어리·티켓·버킷리스트를 이어서 사용할 수 있습니다. 단순한 기록장을 넘어, 사용자의 영화 작문 능력을 키워주는 **AI 영화 비평 트레이너(Gemini 연동)** 를 탑재한 초프리미엄 웹앱입니다.

---

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| 🔐 **로그인 & 클라우드 동기화** | Google OAuth / 이메일 로그인 지원. 다이어리·티켓·버킷리스트·한줄평이 Supabase DB에 저장되어 기기간 자동 동기화 |
| 📊 **실시간 박스오피스** | KOBIS API 기반 일별/주별 박스오피스 TOP 10, 개봉 예정작, 글로벌 트렌딩(8개국) |
| 🖼️ **TMDB 비주얼 연동** | 고화질 포스터, 와이드 백드롭, 실시간 평점, 줄거리, 예고편 자동 매핑 |
| 🔍 **글로벌 실시간 검색** | 오로라 아우라 검색창으로 과거 명작·해외 영화까지 실시간 검색 |
| 🤖 **AI 비평 코칭 트레이너** | 감상문 초안(최대 2000자)을 5개 영역 채점 + 평론가 톤 첨삭 교정본 제공 (Gemini 연동, 일 3회 서버사이드 제한) |
| 🎟️ **디지털 티켓 발행** | 관람 정보를 폴라로이드 감성 티켓으로 발행·보관 |
| ✍️ **영화 다이어리** | 감성 에디터로 영화 일기 작성, 이모지·컨텍스트 기록 |
| 📋 **버킷리스트 보드** | 보고 싶은 영화 체크리스트, Excel 가져오기/내보내기 |
| 🌸 **로즈골드 다꾸 테마** | 미드나잇 벨벳 배경 + 소프트 로즈골드 / 모브 라벤더 / 앤틱 골드 디자인 토큰 |

---

## 🛠️ 기술 스택

### Backend
- **Node.js + Express.js** — API 서버
- **Supabase (PostgreSQL)** — 사용자 인증 + 클라우드 DB
- **@supabase/supabase-js** — Supabase Admin SDK (서버사이드 JWT 검증)
- **axios** — 외부 API 오케스트레이션
- **helmet / cors / express-rate-limit** — 보안 레이어

### Frontend
- **Vanilla HTML5 / CSS3 / ES6+** — 프레임워크 없음
- **Supabase JS Client (CDN)** — Auth + DB 직접 연동
- **Google Fonts** (Outfit, Inter, Noto Serif KR), **FontAwesome 6**

### 외부 API
- **KOBIS Open API** — 박스오피스 실시간 통계
- **TMDB API** — 포스터, 백드롭, 평점, 예고편
- **Google Gemini API** — AI 비평 코칭

### 인프라
- **Vercel** — 배포 (Express 서버리스)
- **Supabase** — Auth + PostgreSQL DB

---

## 📁 프로젝트 구조

```
cinesphilesdiary/
├── server.js               # Express 백엔드 (API 라우팅, Supabase Admin, 캐싱, 보안)
├── vercel.json             # Vercel 배포 설정
├── package.json
├── .env                    # 환경변수 (⚠️ Git 커밋 금지)
├── supabase/
│   └── schema.sql          # DB 테이블 정의 + RLS 정책 (Supabase SQL Editor에서 실행)
├── public/
│   ├── index.html          # UI 템플릿 (CSS 포함)
│   └── app.js              # 프론트엔드 로직 (Auth 모듈 + 데이터 동기화 포함)
└── docs/                   # Jekyll 문서 포털
```

---

## 🗄️ DB 스키마 (Supabase)

| 테이블 | 설명 | 비고 |
|--------|------|------|
| `profiles` | 사용자 프로필 | 가입 시 자동 생성 |
| `cinema_logs` | 영화별 한줄평 + 별점 | unique(user_id, movie_cd) |
| `diary_entries` | 다이어리 전문 | unique(user_id, local_id) |
| `tickets` | 디지털 티켓 | unique(user_id, local_id) |
| `buckets` | 버킷리스트 보드 | items: jsonb |
| `coach_usage` | AI 코칭 일일 횟수 | 서버사이드 제한 |

모든 테이블에 **RLS(Row Level Security)** 가 적용되어 있습니다.

---

## 🚀 시작하기

### 1. 저장소 클론 & 설치

```bash
git clone https://github.com/hermits-diner/cinesphilesdiary.git
cd cinesphilesdiary
npm install
```

### 2. 환경변수 설정

`.env` 파일 생성:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
KOBIS_API_KEY=your_kobis_key
TMDB_API_KEY=your_tmdb_key
GEMINI_API_KEY=your_gemini_key
APP_AUTH_TOKEN=your_secret_token
ALLOWED_ORIGINS=http://localhost:5000
```

### 3. Supabase 테이블 생성

Supabase Dashboard → SQL Editor → `supabase/schema.sql` 내용 실행

### 4. 로컬 실행

```bash
npm run dev   # 개발 서버 (포트 5000, 자동 리로드)
npm start     # 프로덕션 서버
```

---

## 📡 API 엔드포인트

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | `/api/init` | — | 앱 인증 토큰 발급 |
| GET | `/api/boxoffice` | Bearer | 일별 박스오피스 |
| GET | `/api/weeklyboxoffice` | Bearer | 주별 박스오피스 |
| GET | `/api/upcoming` | Bearer | 개봉 예정작 |
| GET | `/api/movie` | Bearer | 영화 상세정보 |
| GET | `/api/search` | Bearer | 글로벌 영화 검색 |
| GET | `/api/global-trending` | Bearer | 지역별 트렌딩 |
| POST | `/api/review` | Bearer | AI 한줄평 생성 |
| POST | `/api/coach-review` | **Supabase JWT** | AI 다이어리 코칭 (로그인 필수) |

> `/api/coach-review`는 Supabase JWT로 사용자를 인증하며, 일 3회 한도를 서버에서 관리합니다.

---

## ⚙️ 캐싱 레이어

| 데이터 | TTL |
|--------|-----|
| 검색 결과 | 15분 |
| 박스오피스 | 6시간 |
| 영화 상세 | 24시간 |
| TMDB 이미지 | 24시간 |

---

## 🔐 인증 흐름

```
1. 사용자 → Google OAuth 또는 이메일 로그인
2. Supabase Auth → JWT 발급
3. 프론트엔드 → JWT로 Supabase DB 직접 읽기/쓰기 (RLS 적용)
4. AI 코칭 요청 시 → JWT를 서버로 전송
5. 서버 → Service Role로 JWT 검증 + 일일 사용량 체크
```

---

<p align="center">Premium Engineered with 🌸 Rosegold Vibe & Cinephile Soul</p>
