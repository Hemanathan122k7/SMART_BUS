/**
 * features.js – Additional UI Features for SmartTransit
 * Dark Mode, Fullscreen Toggle, Keyboard Shortcuts, Notification History, CSV Export
 * ADDITIVE – does not modify existing functionality
 */

(function (global) {
  'use strict';

  /* ═══════════════════════════════════════════
     1. DARK MODE
  ═══════════════════════════════════════════ */
  const THEME_KEY = 'smartbus_theme';

  function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'light';
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    updateDarkModeBtn(theme);
  }

  function toggleDarkMode() {
    const current = getTheme();
    setTheme(current === 'dark' ? 'light' : 'dark');
  }

  function updateDarkModeBtn(theme) {
    const btn = document.getElementById('darkModeBtn');
    if (!btn) return;
    btn.innerHTML = theme === 'dark'
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
    btn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  }

  function injectDarkModeToggle() {
    const navRight = document.querySelector('.nav-right');
    if (!navRight || document.getElementById('darkModeBtn')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'dark-mode-toggle';

    const btn = document.createElement('button');
    btn.id = 'darkModeBtn';
    btn.className = 'dark-mode-btn';
    btn.type = 'button';
    btn.title = 'Toggle Dark Mode';
    btn.addEventListener('click', toggleDarkMode);

    wrapper.appendChild(btn);

    // Insert before lang-switcher or logout
    const langSwitcher = navRight.querySelector('.lang-switcher');
    if (langSwitcher) {
      navRight.insertBefore(wrapper, langSwitcher);
    } else {
      const logoutBtn = navRight.querySelector('.btn-logout');
      if (logoutBtn) navRight.insertBefore(wrapper, logoutBtn);
      else navRight.appendChild(wrapper);
    }

    // Apply stored theme
    const saved = getTheme();
    setTheme(saved);
  }

  /* ═══════════════════════════════════════════
     2. FULLSCREEN TOGGLE
  ═══════════════════════════════════════════ */
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function () {});
    } else {
      document.exitFullscreen().catch(function () {});
    }
  }

  function injectFullscreenBtn() {
    const navRight = document.querySelector('.nav-right');
    if (!navRight || document.getElementById('fullscreenBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'fullscreenBtn';
    btn.className = 'fullscreen-btn';
    btn.type = 'button';
    btn.title = 'Toggle Fullscreen (F11)';
    btn.innerHTML = '<i class="fas fa-expand"></i>';
    btn.addEventListener('click', toggleFullscreen);

    // Insert before dark-mode toggle
    const darkToggle = navRight.querySelector('.dark-mode-toggle');
    if (darkToggle) {
      navRight.insertBefore(btn, darkToggle);
    } else {
      const logoutBtn = navRight.querySelector('.btn-logout');
      if (logoutBtn) navRight.insertBefore(btn, logoutBtn);
      else navRight.appendChild(btn);
    }

    // Update icon on fullscreen change
    document.addEventListener('fullscreenchange', function () {
      btn.innerHTML = document.fullscreenElement
        ? '<i class="fas fa-compress"></i>'
        : '<i class="fas fa-expand"></i>';
    });
  }

  /* ═══════════════════════════════════════════
     3. KEYBOARD SHORTCUTS
  ═══════════════════════════════════════════ */
  const shortcuts = [
    { keys: ['Ctrl', 'K'],  desc: 'Keyboard Shortcuts',   action: toggleShortcutsPanel },
    { keys: ['Ctrl', 'D'],  desc: 'Toggle Dark Mode',     action: toggleDarkMode },
    { keys: ['Ctrl', 'L'],  desc: 'Switch Language',      action: cycleLang },
    { keys: ['F11'],         desc: 'Toggle Fullscreen',    action: toggleFullscreen },
    { keys: ['Ctrl', 'E'],  desc: 'Export Table as CSV',  action: exportActiveTableCSV },
    { keys: ['Esc'],         desc: 'Close Panels',         action: closeAllPanels }
  ];

  function cycleLang() {
    if (!global.I18n) return;
    const langs = global.I18n.getSupportedLanguages();
    const current = global.I18n.getLanguage();
    const idx = langs.findIndex(function(l) { return l.code === current; });
    const next = langs[(idx + 1) % langs.length];
    global.I18n.setLanguage(next.code);
    if (global.Notify) {
      global.Notify.info('Language Changed', next.flag + ' ' + next.name);
    }
  }

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function (e) {
      // Ctrl+K → shortcuts panel
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); toggleShortcutsPanel(); }
      // Ctrl+D → dark mode
      else if (e.ctrlKey && e.key === 'd') { e.preventDefault(); toggleDarkMode(); }
      // Ctrl+L → cycle language
      else if (e.ctrlKey && e.key === 'l') { e.preventDefault(); cycleLang(); }
      // Ctrl+E → export CSV
      else if (e.ctrlKey && e.key === 'e') { e.preventDefault(); exportActiveTableCSV(); }
      // Esc → close panels
      else if (e.key === 'Escape') { closeAllPanels(); }
    });
  }

  function toggleShortcutsPanel() {
    let overlay = document.getElementById('shortcutsOverlay');
    if (!overlay) {
      overlay = createShortcutsPanel();
      document.body.appendChild(overlay);
    }
    overlay.classList.toggle('open');
  }

  function createShortcutsPanel() {
    const overlay = document.createElement('div');
    overlay.id = 'shortcutsOverlay';
    overlay.className = 'shortcuts-overlay';

    const panel = document.createElement('div');
    panel.className = 'shortcuts-panel';
    panel.innerHTML = '<h3><i class="fas fa-keyboard" style="color:var(--clr-accent,#00c9a7)"></i> Keyboard Shortcuts</h3>';

    shortcuts.forEach(function (s) {
      const row = document.createElement('div');
      row.className = 'shortcut-row';

      const label = document.createElement('span');
      label.className = 'shortcut-label';
      label.textContent = s.desc;

      const keys = document.createElement('div');
      keys.className = 'shortcut-keys';
      s.keys.forEach(function (k) {
        const key = document.createElement('span');
        key.className = 'shortcut-key';
        key.textContent = k;
        keys.appendChild(key);
      });

      row.appendChild(label);
      row.appendChild(keys);
      panel.appendChild(row);
    });

    overlay.appendChild(panel);

    // Close on overlay click (not panel)
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.classList.remove('open');
    });

    return overlay;
  }

  function closeAllPanels() {
    var el = document.getElementById('shortcutsOverlay');
    if (el) el.classList.remove('open');
    var notifDrop = document.getElementById('notifDropdown');
    if (notifDrop) notifDrop.classList.remove('open');
    var langDrop = document.getElementById('langDropdown');
    if (langDrop) langDrop.classList.remove('open');
  }

  /* ═══════════════════════════════════════════
     4. NOTIFICATION HISTORY
  ═══════════════════════════════════════════ */
  let notifHistory = [];
  const MAX_HISTORY = 50;

  function addNotifToHistory(data) {
    notifHistory.unshift({
      title: data.title || 'Notification',
      message: data.message || '',
      type: data.type || 'info',
      time: new Date()
    });
    if (notifHistory.length > MAX_HISTORY) notifHistory.pop();
    updateNotifBadge();
    renderNotifDropdown();
  }

  function updateNotifBadge() {
    var badge = document.getElementById('notifBadge');
    if (badge) {
      var count = notifHistory.length;
      badge.textContent = count > 99 ? '99+' : count;
      badge.dataset.count = count;
    }
  }

  function renderNotifDropdown() {
    var body = document.getElementById('notifBody');
    if (!body) return;

    if (notifHistory.length === 0) {
      body.innerHTML = '<div class="notif-empty"><i class="fas fa-bell-slash" style="font-size:1.5rem;margin-bottom:8px;display:block;opacity:.4"></i>No notifications yet</div>';
      return;
    }

    body.innerHTML = notifHistory.slice(0, 20).map(function (n) {
      var iconClass = n.type === 'ok' ? 'fa-circle-check' : n.type === 'warn' ? 'fa-triangle-exclamation' : n.type === 'danger' ? 'fa-circle-exclamation' : 'fa-circle-info';
      var timeStr = n.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return '<div class="notif-item">' +
        '<div class="notif-item-icon ' + n.type + '"><i class="fas ' + iconClass + '"></i></div>' +
        '<div class="notif-item-body">' +
          '<div class="notif-item-title">' + sanitize(n.title) + '</div>' +
          '<div class="notif-item-msg">' + sanitize(n.message) + '</div>' +
          '<div class="notif-item-time">' + timeStr + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function clearNotifHistory() {
    notifHistory = [];
    updateNotifBadge();
    renderNotifDropdown();
  }

  function injectNotifHistoryBtn() {
    var navRight = document.querySelector('.nav-right');
    if (!navRight || document.getElementById('notifHistoryBtn')) return;

    var wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-flex';
    wrapper.style.alignItems = 'center';

    var btn = document.createElement('button');
    btn.id = 'notifHistoryBtn';
    btn.className = 'notif-history-btn';
    btn.type = 'button';
    btn.title = 'Notification History';
    btn.innerHTML = '<i class="fas fa-bell"></i><span class="notif-badge" id="notifBadge" data-count="0">0</span>';

    var dropdown = document.createElement('div');
    dropdown.className = 'notif-dropdown';
    dropdown.id = 'notifDropdown';

    var header = document.createElement('div');
    header.className = 'notif-dropdown-header';
    header.innerHTML = '<span>Notifications</span>';

    var clearBtn = document.createElement('button');
    clearBtn.className = 'notif-clear-btn';
    clearBtn.textContent = 'Clear All';
    clearBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      clearNotifHistory();
    });
    header.appendChild(clearBtn);

    var body = document.createElement('div');
    body.id = 'notifBody';
    body.innerHTML = '<div class="notif-empty"><i class="fas fa-bell-slash" style="font-size:1.5rem;margin-bottom:8px;display:block;opacity:.4"></i>No notifications yet</div>';

    dropdown.appendChild(header);
    dropdown.appendChild(body);

    wrapper.appendChild(btn);
    wrapper.appendChild(dropdown);

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });

    document.addEventListener('click', function () {
      dropdown.classList.remove('open');
    });

    // Insert before fullscreen btn
    var fsBtn = navRight.querySelector('.fullscreen-btn');
    if (fsBtn) {
      navRight.insertBefore(wrapper, fsBtn);
    } else {
      var darkToggle = navRight.querySelector('.dark-mode-toggle');
      if (darkToggle) navRight.insertBefore(wrapper, darkToggle);
      else navRight.appendChild(wrapper);
    }

    // Hook into Notify if available
    hookNotifyHistory();
  }

  function hookNotifyHistory() {
    if (!global.Notify) return;
    var origShow = global.Notify.show;
    global.Notify.show = function (options) {
      addNotifToHistory(options);
      return origShow.call(global.Notify, options);
    };
  }

  /* ═══════════════════════════════════════════
     5. CSV EXPORT
  ═══════════════════════════════════════════ */
  function exportActiveTableCSV() {
    // Find the currently active section
    var activeSection = document.querySelector('.content-section.active');
    if (!activeSection) {
      // Try any visible table
      activeSection = document;
    }

    var table = activeSection.querySelector('.ent-table');
    if (!table) {
      if (global.Notify) global.Notify.warning('Export', 'No table found to export');
      return;
    }

    var csv = [];
    var rows = table.querySelectorAll('tr');
    rows.forEach(function (row) {
      var cols = [];
      row.querySelectorAll('th, td').forEach(function (cell) {
        var text = cell.textContent.replace(/"/g, '""').trim();
        cols.push('"' + text + '"');
      });
      csv.push(cols.join(','));
    });

    var csvStr = csv.join('\n');
    var blob = new Blob(['\ufeff' + csvStr], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'smartbus_export_' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(url);

    if (global.Notify) global.Notify.success('Exported', 'Table data saved as CSV');
  }

  /* ═══════════════════════════════════════════
     UTILITY
  ═══════════════════════════════════════════ */
  function sanitize(str) {
    var d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  /* ═══════════════════════════════════════════
     INITIALIZATION
  ═══════════════════════════════════════════ */
  function initFeatures() {
    injectFullscreenBtn();
    injectDarkModeToggle();
    injectNotifHistoryBtn();
    setupKeyboardShortcuts();
  }

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFeatures);
  } else {
    initFeatures();
  }

  /* ═══════════════════════════════════════════
     PUBLIC API
  ═══════════════════════════════════════════ */
  global.Features = {
    toggleDarkMode:     toggleDarkMode,
    toggleFullscreen:   toggleFullscreen,
    toggleShortcuts:    toggleShortcutsPanel,
    exportCSV:          exportActiveTableCSV,
    setTheme:           setTheme,
    getTheme:           getTheme,
    cycleLang:          cycleLang
  };

})(window);
