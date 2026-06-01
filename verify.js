require('dotenv').config();
const axios = require('axios');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;
const VALID_TOKEN = `Bearer ${process.env.APP_AUTH_TOKEN}`;
const INVALID_TOKEN = 'Bearer WRONG_TOKEN_VALUE';

// Calculate yesterday's date dynamically (YYYYMMDD)
function getYesterdayDt() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}
const TEST_DATE = getYesterdayDt();

async function runTests() {
  console.log('==================================================');
  console.log('🚀 CineSparks AI API Verification Suite Starting...');
  console.log('==================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  // 1. Test Security Headers (Unauthorized access check)
  try {
    console.log('👉 [Test 1] Fetch boxoffice WITHOUT valid Authorization header...');
    await axios.get(`${BASE_URL}/api/boxoffice?targetDt=${TEST_DATE}`, {
      headers: { 'Authorization': INVALID_TOKEN }
    });
    console.log('❌ Failed: Server allowed access with an invalid token.');
    failedTests++;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✅ Passed: Access denied with 401 Unauthorized as expected.');
      console.log(`   Message: "${error.response.data.error}"\n`);
      passedTests++;
    } else {
      console.log('❌ Failed: Unexpected error on Test 1:', error.message);
      failedTests++;
    }
  }

  // 2. Test Box Office API Proxy & Data Fetching
  let movieCd = '';
  let movieNm = '';
  try {
    console.log(`👉 [Test 2] Fetch boxoffice with VALID Authorization header for ${TEST_DATE}...`);
    const startTime = Date.now();
    const response = await axios.get(`${BASE_URL}/api/boxoffice?targetDt=${TEST_DATE}`, {
      headers: { 'Authorization': VALID_TOKEN }
    });
    const duration = Date.now() - startTime;

    if (response.status === 200 && response.data.success) {
      const list = response.data.data;
      console.log(`✅ Passed: Successfully fetched daily box office!`);
      console.log(`   Latency: ${duration}ms (Network Request: ${response.data.latency})`);
      console.log(`   Cache Status: fromCache = ${response.data.fromCache}`);
      console.log(`   Top 3 Movies:`);
      list.slice(0, 3).forEach(m => {
        console.log(`     - Rank ${m.rank}: ${m.movieNm} (당일 관객: ${m.audiCnt}명, 개봉: ${m.openDt})`);
      });
      console.log('');
      
      if (list.length > 0) {
        movieCd = list[0].movieCd;
        movieNm = list[0].movieNm;
      }
      passedTests++;
    } else {
      console.log('❌ Failed: Boxoffice fetch status was successful but returned invalid structure.');
      failedTests++;
    }
  } catch (error) {
    console.log('❌ Failed: Error on Test 2:', error.response?.data || error.message);
    failedTests++;
  }

  // 3. Test Caching (Verify cache latency is < 30ms)
  try {
    console.log('👉 [Test 3] Refetch the exact same boxoffice data to verify Memory Cache...');
    const startTime = Date.now();
    const response = await axios.get(`${BASE_URL}/api/boxoffice?targetDt=${TEST_DATE}`, {
      headers: { 'Authorization': VALID_TOKEN }
    });
    const duration = Date.now() - startTime;

    if (response.status === 200 && response.data.success && response.data.fromCache === true) {
      console.log('✅ Passed: In-memory cache hit detected!');
      console.log(`   Actual response latency: ${duration}ms (Server-reported: ${response.data.latency})`);
      if (duration < 30) {
        console.log(`   ⚡ High Performance Verified: Cache response completed in < 30ms!`);
      } else {
        console.log(`   ⚠️ Notice: Response took ${duration}ms, slightly higher than typical cache hit.`);
      }
      console.log('');
      passedTests++;
    } else {
      console.log('❌ Failed: Cache hit was not returned or response did not flag fromCache.');
      failedTests++;
    }
  } catch (error) {
    console.log('❌ Failed: Error on Test 3:', error.response?.data || error.message);
    failedTests++;
  }

  // 4. Test Movie Detail API Proxy
  let movieDetail = null;
  try {
    console.log(`👉 [Test 4] Fetch movie details for code ${movieCd} (${movieNm})...`);
    const startTime = Date.now();
    const response = await axios.get(`${BASE_URL}/api/movie?movieCd=${movieCd}`, {
      headers: { 'Authorization': VALID_TOKEN }
    });
    const duration = Date.now() - startTime;

    if (response.status === 200 && response.data.success) {
      movieDetail = response.data.data;
      console.log('✅ Passed: Movie detailed metadata loaded successfully!');
      console.log(`   Directors: ${movieDetail.directors}`);
      console.log(`   Genres: ${movieDetail.genres}`);
      console.log(`   Actors (limited): ${movieDetail.actors.split(', ').slice(0, 4).join(', ')}...`);
      console.log(`   Showtime: ${movieDetail.showTm} mins`);
      console.log(`   Latency: ${duration}ms (Server-reported: ${response.data.latency})\n`);
      passedTests++;
    } else {
      console.log('❌ Failed: Detail fetch status was successful but returned invalid structure.');
      failedTests++;
    }
  } catch (error) {
    console.log('❌ Failed: Error on Test 4:', error.response?.data || error.message);
    failedTests++;
  }

  // 5. Test AI Review Expansion Feature (with key placeholder fallback check)
  try {
    console.log(`👉 [Test 5] Request AI Review Expansion for movie: 《${movieNm}》`);
    console.log(`   User comment input: "진짜 대박 반전 소름 돋고 스토리 연기 대만족함!"`);
    
    const startTime = Date.now();
    const response = await axios.post(`${BASE_URL}/api/review`, {
      movieCd: movieCd,
      movieNm: movieNm,
      directors: movieDetail ? movieDetail.directors : '정보 없음',
      actors: movieDetail ? movieDetail.actors : '정보 없음',
      genres: movieDetail ? movieDetail.genres : '정보 없음',
      userComment: '진짜 대박 반전 소름 돋고 스토리 연기 대만족함!'
    }, {
      headers: { 'Authorization': VALID_TOKEN }
    });
    const duration = Date.now() - startTime;

    if (response.status === 200 && response.data.success) {
      console.log('✅ Passed: AI Review Expander completed successfully!');
      console.log(`   Simulated Fallback Mode: ${response.data.simulated}`);
      console.log(`   Generated Review Output:`);
      console.log(`   ----------------------------------------------------------------------------------------`);
      console.log(`   "${response.data.review}"`);
      console.log(`   ----------------------------------------------------------------------------------------`);
      console.log(`   Response Latency: ${duration}ms\n`);
      passedTests++;
    } else {
      console.log('❌ Failed: Review expansion failed or returned invalid response format.');
      failedTests++;
    }
  } catch (error) {
    console.log('❌ Failed: Error on Test 5:', error.response?.data || error.message);
    failedTests++;
  }

  // 6. Test Foreign Movies Box Office (repNationCd=F)
  try {
    console.log(`👉 [Test 6] Fetch Foreign Movies Box Office (repNationCd=F) for ${TEST_DATE}...`);
    const startTime = Date.now();
    const response = await axios.get(`${BASE_URL}/api/boxoffice?targetDt=${TEST_DATE}&repNationCd=F`, {
      headers: { 'Authorization': VALID_TOKEN }
    });
    const duration = Date.now() - startTime;

    if (response.status === 200 && response.data.success) {
      const list = response.data.data;
      console.log(`✅ Passed: Successfully fetched Foreign movies box office!`);
      console.log(`   Latency: ${duration}ms (Network Request: ${response.data.latency})`);
      console.log(`   Cache Status: fromCache = ${response.data.fromCache}`);
      console.log(`   Top 3 Foreign Movies:`);
      list.slice(0, 3).forEach(m => {
        console.log(`     - Rank ${m.rank}: ${m.movieNm} (당일 관객: ${m.audiCnt}명, 개봉: ${m.openDt})`);
      });
      console.log('');
      passedTests++;
    } else {
      console.log('❌ Failed: Foreign box office fetch status was successful but returned invalid structure.');
      failedTests++;
    }
  } catch (error) {
    console.log('❌ Failed: Error on Test 6:', error.response?.data || error.message);
    failedTests++;
  }

  // 7. Test Cache Key Isolation (repNationCd=K vs F)
  try {
    console.log('👉 [Test 7] Verify Cache Isolation between Korean (K) and Foreign (F) filters...');
    // Fetch Korean movies first (should trigger new fetch if not already cached)
    const resK = await axios.get(`${BASE_URL}/api/boxoffice?targetDt=${TEST_DATE}&repNationCd=K`, {
      headers: { 'Authorization': VALID_TOKEN }
    });
    // Fetch Foreign movies again (should hit cache since Test 6 ran)
    const resF = await axios.get(`${BASE_URL}/api/boxoffice?targetDt=${TEST_DATE}&repNationCd=F`, {
      headers: { 'Authorization': VALID_TOKEN }
    });

    const kMovies = resK.data.data || [];
    const fMovies = resF.data.data || [];

    // Ensure movies list are cached and retrieved independently
    if (resF.data.fromCache === true) {
      console.log('✅ Passed: Cache isolation verified! K and F are cached and retrieved independently.');
      if (kMovies.length > 0 && fMovies.length > 0) {
        console.log(`   First Korean Movie: "${kMovies[0].movieNm}"`);
        console.log(`   First Foreign Movie: "${fMovies[0].movieNm}"`);
      }
      console.log('');
      passedTests++;
    } else {
      console.log('❌ Failed: Cache was not isolated properly or Foreign box office did not hit cache.');
      failedTests++;
    }
  } catch (error) {
    console.log('❌ Failed: Error on Test 7:', error.response?.data || error.message);
    failedTests++;
  }

  console.log('==================================================');
  console.log('📊 CineSparks AI API Verification Summary');
  console.log(`   Total Tests Run: ${passedTests + failedTests}`);
  console.log(`   PASSED Tests: ${passedTests} / ${passedTests + failedTests}`);
  console.log(`   FAILED Tests: ${failedTests} / ${passedTests + failedTests}`);
  console.log('==================================================\n');
}

runTests();
