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
    
    console.log('Waiting for movie cards to render...');
    await page.waitForSelector('.movie-card');
    
    // Get the title of the first movie card
    const firstMovieTitle = await page.evaluate(() => {
      const card = document.querySelector('.movie-card');
      const titleEl = card ? card.querySelector('.movie-title') : null;
      return titleEl ? titleEl.textContent : null;
    });
    console.log(`First movie card title: "${firstMovieTitle}"`);
    
    console.log('Clicking the first movie card to open details modal...');
    await page.click('.movie-card');
    await new Promise(r => setTimeout(r, 800));
    
    // Verify movie details modal is active
    const isDetailModalActive = await page.evaluate(() => {
      const modal = document.getElementById('movieModal');
      return modal ? modal.classList.contains('active') : false;
    });
    console.log('Is Movie Details Modal active:', isDetailModalActive);
    
    console.log('Clicking the "다이어리에 티켓 저장" button inside the details modal...');
    await page.click('#modalIssueTicketBtn');
    await new Promise(r => setTimeout(r, 800));
    
    // Verify details modal closed and space modal opened
    const modalStates = await page.evaluate(() => {
      const movieModal = document.getElementById('movieModal');
      const spaceModal = document.getElementById('cineDiaryModal');
      return {
        movieModalActive: movieModal ? movieModal.classList.contains('active') : false,
        spaceModalActive: spaceModal ? spaceModal.classList.contains('active') : false
      };
    });
    console.log('Modal states after click:', modalStates);
    
    // Check pre-populated title and poster preview
    const ticketFormState = await page.evaluate(() => {
      const titleInput = document.getElementById('ticketMovieNm');
      const img = document.getElementById('previewPosterImg');
      return {
        value: titleInput ? titleInput.value : '',
        posterImgSrc: img ? img.src : null,
        posterImgDisplay: img ? img.style.display : null
      };
    });
    console.log('Ticket form state:', ticketFormState);
    
    if (ticketFormState.value === firstMovieTitle) {
      console.log('SUCCESS: Movie title is correctly pre-populated in the ticket book!');
    } else {
      console.log('FAIL: Movie title was not populated correctly.');
    }
    
    if (ticketFormState.posterImgSrc && ticketFormState.posterImgSrc.includes('tmdb.org')) {
      console.log('SUCCESS: Poster preview is successfully fetched and rendered dynamically!');
    } else {
      console.log('WARNING: Poster preview image not loaded from tmdb yet.');
    }
    
  } catch (e) {
    console.error('Test execution failed:', e);
  } finally {
    if (browser) await browser.close();
  }
})();
