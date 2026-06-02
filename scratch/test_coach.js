const axios = require('axios');

const BASE_URL = 'http://localhost:5001';
const AUTH_TOKEN = 'DEFAULT_CINEDIARY_AUTH_TOKEN';
const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`
};

async function runTests() {
  console.log('==================================================');
  console.log('🧪 CineDiary 신설 API 기능 통합 검증 시작...');
  console.log('==================================================');

  // Test 1: GET /api/search (영화 검색)
  try {
    console.log('\n👉 [Test 1] GET /api/search?query=기생충 테스트...');
    const res = await axios.get(`${BASE_URL}/api/search?query=${encodeURIComponent('기생충')}`, { headers: HEADERS });
    console.log('✅ Passed: 영화 검색 성공!');
    console.log(`   검색된 영화 수: ${res.data.data.length}개`);
    if (res.data.data.length > 0) {
      const top = res.data.data[0];
      console.log(`   첫 번째 검색 결과: ${top.movieNm} (${top.openDt.slice(0, 4)}년, 장르: ${top.genre}, 평점: ${top.rating})`);
    }
  } catch (err) {
    console.error('❌ Failed [Test 1]:', err.response?.data || err.message);
  }

  // Test 2: POST /api/coach-review (AI 작문 코칭 및 피드백)
  try {
    console.log('\n👉 [Test 2] POST /api/coach-review 테스트...');
    const body = {
      movieNm: '기생충',
      directors: '봉준호',
      actors: '송강호, 이선균, 조여정, 최우식',
      genres: '드라마, 스릴러',
      userReview: '가난한 가족과 부자 가족의 대비가 계단이라는 시각적 미장센을 통해 너무 잘 드러나서 전율을 느꼈다.'
    };
    const res = await axios.post(`${BASE_URL}/api/coach-review`, body, { headers: HEADERS });
    console.log('✅ Passed: AI 비평 코칭 평가 성공!');
    console.log('   [5대 평가 영역 점수]');
    console.log(`     - 표현력: ${res.data.scores.expression}점`);
    console.log(`     - 논리성: ${res.data.scores.logic}점`);
    console.log(`     - 연출도: ${res.data.scores.analysis}점`);
    console.log(`     - 어휘력: ${res.data.scores.vocabulary}점`);
    console.log(`     - 임팩트: ${res.data.scores.impact}점`);
    console.log('\n   [평론가 코치 총평]');
    console.log(`     "${res.data.feedback}"`);
    console.log('\n   [세련된 시네필 첨삭 완성본]');
    console.log(`     "${res.data.corrected}"`);
    console.log(`\n   시뮬레이션 모드 여부: ${res.data.simulated}`);
  } catch (err) {
    console.error('❌ Failed [Test 2]:', err.response?.data || err.message);
  }

  console.log('\n==================================================');
  console.log('🏁 API 검증 테스트 완료!');
  console.log('==================================================');
}

runTests();
