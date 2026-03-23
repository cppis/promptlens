// ============================================================
// PromptLens BYOK — Chrome Extension Popup Logic
// All storage uses chrome.storage.local (async)
// API calls delegated to background.js Service Worker
// ============================================================

// ── Storage Keys ─────────────────────────────────────────
const STORAGE_API_KEY = 'promptlens_api_key';
const STORAGE_SETTINGS = 'promptlens_settings';
const STORAGE_PROFILES = 'promptlens_profiles';
const STORAGE_USAGE = 'promptlens_usage';

// ── Model Pricing (input/output per 1M tokens) ───────────
const MODEL_PRICING = {
  'claude-sonnet-4-6': { inputCost: 3, outputCost: 15 },
  'claude-haiku-4-5': { inputCost: 0.80, outputCost: 4 },
};

// ── Known Terms & Rules (for mock analysis) ──────────────
const KNOWN_TERMS = {
  'React': '리액트 라이브러리',
  'Python': '파이썬 프로그래밍 언어',
  'REST API': 'HTTP 기반 API 아키텍처',
  'TypeScript': '정적 타입 JavaScript',
  'Node.js': 'JavaScript 런타임',
  'PostgreSQL': '오픈소스 관계형 DB',
  '로그인': '사용자 인증 기능',
  '폼': 'HTML 입력 요소',
  '프로필': '사용자 정보 페이지',
};

const INFERENCE_RULES = [
  { pattern: /로그인|인증/, inferred: '사용자 계정 관리', confidence: 'high' },
  { pattern: /API|서버/, inferred: '백엔드 구현 필요', confidence: 'high' },
  { pattern: /UI|폼|버튼/, inferred: '프론트엔드 구현', confidence: 'medium' },
  { pattern: /성능|최적화/, inferred: '코드 리팩토링 고려', confidence: 'medium' },
];

const MISSING_INFO_RULES = [
  { pattern: /React/, missing: '사용할 상태 관리 라이브러리?', suggestion: 'Redux, Zustand, Recoil 등 명시' },
  { pattern: /API/, missing: '인증 방식 (JWT, OAuth 등)?', suggestion: '인증 메커니즘 결정' },
  { pattern: /로그인|폼/, missing: '데이터 유효성 검증 방식?', suggestion: 'Zod, Yup 등 라이브러리 선택' },
  { pattern: /스타일/, missing: '디자인 시스템 정의?', suggestion: 'Tailwind, styled-components 등 선택' },
];

// ── State ────────────────────────────────────────────────
let profiles = [];
let editingProfileId = null;
let settings = {
  model: 'claude-sonnet-4-6',
  costCheckEnabled: true,
  dailyBudget: 1.00,
  autoApproveThreshold: 0.01,
};
let cachedApiKey = null;
let pendingAnalysis = null;

// ── Chrome Storage Helpers ───────────────────────────────
function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function storageSet(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, resolve);
  });
}

function storageRemove(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, resolve);
  });
}

// ── Init ─────────────────────────────────────────────────
async function init() {
  await loadFromStorage();
  setupTabNavigation();
  setupAnalysisHandlers();
  setupSettingsHandlers();
  setupProfileHandlers();
  setupModalHandlers();
  updateMockBanner();
  updateContextIndicator();
  await updateUsageDisplay();
  checkOnboarding();
}

// ── Storage Operations ───────────────────────────────────
async function loadFromStorage() {
  try {
    const data = await storageGet([STORAGE_PROFILES, STORAGE_SETTINGS, STORAGE_API_KEY]);

    if (data[STORAGE_PROFILES]) {
      profiles = data[STORAGE_PROFILES];
    } else {
      profiles = [
        {
          id: 'default-1',
          name: '웹 개발 프로젝트',
          role: '시니어 프론트엔드 개발자',
          domain: '에듀테크',
          techStack: ['React', 'TypeScript', 'Tailwind', 'Node.js', 'PostgreSQL'],
          preferences: '코드는 TypeScript, 설명은 한국어, 간결하게',
          customContext: 'pnpm monorepo 구조 사용, ESLint + Prettier 적용',
          isActive: true,
        },
        {
          id: 'default-2',
          name: '마케팅 업무',
          role: '콘텐츠 마케터',
          domain: 'SaaS',
          techStack: ['SEO', 'Google Analytics', '블로그'],
          preferences: '한국어, 전문적이면서 친근한 톤',
          customContext: '',
          isActive: false,
        },
      ];
      await saveProfilesToStorage();
    }

    if (data[STORAGE_SETTINGS]) {
      settings = { ...settings, ...data[STORAGE_SETTINGS] };
    }

    cachedApiKey = data[STORAGE_API_KEY] || null;

    syncSettingsUI();
    updateApiKeyStatus();
  } catch (e) {
    console.error('Failed to load from storage:', e);
  }
}

async function saveProfilesToStorage() {
  await storageSet({ [STORAGE_PROFILES]: profiles });
}

async function saveSettings() {
  settings.model = document.getElementById('settingsModel').value;
  settings.costCheckEnabled = document.getElementById('costCheckToggle').checked;
  settings.dailyBudget = parseFloat(document.getElementById('dailyBudget').value) || 1.00;
  settings.autoApproveThreshold = parseFloat(document.getElementById('autoApproveThreshold').value) || 0.01;

  await storageSet({ [STORAGE_SETTINGS]: settings });
  showToast('설정이 저장되었습니다.');
}

function syncSettingsUI() {
  document.getElementById('settingsModel').value = settings.model;
  document.getElementById('costCheckToggle').checked = settings.costCheckEnabled;
  document.getElementById('dailyBudget').value = settings.dailyBudget.toFixed(2);
  document.getElementById('autoApproveThreshold').value = settings.autoApproveThreshold.toFixed(3);
}

// ── API Key Management ───────────────────────────────────
function getApiKey() {
  return cachedApiKey;
}

async function setApiKey(key) {
  if (key) {
    await storageSet({ [STORAGE_API_KEY]: key });
    cachedApiKey = key;
  } else {
    await storageRemove([STORAGE_API_KEY]);
    cachedApiKey = null;
  }
  updateApiKeyStatus();
  updateMockBanner();
}

function updateApiKeyStatus() {
  const apiKey = getApiKey();
  const statusEl = document.getElementById('apiKeyStatus');
  const inputEl = document.getElementById('settingsApiKey');

  if (apiKey) {
    statusEl.textContent = '✓ API 키가 저장되어 있습니다.';
    statusEl.style.color = 'var(--c-green)';
    inputEl.value = '*'.repeat(Math.max(apiKey.length - 8, 8)) + apiKey.slice(-8);
  } else {
    statusEl.textContent = '⚠ API 키가 없습니다. 검증 버튼을 눌러 저장하세요.';
    statusEl.style.color = 'var(--c-orange)';
    inputEl.value = '';
  }
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('settingsApiKey');
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
}

async function validateApiKey() {
  const keyInput = document.getElementById('settingsApiKey').value.trim();
  const currentKey = getApiKey();

  let keyToValidate = keyInput;
  if (keyInput.startsWith('*')) {
    keyToValidate = currentKey;
  }

  if (!keyToValidate) {
    showToast('API 키를 입력하세요.');
    return;
  }

  if (!keyToValidate.startsWith('sk-ant-')) {
    showToast('유효한 Anthropic API 키가 아닙니다. (sk-ant-... 형식)');
    return;
  }

  await setApiKey(keyToValidate);
  showToast('API 키가 검증되고 저장되었습니다.');
  updateApiKeyStatus();
  updateMockBanner();
}

async function deleteApiKey() {
  if (confirm('API 키를 삭제하시겠습니까? Mock 모드로 전환됩니다.')) {
    await setApiKey(null);
    document.getElementById('settingsApiKey').value = '';
    showToast('API 키가 삭제되었습니다.');
    updateMockBanner();
  }
}

// ── Mock Banner ──────────────────────────────────────────
function updateMockBanner() {
  const banner = document.getElementById('mockBanner');
  const hasApiKey = !!getApiKey();
  banner.classList.toggle('hidden', hasApiKey);
}

// ── Tab Navigation ──────────────────────────────────────
function setupTabNavigation() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const page = tab.dataset.tab;
      document.getElementById('page-analyze').classList.toggle('hidden', page !== 'analyze');
      document.getElementById('page-profiles').classList.toggle('hidden', page !== 'profiles');
      document.getElementById('page-settings').classList.toggle('hidden', page !== 'settings');
      if (page === 'profiles') renderProfiles();
      if (page === 'settings') syncSettingsUI();
    });
  });

  document.getElementById('btnSettings').addEventListener('click', () => {
    document.querySelector('[data-tab="settings"]').click();
  });

  document.getElementById('btnProfile').addEventListener('click', () => {
    document.querySelector('[data-tab="profiles"]').click();
  });
}

// ── Analysis ─────────────────────────────────────────────
function setupAnalysisHandlers() {
  document.getElementById('btnAnalyze').addEventListener('click', initiateAnalysis);
  document.getElementById('promptInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) initiateAnalysis();
  });
  document.getElementById('btnCopyPrompt').addEventListener('click', copyEnhancedPrompt);
  document.getElementById('btnSendAI').addEventListener('click', () => {
    showToast('AI 채팅창에 전송되었습니다!');
  });
}

function initiateAnalysis() {
  const prompt = document.getElementById('promptInput').value.trim();
  if (!prompt) return;

  const hasApiKey = !!getApiKey();
  const shouldCheckCost = settings.costCheckEnabled && hasApiKey;

  if (shouldCheckCost) {
    pendingAnalysis = { prompt };
    showCostConfirmation(prompt);
  } else {
    analyze(prompt);
  }
}

function proceedWithAnalysis() {
  if (pendingAnalysis) {
    closeCostModal();
    analyze(pendingAnalysis.prompt);
    pendingAnalysis = null;
  }
}

async function analyze(prompt) {
  const btn = document.getElementById('btnAnalyze');
  btn.disabled = true;
  document.getElementById('analysisResult').classList.add('hidden');
  document.getElementById('loading').classList.remove('hidden');

  const activeProfile = profiles.find(p => p.isActive);
  const context = activeProfile ? {
    role: activeProfile.role,
    domain: activeProfile.domain,
    techStack: activeProfile.techStack,
    preferences: activeProfile.preferences,
    customContext: activeProfile.customContext,
  } : null;

  try {
    let result;
    const hasApiKey = !!getApiKey();

    if (hasApiKey) {
      result = await analyzeWithClaude(prompt, context);
    } else {
      result = analyzeMock(prompt, context);
    }

    await recordUsage(result.usage || { inputTokens: 0, outputTokens: 0, cost: 0 });
    renderReport(result);
    await updateUsageDisplay();
  } catch (err) {
    showToast('분석 중 오류가 발생했습니다: ' + err.message);
  } finally {
    btn.disabled = false;
    document.getElementById('loading').classList.add('hidden');
  }
}

async function analyzeWithClaude(prompt, context) {
  const apiKey = getApiKey();
  const model = settings.model;

  // Build context string for system prompt
  let contextStr = '';
  if (context) {
    contextStr = `\n\n사용자 프로필:\n`;
    contextStr += `- 역할: ${context.role}\n`;
    contextStr += `- 도메인: ${context.domain}\n`;
    contextStr += `- 기술: ${context.techStack.join(', ')}\n`;
    contextStr += `- 선호: ${context.preferences}\n`;
    if (context.customContext) contextStr += `- 추가: ${context.customContext}\n`;
  }

  const systemPrompt = `당신은 프롬프트 분석 전문가입니다. 사용자가 AI에게 보낼 프롬프트를 받으면, 그 프롬프트를 AI의 관점에서 분석하여 다음 3가지 카테고리로 분류하세요.

1. referenced: 프롬프트에서 명확히 이해한 용어와 개념 (각 항목: { "term": "용어", "explanation": "이해한 방식" })
2. inferred: 명시되지 않았지만 추론한 맥락 (각 항목: { "term": "추론 내용", "explanation": "추론 근거", "confidence": "high|medium|low" })
3. missing: 부재하거나 모호한 정보 (각 항목: { "field": "부재 정보명", "suggestion": "보충 가이드" })

반드시 유효한 JSON 형식으로만 응답하세요. JSON 외 텍스트를 포함하지 마세요.${contextStr}`;

  const userMessage = `이 프롬프트를 분석해주세요:\n\n${prompt}`;
  const inputTokens = Math.ceil((systemPrompt.length + userMessage.length) * 0.25);

  // Delegate API call to background.js Service Worker
  const data = await new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: 'CLAUDE_API_CALL',
        payload: {
          apiKey,
          model,
          systemPrompt,
          userMessage,
        }
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response.data);
      }
    );
  });

  const responseText = data.content[0].text;

  // Extract JSON from response
  let analysis;
  try {
    analysis = JSON.parse(responseText);
  } catch (e) {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Invalid response format');
    }
  }

  // Build enhanced prompt with context
  let enhancedPrompt = prompt;
  if (context) {
    enhancedPrompt = `프로필: ${context.role} (${context.domain})\n기술: ${context.techStack.join(', ')}\n선호도: ${context.preferences}\n\n${prompt}`;
  }
  if (analysis.missing && analysis.missing.length > 0) {
    enhancedPrompt += '\n\n추가 정보:\n';
    analysis.missing.forEach(m => {
      enhancedPrompt += `- ${m.field}: ${m.suggestion}\n`;
    });
  }

  // Calculate actual cost
  const outputTokens = data.usage.output_tokens;
  const pricing = MODEL_PRICING[model];
  const cost = (inputTokens * pricing.inputCost + outputTokens * pricing.outputCost) / 1_000_000;

  return {
    referenced: analysis.referenced || [],
    inferred: analysis.inferred || [],
    missing: analysis.missing || [],
    enhancedPrompt,
    usage: { inputTokens, outputTokens, cost }
  };
}

function analyzeMock(prompt, context) {
  const referenced = [];
  const inferred = [];

  // Match known terms
  Object.entries(KNOWN_TERMS).forEach(([term, explanation]) => {
    if (prompt.toLowerCase().includes(term.toLowerCase())) {
      referenced.push({ term, explanation });
    }
  });

  // Apply inference rules
  INFERENCE_RULES.forEach(rule => {
    if (rule.pattern.test(prompt)) {
      inferred.push({
        term: rule.inferred,
        explanation: '프롬프트에서 추론함',
        confidence: rule.confidence
      });
    }
  });

  // Apply missing info rules
  const missing = [];
  MISSING_INFO_RULES.forEach(rule => {
    if (rule.pattern.test(prompt)) {
      missing.push({
        field: rule.missing,
        suggestion: rule.suggestion,
        autoFillable: false
      });
    }
  });

  // Build enhanced prompt
  let enhancedPrompt = prompt;
  if (context) {
    enhancedPrompt = `프로필: ${context.role} (${context.domain})\n기술: ${context.techStack.join(', ')}\n선호도: ${context.preferences}\n\n${prompt}`;
  }

  return {
    referenced,
    inferred,
    missing,
    enhancedPrompt,
    usage: { inputTokens: 0, outputTokens: 0, cost: 0 }
  };
}

// ── Cost Confirmation ────────────────────────────────────
async function showCostConfirmation(prompt) {
  const model = settings.model;
  const pricing = MODEL_PRICING[model];

  const estimatedInputTokens = Math.ceil(prompt.length * 0.35);
  const estimatedOutputTokens = Math.ceil(prompt.length * 0.7);
  const estimatedCost = (estimatedInputTokens * pricing.inputCost + estimatedOutputTokens * pricing.outputCost) / 1_000_000;

  const dailyUsage = await calculateDailyUsage();
  const dailyBudget = settings.dailyBudget;

  // Check if cost is below auto-approve threshold
  if (estimatedCost <= settings.autoApproveThreshold) {
    proceedWithAnalysis();
    return;
  }

  document.getElementById('costModalModel').textContent = model.includes('sonnet') ? 'Sonnet' : 'Haiku';
  document.getElementById('costModalInputTokens').textContent = `~${estimatedInputTokens} 토큰`;
  document.getElementById('costModalOutputTokens').textContent = `~${estimatedOutputTokens} 토큰`;
  document.getElementById('costModalEstimate').textContent = `$${estimatedCost.toFixed(4)}`;
  document.getElementById('costModalDaily').textContent = `$${dailyUsage.toFixed(4)} / $${dailyBudget.toFixed(2)}`;

  document.getElementById('costModal').classList.remove('hidden');
}

function closeCostModal() {
  document.getElementById('costModal').classList.add('hidden');
}

function setupModalHandlers() {
  document.getElementById('btnCostCancel').addEventListener('click', closeCostModal);
  document.getElementById('btnCostProceed').addEventListener('click', proceedWithAnalysis);
}

// ── Usage Tracking ───────────────────────────────────────
async function recordUsage(usage) {
  const now = new Date();
  const dateKey = now.toISOString().split('T')[0];

  let records = [];
  try {
    const data = await storageGet([STORAGE_USAGE]);
    records = data[STORAGE_USAGE] || [];
  } catch (e) {}

  records.push({
    date: dateKey,
    timestamp: now.getTime(),
    inputTokens: usage.inputTokens || 0,
    outputTokens: usage.outputTokens || 0,
    cost: usage.cost || 0
  });

  await storageSet({ [STORAGE_USAGE]: records });
}

async function calculateDailyUsage() {
  const now = new Date();
  const todayKey = now.toISOString().split('T')[0];

  try {
    const data = await storageGet([STORAGE_USAGE]);
    const records = data[STORAGE_USAGE] || [];
    return records
      .filter(r => r.date === todayKey)
      .reduce((sum, r) => sum + (r.cost || 0), 0);
  } catch (e) {
    return 0;
  }
}

async function updateUsageDisplay() {
  const now = new Date();
  try {
    const data = await storageGet([STORAGE_USAGE]);
    const records = data[STORAGE_USAGE] || [];

    // Today
    const todayKey = now.toISOString().split('T')[0];
    const todayRecords = records.filter(r => r.date === todayKey);
    const todayCost = todayRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
    document.getElementById('usageToday').textContent = `${todayRecords.length} 분석 • $${todayCost.toFixed(4)}`;

    // Week
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartKey = weekStart.toISOString().split('T')[0];
    const weekRecords = records.filter(r => r.date >= weekStartKey);
    const weekCost = weekRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
    document.getElementById('usageWeek').textContent = `${weekRecords.length} 분석 • $${weekCost.toFixed(4)}`;

    // Month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartKey = monthStart.toISOString().split('T')[0];
    const monthRecords = records.filter(r => r.date >= monthStartKey);
    const monthCost = monthRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
    document.getElementById('usageMonth').textContent = `${monthRecords.length} 분석 • $${monthCost.toFixed(4)}`;
  } catch (e) {}
}

// ── Report Rendering ─────────────────────────────────────
function renderReport(data) {
  // Referenced (Green)
  const greenItems = document.getElementById('greenItems');
  greenItems.innerHTML = '';
  document.getElementById('greenCount').textContent = data.referenced.length;
  data.referenced.forEach(item => {
    greenItems.innerHTML += `
      <div class="report-item">
        <div class="dot" style="background: var(--c-green)"></div>
        <div><span class="term">${escHtml(item.term)}</span> — <span class="desc">${escHtml(item.explanation)}</span></div>
      </div>`;
  });

  // Inferred (Yellow)
  const yellowItems = document.getElementById('yellowItems');
  yellowItems.innerHTML = '';
  document.getElementById('yellowCount').textContent = data.inferred.length;
  data.inferred.forEach(item => {
    const confColor = { high: 'var(--c-green)', medium: 'var(--c-yellow)', low: 'var(--c-red)' }[item.confidence] || 'var(--c-text-dim)';
    const confLabel = { high: '높음', medium: '보통', low: '낮음' }[item.confidence] || item.confidence;
    yellowItems.innerHTML += `
      <div class="report-item">
        <div class="dot" style="background: var(--c-yellow)"></div>
        <div>
          <span class="term">${escHtml(item.term)}</span> — <span class="desc">${escHtml(item.explanation)}</span>
          <span class="confidence" style="color:${confColor}; background:${confColor}22">${confLabel}</span>
        </div>
      </div>`;
  });

  // Missing (Red)
  const redItems = document.getElementById('redItems');
  redItems.innerHTML = '';
  document.getElementById('redCount').textContent = data.missing.length;
  data.missing.forEach(item => {
    redItems.innerHTML += `
      <div class="report-item">
        <div class="dot" style="background: var(--c-red)"></div>
        <div>
          <span class="term">${escHtml(item.field)}</span> — <span class="desc">${escHtml(item.suggestion)}</span>
        </div>
      </div>`;
  });

  // Enhanced prompt
  document.getElementById('enhancedPromptText').textContent = data.enhancedPrompt;

  // Usage stats
  const usageStats = document.getElementById('usageStats');
  if (data.usage && (data.usage.inputTokens > 0 || data.usage.outputTokens > 0)) {
    usageStats.innerHTML = `
      <div class="usage-stat-line">
        <span class="usage-stat-label">입력 토큰</span>
        <span class="usage-stat-value">${data.usage.inputTokens}</span>
      </div>
      <div class="usage-stat-line">
        <span class="usage-stat-label">출력 토큰</span>
        <span class="usage-stat-value">${data.usage.outputTokens}</span>
      </div>
      <div class="usage-stat-line">
        <span class="usage-stat-label">비용</span>
        <span class="usage-stat-value">$${data.usage.cost.toFixed(4)}</span>
      </div>
    `;
    usageStats.classList.remove('hidden');
  }

  document.getElementById('analysisResult').classList.remove('hidden');
}

function toggleSection(id) {
  const section = document.getElementById(id);
  const header = section.querySelector('.report-header');
  const items = section.querySelector('.report-items');
  header.classList.toggle('collapsed');
  items.classList.toggle('hidden');
}

function copyEnhancedPrompt() {
  const text = document.getElementById('enhancedPromptText').textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast('보강된 프롬프트가 클립보드에 복사되었습니다!');
  });
}

// ── Section Toggle Event Listeners ───────────────────────
document.getElementById('headerGreen').addEventListener('click', () => toggleSection('sectionGreen'));
document.getElementById('headerYellow').addEventListener('click', () => toggleSection('sectionYellow'));
document.getElementById('headerRed').addEventListener('click', () => toggleSection('sectionRed'));

// ── Profiles ─────────────────────────────────────────────
function renderProfiles() {
  const list = document.getElementById('profileList');
  list.innerHTML = '';
  profiles.forEach(p => {
    const card = document.createElement('div');
    card.className = `profile-card ${p.isActive ? 'active' : ''}`;
    card.innerHTML = `
      <div class="profile-card-header">
        <h3>${escHtml(p.name)}</h3>
        <span class="profile-status ${p.isActive ? 'on' : 'off'}">${p.isActive ? '&#9679; 활성' : '&#9675; 비활성'}</span>
      </div>
      <div class="profile-meta">
        ${escHtml(p.role)} &middot; ${escHtml(p.domain)}
      </div>
      <div class="profile-tags">
        ${p.techStack.map(t => `<span class="profile-tag">${escHtml(t)}</span>`).join('')}
      </div>
      <div class="profile-meta" style="margin-top:6px;">${escHtml(p.preferences)}</div>
      <div class="profile-actions">
        ${!p.isActive ? `<button class="btn btn-secondary btn-sm btn-activate" data-id="${p.id}">활성화</button>` : ''}
        <button class="btn btn-secondary btn-sm btn-edit" data-id="${p.id}">편집</button>
        <button class="btn btn-secondary btn-sm btn-delete" data-id="${p.id}" style="color:var(--c-red)">삭제</button>
      </div>
    `;
    list.appendChild(card);
  });

  // Attach event listeners
  list.querySelectorAll('.btn-activate').forEach(btn => {
    btn.addEventListener('click', () => activateProfile(btn.dataset.id));
  });
  list.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => editProfile(btn.dataset.id));
  });
  list.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteProfile(btn.dataset.id));
  });

  updateContextIndicator();
}

async function activateProfile(id) {
  profiles.forEach(p => p.isActive = (p.id === id));
  await saveProfilesToStorage();
  renderProfiles();
  showToast('프로필이 활성화되었습니다.');
}

async function deleteProfile(id) {
  profiles = profiles.filter(p => p.id !== id);
  await saveProfilesToStorage();
  renderProfiles();
  showToast('프로필이 삭제되었습니다.');
}

function editProfile(id) {
  const p = profiles.find(pr => pr.id === id);
  if (!p) return;
  editingProfileId = id;
  document.getElementById('pf-name').value = p.name;
  document.getElementById('pf-role').value = p.role;
  document.getElementById('pf-domain').value = p.domain;
  document.getElementById('pf-tech').value = p.techStack.join(', ');
  document.getElementById('pf-prefs').value = p.preferences;
  document.getElementById('pf-custom').value = p.customContext;
  document.getElementById('profileForm').classList.remove('hidden');
}

function showProfileForm() {
  editingProfileId = null;
  document.getElementById('pf-name').value = '';
  document.getElementById('pf-role').value = '';
  document.getElementById('pf-domain').value = '';
  document.getElementById('pf-tech').value = '';
  document.getElementById('pf-prefs').value = '';
  document.getElementById('pf-custom').value = '';
  document.getElementById('profileForm').classList.remove('hidden');
}

function hideProfileForm() {
  document.getElementById('profileForm').classList.add('hidden');
  editingProfileId = null;
}

async function saveProfile() {
  const name = document.getElementById('pf-name').value.trim();
  const role = document.getElementById('pf-role').value.trim();
  const domain = document.getElementById('pf-domain').value.trim();
  const techStack = document.getElementById('pf-tech').value.split(',').map(s => s.trim()).filter(Boolean);
  const preferences = document.getElementById('pf-prefs').value.trim();
  const customContext = document.getElementById('pf-custom').value.trim();

  if (!name) { showToast('프로필 이름을 입력하세요.'); return; }

  if (editingProfileId) {
    const p = profiles.find(pr => pr.id === editingProfileId);
    if (p) { Object.assign(p, { name, role, domain, techStack, preferences, customContext }); }
  } else {
    profiles.push({
      id: 'p-' + Date.now(),
      name, role, domain, techStack, preferences, customContext,
      isActive: profiles.length === 0,
    });
  }

  await saveProfilesToStorage();
  hideProfileForm();
  renderProfiles();
  showToast(editingProfileId ? '프로필이 수정되었습니다.' : '새 프로필이 추가되었습니다.');
}

function setupProfileHandlers() {
  document.getElementById('btnNewProfile').addEventListener('click', showProfileForm);
  document.getElementById('btnCancelProfile').addEventListener('click', hideProfileForm);
  document.getElementById('btnSaveProfile').addEventListener('click', saveProfile);
}

function updateContextIndicator() {
  const active = profiles.find(p => p.isActive);
  const indicator = document.getElementById('contextIndicator');
  if (active) {
    indicator.classList.remove('hidden');
    document.getElementById('activeProfileName').textContent = active.name;
  } else {
    indicator.classList.add('hidden');
  }
}

// ── Settings Handlers ────────────────────────────────────
function setupSettingsHandlers() {
  document.getElementById('btnSaveSettings').addEventListener('click', saveSettings);
  document.getElementById('btnToggleKeyVis').addEventListener('click', toggleApiKeyVisibility);
  document.getElementById('btnValidateKey').addEventListener('click', validateApiKey);
  document.getElementById('btnDeleteKey').addEventListener('click', deleteApiKey);
}

// ── Onboarding ───────────────────────────────────────────
function checkOnboarding() {
  // Placeholder for future onboarding flow
}

// ── Toast ────────────────────────────────────────────────
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ── Utils ────────────────────────────────────────────────
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ── Init ─────────────────────────────────────────────────
init();
