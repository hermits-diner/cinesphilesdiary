require('dotenv').config();
const axios = require('axios');

const PORT = process.env.PORT || 5001;
const BASE_URL = `http://localhost:${PORT}`;
const VALID_TOKEN = `Bearer ${process.env.APP_AUTH_TOKEN || 'DEFAULT_CINESPARKS_AUTH_TOKEN'}`;

async function runUpcomingTests() {
  console.log('==================================================');
  console.log('🚀 CineSparks Upcoming Releases Test Suite Starting...');
  console.log('==================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  // 1. Test GET /api/upcoming API
  let firstMovieCd = '';
  let firstMovieNm = '';
  try {
    console.log('👉 [Test 1] Fetch upcoming releases from /api/upcoming...');
    const startTime = Date.now();
    const response = await axios.get(`${BASE_URL}/api/upcoming`, {
      headers: { 'Authorization': VALID_TOKEN }
    });
    const duration = Date.now() - startTime;

    if (response.status === 200 && response.data.success) {
      const list = response.data.data;
      console.log('✅ Passed: Successfully fetched upcoming releases!');
      console.log(`   Total Upcoming Movies: ${list.length}`);
      console.log(`   Response Latency: ${duration}ms (fromCache: ${response.data.fromCache})`);
      
      if (list.length > 0) {
        console.log('   Top 3 Upcoming Releases:');
        list.slice(0, 3).forEach((m, idx) => {
          console.log(`     - [Upcoming #${idx + 1}] ${m.movieNm} (개봉예정일: ${m.openDt}, 장르: ${m.genre})`);
        });
        
        firstMovieCd = list[0].movieCd;
        firstMovieNm = list[0].movieNm;
      } else {
        console.log('   ⚠️ Warning: Upcoming movie list is empty.');
      }
      passedTests++;
    } else {
      console.log('❌ Failed: Upcoming movies fetch returned invalid response.');
      failedTests++;
    }
  } catch (error) {
    console.log('❌ Failed: Error on Test 1:', error.response?.data || error.message);
    failedTests++;
  }

  // 2. Test GET /api/movie details for TMDB synthetic code
  if (firstMovieCd) {
    try {
      console.log(`\n👉 [Test 2] Fetch full movie details for TMDB code: ${firstMovieCd} (${firstMovieNm})...`);
      const startTime = Date.now();
      const response = await axios.get(`${BASE_URL}/api/movie?movieCd=${firstMovieCd}`, {
        headers: { 'Authorization': VALID_TOKEN }
      });
      const duration = Date.now() - startTime;

      if (response.status === 200 && response.data.success) {
        const details = response.data.data;
        console.log('✅ Passed: Successfully resolved detailed TMDB metadata!');
        console.log(`   Title (En): ${details.movieNmEn}`);
        console.log(`   Directors: ${details.directors}`);
        console.log(`   Genres: ${details.genres}`);
        console.log(`   Actors: ${details.actors.split(', ').slice(0, 4).join(', ')}...`);
        console.log(`   Showtime: ${details.showTm ? details.showTm + ' mins' : 'N/A'}`);
        console.log(`   Rating: ${details.rating || 'N/A'}`);
        console.log(`   Trailer key: ${details.trailerKey || 'N/A'}`);
        console.log(`   Overview length: ${details.overview ? details.overview.length : 0} chars`);
        console.log(`   Response Latency: ${duration}ms (fromCache: ${response.data.fromCache})`);
        passedTests++;
      } else {
        console.log('❌ Failed: TMDB movie details fetched returned invalid response.');
        failedTests++;
      }
    } catch (error) {
      console.log('❌ Failed: Error on Test 2:', error.response?.data || error.message);
      failedTests++;
    }
  } else {
    console.log('\n⚠️ Skipping Test 2: No upcoming movie code available from Test 1.');
  }

  console.log('\n==================================================');
  console.log('📊 CineSparks Upcoming Releases Test Summary');
  console.log(`   Total Tests Run: ${passedTests + failedTests}`);
  console.log(`   PASSED Tests: ${passedTests} / ${passedTests + failedTests}`);
  console.log(`   FAILED Tests: ${failedTests} / ${passedTests + failedTests}`);
  console.log('==================================================\n');
}

runUpcomingTests();
