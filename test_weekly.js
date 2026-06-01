require('dotenv').config();
const axios = require('axios');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;
const VALID_TOKEN = `Bearer ${process.env.APP_AUTH_TOKEN || 'DEFAULT_CINESPARKS_AUTH_TOKEN'}`;

async function testWeeklyBoxOffice() {
  console.log('==================================================');
  console.log('🧪 Testing /api/weeklyboxoffice endpoint...');
  console.log('==================================================');

  try {
    const targetDt = '20260524'; // A Sunday in May 2026
    const url = `${BASE_URL}/api/weeklyboxoffice?targetDt=${targetDt}&repNationCd=ALL&weekGb=0`;
    console.log(`📡 GET Request to: ${url}`);
    
    const response = await axios.get(url, {
      headers: { 'Authorization': VALID_TOKEN }
    });

    if (response.status === 200 && response.data.success) {
      console.log('✅ Weekly Box Office Test Passed!');
      console.log(`Latency: ${response.data.latency}`);
      console.log(`From Cache: ${response.data.fromCache}`);
      console.log('Movies List:');
      
      response.data.data.slice(0, 5).forEach((movie) => {
        console.log(`  Rank ${movie.rank}: ${movie.movieNm}`);
        console.log(`    개봉일: ${movie.openDt}`);
        console.log(`    매출액: ${movie.formattedSales} (원래값: ${movie.salesAmt})`);
        console.log(`    관객수: ${movie.formattedAudi} (원래값: ${movie.audiCnt})`);
        console.log(`    장르: ${movie.genre || '정보 없음'}`);
        console.log(`    포스터 존재 여부: ${movie.poster ? 'Yes' : 'No'}`);
      });
    } else {
      console.log('❌ Failed: Invalid response format', response.data);
    }
  } catch (error) {
    console.log('❌ Failed: Request failed with error:', error.response?.data || error.message);
  }
}

testWeeklyBoxOffice();
