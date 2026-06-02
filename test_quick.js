require('dotenv').config();
const puppeteer = require('puppeteer');
const PORT = process.env.PORT || 5000;
(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle2' });
    await page.click('#cineDiaryBtn');
    await new Promise(r => setTimeout(r, 1000));
    const active = await page.$eval('#cineDiaryModal', el => el.classList.contains('active'));
    console.log(active ? 'SUCCESS: Modal opened.' : 'FAIL: Modal did not open.');
  } finally {
    if (browser) await browser.close();
  }
})();
