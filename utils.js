/**
 * utils.js — Prompt Hero
 * Fungsi utilitas: audio, animasi, toast, confetti, helpers.
 */

// ── Audio Context ──────────────────────────────────────────

let audioCtx = null;

/**
 * Inisialisasi Web Audio API context
 */
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Mainkan nada sederhana menggunakan Web Audio API (tanpa file aset)
 * @param {string} type - 'levelup'|'success'|'fail'|'coin'|'achievement'|'click'
 */
export function playSound(type) {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;

    const sounds = {
      levelup: () => playMelody(ctx, [523, 659, 784, 1047], 0.15),
      success: () => playTone(ctx, 880, 0.3, 'sine', 0.12),
      fail: () => playTone(ctx, 220, 0.5, 'sawtooth', 0.08),
      coin: () => playTone(ctx, 1200, 0.1, 'sine', 0.1),
      achievement: () => playMelody(ctx, [659, 784, 988, 1319], 0.12),
      click: () => playTone(ctx, 600, 0.05, 'sine', 0.05),
    };

    sounds[type]?.();
  } catch (e) {
    // Audio gagal, tidak perlu error — lanjutkan saja
  }
}

function playTone(ctx, freq, duration, type = 'sine', volume = 0.1) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playMelody(ctx, freqs, delay = 0.12) {
  freqs.forEach((freq, i) => {
    setTimeout(() => playTone(ctx, freq, 0.2, 'sine', 0.1), i * (delay * 1000));
  });
}

// ── Toast Notifications ──────────────────────────────────────

/**
 * Tampilkan toast notification
 * @param {string} message
 * @param {'success'|'error'|'info'|'reward'} type
 * @param {number} duration - ms
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: '💡', reward: '🎁' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || '💡'}</span><span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Confetti ─────────────────────────────────────────────────

const CONFETTI_COLORS = [
  '#ff6b00', '#ffd700', '#00e676', '#4d9fff', '#ff3b3b',
  '#a855f7', '#ec4899', '#06b6d4',
];

/**
 * Tampilkan animasi confetti dalam container
 * @param {HTMLElement} container
 * @param {number} count - jumlah partikel
 */
export function launchConfetti(container, count = 60) {
  if (!container) return;

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.cssText = `
        left: ${Math.random() * 100}%;
        background: ${CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]};
        width: ${4 + Math.random() * 8}px;
        height: ${4 + Math.random() * 8}px;
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        animation-duration: ${0.8 + Math.random() * 1.5}s;
        animation-delay: ${Math.random() * 0.5}s;
      `;
      container.appendChild(piece);
      setTimeout(() => piece.remove(), 2500);
    }, i * 20);
  }
}

// ── XP Animation ─────────────────────────────────────────────

/**
 * Animasi angka counter dari nilai awal ke nilai akhir
 * @param {HTMLElement} el
 * @param {number} from
 * @param {number} to
 * @param {number} duration - ms
 */
export function animateCounter(el, from, to, duration = 1000) {
  if (!el) return;
  const start = performance.now();
  const update = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(from + (to - from) * eased);
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

/**
 * Animasi XP bar
 * @param {HTMLElement} barEl
 * @param {number} percent - 0-100
 */
export function animateXPBar(barEl, percent) {
  if (!barEl) return;
  barEl.style.width = '0%';
  requestAnimationFrame(() => {
    setTimeout(() => {
      barEl.style.width = `${Math.min(100, percent)}%`;
    }, 100);
  });
}

// ── Score Animation ───────────────────────────────────────────

/**
 * Animasi score muncul dengan efek dramatic
 * @param {HTMLElement} scoreEl
 * @param {number} targetScore
 */
export function animateScore(scoreEl, targetScore) {
  if (!scoreEl) return;
  animateCounter(scoreEl, 0, targetScore, 1200);
}

// ── DOM Helpers ───────────────────────────────────────────────

/**
 * Toggle class active pada elemen, hapus dari siblings
 * @param {HTMLElement} el
 * @param {string} parentSelector - selector untuk parent container
 * @param {string} siblingSelector - selector untuk siblings
 */
export function setActive(el, siblingSelector) {
  const parent = el.parentElement;
  if (!parent) return;
  parent.querySelectorAll(siblingSelector).forEach(s => s.classList.remove('active'));
  el.classList.add('active');
}

/**
 * Format tanggal Indonesia
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('id-ID', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Buat template streak display
 * @param {number} days
 * @returns {string} emoji + text
 */
export function streakDisplay(days) {
  if (days >= 100) return '🔥 ' + days + ' hari — LEGENDA!';
  if (days >= 30) return '🔥 ' + days + ' hari — MASTER!';
  if (days >= 7) return '🔥 ' + days + ' hari — HEBAT!';
  if (days >= 3) return '🔥 ' + days + ' hari';
  if (days === 1) return '🔥 1 hari';
  return '❄️ Belum mulai';
}

/**
 * Debounce function
 * @param {Function} fn
 * @param {number} delay
 */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Scroll smooth ke element
 * @param {HTMLElement|string} target - element atau selector
 */
export function scrollTo(target) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Hitung XP yang dibutuhkan untuk level selanjutnya
 * @param {number} level
 */
export function xpForLevel(level) {
  return level * 200;
}

/**
 * Generate data leaderboard dummy (untuk demo)
 */
export function generateMockLeaderboard() {
  const names = [
    'Andi Gunawan', 'Siti Rahma', 'Budi Santoso', 'Dewi Kartika',
    'Reza Pratama', 'Ayu Lestari', 'Dika Mahendra', 'Fitri Nanda',
    'Kevin Putra', 'Maya Indah',
  ];
  const avatars = ['🦸', '🧙', '👩‍💻', '🤖', '🦊', '🐉', '⚡', '🔮', '🧑‍💼', '👩‍🔬'];

  return names.map((name, i) => ({
    rank: i + 1,
    name,
    avatar: avatars[i],
    xp: Math.floor(5000 - i * 400 + Math.random() * 100),
    score: Math.floor(98 - i * 3 + Math.random() * 5),
    streak: Math.floor(30 - i * 2 + Math.random() * 5),
    level: Math.floor(20 - i * 1.5),
  }));
}
