/**
 * app.js — Prompt Hero
 * Orkestrator utama: routing halaman, event wiring, inisialisasi.
 * Entry point yang diload oleh index.html via <script type="module">
 */

import { loadState, saveState, clearState, updateStreak } from './storage.js';
import { initGame } from './game.js';
import {
  renderLevelGrid,
  renderAchievements,
  renderLeaderboard,
  renderDailyChallenge,
  renderHistory,
  updateSidebarStats,
} from './components.js';
import { showToast, scrollTo } from './utils.js';

// ── State Global Aplikasi ─────────────────────────────────────

let appState = null;

// ── Page & Section Management ─────────────────────────────────

/** Semua page yang tersedia */
const PAGES = ['landing-page', 'setup-page', 'dashboard-page', 'game-page'];

/**
 * Tampilkan halaman tertentu, sembunyikan yang lain
 * @param {string} pageId - ID element halaman
 */
function showPage(pageId) {
  PAGES.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === pageId) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

/** Semua section di dashboard */
const SECTIONS = ['levels', 'achievements', 'leaderboard', 'daily', 'history', 'api'];

/**
 * Tampilkan section tertentu di dashboard
 * @param {string} sectionKey
 */
function showSection(sectionKey) {
  SECTIONS.forEach(key => {
    const el = document.getElementById(`section-${key}`);
    if (!el) return;
    el.classList.toggle('active', key === sectionKey);
  });

  // Update nav item aktif
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === sectionKey);
  });

  // Update judul header
  const titles = {
    levels: 'Peta Level',
    achievements: 'Achievement',
    leaderboard: 'Leaderboard',
    daily: 'Daily Challenge',
    history: 'Histori Prompt',
    api: 'Pengaturan API',
  };
  const titleEl = document.getElementById('sectionTitle');
  if (titleEl) titleEl.textContent = titles[sectionKey] || '';

  // Render konten section
  renderSection(sectionKey);

  // Tutup sidebar di mobile
  closeSidebar();
}

/**
 * Render konten sesuai section yang aktif
 * @param {string} key
 */
function renderSection(key) {
  if (!appState) return;

  switch (key) {
    case 'levels':
      renderLevelGrid(appState, handleLevelSelect);
      break;
    case 'achievements':
      renderAchievements(appState);
      break;
    case 'leaderboard':
      renderLeaderboard(appState, 'xp');
      break;
    case 'daily':
      renderDailyChallenge(appState, handleDailyStart);
      break;
    case 'history':
      renderHistory(appState);
      break;
    case 'api':
      // Muat API Keys ke textarea
      const geminiInput = document.getElementById('geminiKeysInput');
      const groqInput = document.getElementById('groqKeysInput');
      const keys = appState?.settings?.apiKeys || { gemini: [], groq: [] };
      if (geminiInput) geminiInput.value = (keys.gemini || []).join(',');
      if (groqInput) groqInput.value = (keys.groq || []).join(',');
      break;
  }
}

// ── Sidebar ───────────────────────────────────────────────────

function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.add('open');
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');
}

// ── Theme ─────────────────────────────────────────────────────

/**
 * Toggle antara dark dan light mode
 */
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);

  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = next === 'dark' ? '🌙 Mode Gelap' : '☀️ Mode Terang';

  // Simpan preferensi
  if (appState) {
    appState.settings.theme = next;
    saveState(appState);
  }
}

/**
 * Terapkan tema dari state tersimpan
 */
function applyTheme(state) {
  const theme = state?.settings?.theme || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '🌙 Mode Gelap' : '☀️ Mode Terang';
}

// ── Level Selection ───────────────────────────────────────────

/**
 * Dipanggil ketika pemain memilih level dari grid
 * @param {number} levelNum
 */
function handleLevelSelect(levelNum) {
  if (!appState) return;

  // Cek apakah level terkunci
  const completed = appState.progress.completedLevels || [];
  const isFirst = levelNum === 1;
  const prevDone = completed.includes(levelNum - 1);

  if (!isFirst && !prevDone && !completed.includes(levelNum)) {
    showToast('Selesaikan level sebelumnya dulu! 🔒', 'error');
    return;
  }

  // Cek hati
  if (appState.stats.hearts <= 0) {
    showToast('Hatimu habis! Tunggu regenerasi atau reset. ❤️', 'error');
    return;
  }

  startLevel(levelNum);
}

/**
 * Mulai level game
 * @param {number} levelNum
 */
function startLevel(levelNum) {
  appState = loadState(); // Refresh state terbaru
  showPage('game-page');

  // Update streak saat mulai bermain
  updateStreak(appState);
  saveState(appState);

  const success = initGame(levelNum, appState);
  if (!success) {
    showPage('dashboard-page');
    showToast('Gagal memuat level!', 'error');
  }
}

/**
 * Handler untuk Daily Challenge
 * @param {number} levelNum
 */
function handleDailyStart(levelNum) {
  startLevel(levelNum);
}

// ── Setup / Profile Creation ──────────────────────────────────

/**
 * Inisialisasi halaman setup dengan event listeners
 */
function initSetupPage() {
  // Avatar grid
  const avatarGrid = document.getElementById('avatarGrid');
  if (avatarGrid) {
    avatarGrid.querySelectorAll('.avatar-option').forEach(opt => {
      opt.addEventListener('click', () => {
        avatarGrid.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });
  }

  // Role grid
  const roleGrid = document.getElementById('roleGrid');
  if (roleGrid) {
    roleGrid.querySelectorAll('.role-option').forEach(opt => {
      opt.addEventListener('click', () => {
        roleGrid.querySelectorAll('.role-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });
  }

  // Create profile button
  const createBtn = document.getElementById('createProfileBtn');
  if (createBtn) {
    createBtn.addEventListener('click', handleCreateProfile);
  }

  // Back button
  const setupBack = document.getElementById('setupBack');
  if (setupBack) {
    setupBack.addEventListener('click', () => showPage('landing-page'));
  }
}

/**
 * Handle pembuatan profil pemain baru
 */
function handleCreateProfile() {
  const nameInput = document.getElementById('playerName');
  const name = nameInput?.value?.trim();

  if (!name) {
    showToast('Masukkan nama heromu dulu! ⚡', 'error');
    nameInput?.focus();
    return;
  }

  // Ambil avatar yang dipilih
  const activeAvatar = document.querySelector('.avatar-option.active');
  const avatar = activeAvatar?.dataset?.avatar || '🦸';

  // Ambil role yang dipilih
  const activeRole = document.querySelector('.role-option.active');
  const role = activeRole?.dataset?.role || 'Profesional';

  // Buat state baru
  appState = loadState();
  appState.player.name = name;
  appState.player.avatar = avatar;
  appState.player.role = role;
  appState.player.createdAt = new Date().toISOString();
  saveState(appState);

  showToast(`Selamat datang, ${name}! ⚡`, 'success');
  goToDashboard();
}

// ── Dashboard ─────────────────────────────────────────────────

/**
 * Navigasi ke halaman dashboard dan render ulang
 */
function goToDashboard() {
  appState = loadState();
  showPage('dashboard-page');
  updateSidebarStats(appState);
  showSection('levels');

  // Update hearts display di header
  updateHeartsDisplay();
}

/**
 * Update tampilan hati di header dashboard
 */
function updateHeartsDisplay() {
  const hearts = appState?.stats?.hearts ?? 5;
  const max = appState?.stats?.maxHearts ?? 5;
  const display = document.getElementById('heartsDisplay');
  if (display) {
    display.textContent = '❤️'.repeat(hearts) + '🖤'.repeat(Math.max(0, max - hearts));
  }
}

// ── Landing Page ──────────────────────────────────────────────

/**
 * Inisialisasi animasi virus particles di landing
 */
function initVirusParticles() {
  const container = document.getElementById('virusParticles');
  if (!container) return;

  const chars = ['0', '1', '#', '@', '!', '?', 'NULL', 'ERR', 'AI', '🦠'];
  for (let i = 0; i < 20; i++) {
    const span = document.createElement('span');
    span.className = 'virus-particle';
    span.textContent = chars[Math.floor(Math.random() * chars.length)];
    span.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      animation-delay: ${Math.random() * 4}s;
      animation-duration: ${3 + Math.random() * 4}s;
      font-size: ${8 + Math.random() * 14}px;
      opacity: ${0.1 + Math.random() * 0.3};
    `;
    container.appendChild(span);
  }
}

// ── Modal Handlers ─────────────────────────────────────────────

/**
 * Tampilkan leaderboard modal dari landing page
 */
function showLeaderboardModal() {
  const modal = document.getElementById('leaderboardModal');
  const content = document.getElementById('lbContent');
  if (!modal || !content) return;

  // Render leaderboard tanpa state jika belum login
  const state = appState || loadState();
  const { generateMockLeaderboard } = window._promptHeroUtils || {};

  modal.style.display = 'flex';
}

// ── Event Wiring ──────────────────────────────────────────────

/**
 * Daftarkan semua event listener global
 */
function wireEvents() {

  // ── Landing Page ──
  const startGameBtn = document.getElementById('startGameBtn');
  if (startGameBtn) {
    startGameBtn.addEventListener('click', () => {
      const state = loadState();
      if (state.player.name) {
        // Profil sudah ada, langsung ke dashboard
        appState = state;
        goToDashboard();
      } else {
        showPage('setup-page');
      }
    });
  }

  const continueBtn = document.getElementById('continueBtn');
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      const state = loadState();
      if (state.player.name) {
        appState = state;
        goToDashboard();
      } else {
        showToast('Belum ada profil tersimpan. Mulai baru dulu! ⚡', 'info');
        showPage('setup-page');
      }
    });
  }

  const navStart = document.getElementById('navStart');
  if (navStart) {
    navStart.addEventListener('click', () => {
      const state = loadState();
      if (state.player.name) {
        appState = state;
        goToDashboard();
      } else {
        showPage('setup-page');
      }
    });
  }

  const navLeaderboard = document.getElementById('navLeaderboard');
  if (navLeaderboard) {
    navLeaderboard.addEventListener('click', () => {
      const modal = document.getElementById('leaderboardModal');
      if (modal) modal.style.display = 'flex';
    });
  }

  // ── Sidebar ──
  const hamburger = document.getElementById('hamburger');
  if (hamburger) hamburger.addEventListener('click', openSidebar);

  const sidebarClose = document.getElementById('sidebarClose');
  if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);

  // Klik di luar sidebar untuk tutup
  document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const hamburgerBtn = document.getElementById('hamburger');
    if (
      sidebar?.classList.contains('open') &&
      !sidebar.contains(e.target) &&
      e.target !== hamburgerBtn
    ) {
      closeSidebar();
    }
  });

  // ── Nav Items di Sidebar ──
  document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      showSection(btn.dataset.section);
    });
  });

  // ── Leaderboard Tabs ──
  document.querySelectorAll('.lb-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (appState) renderLeaderboard(appState, tab.dataset.tab);
    });
  });

  // ── Theme Toggle ──
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  // ── Save API Keys ──
  const saveApiKeysBtn = document.getElementById('saveApiKeysBtn');
  if (saveApiKeysBtn) {
    saveApiKeysBtn.addEventListener('click', () => {
      const geminiInput = document.getElementById('geminiKeysInput');
      const groqInput = document.getElementById('groqKeysInput');

      if (appState && geminiInput && groqInput) {
        // Parse keys: split by comma or newline, trim, remove empty
        const parseKeys = (text) => text.split(/[\n,]+/).map(k => k.trim()).filter(k => k.length > 0);

        if (!appState.settings) appState.settings = {};
        if (!appState.settings.apiKeys) appState.settings.apiKeys = { gemini: [], groq: [] };

        appState.settings.apiKeys.gemini = parseKeys(geminiInput.value);
        appState.settings.apiKeys.groq = parseKeys(groqInput.value);

        saveState(appState);

        showToast('API Keys berhasil disimpan!', 'success');
      }
    });
  }

  // ── Reset Data ──
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Reset semua data? Progres akan hilang permanen! ⚠️')) {
        clearState();
        appState = null;
        showToast('Data direset. Mulai petualangan baru! 🔄', 'info');
        showPage('landing-page');
      }
    });
  }

  // ── Daily Badge ──
  const dailyBadge = document.getElementById('dailyBadge');
  if (dailyBadge) {
    dailyBadge.addEventListener('click', () => showSection('daily'));
  }

  // ── Game — Back Button ──
  const gameBack = document.getElementById('gameBack');
  if (gameBack) {
    gameBack.addEventListener('click', () => {
      if (confirm('Keluar dari level? Progres akan hilang.')) {
        appState = loadState();
        goToDashboard();
      }
    });
  }

  // ── Modal — Level Complete ──
  const nextLevelBtn = document.getElementById('nextLevelBtn');
  if (nextLevelBtn) {
    nextLevelBtn.addEventListener('click', () => {
      const modal = document.getElementById('levelCompleteModal');
      if (modal) modal.style.display = 'none';

      // Dapatkan level berikutnya dari state
      appState = loadState();
      const nextLevel = (appState.progress.currentLevel || 1) + 1;

      if (nextLevel > 20) {
        showToast('Selamat! Kamu telah menyelesaikan semua level! 🏆', 'success', 5000);
        goToDashboard();
      } else {
        startLevel(nextLevel);
      }
    });
  }

  const backToMapBtn = document.getElementById('backToMapBtn');
  if (backToMapBtn) {
    backToMapBtn.addEventListener('click', () => {
      const modal = document.getElementById('levelCompleteModal');
      if (modal) modal.style.display = 'none';
      appState = loadState();
      goToDashboard();
    });
  }

  // ── Modal — Achievement ──
  const achClose = document.getElementById('achClose');
  if (achClose) {
    achClose.addEventListener('click', () => {
      const modal = document.getElementById('achievementModal');
      if (modal) modal.style.display = 'none';
    });
  }

  // ── Modal — Leaderboard ──
  const lbClose = document.getElementById('lbClose');
  if (lbClose) {
    lbClose.addEventListener('click', () => {
      const modal = document.getElementById('leaderboardModal');
      if (modal) modal.style.display = 'none';
    });
  }

  // Klik overlay untuk tutup modal
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.style.display = 'none';
      }
    });
  });

  // ── Keyboard Shortcuts ──
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => {
        m.style.display = 'none';
      });
      const sidebar = document.getElementById('sidebar');
      if (sidebar?.classList.contains('open')) closeSidebar();
    }
  });
}

// ── App Init ──────────────────────────────────────────────────

/**
 * Inisialisasi aplikasi saat DOM siap
 */
function init() {
  // Load state
  appState = loadState();

  // Terapkan tema tersimpan
  applyTheme(appState);

  // Wire semua event
  wireEvents();

  // Inisialisasi setup page
  initSetupPage();

  // Animasi landing page
  initVirusParticles();

  // Tentukan halaman awal
  if (appState.player.name) {
    // Pemain sudah punya profil — langsung ke dashboard
    goToDashboard();
  } else {
    // Pemain baru — tampilkan landing
    showPage('landing-page');
  }

  console.log('⚡ Prompt Hero initialized. Ready to fight GENERIC OUTPUT!');
}

// ── Expose untuk integrasi game.js ───────────────────────────

/**
 * Setelah level selesai, game.js akan memanggil ini via window event
 * agar app.js bisa refresh state dan navigasi
 */
window.addEventListener('prompthero:levelcomplete', () => {
  appState = loadState();
  updateSidebarStats(appState);
  updateHeartsDisplay();
});

window.addEventListener('prompthero:returntodashboard', () => {
  appState = loadState();
  goToDashboard();
});

// ── Bootstrap ─────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
