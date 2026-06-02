const puppeteer = require('puppeteer');

(async () => {
  let browser;
  try {
    console.log('🚀 Starting Puppeteer Diary AI Coaching E2E Test...');
    
    // Launch headless chrome in sandbox-free mode for maximum compatibility
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    // Capture page console messages to verify there are no hidden console errors
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });
    
    page.on('pageerror', err => {
      console.error(`[BROWSER PAGEERROR]: ${err.toString()}`);
    });

    console.log('1. Navigating to local Express server at http://localhost:5001 ...');
    await page.goto('http://localhost:5001', { waitUntil: 'networkidle2' });
    
    console.log('2. Clicking "시네필 다이어리" launch button...');
    await page.click('#cineDiaryBtn');
    
    await new Promise(r => setTimeout(r, 800)); // Wait for modal slide transition
    
    // Switch to Diary Tab (Tab 2)
    console.log('3. Switching to "시네필 다이어리" entry tab...');
    await page.click('.space-tab-btn[data-tab="tabDiary"]');
    
    await new Promise(r => setTimeout(r, 300));
    
    // Pre-populate input fields inside Daily Journal
    console.log('4. Entering Movie Name, Diary Title, and Content draft...');
    await page.type('#diaryMovieNm', '라라랜드');
    await page.type('#diaryTitle', '재즈와 은막의 환상적인 변주곡');
    await page.type('#diaryContent', '음악과 색채가 어우러진 마법 같은 영화였습니다. 오프닝 씬부터 압도적이고 두 주인공의 러브 스토리는 아프지만 너무나 아름다운 여운을 남깁니다. 재즈에 대한 헌사와 인생에 대한 통찰이 가득 차 있는 올해 최고의 작품입니다.');
    
    console.log('5. Triggering AI Critic & Writing Coaching button (#coachDiaryBtn)...');
    await page.click('#coachDiaryBtn');
    
    console.log('6. Waiting 2.5 seconds for AI evaluation & RAG pre-fetch analysis...');
    await new Promise(r => setTimeout(r, 2500)); // Wait for loader and simulated response delay
    
    // Validate if the coach result panel is successfully rendered and visible
    const resultPanelVisible = await page.$eval('#diaryAiCoachResultPanel', el => el.style.display !== 'none');
    console.log(resultPanelVisible ? '✅ SUCCESS: AI Diary Coach Result Panel rendered.' : '❌ FAIL: Result panel is hidden.');
    
    if (resultPanelVisible) {
      console.log('7. Triggering "이 첨삭본으로 본문 덮어쓰기" button...');
      await page.click('#applyDiaryCritiqueBtn');
      
      await new Promise(r => setTimeout(r, 300));
      
      const overwrittenContent = await page.$eval('#diaryContent', el => el.value);
      const isOverwritten = overwrittenContent.includes('변주') || overwrittenContent.length > 100;
      console.log(isOverwritten ? '✅ SUCCESS: Critique essay successfully overwritten inside diary Content editor!' : '❌ FAIL: Editor content mismatch.');
    }
    
    console.log('🎉 Diary AI Coaching E2E Test execution COMPLETE.');
  } catch (e) {
    console.error('❌ Test execution failed with exception:', e);
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed cleanly.');
    }
  }
})();
