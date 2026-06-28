/**
 * game.js — Prompt Hero
 * Logika inti gameplay: flow per stage, evaluasi, rewards.
 */

import { getLevelData } from './level.js';
import { evaluatePrompt, scoreToStars } from './ai.js';
import {
  saveLevelScore, addXP, addCoins, addHistory,
  loseHeart, unlockAchievement, updateStreak, loadState, saveState,
} from './storage.js';
import {
  playSound, showToast, animateScore, animateCounter,
  scrollTo,
} from './utils.js';
import {
  renderScoreBreakdown, renderFeedback, showLevelCompleteModal,
  showAchievementModal, ACHIEVEMENTS, updateSidebarStats,
} from './components.js';

// ── Game State ──────────────────────────────────────────────

let gameState = {
  currentLevel: null,
  currentStage: 1,
  attempts: 0,
  lastScore: null,
};

let appState = null; // referensi ke state aplikasi utama

/**
 * Inisialisasi game untuk level tertentu
 * @param {number} levelNum
 * @param {Object} state - app state
 */
export function initGame(levelNum, state) {
  appState = state;
  const levelData = getLevelData(levelNum);
  if (!levelData) {
    showToast('Level tidak ditemukan!', 'error');
    return false;
  }

  gameState = {
    currentLevel: levelData,
    currentStage: 1,
    attempts: 0,
    lastScore: null,
  };

  // Update HUD
  const hudLevel = document.getElementById('hudLevel');
  if (hudLevel) hudLevel.textContent = `Level ${levelData.num}: ${levelData.name}`;

  updateHUDHearts();

  // Mulai stage 1
  goToStage(1);
  populateStage1(levelData);

  return true;
}

// ── Stage Navigation ─────────────────────────────────────────

/**
 * Pindah ke stage tertentu
 * @param {number} stageNum
 */
export function goToStage(stageNum) {
  gameState.currentStage = stageNum;

  // Sembunyikan semua stage
  document.querySelectorAll('.stage').forEach(s => s.classList.remove('active'));

  // Tampilkan stage target
  const target = document.getElementById(`stage-${stageNum}`);
  if (target) {
    target.classList.add('active');
    scrollTo('.game-stage');
  }
}

// ── Stage 1: Client Intro ────────────────────────────────────

/**
 * Isi konten Stage 1 (client intro)
 * @param {Object} levelData
 */
function populateStage1(levelData) {
  const client = levelData.client;

  setEl('clientAvatar', client.avatar);
  setEl('clientMessage', client.message);
  setEl('clientContext', client.context);

  // Button handler
  const btn = document.getElementById('stage1Next');
  if (btn) {
    btn.onclick = () => {
      playSound('click');
      goToStage(2);
      populateStage2(levelData);
    };
  }
}

// ── Stage 2: Bad Prompt ──────────────────────────────────────

/**
 * Isi konten Stage 2 (bad prompt showcase)
 * @param {Object} levelData
 */
function populateStage2(levelData) {
  setEl('badPromptText', levelData.badPrompt);
  setEl('badOutputText', levelData.badOutput);

  // Render analysis list
  const analysisList = document.getElementById('badAnalysisList');
  if (analysisList) {
    analysisList.innerHTML = levelData.badAnalysis.map(item =>
      `<div class="analysis-item">${item}</div>`
    ).join('');
  }

  const btn = document.getElementById('stage2Next');
  if (btn) {
    btn.onclick = () => {
      playSound('click');
      goToStage(3);
      populateStage3(levelData);
    };
  }
}

// ── Stage 3: Fix Prompt ──────────────────────────────────────

let craftBodyOpen = false;
let activeCraftTab = 'context';

/**
 * Isi konten Stage 3 (prompt editor + CRAFT)
 * @param {Object} levelData
 */
function populateStage3(levelData) {
  // Target info
  const fixTarget = document.getElementById('fixTarget');
  if (fixTarget) {
    fixTarget.textContent = `🎯 Misi: ${levelData.client.context}`;
  }

  // Reset prompt input
  const promptInput = document.getElementById('promptInput');
  if (promptInput) {
    promptInput.value = '';
    updateCharCount(promptInput);

    promptInput.oninput = () => updateCharCount(promptInput);
  }

  // CRAFT toggle
  const craftToggle = document.getElementById('craftToggle');
  const craftBody = document.getElementById('craftBody');
  const craftPanel = craftBody?.parentElement;

  if (craftToggle && craftBody) {
    craftToggle.onclick = () => {
      craftBodyOpen = !craftBodyOpen;
      craftBody.classList.toggle('open', craftBodyOpen);
      craftPanel?.classList.toggle('open', craftBodyOpen);
      craftToggle.textContent = craftBodyOpen ? 'Tutup Panel ▲' : 'Buka Panel ▼';

      if (craftBodyOpen) {
        renderCraftTab(activeCraftTab, levelData.craft, promptInput);
      }
    };
  }

  // CRAFT tabs
  document.querySelectorAll('.craft-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.craft-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCraftTab = tab.dataset.craft;
      renderCraftTab(activeCraftTab, levelData.craft, promptInput);
    };
  });

  // Generate button
  const generateBtn = document.getElementById('generateBtn');
  if (generateBtn) {
    generateBtn.onclick = () => handleGenerate(levelData);
  }
}

/**
 * Render satu tab CRAFT
 */
function renderCraftTab(key, craftData, promptInput) {
  import('./components.js').then(({ renderCraftContent }) => {
    const craftContent = document.getElementById('craftContent');
    renderCraftContent(key, craftData, craftContent, promptInput);
  });
}

/**
 * Update karakter counter
 */
function updateCharCount(input) {
  const counter = document.getElementById('charCount');
  if (counter) counter.textContent = input.value.length;
}

// ── Stage 4: Generate & Evaluate ────────────────────────────

/**
 * Handle klik tombol Generate Prompt
 * @param {Object} levelData
 */
async function handleGenerate(levelData) {
  const promptInput = document.getElementById('promptInput');
  const prompt = promptInput?.value?.trim();

  if (!prompt || prompt.length < 10) {
    showToast('Prompt terlalu pendek! Minimal 10 karakter.', 'error');
    return;
  }

  gameState.attempts++;

  // Tampilkan stage 4 dengan loading state
  goToStage(4);
  showResultLoading();

  try {
    // Panggil AI evaluator
    const result = await evaluatePrompt({
      playerPrompt: prompt,
      levelData,
    });

    gameState.lastScore = result.score;

    // Tampilkan hasil
    displayResult(result, levelData, prompt);

    // Simpan ke histori
    addHistory(appState, {
      level: levelData.num,
      levelName: levelData.name,
      prompt,
      score: result.score,
    });

  } catch (error) {
    console.error('Generate error:', error);
    showToast('Terjadi kesalahan. Silakan coba lagi.', 'error');
    goToStage(3);
  }
}

/**
 * Tampilkan loading state di stage 4
 */
function showResultLoading() {
  const feedbackLoading = document.getElementById('feedbackLoading');
  const feedbackContent = document.getElementById('feedbackContent');
  const resultActions = document.getElementById('resultActions');
  const scoreNumber = document.getElementById('scoreNumber');
  const scoreStars = document.getElementById('scoreStars');
  const scoreLabel = document.getElementById('scoreLabel');
  const breakdownGrid = document.getElementById('breakdownGrid');

  if (feedbackLoading) feedbackLoading.style.display = 'flex';
  if (feedbackContent) feedbackContent.style.display = 'none';
  if (resultActions) resultActions.innerHTML = '';
  if (scoreNumber) scoreNumber.textContent = '...';
  if (scoreStars) scoreStars.textContent = '⭐⭐⭐';
  if (scoreLabel) scoreLabel.textContent = 'Sedang dievaluasi...';
  if (breakdownGrid) breakdownGrid.innerHTML = '';
}

/**
 * Tampilkan hasil evaluasi
 * @param {Object} result - { score, breakdown, scoreLabel, feedback, betterExample }
 * @param {Object} levelData
 * @param {string} prompt
 */
function displayResult(result, levelData, prompt) {
  const { score, breakdown, scoreLabel, feedback, betterExample } = result;

  // Score display
  const scoreNumberEl = document.getElementById('scoreNumber');
  const scoreStarsEl = document.getElementById('scoreStars');
  const scoreLabelEl = document.getElementById('scoreLabel');

  if (scoreStarsEl) scoreStarsEl.textContent = scoreToStars(score);
  if (scoreLabelEl) scoreLabelEl.textContent = scoreLabel;

  // Animate score
  if (scoreNumberEl) animateScore(scoreNumberEl, score);

  // Breakdown
  renderScoreBreakdown(breakdown);

  // Feedback (tampilkan setelah loading selesai)
  setTimeout(() => {
    const feedbackLoading = document.getElementById('feedbackLoading');
    const feedbackContent = document.getElementById('feedbackContent');

    if (feedbackLoading) feedbackLoading.style.display = 'none';
    if (feedbackContent) feedbackContent.style.display = 'block';

    renderFeedback(feedback, betterExample);
  }, 800);

  // Tentukan hasil dan action buttons
  if (score >= 80) {
    handleLevelSuccess(levelData, score, prompt);
  } else {
    handleLevelFail(levelData, score, prompt);
  }
}

// ── Level Success ─────────────────────────────────────────────

/**
 * Handle ketika pemain berhasil (skor >= 80)
 * @param {Object} levelData
 * @param {number} score
 * @param {string} prompt
 */
function handleLevelSuccess(levelData, score, prompt) {
  // Hitung XP bonus
  let xpEarned = levelData.xpReward;
  if (score >= 95) xpEarned = levelData.xpReward * 2; // Perfect bonus
  else if (score >= 90) xpEarned = Math.floor(levelData.xpReward * 1.5); // Excellent bonus

  const coinsEarned = levelData.coinReward + Math.floor((score - 80) / 5);

  // Update state
  saveLevelScore(appState, levelData.num, score);
  addXP(appState, xpEarned);
  addCoins(appState, coinsEarned);
  updateStreak(appState);

  // Sound & visual feedback
  playSound('success');

  setTimeout(() => {
    playSound('levelup');
    showToast(`🎉 Level selesai! +${xpEarned} XP`, 'reward', 4000);

    // Check achievements
    checkAndUnlockAchievements();

    // Update sidebar
    updateSidebarStats(appState);
  }, 1500);

  // Render action buttons
  const resultActions = document.getElementById('resultActions');
  if (resultActions) {
    const nextLevelNum = levelData.num + 1;
    const isLastLevel = levelData.num >= 20;

    resultActions.innerHTML = `
      <button class="btn-hero" id="showCompleteModalBtn" style="flex:1">
        🎉 Lihat Hadiah!
      </button>
      <button class="btn-outline" id="retryForPerfectBtn" style="flex:1">
        🔄 Coba Lagi (Kejar Sempurna)
      </button>
    `;

    document.getElementById('showCompleteModalBtn')?.addEventListener('click', () => {
      showLevelCompleteModal({
        xp: xpEarned,
        coins: coinsEarned,
        levelName: levelData.name,
        nextLevelNum,
        isLastLevel,
      });
      playSound('achievement');
    });

    document.getElementById('retryForPerfectBtn')?.addEventListener('click', () => {
      playSound('click');
      goToStage(3);
    });
  }
}

// ── Level Fail ────────────────────────────────────────────────

/**
 * Handle ketika pemain gagal (skor < 80)
 * @param {Object} levelData
 * @param {number} score
 * @param {string} prompt
 */
function handleLevelFail(levelData, score, prompt) {
  // Kurangi hati jika sudah 3x gagal
  if (gameState.attempts >= 3 && appState.stats.hearts > 0) {
    const remaining = loseHeart(appState);
    playSound('fail');
    showToast(`💔 Hati berkurang! Sisa: ${'❤️'.repeat(remaining)}`, 'error', 4000);
    updateHUDHearts();
    updateSidebarStats(appState);
  } else {
    playSound('fail');
  }

  // Render action buttons
  const resultActions = document.getElementById('resultActions');
  if (resultActions) {
    const hint = score >= 60
      ? '💡 Kamu hampir berhasil! Coba perbaiki bagian yang mendapat skor rendah.'
      : '💡 Gunakan panel CRAFT untuk panduan membuat prompt yang lebih baik!';

    resultActions.innerHTML = `
      <div style="width:100%;padding:14px;background:rgba(255,107,0,0.08);border:1px solid rgba(255,107,0,0.2);border-radius:10px;font-size:0.85rem;color:var(--text-muted);margin-bottom:12px">
        ${hint}
      </div>
      <button class="btn-hero" id="tryAgainBtn" style="flex:2">
        ✏️ Perbaiki Prompt (Butuh ≥80)
      </button>
      <button class="btn-outline" id="goBackBtn" style="flex:1">
        ← Kembali
      </button>
    `;

    document.getElementById('tryAgainBtn')?.addEventListener('click', () => {
      playSound('click');
      goToStage(3);
    });

    document.getElementById('goBackBtn')?.addEventListener('click', () => {
      playSound('click');
      goToStage(1);
      populateStage1(gameState.currentLevel);
    });
  }
}

// ── Achievement Check ─────────────────────────────────────────

/**
 * Cek dan unlock achievement baru
 */
function checkAndUnlockAchievements() {
  ACHIEVEMENTS.forEach(ach => {
    if (!appState.achievements.includes(ach.id) && ach.condition(appState)) {
      const isNew = unlockAchievement(appState, ach.id);
      if (isNew) {
        setTimeout(() => {
          showAchievementModal(ach);
          playSound('achievement');
          showToast(`🏅 Achievement: ${ach.title}`, 'reward', 5000);
        }, 2000);
      }
    }
  });
}

// ── HUD Update ────────────────────────────────────────────────

/**
 * Update tampilan hati di HUD
 */
function updateHUDHearts() {
  const hearts = appState?.stats?.hearts ?? 5;
  const hudHearts = document.getElementById('hudHearts');
  if (hudHearts) {
    hudHearts.textContent = '❤️'.repeat(hearts) + '🖤'.repeat(Math.max(0, 5 - hearts));
  }
}

// ── Helpers ───────────────────────────────────────────────────

function setEl(id, content) {
  const el = document.getElementById(id);
  if (el) el.textContent = content;
}
