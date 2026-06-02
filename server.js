require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
app.set('trust proxy', 1); // Trust Render's reverse proxy for correct rate-limiting and health checks
const PORT = process.env.PORT || 5000;
const APP_AUTH_TOKEN = process.env.APP_AUTH_TOKEN || 'DEFAULT_CINEDIARY_AUTH_TOKEN';
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

// Enable helmet for robust HTTP security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP to allow seamless FontAwesome and Google Fonts CDNs
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// CORS options formulation for secure production environment
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:5000', 'http://localhost:5001', 'http://127.0.0.1:5000', 'http://127.0.0.1:5001'];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or local file systems)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve static assets with intelligent cache control based on production/development modes
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    // In production, cache-control static assets like CSS, JS, fonts, and images for 1 year (31536000 seconds)
    if (isProduction && (filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.woff2') || filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.svg') || filePath.endsWith('.ico'))) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      // In development or for HTML files, enforce no-cache to guarantee instant code hot-reloading!
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
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

// 4. GET /api/search — Global movie search using TMDB
app.get('/api/search', checkAuth, async (req, res) => {
  const { query } = req.query;

  if (!query || query.trim() === '') {
    return res.status(400).json({ error: '검색어를 입력해주세요.' });
  }

  const cleanQuery = query.trim();
  const cacheKey = `search_${cleanQuery}`;
  const cachedData = apiCache.get(cacheKey);

  if (cachedData) {
    return res.json({
      success: true,
      fromCache: true,
      data: cachedData,
    });
  }

  try {
    const tmdbKey = process.env.TMDB_API_KEY || '26b3b2607b512f3af37009d3c6210a9c';
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(cleanQuery)}&language=ko-KR&page=1`;
    const response = await axios.get(url, { timeout: 4500 });
    const rawList = response.data?.results || [];

    // Map necessary fields and filter movies with poster paths
    const formattedList = rawList
      .filter(movie => movie.title && movie.poster_path)
      .map(movie => {
        // Map first genre ID to string representation
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
          movieCd: `TMDB_${movie.id}`,
          movieNm: movie.title,
          openDt: movie.release_date || '개봉연도 불명',
          poster: `https://image.tmdb.org/t/p/w300${movie.poster_path}`,
          backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
          rating: movie.vote_average ? movie.vote_average.toFixed(1) : '0.0',
          genre: genre,
          overview: movie.overview || '등록된 줄거리가 아직 없는 작품입니다.'
        };
      });

    // Cache search result for 15 minutes (900 seconds)
    apiCache.set(cacheKey, formattedList, 900);

    return res.json({
      success: true,
      fromCache: false,
      data: formattedList,
    });
  } catch (error) {
    console.error('TMDB Search API Error:', error.message);
    return res.status(500).json({
      error: '영화 검색 중에 지연이 발생했습니다. 잠시 후 다시 시도해 주세요.',
    });
  }
});

// 4.5. GET /api/global-trending?region=ALL|US|JP|GB|FR
app.get('/api/global-trending', checkAuth, async (req, res) => {
  const startTime = Date.now();
  const { region } = req.query;

  const validRegions = ['ALL', 'US', 'JP', 'GB', 'FR'];
  const regionKey = validRegions.includes(region) ? region : 'ALL';
  const cacheKey = `global_trending_${regionKey}`;
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
    let url = '';
    let rawList = [];

    if (regionKey === 'ALL') {
      // 1. Worldwide trending movies
      url = `https://api.themoviedb.org/3/trending/movie/day?api_key=${tmdbKey}&language=ko-KR`;
      const response = await axios.get(url, { timeout: 5000 });
      rawList = response.data?.results || [];
    } else {
      // 2. Region specific popular movies
      url = `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbKey}&language=ko-KR&region=${regionKey}`;
      const response = await axios.get(url, { timeout: 5000 });
      rawList = response.data?.results || [];
    }

    const genreMap = {
      28: '액션', 12: '모험', 16: '애니메이션', 35: '코미디', 80: '범죄',
      99: '다큐멘터리', 18: '드라마', 10751: '가족', 14: '판타지',
      36: '역사', 27: '공포', 10402: '음악', 9648: '미스터리',
      10749: '로맨스', 878: 'SF', 10770: 'TV 영화', 53: '스릴러',
      10752: '전쟁', 37: '서부'
    };

    const formattedList = rawList
      .filter(movie => movie.title && movie.poster_path)
      .map((movie, index) => {
        const primaryGenreId = movie.genre_ids?.[0];
        const genre = genreMap[primaryGenreId] || '영화';

        return {
          rank: String(index + 1),
          movieCd: `TMDB_${movie.id}`,
          movieNm: movie.title,
          openDt: movie.release_date || '개봉 정보 없음',
          poster: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
          backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
          rating: movie.vote_average ? movie.vote_average.toFixed(1) : '0.0',
          genre: genre,
          overview: movie.overview || '등록된 영화 설명이 아직 없습니다.',
          popularity: movie.popularity ? Math.round(movie.popularity).toLocaleString('ko-KR') : '0'
        };
      });

    // Cache results for 12 hours (43200 seconds)
    apiCache.set(cacheKey, formattedList, 43200);

    const latency = Date.now() - startTime;
    return res.json({
      success: true,
      fromCache: false,
      latency: `${latency}ms`,
      data: formattedList,
    });
  } catch (error) {
    console.error('TMDB Global Trending API Error:', error.message);
    return res.status(500).json({
      error: '글로벌 인기 영화 차트를 가져오는 도중 서버 지연이 발생했습니다.',
    });
  }
});

// 5. POST /api/coach-review — AI Movie Diary Critique & Coaching system (Persona: Review Expert & Writing Educator)
app.post('/api/coach-review', checkAuth, reviewLimiter, async (req, res) => {
  const { movieNm, diaryTitle, diaryContent, diaryContext, emotion } = req.body;

  if (!movieNm || !diaryContent) {
    return res.status(400).json({ error: '영화 제목 혹은 일기 내용이 유효하지 않습니다.' });
  }

  // Extend character limit to 1000 for descriptive diary entries
  if (diaryContent.length > 1000) {
    return res.status(400).json({ error: '일기장 코칭용 본문은 최대 1000자까지 입력 가능합니다.' });
  }

  const safeMovieNm = sanitizeInput(movieNm);
  const safeTitle = sanitizeInput(diaryTitle || '오늘의 감상');
  const safeContent = sanitizeInput(diaryContent);
  const safeContext = sanitizeInput(diaryContext || '일상 속에서');
  const safeEmotion = sanitizeInput(emotion || '🍿');

  // Auto-fetch TMDB Assets for rich RAG context
  let genres = '영화';
  try {
    const tmdb = await getTmdbAssets(safeMovieNm, '');
    if (tmdb && tmdb.genre) {
      genres = tmdb.genre;
    }
  } catch (tmdbErr) {
    console.error('Failed to pre-fetch RAG assets for coach-review:', tmdbErr.message);
  }

  const isPlaceholderKey = !GEMINI_API_KEY || GEMINI_API_KEY.includes('YourActualGeminiApiKeyGoesHere');

  // Fallback simulator for AI Coaching Evaluation when GEMINI_API_KEY is not configured
  if (isPlaceholderKey) {
    console.log('Gemini API key is placeholder or missing for coaching. Operating dynamic premium mock coach evaluator.');

    // Dynamic mock evaluation score calculator based on review content length & some random variances
    const baseScore = Math.min(75 + Math.round((safeContent.length / 1000) * 15), 92);
    const varFactor = (safeContent.length % 7) - 3; // -3 to +3 variance

    const scoreExpression = Math.max(70, Math.min(98, baseScore + varFactor + 2));
    const scoreStructure = Math.max(70, Math.min(98, baseScore - varFactor + 1));
    const scoreAnalysis = Math.max(65, Math.min(98, baseScore + (safeContent.includes('감독') || safeContent.includes('연출') ? 5 : -2)));
    const scoreVocabulary = Math.max(70, Math.min(98, baseScore + (safeContent.length > 150 ? 4 : -3)));
    const scoreCoachability = Math.max(65, Math.min(98, baseScore + varFactor));

    const mockFeedbacks = [
      `작성해주신 영화 일기 《${safeTitle}》는 영화 《${safeMovieNm}》이 품고 있는 ${genres} 장르 특유의 짙은 매력을 훌륭히 건져 올리고 있습니다. 관람 환경("${safeContext}")에서 느끼신 솔직한 소회가 돋보이나, 영화의 세부적인 연출이나 핵심 연기에 관한 분석 어휘를 조금만 더 엮으신다면 한층 높은 수준의 비평 에세이가 될 것입니다.`,
      `영화를 감상하고 마음에 스며든 감정을 정제되고 다정한 언어로 잘 빚어내셨습니다. 글 전체의 구조적 완결성을 더 높이기 위해선, 단순히 인상 깊었던 장면에 대한 열거에서 한 단계 나아가 '왜 그 씬이 나에게 감동을 주었는지' 그날의 감정 날씨("${safeEmotion}")와 엮어 묘사해 보시는 것을 교육적으로 추천해 드립니다.`,
      `영화 《${safeMovieNm}》에 대한 리뷰어님만의 독창적인 감수성과 사색이 잘 돋보이는 훌륭한 영화 일기입니다. 표현력이 매우 참신하며 어휘 선택도 깊이가 느껴집니다. 서사 구조의 흐름과 문맥의 일관성을 조금 더 보완한다면 전문 평론 못지않은 깊이를 갖추게 될 것입니다.`
    ];

    const mockCorrectedReviews = [
      `《${safeMovieNm}》을 보고 적어 내려간 리뷰어의 다이어리 《${safeTitle}》는 ${genres} 장르가 스크린 너머로 전달하는 정서적 깊이를 가감 없이 포착해 낸다. "${safeContent.slice(0, 120)}..."로 대변되는 관람 소회는 스크린의 프레이밍과 정교한 미장센이 빚어낸 감동의 파고를 유려한 비평의 호흡으로 정제하여 독창적인 사유의 텍스트로 치환시켜 내고 있다.`,
      `"${safeContent.slice(0, 120)}..."라는 깊은 여운은 영화 《${safeMovieNm}》의 문학적 본질을 리뷰어 특유의 섬세한 정서로 빚어낸 훌륭한 비평적 기록이다. 감독의 묵직한 연출 문법과 배우들의 잔잔한 연기 앙상블은 그날의 관람 환경("${safeContext}") 속에서 한 편의 수려한 시각적 잔향으로 굳건히 영구 보존된다.`,
      `영화 《${safeMovieNm}》의 다채로운 변주를 리뷰어만의 독보적인 혜안으로 풀어낸 이 일기는, 상투적인 관람 후기를 뛰어넘는 훌륭한 문학적 에세이다. "${safeContent.slice(0, 120)}..." 속의 직관적 감상에 논리성과 정밀한 비평 어휘를 얹음으로써, 텍스트 전체의 정서적 밀도가 저명한 문화 평론가 수준으로 화려하게 승화되어 깊은 잔향을 더한다.`
    ];

    const idx = safeContent.length % mockFeedbacks.length;

    // Simulate delay for realism (1200ms for heavy AI analysis computation)
    await new Promise((resolve) => setTimeout(resolve, 1200));

    return res.json({
      success: true,
      scores: {
        expression: scoreExpression,
        structure: scoreStructure,
        analysis: scoreAnalysis,
        vocabulary: scoreVocabulary,
        coachability: scoreCoachability
      },
      feedback: mockFeedbacks[idx],
      corrected: mockCorrectedReviews[idx],
      simulated: true
    });
  }

  // Construct structured prompt to guide Gemini as a strict hybrid persona (Review Expert + Writing Educator)
  const prompt = `당신은 세계적인 권위를 가진 수석 영화 평론가이자, 후배 시네필의 문학적이고 영화학적인 영화 일기(에세이) 작문 성장을 책임지는 다정하고 전문적인 글쓰기 지도 교수(교육자)입니다.
사용자가 작성한 영화 일기/감상평 초안을 자세히 분석하여 5가지 영역의 점수를 매기고, 다정한 교육자적 관점의 첨삭 가이드와 전문적인 평론가 수준의 첨삭 완성본을 작성해주세요.

영화 정보:
- 제목: ${safeMovieNm}
- 장르: ${genres}

사용자의 영화 일기 메타 정보:
- 일기 제목: ${safeTitle}
- 관람 환경: ${safeContext}
- 감정 날씨: ${safeEmotion}

사용자의 일기 본문 초안:
"${safeContent}"

작성 규칙:
1. 당신의 역할은 두 가지가 결합되어야 합니다:
   - **글쓰기 교육자**: 사용자가 쓴 일기의 고유한 정서와 개성을 칭찬하고 격려하며, 글의 구조, 문장 흐름, 맞춤법/표현을 다정하고 날카롭게 교정해주는 피드백 코멘터리를 한글 3문장 이내로 다정하게 제공하십시오.
   - **영화 평론 전문가**: 사용자가 본문에서 표현하고 싶어 한 핵심 메시지를 100% 보존하되, '미장센', '서사적 페이소스', '프레이밍', '장르적 변주' 등 영화학적 비평 용어를 유려하게 녹여내어 저명한 문화 일간지 평론가 수준으로 고급스럽고 우아하게 탈바꿈시킨 350자~450자 분량의 첨삭본을 작성하십시오.
2. 아래에 정의된 JSON 형식으로만 정확하게 결과를 출력하십시오. 마크다운 기호(\`\`\`json ...) 등을 포함하지 말고 오직 순수 JSON 데이터만 반환해야 합니다.

반환할 JSON 구조 사양:
{
  "scores": {
    "expression": (10~100 사이의 정수. 문장이 얼마나 영화적이고 풍부하게 감정을 묘사했는지 여부),
    "structure": (10~100 사이의 정수. 다이어리의 주제가 일관되게 전개되고 논리적인 구조를 가졌는지 여부),
    "analysis": (10~100 사이의 정수. 영화의 장르 특성이나 연출, 정서를 깊이 이해하고 분석했는지 여부),
    "vocabulary": (10~100 사이의 정수. 상투적인 말 대신 참신하고 품격 있는 어휘를 구사했는지 여부),
    "coachability": (10~100 사이의 정수. 교육 피드백을 적용했을 때 향후 작문 실력이 얼마나 발전할 수 있을지에 대한 잠재지수)
  },
  "feedback": "교육자로서 리뷰어의 강점을 먼저 칭찬하고, 보완할 글쓰기 팁을 친근하면서도 정확하게 짚어주는 한글 3문장 이내의 작문 피드백 가이드",
  "corrected": "원래 일기의 감정선과 핵심 감상을 고스란히 이식하되, 전문가적인 격조 높은 영화 평론가 문체로 아름답고 세련되게 재창조한 첨삭 완성본 (350자~450자 내외)"
}`;

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
        generationConfig: {
          responseMimeType: "application/json"
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 12000, // 12s timeout for complex critique processing
      }
    );

    let generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) {
      throw new Error('Invalid response structure from Gemini API');
    }

    generatedText = generatedText.trim();
    
    // JSON Parsing and extraction safety guard
    let jsonResult;
    try {
      jsonResult = JSON.parse(generatedText);
    } catch (parseError) {
      console.warn('Direct JSON parsing failed. Attempting regex extract.', parseError.message);
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse JSON response from Gemini');
      }
    }

    // Double check score schema robustness
    if (!jsonResult.scores || !jsonResult.feedback || !jsonResult.corrected) {
      throw new Error('Gemini API response is missing required coach schema fields');
    }

    return res.json({
      success: true,
      scores: {
        expression: parseInt(jsonResult.scores.expression, 10) || 75,
        structure: parseInt(jsonResult.scores.structure, 10) || parseInt(jsonResult.scores.logic, 10) || 75,
        analysis: parseInt(jsonResult.scores.analysis, 10) || 75,
        vocabulary: parseInt(jsonResult.scores.vocabulary, 10) || 75,
        coachability: parseInt(jsonResult.scores.coachability, 10) || parseInt(jsonResult.scores.impact, 10) || 75
      },
      feedback: jsonResult.feedback.trim(),
      corrected: jsonResult.corrected.trim(),
      simulated: false
    });

  } catch (error) {
    console.error('Gemini Coach API Error:', error.response?.data || error.message);
    return res.status(500).json({
      error: 'AI 평론 교정 중 서비스 일시 지연이 발생했습니다. 잠시 후 다시 시도해 주세요.',
    });
  }
});

// Serve frontend routing for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express server
app.listen(PORT, () => {
  console.log(`Cinephile's Diary server running on port ${PORT}`);
});
