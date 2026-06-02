// Application State and Configuration
// Dynamically detect Express API server location based on running environment
const BACKEND_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '' // Same-host relative path for local development
  : (localStorage.getItem('CINEDIARY_BACKEND_URL') || ''); // Loaded from manual user settings on static hosting

let API_HEADERS = {
  'Content-Type': 'application/json'
};

// XSS Prevention: escape any string before inserting into innerHTML
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Generate consistent, aesthetic cinematic gradients based on movie title hash
function getRandomGradient(movieNm) {
  const gradients = [
    'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)', // Indigo & Deep Violet
    'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', // Slate & Indigo
    'linear-gradient(135deg, #180828 0%, #2e0817 100%)', // Plum & Dark Rose
    'linear-gradient(135deg, #022c22 0%, #064e3b 100%)', // Emerald Deep
    'linear-gradient(135deg, #1c0d02 0%, #2d1500 100%)', // Warm Bronze Deep
    'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'  // Slate Cool
  ];
  
  if (!movieNm) return gradients[0];
  
  let hash = 0;
  for (let i = 0; i < movieNm.length; i++) {
    hash = movieNm.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

// Generate aesthetic, dynamic placeholders based on TMDB movie genre
function getGenrePlaceholder(genre, movieNm) {
  // Define default values
  let iconClass = 'fa-solid fa-film';
  let gradientStr = getRandomGradient(movieNm);
  let genreName = genre || '영화';

  // Clean and normalize genre input (which can be a comma separated string in details)
  const normGenre = genre ? genre.trim() : '';

  // Specific genre palettes & icons mapping
  if (normGenre) {
    if (normGenre.includes('애니메이션')) {
      iconClass = 'fa-solid fa-wand-magic-sparkles';
      gradientStr = 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)'; // Soft Pink to Purple
      genreName = '애니메이션';
    } else if (normGenre.includes('로맨스') || normGenre.includes('멜로') || normGenre.includes('사랑')) {
      iconClass = 'fa-solid fa-heart';
      gradientStr = 'linear-gradient(135deg, #f43f5e 0%, #fda4af 100%)'; // Vivid Rose to Pastel Pink
      genreName = '로맨스';
    } else if (normGenre.includes('SF') || normGenre.includes('판타지') || normGenre.includes('모험')) {
      iconClass = 'fa-solid fa-rocket';
      gradientStr = 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)'; // Cyan to Royal Blue
      genreName = 'SF/판타지';
    } else if (normGenre.includes('액션') || normGenre.includes('전쟁')) {
      iconClass = 'fa-solid fa-bolt-lightning';
      gradientStr = 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)'; // Fiery Red to Orange
      genreName = '액션';
    } else if (normGenre.includes('공포') || normGenre.includes('스릴러') || normGenre.includes('미스터리')) {
      iconClass = 'fa-solid fa-mask';
      gradientStr = 'linear-gradient(135deg, #1e1b4b 0%, #431407 100%)'; // Deep Navy to Scorched Red
      genreName = '스릴러/공포';
    } else if (normGenre.includes('음악') || normGenre.includes('뮤지컬')) {
      iconClass = 'fa-solid fa-music';
      gradientStr = 'linear-gradient(135deg, #10b981 0%, #6366f1 100%)'; // Green to Violet
      genreName = '음악';
    } else if (normGenre.includes('다큐멘터리') || normGenre.includes('역사')) {
      iconClass = 'fa-solid fa-earth-americas';
      gradientStr = 'linear-gradient(135deg, #047857 0%, #064e3b 100%)'; // Deep Forest Emerald
      genreName = '다큐멘터리';
    } else if (normGenre.includes('코미디')) {
      iconClass = 'fa-solid fa-face-laugh-beam';
      gradientStr = 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)'; // Bright Amber
      genreName = '코미디';
    } else {
      // Split comma-separated genres and take first one if mapped
      const firstGenre = normGenre.split(', ')[0];
      genreName = firstGenre;
    }
  } else {
    // Guesses based on movie name keywords for highly commonAnimation/Action cases
    const cleanNm = movieNm.toLowerCase();
    if (cleanNm.includes('사랑') || cleanNm.includes('하츄핑') || cleanNm.includes('뽀로로') || cleanNm.includes('티니핑') || cleanNm.includes('토이')) {
      iconClass = 'fa-solid fa-wand-magic-sparkles';
      gradientStr = 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)';
      genreName = '애니메이션';
    } else if (cleanNm.includes('탈출') || cleanNm.includes('전쟁') || cleanNm.includes('전투') || cleanNm.includes('대작전') || cleanNm.includes('미션')) {
      iconClass = 'fa-solid fa-bolt-lightning';
      gradientStr = 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)';
      genreName = '액션';
    }
  }

  return { iconClass, gradientStr, genreName };
}

// State variables to hold the active film metadata
let activeMovieInfo = null;
let activeRating = 0; // Selected rating state (1-5 stars)
let currentNation = 'ALL'; // Nationality filter state ('ALL', 'K', 'F')
let currentViewMode = 'BOXOFFICE'; // Main view mode ('BOXOFFICE', 'WEEKLYBOXOFFICE', 'UPCOMING')

// Calculate which week of the month a date belongs to
function getWeekOfMonth(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed
  
  // Find the first day of the month
  const firstDay = new Date(year, date.getMonth(), 1);
  const firstDayOfWeek = firstDay.getDay(); // 0 (Sunday) to 6 (Saturday)
  
  // Calculate day of the month
  const day = date.getDate();
  
  // Week number calculation
  const weekNum = Math.ceil((day + firstDayOfWeek) / 7);
  
  return `${month}월 ${weekNum}주차`;
}

// Premium Presets Default Config (Option 1)
const DEFAULT_PRESETS = [
  {
    name: "✨ 프리셋 선택 안 함",
    theater: "CGV",
    seat: "",
    companions: "",
    snacks: "",
    review: ""
  },
  {
    name: "🍿 나홀로 주말 극장",
    theater: "CGV",
    seat: "IMAX관 H열 12번",
    companions: "혼자서",
    snacks: "고소한 팝콘 & 콜라",
    review: "오롯이 영화에만 몰입했던 주말의 평화로운 시간."
  },
  {
    name: "❤️ 연인과 밤늦게 로맨스",
    theater: "롯데시네마",
    seat: "샤롯데 커플석 3C",
    companions: "연인과 함께",
    snacks: "반반 팝콘 & 오렌지 에이드",
    review: "낭만 가득한 밤, 소중한 사람과 함께한 따뜻하고 달콤했던 감상."
  },
  {
    name: "🎬 집에서 편안하게 이불속 OTT",
    theater: "집 / OTT",
    seat: "내 침대 머리맡",
    companions: "혼자서",
    snacks: "나초칩 & 캔맥주",
    review: "가장 편안한 자세로 즐기는 나만의 영화관, 밤새도록 이어지는 힐링."
  },
  {
    name: "🍔 친구들과 매점 격파",
    theater: "메가박스",
    seat: "컴포트관 6열",
    companions: "친구들과",
    snacks: "핫도그 & 칠리치즈나초 & 패밀리 콤보",
    review: "함께 웃고 떠들며 감동을 공유한, 우정이 더욱 돈독해진 시간."
  }
];

// Premium Diary Reflective Guide Templates (Option 3)
const DIARY_GUIDE_TEMPLATES = {
  'best-minute': `[🎬 최고의 1분]
- 내 심장을 가장 뛰게 만든 최고의 명장면:
  
- 그 장면이 나에게 특별한 전율을 선사한 이유:
  
- 시청각적인 연출이나 배우의 미세한 연기 디테일:
  `,
  'quote-message': `[💬 잊지 못할 명대사 & 메시지]
" "
  
- 이 대사 혹은 영화 속 메시지가 내 삶에 던지는 묵직한 물음:
  
- 현실의 내 모습이나 상황에 빗대어 가장 깊이 성찰했던 부분:
  `,
  'recommend-love': `[❤️ 소중한 이에게 추천]
- 이 영화를 꼭 보여주고 싶은 나의 가장 특별한 사람:
  
- 그 사람에게 이 영화를 권하고 싶은 애정 어린 이유:
  
- 영화를 본 후 그 사람과 단둘이 깊게 나누고 싶은 깊은 대화 주제:
  `
};

// DOM Elements
const dateInput = document.getElementById('boxOfficeDate');
const currentDateTitle = document.getElementById('currentDateTitle');
const movieGrid = document.getElementById('movieGrid');

// Modal Elements
const movieModal = document.getElementById('movieModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalMovieTitle = document.getElementById('modalMovieTitle');
const modalMovieSubTitle = document.getElementById('modalMovieSubTitle');
const specGenre = document.getElementById('specGenre');
const specShowtime = document.getElementById('specShowtime');
const specDirectors = document.getElementById('specDirectors');
const specActors = document.getElementById('specActors');

// Cinema Log Elements
const ratingStars = document.getElementById('ratingStars');
const ratingScoreText = document.getElementById('ratingScoreText');
const userReviewInput = document.getElementById('userReviewInput');
const charCounter = document.getElementById('charCounter');
const saveReviewBtn = document.getElementById('saveReviewBtn');
const deleteReviewBtn = document.getElementById('deleteReviewBtn');

// Settings Modal DOM Elements
const settingsModal = document.getElementById('settingsModal');
const settingsBtn = document.getElementById('settingsBtn');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const backendUrlInput = document.getElementById('backendUrlInput');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// 1. Initialize Date Constraints & Load Data
window.addEventListener('DOMContentLoaded', async () => {
  console.log('[CineDiary] DOMContentLoaded fired — starting initialization...');
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Fetch auth token from server securely
  try {
    const initRes = await fetch(`${BACKEND_BASE}/api/init`);
    const initData = await initRes.json();
    if (initData.token) {
      API_HEADERS['Authorization'] = `Bearer ${initData.token}`;
    }
  } catch (e) {
    console.error('Failed to fetch init token:', e);
    if (!isLocal) {
      setTimeout(() => {
        showToast('서버 연결 실패', '설정된 API 백엔드 서버와 통신할 수 없습니다. 서버 상태 또는 설정 주소를 확인해 주세요.', 'error');
      }, 2000);
    }
  }

  const yesterday = getYesterdayDateString();
  
  // Set date constraints: default value is yesterday, max date is yesterday (today/future disabled)
  if (dateInput) {
    dateInput.value = yesterday;
    dateInput.max = yesterday;
  }

  // Initial load
  loadBoxOfficeData(yesterday);
  // Attach events
  if (dateInput) {
    dateInput.addEventListener('change', (e) => {
      if (currentViewMode === 'BOXOFFICE') {
        loadBoxOfficeData(e.target.value, currentNation);
      } else if (currentViewMode === 'WEEKLYBOXOFFICE') {
        loadWeeklyBoxOfficeData(e.target.value, currentNation);
      }
    });
  }

  // Box Office Nationality Filter Tabs Click Event Listeners
  const filterBtns = document.querySelectorAll('#nationTabsContainer .boxoffice-filter-btn');
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const selectedNation = btn.getAttribute('data-nation') || 'ALL';
      if (selectedNation === currentNation) return;

      currentNation = selectedNation;

      // Update active class on filter buttons
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      // Reload box office data with selected nationality filter
      if (dateInput) {
        if (currentViewMode === 'BOXOFFICE') {
          loadBoxOfficeData(dateInput.value, currentNation);
        } else if (currentViewMode === 'WEEKLYBOXOFFICE') {
          loadWeeklyBoxOfficeData(dateInput.value, currentNation);
        }
      }
    });
  });

  // Main Content View Mode Switcher
  const tabBoxOfficeBtn = document.getElementById('tabBoxOfficeBtn');
  const tabWeeklyBoxOfficeBtn = document.getElementById('tabWeeklyBoxOfficeBtn');
  const tabUpcomingBtn = document.getElementById('tabUpcomingBtn');
  const mainSectionIcon = document.getElementById('mainSectionIcon');
  const mainSectionText = document.getElementById('mainSectionText');
  const nationTabsContainer = document.getElementById('nationTabsContainer');

  if (tabBoxOfficeBtn && tabWeeklyBoxOfficeBtn && tabUpcomingBtn) {
    tabBoxOfficeBtn.addEventListener('click', () => {
      if (currentViewMode === 'BOXOFFICE') return;
      currentViewMode = 'BOXOFFICE';

      tabBoxOfficeBtn.classList.add('active');
      tabWeeklyBoxOfficeBtn.classList.remove('active');
      tabUpcomingBtn.classList.remove('active');

      if (nationTabsContainer) nationTabsContainer.style.display = '';
      if (currentDateTitle) currentDateTitle.style.display = '';
      if (mainSectionIcon) {
        mainSectionIcon.className = 'fa-solid fa-chart-line';
      }
      if (mainSectionText) {
        mainSectionText.textContent = '일별 박스오피스';
      }

      // Reset to yesterday for daily box office
      const yesterday = getYesterdayDateString();
      dateInput.value = yesterday;
      loadBoxOfficeData(yesterday, currentNation);
    });

    tabWeeklyBoxOfficeBtn.addEventListener('click', () => {
      if (currentViewMode === 'WEEKLYBOXOFFICE') return;
      currentViewMode = 'WEEKLYBOXOFFICE';

      tabWeeklyBoxOfficeBtn.classList.add('active');
      tabBoxOfficeBtn.classList.remove('active');
      tabUpcomingBtn.classList.remove('active');

      if (nationTabsContainer) nationTabsContainer.style.display = '';
      if (currentDateTitle) currentDateTitle.style.display = '';
      if (mainSectionIcon) {
        mainSectionIcon.className = 'fa-solid fa-calendar-days';
      }
      if (mainSectionText) {
        mainSectionText.textContent = '주별 박스오피스';
      }

      // Default to the previous week (selected date minus 7 days)
      const currentDate = new Date(dateInput.value);
      currentDate.setDate(currentDate.getDate() - 7);
      const prevWeekDateStr = currentDate.toISOString().split('T')[0];

      dateInput.value = prevWeekDateStr;
      loadWeeklyBoxOfficeData(prevWeekDateStr, currentNation);
    });

    tabUpcomingBtn.addEventListener('click', () => {
      if (currentViewMode === 'UPCOMING') return;
      currentViewMode = 'UPCOMING';

      tabUpcomingBtn.classList.add('active');
      tabBoxOfficeBtn.classList.remove('active');
      tabWeeklyBoxOfficeBtn.classList.remove('active');

      if (nationTabsContainer) nationTabsContainer.style.display = 'none';
      if (currentDateTitle) currentDateTitle.style.display = 'none';
      if (mainSectionIcon) {
        mainSectionIcon.className = 'fa-solid fa-hourglass-half';
      }
      if (mainSectionText) {
        mainSectionText.textContent = '곧 개봉할 상영 예정작';
      }

      loadUpcomingMovies();
    });
  }
  
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeModal);
  }
  if (movieModal) {
    movieModal.addEventListener('click', (e) => {
      if (e.target === movieModal) closeModal();
    });
  }

  // Settings Modal actions
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      backendUrlInput.value = localStorage.getItem('CINEDIARY_BACKEND_URL') || '';
      settingsModal.classList.add('active');
    });
  }

  if (settingsCloseBtn) {
    settingsCloseBtn.addEventListener('click', () => {
      settingsModal.classList.remove('active');
    });
  }

  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) settingsModal.classList.remove('active');
    });
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      const url = backendUrlInput.value.trim().replace(/\/$/, ''); // Remove trailing slash if any
      if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        showToast('유효하지 않은 주소', '서버 주소는 http:// 또는 https://로 시작해야 합니다.', 'error');
        return;
      }
      if (url) {
        localStorage.setItem('CINEDIARY_BACKEND_URL', url);
        showToast('설정 저장 완료', 'API 서버 주소가 저장되었습니다. 페이지를 리로드합니다.', 'success');
      } else {
        localStorage.removeItem('CINEDIARY_BACKEND_URL');
        showToast('설정 초기화 완료', '로컬 테스트용 기본 경로로 초기화되었습니다. 페이지를 리로드합니다.', 'success');
      }
      setTimeout(() => location.reload(), 1500);
    });
  }

  // Textarea input and rating setup management
  if (userReviewInput) {
    userReviewInput.addEventListener('input', handleReviewInput);
  }
  
  // Star rating events initialization
  setupInteractiveStars();

  if (saveReviewBtn) {
    saveReviewBtn.addEventListener('click', saveCinemaLog);
  }
  if (deleteReviewBtn) {
    deleteReviewBtn.addEventListener('click', deleteCinemaLog);
  }

  // CineDiary Modal Open / Close Events are handled via highly resilient inline HTML onclick handlers to bypass any browser caching or timing issues!
  const cinesparkSpaceBtn = document.getElementById('cineDiaryBtn');
  const cinesparkSpaceModal = document.getElementById('cineDiaryModal');
  const spaceCloseBtn = document.getElementById('spaceCloseBtn');

  console.log('[CineDiary] Space button found:', !!cinesparkSpaceBtn, '| Modal found:', !!cinesparkSpaceModal);
  if (cinesparkSpaceModal) {
    cinesparkSpaceModal.addEventListener('click', (e) => {
      if (e.target === cinesparkSpaceModal) {
        cinesparkSpaceModal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }

  // --- CineDiary Tab Navigation Setup ---
  const tabBtns = document.querySelectorAll('.space-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTabId = btn.getAttribute('data-tab');
      
      // Toggle button active classes
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Toggle tab content active classes
      const tabContents = document.querySelectorAll('.space-tab-content');
      tabContents.forEach(c => c.classList.remove('active'));
      
      const targetContent = document.getElementById(targetTabId);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });

  // --- Tab 1: Ticket Stub Input Listeners ---
  const ticketFormIds = ['ticketMovieNm', 'ticketWatchDate', 'ticketTheater', 'ticketSeat', 'ticketCompanions', 'ticketSnacks', 'ticketReview'];
  ticketFormIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateLiveTicketPreview);
      el.addEventListener('change', updateLiveTicketPreview);
    }
  });

  // Debounced live poster preview fetcher for the Ticket Book
  const ticketMovieNmEl = document.getElementById('ticketMovieNm');
  if (ticketMovieNmEl) {
    let posterFetchTimeout = null;
    const fetchPosterHandler = () => {
      clearTimeout(posterFetchTimeout);
      posterFetchTimeout = setTimeout(() => {
        const movieNm = ticketMovieNmEl.value.trim();
        loadTicketPosterPreview(movieNm);
      }, 500);
    };
    ticketMovieNmEl.addEventListener('input', fetchPosterHandler);
    ticketMovieNmEl.addEventListener('change', fetchPosterHandler);
    ticketMovieNmEl.addEventListener('blur', () => {
      clearTimeout(posterFetchTimeout);
      const movieNm = ticketMovieNmEl.value.trim();
      loadTicketPosterPreview(movieNm);
    });
  }

  // Save Ticket Stub click
  const saveTicketBtn = document.getElementById('saveTicketBtn');
  if (saveTicketBtn) {
    saveTicketBtn.addEventListener('click', saveTicketStub);
  }

  // Issue ticket directly from Movie Details Modal
  const modalIssueTicketBtn = document.getElementById('modalIssueTicketBtn');
  if (modalIssueTicketBtn) {
    modalIssueTicketBtn.addEventListener('click', () => {
      if (!activeMovieInfo || !activeMovieInfo.movieNm) return;
      
      const movieNm = activeMovieInfo.movieNm;
      
      // 1. Close movie details modal
      closeModal();
      
      // 2. Open CineDiary modal
      openCineDiary();
      
      // 3. Switch to Ticket tab
      const ticketTabBtn = document.querySelector('.space-tab-btn[data-tab="tabTicket"]');
      if (ticketTabBtn) {
        ticketTabBtn.click();
      }
      
      // 4. Pre-populate Movie Title input and trigger poster preview fetch
      const ticketMovieNmEl = document.getElementById('ticketMovieNm');
      if (ticketMovieNmEl) {
        ticketMovieNmEl.value = movieNm;
        updateLiveTicketPreview();
        loadTicketPosterPreview(movieNm);
      }
      
      // 5. Focus companion input to guide user
      const ticketCompanionsEl = document.getElementById('ticketCompanions');
      if (ticketCompanionsEl) {
        setTimeout(() => ticketCompanionsEl.focus(), 300);
      }
    });
  }

  // --- Tab 2: Diary Emotion Row Setup ---
  const emotionBtns = document.querySelectorAll('#diaryEmotionRow .emotion-btn');
  emotionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      emotionBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeDiaryEmotion = btn.getAttribute('data-emoji') || '🍿';
    });
  });

  // Save Diary Entry click
  const saveDiaryBtn = document.getElementById('saveDiaryBtn');
  if (saveDiaryBtn) {
    saveDiaryBtn.addEventListener('click', saveDiaryEntry);
  }

  // --- Tab 3: Bucket List Board Setup ---
  const createBucketBtn = document.getElementById('createBucketBtn');
  if (createBucketBtn) {
    createBucketBtn.addEventListener('click', createBucketBoard);
  }

  // --- Premium Ticket Preset Engine (Option 1) ---
  const presetSelect = document.getElementById('ticketPresetSelect');
  const savePresetBtn = document.getElementById('savePresetBtn');

  function loadPresets() {
    if (!presetSelect) return;
    
    let presets = [];
    try {
      presets = JSON.parse(localStorage.getItem('CINEDIARY_PRESETS') || '[]');
    } catch (e) {
      console.error('Failed to parse presets:', e);
    }
    
    const allPresets = [...DEFAULT_PRESETS, ...presets];
    
    presetSelect.innerHTML = '';
    allPresets.forEach((p, idx) => {
      const option = document.createElement('option');
      option.value = idx;
      option.textContent = p.name;
      presetSelect.appendChild(option);
    });
  }

  if (presetSelect) {
    loadPresets();
    
    presetSelect.addEventListener('change', () => {
      const idx = parseInt(presetSelect.value, 10);
      let presets = [];
      try {
        presets = JSON.parse(localStorage.getItem('CINEDIARY_PRESETS') || '[]');
      } catch (e) {}
      
      const allPresets = [...DEFAULT_PRESETS, ...presets];
      const selected = allPresets[idx];
      
      if (selected) {
        const ticketTheaterEl = document.getElementById('ticketTheater');
        const ticketSeatEl = document.getElementById('ticketSeat');
        const ticketCompanionsEl = document.getElementById('ticketCompanions');
        const ticketSnacksEl = document.getElementById('ticketSnacks');
        const ticketReviewEl = document.getElementById('ticketReview');
        
        if (ticketTheaterEl) ticketTheaterEl.value = selected.theater || 'CGV';
        if (ticketSeatEl) ticketSeatEl.value = selected.seat || '';
        if (ticketCompanionsEl) ticketCompanionsEl.value = selected.companions || '';
        if (ticketSnacksEl) ticketSnacksEl.value = selected.snacks || '';
        if (ticketReviewEl) ticketReviewEl.value = selected.review || '';
        
        updateLiveTicketPreview();
        showToast('프리셋 적용 완료', `"${selected.name}" 템플릿이 로드되었습니다.`, 'success');
      }
    });
  }

  if (savePresetBtn) {
    savePresetBtn.addEventListener('click', () => {
      const presetName = prompt('추가할 새로운 커스텀 프리셋의 이름을 입력해 주세요:');
      if (!presetName) return;
      const cleanName = presetName.trim();
      if (!cleanName) {
        showToast('추가 실패', '프리셋 이름을 올바르게 입력해 주세요.', 'error');
        return;
      }
      
      const ticketTheaterEl = document.getElementById('ticketTheater');
      const ticketSeatEl = document.getElementById('ticketSeat');
      const ticketCompanionsEl = document.getElementById('ticketCompanions');
      const ticketSnacksEl = document.getElementById('ticketSnacks');
      const ticketReviewEl = document.getElementById('ticketReview');
      
      const newPreset = {
        name: `⭐️ ${cleanName}`,
        theater: ticketTheaterEl ? ticketTheaterEl.value : 'CGV',
        seat: ticketSeatEl ? ticketSeatEl.value.trim() : '',
        companions: ticketCompanionsEl ? ticketCompanionsEl.value.trim() : '',
        snacks: ticketSnacksEl ? ticketSnacksEl.value.trim() : '',
        review: ticketReviewEl ? ticketReviewEl.value.trim() : ''
      };
      
      let presets = [];
      try {
        presets = JSON.parse(localStorage.getItem('CINEDIARY_PRESETS') || '[]');
      } catch (e) {}
      
      presets.push(newPreset);
      try {
        localStorage.setItem('CINEDIARY_PRESETS', JSON.stringify(presets));
        loadPresets();
        presetSelect.value = DEFAULT_PRESETS.length + presets.length - 1;
        showToast('프리셋 추가 완료', `나만의 커스텀 프리셋 "${cleanName}"이 성공적으로 등록되었습니다.`, 'success');
      } catch (e) {
        showToast('저장 실패', '프리셋 저장 용량을 초과하였거나 쓸 수 없습니다.', 'error');
      }
    });
  }

  // --- Premium Diary Reflective Guide Templates (Option 3) ---
  const guideBtns = document.querySelectorAll('.template-guide-btn');
  const diaryContentEl = document.getElementById('diaryContent');
  
  guideBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const templateKey = btn.getAttribute('data-template');
      const templateText = DIARY_GUIDE_TEMPLATES[templateKey];
      
      if (!templateText || !diaryContentEl) return;
      
      const currentVal = diaryContentEl.value.trim();
      if (currentVal && currentVal !== templateText) {
        if (!confirm('현재 작성 중인 영화 감상문 글이 존재합니다. 정말로 템플릿 질문 가이드로 덮어쓰시겠습니까?')) {
          return;
        }
      }
      
      diaryContentEl.value = templateText;
      diaryContentEl.focus();
      showToast('템플릿 주입 성공', '비평가 전용 시네마 질문 가이드가 로드되었습니다. 영화 생각을 확장해 보세요!', 'success');
    });
  });

  // --- Global Movie Search Bar Bindings & Debouncing ---
  // Spotlight search input wiring (runs once on DOMContentLoaded)
  initSpotlightSearch();

  // --- AI Movie Review Coaching Click Handler ---
  const coachReviewBtn = document.getElementById('coachReviewBtn');
  if (coachReviewBtn) {
    coachReviewBtn.addEventListener('click', coachUserReview);
  }

  console.log('[CineDiary] ✅ DOMContentLoaded initialization COMPLETE. All event listeners registered.');
});

// Global Movie Search: Select movie item and open its detail modal
async function selectMovieFromSearch(movieCd, movieNm) {
  closeSpotlight();
  openMovieDetails(movieCd, movieNm);
}

// ── Spotlight Search ──────────────────────────────────────────────

function openSpotlight() {
  const overlay = document.getElementById('spotlightOverlay');
  if (!overlay) return;
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    const input = document.getElementById('spotlightInput');
    if (input) input.focus();
  }, 30);
}

function closeSpotlight() {
  const overlay = document.getElementById('spotlightOverlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  document.body.style.overflow = '';
  const input = document.getElementById('spotlightInput');
  if (input) input.value = '';
  const results = document.getElementById('spotlightResults');
  if (results) results.innerHTML = '';
  const clearBtn = document.getElementById('spotlightClearBtn');
  if (clearBtn) clearBtn.style.display = 'none';
}

function handleSpotlightBackdrop(e) {
  if (e.target === document.getElementById('spotlightOverlay')) closeSpotlight();
}

function initSpotlightSearch() {
  const input   = document.getElementById('spotlightInput');
  const results = document.getElementById('spotlightResults');
  const clearBtn = document.getElementById('spotlightClearBtn');
  if (!input || !results) return;

  let searchTimeout = null;

  input.addEventListener('input', () => {
    const query = input.value.trim();
    if (clearBtn) clearBtn.style.display = query.length > 0 ? 'flex' : 'none';

    clearTimeout(searchTimeout);
    if (query.length === 0) { results.innerHTML = ''; return; }

    searchTimeout = setTimeout(async () => {
      results.innerHTML = `
        <div style="padding:1.5rem;text-align:center;color:var(--color-text-muted);font-size:0.85rem;">
          <i class="fa-solid fa-spinner fa-spin" style="margin-right:0.5rem;color:var(--color-primary);"></i> 검색 중...
        </div>`;

      try {
        const res = await fetch(`${BACKEND_BASE}/api/search?query=${encodeURIComponent(query)}`, {
          method: 'GET', headers: API_HEADERS
        });
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.error || '검색 실패');

        const movies = result.data || [];
        if (movies.length === 0) {
          results.innerHTML = `<div class="search-no-results">"${escapeHtml(query)}"에 매칭되는 영화가 없습니다.</div>`;
          return;
        }

        results.innerHTML = movies.map(movie => `
          <div class="search-item" onclick="selectMovieFromSearch('${movie.movieCd}', '${escapeHtml(movie.movieNm)}')">
            <img src="${escapeHtml(movie.poster || '')}" class="search-poster-thumb" alt="${escapeHtml(movie.movieNm)}">
            <div class="search-info">
              <div class="search-title">${escapeHtml(movie.movieNm)}</div>
              <div class="search-meta">${escapeHtml(movie.genre || '장르 정보 없음')} • ${escapeHtml(movie.openDt ? movie.openDt.slice(0, 4) : '개봉연도 미정')}년 개봉 • ⭐ ${escapeHtml(movie.rating || '0.0')}</div>
            </div>
          </div>`).join('');

      } catch (err) {
        console.error(err);
        results.innerHTML = `<div class="search-no-results" style="color:var(--color-accent);"><i class="fa-solid fa-circle-exclamation"></i> 검색 지연이 발생했습니다.</div>`;
      }
    }, 300);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      results.innerHTML = '';
      input.focus();
    });
  }

  // Keyboard: / or Ctrl+K / Cmd+K to open, Esc to close
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;
    const overlay = document.getElementById('spotlightOverlay');
    const isOpen = overlay?.classList.contains('active');

    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      closeSpotlight();
      return;
    }
    if ((e.key === '/' && !inInput) || ((e.metaKey || e.ctrlKey) && e.key === 'k')) {
      e.preventDefault();
      if (isOpen) closeSpotlight(); else openSpotlight();
    }
  });
}

window.openSpotlight  = openSpotlight;
window.closeSpotlight = closeSpotlight;
window.handleSpotlightBackdrop = handleSpotlightBackdrop;

// AI Writer Review Coaching Trigger Logic (1day 3 times limit, LocalStorage cached)
async function coachUserReview() {
  if (!activeMovieInfo || !activeMovieInfo.movieNm) {
    showToast('분석 실패', '영화 정보를 불러올 수 없습니다.', 'error');
    return;
  }

  const reviewText = userReviewInput.value.trim();
  if (!reviewText) {
    showToast('초안 작성 누락', '코칭을 받기 위해 영화 감상평 초안을 먼저 작성해 주세요.', 'error');
    userReviewInput.focus();
    return;
  }

  const movieNm = activeMovieInfo.movieNm;
  const directors = activeMovieInfo.directors || '정보 없음';
  const actors = activeMovieInfo.actors || '정보 없음';
  const genres = activeMovieInfo.genres || '정보 없음';

  // 1. Check Rate Limit (1 day 3 times free limit)
  const todayStr = new Date().toISOString().split('T')[0];
  let limitData = { date: todayStr, count: 0 };
  try {
    const rawLimit = localStorage.getItem('CINEDIARY_COACH_LIMIT');
    if (rawLimit) {
      const parsed = JSON.parse(rawLimit);
      if (parsed.date === todayStr) {
        limitData = parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read coach limit:', err);
  }

  if (limitData.count >= 3) {
    showToast('비평 코칭 한도 초과 🎟️', '오늘의 시네필 무료 코칭 한도(3회)를 다 소진하셨습니다. 가상 충전 광고를 관람하시겠습니까?', 'error');
    // Simulate virtual ad watch for beautiful dynamic compliance!
    if (confirm('30초 분량의 비평 보상형 동영상 광고(가상 시뮬레이션)를 시청하고 코칭 티켓 +1개를 충전하시겠습니까?')) {
      showToast('광고 시청 중...', '가상 보상형 광고 30초가 송출 중입니다. 잠시만 시네필 광고를 감상해 주세요🍿', 'success');
      
      const coachBtn = document.getElementById('coachReviewBtn');
      if (coachBtn) coachBtn.disabled = true;
      
      await new Promise(r => setTimeout(r, 2000)); // speed up for testing
      
      limitData.count = 2; // rollback count to allow one more fetch
      localStorage.setItem('CINEDIARY_COACH_LIMIT', JSON.stringify(limitData));
      
      if (coachBtn) coachBtn.disabled = false;
      showToast('코칭 티켓 충전 성공! 🎫', '비평 트레이너 충전 완료! 코칭 받기 버튼을 다시 눌러 비평을 시작하세요.', 'success');
    }
    return;
  }

  // 2. Check Local Cache (prevent redundant same-text review queries)
  const cacheKey = `${movieNm}_${reviewText}`;
  let coachCaches = {};
  try {
    coachCaches = JSON.parse(localStorage.getItem('CINEDIARY_COACH_CACHES') || '{}');
  } catch (err) {
    console.error('Failed to parse coach caches:', err);
  }

  const loader = document.getElementById('aiCoachLoading');
  const resultPanel = document.getElementById('aiCoachResultPanel');

  if (coachCaches[cacheKey]) {
    console.log('[CineDiary] AI coach response cache hit! Instant rendering.');
    showToast('로컬 분석 캐시 히트', '이미 첨삭 받은 문장이므로 즉각적인 로컬 로드를 수행합니다.', 'success');
    
    if (loader) loader.style.display = 'block';
    if (resultPanel) resultPanel.style.display = 'none';
    
    await new Promise(r => setTimeout(r, 400)); // elegant delay for rendering visual transition
    
    if (loader) loader.style.display = 'none';
    renderCoachResult(coachCaches[cacheKey], reviewText);
    return;
  }

  // 3. Trigger network query
  if (loader) loader.style.display = 'block';
  if (resultPanel) resultPanel.style.display = 'none';
  
  const coachBtn = document.getElementById('coachReviewBtn');
  if (coachBtn) coachBtn.disabled = true;

  try {
    const response = await fetch(`${BACKEND_BASE}/api/coach-review`, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({
        movieNm,
        directors,
        actors,
        genres,
        userReview: reviewText
      })
    });

    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'AI 비평 분석에 실패했습니다.');

    // Save cache
    coachCaches[cacheKey] = result;
    localStorage.setItem('CINEDIARY_COACH_CACHES', JSON.stringify(coachCaches));

    // Update limit usage count (if not simulated fallback ad ticket)
    limitData.count += 1;
    localStorage.setItem('CINEDIARY_COACH_LIMIT', JSON.stringify(limitData));

    // Render result
    if (loader) loader.style.display = 'none';
    renderCoachResult(result, reviewText);
    showToast('AI 비평 첨삭 성공 🎓', `평론 코칭이 끝났습니다! 오늘의 코칭 가능 잔여 횟수: ${3 - limitData.count}회`, 'success');

  } catch (err) {
    console.error('Coach review failed:', err);
    showToast('코칭 실패', err.message, 'error');
    if (loader) loader.style.display = 'none';
  } finally {
    if (coachBtn) coachBtn.disabled = false;
  }
}

// Render dynamic coach result metrics and slip cards
function renderCoachResult(data, originalReviewText) {
  const resultPanel = document.getElementById('aiCoachResultPanel');
  if (!resultPanel) return;

  const scores = data.scores || { expression: 75, logic: 75, analysis: 75, vocabulary: 75, impact: 75 };
  const feedback = data.feedback || '우수한 영화적 직관이 묻어나는 리뷰입니다.';
  const corrected = data.corrected || '훌륭히 교정된 평론가 스타일 감상평입니다.';

  resultPanel.innerHTML = `
    <div class="ai-coach-results-card">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.75rem;">
        <h5 style="font-family: var(--font-outfit); font-size: 1.1rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem; color: #a78bfa; margin: 0;">
          <i class="fa-solid fa-graduation-cap"></i> AI 수석 평론가 비평 피드백
        </h5>
        <span style="font-size: 0.65rem; background: rgba(139, 92, 246, 0.15); color: #c084fc; padding: 0.2rem 0.6rem; border-radius: 50px; font-weight: 700; letter-spacing: 0.05em;">COACHING ACTIVE</span>
      </div>
      
      <div class="coach-metric-list">
        <div class="coach-metric-item">
          <div class="coach-metric-header">
            <span>🎬 표현력 (Expression)</span>
            <span>${scores.expression}점</span>
          </div>
          <div class="coach-metric-bar-bg">
            <div class="coach-metric-bar-fg gauge-gradient-electric" id="bar_expression" style="width: 0%;"></div>
          </div>
        </div>
        <div class="coach-metric-item">
          <div class="coach-metric-header">
            <span>🧠 논리성 (Logic)</span>
            <span>${scores.logic}점</span>
          </div>
          <div class="coach-metric-bar-bg">
            <div class="coach-metric-bar-fg gauge-gradient-neon" id="bar_logic" style="width: 0%;"></div>
          </div>
        </div>
        <div class="coach-metric-item">
          <div class="coach-metric-header">
            <span>👁️ 연출 분석도 (Analysis)</span>
            <span>${scores.analysis}점</span>
          </div>
          <div class="coach-metric-bar-bg">
            <div class="coach-metric-bar-fg gauge-gradient-cyber" id="bar_analysis" style="width: 0%;"></div>
          </div>
        </div>
        <div class="coach-metric-item">
          <div class="coach-metric-header">
            <span>📖 어휘 독창성 (Vocabulary)</span>
            <span>${scores.vocabulary}점</span>
          </div>
          <div class="coach-metric-bar-bg">
            <div class="coach-metric-bar-fg gauge-gradient-electric" id="bar_vocabulary" style="width: 0%;"></div>
          </div>
        </div>
        <div class="coach-metric-item">
          <div class="coach-metric-header">
            <span>🔥 종합 전달력 (Impact)</span>
            <span>${scores.impact}점</span>
          </div>
          <div class="coach-metric-bar-bg">
            <div class="coach-metric-bar-fg gauge-gradient-neon" id="bar_impact" style="width: 0%;"></div>
          </div>
        </div>
      </div>

      <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.03); border-radius: 16px; padding: 1.15rem; margin-top: 0.15rem;">
        <div style="font-family: var(--font-outfit); font-size: 0.72rem; font-weight: 800; color: var(--color-primary); text-transform: uppercase; margin-bottom: 0.4rem; letter-spacing: 0.05em;">Critique Commentary</div>
        <p style="font-size: 0.8rem; line-height: 1.6; color: var(--color-text-main); margin: 0; white-space: pre-line;">${escapeHtml(feedback)}</p>
      </div>

      <div class="coach-contrast-wrap">
        <div class="contrast-card contrast-card-before">
          <span class="contrast-label" style="color: var(--color-text-muted);"><i class="fa-solid fa-pen"></i> Review Draft (초안)</span>
          <p class="contrast-text" style="color: var(--color-text-muted); margin: 0;">${escapeHtml(originalReviewText)}</p>
        </div>
        <div class="contrast-card contrast-card-after">
          <span class="contrast-label" style="color: #f59e0b;"><i class="fa-solid fa-wand-magic-sparkles"></i> Cinephile Critique (첨삭본)</span>
          <p class="contrast-text" style="color: #ffffff; font-weight: 500; font-size: 0.82rem; text-shadow: 0 1px 5px rgba(0,0,0,0.3); margin: 0;">${escapeHtml(corrected)}</p>
        </div>
      </div>
    </div>
  `;

  resultPanel.style.display = 'block';

  // Trigger smooth gradient bar charging animations
  setTimeout(() => {
    const metrics = ['expression', 'logic', 'analysis', 'vocabulary', 'impact'];
    metrics.forEach(m => {
      const bar = document.getElementById(`bar_${m}`);
      if (bar) bar.style.width = `${scores[m]}%`;
    });
  }, 100);
}

// Centralized Ticket Booking Link Generator (Supports Affiliate Wrappers easily!)
function getBookingUrl(movieNm) {
  if (!movieNm) return '#';
  
  const cleanMovieNm = movieNm.trim();
  
  // NOTE: CGV, Lotte Cinema, and Megabox websites use dynamic Client-Side Rendering (SPA)
  // or cookie-dependent redirection mechanisms that prevent direct GET parameter searches from loading
  // (e.g., Lotte Cinema drops search state and displays an empty page when linking directly).
  //
  // To resolve this and maximize booking conversion, we route users to Naver's unified Search Ticketing Widget.
  // This automatically displays a combined view of real-time theater timetables near the user's location on both Mobile and PC,
  // letting them choose CGV, Lotte, or Megabox under a single unified interface.
  //
  // If you integrate an affiliate link later (like LinkPrice or Partner APIs), wrap the URL here:
  // Example: return `https://tracking.linkprice.com/gogogo.php?u=YOUR_AFFILIATE_ID&url=${encodeURIComponent(directUrl)}`;
  
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(cleanMovieNm + ' 예매')}`;
}

// Helper: Calculate yesterday's date string (YYYY-MM-DD) dynamically
function getYesterdayDateString() {
  const date = new Date();
  // Subtract 1 day
  date.setDate(date.getDate() - 1);
  
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  
  return `${yyyy}-${mm}-${dd}`;
}

// Helper: Format YYYY-MM-DD to YYYY년 MM월 DD일
function formatKoreanDate(dateStr) {
  if (!dateStr) return '';
  const [yyyy, mm, dd] = dateStr.split('-');
  return `${yyyy}년 ${mm}월 ${dd}일`;
}

// Helper: Format YYYYMMDD to YYYY-MM-DD for KOBIS open dates
function formatOpenDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return dateStr || '정보 없음';
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

// 2. Fetch and Render Daily Box Office Top 10
async function loadBoxOfficeData(dateStr, nation = currentNation) {
  if (!dateStr) return;
  
  const formattedTitleDate = formatKoreanDate(dateStr);
  currentDateTitle.textContent = formattedTitleDate;
  
  // Show Skeletons during fetch
  renderSkeletons();
  
  const targetDt = dateStr.replace(/-/g, ''); // Convert YYYY-MM-DD to YYYYMMDD
  
  let url = `${BACKEND_BASE}/api/boxoffice?targetDt=${targetDt}`;
  if (nation === 'K' || nation === 'F') {
    url += `&repNationCd=${nation}`;
  }
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: API_HEADERS
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to fetch box office list');
    }
    
    renderBoxOfficeList(result.data);
  } catch (error) {
    console.error('Error loading box office:', error);
    showToast('데이터 조회 실패', error.message, 'error');
    movieGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--color-text-muted);">
        <i class="fa-solid fa-circle-exclamation" style="font-size: 2.5rem; color: var(--color-accent); margin-bottom: 1rem;"></i>
        <p>${error.message}</p>
        <button onclick="location.reload()" style="margin-top: 1.5rem; background: var(--gradient-primary); border: none; color: white; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; cursor: pointer;">
          다시 시도하기
        </button>
      </div>
    `;
  }
}

// 2.2. Fetch and Render Weekly Box Office Top 10
async function loadWeeklyBoxOfficeData(dateStr, nation = currentNation) {
  if (!dateStr) return;
  
  const weekLabel = getWeekOfMonth(dateStr);
  const [yyyy] = dateStr.split('-');
  currentDateTitle.textContent = `${yyyy}년 ${weekLabel}`;
  
  // Show Skeletons during fetch
  renderSkeletons();
  
  const targetDt = dateStr.replace(/-/g, ''); // Convert YYYY-MM-DD to YYYYMMDD
  
  let url = `${BACKEND_BASE}/api/weeklyboxoffice?targetDt=${targetDt}&weekGb=0`;
  if (nation === 'K' || nation === 'F') {
    url += `&repNationCd=${nation}`;
  }
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: API_HEADERS
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to fetch weekly box office list');
    }
    
    renderWeeklyBoxOfficeList(result.data);
  } catch (error) {
    console.error('Error loading weekly box office:', error);
    showToast('데이터 조회 실패', error.message, 'error');
    movieGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--color-text-muted);">
        <i class="fa-solid fa-circle-exclamation" style="font-size: 2.5rem; color: var(--color-accent); margin-bottom: 1rem;"></i>
        <p>${error.message}</p>
        <button onclick="loadWeeklyBoxOfficeData(dateInput.value)" style="margin-top: 1.5rem; background: var(--gradient-primary); border: none; color: white; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; cursor: pointer;">
          다시 시도하기
        </button>
      </div>
    `;
  }
}

// Render Shimmer Skeletons
function renderSkeletons() {
  let skeletonsHtml = '';
  for (let i = 0; i < 8; i++) {
    skeletonsHtml += `
      <div class="skeleton-card">
        <div class="skeleton skeleton-badge"></div>
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-small"></div>
      </div>
    `;
  }
  movieGrid.innerHTML = skeletonsHtml;
}

// Render actual Box Office Card List
function renderBoxOfficeList(moviesList) {
  if (!moviesList || moviesList.length === 0) {
    movieGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--color-text-muted);">
        <i class="fa-regular fa-folder-open" style="font-size: 3rem; margin-bottom: 1rem;"></i>
        <p>선택하신 날짜에 조회된 박스오피스 데이터가 존재하지 않습니다.</p>
      </div>
    `;
    return;
  }
  
  movieGrid.innerHTML = '';
  
  moviesList.forEach((movie, index) => {
    const rank = parseInt(movie.rank, 10);
    const isTopThree = rank <= 3;
    const badgeClass = isTopThree ? `rank-${rank}` : 'rank-other';
    
    // Determine rank movement styling
    let rankChangeHtml = '';
    const rankInten = parseInt(movie.rankInten, 10);
    
    if (movie.rankOldAndNew === 'NEW') {
      rankChangeHtml = `<span class="rank-change rank-new">NEW</span>`;
    } else if (rankInten > 0) {
      rankChangeHtml = `<span class="rank-change rank-up"><i class="fa-solid fa-caret-up"></i> ${rankInten}</span>`;
    } else if (rankInten < 0) {
      rankChangeHtml = `<span class="rank-change rank-down"><i class="fa-solid fa-caret-down"></i> ${Math.abs(rankInten)}</span>`;
    } else {
      rankChangeHtml = `<span class="rank-change rank-same"><i class="fa-solid fa-minus"></i></span>`;
    }
    
    const movieCard = document.createElement('div');
    movieCard.className = 'movie-card';
    // Smooth staggering fade-in animation
    movieCard.style.animationDelay = `${index * 0.05}s`;
    
    // Check if poster exists, otherwise render beautiful custom dynamic gradient card matching the genre!
    let posterHtml = '';
    if (movie.poster) {
      posterHtml = `<img src="${escapeHtml(movie.poster)}" class="movie-poster-bg" alt="" aria-hidden="true" loading="lazy"><img src="${escapeHtml(movie.poster)}" class="movie-poster" alt="${escapeHtml(movie.movieNm)}" loading="lazy">`;
    } else {
      const spec = getGenrePlaceholder(movie.genre, movie.movieNm);
      posterHtml = `
        <div class="poster-placeholder" style="background: ${spec.gradientStr}; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 1.5rem; text-align: center; gap: 0.85rem; position: relative; height: 100%;">
          <!-- Top-Right Genre Tag Badge to prevent rank badge overlapping -->
          <div class="genre-tag-badge" style="position: absolute; top: 16px; right: 16px; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); padding: 0.25rem 0.65rem; border-radius: 50px; font-size: 0.7rem; font-weight: 700; color: #fff; border: 1px solid rgba(255,255,255,0.1); z-index: 2;">${escapeHtml(spec.genreName)}</div>
          
          <!-- Artistic Icon -->
          <i class="${spec.iconClass} placeholder-icon" style="font-size: 3.25rem; text-shadow: 0 0 25px rgba(255,255,255,0.25); filter: drop-shadow(0 4px 10px rgba(0,0,0,0.35)); color: rgba(255,255,255,0.9);"></i>
          
          <!-- Elegant Divider Line -->
          <div style="width: 32px; height: 1.5px; background: rgba(255, 255, 255, 0.25); border-radius: 2px; margin: 0.25rem 0;"></div>
          
          <!-- Premium Typography Movie Title -->
          <div class="placeholder-title" style="font-family: var(--font-outfit); font-size: 1.15rem; font-weight: 800; line-height: 1.4; color: #ffffff; text-shadow: 0 2px 10px rgba(0,0,0,0.65); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; max-height: 4.2em;">${escapeHtml(movie.movieNm)}</div>
          
          <!-- Fine Aesthetic Label -->
          <div style="font-family: var(--font-outfit); font-size: 0.55rem; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255, 255, 255, 0.35); margin-top: 0.15rem;">Cinephile's Diary</div>
        </div>
      `;
    }

    // Rating star badge
    const ratingHtml = movie.rating 
      ? `<div class="rating-badge"><i class="fa-solid fa-star"></i> ${movie.rating}</div>`
      : '';
    
    const bookingUrl = getBookingUrl(movie.movieNm);

    movieCard.innerHTML = `
      <div class="rank-badge ${badgeClass}">${movie.rank}</div>
      <div class="poster-container">
        ${posterHtml}
        ${ratingHtml}
      </div>
      <div class="movie-header-info">
        <h3 class="movie-title">${movie.movieNm}</h3>
        <div class="movie-meta-list">
          <div class="movie-meta-item">
            <i class="fa-regular fa-calendar"></i>
            <span>개봉일: ${formatOpenDate(movie.openDt)}</span>
          </div>
          <div class="movie-meta-item">
            <i class="fa-solid fa-users"></i>
            <span>당일: ${movie.audiCnt} 명</span>
          </div>
          <div class="movie-meta-item">
            <i class="fa-solid fa-chart-simple"></i>
            <span>누적: ${movie.audiAcc} 명</span>
          </div>
        </div>
        ${rankChangeHtml}
        <div class="unified-booking-container">
          <a href="${bookingUrl}" target="_blank" class="unified-booking-btn unified-booking-btn--ghost" onclick="event.stopPropagation();" title="실시간 영화 예매 및 시간표 보기">
            <i class="fa-solid fa-ticket"></i> 실시간 빠른 예매
          </a>
        </div>
      </div>
    `;
    
    movieCard.addEventListener('click', () => openMovieDetails(movie.movieCd, movie.movieNm));
    movieGrid.appendChild(movieCard);
  });
}

// Render actual Weekly Box Office Card List
function renderWeeklyBoxOfficeList(moviesList) {
  if (!moviesList || moviesList.length === 0) {
    movieGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--color-text-muted);">
        <i class="fa-regular fa-folder-open" style="font-size: 3rem; margin-bottom: 1rem;"></i>
        <p>선택하신 주간에 조회된 주별 박스오피스 데이터가 존재하지 않습니다.</p>
      </div>
    `;
    return;
  }
  
  movieGrid.innerHTML = '';
  
  moviesList.forEach((movie, index) => {
    const rank = parseInt(movie.rank, 10);
    const isTopThree = rank <= 3;
    const badgeClass = isTopThree ? `rank-${rank}` : 'rank-other';
    
    // Determine rank movement styling
    let rankChangeHtml = '';
    const rankInten = parseInt(movie.rankInten, 10);
    
    if (movie.rankOldAndNew === 'NEW') {
      rankChangeHtml = `<span class="rank-change rank-new">NEW</span>`;
    } else if (rankInten > 0) {
      rankChangeHtml = `<span class="rank-change rank-up"><i class="fa-solid fa-caret-up"></i> ${rankInten}</span>`;
    } else if (rankInten < 0) {
      rankChangeHtml = `<span class="rank-change rank-down"><i class="fa-solid fa-caret-down"></i> ${Math.abs(rankInten)}</span>`;
    } else {
      rankChangeHtml = `<span class="rank-change rank-same"><i class="fa-solid fa-minus"></i></span>`;
    }
    
    const movieCard = document.createElement('div');
    movieCard.className = 'movie-card';
    movieCard.style.animationDelay = `${index * 0.05}s`;
    
    // Check if poster exists
    let posterHtml = '';
    if (movie.poster) {
      posterHtml = `<img src="${escapeHtml(movie.poster)}" class="movie-poster-bg" alt="" aria-hidden="true" loading="lazy"><img src="${escapeHtml(movie.poster)}" class="movie-poster" alt="${escapeHtml(movie.movieNm)}" loading="lazy">`;
    } else {
      const spec = getGenrePlaceholder(movie.genre, movie.movieNm);
      posterHtml = `
        <div class="poster-placeholder" style="background: ${spec.gradientStr}; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 1.5rem; text-align: center; gap: 0.85rem; position: relative; height: 100%;">
          <div class="genre-tag-badge" style="position: absolute; top: 16px; right: 16px; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); padding: 0.25rem 0.65rem; border-radius: 50px; font-size: 0.7rem; font-weight: 700; color: #fff; border: 1px solid rgba(255,255,255,0.1); z-index: 2;">${escapeHtml(spec.genreName)}</div>
          <i class="${spec.iconClass} placeholder-icon" style="font-size: 3.25rem; text-shadow: 0 0 25px rgba(255,255,255,0.25); filter: drop-shadow(0 4px 10px rgba(0,0,0,0.35)); color: rgba(255,255,255,0.9);"></i>
          <div style="width: 32px; height: 1.5px; background: rgba(255, 255, 255, 0.25); border-radius: 2px; margin: 0.25rem 0;"></div>
          <div class="placeholder-title" style="font-family: var(--font-outfit); font-size: 1.15rem; font-weight: 800; line-height: 1.4; color: #ffffff; text-shadow: 0 2px 10px rgba(0,0,0,0.65); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; max-height: 4.2em;">${escapeHtml(movie.movieNm)}</div>
          <div style="font-family: var(--font-outfit); font-size: 0.55rem; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255, 255, 255, 0.35); margin-top: 0.15rem;">Cinephile's Diary</div>
        </div>
      `;
    }

    // Rating star badge
    const ratingHtml = movie.rating 
      ? `<div class="rating-badge"><i class="fa-solid fa-star"></i> ${movie.rating}</div>`
      : '';
    
    const bookingUrl = getBookingUrl(movie.movieNm);

    movieCard.innerHTML = `
      <div class="rank-badge ${badgeClass}">${movie.rank}</div>
      <div class="poster-container">
        ${posterHtml}
        ${ratingHtml}
      </div>
      <div class="movie-header-info">
        <h3 class="movie-title">${movie.movieNm}</h3>
        <div class="movie-meta-list">
          <div class="movie-meta-item">
            <i class="fa-regular fa-calendar"></i>
            <span>개봉일: ${formatOpenDate(movie.openDt)}</span>
          </div>
          <div class="movie-meta-item">
            <i class="fa-solid fa-coins" style="color: #f59e0b;"></i>
            <span>매출액: ${movie.formattedSales || movie.salesAmt}</span>
          </div>
          <div class="movie-meta-item">
            <i class="fa-solid fa-users" style="color: var(--color-secondary);"></i>
            <span>관객수: ${movie.formattedAudi || movie.audiCnt}</span>
          </div>
        </div>
        ${rankChangeHtml}
        <div class="unified-booking-container">
          <a href="${bookingUrl}" target="_blank" class="unified-booking-btn unified-booking-btn--ghost" onclick="event.stopPropagation();" title="실시간 영화 예매 및 시간표 보기">
            <i class="fa-solid fa-ticket"></i> 실시간 빠른 예매
          </a>
        </div>
      </div>
    `;
    
    movieCard.addEventListener('click', () => openMovieDetails(movie.movieCd, movie.movieNm));
    movieGrid.appendChild(movieCard);
  });
}

// 2.5. Fetch and Render Upcoming Movies (개봉예정작)
async function loadUpcomingMovies() {
  renderSkeletons();
  
  try {
    const response = await fetch(`${BACKEND_BASE}/api/upcoming`, {
      method: 'GET',
      headers: API_HEADERS
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to fetch upcoming movies');
    }
    
    renderUpcomingList(result.data);
  } catch (error) {
    console.error('Error loading upcoming movies:', error);
    showToast('데이터 조회 실패', error.message, 'error');
    movieGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--color-text-muted);">
        <i class="fa-solid fa-circle-exclamation" style="font-size: 2.5rem; color: var(--color-accent); margin-bottom: 1rem;"></i>
        <p>${error.message}</p>
        <button onclick="loadUpcomingMovies()" style="margin-top: 1.5rem; background: var(--gradient-primary); border: none; color: white; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; cursor: pointer;">
          다시 시도하기
        </button>
      </div>
    `;
  }
}

// Render actual Upcoming Releases Card List
function renderUpcomingList(moviesList) {
  if (!moviesList || moviesList.length === 0) {
    movieGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--color-text-muted);">
        <i class="fa-regular fa-folder-open" style="font-size: 3rem; margin-bottom: 1rem;"></i>
        <p>조회된 개봉 예정작 데이터가 존재하지 않습니다.</p>
      </div>
    `;
    return;
  }
  
  movieGrid.innerHTML = '';
  
  moviesList.forEach((movie, index) => {
    // Calculate D-Day
    const releaseDate = new Date(movie.openDt);
    const today = new Date();
    releaseDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const diffTime = releaseDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let dDayText = '';
    let dDayClass = '';
    if (diffDays === 0) {
      dDayText = 'D-Day';
      dDayClass = 'rank-1';
    } else if (diffDays > 0) {
      dDayText = `D-${diffDays}`;
      dDayClass = diffDays <= 7 ? 'rank-2' : (diffDays <= 21 ? 'rank-3' : 'rank-other');
    } else {
      dDayText = '개봉완료';
      dDayClass = 'rank-other';
    }
    
    // Check if poster exists
    let posterHtml = '';
    if (movie.poster) {
      posterHtml = `<img src="${escapeHtml(movie.poster)}" class="movie-poster-bg" alt="" aria-hidden="true" loading="lazy"><img src="${escapeHtml(movie.poster)}" class="movie-poster" alt="${escapeHtml(movie.movieNm)}" loading="lazy">`;
    } else {
      const spec = getGenrePlaceholder(movie.genre, movie.movieNm);
      posterHtml = `
        <div class="poster-placeholder" style="background: ${spec.gradientStr}; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 1.5rem; text-align: center; gap: 0.85rem; position: relative; height: 100%;">
          <div class="genre-tag-badge" style="position: absolute; top: 16px; right: 16px; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); padding: 0.25rem 0.65rem; border-radius: 50px; font-size: 0.7rem; font-weight: 700; color: #fff; border: 1px solid rgba(255,255,255,0.1); z-index: 2;">${escapeHtml(spec.genreName)}</div>
          <i class="${spec.iconClass} placeholder-icon" style="font-size: 3.25rem; text-shadow: 0 0 25px rgba(255,255,255,0.25); filter: drop-shadow(0 4px 10px rgba(0,0,0,0.35)); color: rgba(255,255,255,0.9);"></i>
          <div style="width: 32px; height: 1.5px; background: rgba(255, 255, 255, 0.25); border-radius: 2px; margin: 0.25rem 0;"></div>
          <div class="placeholder-title" style="font-family: var(--font-outfit); font-size: 1.15rem; font-weight: 800; line-height: 1.4; color: #ffffff; text-shadow: 0 2px 10px rgba(0,0,0,0.65); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; max-height: 4.2em;">${escapeHtml(movie.movieNm)}</div>
          <div style="font-family: var(--font-outfit); font-size: 0.55rem; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255, 255, 255, 0.35); margin-top: 0.15rem;">Cinephile's Diary</div>
        </div>
      `;
    }

    // Rating badge (if available)
    const ratingHtml = movie.rating && parseFloat(movie.rating) > 0
      ? `<div class="rating-badge"><i class="fa-solid fa-star"></i> ${movie.rating}</div>`
      : '';

    const movieCard = document.createElement('div');
    movieCard.className = 'movie-card';
    movieCard.style.animationDelay = `${index * 0.05}s`;
    
    movieCard.innerHTML = `
      <div class="rank-badge ${dDayClass}" style="font-size: 0.72rem; padding: 0.25rem 0.65rem; min-width: 50px; font-weight: 800; border-radius: 12px; display: flex; align-items: center; justify-content: center; text-transform: uppercase; font-family: var(--font-outfit);">${dDayText}</div>
      <div class="poster-container">
        ${posterHtml}
        ${ratingHtml}
      </div>
      <div class="movie-header-info" style="justify-content: flex-start; height: auto;">
        <h3 class="movie-title" style="margin-bottom: 0.5rem;">${movie.movieNm}</h3>
        <div class="movie-meta-list" style="margin-bottom: 0.5rem;">
          <div class="movie-meta-item">
            <i class="fa-regular fa-calendar"></i>
            <span>개봉일: ${formatOpenDate(movie.openDt)}</span>
          </div>
          <div class="movie-meta-item">
            <i class="fa-solid fa-hourglass-half" style="color: var(--color-secondary);"></i>
            <span>개봉 대기: ${diffDays > 0 ? diffDays + '일 남음' : '오늘 개봉!'}</span>
          </div>
          <div class="movie-meta-item" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 0.75rem; color: var(--color-text-muted); line-height: 1.45; margin-top: 0.6rem; height: 2.9em;">
            <span style="font-style: italic; color: rgba(255,255,255,0.15); font-family: Georgia, serif; font-size: 1.1rem; line-height: 0; vertical-align: bottom; margin-right: 2px;">“</span>
            <span>${movie.overview || '이 영화에 대한 설레는 줄거리 정보가 아직 등록되지 않았습니다.'}</span>
          </div>
        </div>
        <div class="unified-booking-container" style="margin-top: auto; padding-top: 0.5rem; width: 100%;">
          <button class="unified-booking-btn" style="background: var(--gradient-primary); border-color: var(--color-primary); width: 100%; cursor: pointer;" title="상영 예정작 상세 정보 보기">
            <i class="fa-solid fa-circle-info"></i> 기대작 상세 정보
          </button>
        </div>
      </div>
    `;
    
    movieCard.addEventListener('click', () => openMovieDetails(movie.movieCd, movie.movieNm));
    movieGrid.appendChild(movieCard);
  });
}

// 3. Movie Details Modal Management
async function openMovieDetails(movieCd, movieNm) {
  // Reset AI Coach trainer panels
  const aiCoachLoading = document.getElementById('aiCoachLoading');
  const aiCoachResultPanel = document.getElementById('aiCoachResultPanel');
  if (aiCoachLoading) aiCoachLoading.style.display = 'none';
  if (aiCoachResultPanel) {
    aiCoachResultPanel.style.display = 'none';
    aiCoachResultPanel.innerHTML = '';
  }

  // Pre-populate known info
  modalMovieTitle.textContent = movieNm;
  if (movieNm.length > 25) {
    modalMovieTitle.style.fontSize = '1.15rem';
    modalMovieTitle.style.lineHeight = '1.4';
  } else if (movieNm.length > 15) {
    modalMovieTitle.style.fontSize = '1.4rem';
    modalMovieTitle.style.lineHeight = '1.3';
  } else {
    modalMovieTitle.style.fontSize = ''; // Use CSS default
    modalMovieTitle.style.lineHeight = '';
  }
  
  modalMovieSubTitle.textContent = 'Loading Details...';
  modalMovieSubTitle.style.fontSize = ''; // Reset to default
  
  activeMovieInfo = {
    movieCd: movieCd,
    movieNm: movieNm
  };

  // Reset and load saved Cinema Log immediately (latency-free)
  loadCinemaLog(movieCd);
  
  // Pre-populate ticket booking link immediately
  const modalUnifiedBookingBtn = document.getElementById('modalUnifiedBookingBtn');
  if (modalUnifiedBookingBtn) modalUnifiedBookingBtn.href = getBookingUrl(movieNm);
  
  // Reset modal visuals
  const backdrop = document.getElementById('modalBackdrop');
  backdrop.style.backgroundImage = '';
  
  const poster = document.getElementById('modalPoster');
  const posterPlaceholder = document.getElementById('modalPosterPlaceholder');
  poster.style.display = 'none';
  poster.src = '';
  
  const spec = getGenrePlaceholder(null, movieNm);
  posterPlaceholder.style.display = 'flex';
  posterPlaceholder.style.flexDirection = 'column';
  posterPlaceholder.style.alignItems = 'center';
  posterPlaceholder.style.justifyContent = 'center';
  posterPlaceholder.style.padding = '1.5rem 1rem';
  posterPlaceholder.style.textAlign = 'center';
  posterPlaceholder.style.gap = '0.75rem';
  posterPlaceholder.style.background = spec.gradientStr;
  posterPlaceholder.innerHTML = `
    <i class="${spec.iconClass}" style="font-size: 2.25rem; color: rgba(255,255,255,0.9); filter: drop-shadow(0 2px 5px rgba(0,0,0,0.3));"></i>
    <div style="width: 25px; height: 1.5px; background: rgba(255, 255, 255, 0.25); margin: 0.15rem 0;"></div>
    <div style="font-family: var(--font-outfit); font-size: 0.9rem; font-weight: 800; color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,0.5); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(movieNm)}</div>
    <div style="font-family: var(--font-outfit); font-size: 0.5rem; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255, 255, 255, 0.35);">Cinephile's Diary</div>
  `;
  
  const overviewContainer = document.getElementById('modalOverview');
  const overviewText = document.getElementById('modalOverviewText');
  overviewContainer.style.display = 'none';
  overviewText.textContent = '';

  const trailerContainer = document.getElementById('modalTrailerContainer');
  const trailerFrame = document.getElementById('modalTrailerFrame');
  const trailerFrameWrap = document.getElementById('modalTrailerFrameWrap');
  const trailerFallback = document.getElementById('modalTrailerFallback');
  
  if (trailerContainer) trailerContainer.style.display = 'none';
  if (trailerFrame) trailerFrame.src = '';
  if (trailerFrameWrap) trailerFrameWrap.style.display = 'none';
  if (trailerFallback) trailerFallback.style.display = 'none';
  
  // Set skeleton states for modal specs
  specGenre.textContent = '정보 조회 중...';
  specGenre.className = 'spec-value skeleton-text skeleton';
  specShowtime.textContent = '정보 조회 중...';
  specShowtime.className = 'spec-value skeleton-text skeleton';
  specDirectors.textContent = '정보 조회 중...';
  specDirectors.className = 'spec-value skeleton-text skeleton';
  specActors.textContent = '정보 조회 중...';
  specActors.className = 'spec-value skeleton-text skeleton';
  
  // Enable inputs immediately
  userReviewInput.disabled = false;
  userReviewInput.placeholder = `영화 《${movieNm}》에 대한 나만의 감상평을 자유롭게 적어보세요.`;
  
  // Open the Modal layer with active transitions
  movieModal.classList.add('active');
  document.body.style.overflow = 'hidden'; // Lock background scrolling
  
  try {
    const response = await fetch(`${BACKEND_BASE}/api/movie?movieCd=${movieCd}`, {
      method: 'GET',
      headers: API_HEADERS
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to fetch movie details');
    }
    
    const data = result.data;
    activeMovieInfo = data; // Save to global active state for review trigger
    
    // Bind detailed data to UI with dynamic English subtitle scaling
    const subTitleText = data.movieNmEn || 'Movie Details';
    modalMovieSubTitle.textContent = subTitleText;
    if (subTitleText.length > 35) {
      modalMovieSubTitle.style.fontSize = '0.75rem';
    } else if (subTitleText.length > 20) {
      modalMovieSubTitle.style.fontSize = '0.85rem';
    } else {
      modalMovieSubTitle.style.fontSize = '';
    }
    
    specGenre.textContent = data.genres;
    specGenre.className = 'spec-value';
    
    specShowtime.textContent = data.showTm ? `${data.showTm}분` : '정보 없음';
    specShowtime.className = 'spec-value';
    
    specDirectors.textContent = data.directors;
    specDirectors.className = 'spec-value';
    
    specActors.textContent = data.actors;
    specActors.className = 'spec-value';
    
    // Bind TMDB visual assets
    if (data.backdrop) {
      backdrop.style.backgroundImage = `url('${data.backdrop}')`;
    }
    
    if (data.poster) {
      poster.src = data.poster;
      poster.alt = `${movieNm} 포스터`;
      poster.style.display = 'block';
      posterPlaceholder.style.display = 'none';
    } else {
      // Refine the placeholder styling with the actual fetched genres!
      const specRefined = getGenrePlaceholder(data.genres, data.movieNm);
      posterPlaceholder.style.background = specRefined.gradientStr;
      posterPlaceholder.innerHTML = `
        <i class="${specRefined.iconClass}" style="font-size: 2.25rem; color: rgba(255,255,255,0.9); filter: drop-shadow(0 2px 5px rgba(0,0,0,0.3));"></i>
        <div style="width: 25px; height: 1.5px; background: rgba(255, 255, 255, 0.25); margin: 0.15rem 0;"></div>
        <div style="font-family: var(--font-outfit); font-size: 0.9rem; font-weight: 800; color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,0.5); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(data.movieNm)}</div>
        <div style="font-family: var(--font-outfit); font-size: 0.5rem; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255, 255, 255, 0.35);">Cinephile's Diary</div>
      `;
      poster.style.display = 'none';
      posterPlaceholder.style.display = 'flex';
    }

    if (data.overview) {
      overviewText.textContent = data.overview;
      overviewContainer.style.display = 'block';
    }

    // Embed Youtube Trailer dynamically (Prefers TMDB precise trailer key, falls back to dynamic search results page)
    const trailerFrameWrap = document.getElementById('modalTrailerFrameWrap');
    const trailerFallback = document.getElementById('modalTrailerFallback');
    const trailerYoutubeBtn = document.getElementById('modalTrailerYoutubeBtn');
    
    if (data.trailerKey) {
      if (trailerFrameWrap) trailerFrameWrap.style.display = 'block';
      if (trailerFallback) trailerFallback.style.display = 'none';
      trailerFrame.src = `https://www.youtube.com/embed/${data.trailerKey}?autoplay=0&rel=0`;
      trailerContainer.style.display = 'block';
    } else {
      // Show gorgeous YouTube CTA card fallback
      if (trailerFrameWrap) trailerFrameWrap.style.display = 'none';
      if (trailerFallback) {
        trailerFallback.style.display = 'flex';
        // Set dynamic search URL for search results
        if (trailerYoutubeBtn) {
          trailerYoutubeBtn.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(data.movieNm + ' 공식 예고편')}`;
        }
      }
      trailerFrame.src = ''; // Clear iframe src to prevent background resource loading
      trailerContainer.style.display = 'block';
    }
    
    // Enable inputs once detailed loading completes
    userReviewInput.disabled = false;
    userReviewInput.placeholder = `영화 《${movieNm}》에 대한 나만의 감상평을 자유롭게 적어보세요.`;
    
  } catch (error) {
    console.error('Error loading details:', error);
    showToast('상세 정보 조회 실패', error.message, 'error');
    
    // Graceful error text replacement in modal
    specGenre.textContent = '조회 실패';
    specGenre.className = 'spec-value';
    specShowtime.textContent = '조회 실패';
    specShowtime.className = 'spec-value';
    specDirectors.textContent = '조회 실패';
    specDirectors.className = 'spec-value';
    specActors.textContent = '조회 실패';
    specActors.className = 'spec-value';
    
    modalMovieSubTitle.textContent = '상세 정보 조회 실패';
  }
}

function closeModal() {
  movieModal.classList.remove('active');
  document.body.style.overflow = ''; // Unlock scrolling
  activeMovieInfo = null;
  
  // Stop Youtube video when closing modal!
  const trailerFrame = document.getElementById('modalTrailerFrame');
  if (trailerFrame) {
    trailerFrame.src = '';
  }
}

// 4. Cinema Log Logic: Star rating and Review handling
function handleReviewInput(e) {
  const text = e.target.value;
  const length = text.length;
  charCounter.textContent = `${length} / 500`;
}

// Star Rating Setup & Interactive Hover / Selection Logic
function setupInteractiveStars() {
  if (!ratingStars) return;
  
  const stars = ratingStars.querySelectorAll('i');
  
  stars.forEach((star) => {
    // 1. Mouse Over (Hover) Effect
    star.addEventListener('mouseover', () => {
      const currentHoverValue = parseInt(star.getAttribute('data-rating'), 10);
      highlightStars(currentHoverValue);
    });
    
    // 2. Mouse Out (Restore selected value)
    star.addEventListener('mouseout', () => {
      highlightStars(activeRating);
    });
    
    // 3. Click (Select active score)
    star.addEventListener('click', () => {
      activeRating = parseInt(star.getAttribute('data-rating'), 10);
      ratingScoreText.textContent = `${activeRating.toFixed(1)} / 5.0`;
      highlightStars(activeRating);
    });
  });
}

function highlightStars(score) {
  if (!ratingStars) return;
  const stars = ratingStars.querySelectorAll('i');
  stars.forEach((star) => {
    const starVal = parseInt(star.getAttribute('data-rating'), 10);
    if (starVal <= score) {
      star.className = 'fa-solid fa-star active';
    } else {
      star.className = 'fa-regular fa-star';
    }
  });
}

// Load Cinema Log from LocalStorage for the opened movie
function loadCinemaLog(movieCd) {
  if (!movieCd) return;
  
  const cacheKey = `CINEDIARY_LOG_${movieCd}`;
  const savedData = localStorage.getItem(cacheKey);
  
  // Reset values default
  activeRating = 0;
  highlightStars(0);
  ratingScoreText.textContent = '0.0 / 5.0';
  userReviewInput.value = '';
  charCounter.textContent = '0 / 500';
  
  if (deleteReviewBtn) deleteReviewBtn.style.display = 'none';
  
  if (savedData) {
    try {
      const log = JSON.parse(savedData);
      activeRating = log.rating || 0;
      highlightStars(activeRating);
      ratingScoreText.textContent = `${activeRating.toFixed(1)} / 5.0`;
      userReviewInput.value = log.comment || '';
      charCounter.textContent = `${userReviewInput.value.length} / 150`;
      
      if (deleteReviewBtn) deleteReviewBtn.style.display = 'inline-flex';
    } catch (e) {
      console.error('Failed to parse saved movie log:', e);
    }
  }
}

// Save Cinema Log to LocalStorage
function saveCinemaLog() {
  if (!activeMovieInfo || !activeMovieInfo.movieCd) {
    showToast('저장 실패', '영화 정보가 로드되지 않았습니다.', 'error');
    return;
  }
  
  if (activeRating === 0) {
    showToast('평점 누락', '최소 1개 이상의 별점을 선택해 주세요.', 'error');
    return;
  }
  
  const comment = userReviewInput.value.trim();
  const cacheKey = `CINEDIARY_LOG_${activeMovieInfo.movieCd}`;
  
  const logData = {
    movieCd: activeMovieInfo.movieCd,
    movieNm: activeMovieInfo.movieNm,
    rating: activeRating,
    comment: comment,
    savedAt: new Date().toISOString()
  };
  
  try {
    localStorage.setItem(cacheKey, JSON.stringify(logData));
    showToast('저장 완료', `영화 《${activeMovieInfo.movieNm}》 관람 기록이 저장되었습니다.`, 'success');
    
    if (deleteReviewBtn) deleteReviewBtn.style.display = 'inline-flex';
  } catch (e) {
    console.error('Save failed:', e);
    showToast('저장 실패', '로컬 저장 공간이 부족하거나 쓸 수 없습니다.', 'error');
  }
}

// Delete Cinema Log from LocalStorage
function deleteCinemaLog() {
  if (!activeMovieInfo || !activeMovieInfo.movieCd) return;
  
  const cacheKey = `CINEDIARY_LOG_${activeMovieInfo.movieCd}`;
  const movieNm = activeMovieInfo.movieNm;
  
  try {
    localStorage.removeItem(cacheKey);
    showToast('삭제 완료', `영화 《${movieNm}》 관람 기록이 삭제되었습니다.`, 'success');
    
    // Reset UI
    activeRating = 0;
    highlightStars(0);
    ratingScoreText.textContent = '0.0 / 5.0';
    userReviewInput.value = '';
    charCounter.textContent = '0 / 500';
    
    if (deleteReviewBtn) deleteReviewBtn.style.display = 'none';
  } catch (e) {
    console.error('Delete failed:', e);
    showToast('삭제 실패', '기록을 삭제할 수 없습니다.', 'error');
  }
}

function showToast(title, desc, type = 'info') {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconClass = 'fa-solid fa-circle-info';
  if (type === 'success') iconClass = 'fa-solid fa-circle-check';
  if (type === 'error') iconClass = 'fa-solid fa-circle-exclamation';
  
  // Use escapeHtml to prevent XSS from server error messages
  toast.innerHTML = `
    <i class="${iconClass} toast-icon"></i>
    <div class="toast-content">
      <span class="toast-title">${escapeHtml(title)}</span>
      <span class="toast-desc">${escapeHtml(desc)}</span>
    </div>
  `;
  
  toastContainer.appendChild(toast);
  
  // Reflow and show
  setTimeout(() => toast.classList.add('show'), 50);
  
  // Auto-destroy after 4.5 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4500);
}

// ==========================================
// 시네필 다이어리 Core Logic
// ==========================================

let activeDiaryEmotion = '🍿';

// Open the My CineDiary Modal
function openCineDiary() {
  console.log('[CineDiary] 🚀 openCineDiary() function triggered!');
  const cinesparkSpaceModal = document.getElementById('cineDiaryModal');
  if (!cinesparkSpaceModal) {
    alert('모달 요소를 찾을 수 없습니다.');
    return;
  }
  
  // 1. OPEN IMMEDIATELY BEFORE ANY OTHER LOGIC
  cinesparkSpaceModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  console.log('[CineDiary] 모달 active 클래스 추가 완료.');
  
  try {
    // 2. Set date inputs default to today's date if empty
    const todayStr = new Date().toISOString().split('T')[0];
    const ticketDateInput = document.getElementById('ticketWatchDate');
    const diaryDateInput = document.getElementById('diaryDate');
    
    if (ticketDateInput && !ticketDateInput.value) {
      ticketDateInput.value = todayStr;
    }
    if (diaryDateInput && !diaryDateInput.value) {
      diaryDateInput.value = todayStr;
    }
    
    // 3. Initialize dynamic content safely
    try { updateLiveTicketPreview(); } catch (e) { console.error('Failed to update live ticket preview:', e); }
    try { loadSavedTickets(); } catch (e) { console.error('Failed to load saved tickets:', e); }
    try { loadSavedDiaries(); } catch (e) { console.error('Failed to load saved diaries:', e); }
    try { loadSavedBuckets(); } catch (e) { console.error('Failed to load saved buckets:', e); }
    
  } catch (err) {
    console.error('[CineDiary] openCineDiary 처리 중 에러 발생:', err);
  }
}

// Live ticket preview renderer
let currentFetchedPosterUrl = null;

async function loadTicketPosterPreview(movieNm) {
  if (!movieNm || movieNm.trim() === '') {
    const previewPosterImg = document.getElementById('previewPosterImg');
    if (previewPosterImg) {
      previewPosterImg.style.display = 'none';
      previewPosterImg.src = '';
    }
    const previewPosterBlur = document.getElementById('previewPosterBlur');
    if (previewPosterBlur) {
      previewPosterBlur.style.display = 'none';
      previewPosterBlur.style.backgroundImage = '';
    }
    currentFetchedPosterUrl = null;
    return;
  }
  
  try {
    const res = await fetch(`${BACKEND_BASE}/api/search-poster?movieNm=${encodeURIComponent(movieNm)}`, {
      headers: API_HEADERS
    });
    const data = await res.json();
    const previewPosterImg = document.getElementById('previewPosterImg');
    const previewPosterBlur = document.getElementById('previewPosterBlur');
    
    if (data.success && data.poster) {
      currentFetchedPosterUrl = data.poster;
      if (previewPosterImg) {
        previewPosterImg.src = data.poster;
        previewPosterImg.style.display = 'block';
      }
      if (previewPosterBlur) {
        previewPosterBlur.style.backgroundImage = `url('${data.poster}')`;
        previewPosterBlur.style.display = 'block';
      }
    } else {
      currentFetchedPosterUrl = null;
      if (previewPosterImg) {
        previewPosterImg.style.display = 'none';
        previewPosterImg.src = '';
      }
      if (previewPosterBlur) {
        previewPosterBlur.style.display = 'none';
        previewPosterBlur.style.backgroundImage = '';
      }
    }
  } catch (e) {
    console.error('Failed to fetch ticket poster preview:', e);
    currentFetchedPosterUrl = null;
  }
}

function updateLiveTicketPreview() {
  const ticketMovieNmEl = document.getElementById('ticketMovieNm');
  const ticketWatchDateEl = document.getElementById('ticketWatchDate');
  const ticketTheaterEl = document.getElementById('ticketTheater');
  const ticketSeatEl = document.getElementById('ticketSeat');
  const ticketCompanionsEl = document.getElementById('ticketCompanions');
  const ticketSnacksEl = document.getElementById('ticketSnacks');
  const ticketReviewEl = document.getElementById('ticketReview');

  const movieNm = (ticketMovieNmEl && ticketMovieNmEl.value.trim()) || '영화를 입력해 주세요';
  const watchDate = (ticketWatchDateEl && ticketWatchDateEl.value) || '2026.06.01';
  const theater = (ticketTheaterEl && ticketTheaterEl.value) || 'CGV';
  const seat = (ticketSeatEl && ticketSeatEl.value.trim()) || '일반석';
  const companions = (ticketCompanionsEl && ticketCompanionsEl.value.trim()) || '혼자서';
  const snacks = (ticketSnacksEl && ticketSnacksEl.value.trim()) || '선택 안 함';
  const review = (ticketReviewEl && ticketReviewEl.value.trim()) || '나만의 특별한 관람 한 줄 평 메모 영역입니다.';

  if (movieNm === '영화를 입력해 주세요' || movieNm.trim() === '') {
    const previewPosterImg = document.getElementById('previewPosterImg');
    if (previewPosterImg) {
      previewPosterImg.style.display = 'none';
      previewPosterImg.src = '';
    }
    const previewPosterBlur = document.getElementById('previewPosterBlur');
    if (previewPosterBlur) {
      previewPosterBlur.style.display = 'none';
      previewPosterBlur.style.backgroundImage = '';
    }
    currentFetchedPosterUrl = null;
  }
  
  // Format watch date to YYYY.MM.DD
  let formattedDate = watchDate;
  if (watchDate.includes('-')) {
    formattedDate = watchDate.replace(/-/g, '.');
  }
  
  // Update elements safely
  const previewTitleEl = document.getElementById('previewTitle');
  const previewDateEl = document.getElementById('previewDate');
  const previewTheaterLabelEl = document.getElementById('previewTheaterLabel');
  const previewSeatEl = document.getElementById('previewSeat');
  const previewCompanionEl = document.getElementById('previewCompanion');
  const previewSnackEl = document.getElementById('previewSnack');
  const previewMemoEl = document.getElementById('previewMemo');
  const previewSerialEl = document.getElementById('previewSerial');
  
  if (previewTitleEl) previewTitleEl.textContent = movieNm;
  if (previewDateEl) previewDateEl.textContent = formattedDate;
  if (previewTheaterLabelEl) previewTheaterLabelEl.textContent = theater;
  if (previewSeatEl) previewSeatEl.textContent = seat;
  if (previewCompanionEl) previewCompanionEl.textContent = companions;
  if (previewSnackEl) previewSnackEl.textContent = snacks;
  if (previewMemoEl) previewMemoEl.textContent = review;
  
  // Update Serial preview based on date
  const datePart = watchDate.replace(/-/g, '') || '20260601';
  if (previewSerialEl) previewSerialEl.textContent = `CS-${datePart}-PREV`;
  
  // Apply dynamic color gradient to header background based on theater type
  const headerBg = document.getElementById('ticketHeaderBg');
  if (headerBg) {
    let gradient = 'linear-gradient(135deg, rgba(229, 169, 169, 0.25) 0%, rgba(212, 175, 55, 0.2) 100%)';
    if (theater === 'CGV') {
      gradient = 'linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(220, 38, 38, 0.15) 100%)';
    } else if (theater === '롯데시네마') {
      gradient = 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(239, 68, 68, 0.2) 100%)';
    } else if (theater === '메가박스') {
      gradient = 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(99, 102, 241, 0.15) 100%)';
    } else if (theater === '집 / OTT') {
      gradient = 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(5, 150, 105, 0.15) 100%)';
    } else if (theater === '기타 극장') {
      gradient = 'linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(217, 119, 6, 0.15) 100%)';
    }
    headerBg.style.background = gradient;
  }
}

// --- Tab 1: Digital Ticket Book Logic ---
async function saveTicketStub() {
  const ticketMovieNmEl = document.getElementById('ticketMovieNm');
  const ticketWatchDateEl = document.getElementById('ticketWatchDate');
  const ticketTheaterEl = document.getElementById('ticketTheater');
  const ticketSeatEl = document.getElementById('ticketSeat');
  const ticketCompanionsEl = document.getElementById('ticketCompanions');
  const ticketSnacksEl = document.getElementById('ticketSnacks');
  const ticketReviewEl = document.getElementById('ticketReview');

  const movieNm = ticketMovieNmEl ? ticketMovieNmEl.value.trim() : '';
  const watchDate = ticketWatchDateEl ? ticketWatchDateEl.value : '';
  const theater = ticketTheaterEl ? ticketTheaterEl.value : 'CGV';
  const seat = ticketSeatEl ? ticketSeatEl.value.trim() : '';
  const companions = ticketCompanionsEl ? ticketCompanionsEl.value.trim() : '';
  const snacks = ticketSnacksEl ? ticketSnacksEl.value.trim() : '';
  const review = ticketReviewEl ? ticketReviewEl.value.trim() : '';
  
  if (!movieNm) {
    showToast('발급 실패', '영화 제목을 입력해 주세요.', 'error');
    return;
  }
  if (!watchDate) {
    showToast('발급 실패', '관람 일자를 선택해 주세요.', 'error');
    return;
  }
  
  let ticketPoster = currentFetchedPosterUrl;
  
  // Fallback: if not loaded, fetch immediately
  if (!ticketPoster) {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/search-poster?movieNm=${encodeURIComponent(movieNm)}`, {
        headers: API_HEADERS
      });
      const data = await res.json();
      if (data.success && data.poster) {
        ticketPoster = data.poster;
      }
    } catch (e) {
      console.error('Failed to fetch poster in saveTicketStub:', e);
    }
  }

  const datePart = watchDate.replace(/-/g, '');
  const randPart = Math.floor(1000 + Math.random() * 9000);
  const serial = `CS-${datePart}-${randPart}`;
  
  const newTicket = {
    id: Date.now().toString(),
    movieNm,
    watchDate,
    theater,
    seat: seat || '일반석',
    companions: companions || '혼자서',
    snacks: snacks || '선택 안 함',
    review: review || '아름다운 영화적 순간.',
    serial,
    poster: ticketPoster || null
  };
  
  let tickets = [];
  try {
    tickets = JSON.parse(localStorage.getItem('CINEDIARY_TICKETS') || '[]');
  } catch (e) {
    console.error('Failed to parse CINEDIARY_TICKETS:', e);
  }
  
  if (!Array.isArray(tickets)) tickets = [];
  
  tickets.unshift(newTicket);
  
  try {
    localStorage.setItem('CINEDIARY_TICKETS', JSON.stringify(tickets));
    showToast('티켓 발급 성공', `영화 《${movieNm}》의 디지털 티켓이 보관함에 저장되었습니다.`, 'success');
    
    // Reset Form
    if (ticketMovieNmEl) ticketMovieNmEl.value = '';
    if (ticketSeatEl) ticketSeatEl.value = '';
    if (ticketCompanionsEl) ticketCompanionsEl.value = '';
    if (ticketSnacksEl) ticketSnacksEl.value = '';
    if (ticketReviewEl) ticketReviewEl.value = '';
    if (ticketTheaterEl) ticketTheaterEl.value = 'CGV';
    if (ticketWatchDateEl) ticketWatchDateEl.value = new Date().toISOString().split('T')[0];
    
    updateLiveTicketPreview();
    loadSavedTickets();
  } catch (e) {
    console.error('Failed to save ticket:', e);
    showToast('저장 실패', '로컬 저장 공간이 부족합니다.', 'error');
  }
}

function loadSavedTickets() {
  const carousel = document.getElementById('savedTicketsCarousel');
  const countSpan = document.getElementById('savedTicketCount');
  if (!carousel) return;
  
  let tickets = [];
  try {
    tickets = JSON.parse(localStorage.getItem('CINEDIARY_TICKETS') || '[]');
  } catch (e) {
    console.error(e);
  }
  
  if (!Array.isArray(tickets)) tickets = [];
  
  if (countSpan) countSpan.textContent = tickets.length;
  
  if (tickets.length === 0) {
    carousel.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--color-text-muted); width: 100%;">
        <i class="fa-solid fa-ticket-simple" style="font-size: 2.5rem; color: rgba(255,255,255,0.1); margin-bottom: 0.75rem; display: block;"></i>
        아직 보관된 티켓이 없습니다. 첫 영화 티켓을 발행해 보세요!
      </div>
    `;
    return;
  }
  
  carousel.innerHTML = '';
  tickets.forEach(ticket => {
    if (!ticket) return;
    let formattedDate = ticket.watchDate || '';
    if (formattedDate && formattedDate.includes('-')) {
      formattedDate = formattedDate.replace(/-/g, '.');
    }
    
    // Determine theater theme colors for dynamic backgrounds
    let gradient = 'linear-gradient(135deg, rgba(229, 169, 169, 0.25) 0%, rgba(212, 175, 55, 0.2) 100%)';
    const theater = ticket.theater || 'CGV';
    if (theater === 'CGV') {
      gradient = 'linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(220, 38, 38, 0.15) 100%)';
    } else if (theater === '롯데시네마') {
      gradient = 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(239, 68, 68, 0.2) 100%)';
    } else if (theater === '메가박스') {
      gradient = 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(99, 102, 241, 0.15) 100%)';
    } else if (theater === '집 / OTT') {
      gradient = 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(5, 150, 105, 0.15) 100%)';
    } else if (theater === '기타 극장') {
      gradient = 'linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(217, 119, 6, 0.15) 100%)';
    }
    
    const item = document.createElement('div');
    item.className = 'carousel-stub-item';
    
    let posterAreaHtml = '';
    if (ticket.poster) {
      posterAreaHtml = `
        <div class="ticket-poster">
          <!-- Ambient Blurred Backdrop -->
          <div style="background-image: url('${escapeHtml(ticket.poster)}'); position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-size: cover; background-position: center; filter: blur(12px) brightness(0.35); transform: scale(1.1); pointer-events: none;"></div>
          <img src="${escapeHtml(ticket.poster)}" class="ticket-poster-img" alt="${escapeHtml(ticket.movieNm)}">
          <div class="ticket-poster-overlay"></div>
        </div>
      `;
    } else {
      posterAreaHtml = `
        <div class="ticket-poster">
          <i class="fa-solid fa-film ticket-poster-placeholder-icon"></i>
          <div class="ticket-poster-overlay"></div>
        </div>
      `;
    }

    item.innerHTML = `
      <button class="stub-delete-btn" onclick="deleteTicketStub(event, '${ticket.id}')" title="티켓 삭제">
        <i class="fa-solid fa-trash"></i>
      </button>
      <div class="ticket-stub">
        <div class="ticket-header" style="background: ${gradient}">
          <span class="ticket-logo">CINE<span>DIARY</span> TICKET</span>
          <span class="spec-label" style="margin-bottom:0; color: #fff;">${escapeHtml(theater)}</span>
        </div>
        ${posterAreaHtml}
        <div class="ticket-body">
          <span class="ticket-meta-label">MOVIE TITLE</span>
          <h4 class="ticket-title" title="${escapeHtml(ticket.movieNm)}">${escapeHtml(ticket.movieNm)}</h4>
          
          <div class="ticket-meta-grid" style="margin-top: 0.5rem;">
            <div class="ticket-meta-item">
              <span class="ticket-meta-label">DATE</span>
              <span class="ticket-meta-val">${escapeHtml(formattedDate)}</span>
            </div>
            <div class="ticket-meta-item">
              <span class="ticket-meta-label">COMPANION</span>
              <span class="ticket-meta-val" title="${escapeHtml(ticket.companions)}">${escapeHtml(ticket.companions)}</span>
            </div>
          </div>
          <div class="ticket-meta-grid">
            <div class="ticket-meta-item">
              <span class="ticket-meta-label">SEAT</span>
              <span class="ticket-meta-val" title="${escapeHtml(ticket.seat)}">${escapeHtml(ticket.seat)}</span>
            </div>
            <div class="ticket-meta-item">
              <span class="ticket-meta-label">SNACKS</span>
              <span class="ticket-meta-val" title="${escapeHtml(ticket.snacks)}">${escapeHtml(ticket.snacks)}</span>
            </div>
          </div>
          <div class="ticket-meta-item" style="border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 0.5rem; margin-top: 0.25rem;">
            <span class="ticket-meta-label">REVIEW MEMO</span>
            <span class="ticket-meta-val" style="font-weight: 500; font-size: 0.75rem; color: var(--color-text-muted); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${escapeHtml(ticket.review)}">${escapeHtml(ticket.review)}</span>
          </div>

          <div class="ticket-barcode-wrap">
            <div class="ticket-barcode">
              <div class="barcode-line thick-1"></div>
              <div class="barcode-line thin space-thin"></div>
              <div class="barcode-line thick-2 space-thin"></div>
              <div class="barcode-line thin"></div>
              <div class="barcode-line thick-1 space-thick"></div>
              <div class="barcode-line thin"></div>
              <div class="barcode-line thick-2"></div>
              <div class="barcode-line thin space-thin"></div>
              <div class="barcode-line thick-1"></div>
            </div>
            <span class="ticket-serial">${escapeHtml(ticket.serial)}</span>
          </div>
        </div>
      </div>
    `;
    carousel.appendChild(item);
  });
}

function deleteTicketStub(e, id) {
  if (e) e.stopPropagation();
  
  if (!confirm('이 티켓을 완전히 삭제하시겠습니까?')) return;
  
  let tickets = [];
  try {
    tickets = JSON.parse(localStorage.getItem('CINEDIARY_TICKETS') || '[]');
  } catch (err) {
    console.error(err);
  }
  
  if (!Array.isArray(tickets)) tickets = [];
  tickets = tickets.filter(t => t && t.id !== id);
  
  try {
    localStorage.setItem('CINEDIARY_TICKETS', JSON.stringify(tickets));
    showToast('티켓 삭제 완료', '디지털 티켓이 보관함에서 제거되었습니다.', 'success');
    loadSavedTickets();
  } catch (err) {
    console.error(err);
    showToast('삭제 실패', '기록을 삭제하는 중 오류가 발생했습니다.', 'error');
  }
}

// --- Tab 2: Cinephile's Daily Journal Logic ---
function saveDiaryEntry() {
  const diaryTitleEl = document.getElementById('diaryTitle');
  const diaryDateEl = document.getElementById('diaryDate');
  const diaryContextEl = document.getElementById('diaryContext');
  const diaryContentEl = document.getElementById('diaryContent');

  const title = diaryTitleEl ? diaryTitleEl.value.trim() : '';
  const diaryDate = diaryDateEl ? diaryDateEl.value : '';
  const context = diaryContextEl ? diaryContextEl.value : '집에서 이불 덮고 혼자';
  const content = diaryContentEl ? diaryContentEl.value.trim() : '';
  
  if (!title) {
    showToast('기록 실패', '일기 제목을 입력해 주세요.', 'error');
    return;
  }
  if (!diaryDate) {
    showToast('기록 실패', '작성 날짜를 선택해 주세요.', 'error');
    return;
  }
  if (!content) {
    showToast('기록 실패', '일기장 글을 작성해 주세요.', 'error');
    return;
  }
  
  const newDiary = {
    id: Date.now().toString(),
    title,
    watchDate: diaryDate,
    context,
    emotion: activeDiaryEmotion,
    content,
    savedAt: new Date().toISOString()
  };
  
  let diaries = [];
  try {
    diaries = JSON.parse(localStorage.getItem('CINEDIARY_DIARIES') || '[]');
  } catch (e) {
    console.error(e);
  }
  
  if (!Array.isArray(diaries)) diaries = [];
  
  diaries.unshift(newDiary);
  
  try {
    localStorage.setItem('CINEDIARY_DIARIES', JSON.stringify(diaries));
    showToast('일기 저장 완료', '오늘의 영화 감상이 다이어리에 소중히 보관되었습니다.', 'success');
    
    // Reset Form
    if (diaryTitleEl) diaryTitleEl.value = '';
    if (diaryContentEl) diaryContentEl.value = '';
    if (diaryContextEl) diaryContextEl.value = '집에서 이불 덮고 혼자';
    
    // Reset emotion buttons visual state
    const emotionBtns = document.querySelectorAll('#diaryEmotionRow .emotion-btn');
    emotionBtns.forEach((b, idx) => {
      if (idx === 0) {
        b.classList.add('active');
        activeDiaryEmotion = b.getAttribute('data-emoji') || '🍿';
      } else {
        b.classList.remove('active');
      }
    });
    
    if (diaryDateEl) diaryDateEl.value = new Date().toISOString().split('T')[0];
    
    loadSavedDiaries();
  } catch (e) {
    console.error(e);
    showToast('저장 실패', '로컬 저장 공간이 부족합니다.', 'error');
  }
}

function loadSavedDiaries() {
  const feedList = document.getElementById('diaryFeedList');
  const countSpan = document.getElementById('savedDiaryCount');
  if (!feedList) return;
  
  let diaries = [];
  try {
    diaries = JSON.parse(localStorage.getItem('CINEDIARY_DIARIES') || '[]');
  } catch (e) {
    console.error(e);
  }
  
  if (!Array.isArray(diaries)) diaries = [];
  
  if (countSpan) countSpan.textContent = diaries.length;
  
  if (diaries.length === 0) {
    feedList.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem; color: var(--color-text-muted); width: 100%;">
        <i class="fa-solid fa-pen-fancy" style="font-size: 2.5rem; color: rgba(255,255,255,0.1); margin-bottom: 0.75rem; display: block;"></i>
        아직 기록된 일기가 없습니다. 영화 일상의 소중한 한 컷을 적어보세요!
      </div>
    `;
    return;
  }
  
  feedList.innerHTML = '';
  diaries.forEach(diary => {
    if (!diary) return;
    let formattedDate = diary.watchDate || '';
    if (formattedDate && formattedDate.includes('-')) {
      formattedDate = formattedDate.replace(/-/g, '.');
    }
    
    const card = document.createElement('div');
    card.className = 'diary-feed-card';
    card.innerHTML = `
      <button class="diary-delete-btn" onclick="deleteDiaryEntry(event, '${diary.id}')" title="일기 삭제">
        <i class="fa-solid fa-trash"></i>
      </button>
      <div class="diary-card-header">
        <div class="diary-card-title-wrap">
          <span class="diary-card-emoji">${escapeHtml(diary.emotion || '🍿')}</span>
          <span class="diary-card-title">${escapeHtml(diary.title)}</span>
        </div>
        <span class="diary-card-date">${escapeHtml(formattedDate)}</span>
      </div>
      <span class="diary-card-tag"><i class="fa-solid fa-location-dot" style="margin-right: 4px;"></i>${escapeHtml(diary.context)}</span>
      <p class="diary-card-text">${escapeHtml(diary.content)}</p>
    `;
    feedList.appendChild(card);
  });
}

function deleteDiaryEntry(e, id) {
  if (e) e.stopPropagation();
  
  if (!confirm('이 일기를 삭제하시겠습니까?')) return;
  
  let diaries = [];
  try {
    diaries = JSON.parse(localStorage.getItem('CINEDIARY_DIARIES') || '[]');
  } catch (err) {
    console.error(err);
  }
  
  if (!Array.isArray(diaries)) diaries = [];
  diaries = diaries.filter(d => d && d.id !== id);
  
  try {
    localStorage.setItem('CINEDIARY_DIARIES', JSON.stringify(diaries));
    showToast('일기 삭제 완료', '일기 기록이 보관함에서 삭제되었습니다.', 'success');
    loadSavedDiaries();
  } catch (err) {
    console.error(err);
    showToast('삭제 실패', '기록을 삭제하는 중 오류가 발생했습니다.', 'error');
  }
}

// --- Tab 3: Bucket List Planner Logic ---
function createBucketBoard() {
  const bucketListTitleEl = document.getElementById('bucketListTitle');
  const title = bucketListTitleEl ? bucketListTitleEl.value.trim() : '';
  if (!title) {
    showToast('생성 실패', '챌린지 리스트 보드의 이름을 입력해 주세요.', 'error');
    return;
  }
  
  const newBoard = {
    id: Date.now().toString(),
    title,
    items: []
  };
  
  let boards = [];
  try {
    boards = JSON.parse(localStorage.getItem('CINEDIARY_BUCKETS') || '[]');
  } catch (e) {
    console.error(e);
  }
  
  if (!Array.isArray(boards)) boards = [];
  
  boards.push(newBoard);
  
  try {
    localStorage.setItem('CINEDIARY_BUCKETS', JSON.stringify(boards));
    showToast('보드 생성 완료', `새로운 영화 챌린지 《${title}》 보드가 다이어리에 배치되었습니다.`, 'success');
    
    if (bucketListTitleEl) bucketListTitleEl.value = '';
    loadSavedBuckets();
  } catch (e) {
    console.error(e);
    showToast('저장 실패', '로컬 저장 공간이 부족합니다.', 'error');
  }
}

function loadSavedBuckets() {
  const grid = document.getElementById('bucketListsGrid');
  const countSpan = document.getElementById('savedBucketCount');
  if (!grid) return;
  
  let boards = [];
  try {
    boards = JSON.parse(localStorage.getItem('CINEDIARY_BUCKETS') || '[]');
  } catch (e) {
    console.error(e);
  }
  
  if (!Array.isArray(boards)) boards = [];
  
  if (countSpan) countSpan.textContent = boards.length;
  
  if (boards.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--color-text-muted);">
        <i class="fa-regular fa-calendar-check" style="font-size: 3rem; margin-bottom: 1rem; display: block; color: rgba(255,255,255,0.15);"></i>
        <p>아직 생성된 챌린지 맵이 존재하지 않습니다. 나만의 버킷 리스트를 생성해 보세요!</p>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = '';
  boards.forEach(board => {
    if (!board) return;
    const items = Array.isArray(board.items) ? board.items : [];
    const totalCount = items.length;
    const checkedCount = items.filter(item => item && item.checked).length;
    const progressPercent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
    
    let itemsHtml = '';
    if (totalCount === 0) {
      itemsHtml = `
        <div style="font-size: 0.75rem; color: var(--color-text-muted); text-align: center; padding: 1.5rem 0.5rem; width: 100%;">
          아직 챌린지 영화가 없습니다. 아래 입력칸에서 영화를 보드에 추가해 보세요!
        </div>
      `;
    } else {
      items.forEach(item => {
        if (!item) return;
        itemsHtml += `
          <div class="bucket-item ${item.checked ? 'checked' : ''}" style="justify-content: space-between; width: 100%;">
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; flex: 1;">
              <input type="checkbox" ${item.checked ? 'checked' : ''} onclick="toggleBucketItem('${board.id}', '${item.id}')">
              <span>${escapeHtml(item.text)}</span>
            </label>
            <button class="diary-delete-btn" onclick="deleteBucketItem(event, '${board.id}', '${item.id}')" style="position: static; opacity: 0.3; padding: 2px; font-size: 0.7rem;" title="영화 삭제">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        `;
      });
    }
    
    const card = document.createElement('div');
    card.className = 'bucket-card';
    card.innerHTML = `
      <div class="bucket-card-header">
        <h4 class="bucket-card-title">
          <i class="fa-solid fa-circle-check"></i> ${escapeHtml(board.title)}
        </h4>
        <button class="diary-delete-btn" onclick="deleteBucketBoard(event, '${board.id}')" style="position: static; opacity: 0.5; padding: 2px 6px;" title="리스트 보드 삭제">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
      <div class="bucket-items-list">
        ${itemsHtml}
      </div>
      <div class="bucket-progress-wrap">
        <div class="bucket-progress-text">
          <span>챌린지 달성도</span>
          <span>${progressPercent}% (${checkedCount}/${totalCount})</span>
        </div>
        <div class="bucket-progress-bar-bg">
          <div class="bucket-progress-bar-fg" style="width: ${progressPercent}%;"></div>
        </div>
      </div>
      <div class="bucket-add-item-wrap" style="display: flex; gap: 0.5rem; margin-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.75rem;">
        <input type="text" id="itemInput_${board.id}" class="space-input bucket-item-input" placeholder="정복할 영화 이름..." style="padding: 0.4rem 0.6rem; font-size: 0.75rem;" onkeydown="if(event.key === 'Enter') addMovieToBucket('${board.id}')">
        <button class="ai-btn" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; background: var(--gradient-neon);" onclick="addMovieToBucket('${board.id}')">추가</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function deleteBucketBoard(e, id) {
  if (e) e.stopPropagation();
  
  if (!confirm('이 챌린지 리스트 보드와 보드 내의 모든 영화 체크리스트를 완전히 삭제하시겠습니까?')) return;
  
  let boards = [];
  try {
    boards = JSON.parse(localStorage.getItem('CINEDIARY_BUCKETS') || '[]');
  } catch (err) {
    console.error(err);
  }
  
  if (!Array.isArray(boards)) boards = [];
  boards = boards.filter(b => b && b.id !== id);
  
  try {
    localStorage.setItem('CINEDIARY_BUCKETS', JSON.stringify(boards));
    showToast('보드 삭제 완료', '영화 챌린지 보드가 다이어리에서 철거되었습니다.', 'success');
    loadSavedBuckets();
  } catch (err) {
    console.error(err);
    showToast('삭제 실패', '보드를 삭제하지 못했습니다.', 'error');
  }
}

function addMovieToBucket(boardId) {
  const inputEl = document.getElementById(`itemInput_${boardId}`);
  if (!inputEl) return;
  
  const text = inputEl.value.trim();
  if (!text) {
    showToast('추가 실패', '영화 이름을 입력해 주세요.', 'error');
    return;
  }
  
  let boards = [];
  try {
    boards = JSON.parse(localStorage.getItem('CINEDIARY_BUCKETS') || '[]');
  } catch (e) {
    console.error(e);
  }
  
  if (!Array.isArray(boards)) boards = [];
  
  const board = boards.find(b => b && b.id === boardId);
  if (!board) return;
  
  if (!Array.isArray(board.items)) board.items = [];
  
  const newItem = {
    id: Date.now().toString(),
    text,
    checked: false
  };
  
  board.items.push(newItem);
  
  try {
    localStorage.setItem('CINEDIARY_BUCKETS', JSON.stringify(boards));
    inputEl.value = '';
    loadSavedBuckets();
  } catch (e) {
    console.error(e);
    showToast('저장 실패', '로컬 저장 공간이 부족합니다.', 'error');
  }
}

function toggleBucketItem(boardId, itemId) {
  let boards = [];
  try {
    boards = JSON.parse(localStorage.getItem('CINEDIARY_BUCKETS') || '[]');
  } catch (e) {
    console.error(e);
  }
  
  if (!Array.isArray(boards)) boards = [];
  
  const board = boards.find(b => b && b.id === boardId);
  if (!board) return;
  
  if (!Array.isArray(board.items)) board.items = [];
  const item = board.items.find(i => i && i.id === itemId);
  if (!item) return;
  
  item.checked = !item.checked;
  
  try {
    localStorage.setItem('CINEDIARY_BUCKETS', JSON.stringify(boards));
    loadSavedBuckets();
    
    if (item.checked) {
      showToast('정복 완료 🍿', `영화 《${item.text}》 미션을 완료하였습니다! 축하합니다!`, 'success');
    }
  } catch (e) {
    console.error(e);
  }
}

function deleteBucketItem(e, boardId, itemId) {
  if (e) e.stopPropagation();
  
  let boards = [];
  try {
    boards = JSON.parse(localStorage.getItem('CINEDIARY_BUCKETS') || '[]');
  } catch (err) {
    console.error(err);
  }
  
  if (!Array.isArray(boards)) boards = [];
  const board = boards.find(b => b && b.id === boardId);
  if (!board) return;
  
  if (!Array.isArray(board.items)) board.items = [];
  board.items = board.items.filter(i => i && i.id !== itemId);
  
  try {
    localStorage.setItem('CINEDIARY_BUCKETS', JSON.stringify(boards));
    loadSavedBuckets();
  } catch (err) {
    console.error(err);
  }
}

// Expose functions globally for inline HTML event handlers
window.openCineDiary = openCineDiary;
window.updateLiveTicketPreview = updateLiveTicketPreview;
window.saveTicketStub = saveTicketStub;
window.deleteTicketStub = deleteTicketStub;
window.saveDiaryEntry = saveDiaryEntry;
window.deleteDiaryEntry = deleteDiaryEntry;
window.createBucketBoard = createBucketBoard;
window.loadSavedBuckets = loadSavedBuckets;
window.deleteBucketBoard = deleteBucketBoard;
window.addMovieToBucket = addMovieToBucket;
window.toggleBucketItem = toggleBucketItem;
window.deleteBucketItem = deleteBucketItem;

// ---- Modal accessibility: focus trap, ESC-to-close, and focus restoration ----
(function initModalA11y() {
  const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const lastFocusedByModal = new WeakMap();

  function getActiveModal() {
    return document.querySelector('.modal-overlay.active');
  }

  function getVisibleFocusable(modal) {
    return Array.from(modal.querySelectorAll(FOCUSABLE)).filter((el) => {
      return el.offsetParent !== null || el === document.activeElement;
    });
  }

  // Watch each modal for the 'active' class toggling to manage focus
  document.querySelectorAll('.modal-overlay').forEach((modal) => {
    let wasActive = modal.classList.contains('active');
    const observer = new MutationObserver(() => {
      const isActive = modal.classList.contains('active');
      if (isActive === wasActive) return;
      wasActive = isActive;

      if (isActive) {
        lastFocusedByModal.set(modal, document.activeElement);
        // Defer so content/poster has rendered before focusing
        setTimeout(() => {
          const focusables = getVisibleFocusable(modal);
          const target = modal.querySelector('.modal-close-btn') || focusables[0] || modal;
          if (target && typeof target.focus === 'function') target.focus();
        }, 30);
      } else {
        const prev = lastFocusedByModal.get(modal);
        if (prev && typeof prev.focus === 'function' && document.body.contains(prev)) {
          prev.focus();
        }
        lastFocusedByModal.delete(modal);
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
  });

  document.addEventListener('keydown', (e) => {
    const modal = getActiveModal();
    if (!modal) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      const closeBtn = modal.querySelector('.modal-close-btn');
      if (closeBtn) closeBtn.click();
      return;
    }

    if (e.key === 'Tab') {
      const focusables = getVisibleFocusable(modal);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!modal.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  });
})();

