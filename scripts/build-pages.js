#!/usr/bin/env node

/**
 * CosyUI GitHub Pages Multi-Branch Deployment Builder
 *
 * This script builds the GitHub Pages static distribution directory (_site):
 * 1. Exports the 'main' branch to the root index of the site.
 * 2. Exports every other branch (e.g. 'Enhancement') to its own subpage (/branch-name/).
 * 3. Generates a standalone branches portal (branches.html and branches/index.html).
 * 4. Injects a clean zero-dependency branch switcher widget into all deployed pages.
 * 5. Generates a machine-readable branches.json manifest.
 *
 * Zero external npm dependencies. Standard Node.js runtime only.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.resolve(REPO_ROOT, process.argv[2] || '_site');
const REPO_URL = 'https://github.com/someonenameguy/CosyUI';

function runGit(cmd) {
  try {
    return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch (err) {
    return '';
  }
}

function getBranchInfo(refName, cleanName, isMain) {
  // Format: short_sha, full_sha, author, iso_date, relative_date, subject
  const log = runGit(`git log -1 --format="%h%x09%H%x09%an%x09%cI%x09%cr%x09%s" "${refName}"`);
  if (!log) {
    return {
      name: cleanName,
      ref: refName,
      isMain,
      sha: 'unknown',
      fullSha: '',
      author: 'Unknown',
      date: new Date().toISOString(),
      relativeDate: 'recently',
      message: 'No commit details available'
    };
  }

  const [sha, fullSha, author, date, relativeDate, message] = log.split('\t');
  return {
    name: cleanName,
    ref: refName,
    isMain,
    sha: sha || 'unknown',
    fullSha: fullSha || '',
    author: author || 'Unknown',
    date: date || new Date().toISOString(),
    relativeDate: relativeDate || 'recently',
    message: message || ''
  };
}

function discoverBranches() {
  // Find all remote and local branches
  const rawBranches = runGit('git branch -a --format="%(refname:short)"')
    .split('\n')
    .map(b => b.trim())
    .filter(Boolean);

  const branchMap = new Map();

  for (const b of rawBranches) {
    // Filter out symbolic HEAD refs
    if (b.includes('HEAD')) continue;
    if (b.includes('gh-pages')) continue;

    let cleanName = b;
    if (cleanName.startsWith('origin/')) {
      cleanName = cleanName.replace('origin/', '');
    }

    if (!cleanName || cleanName === 'origin' || cleanName === 'HEAD') continue;

    // Verify ref exists in git
    if (!runGit(`git rev-parse --verify "${b}"`)) continue;

    if (cleanName === 'main' || cleanName === 'master') {
      if (!branchMap.has('main') || b === 'main') {
        branchMap.set('main', { ref: b, name: 'main', isMain: true });
      }
    } else {
      if (!branchMap.has(cleanName) || b.startsWith('origin/')) {
        branchMap.set(cleanName, { ref: b, name: cleanName, isMain: false });
      }
    }
  }

  // Ensure 'main' is present
  if (!branchMap.has('main')) {
    branchMap.set('main', { ref: 'main', name: 'main', isMain: true });
  }

  // Ensure 'Enhancement' is present if known
  if (!branchMap.has('Enhancement')) {
    const hasEnhancement = runGit('git rev-parse --verify origin/Enhancement || git rev-parse --verify Enhancement');
    if (hasEnhancement) {
      branchMap.set('Enhancement', { ref: 'Enhancement', name: 'Enhancement', isMain: false });
    }
  }

  const branches = [];
  for (const [name, info] of branchMap.entries()) {
    branches.push(getBranchInfo(info.ref, info.name, info.isMain));
  }

  // Sort so main is always first, followed by other branches alphabetically
  branches.sort((a, b) => {
    if (a.isMain) return -1;
    if (b.isMain) return 1;
    return a.name.localeCompare(b.name);
  });

  return branches;
}

function extractBranchFiles(ref, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  try {
    execSync(`git archive "${ref}" | tar -x -C "${targetDir}"`, { cwd: REPO_ROOT, stdio: 'inherit' });
  } catch (err) {
    console.error(`Error archiving ref ${ref}:`, err.message);
    // Fallback: If extracting main and running in working tree, copy local files
    if (ref === 'main' || ref === 'origin/main') {
      copyDirectoryRecursive(REPO_ROOT, targetDir, ['.git', '_site', 'node_modules']);
    }
  }
}

function copyDirectoryRecursive(src, dest, ignoreList = []) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    if (ignoreList.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath, ignoreList);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function injectSwitcher(htmlFilePath, currentBranch, isMain, depth, branches) {
  if (!fs.existsSync(htmlFilePath)) return;

  let content = fs.readFileSync(htmlFilePath, 'utf8');

  // Compute relative path to root: depth 0 = "./", depth 1 = "../", depth 2 = "../../"
  const rootPrefix = depth === 0 ? './' : '../'.repeat(depth);
  const switcherAssetsPrefix = `${rootPrefix}branch-switcher/`;

  // Compute paths for each branch relative to this file's directory
  const branchListForSwitcher = branches.map(b => {
    let relPath = '';
    if (b.isMain) {
      relPath = rootPrefix;
    } else {
      relPath = `${rootPrefix}${b.name}/`;
    }
    return {
      name: b.name,
      isMain: b.isMain,
      path: relPath,
      commit: b.sha,
      message: b.message,
      relativeDate: b.relativeDate
    };
  });

  const switcherConfig = {
    currentBranch,
    isMain,
    basePath: rootPrefix,
    repoUrl: REPO_URL,
    branches: branchListForSwitcher
  };

  const injectionHtml = `
  <!-- CosyUI Branch Switcher & Sub-page Navigation -->
  <link rel="stylesheet" href="${switcherAssetsPrefix}branch-switcher.css">
  <script id="cosy-branch-data" type="application/json">
  ${JSON.stringify(switcherConfig, null, 2)}
  </script>
  <script src="${switcherAssetsPrefix}branch-switcher.js"></script>
`;

  // Inject before </body> if present, otherwise append
  if (content.includes('</body>')) {
    content = content.replace('</body>', `${injectionHtml}\n</body>`);
  } else {
    content += injectionHtml;
  }

  fs.writeFileSync(htmlFilePath, content, 'utf8');
}

function generateBranchesPortal(branches) {
  const mainBranch = branches.find(b => b.isMain) || branches[0];
  const subBranches = branches.filter(b => !b.isMain);

  const branchCardsHtml = branches.map(b => {
    const isMain = b.isMain;
    const targetUrl = isMain ? './' : `./${b.name}/`;
    const ghBranchUrl = `${REPO_URL}/tree/${b.name}`;
    const badgeHtml = isMain
      ? `<span class="badge badge-main">Default Index</span>`
      : `<span class="badge badge-sub">Branch Sub-page</span>`;

    return `
      <div class="branch-card ${isMain ? 'card-main' : ''}" data-branch-name="${escapeHtml(b.name)}">
        <div class="card-header">
          <div class="card-title-group">
            <span class="card-icon">${isMain ? '🏠' : '🌿'}</span>
            <h3 class="card-title">${escapeHtml(b.name)}</h3>
          </div>
          ${badgeHtml}
        </div>

        <p class="card-message" title="${escapeHtml(b.message)}">${escapeHtml(b.message || 'No commit message')}</p>

        <div class="card-meta">
          <div class="meta-item">
            <span class="meta-label">Author</span>
            <span class="meta-val">${escapeHtml(b.author)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Commit</span>
            <code class="meta-sha">${escapeHtml(b.sha)}</code>
          </div>
          <div class="meta-item">
            <span class="meta-label">Updated</span>
            <span class="meta-val">${escapeHtml(b.relativeDate)}</span>
          </div>
        </div>

        <div class="card-actions">
          <a href="${escapeHtml(targetUrl)}" class="btn btn-primary">
            <span>${isMain ? '⚡ Open Main Index' : '🚀 Open Sub-page'}</span>
          </a>
          <a href="${escapeHtml(ghBranchUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
            <span>View on GitHub ↗</span>
          </a>
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CosyUI - Branch Deployments & Sub-pages</title>
  <meta name="description" content="GitHub Pages deployments directory for CosyUI branches. Main is index and other branches are sub-pages.">
  <style>
    :root {
      --bg-base: #11131a;
      --bg-surface: #181b26;
      --bg-card: #202434;
      --bg-card-hover: #262c3e;
      --border: #2d3348;
      --border-light: #3d4663;
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --accent: #8b5cf6;
      --accent-glow: rgba(139, 92, 246, 0.3);
      --accent-secondary: #6366f1;
      --green: #22c55e;
      --green-glow: rgba(34, 197, 94, 0.25);
      --cyan: #38bdf8;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --radius: 10px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg-base);
      color: var(--text-main);
      font-family: var(--font-sans);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      line-height: 1.5;
    }

    header {
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      padding: 18px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: var(--text-main);
    }

    .brand-icon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      box-shadow: 0 2px 10px var(--accent-glow);
    }

    .brand-title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .brand-tag {
      font-size: 11px;
      color: var(--accent);
      background: rgba(139, 92, 246, 0.15);
      border: 1px solid rgba(139, 92, 246, 0.35);
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 600;
    }

    .header-links a {
      color: var(--cyan);
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid rgba(56, 189, 248, 0.25);
      background: rgba(56, 189, 248, 0.08);
      transition: all 0.15s ease;
    }

    .header-links a:hover {
      background: rgba(56, 189, 248, 0.16);
      border-color: var(--cyan);
    }

    main {
      flex: 1;
      max-width: 1140px;
      width: 100%;
      margin: 0 auto;
      padding: 40px 24px;
    }

    .hero {
      text-align: center;
      margin-bottom: 36px;
    }

    .hero h1 {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.03em;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #ffffff 30%, #a78bfa 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .hero p {
      font-size: 15px;
      color: var(--text-muted);
      max-width: 650px;
      margin: 0 auto 20px;
    }

    .stats-bar {
      display: flex;
      justify-content: center;
      gap: 20px;
      flex-wrap: wrap;
    }

    .stat-pill {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 6px 16px;
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .stat-pill strong {
      color: var(--text-main);
    }

    /* Search Bar */
    .filter-wrapper {
      margin-bottom: 28px;
      display: flex;
      justify-content: center;
    }

    .filter-input {
      width: 100%;
      max-width: 480px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 14px;
      color: var(--text-main);
      outline: none;
      transition: all 0.15s ease;
    }

    .filter-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 12px var(--accent-glow);
    }

    /* Grid */
    .branches-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 20px;
      margin-bottom: 48px;
    }

    .branch-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
      display: flex;
      flex-direction: column;
      transition: all 0.2s ease;
      position: relative;
    }

    .branch-card:hover {
      transform: translateY(-2px);
      border-color: var(--border-light);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }

    .branch-card.card-main {
      border-color: rgba(34, 197, 94, 0.45);
      background: linear-gradient(180deg, rgba(34, 197, 94, 0.05) 0%, var(--bg-surface) 100%);
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .card-title-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .card-icon {
      font-size: 18px;
    }

    .card-title {
      font-size: 17px;
      font-weight: 700;
      color: var(--text-main);
    }

    .badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 3px 8px;
      border-radius: 999px;
    }

    .badge-main {
      background: rgba(34, 197, 94, 0.18);
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.4);
    }

    .badge-sub {
      background: rgba(139, 92, 246, 0.18);
      color: #c084fc;
      border: 1px solid rgba(139, 92, 246, 0.4);
    }

    .card-message {
      font-size: 13px;
      color: #cbd5e1;
      margin-bottom: 16px;
      line-height: 1.45;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 38px;
    }

    .card-meta {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 11px;
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 18px;
    }

    .meta-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .meta-label {
      color: var(--text-muted);
    }

    .meta-val {
      color: var(--text-main);
      font-weight: 500;
    }

    .meta-sha {
      background: #11131a;
      border: 1px solid var(--border);
      padding: 1px 6px;
      border-radius: 4px;
      font-family: monospace;
      color: #cbd5e1;
    }

    .card-actions {
      display: flex;
      gap: 10px;
      margin-top: auto;
    }

    .btn {
      flex: 1;
      padding: 9px 12px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 6px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.15s ease;
      cursor: pointer;
      text-align: center;
    }

    .btn-primary {
      background: var(--accent);
      color: #ffffff;
      border: 1px solid transparent;
    }

    .btn-primary:hover {
      background: #7c3aed;
      box-shadow: 0 0 12px var(--accent-glow);
    }

    .card-main .btn-primary {
      background: var(--green);
      color: #062b13;
    }

    .card-main .btn-primary:hover {
      background: #16a34a;
      color: #ffffff;
      box-shadow: 0 0 12px var(--green-glow);
    }

    .btn-secondary {
      background: var(--bg-card);
      color: var(--text-muted);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      background: var(--bg-card-hover);
      color: var(--text-main);
      border-color: var(--border-light);
    }

    /* Architecture Documentation Section */
    .info-section {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
      margin-top: 24px;
    }

    .info-section h2 {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 12px;
      color: var(--accent);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }

    .info-card {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
    }

    .info-card h4 {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-main);
      margin-bottom: 6px;
    }

    .info-card p {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.5;
    }

    footer {
      border-top: 1px solid var(--border);
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
      background: var(--bg-surface);
    }

    footer a {
      color: var(--accent);
      text-decoration: none;
    }

    footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>

  <header>
    <a href="./" class="brand">
      <div class="brand-icon">⚡</div>
      <div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="brand-title">CosyUI</span>
          <span class="brand-tag">Pages Hub</span>
        </div>
      </div>
    </a>
    <div class="header-links">
      <a href="./">🏠 Return to Main Index</a>
      <a href="${escapeHtml(REPO_URL)}" target="_blank" rel="noopener noreferrer">View on GitHub ↗</a>
    </div>
  </header>

  <main>
    <section class="hero">
      <h1>Branch Deployments & Sub-Pages</h1>
      <p>The <strong>Main</strong> branch is deployed as the root index, while every other git branch is deployed to its own isolated sub-page.</p>
      
      <div class="stats-bar">
        <div class="stat-pill">
          <span>Total Deployments:</span>
          <strong>${branches.length}</strong>
        </div>
        <div class="stat-pill">
          <span>Index Branch:</span>
          <strong style="color: #4ade80;">main</strong>
        </div>
        <div class="stat-pill">
          <span>Sub-page Branches:</span>
          <strong style="color: #c084fc;">${subBranches.length} (${subBranches.map(b => b.name).join(', ') || 'none'})</strong>
        </div>
      </div>
    </section>

    <div class="filter-wrapper">
      <input type="text" id="branchFilterInput" class="filter-input" placeholder="🔍 Filter branches by name..." autocomplete="off">
    </div>

    <section class="branches-grid" id="branchesGrid">
      ${branchCardsHtml}
    </section>

    <section class="info-section">
      <h2>⚙️ How Git Multi-Branch Deployment Works</h2>
      <div class="info-grid">
        <div class="info-card">
          <h4>🏠 Main Branch Index</h4>
          <p>Commits pushed to <code>main</code> update the root URL (<code>/</code>). This serves the production index of CosyUI with full interactive game logic, LLM client, and player views.</p>
        </div>
        <div class="info-card">
          <h4>🌿 Branch Sub-Pages</h4>
          <p>Every feature, bugfix, or enhancement branch (e.g. <code>Enhancement</code>) is extracted into its own subfolder (<code>/branch-name/</code>). Assets and modules resolve relatively without collision.</p>
        </div>
        <div class="info-card">
          <h4>🔀 Built-in Switcher Widget</h4>
          <p>Every deployed page contains an interactive branch switcher widget in the header and a notification banner on subpages, allowing instant 1-click navigation between branches.</p>
        </div>
        <div class="info-card">
          <h4>🤖 Continuous GitHub Actions</h4>
          <p>GitHub Actions automatically triggers a rebuild on every git push to any branch, guaranteeing subpages stay in sync with the latest commits.</p>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <p>CosyUI • Built with zero dependencies • <a href="${escapeHtml(REPO_URL)}">${escapeHtml(REPO_URL)}</a></p>
  </footer>

  <script>
    const filterInput = document.getElementById('branchFilterInput');
    const cards = document.querySelectorAll('.branch-card');

    if (filterInput) {
      filterInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        cards.forEach(card => {
          const name = (card.getAttribute('data-branch-name') || '').toLowerCase();
          if (!query || name.includes(query)) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    }
  </script>
</body>
</html>
`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function build() {
  console.log('======================================================');
  console.log('⚡ CosyUI GitHub Pages Multi-Branch Builder');
  console.log('======================================================');
  console.log(`Target directory: ${OUTPUT_DIR}\n`);

  // Clean / prepare output directory
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 1. Discover all branches
  console.log('🔍 Discovering git branches...');
  const branches = discoverBranches();
  console.log(`Found ${branches.length} branches:`);
  branches.forEach(b => {
    console.log(` - ${b.name} (${b.sha}) ${b.isMain ? '[INDEX]' : '[SUB-PAGE]'}: "${b.message}"`);
  });

  const mainBranch = branches.find(b => b.isMain) || branches[0];
  const subBranches = branches.filter(b => !b.isMain);

  // 2. Export main branch to root of OUTPUT_DIR
  console.log(`\n📦 Exporting main branch (${mainBranch.ref}) to root index...`);
  extractBranchFiles(mainBranch.ref, OUTPUT_DIR);

  // Ensure branch-switcher assets are placed in _site/branch-switcher/
  const switcherSrcDir = path.join(REPO_ROOT, 'branch-switcher');
  const switcherDestDir = path.join(OUTPUT_DIR, 'branch-switcher');
  fs.mkdirSync(switcherDestDir, { recursive: true });
  if (fs.existsSync(switcherSrcDir)) {
    copyDirectoryRecursive(switcherSrcDir, switcherDestDir);
  }

  // 3. Inject branch switcher into root index.html
  const rootIndexHtml = path.join(OUTPUT_DIR, 'index.html');
  if (fs.existsSync(rootIndexHtml)) {
    console.log('💉 Injecting branch switcher into root index.html (main)...');
    injectSwitcher(rootIndexHtml, mainBranch.name, true, 0, branches);
  } else {
    console.warn('⚠️ Warning: index.html not found in main branch root');
  }

  // 4. Export each subpage branch
  for (const branch of subBranches) {
    console.log(`\n🌿 Exporting sub-page branch "${branch.name}" (${branch.ref})...`);
    const branchDir = path.join(OUTPUT_DIR, branch.name);
    fs.mkdirSync(branchDir, { recursive: true });
    extractBranchFiles(branch.ref, branchDir);

    // Compute depth for injection (e.g. 'Enhancement' has depth 1, 'feat/foo' has depth 2)
    const depth = branch.name.split('/').length;

    // Inject branch switcher into subpage index.html
    const branchIndexHtml = path.join(branchDir, 'index.html');
    if (fs.existsSync(branchIndexHtml)) {
      console.log(`💉 Injecting branch switcher into ${branch.name}/index.html...`);
      injectSwitcher(branchIndexHtml, branch.name, false, depth, branches);
    }

    // Also mirror to branches/${branch.name}/index.html as a redirect for backwards/alternate URL compatibility
    const branchesSubDir = path.join(OUTPUT_DIR, 'branches', branch.name);
    fs.mkdirSync(branchesSubDir, { recursive: true });
    const redirectHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirecting to ${escapeHtml(branch.name)}...</title>
  <meta http-equiv="refresh" content="0; url=../../${escapeHtml(branch.name)}/">
  <link rel="canonical" href="../../${escapeHtml(branch.name)}/">
</head>
<body>
  <p>Redirecting to branch sub-page: <a href="../../${escapeHtml(branch.name)}/">${escapeHtml(branch.name)}</a>...</p>
</body>
</html>`;
    fs.writeFileSync(path.join(branchesSubDir, 'index.html'), redirectHtml, 'utf8');
  }

  // 5. Generate branches portal page
  console.log('\n📄 Generating branches portal (branches.html)...');
  const portalHtml = generateBranchesPortal(branches);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'branches.html'), portalHtml, 'utf8');

  // Also create branches/index.html so /branches/ URL serves the portal
  const branchesDir = path.join(OUTPUT_DIR, 'branches');
  fs.mkdirSync(branchesDir, { recursive: true });
  fs.writeFileSync(path.join(branchesDir, 'index.html'), portalHtml, 'utf8');

  // 6. Generate manifest branches.json
  console.log('📋 Generating branches.json manifest...');
  const manifest = {
    repository: REPO_URL,
    generatedAt: new Date().toISOString(),
    totalBranches: branches.length,
    mainBranch: mainBranch.name,
    branches: branches.map(b => ({
      name: b.name,
      isMain: b.isMain,
      path: b.isMain ? './' : `./${b.name}/`,
      sha: b.sha,
      fullSha: b.fullSha,
      author: b.author,
      date: b.date,
      relativeDate: b.relativeDate,
      message: b.message
    }))
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'branches.json'), JSON.stringify(manifest, null, 2), 'utf8');

  // 7. Add .nojekyll to prevent GitHub Pages from bypassing files with underscores or custom patterns
  fs.writeFileSync(path.join(OUTPUT_DIR, '.nojekyll'), '', 'utf8');

  console.log('\n======================================================');
  console.log('✅ GitHub Pages build complete!');
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`- Index (main): ${OUTPUT_DIR}/index.html`);
  subBranches.forEach(b => {
    console.log(`- Sub-page (${b.name}): ${OUTPUT_DIR}/${b.name}/index.html`);
  });
  console.log(`- Branches Portal: ${OUTPUT_DIR}/branches.html (and /branches/)`);
  console.log(`- Manifest: ${OUTPUT_DIR}/branches.json`);
  console.log('======================================================\n');
}

build();
