require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1); // Trust Render's reverse proxy for correct rate-limiting and health checks
const PORT = process.env.PORT || 5000;
const APP_AUTH_TOKEN = process.env.APP_AUTH_TOKEN || 'DEFAULT_CINESPARKS_AUTH_TOKEN';
const KOBIS_API_KEY = process.env.KOBIS_API_KEY || '5a852c691ced334dd9ffadc9ac8637c5';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// In-Memory Caching System
class MemoryCache {
  constructor(cleanupIntervalMs = 10 * 60 * 1000) {
    this.cache = new Map();
    // Periodically remove expired entries to prevent memory leaks
    this._cleanupTimer = setInterval(() => this.cleanup(), cleanupIntervalMs);
    if (this._cleanupTimer.unref) this._cleanupTimer.unref(); // Don't block process exit
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlSeconds = 3600) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache) {
      if (now > item.expiry) this.cache.delete(key);
    }
  }
}

const apiCache = new MemoryCache();

app.use(cors());
app.use(express.json());

// Serve static assets with no-cache headers to prevent browser from caching older HTML/JS code!
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Rate Limiters
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 60,              // 60 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
});

const reviewLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 5,               // 5 AI review requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI 평론 요청이 너무 많습니다. 1분 후 다시 시도해 주세요.' },
});

app.use('/api/', generalLimiter);

// Security Middleware (Client to Server Verification)
const checkAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header.' });
  }

  const token = authHeader.split(' ')[1];
  if (token !== APP_AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: Access token is invalid.' });
  }

  next();
};

// 0. GET /api/init — Provide auth token to client securely (server-side env only)
app.get('/api/init', (req, res) => {
  res.json({ token: APP_AUTH_TOKEN });
});

// 1. GET /api/boxoffice?targetDt=YYYYMMDD&repNationCd=K|F
app.get('/api/boxoffice', checkAuth, async (req, res) => {
  const startTime = Date.now();
  const { targetDt, repNationCd } = req.query;

  if (!targetDt || !/^\d{8}$/.test(targetDt)) {
    return res.status(400).json({ error: 'Invalid Date: targetDt parameter must be YYYYMMDD.' });
  }

  const nationKey = (repNationCd === 'K' || repNationCd === 'F') ? repNationCd : 'ALL';
  const cacheKey = `boxoffice_${targetDt}_${nationKey}`;
  const cachedData = apiCache.get(cacheKey);

  if (cachedData) {
    const latency = Date.now() - startTime;
    return res.json({
      success: true,
      fromCache: true,
      latency: `${latency}ms`,
      data: cachedData,
    });
  }

  try {
    let url = `http://kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchDailyBoxOfficeList.json?key=${KOBIS_API_KEY}&targetDt=${targetDt}`;
    if (nationKey !== 'ALL') {
      url += `&repNationCd=${nationKey}`;
    }
    const response = await axios.get(url);

    const boxOfficeResult = response.data?.boxOfficeResult;
    if (!boxOfficeResult || boxOfficeResult.error) {
      const errMsg = boxOfficeResult?.error?.message || 'Failed to fetch box office from KOBIS';
      return res.status(502).json({ error: errMsg });
    }

    const rawList = boxOfficeResult.dailyBoxOfficeList || [];
    
    // TMDB Integration to fetch Poster, Backdrop and Ratings
    const formattedList = await Promise.all(rawList.map(async (movie) => {
      const tmdb = await getTmdbAssets(movie.movieNm, movie.openDt);
      return {
        rank: movie.rank,
        rankInten: movie.rankInten,
        rankOldAndNew: movie.rankOldAndNew,
        movieCd: movie.movieCd,
        movieNm: movie.movieNm,
        openDt: movie.openDt,
        audiCnt: parseInt(movie.audiCnt, 10).toLocaleString('ko-KR'),
        audiAcc: parseInt(movie.audiAcc, 10).toLocaleString('ko-KR'),
        poster: tmdb.poster,
        backdrop: tmdb.backdrop,
        rating: tmdb.rating,
        genre: tmdb.genre
      };
    }));

    // Cache box office data for 6 hours (21600 seconds)
    apiCache.set(cacheKey, formattedList, 21600);

    const latency = Date.now() - startTime;
    return res.json({
      success: true,
      fromCache: false,
      latency: `${latency}ms`,
      data: formattedList,
    });
  } catch (error) {
    console.error('KOBIS BoxOffice API Error:', error.message);
    return res.status(500).json({
      error: '서비스 제공업체의 일시적 지연이 발생했습니다. 잠시 후 다시 시도해 주세요',
    });
  }
});

// 1.2. GET /api/weeklyboxoffice?targetDt=YYYYMMDD&repNationCd=K|F&weekGb=0|1|2
app.get('/api/weeklyboxoffice', checkAuth, async (req, res) => {
  const startTime = Date.now();
  const { targetDt, repNationCd, weekGb } = req.query;

  if (!targetDt || !/^\d{8}$/.test(targetDt)) {
    return res.status(400).json({ error: 'Invalid Date: targetDt parameter must be YYYYMMDD.' });
  }

  const nationKey = (repNationCd === 'K' || repNationCd === 'F') ? repNationCd : 'ALL';
  const weekGbKey = (weekGb === '0' || weekGb === '1' || weekGb === '2') ? weekGb : '0'; // Default is '0' (Weekly, Mon~Sun)
  const cacheKey = `weeklyboxoffice_${targetDt}_${nationKey}_${weekGbKey}`;
  const cachedData = apiCache.get(cacheKey);

  if (cachedData) {
    const latency = Date.now() - startTime;
    return res.json({
      success: true,
      fromCache: true,
      latency: `${latency}ms`,
      data: cachedData,
    });
  }

  try {
    let url = `http://kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchWeeklyBoxOfficeList.json?key=${KOBIS_API_KEY}&targetDt=${targetDt}&weekGb=${weekGbKey}`;
    if (nationKey !== 'ALL') {
      url += `&repNationCd=${nationKey}`;
    }
    const response = await axios.get(url);

    const boxOfficeResult = response.data?.boxOfficeResult;
    if (!boxOfficeResult || boxOfficeResult.error) {
      const errMsg = boxOfficeResult?.error?.message || 'Failed to fetch weekly box office from KOBIS';
      return res.status(502).json({ error: errMsg });
    }

    const rawList = boxOfficeResult.weeklyBoxOfficeList || [];
    
    // TMDB Integration to fetch Poster, Backdrop and Ratings
    const formattedList = await Promise.all(rawList.map(async (movie) => {
      const tmdb = await getTmdbAssets(movie.movieNm, movie.openDt);
      
      // Calculate formatted values
      const salesAmt = parseInt(movie.salesAmt, 10) || 0;
      const audiCnt = parseInt(movie.audiCnt, 10) || 0;
      
      const eok = salesAmt / 100000000;
      const formattedSales = eok >= 1 ? `${Math.round(eok)}억 원` : `${Math.round(salesAmt / 10000).toLocaleString('ko-KR')}만 원`;
      
      const man = audiCnt / 10000;
      const formattedAudi = man >= 1 ? `${Math.round(man)}만 명` : `${audiCnt.toLocaleString('ko-KR')}명`;

      return {
        rank: movie.rank,
        rankInten: movie.rankInten,
        rankOldAndNew: movie.rankOldAndNew,
        movieCd: movie.movieCd,
        movieNm: movie.movieNm,
        openDt: movie.openDt,
        salesAmt: salesAmt.toLocaleString('ko-KR'),
        audiCnt: audiCnt.toLocaleString('ko-KR'),
        audiAcc: parseInt(movie.audiAcc, 10).toLocaleString('ko-KR'),
        formattedSales,
        formattedAudi,
        poster: tmdb.poster,
        backdrop: tmdb.backdrop,
        rating: tmdb.rating,
        genre: tmdb.genre
      };
    }));

    // Cache box office data for 6 hours (21600 seconds)
    apiCache.set(cacheKey, formattedList, 21600);

    const latency = Date.now() - startTime;
    return res.json({
      success: true,
      fromCache: false,
      latency: `${latency}ms`,
      data: formattedList,
    });
  } catch (error) {
    console.error('KOBIS Weekly BoxOffice API Error:', error.message);
    return res.status(500).json({
      error: '서비스 제공업체의 일시적 지연이 발생했습니다. 잠시 후 다시 시도해 주세요',
    });
  }
});

// 1.5. GET /api/upcoming — Fetch upcoming releases using TMDB South Korea region
app.get('/api/upcoming', checkAuth, async (req, res) => {
  const startTime = Date.now();
  const cacheKey = 'upcoming_movies';
  const cachedData = apiCache.get(cacheKey);

  if (cachedData) {
    const latency = Date.now() - startTime;
    return res.json({
      success: true,
      fromCache: true,
      latency: `${latency}ms`,
      data: cachedData,
    });
  }

  try {
    const tmdbKey = process.env.TMDB_API_KEY || '26b3b2607b512f3af37009d3c6210a9c';
    // Fetch South Korea upcoming movies from TMDB
    const url = `https://api.themoviedb.org/3/movie/upcoming?api_key=${tmdbKey}&language=ko-KR&region=KR`;
    const response = await axios.get(url, { timeout: 4500 });
    const rawList = response.data?.results || [];

    // Filter out movies without posters or release dates
    // Sort movies by release date ascending (soonest release first)
    const formattedList = rawList
      .filter(movie => movie.release_date && movie.poster_path)
      .map(movie => {
        // Map primary genre ID to string
        const genreMap = {
          28: '액션', 12: '모험', 16: '애니메이션', 35: '코미디', 80: '범죄',
          99: '다큐멘터리', 18: '드라마', 10751: '가족', 14: '판타지',
          36: '역사', 27: '공포', 10402: '음악', 9648: '미스터리',
          10749: '로맨스', 878: 'SF', 10770: 'TV 영화', 53: '스릴러',
          10752: '전쟁', 37: '서부'
        };
        const primaryGenreId = movie.genre_ids?.[0];
        const genre = genreMap[primaryGenreId] || '영화';

        return {
          movieCd: `TMDB_${movie.id}`, // synthetic code prefix
          movieNm: movie.title,
          openDt: movie.release_date,
          poster: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
          backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
          rating: movie.vote_average ? movie.vote_average.toFixed(1) : null,
          genre: genre,
          overview: movie.overview || null
        };
      })
      .sort((a, b) => new Date(a.openDt) - new Date(b.openDt)); // sort by release date ascending

    // Cache upcoming list for 12 hours (43200 seconds)
    apiCache.set(cacheKey, formattedList, 43200);

    const latency = Date.now() - startTime;
    return res.json({
      success: true,
      fromCache: false,
      latency: `${latency}ms`,
      data: formattedList,
    });
  } catch (error) {
    console.error('TMDB Upcoming API Error:', error.message);
    return res.status(500).json({
      error: '개봉 예정작 정보를 가져오는 중 서버 에러가 발생했습니다.',
    });
  }
});

// Helper function to search TMDB for posters, backdrops, and descriptions
async function getTmdbAssets(movieNm, openDt) {
  // Use user's TMDB API key if set, or fall back to a public key to ensure instant premium workability!
  const tmdbKey = process.env.TMDB_API_KEY || '26b3b2607b512f3af37009d3c6210a9c';
  if (!tmdbKey || tmdbKey.includes('YourActualTMDBApiKey')) {
    return { poster: null, backdrop: null, rating: null, overview: null, trailerKey: null, genre: null };
  }

  const year = openDt ? openDt.replace(/-/g, '').slice(0, 4) : '';
  const cacheKey = `tmdb_${movieNm}_${year}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return cached;

  try {
    // 1. Search for movie matching name and release year
    let url = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(movieNm)}&language=ko-KR`;
    if (year) {
      url += `&year=${year}`;
    }
    
    const response = await axios.get(url, { timeout: 3500 });
    const movie = response.data?.results?.[0];
    
    if (movie) {
      const movieId = movie.id;
      let trailerKey = null;
      
      // Fetch precise trailer video key from TMDB
      try {
        const videoUrl = `https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${tmdbKey}&language=ko-KR`;
        const videoRes = await axios.get(videoUrl, { timeout: 2000 });
        let videos = videoRes.data?.results || [];
        
        // Fallback to English metadata if Korean video resources are missing
        if (videos.length === 0) {
          const videoUrlEn = `https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${tmdbKey}&language=en-US`;
          const videoResEn = await axios.get(videoUrlEn, { timeout: 2000 });
          videos = videoResEn.data?.results || [];
        }
        
        // Find first YouTube Trailer or Teaser
        const trailer = videos.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) || videos.find(v => v.site === 'YouTube');
        if (trailer) {
          trailerKey = trailer.key;
        }
      } catch (videoErr) {
        console.error(`Failed to fetch TMDB videos for ${movieNm}:`, videoErr.message);
      }

      // Map first genre_id to string representation for dynamic illustrations
      const genreMap = {
        28: '액션', 12: '모험', 16: '애니메이션', 35: '코미디', 80: '범죄',
        99: '다큐멘터리', 18: '드라마', 10751: '가족', 14: '판타지',
        36: '역사', 27: '공포', 10402: '음악', 9648: '미스터리',
        10749: '로맨스', 878: 'SF', 10770: 'TV 영화', 53: '스릴러',
        10752: '전쟁', 37: '서부'
      };
      const primaryGenreId = movie.genre_ids?.[0];
      const genre = genreMap[primaryGenreId] || null;

      const data = {
        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
        backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
        rating: movie.vote_average ? movie.vote_average.toFixed(1) : null,
        overview: movie.overview || null,
        trailerKey: trailerKey,
        genre: genre
      };
      
      apiCache.set(cacheKey, data, 86400); // Cache for 24 hours
      return data;
    }
  } catch (err) {
    console.error(`TMDB search failed for ${movieNm}:`, err.message);
  }
  
  return { poster: null, backdrop: null, rating: null, overview: null, trailerKey: null, genre: null };
}

// 2. GET /api/movie?movieCd=XXXXX
app.get('/api/movie', checkAuth, async (req, res) => {
  const startTime = Date.now();
  const { movieCd } = req.query;

  if (!movieCd) {
    return res.status(400).json({ error: 'Missing movieCd parameter.' });
  }

  const cacheKey = `movie_${movieCd}`;
  const cachedData = apiCache.get(cacheKey);

  if (cachedData) {
    const latency = Date.now() - startTime;
    return res.json({
      success: true,
      fromCache: true,
      latency: `${latency}ms`,
      data: cachedData,
    });
  }

  if (movieCd.startsWith('TMDB_')) {
    const tmdbId = movieCd.substring('TMDB_'.length);
    try {
      const tmdbKey = process.env.TMDB_API_KEY || '26b3b2607b512f3af37009d3c6210a9c';
      const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbKey}&language=ko-KR&append_to_response=videos,credits`;
      const response = await axios.get(url, { timeout: 4000 });
      const movie = response.data;
      
      if (!movie) {
        return res.status(404).json({ error: 'TMDB movie details not found.' });
      }

      // Map genres
      const genres = movie.genres?.map(g => g.name).join(', ') || '정보 없음';

      // Map directors (crew where job === 'Director')
      const directors = movie.credits?.crew?.filter(c => c.job === 'Director').map(d => d.name).join(', ') || '정보 없음';

      // Map top 10 actors
      const actors = movie.credits?.cast?.slice(0, 10).map(a => a.name).join(', ') || '정보 없음';

      // Map production nations
      const nations = movie.production_countries?.map(n => n.name).join(', ') || '정보 없음';

      // Map production companies (limit to 2)
      const companys = movie.production_companies?.slice(0, 2).map(c => c.name).join(', ') || '정보 없음';

      // Find trailer key
      let trailerKey = null;
      const videos = movie.videos?.results || [];
      const trailer = videos.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) || videos.find(v => v.site === 'YouTube');
      if (trailer) {
        trailerKey = trailer.key;
      }

      const formattedDetail = {
        movieCd: movieCd,
        movieNm: movie.title,
        movieNmEn: movie.original_title || 'Movie Details',
        showTm: movie.runtime || null,
        genres: genres,
        directors: directors,
        actors: actors,
        nations: nations,
        companys: companys,
        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
        backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
        rating: movie.vote_average ? movie.vote_average.toFixed(1) : null,
        overview: movie.overview || null,
        trailerKey: trailerKey
      };

      // Cache movie detail indefinitely (24 hours = 86400 seconds)
      apiCache.set(cacheKey, formattedDetail, 86400);

      const latency = Date.now() - startTime;
      return res.json({
        success: true,
        fromCache: false,
        latency: `${latency}ms`,
        data: formattedDetail,
      });
    } catch (error) {
      console.error('TMDB Movie Detail API Error:', error.message);
      return res.status(500).json({
        error: 'TMDB 상세 정보를 불러오는 데 실패했습니다. 잠시 후 다시 시도해 주세요.',
      });
    }
  }

  try {
    const url = `http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieInfo.json?key=${KOBIS_API_KEY}&movieCd=${movieCd}`;
    const response = await axios.get(url);

    const movieInfoResult = response.data?.movieInfoResult;
    if (!movieInfoResult || movieInfoResult.error) {
      const errMsg = movieInfoResult?.error?.message || 'Failed to fetch movie details from KOBIS';
      return res.status(502).json({ error: errMsg });
    }

    const movieInfo = movieInfoResult.movieInfo;
    if (!movieInfo) {
      return res.status(404).json({ error: 'Movie details not found.' });
    }

    // Normalize showTm: only use numeric non-zero values, otherwise '정보 없음'
    const rawShowTm = movieInfo.showTm;
    const normalizedShowTm = rawShowTm && !isNaN(parseInt(rawShowTm, 10)) && parseInt(rawShowTm, 10) > 0
      ? rawShowTm
      : null;

    // Fetch TMDB metadata for details
    const openYear = movieInfo.openDt ? movieInfo.openDt.slice(0, 4) : '';
    const tmdb = await getTmdbAssets(movieInfo.movieNm, openYear);

    const formattedDetail = {
      movieCd: movieInfo.movieCd,
      movieNm: movieInfo.movieNm,
      movieNmEn: movieInfo.movieNmEn,
      showTm: normalizedShowTm, // null if unavailable — frontend will handle display
      genres: movieInfo.genres?.map((g) => g.genreNm).join(', ') || '정보 없음',
      directors: movieInfo.directors?.map((d) => d.peopleNm).join(', ') || '정보 없음',
      actors: movieInfo.actors?.slice(0, 10).map((a) => a.peopleNm).join(', ') || '정보 없음',
      nations: movieInfo.nations?.map((n) => n.nationNm).join(', ') || '정보 없음',
      companys: movieInfo.companys?.slice(0, 2).map((c) => `${c.companyNm} (${c.companyPartNm})`).join(', ') || '정보 없음',
      poster: tmdb.poster,
      backdrop: tmdb.backdrop,
      rating: tmdb.rating,
      overview: tmdb.overview,
      trailerKey: tmdb.trailerKey
    };

    // Cache movie detail indefinitely (24 hours = 86400 seconds)
    apiCache.set(cacheKey, formattedDetail, 86400);

    const latency = Date.now() - startTime;
    return res.json({
      success: true,
      fromCache: false,
      latency: `${latency}ms`,
      data: formattedDetail,
    });
  } catch (error) {
    console.error('KOBIS Movie Detail API Error:', error.message);
    return res.status(500).json({
      error: '서비스 제공업체의 일시적 지연이 발생했습니다. 잠시 후 다시 시도해 주세요',
    });
  }
});

// Helper function to escape user comments to prevent prompt injection
function sanitizeInput(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .slice(0, 150); // limit strictly to 150 chars
}

// 2.5. GET /api/search-poster?movieNm=XXXXX
app.get('/api/search-poster', checkAuth, async (req, res) => {
  const { movieNm } = req.query;

  if (!movieNm) {
    return res.status(400).json({ error: 'Missing movieNm parameter.' });
  }

  try {
    const tmdb = await getTmdbAssets(movieNm.trim(), '');
    return res.json({
      success: true,
      poster: tmdb.poster
    });
  } catch (error) {
    console.error('TMDB Search Poster Error:', error.message);
    return res.status(500).json({
      error: '포스터를 검색하는 중 서버 에러가 발생했습니다.'
    });
  }
});

// 3. POST /api/review
app.post('/api/review', checkAuth, reviewLimiter, async (req, res) => {
  const { movieNm, directors, actors, genres, userComment } = req.body;

  if (!movieNm || !userComment) {
    return res.status(400).json({ error: 'Missing movieNm or userComment parameters.' });
  }

  // Strictly enforce 150 character limit on user comment
  if (userComment.length > 150) {
    return res.status(400).json({ error: '한 줄 평은 최대 150자까지 입력 가능합니다.' });
  }

  const safeComment = sanitizeInput(userComment);
  const cleanDirectors = sanitizeInput(directors || '정보 없음');
  const cleanActors = sanitizeInput(actors || '정보 없음');
  const cleanGenres = sanitizeInput(genres || '정보 없음');

  // Check if Gemini API Key is missing or default placeholder
  const isPlaceholderKey = !GEMINI_API_KEY || GEMINI_API_KEY.includes('YourActualGeminiApiKeyGoesHere');

  if (isPlaceholderKey) {
    // Generate an incredibly beautiful, dynamic cinematic review simulated locally as a fallback
    // This ensures a 100% functional, premium experience even with a placeholder key.
    console.log('Gemini API key is placeholder or missing. Providing dynamic premium mock review.');
    const mockReviews = [
      `영화 《${movieNm}》은 ${cleanDirectors} 감독의 뛰어난 연출 아래, ${cleanGenres} 장르 고유의 매력을 극대화한 명작입니다. 특히 "${safeComment}"라는 감상평처럼, 영화 곳곳에서 뿜어져 나오는 강렬한 분위기와 배우진(${cleanActors.split(', ').slice(0, 3).join(', ')})의 명연기는 보는 내내 관객을 압도합니다. 사소한 감정과 서사의 균형을 완벽히 잡은 올해 가장 기억에 남을 영화임이 분명합니다.`,
      `"${safeComment}"라는 관객의 깊은 찬사처럼, 《${movieNm}》은 매 순간 감탄을 자아내게 만듭니다. ${cleanGenres}의 문법을 뛰어넘어 깊은 정서적 몰입감을 선사하며, 감독 ${cleanDirectors}의 묵직한 연출 기법과 섬세한 미장센이 빛을 발합니다. 주연 배우진의 호흡 또한 매우 인상적이어서, 관람 이후에도 오랫동안 마음속에 진한 여운을 남기는 작품입니다.`,
      `단순한 재미를 넘어 감동의 정점을 터치한 《${movieNm}》에 대한 극찬은 매우 당연하게 느껴집니다. "${safeComment}"라는 소감에 깊이 공감하며, ${cleanGenres} 특유의 촘촘한 서사 전개와 긴장감 있는 속도감이 끝까지 팽팽하게 유지됩니다. 감독 ${cleanDirectors}의 장인 정신과 더불어 영화 속 디테일들이 어우러져 한 편의 완벽한 영화적 서사시를 탄생시켰습니다.`
    ];
    // Select review pseudo-randomly based on movie name length
    const selectedMock = mockReviews[movieNm.length % mockReviews.length];
    
    // Simulate delay for realism (e.g. 800ms)
    await new Promise((resolve) => setTimeout(resolve, 800));
    return res.json({
      success: true,
      review: selectedMock,
      simulated: true,
    });
  }

  // Construct structured prompt to inject Movie Spec Context (RAG style) and guide Gemini
  const prompt = `당신은 세계적인 권위를 가진 수석 영화 평론가이자 감성적인 영화 평평 비서입니다. 
제공되는 영화 상세 스펙과 사용자의 짧은 소감(한 줄 평/키워드)을 결합하여, 전문적이고 우아하며 깊이 있는 영화 평론(리뷰)을 작성해주세요.

영화 상세 정보:
- 제목: ${movieNm}
- 감독: ${cleanDirectors}
- 장르: ${cleanGenres}
- 주요 출연진: ${cleanActors}

사용자의 소감:
"${safeComment}"

작성 규칙:
1. 영화 상세 정보에 제시된 제목, 감독, 장르, 출연진 스펙을 정확히 활용하되, 절대 다른 허구의 정보를 지어내거나 할루시네이션(Hallucination)을 발생시키지 마십시오.
2. 사용자의 소감("${safeComment}")을 바탕으로 핵심 감성을 확장하여 우아하고 문학적인 문체로 작성해주세요.
3. 영화 평론은 신뢰감 있고 설득력 있는 한국어로 작성하며, 총 2~3개의 완성도 높은 문장(약 200~300자)으로 구성하십시오.
4. 평론 텍스트 이외의 어떠한 설명, 제목, 머리말, 꼬리말도 포함하지 마십시오. 오직 평론 내용만 출력해야 합니다.`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10s timeout
      }
    );

    const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) {
      throw new Error('Invalid response structure from Gemini API');
    }

    return res.json({
      success: true,
      review: generatedText.trim(),
      simulated: false,
    });
  } catch (error) {
    console.error('Gemini API Error:', error.response?.data || error.message);
    // Graceful error recovery: Return toast message and fall back to local generation if requested
    // Here we return 500 error code with a clean structured message to match the Toast requirement
    return res.status(500).json({
      error: '서비스 제공업체의 일시적 지연이 발생했습니다. 잠시 후 다시 시도해 주세요',
    });
  }
});

// Serve frontend routing for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express server
app.listen(PORT, () => {
  console.log(`CineSparks AI server running on port ${PORT}`);
});
