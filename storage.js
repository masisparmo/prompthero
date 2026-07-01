/**
 * storage.js — Prompt Hero
 * Penyimpanan menggunakan IndexedDB untuk mendukung multi-profil
 * dengan pola sinkronisasi Memory Cache untuk performa instan,
 * ditambah sinkronisasi real-time ke Google Sheets via Google Apps Script.
 */

const DB_NAME = 'PromptHeroDB';
const DB_VERSION = 1;
const STORE_NAME = 'user_states';

// GANTI DENGAN URL GOOGLE APPS SCRIPT WEB APP ANDA SEBAGAI DEVELOPER
const DEVELOPER_GAS_URL = 'https://script.google.com/macros/s/AKfycbw93YtZcOcyvsb5gmEGpAin0jkBHkuDLkBF0Tpq3WajpgOinI8zfRr9hLaLlMA-AJ3CkQ/exec';

let db = null;
let activeProfileId = null;
let activeState = null;

/** State default untuk pemain baru */
const DEFAULT_STATE = {
  player: {
    name: '',
    avatar: '🦸',
    role: 'Profesional',
    createdAt: null,
    isOnline: false,
    username: '',
  },
  progress: {
    currentLevel: 1,
    completedLevels: [],    // array of level numbers
    levelScores: {},        // { levelNum: highScore }
    levelStars: {},         // { levelNum: starCount }
  },
  stats: {
    xp: 0,
    coins: 0,
    hearts: 5,
    maxHearts: 5,
    lastHeartRegen: null,
  },
  achievements: [],         // array of achievement ids
  streak: {
    count: 0,
    lastPlayDate: null,
    longestStreak: 0,
  },
  history: [],              // array of { level, prompt, score, date }
  settings: {
    theme: 'dark',
    sound: true,
    apiKeys: {
      gemini: [],
      groq: []
    },
    googleSheetsSyncUrl: '',
  },
  dailyChallenge: {
    date: null,
    completed: false,
    xpBonus: 0,
  },
};

/**
 * Inisialisasi IndexedDB dan muat profil aktif jika ada
 * @returns {Promise<boolean>} true jika berhasil
 */
export function initStorage() {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (e) => {
      console.error('IndexedDB open error:', e);
      resolve(false);
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      
      // Ambil active profile id dari localStorage
      activeProfileId = localStorage.getItem('promptHeroActiveProfileId');
      
      if (activeProfileId) {
        // Muat state profil tersebut
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const getReq = store.get(activeProfileId);

        getReq.onsuccess = () => {
          if (getReq.result) {
            activeState = deepMerge(structuredClone(DEFAULT_STATE), getReq.result.state);
            // Sinkronkan tema
            const theme = activeState.settings?.theme || 'dark';
            document.documentElement.setAttribute('data-theme', theme);
          } else {
            // Profil tidak ditemukan di DB
            localStorage.removeItem('promptHeroActiveProfileId');
            activeProfileId = null;
            activeState = null;
          }
          resolve(true);
        };

        getReq.onerror = () => {
          resolve(true);
        };
      } else {
        resolve(true);
      }
    };

    request.onupgradeneeded = (e) => {
      const dbInstance = e.target.result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Mendapatkan ID profil aktif saat ini
 * @returns {string|null} ID profil
 */
export function getActiveProfileId() {
  return activeProfileId;
}

/**
 * Mengambil daftar semua profil dari database
 * @returns {Promise<Array>} daftar metadata profil
 */
export function getProfiles() {
  return new Promise((resolve) => {
    if (!db) {
      resolve([]);
      return;
    }

    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const profiles = (request.result || []).map(record => ({
        id: record.id,
        name: record.name,
        avatar: record.avatar,
        role: record.role,
        lastPlayed: record.lastPlayed,
        xp: record.xp,
        level: record.level,
        isOnline: record.isOnline || false,
        username: record.username || ''
      }));
      // Sort berdasarkan waktu bermain terakhir (terbaru dulu)
      profiles.sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed));
      resolve(profiles);
    };

    request.onerror = () => {
      resolve([]);
    };
  });
}

/**
 * Berpindah ke profil tertentu
 * @param {string} profileId
 * @returns {Promise<Object>} state profil baru
 */
export function switchProfile(profileId) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(profileId);

    request.onsuccess = () => {
      if (request.result) {
        activeProfileId = profileId;
        activeState = deepMerge(structuredClone(DEFAULT_STATE), request.result.state);
        localStorage.setItem('promptHeroActiveProfileId', profileId);
        resolve(activeState);
      } else {
        reject(new Error('Profile not found'));
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Membuat profil baru (bisa offline atau online)
 * @param {string} name
 * @param {string} avatar
 * @param {string} role
 * @param {boolean} isOnline
 * @param {string} username
 * @returns {Promise<Object>} state profil baru
 */
export function createProfile(name, avatar, role, isOnline = false, username = '') {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const newId = 'hero_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const newState = structuredClone(DEFAULT_STATE);
    newState.player.name = name;
    newState.player.avatar = avatar;
    newState.player.role = role;
    newState.player.createdAt = new Date().toISOString();
    newState.player.isOnline = isOnline;
    newState.player.username = username;

    const record = {
      id: newId,
      name,
      avatar,
      role,
      lastPlayed: new Date().toISOString(),
      xp: 0,
      level: 1,
      isOnline,
      username,
      state: newState
    };

    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(record);

    request.onsuccess = () => {
      activeProfileId = newId;
      activeState = newState;
      localStorage.setItem('promptHeroActiveProfileId', newId);
      resolve(newState);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Membuat profil baru berdasarkan state dari cloud (saat login online)
 * @param {string} username
 * @param {Object} cloudState
 * @returns {Promise<Object>} state profil yang berhasil diimpor
 */
export function importOnlineProfile(username, cloudState) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const newId = 'hero_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const newState = deepMerge(structuredClone(DEFAULT_STATE), cloudState);
    newState.player.isOnline = true;
    newState.player.username = username;

    const levelInfo = calcLevel(newState.stats?.xp || 0);
    const record = {
      id: newId,
      name: newState.player.name,
      avatar: newState.player.avatar,
      role: newState.player.role,
      lastPlayed: new Date().toISOString(),
      xp: newState.stats?.xp || 0,
      level: levelInfo.level,
      isOnline: true,
      username,
      state: newState
    };

    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(record);

    request.onsuccess = () => {
      activeProfileId = newId;
      activeState = newState;
      localStorage.setItem('promptHeroActiveProfileId', newId);
      resolve(newState);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Menghapus profil dari database
 * @param {string} profileId
 * @returns {Promise<boolean>} true jika berhasil
 */
export function deleteProfile(profileId) {
  return new Promise((resolve) => {
    if (!db) {
      resolve(false);
      return;
    }

    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(profileId);

    request.onsuccess = () => {
      if (activeProfileId === profileId) {
        activeProfileId = null;
        activeState = null;
        localStorage.removeItem('promptHeroActiveProfileId');
      }
      resolve(true);
    };

    request.onerror = () => {
      resolve(false);
    };
  });
}

/**
 * Membaca state aktif dari cache memori secara sinkron
 * @returns {Object} state lengkap
 */
export function loadState() {
  if (!activeState) {
    return structuredClone(DEFAULT_STATE);
  }
  return activeState;
}

/**
 * Menyimpan seluruh state ke memory cache dan menulis ke IndexedDB asinkron
 * Serta memicu sinkronisasi Google Sheets jika akun online terhubung
 * @param {Object} state
 */
export function saveState(state) {
  activeState = state;
  
  if (!db || !activeProfileId) return;

  const levelInfo = calcLevel(state.stats?.xp || 0);
  const record = {
    id: activeProfileId,
    name: state.player.name,
    avatar: state.player.avatar,
    role: state.player.role,
    lastPlayed: new Date().toISOString(),
    xp: state.stats?.xp || 0,
    level: levelInfo.level,
    isOnline: state.player.isOnline || false,
    username: state.player.username || '',
    state: state
  };

  try {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(record);

    // Kirim sinkronisasi ke Google Sheets secara asinkron (background sync)
    if (state.player?.isOnline && DEVELOPER_GAS_URL && DEVELOPER_GAS_URL !== 'https://script.google.com/macros/s/AKfycbz_DEV_PLACEHOLDER/exec') {
      syncOnline(state.player.username, state)
        .then(res => {
          if (res.status === 'success') {
            console.log('⚡ Real-time sync to Google Sheets successful');
          } else {
            console.warn('⚠️ Google Sheets sync warning:', res.message);
          }
        })
        .catch(err => {
          console.error('❌ Google Sheets sync failed:', err);
        });
    }
  } catch (e) {
    console.error('Error background saving state:', e);
  }
}

/**
 * Menghapus data aktif saat ini (logout / keluar profil)
 */
export function clearState() {
  activeState = null;
  activeProfileId = null;
  localStorage.removeItem('promptHeroActiveProfileId');
}

// ── Google Sheets Sync API (GAS Interface) ──

/**
 * Mendaftarkan akun online baru di Google Sheets via GAS
 * Menggunakan content-type text/plain untuk melewati CORS preflight OPTIONS request
 */
export function registerOnline(username, password) {
  return fetch(DEVELOPER_GAS_URL, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action: 'register',
      username,
      password
    })
  }).then(res => res.json());
}

/**
 * Melakukan verifikasi login akun online via GAS
 */
export function loginOnline(username, password) {
  return fetch(DEVELOPER_GAS_URL, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action: 'login',
      username,
      password
    })
  }).then(res => res.json());
}

/**
 * Sinkronisasi state progres game ke Google Sheets via GAS
 */
export function syncOnline(username, state) {
  return fetch(DEVELOPER_GAS_URL, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action: 'sync',
      username,
      state
    })
  }).then(res => res.json());
}

// ── Gameplay State Updaters ──

/**
 * Menambah XP ke state dan menyimpannya
 * @param {Object} state
 * @param {number} amount
 */
export function addXP(state, amount) {
  state.stats.xp = (state.stats.xp || 0) + amount;
  saveState(state);
}

/**
 * Menambah Coin ke state
 * @param {Object} state
 * @param {number} amount
 */
export function addCoins(state, amount) {
  state.stats.coins = (state.stats.coins || 0) + amount;
  saveState(state);
}

/**
 * Menyimpan hasil level (skor tertinggi)
 * @param {Object} state
 * @param {number} levelNum
 * @param {number} score
 */
export function saveLevelScore(state, levelNum, score) {
  const prev = state.progress.levelScores[levelNum] || 0;
  if (score > prev) {
    state.progress.levelScores[levelNum] = score;
  }
  if (!state.progress.completedLevels.includes(levelNum)) {
    state.progress.completedLevels.push(levelNum);
  }

  // Hitung bintang
  let stars = 1;
  if (score >= 90) stars = 5;
  else if (score >= 80) stars = 4;
  else if (score >= 70) stars = 3;
  else if (score >= 60) stars = 2;
  state.progress.levelStars[levelNum] = Math.max(state.progress.levelStars[levelNum] || 0, stars);

  // Update current level
  if (score >= 80 && levelNum >= (state.progress.currentLevel || 1)) {
    state.progress.currentLevel = Math.min(levelNum + 1, 20);
  }

  saveState(state);
}

/**
 * Menambah entry ke histori prompt
 * @param {Object} state
 * @param {Object} entry - { level, levelName, prompt, score, feedback }
 */
export function addHistory(state, entry) {
  state.history = state.history || [];
  state.history.unshift({
    ...entry,
    date: new Date().toISOString(),
  });
  // Batasi 50 entri terakhir
  if (state.history.length > 50) state.history = state.history.slice(0, 50);
  saveState(state);
}

/**
 * Memperbarui streak harian
 * @param {Object} state
 */
export function updateStreak(state) {
  const today = new Date().toDateString();
  const last = state.streak?.lastPlayDate;

  if (last === today) return; // sudah main hari ini

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (last === yesterday.toDateString()) {
    state.streak.count = (state.streak.count || 0) + 1;
  } else {
    state.streak.count = 1; // reset streak
  }

  state.streak.lastPlayDate = today;
  state.streak.longestStreak = Math.max(
    state.streak.longestStreak || 0,
    state.streak.count
  );
  saveState(state);
}

/**
 * Menghilangkan satu hati
 * @param {Object} state
 * @returns {number} sisa hati
 */
export function loseHeart(state) {
  state.stats.hearts = Math.max(0, (state.stats.hearts || 5) - 1);
  saveState(state);
  return state.stats.hearts;
}

/**
 * Menambah achievement jika belum dimiliki
 * @param {Object} state
 * @param {string} achId
 * @returns {boolean} true jika baru diunlock
 */
export function unlockAchievement(state, achId) {
  if (state.achievements.includes(achId)) return false;
  state.achievements.push(achId);
  saveState(state);
  return true;
}

/**
 * Mengambil kalkulasi level dari total XP
 * @param {number} xp
 * @returns {{ level, progress, nextLevelXP }}
 */
export function calcLevel(xp) {
  const xpPerLevel = 200;
  const level = Math.floor(xp / xpPerLevel) + 1;
  const progress = ((xp % xpPerLevel) / xpPerLevel) * 100;
  const nextLevelXP = xpPerLevel - (xp % xpPerLevel);
  return { level: Math.min(level, 99), progress, nextLevelXP };
}

// ── Helpers ──

/**
 * Deep merge dua objek (target dimodifikasi)
 */
function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
