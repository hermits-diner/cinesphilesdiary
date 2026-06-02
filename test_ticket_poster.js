const puppeteer = require('puppeteer');
(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });
    page.on('pageerror', err => {
      console.error(`[BROWSER PAGEERROR]: ${err.toString()}`);
    });

    console.log('Navigating to http://localhost:5001 ...');
    await page.goto('http://localhost:5001', { waitUntil: 'networkidle2' });
    
    console.log('Opening CineDiary modal...');
    await page.evaluate(() => {
      document.getElementById('cineDiaryBtn').click();
    });
    await new Promise(r => setTimeout(r, 500));
    
    console.log('Typing "인터스텔라" in the ticket movie name field...');
    await page.type('#ticketMovieNm', '인터스텔라');
    
    console.log('Waiting 1.5 seconds for debounced poster fetch...');
    await new Promise(r => setTimeout(r, 1500));
    
    console.log('Firing saveTicketBtn click in DOM...');
    await page.evaluate(() => {
      document.getElementById('saveTicketBtn').click();
    });
    console.log('Waiting 1.5 seconds for async save and render to complete...');
    await new Promise(r => setTimeout(r, 1500));
    
    const carouselHtml = await page.evaluate(() => {
      const carousel = document.getElementById('savedTicketsCarousel');
      return carousel ? carousel.outerHTML : 'Not found';
    });
    
    console.log('--- carousel outerHTML ---');
    console.log(carouselHtml);
    console.log('--------------------------');
    
  } catch (e) {
    console.error('Test execution failed:', e);
  } finally {
    if (browser) await browser.close();
  }
})();
