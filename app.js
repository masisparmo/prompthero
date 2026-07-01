/**
 * app.js — Prompt Hero
 * Orkestrator utama: routing halaman, event wiring, inisialisasi.
 * Entry point yang diload oleh index.html via <script type="module">
 */

import {
  loadState, saveState, clearState, updateStreak,
  initStorage, getProfiles, switchProfile, createProfile, deleteProfile, getActiveProfileId,
  registerOnline, loginOnline, importOnlineProfile
} from './storage.js';
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
const PAGES = ['landing-page', 'profile-select-page', 'auth-page', 'setup-page', 'dashboard-page', 'game-page'];

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
async function handleCreateProfile() {
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

  try {
    appState = await createProfile(name, avatar, role);
    showToast(`Selamat datang, ${name}! ⚡`, 'success');
    if (nameInput) nameInput.value = '';
    goToDashboard();
  } catch (err) {
    console.error(err);
    showToast('Gagal membuat profil baru.', 'error');
  }
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
    startGameBtn.addEventListener('click', async () => {
      showProfileSelectPage();
    });
  }

  const continueBtn = document.getElementById('continueBtn');
  if (continueBtn) {
    continueBtn.addEventListener('click', async () => {
      const profiles = await getProfiles();
      if (profiles.length > 0) {
        showProfileSelectPage();
      } else {
        showToast('Belum ada profil tersimpan. Mulai baru dulu! ⚡', 'info');
        showProfileSelectPage();
      }
    });
  }

  const navStart = document.getElementById('navStart');
  if (navStart) {
    navStart.addEventListener('click', async () => {
      showProfileSelectPage();
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

  // ── Reset Data (Hapus Profil Aktif) ──
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      const activeId = getActiveProfileId();
      if (confirm('Hapus profil ini beserta seluruh progresnya secara permanen? ⚠️')) {
        if (activeId) {
          await deleteProfile(activeId);
        } else {
          clearState();
        }
        appState = null;
        showToast('Profil dihapus. Kembali ke halaman utama. 🔄', 'info');
        
        const profiles = await getProfiles();
        if (profiles.length > 0) {
          showProfileSelectPage();
        } else {
          showPage('landing-page');
        }
      }
    });
  }

  // ── Ganti Profil dari Sidebar ──
  const sidebarSwitchProfile = document.getElementById('sidebarSwitchProfile');
  if (sidebarSwitchProfile) {
    sidebarSwitchProfile.addEventListener('click', () => {
      clearState();
      showProfileSelectPage();
      closeSidebar();
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
 * Inisialisasi halaman pemilih profil
 */
function initProfileSelectPage() {
  const backBtn = document.getElementById('profileSelectBack');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      showPage('landing-page');
    });
  }

  const createOfflineBtn = document.getElementById('createOfflineProfileBtn');
  if (createOfflineBtn) {
    createOfflineBtn.addEventListener('click', () => {
      showPage('setup-page');
    });
  }

  const createBtn = document.getElementById('createNewProfileBtn');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      showPage('auth-page');
    });
  }
}

/**
 * Tampilkan halaman pemilih profil dan render daftar profil
 */
async function showProfileSelectPage() {
  showPage('profile-select-page');
  
  const profilesGrid = document.getElementById('profilesGrid');
  if (!profilesGrid) return;

  profilesGrid.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">Memuat daftar hero...</div>';

  try {
    const profiles = await getProfiles();
    
    if (profiles.length === 0) {
      profilesGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 20px; color: var(--text-muted);">
          Belum ada Hero yang dibuat. Silakan buat Hero baru!
        </div>
      `;
      return;
    }

    profilesGrid.innerHTML = profiles.map(p => `
      <div class="profile-card" data-id="${p.id}">
        <div class="profile-card-avatar">${p.avatar}</div>
        <div class="profile-card-info">
          <div class="profile-card-name">${p.name}</div>
          <div class="profile-card-role">${p.role}</div>
          <div class="profile-card-stats">Lv. ${p.level} — ${p.xp} XP</div>
        </div>
        <div class="profile-card-badge ${p.isOnline ? 'online' : 'offline'}">
          ${p.isOnline ? '🌐 Online' : '📴 Offline'}
        </div>
        <button class="btn-delete-profile" data-id="${p.id}" title="Hapus profil">✕</button>
      </div>
    `).join('');

    // Event handler untuk klik kartu profil (pilih profil)
    profilesGrid.querySelectorAll('.profile-card').forEach(card => {
      card.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-delete-profile')) return;

        const profileId = card.dataset.id;
        try {
          await switchProfile(profileId);
          showToast('Profil dimuat! 🦸', 'success');
          goToDashboard();
        } catch (err) {
          console.error(err);
          showToast('Gagal memuat profil', 'error');
        }
      });
    });

    // Event handler untuk menghapus profil
    profilesGrid.querySelectorAll('.btn-delete-profile').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const profileId = btn.dataset.id;
        const profile = profiles.find(p => p.id === profileId);
        
        if (confirm(`Apakah Anda yakin ingin menghapus profil Hero "${profile ? profile.name : ''}"? Semua progres akan hilang permanen!`)) {
          const success = await deleteProfile(profileId);
          if (success) {
            showToast('Profil berhasil dihapus.', 'info');
            showProfileSelectPage();
          } else {
            showToast('Gagal menghapus profil.', 'error');
          }
        }
      });
    });

  } catch (err) {
    console.error(err);
    profilesGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 20px; color: var(--red);">Gagal memuat profil.</div>';
  }
}

/**
 * Inisialisasi halaman autentikasi (Login & Register)
 */
function initAuthPage() {
  const authBack = document.getElementById('authBack');
  if (authBack) {
    authBack.addEventListener('click', () => {
      showPage('profile-select-page');
    });
  }

  // Switch tab login vs register
  const tabLoginBtn = document.getElementById('tabLoginBtn');
  const tabRegisterBtn = document.getElementById('tabRegisterBtn');
  const loginFormContainer = document.getElementById('loginFormContainer');
  const registerFormContainer = document.getElementById('registerFormContainer');

  if (tabLoginBtn && tabRegisterBtn && loginFormContainer && registerFormContainer) {
    tabLoginBtn.addEventListener('click', () => {
      tabLoginBtn.classList.add('active');
      tabRegisterBtn.classList.remove('active');
      loginFormContainer.style.display = 'block';
      registerFormContainer.style.display = 'none';
    });

    tabRegisterBtn.addEventListener('click', () => {
      tabRegisterBtn.classList.add('active');
      tabLoginBtn.classList.remove('active');
      registerFormContainer.style.display = 'block';
      loginFormContainer.style.display = 'none';
    });
  }

  // Handle register avatar grid
  const registerAvatarGrid = document.getElementById('registerAvatarGrid');
  if (registerAvatarGrid) {
    registerAvatarGrid.querySelectorAll('.avatar-option').forEach(opt => {
      opt.addEventListener('click', () => {
        registerAvatarGrid.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });
  }

  // Handle register role grid
  const registerRoleGrid = document.getElementById('registerRoleGrid');
  if (registerRoleGrid) {
    registerRoleGrid.querySelectorAll('.role-option').forEach(opt => {
      opt.addEventListener('click', () => {
        registerRoleGrid.querySelectorAll('.role-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });
  }

  // Submit Login
  const submitLoginBtn = document.getElementById('submitLoginBtn');
  if (submitLoginBtn) {
    submitLoginBtn.addEventListener('click', handleOnlineLogin);
  }

  // Submit Register
  const submitRegisterBtn = document.getElementById('submitRegisterBtn');
  if (submitRegisterBtn) {
    submitRegisterBtn.addEventListener('click', handleOnlineRegister);
  }
}

/**
 * Handle login online via GAS
 */
async function handleOnlineLogin() {
  const usernameInput = document.getElementById('loginUsername');
  const passwordInput = document.getElementById('loginPassword');
  
  const username = usernameInput?.value?.trim();
  const password = passwordInput?.value;

  if (!username || !password) {
    showToast('Username dan password harus diisi!', 'error');
    return;
  }

  const submitBtn = document.getElementById('submitLoginBtn');
  if (submitBtn) submitBtn.disabled = true;
  showToast('Menghubungkan ke Google Sheets...', 'info');

  try {
    const res = await loginOnline(username, password);
    if (res.status === 'success') {
      showToast('Login Berhasil! Mengunduh progres...', 'success');
      
      // Impor profil online ke IndexedDB
      const importedState = res.state || {};
      appState = await importOnlineProfile(username, importedState);
      saveState(appState);

      // Reset form
      if (usernameInput) usernameInput.value = '';
      if (passwordInput) passwordInput.value = '';

      goToDashboard();
    } else {
      showToast(res.message || 'Login gagal.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Gagal terhubung ke Google Sheets API.', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

/**
 * Handle register online via GAS
 */
async function handleOnlineRegister() {
  const usernameInput = document.getElementById('registerUsername');
  const passwordInput = document.getElementById('registerPassword');
  const nameInput = document.getElementById('registerName');
  
  const username = usernameInput?.value?.trim();
  const password = passwordInput?.value;
  const name = nameInput?.value?.trim();

  if (!username || !password || !name) {
    showToast('Username, password, dan nama tampilan harus diisi!', 'error');
    return;
  }

  // Ambil avatar & role
  const activeAvatar = document.querySelector('#registerAvatarGrid .avatar-option.active');
  const avatar = activeAvatar?.dataset?.avatar || '🦸';

  const activeRole = document.querySelector('#registerRoleGrid .role-option.active');
  const role = activeRole?.dataset?.role || 'Profesional';

  const submitBtn = document.getElementById('submitRegisterBtn');
  if (submitBtn) submitBtn.disabled = true;
  showToast('Mendaftarkan akun ke Google Sheets...', 'info');

  try {
    const res = await registerOnline(username, password);
    if (res.status === 'success') {
      showToast('Registrasi Berhasil! Membuat profil lokal...', 'success');
      
      // Buat profile baru dengan status isOnline = true
      appState = await createProfile(name, avatar, role, true, username);
      saveState(appState);

      // Reset form
      if (usernameInput) usernameInput.value = '';
      if (passwordInput) passwordInput.value = '';
      if (nameInput) nameInput.value = '';

      goToDashboard();
    } else {
      showToast(res.message || 'Registrasi gagal.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Gagal terhubung ke Google Sheets API.', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

/**
 * Inisialisasi aplikasi saat DOM siap
 */
async function init() {
  // Load state and open IndexedDB
  const storageOk = await initStorage();
  if (!storageOk) {
    showToast('Gagal memuat penyimpanan lokal!', 'error');
  }

  // Load state dari cache
  appState = loadState();

  // Terapkan tema tersimpan
  applyTheme(appState);

  // Wire semua event
  wireEvents();

  // Inisialisasi setup page
  initSetupPage();

  // Inisialisasi profile select page
  initProfileSelectPage();

  // Inisialisasi auth page
  initAuthPage();

  // Animasi landing page
  initVirusParticles();

  // Tentukan halaman awal
  const activeId = getActiveProfileId();
  if (activeId && appState && appState.player && appState.player.name) {
    // Pemain sudah punya profil aktif — langsung ke dashboard
    goToDashboard();
  } else {
    // Cek apakah ada profil tersimpan
    const profiles = await getProfiles();
    if (profiles.length > 0) {
      showProfileSelectPage();
    } else {
      // Pemain baru — tampilkan landing
      showPage('landing-page');
    }
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
