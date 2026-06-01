const puppeteer = require('puppeteer');
(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto('http://localhost:5000', { waitUntil: 'networkidle2' });
    await page.click('#cinesparkSpaceBtn');
    await new Promise(r => setTimeout(r, 1000));
    const active = await page.$eval('#cinesparkSpaceModal', el => el.classList.contains('active'));
    console.log(active ? 'SUCCESS: Modal opened.' : 'FAIL: Modal did not open.');
  } finally {
    if (browser) await browser.close();
  }
})();
