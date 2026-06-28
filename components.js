/**
 * components.js — Prompt Hero
 * Semua fungsi render komponen UI.
 * Setiap komponen adalah fungsi murni yang menghasilkan HTML string atau DOM element.
 */

import { LEVELS, getLevelStatus } from './level.js';
import { calcLevel } from './storage.js';
import { generateMockLeaderboard, formatDate, streakDisplay } from './utils.js';

// ── Achievement Definitions ───────────────────────────────────

export const ACHIEVEMENTS = [
  {
    id: 'first_level',
    icon: '🎯',
    title: 'Langkah Pertama',
    desc: 'Selesaikan level pertama',
    condition: (state) => state.progress.completedLevels?.includes(1),
  },
  {
    id: 'prompt_beginner',
    icon: '📝',
    title: 'Prompt Beginner',
    desc: 'Selesaikan 5 level',
    condition: (state) => (state.progress.completedLevels?.length || 0) >= 5,
  },
  {
    id: 'craft_master',
    icon: '🛠️',
    title: 'CRAFT Master',
    desc: 'Kuasai level CRAFT (Level 7)',
    condition: (state) => state.progress.completedLevels?.includes(7),
  },
  {
    id: 'perfect_score',
    icon: '💯',
    title: 'Perfect Prompt',
    desc: 'Raih skor 100 di satu level',
    condition: (state) => Object.values(state.progress.levelScores || {}).some(s => s >= 100),
  },
  {
    id: 'image_wizard',
    icon: '🎨',
    title: 'Image Wizard',
    desc: 'Kuasai Prompt Image (Level 11)',
    condition: (state) => state.progress.completedLevels?.includes(11),
  },
  {
    id: 'coding_hero',
    icon: '💻',
    title: 'Coding Hero',
    desc: 'Kuasai Prompt Coding (Level 14)',
    condition: (state) => state.progress.completedLevels?.includes(14),
  },
  {
    id: 'streak_7',
    icon: '🔥',
    title: 'On Fire!',
    desc: 'Streak 7 hari berturut-turut',
    condition: (state) => (state.streak?.count || 0) >= 7,
  },
  {
    id: 'agent_architect',
    icon: '🤖',
    title: 'Agent Architect',
    desc: 'Kuasai Prompt Agent (Level 15)',
    condition: (state) => state.progress.completedLevels?.includes(15),
  },
  {
    id: 'context_engineer',
    icon: '🧬',
    title: 'Context Engineer',
    desc: 'Kuasai Context Engineering (Level 16)',
    condition: (state) => state.progress.completedLevels?.includes(16),
  },
  {
    id: 'prompt_legend',
    icon: '👑',
    title: 'Prompt Legend',
    desc: 'Selesaikan semua 20 level!',
    condition: (state) => (state.progress.completedLevels?.length || 0) >= 20,
  },
];

// ── Level Map ─────────────────────────────────────────────────

/**
 * Render grid level map di dashboard
 * @param {Object} state - game state
 * @param {Function} onLevelClick - callback(levelNum)
 */
export function renderLevelGrid(state, onLevelClick) {
  const container = document.getElementById('levelGrid');
  if (!container) return;

  const currentLevel = state.progress.currentLevel || 1;

  container.innerHTML = LEVELS.map(level => {
    const status = getLevelStatus(level.num, state.progress);
    const isLocked = level.num > currentLevel && !state.progress.completedLevels?.includes(level.num);
    const isCurrent = level.num === currentLevel;
    const isCompleted = state.progress.completedLevels?.includes(level.num);
    const stars = state.progress.levelStars?.[level.num] || 0;
    const highScore = state.progress.levelScores?.[level.num] || 0;

    const starsHTML = stars > 0
      ? '⭐'.repeat(stars) + '☆'.repeat(5 - stars)
      : '';

    return `
      <div
        class="level-card ${isLocked ? 'locked' : ''} ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}"
        data-level="${level.num}"
        title="${level.name}"
      >
        <div class="level-num">Level ${level.num}</div>
        <div class="level-icon">${level.icon}</div>
        <div class="level-name">${level.name}</div>
        ${highScore > 0 ? `<div class="level-stars">${starsHTML} <span style="font-size:0.75rem;color:var(--orange)">${highScore}pt</span></div>` : ''}
        <div class="level-xp">+${level.xpReward} XP</div>
        <div class="level-status">${status}</div>
      </div>
    `;
  }).join('');

  // Event listeners
  container.querySelectorAll('.level-card:not(.locked)').forEach(card => {
    card.addEventListener('click', () => {
      const num = parseInt(card.dataset.level);
      onLevelClick(num);
    });
  });
}

// ── Achievements ──────────────────────────────────────────────

/**
 * Render grid achievement
 * @param {Object} state
 */
export function renderAchievements(state) {
  const container = document.getElementById('achievementsGrid');
  if (!container) return;

  container.innerHTML = ACHIEVEMENTS.map(ach => {
    const unlocked = state.achievements?.includes(ach.id) || ach.condition(state);

    return `
      <div class="achievement-card ${unlocked ? 'unlocked' : 'locked'}">
        <div class="ach-emoji">${ach.icon}</div>
        <div class="ach-title">${ach.title}</div>
        <div class="ach-subtitle">${ach.desc}</div>
        ${unlocked ? '<div style="margin-top:8px;font-size:0.75rem;color:var(--gold)">✅ Diraih!</div>' : ''}
      </div>
    `;
  }).join('');
}

// ── Leaderboard ───────────────────────────────────────────────

/**
 * Render daftar leaderboard
 * @param {Object} state
 * @param {string} tab - 'xp'|'score'|'streak'
 */
export function renderLeaderboard(state, tab = 'xp') {
  const container = document.getElementById('leaderboardList');
  if (!container) return;

  const mockData = generateMockLeaderboard();

  // Tambahkan pemain saat ini ke data
  const playerLevel = calcLevel(state.stats.xp || 0);
  const playerEntry = {
    rank: 0,
    name: state.player.name || 'Kamu',
    avatar: state.player.avatar || '🦸',
    xp: state.stats.xp || 0,
    score: Math.max(...Object.values(state.progress.levelScores || {0:0})),
    streak: state.streak?.count || 0,
    level: playerLevel.level,
    isPlayer: true,
  };

  // Sort berdasarkan tab
  const sortKey = { xp: 'xp', score: 'score', streak: 'streak' }[tab] || 'xp';
  const combined = [...mockData, playerEntry].sort((a, b) => b[sortKey] - a[sortKey]);

  // Assign rank
  combined.forEach((item, i) => item.rank = i + 1);

  container.innerHTML = combined.slice(0, 10).map(item => {
    const rankClass = item.rank === 1 ? 'gold' : item.rank === 2 ? 'silver' : item.rank === 3 ? 'bronze' : '';
    const rankIcon = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : item.rank;
    const value = tab === 'xp' ? `${item.xp} XP` : tab === 'score' ? `${item.score} pt` : `${item.streak} hari`;

    return `
      <div class="lb-item ${item.isPlayer ? 'style="border-color:var(--orange);background:rgba(255,107,0,0.05)"' : ''}">
        <div class="lb-rank ${rankClass}">${rankIcon}</div>
        <div class="lb-avatar">${item.avatar}</div>
        <div class="lb-name">${item.name} ${item.isPlayer ? '(Kamu)' : ''}</div>
        <div class="lb-val">${value}</div>
      </div>
    `;
  }).join('');
}

// ── Daily Challenge ───────────────────────────────────────────

/** Data daily challenge per hari */
const DAILY_CHALLENGES = [
  {
    title: 'Prompt Sehari-hari',
    prompt: 'Buat prompt untuk meminta AI membantu kamu menyusun jadwal belajar harian yang produktif selama 1 minggu, dengan mempertimbangkan waktu istirahat, olahraga, dan hobi.',
    xpBonus: 75,
    hint: 'Gunakan semua elemen CRAFT!',
  },
  {
    title: 'Prompt Bisnis Hari Ini',
    prompt: 'Kamu punya toko online yang menjual aksesoris handmade. Buat prompt untuk AI agar dapat membuat deskripsi produk yang menarik untuk 5 produk berbeda sekaligus.',
    xpBonus: 75,
    hint: 'Fokus pada Context dan Format output!',
  },
  {
    title: 'Prompt Kreatif',
    prompt: 'Buat prompt untuk AI agar menghasilkan ide konten TikTok tentang kesehatan mental untuk remaja Indonesia. Perlu minimal 10 ide yang unik dan tidak klise.',
    xpBonus: 100,
    hint: 'Tambahkan Test Criteria yang spesifik!',
  },
  {
    title: 'Prompt Teknis',
    prompt: 'Kamu ingin AI membantu debug kode Python yang bermasalah. Buat prompt template yang bisa digunakan berulang kali untuk berbagai jenis bug.',
    xpBonus: 100,
    hint: 'Role yang tepat sangat penting di sini!',
  },
  {
    title: 'Prompt Pendidikan',
    prompt: 'Buat prompt untuk AI agar dapat menjelaskan konsep "compound interest" kepada siswa SMA dengan cara yang mudah dipahami, menggunakan analogi kehidupan nyata di Indonesia.',
    xpBonus: 75,
    hint: 'Pikirkan target audiens dengan spesifik!',
  },
  {
    title: 'Prompt Research',
    prompt: 'Kamu harus presentasi tentang dampak AI terhadap lapangan kerja di Indonesia. Buat prompt untuk AI agar membantu riset dan menyusun data yang kamu butuhkan.',
    xpBonus: 100,
    hint: 'Format dan Test Criteria sangat penting!',
  },
  {
    title: 'Prompt Email Profesional',
    prompt: 'Buat prompt master untuk AI yang bisa digunakan untuk membuat berbagai jenis email profesional (negosiasi, follow-up, complaint, praise) hanya dengan mengubah beberapa parameter.',
    xpBonus: 125,
    hint: 'Ini tantangan tingkat lanjut! Gunakan variabel dalam prompt.',
  },
];

/**
 * Render daily challenge
 * @param {Object} state
 * @param {Function} onStart - callback untuk mulai challenge
 */
export function renderDailyChallenge(state, onStart) {
  const container = document.getElementById('dailyContainer');
  if (!container) return;

  const today = new Date();
  const dayIdx = today.getDay(); // 0-6
  const challenge = DAILY_CHALLENGES[dayIdx];

  const isCompleted = state.dailyChallenge?.date === today.toDateString() && state.dailyChallenge?.completed;

  container.innerHTML = `
    <div class="daily-card">
      <div class="daily-header">
        <div class="daily-icon">📅</div>
        <div>
          <div class="daily-title">${challenge.title}</div>
          <div class="daily-date">${today.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long' })}</div>
        </div>
      </div>

      <div class="daily-xp">+${challenge.xpBonus} XP Bonus</div>

      <div class="daily-prompt">
        <strong>Misi Hari Ini:</strong><br/><br/>
        ${challenge.prompt}
      </div>

      <div style="background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.2);border-radius:8px;padding:12px;margin-bottom:20px;font-size:0.85rem;color:var(--text-muted)">
        💡 <strong>Hint:</strong> ${challenge.hint}
      </div>

      ${isCompleted
        ? '<div style="text-align:center;padding:20px;color:var(--green);font-weight:700;font-size:1.1rem">✅ Challenge hari ini sudah selesai! Sampai jumpa besok!</div>'
        : `<button class="btn-hero btn-full" id="startDailyBtn">⚡ Mulai Daily Challenge!</button>`
      }
    </div>
  `;

  if (!isCompleted) {
    document.getElementById('startDailyBtn')?.addEventListener('click', () => onStart(challenge));
  }
}

// ── History ───────────────────────────────────────────────────

/**
 * Render histori prompt
 * @param {Object} state
 */
export function renderHistory(state) {
  const container = document.getElementById('historyList');
  if (!container) return;

  const history = state.history || [];

  if (history.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📜</div>
        <div class="empty-text">Belum ada histori prompt.<br/>Mulai bermain untuk melihat riwayatmu!</div>
      </div>
    `;
    return;
  }

  container.innerHTML = history.map(item => `
    <div class="history-item">
      <div class="history-header">
        <div class="history-level">Level ${item.level}: ${item.levelName}</div>
        <div class="history-score">
          ${item.score >= 80 ? '✅' : '⚠️'} ${item.score} poin
        </div>
      </div>
      <div class="history-prompt">${escapeHTML(item.prompt)}</div>
      <div style="margin-top:8px;font-size:0.75rem;color:var(--text-muted)">${formatDate(item.date)}</div>
    </div>
  `).join('');
}

// ── Sidebar Stats ─────────────────────────────────────────────

/**
 * Update semua tampilan stats di sidebar
 * @param {Object} state
 */
export function updateSidebarStats(state) {
  const lvlInfo = calcLevel(state.stats?.xp || 0);

  // Player info
  setEl('sidebarAvatar', state.player?.avatar || '🦸');
  setEl('sidebarName', state.player?.name || 'Hero');
  setEl('sidebarRole', state.player?.role || 'Profesional');

  // Stats
  setEl('sidebarXP', state.stats?.xp || 0);
  setEl('sidebarLevel', lvlInfo.level);
  setEl('sidebarCoins', state.stats?.coins || 0);
  setEl('sidebarStreak', state.streak?.count || 0);
  setEl('sidebarHearts', state.stats?.hearts ?? 5);

  // XP Bar
  const xpFill = document.getElementById('xpFill');
  if (xpFill) xpFill.style.width = `${lvlInfo.progress}%`;

  // Hearts in header
  const hearts = state.stats?.hearts ?? 5;
  setEl('heartsDisplay', '❤️'.repeat(hearts) + '🖤'.repeat(Math.max(0, 5 - hearts)));

  // HUD XP (di game page)
  setEl('hudXP', state.stats?.xp || 0);
}

// ── Level Complete Modal ──────────────────────────────────────

/**
 * Tampilkan modal level complete
 * @param {Object} params - { xp, coins, levelName, nextLevelNum, isLastLevel }
 */
export function showLevelCompleteModal({ xp, coins, levelName, nextLevelNum, isLastLevel }) {
  const modal = document.getElementById('levelCompleteModal');
  const rewards = document.getElementById('rewardsDisplay');
  const confetti = document.getElementById('confettiContainer');

  if (!modal) return;

  rewards.innerHTML = `
    <div class="reward-item">
      <div class="reward-value">+${xp}</div>
      <div class="reward-label">⭐ XP</div>
    </div>
    <div class="reward-item">
      <div class="reward-value">+${coins}</div>
      <div class="reward-label">💰 Coin</div>
    </div>
  `;

  // Button teks
  const nextBtn = document.getElementById('nextLevelBtn');
  if (nextBtn) {
    if (isLastLevel) {
      nextBtn.textContent = '🏆 Kamu Prompt Legend!';
      nextBtn.disabled = true;
    } else {
      nextBtn.textContent = `Level ${nextLevelNum} →`;
    }
    nextBtn.dataset.nextLevel = nextLevelNum;
  }

  modal.style.display = 'flex';

  // Confetti!
  import('./utils.js').then(({ launchConfetti }) => {
    launchConfetti(confetti, 80);
  });
}

// ── Achievement Modal ─────────────────────────────────────────

/**
 * Tampilkan achievement modal
 * @param {Object} achievement
 */
export function showAchievementModal(achievement) {
  const modal = document.getElementById('achievementModal');
  if (!modal) return;

  setEl('achIcon', achievement.icon);
  setEl('achName', achievement.title);
  setEl('achDesc', achievement.desc);

  modal.style.display = 'flex';
}

// ── CRAFT Panel Content ───────────────────────────────────────

/** Map CRAFT labels */
const CRAFT_LABELS = {
  context: { label: 'Context', desc: 'Informasi latar belakang dan situasi', color: '#4d9fff' },
  role: { label: 'Role', desc: 'Peran atau persona yang diberikan ke AI', color: '#a855f7' },
  action: { label: 'Action', desc: 'Apa yang harus AI lakukan secara spesifik', color: '#ff6b00' },
  format: { label: 'Format', desc: 'Bagaimana output harus disajikan', color: '#00e676' },
  test: { label: 'Test Criteria', desc: 'Kriteria keberhasilan yang terukur', color: '#ffd700' },
};

/**
 * Render konten CRAFT panel
 * @param {string} craftKey - 'context'|'role'|'action'|'format'|'test'
 * @param {Object} craftData - data craft dari level
 * @param {HTMLElement} container
 * @param {HTMLTextAreaElement} promptInput - untuk insert teks
 */
export function renderCraftContent(craftKey, craftData, container, promptInput) {
  if (!container) return;

  const meta = CRAFT_LABELS[craftKey];
  const content = craftData[craftKey] || '';

  // Split konten jadi snippet tags yang bisa diklik
  const snippets = content.split('\n').filter(Boolean);

  container.innerHTML = `
    <div style="margin-bottom:10px">
      <span style="font-weight:700;color:${meta.color}">${meta.label}</span>
      <span style="font-size:0.8rem;color:var(--text-muted);margin-left:8px">${meta.desc}</span>
    </div>
    <div style="margin-bottom:10px;font-size:0.85rem;line-height:1.7;color:var(--text-muted)">
      ${content.replace(/\n/g, '<br/>')}
    </div>
    <div style="margin-top:12px">
      <div style="font-size:0.75rem;font-weight:600;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em">Klik untuk tambahkan ke prompt:</div>
      ${snippets.slice(0, 4).map(s => `
        <span class="craft-tag" data-insert="${escapeAttr(s)}">${escapeHTML(s.slice(0, 60))}${s.length > 60 ? '...' : ''}</span>
      `).join('')}
    </div>
  `;

  // Event untuk insert ke prompt
  container.querySelectorAll('.craft-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      if (!promptInput) return;
      const text = tag.dataset.insert;
      const pos = promptInput.selectionStart;
      const before = promptInput.value.slice(0, pos);
      const after = promptInput.value.slice(pos);
      promptInput.value = before + (before && !before.endsWith('\n') ? '\n' : '') + text + '\n' + after;
      promptInput.focus();

      // Trigger char count update
      promptInput.dispatchEvent(new Event('input'));
    });
  });
}

// ── Score Breakdown ───────────────────────────────────────────

/**
 * Render score breakdown grid
 * @param {Object} breakdown - { context, role, action, format, test, creativity }
 */
export function renderScoreBreakdown(breakdown) {
  const container = document.getElementById('breakdownGrid');
  if (!container) return;

  const items = [
    { label: 'Context', key: 'context', max: 20 },
    { label: 'Role', key: 'role', max: 15 },
    { label: 'Action', key: 'action', max: 20 },
    { label: 'Format', key: 'format', max: 15 },
    { label: 'Test Criteria', key: 'test', max: 20 },
    { label: 'Kreativitas', key: 'creativity', max: 10 },
  ];

  container.innerHTML = items.map(item => {
    const val = breakdown[item.key] || 0;
    const pct = (val / item.max) * 100;

    return `
      <div class="breakdown-item">
        <div class="bi-label">${item.label} <span style="font-size:0.75rem;color:var(--text-muted)">(/${item.max})</span></div>
        <div class="bi-bar"><div class="bi-fill" style="width:${pct}%"></div></div>
        <div class="bi-score">${val}</div>
      </div>
    `;
  }).join('');
}

/**
 * Render feedback dari AI dalam format terstruktur
 * @param {Object} feedback - { summary, strengths, improvements, tip }
 * @param {string} betterExample
 */
export function renderFeedback(feedback, betterExample) {
  const container = document.getElementById('feedbackContent');
  if (!container) return;

  container.innerHTML = `
    <div class="feedback-section">
      <div class="feedback-title">📊 Ringkasan</div>
      <div>${feedback.summary || ''}</div>
    </div>

    ${feedback.strengths?.length ? `
    <div class="feedback-section" style="border-left-color:var(--green)">
      <div class="feedback-title" style="color:var(--green)">✅ Kelebihan</div>
      <ul style="margin:0;padding-left:16px">
        ${feedback.strengths.map(s => `<li>${s}</li>`).join('')}
      </ul>
    </div>` : ''}

    ${feedback.improvements?.length ? `
    <div class="feedback-section" style="border-left-color:var(--gold)">
      <div class="feedback-title" style="color:var(--gold)">💡 Saran Perbaikan</div>
      <ul style="margin:0;padding-left:16px">
        ${feedback.improvements.map(s => `<li>${s}</li>`).join('')}
      </ul>
    </div>` : ''}

    ${feedback.tip ? `
    <div class="feedback-section" style="border-left-color:var(--blue)">
      <div class="feedback-title" style="color:var(--blue)">🎯 Pro Tip</div>
      <div>${feedback.tip}</div>
    </div>` : ''}

    ${betterExample ? `
    <div class="feedback-section" style="border-left-color:var(--orange)">
      <div class="feedback-title">⚡ Contoh Prompt yang Lebih Baik</div>
      <div style="font-family:var(--font-mono);font-size:0.82rem;background:var(--bg);padding:10px;border-radius:6px;margin-top:6px;line-height:1.7">${escapeHTML(betterExample)}</div>
    </div>` : ''}
  `;
}

// ── Helpers ───────────────────────────────────────────────────

function setEl(id, content) {
  const el = document.getElementById(id);
  if (el) el.textContent = content;
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
