/**
 * CosyUI Branch Switcher & Sub-page Navigation Component
 * Zero external dependencies. Self-contained and portable.
 */
(function() {
  function initBranchSwitcher() {
    // Prevent duplicate initialization
    if (document.getElementById('cosyBranchWidget')) return;

    // Read embedded data
    let config = null;
    const dataEl = document.getElementById('cosy-branch-data');
    if (dataEl) {
      try {
        config = JSON.parse(dataEl.textContent);
      } catch (e) {
        console.warn('[CosyUI Branch Switcher] Could not parse embedded branch data:', e);
      }
    }

    if (!config) {
      // Fallback configuration if not embedded
      const isSubpage = window.location.pathname.includes('/Enhancement');
      config = {
        currentBranch: isSubpage ? 'Enhancement' : 'main',
        isMain: !isSubpage,
        basePath: isSubpage ? '../' : './',
        branches: [
          { name: 'main', isMain: true, path: isSubpage ? '../' : './' },
          { name: 'Enhancement', isMain: false, path: isSubpage ? './' : './Enhancement/' }
        ],
        repoUrl: 'https://github.com/someonenameguy/CosyUI'
      };
    }

    const { currentBranch, isMain, basePath, branches, repoUrl } = config;

    // 1. If viewing a branch sub-page, insert the helpful top notification banner
    if (!isMain) {
      const banner = document.createElement('div');
      banner.className = 'cosy-subpage-banner';
      banner.id = 'cosySubpageBanner';

      const mainUrl = basePath;
      const branchesPortalUrl = `${basePath}branches.html`;

      banner.innerHTML = `
        <div class="cosy-subpage-banner-content">
          <span class="cosy-subpage-banner-badge">Branch Sub-Page</span>
          <span>You are previewing branch: <strong>${escapeHtml(currentBranch)}</strong></span>
          <span>•</span>
          <a href="${escapeHtml(mainUrl)}">← Return to Main (Index)</a>
          <span>•</span>
          <a href="${escapeHtml(branchesPortalUrl)}">View All Branches & Sub-Pages ↗</a>
        </div>
        <button class="cosy-subpage-banner-close" title="Dismiss notice" aria-label="Dismiss">&times;</button>
      `;

      banner.querySelector('.cosy-subpage-banner-close').addEventListener('click', () => {
        banner.remove();
      });

      document.body.prepend(banner);
    }

    // 2. Build the Branch Switcher widget
    const widget = document.createElement('div');
    widget.className = 'cosy-branch-container';
    widget.id = 'cosyBranchWidget';

    const branchesListHtml = (branches || []).map(b => {
      const isCurrent = b.name === currentBranch;
      const targetUrl = b.path;
      const badgeText = b.isMain ? 'Index' : 'Subpage';
      const badgeClass = b.isMain ? 'main-badge' : 'sub-badge';
      const commitSnippet = b.commit ? `${b.commit}: ${escapeHtml(b.message || '')}` : '';

      return `
        <li>
          <a href="${escapeHtml(targetUrl)}" class="cosy-branch-item ${isCurrent ? 'is-current' : ''}">
            <div class="cosy-branch-item-left">
              <div class="cosy-branch-item-name">
                <span>${b.isMain ? '🏠' : '🌿'}</span>
                <span>${escapeHtml(b.name)}</span>
                ${isCurrent ? '<span style="color:#a78bfa; font-size:11px;">(current)</span>' : ''}
              </div>
              ${commitSnippet ? `<div class="cosy-branch-item-meta" title="${escapeHtml(commitSnippet)}">${commitSnippet}</div>` : ''}
            </div>
            <div class="cosy-branch-item-right">
              <span class="cosy-branch-pill-badge ${badgeClass}">${badgeText}</span>
            </div>
          </a>
        </li>
      `;
    }).join('');

    const portalUrl = `${basePath}branches.html`;
    const ghUrl = repoUrl || 'https://github.com/someonenameguy/CosyUI';

    widget.innerHTML = `
      <button class="cosy-branch-trigger" id="cosyBranchTrigger" title="Switch branch / explore subpages">
        <span class="cosy-branch-icon">🌿</span>
        <span class="cosy-branch-name">${escapeHtml(currentBranch)}</span>
        <span class="cosy-branch-pill-badge ${isMain ? 'main-badge' : 'sub-badge'}">${isMain ? 'Index' : 'Subpage'}</span>
        <span class="cosy-branch-caret">▼</span>
      </button>

      <div class="cosy-branch-menu" id="cosyBranchMenu">
        <div class="cosy-branch-menu-header">
          <div class="cosy-branch-menu-title">
            <span>Branch Deployments</span>
            <span style="font-weight: normal; color: #64748b;">${(branches || []).length} active</span>
          </div>
          <div class="cosy-branch-menu-desc">Main is index; other branches are sub-pages.</div>
        </div>

        <ul class="cosy-branch-menu-list">
          ${branchesListHtml}
        </ul>

        <div class="cosy-branch-menu-footer">
          <a href="${escapeHtml(portalUrl)}" title="Open branches directory portal">
            <span>📂</span> Sub-pages Directory
          </a>
          <a href="${escapeHtml(ghUrl)}" target="_blank" rel="noopener noreferrer" title="View repository on GitHub">
            <span>⚡</span> GitHub
          </a>
        </div>
      </div>
    `;

    // 3. Mount into DOM: Prefer placing into header-left right after .cosy-brand
    const headerLeft = document.querySelector('.cosy-header .header-left');
    const brand = document.querySelector('.cosy-brand');

    if (headerLeft && brand) {
      brand.insertAdjacentElement('afterend', widget);
    } else if (headerLeft) {
      headerLeft.prepend(widget);
    } else {
      widget.classList.add('cosy-branch-floating');
      document.body.appendChild(widget);
    }

    // 4. Interaction events
    const trigger = widget.querySelector('#cosyBranchTrigger');
    const menu = widget.querySelector('#cosyBranchMenu');

    function toggleMenu(e) {
      e.stopPropagation();
      widget.classList.toggle('is-open');
    }

    function closeMenu() {
      widget.classList.remove('is-open');
    }

    trigger.addEventListener('click', toggleMenu);

    document.addEventListener('click', (e) => {
      if (!widget.contains(e.target)) {
        closeMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    });
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBranchSwitcher);
  } else {
    initBranchSwitcher();
  }
})();
