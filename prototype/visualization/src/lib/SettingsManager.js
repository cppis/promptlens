/**
 * PromptLens — Settings Manager
 * Manages API key, model selection, and user preferences.
 * chrome.storage.local in Extension, in-memory fallback otherwise.
 */

const isExtension = typeof chrome !== 'undefined' && chrome.storage?.local;
const mem = {};

async function get(key) {
  if (isExtension) return new Promise(r => chrome.storage.local.get(key, res => r(res[key])));
  return mem[key];
}

async function set(key, value) {
  if (isExtension) return new Promise(r => chrome.storage.local.set({ [key]: value }, r));
  mem[key] = value;
}

// ---------- Defaults ----------
const DEFAULTS = {
  apiKey: '',
  model: 'claude-sonnet-4-5-20250514',
  maxTokens: 4096,
  theme: 'dark',
  language: 'ko',
  costConfirm: true,
  inlineCoaching: true,
  historyAutoSave: true
};

// Model used for lightweight API key validation test
export const TEST_MODEL = 'claude-3-5-haiku-20241022';

const SETTINGS_KEY = 'pc_settings';

// ---------- Public API ----------

export async function loadSettings() {
  const saved = await get(SETTINGS_KEY);
  return { ...DEFAULTS, ...(saved || {}) };
}

export async function saveSettings(settings) {
  await set(SETTINGS_KEY, settings);
}

export async function getApiKey() {
  const s = await loadSettings();
  return s.apiKey;
}

export async function setApiKey(key) {
  const s = await loadSettings();
  s.apiKey = key;
  await saveSettings(s);
}

export async function isApiKeySet() {
  const key = await getApiKey();
  return !!key && key.length > 10;
}

// ---------- Model options ----------
export const MODEL_OPTIONS = [
  { value: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5', desc: 'Best balance of speed & quality', cost: '$3/$15 per 1M tokens' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude Haiku 3.5', desc: 'Fastest, lowest cost', cost: '$0.80/$4 per 1M tokens' },
  { value: 'claude-opus-4-0-20250514', label: 'Claude Opus 4', desc: 'Highest quality, slower', cost: '$15/$75 per 1M tokens' }
];

export const LANGUAGE_OPTIONS = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' }
];
