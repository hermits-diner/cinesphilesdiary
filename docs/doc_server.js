const fs = require('fs');
const path = require('path');
const http = require('http');
const { marked } = require('marked');

const PORT = 4000;
const BASE_URL_PATH = '/cinesparks-ai';

// Custom renderer for marked to add custom styles to elements
const renderer = new marked.Renderer();

// Customize blockquote rendering to map standard markdown blockquotes to premium alert banners
renderer.blockquote = (quote) => {
  // Strip <p> tags if present in quote to prevent nesting issues
  let cleanQuote = quote;
  if (typeof quote === 'object' && quote.tokens) {
    // If quote is a token object
    cleanQuote = quote.text || '';
  } else if (typeof quote === 'string') {
    cleanQuote = quote.replace(/<\/?p>/g, '').trim();
  }

  // Detect icons or prefixes
  let title = 'INFORMATION';
  let themeClass = 'info-banner';
  let iconClass = 'fa-solid fa-circle-info';

  if (cleanQuote.includes('최적') || cleanQuote.includes('시너지')) {
    title = 'SYSTEM SYNERGY';
    themeClass = 'synergy-banner';
    iconClass = 'fa-solid fa-wand-magic-sparkles';
  }

  return `
    <div class="doc-banner ${themeClass}">
      <div class="banner-header">
        <i class="${iconClass}"></i>
        <span>${title}</span>
      </div>
      <div class="banner-body">${cleanQuote}</div>
    </div>
  `;
};

marked.setOptions({
  renderer: renderer,
  gfm: true,
  breaks: true
});

const server = http.createServer((req, res) => {
  const reqUrl = req.url || '';
  
  // Redirect root and base without slash to /cinesparks-ai/
  if (reqUrl === '/' || reqUrl === BASE_URL_PATH) {
    res.writeHead(301, { 'Location': `${BASE_URL_PATH}/` });
    res.end();
    return;
  }
  
  // Only handle paths starting with /cinesparks-ai/
  if (reqUrl.startsWith(`${BASE_URL_PATH}/`)) {
    const subPath = reqUrl.substring(`${BASE_URL_PATH}/`.length);
    
    // Serve index page
    if (subPath === '' || subPath === 'index.html') {
      try {
        const mdPath = path.join(__dirname, 'index.md');
        let markdownContent = fs.readFileSync(mdPath, 'utf8');
        
        // Strip Jekyll Front Matter (--- layout: default ... ---)
        const frontMatterMatch = markdownContent.match(/^---([\s\S]*?)---/);
        if (frontMatterMatch) {
          markdownContent = markdownContent.substring(frontMatterMatch[0].length).trim();
        }
        
        const htmlContent = marked.parse(markdownContent);
        
        const pageHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CineSparks AI 공식 문서 포털</title>
  
  <!-- Premium Fonts & Icons -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  
  <style>
    :root {
      --color-bg-dark: #0a0b10;
      --color-bg-card: rgba(18, 20, 32, 0.65);
      --color-primary: #6366f1;
      --color-secondary: #10b981;
      --color-accent: #f43f5e;
      --color-text-main: #f3f4f6;
      --color-text-muted: #9ca3af;
      --border-glow: rgba(255, 255, 255, 0.04);
      --gradient-neon: linear-gradient(135deg, #10b981 0%, #059669 100%);
      --gradient-primary: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      --gradient-dark: linear-gradient(135deg, #0a0b10 0%, #121420 100%);
      --shadow-premium: 0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 50px rgba(99, 102, 241, 0.03);
      --transition-smooth: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background: var(--color-bg-dark);
      background-image: var(--gradient-dark);
      color: var(--color-text-main);
      font-family: 'Inter', 'Noto Sans KR', sans-serif;
      line-height: 1.6;
      min-height: 100vh;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 1rem 4rem 1rem;
    }

    /* Ambient Decorative Glows */
    body::before {
      content: '';
      position: absolute;
      top: -150px;
      left: 50%;
      transform: translateX(-50%);
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0) 70%);
      pointer-events: none;
      z-index: 0;
    }

    .doc-container {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 900px;
      background: var(--color-bg-card);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border-glow);
      border-radius: 24px;
      box-shadow: var(--shadow-premium);
      padding: 3rem 2.5rem;
      animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Elegant Header Toolbar */
    .doc-header-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding-bottom: 1.25rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      text-decoration: none;
    }

    .brand-logo {
      font-size: 1.5rem;
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .brand-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.25rem;
      font-weight: 800;
      color: #fff;
    }

    .brand-title span {
      background: var(--gradient-neon);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .nav-btn {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border-glow);
      color: var(--color-text-main);
      padding: 0.5rem 1.15rem;
      border-radius: 50px;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: var(--transition-smooth);
    }

    .nav-btn:hover {
      background: var(--gradient-primary);
      border-color: var(--color-primary);
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.25);
    }

    /* Markdown Document Styles */
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 2.5rem;
      font-weight: 900;
      letter-spacing: -0.02em;
      margin-bottom: 0.5rem;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    h1 span {
      font-weight: 400;
      color: var(--color-text-muted);
    }

    /* Subtitle blockquote conversion style */
    .doc-banner {
      background: rgba(255, 255, 255, 0.015);
      border: 1px solid var(--border-glow);
      border-left: 4px solid var(--color-primary);
      border-radius: 16px;
      padding: 1.25rem 1.5rem;
      margin: 1.5rem 0 2.5rem 0;
      box-shadow: 0 10px 25px -10px rgba(0,0,0,0.5);
    }

    .info-banner {
      border-left-color: var(--color-primary);
      background: rgba(99, 102, 241, 0.02);
    }

    .synergy-banner {
      border-left-color: var(--color-secondary);
      background: rgba(16, 185, 129, 0.02);
      box-shadow: 0 10px 25px -10px rgba(16, 185, 129, 0.05);
    }

    .banner-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: 'Outfit', sans-serif;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.15em;
      color: var(--color-text-muted);
      margin-bottom: 0.35rem;
    }

    .info-banner .banner-header i { color: var(--color-primary); }
    .synergy-banner .banner-header i { color: var(--color-secondary); }

    .banner-body {
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--color-text-main);
      line-height: 1.6;
    }

    h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.45rem;
      font-weight: 800;
      color: #fff;
      margin: 2.5rem 0 1.25rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    p {
      font-size: 0.95rem;
      color: var(--color-text-muted);
      margin-bottom: 1.5rem;
      line-height: 1.7;
    }

    /* List styling */
    ul, ol {
      margin-bottom: 1.75rem;
      padding-left: 1.5rem;
    }

    li {
      font-size: 0.92rem;
      color: var(--color-text-muted);
      margin-bottom: 0.5rem;
      line-height: 1.6;
    }

    li strong {
      color: #fff;
      font-weight: 600;
    }

    /* Inline elements */
    a {
      color: var(--color-secondary);
      text-decoration: none;
      font-weight: 500;
      transition: var(--transition-smooth);
    }

    a:hover {
      color: #fff;
      text-decoration: underline;
    }

    code {
      font-family: 'Courier New', Courier, monospace;
      background: rgba(255, 255, 255, 0.05);
      color: var(--color-accent);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 600;
      border: 1px solid rgba(255, 255, 255, 0.02);
    }

    /* Fenced code block */
    pre {
      background: rgba(10, 11, 16, 0.8);
      border: 1px solid var(--border-glow);
      border-radius: 16px;
      padding: 1.25rem 1.5rem;
      overflow-x: auto;
      margin: 1.25rem 0 1.75rem 0;
      box-shadow: inset 0 2px 10px rgba(0,0,0,0.8);
    }

    pre code {
      background: transparent;
      color: #34d399;
      border: none;
      padding: 0;
      font-size: 0.85rem;
      font-weight: 400;
    }

    /* Divider */
    hr {
      border: none;
      border-top: 1px dashed rgba(255, 255, 255, 0.08);
      margin: 2.25rem 0;
    }

    /* Fine Footer styling */
    .doc-footer {
      text-align: center;
      margin-top: 2rem;
      font-size: 0.72rem;
      color: var(--color-text-muted);
      font-family: 'Outfit', sans-serif;
      letter-spacing: 0.05em;
    }

    @media (max-width: 768px) {
      .doc-container {
        padding: 2rem 1.5rem;
      }
      h1 {
        font-size: 2rem;
      }
    }
  </style>
</head>
<body>

  <div class="doc-container">
    <!-- Header Navigation bar -->
    <div class="doc-header-nav">
      <a href="${BASE_URL_PATH}/" class="brand-wrap">
        <i class="fa-solid fa-wand-magic-sparkles brand-logo"></i>
        <span class="brand-title">CineSpark <span>Docs</span></span>
      </a>
      
      <a href="http://localhost:5001" target="_blank" class="nav-btn">
        <i class="fa-solid fa-house"></i>
        <span>포털로 바로가기</span>
      </a>
    </div>

    <!-- Rendered Markdown Body -->
    <div class="markdown-body">
      ${htmlContent}
    </div>
  </div>

  <div class="doc-footer">
    Premium Docs Portal • Powered by CineSparks AI Web Synergy
  </div>

</body>
</html>`;
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(pageHtml);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Internal Server Error: ${err.message}`);
      }
      return;
    }
  }
  
  // Default 404 page
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Page Not Found');
});

server.listen(PORT, () => {
  console.log(`CineSparks Docs Server running at http://localhost:${PORT}${BASE_URL_PATH}/`);
});
