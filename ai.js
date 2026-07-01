/**
 * ai.js — Prompt Hero
 * Mengelola semua interaksi dengan AI API (Gemini, Groq Llama) untuk evaluasi prompt.
 */

import { loadState, saveState } from './storage.js';

let geminiKeyIndex = 0;
let groqKeyIndex = 0;

/**
 * Mendapatkan API Key secara Round-Robin
 * @param {string} type - 'gemini' | 'groq'
 * @returns {string|null}
 */
function getApiKey(type) {
  const state = loadState();
  const keys = state?.settings?.apiKeys?.[type] || [];

  if (keys.length === 0) return null;

  if (type === 'gemini') {
    const key = keys[geminiKeyIndex % keys.length];
    geminiKeyIndex++;
    return key;
  } else if (type === 'groq') {
    const key = keys[groqKeyIndex % keys.length];
    groqKeyIndex++;
    return key;
  }
  return null;
}

/**
 * Panggil Google Gemini API
 */
async function callGemini(apiKey, systemPrompt, userMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        role: "user",
        parts: [{ text: userMessage }]
      }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return rawText;
}

/**
 * Panggil Groq API (Llama-3.3-70b-versatile)
 */
async function callGroq(apiKey, systemPrompt, userMessage) {
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    throw new Error(`Groq API Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content || '';
  return rawText;
}

/**
 * Evaluasi prompt pemain menggunakan Gemini sebagai evaluator (dengan fallback Groq Llama, lalu offline)
 *
 * @param {Object} params
 * @param {string} params.playerPrompt - Prompt yang ditulis pemain
 * @param {Object} params.levelData - Data level saat ini
 * @returns {Promise<{score, breakdown, feedback, betterPromptExample}>}
 */
export async function evaluatePrompt({ playerPrompt, levelData }) {
  const systemPrompt = buildEvaluatorSystemPrompt(levelData);
  const userMessage = buildEvaluatorUserMessage(playerPrompt, levelData);

  const geminiKey = getApiKey('gemini');
  if (geminiKey) {
    try {
      console.log('Attempting evaluation with Gemini API...');
      const rawText = await callGemini(geminiKey, systemPrompt, userMessage);
      return parseEvaluationResponse(rawText);
    } catch (e) {
      console.warn('Gemini evaluation failed, falling back to Groq...', e);
    }
  } else {
    console.warn('No Gemini key available. Skipping Gemini API.');
  }

  const groqKey = getApiKey('groq');
  if (groqKey) {
    try {
      console.log('Attempting evaluation with Groq API...');
      const rawText = await callGroq(groqKey, systemPrompt, userMessage);
      return parseEvaluationResponse(rawText);
    } catch (e) {
      console.warn('Groq evaluation failed, falling back to Offline...', e);
    }
  } else {
    console.warn('No Groq key available. Skipping Groq API.');
  }

  // Fallback evaluation jika API gagal atau key tidak ada
  console.log('Using Offline Evaluation Fallback.');
  return buildFallbackEvaluation(playerPrompt);
}

/**
 * Membangun system prompt untuk evaluator
 */
function buildEvaluatorSystemPrompt(levelData) {
  return `Kamu adalah AI Mentor ahli Prompt Engineering bernama "ProfesorCraft" dalam game edukasi "Prompt Hero".

Tugasmu adalah mengevaluasi prompt yang ditulis oleh pemain untuk menyelesaikan misi level ini:
- Level: ${levelData.num} — ${levelData.name}
- Tema: ${levelData.theme}
- Misi: ${levelData.client.context}

RUBRIK EVALUASI (total 100 poin):
1. Context (20 poin): Apakah ada konteks yang cukup dan relevan?
2. Role (15 poin): Apakah AI diberikan peran/persona yang tepat?
3. Action (20 poin): Apakah instruksi aksi jelas, spesifik, dan terstruktur?
4. Format (15 poin): Apakah format output yang diinginkan didefinisikan?
5. Test Criteria (20 poin): Apakah ada kriteria keberhasilan yang terukur?
6. Kreativitas (10 poin): Apakah ada elemen kreatif, original, atau sangat efektif?

KAMU HARUS merespons HANYA dalam format JSON berikut (tidak ada teks di luar JSON):
{
  "score": <total 0-100>,
  "breakdown": {
    "context": <0-20>,
    "role": <0-15>,
    "action": <0-20>,
    "format": <0-15>,
    "test": <0-20>,
    "creativity": <0-10>
  },
  "scoreLabel": "<Prompt Master|Sangat Baik|Baik|Cukup|Perlu Perbaikan>",
  "feedback": {
    "summary": "<ringkasan singkat 1-2 kalimat menggunakan bahasa yang semangat>",
    "strengths": ["<kelebihan 1>", "<kelebihan 2>"],
    "improvements": ["<saran perbaikan 1>", "<saran perbaikan 2>"],
    "tip": "<tip spesifik untuk prompt yang lebih baik>"
  },
  "betterExample": "<contoh prompt yang lebih baik dalam 2-4 kalimat, gunakan Bahasa Indonesia>"
}

Panduan penilaian:
- 90-100: Prompt Master (sangat spesifik, komprehensif, kreatif)
- 80-89: Sangat Baik (spesifik dan jelas, minor improvements)
- 70-79: Baik (cukup jelas tapi ada yang kurang)
- 60-69: Cukup (ada upaya tapi masih generik)
- 0-59: Perlu Perbaikan (terlalu singkat atau tidak relevan)

Berikan feedback dalam Bahasa Indonesia yang semangat, encouraging, dan konstruktif. Bayangkan kamu adalah mentor yang ingin pemain berhasil!`;
}

/**
 * Membangun pesan user untuk evaluator
 */
function buildEvaluatorUserMessage(playerPrompt, levelData) {
  return `Ini adalah prompt yang ditulis pemain untuk misi level ${levelData.num} (${levelData.name}):

MISI CLIENT: ${levelData.client.context}

PROMPT PEMAIN:
"""
${playerPrompt}
"""

PROMPT BURUK SEBELUMNYA (sebagai perbandingan):
"${levelData.badPrompt}"

Evaluasi prompt pemain menggunakan rubrik yang sudah ditentukan. Berikan penilaian yang adil, jujur, dan konstruktif. Jika prompt masih kurang dari 80 poin, berikan saran konkret bagaimana memperbaikinya.

Ingat: hanya balas dalam format JSON yang ditentukan!`;
}

/**
 * Parse JSON response dari AI
 */
function parseEvaluationResponse(rawText) {
  try {
    // Coba extract JSON dari response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return validateAndNormalizeEvaluation(parsed);
    }
    throw new Error('No JSON found');
  } catch (e) {
    console.error('Parse error:', e, rawText);
    return buildFallbackEvaluation('');
  }
}

/**
 * Validasi dan normalize hasil evaluasi
 */
function validateAndNormalizeEvaluation(data) {
  const breakdown = data.breakdown || {};

  // Pastikan skor dalam range yang benar
  const context = Math.min(20, Math.max(0, breakdown.context || 0));
  const role = Math.min(15, Math.max(0, breakdown.role || 0));
  const action = Math.min(20, Math.max(0, breakdown.action || 0));
  const format = Math.min(15, Math.max(0, breakdown.format || 0));
  const test = Math.min(20, Math.max(0, breakdown.test || 0));
  const creativity = Math.min(10, Math.max(0, breakdown.creativity || 0));

  const totalScore = context + role + action + format + test + creativity;

  let scoreLabel = data.scoreLabel;
  if (!scoreLabel) {
    if (totalScore >= 90) scoreLabel = 'Prompt Master! 🏆';
    else if (totalScore >= 80) scoreLabel = 'Sangat Baik! 🌟';
    else if (totalScore >= 70) scoreLabel = 'Baik! 👍';
    else if (totalScore >= 60) scoreLabel = 'Cukup 🔄';
    else scoreLabel = 'Perlu Perbaikan 💪';
  }

  return {
    score: totalScore,
    breakdown: { context, role, action, format, test, creativity },
    scoreLabel,
    feedback: data.feedback || {
      summary: 'Evaluasi selesai.',
      strengths: ['Kamu sudah mencoba!'],
      improvements: ['Coba tambahkan lebih banyak detail konteks'],
      tip: 'Gunakan framework CRAFT untuk prompt yang lebih baik.',
    },
    betterExample: data.betterExample || '',
  };
}

/**
 * Fallback evaluation jika API tidak tersedia
 */
function buildFallbackEvaluation(prompt) {
  const length = prompt.trim().length;
  let score = 40;

  if (length > 50) score += 10;
  if (length > 100) score += 10;
  if (length > 200) score += 10;
  if (prompt.toLowerCase().includes('kamu adalah') || prompt.toLowerCase().includes('sebagai')) score += 5;
  if (prompt.toLowerCase().includes('format') || prompt.toLowerCase().includes('dalam bentuk')) score += 5;
  if (prompt.toLowerCase().includes('pastikan') || prompt.toLowerCase().includes('harus')) score += 5;

  score = Math.min(75, score); // max 75 untuk fallback

  return {
    score,
    breakdown: {
      context: Math.floor(score * 0.2),
      role: Math.floor(score * 0.15),
      action: Math.floor(score * 0.2),
      format: Math.floor(score * 0.15),
      test: Math.floor(score * 0.2),
      creativity: Math.floor(score * 0.1),
    },
    scoreLabel: score >= 70 ? 'Baik! 👍' : 'Perlu Perbaikan 💪',
    feedback: {
      summary: 'Evaluasi offline (API tidak tersedia). Skor berdasarkan analisis lokal.',
      strengths: length > 100 ? ['Prompt cukup panjang dan detail'] : ['Kamu sudah mencoba!'],
      improvements: [
        'Tambahkan konteks yang lebih spesifik',
        'Definisikan peran AI yang lebih jelas',
        'Tentukan format output yang diinginkan',
      ],
      tip: 'Gunakan framework CRAFT: Context, Role, Action, Format, Test Criteria!',
    },
    betterExample: 'Sebagai [ROLE], dengan konteks [CONTEXT], tolong buat [ACTION] dalam format [FORMAT]. Pastikan hasilnya [TEST CRITERIA].',
  };
}

/**
 * Menghitung jumlah bintang berdasarkan skor
 * @param {number} score
 * @returns {string} emoji bintang
 */
export function scoreToStars(score) {
  if (score >= 95) return '⭐⭐⭐⭐⭐';
  if (score >= 85) return '⭐⭐⭐⭐';
  if (score >= 75) return '⭐⭐⭐';
  if (score >= 60) return '⭐⭐';
  return '⭐';
}
