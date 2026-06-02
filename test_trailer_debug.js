const puppeteer = require('puppeteer');

(async () => {
  let browser;
  try {
    console.log('🚀 Launching Trailer Component Debug E2E...');
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });
    
    page.on('pageerror', err => {
      console.error(`[BROWSER PAGEERROR]: ${err.toString()}`);
    });

    console.log('1. Navigating to http://localhost:5001 ...');
    await page.goto('http://localhost:5001', { waitUntil: 'networkidle2' });
    
    // Wait for movie cards to render
    await page.waitForSelector('.movie-card');
    
    console.log('2. Clicking the first movie card to open details modal...');
    await page.click('.movie-card');
    
    console.log('3. Waiting 3.5 seconds for details API and trailer key binding...');
    await new Promise(r => setTimeout(r, 3500));
    
    // Check trailer DOM states
    const info = await page.evaluate(() => {
      const container = document.getElementById('modalTrailerContainer');
      const frameWrap = document.getElementById('modalTrailerFrameWrap');
      const frame = document.getElementById('modalTrailerFrame');
      const fallback = document.getElementById('modalTrailerFallback');
      
      return {
        containerDisplay: container ? container.style.display : 'NOT FOUND',
        frameWrapDisplay: frameWrap ? frameWrap.style.display : 'NOT FOUND',
        fallbackDisplay: fallback ? fallback.style.display : 'NOT FOUND',
        frameSrc: frame ? frame.src : 'NOT FOUND'
      };
    });
    
    console.log('📊 Trailer Component DOM States:', info);
    
  } catch (e) {
    console.error('❌ Debug run failed:', e);
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed.');
    }
  }
})();
