/**
 * storage.js — Prompt Hero
 * Semua operasi LocalStorage dipusatkan di sini.
 * Mudah diganti dengan Firebase/Supabase di Phase 2.
 */

const STORAGE_KEY = 'promptHeroData';

/** State default untuk pemain baru */
const DEFAULT_STATE = {
  player: {
    name: '',
    avatar: '🦸',
    role: 'Profesional',
    createdAt: null,
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
    }
  },
  dailyChallenge: {
    date: null,
    completed: false,
    xpBonus: 0,
  },
};

/**
 * Membaca semua data dari localStorage
 * @returns {Object} state lengkap
 */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const saved = JSON.parse(raw);
    // Merge dengan default agar field baru selalu ada
    return deepMerge(structuredClone(DEFAULT_STATE), saved);
  } catch (e) {
    console.error('Error loading state:', e);
    return structuredClone(DEFAULT_STATE);
  }
}

/**
 * Menyimpan seluruh state ke localStorage
 * @param {Object} state
 */
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Error saving state:', e);
  }
}

/**
 * Menghapus semua data (reset)
 */
export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

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
