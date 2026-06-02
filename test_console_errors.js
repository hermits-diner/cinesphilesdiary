const puppeteer = require('puppeteer');
(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    // Capture page console messages
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });
    
    page.on('pageerror', err => {
      console.error(`[BROWSER PAGEERROR]: ${err.toString()}`);
    });

    console.log('Navigating to http://localhost:5001 ...');
    await page.goto('http://localhost:5001', { waitUntil: 'networkidle2' });
    
    console.log('Clicking button #cineDiaryBtn...');
    await page.click('#cineDiaryBtn');
    
    await new Promise(r => setTimeout(r, 1000));
    
    const active = await page.$eval('#cineDiaryModal', el => el.classList.contains('active'));
    console.log(active ? 'SUCCESS: Modal opened.' : 'FAIL: Modal did not open.');
  } catch (e) {
    console.error('Test execution failed:', e);
  } finally {
    if (browser) await browser.close();
  }
})();
