<script>
  import { onMount } from 'svelte';
  import {
    loadSettings, saveSettings, isApiKeySet,
    MODEL_OPTIONS, LANGUAGE_OPTIONS, TEST_MODEL
  } from '../lib/SettingsManager.js';

  let settings = {};
  let apiKeyVisible = false;
  let saveStatus = '';
  let keyValid = null; // null = unchecked, true/false
  let testing = false;
  let testError = ''; // show actual error detail

  onMount(async () => {
    settings = await loadSettings();
    keyValid = await isApiKeySet() ? true : null;
  });

  function maskKey(key) {
    if (!key) return '';
    if (key.length <= 12) return '•'.repeat(key.length);
    return key.slice(0, 7) + '•'.repeat(key.length - 11) + key.slice(-4);
  }

  async function save() {
    await saveSettings(settings);
    saveStatus = 'saved';
    setTimeout(() => saveStatus = '', 2000);
  }

  async function testApiKey() {
    if (!settings.apiKey) { keyValid = false; testError = 'API Key is empty'; return; }
    testing = true;
    testError = '';
    try {
      // In extension context, delegate to background.js
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              type: 'CLAUDE_API_CALL',
              payload: {
                apiKey: settings.apiKey,
                model: TEST_MODEL,
                systemPrompt: 'Reply with exactly: OK',
                userMessage: 'ping'
              }
            },
            (res) => {
              if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
              else if (res?.error) reject(new Error(res.error));
              else resolve(res?.data);
            }
          );
        });
        keyValid = true;
        testError = '';
      } else {
        // Direct fetch for standalone mode
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': settings.apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: TEST_MODEL,
            max_tokens: 16,
            messages: [{ role: 'user', content: 'ping' }]
          })
        });
        if (res.ok) {
          keyValid = true;
          testError = '';
        } else {
          keyValid = false;
          const body = await res.text().catch(() => '');
          testError = `HTTP ${res.status}: ${body.slice(0, 200)}`;
        }
      }
    } catch (err) {
      keyValid = false;
      testError = err.message || 'Unknown error';
    }
    testing = false;
  }

  async function clearAllData() {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await new Promise(r => chrome.storage.local.clear(r));
    }
    settings = await loadSettings();
    keyValid = null;
    saveStatus = 'cleared';
    setTimeout(() => saveStatus = '', 2000);
  }
</script>

<div class="settings-container">
  <h3 class="section-title">Settings</h3>
  <p class="section-desc">API 키, 모델 선택, 환경 설정을 관리합니다.</p>

  <!-- API Key -->
  <div class="settings-group">
    <div class="group-header">
      <span class="group-icon">🔑</span>
      <span class="group-label">API Key</span>
      {#if keyValid === true}
        <span class="badge-ok">Connected</span>
      {:else if keyValid === false}
        <span class="badge-err">Invalid</span>
      {/if}
    </div>

    <div class="api-key-row">
      <div class="input-wrap">
        {#if apiKeyVisible}
          <input
            type="text"
            bind:value={settings.apiKey}
            placeholder="sk-ant-api03-..."
            class="input"
            class:input-error={keyValid === false}
            class:input-ok={keyValid === true}
          />
        {:else}
          <input
            type="password"
            bind:value={settings.apiKey}
            placeholder="sk-ant-api03-..."
            class="input"
            class:input-error={keyValid === false}
            class:input-ok={keyValid === true}
          />
        {/if}
        <button class="btn-toggle" on:click={() => apiKeyVisible = !apiKeyVisible}>
          {apiKeyVisible ? '🙈' : '👁'}
        </button>
      </div>
      <button class="btn-sm" on:click={testApiKey} disabled={testing || !settings.apiKey}>
        {testing ? 'Testing...' : 'Test'}
      </button>
    </div>

    {#if testError}
      <p class="test-error">{testError}</p>
    {/if}

    <p class="hint">
      Anthropic Console에서 API 키를 발급받으세요.
      키는 로컬에만 저장되며 외부로 전송되지 않습니다 (BYOK).
    </p>
  </div>

  <!-- Model selection -->
  <div class="settings-group">
    <div class="group-header">
      <span class="group-icon">🤖</span>
      <span class="group-label">AI Model</span>
    </div>

    <div class="model-list">
      {#each MODEL_OPTIONS as opt}
        <label class="model-card" class:selected={settings.model === opt.value}>
          <input type="radio" bind:group={settings.model} value={opt.value} />
          <div class="model-info">
            <span class="model-name">{opt.label}</span>
            <span class="model-desc">{opt.desc}</span>
          </div>
          <span class="model-cost">{opt.cost}</span>
        </label>
      {/each}
    </div>
  </div>

  <!-- Max tokens -->
  <div class="settings-group">
    <div class="group-header">
      <span class="group-icon">📏</span>
      <span class="group-label">Max Tokens</span>
      <span class="current-val">{settings.maxTokens}</span>
    </div>
    <input
      type="range"
      min="256"
      max="8192"
      step="256"
      bind:value={settings.maxTokens}
      class="range-input"
    />
    <div class="range-labels">
      <span>256</span>
      <span>8192</span>
    </div>
  </div>

  <!-- Preferences -->
  <div class="settings-group">
    <div class="group-header">
      <span class="group-icon">⚙</span>
      <span class="group-label">Preferences</span>
    </div>

    <div class="pref-list">
      <label class="pref-row">
        <span class="pref-text">비용 확인 후 API 호출</span>
        <input type="checkbox" bind:checked={settings.costConfirm} class="toggle" />
      </label>
      <label class="pref-row">
        <span class="pref-text">실시간 인라인 코칭</span>
        <input type="checkbox" bind:checked={settings.inlineCoaching} class="toggle" />
      </label>
      <label class="pref-row">
        <span class="pref-text">히스토리 자동 저장</span>
        <input type="checkbox" bind:checked={settings.historyAutoSave} class="toggle" />
      </label>
      <label class="pref-row">
        <span class="pref-text">언어</span>
        <select bind:value={settings.language} class="select-sm">
          {#each LANGUAGE_OPTIONS as lang}
            <option value={lang.value}>{lang.label}</option>
          {/each}
        </select>
      </label>
    </div>
  </div>

  <!-- Actions -->
  <div class="action-bar">
    <button class="btn-save" on:click={save}>
      {saveStatus === 'saved' ? '✓ Saved!' : 'Save Settings'}
    </button>
    <button class="btn-danger" on:click={clearAllData}>
      {saveStatus === 'cleared' ? '✓ Cleared!' : 'Clear All Data'}
    </button>
  </div>

  <p class="footer-hint">
    모든 데이터는 브라우저 로컬 저장소(chrome.storage.local)에만 저장됩니다.
    서버로 전송되는 데이터는 없습니다.
  </p>
</div>

<style>
  .settings-container {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    padding: 24px;
  }
  .section-title {
    color: #f1f5f9; font-size: 18px; font-weight: 700; margin: 0 0 4px 0;
  }
  .section-desc {
    color: #64748b; font-size: 13px; margin: 0 0 20px 0;
  }

  /* Group */
  .settings-group {
    background: #1e293b; border: 1px solid #334155; border-radius: 10px;
    padding: 16px; margin-bottom: 14px;
  }
  .group-header {
    display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
  }
  .group-icon { font-size: 16px; }
  .group-label {
    font-size: 14px; font-weight: 600; color: #e2e8f0; flex: 1;
  }
  .current-val {
    font-size: 13px; font-weight: 700; color: #7c3aed;
    background: rgba(124,58,237,0.12); padding: 2px 8px; border-radius: 6px;
  }
  .badge-ok {
    font-size: 11px; font-weight: 600; color: #22c55e;
    background: rgba(34,197,94,0.12); padding: 2px 10px; border-radius: 10px;
  }
  .badge-err {
    font-size: 11px; font-weight: 600; color: #ef4444;
    background: rgba(239,68,68,0.12); padding: 2px 10px; border-radius: 10px;
  }

  /* API Key */
  .api-key-row { display: flex; gap: 8px; align-items: center; }
  .input-wrap {
    flex: 1; display: flex; position: relative;
  }
  .input {
    flex: 1; padding: 10px 40px 10px 12px; background: #0f172a;
    border: 1px solid #334155; border-radius: 8px;
    color: #e2e8f0; font-size: 13px; font-family: monospace; outline: none;
  }
  .input:focus { border-color: #7c3aed; }
  .input-ok { border-color: #22c55e; }
  .input-error { border-color: #ef4444; }
  .btn-toggle {
    position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
    background: none; border: none; font-size: 14px; cursor: pointer;
    padding: 2px;
  }
  .btn-sm {
    padding: 8px 16px; border-radius: 8px; border: 1px solid #334155;
    background: #0f172a; color: #cbd5e1; font-size: 12px;
    font-weight: 600; cursor: pointer; transition: all 0.15s;
    white-space: nowrap;
  }
  .btn-sm:hover { background: #334155; }
  .btn-sm:disabled { opacity: 0.4; cursor: default; }
  .test-error {
    font-size: 11px; color: #fca5a5; margin: 8px 0 0 0; line-height: 1.5;
    padding: 8px 10px; background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.2); border-radius: 6px;
    word-break: break-all;
  }
  .hint {
    font-size: 11px; color: #475569; margin: 8px 0 0 0; line-height: 1.5;
  }

  /* Model */
  .model-list { display: flex; flex-direction: column; gap: 6px; }
  .model-card {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; background: #0f172a;
    border: 1px solid #334155; border-radius: 8px;
    cursor: pointer; transition: all 0.15s;
  }
  .model-card:hover { border-color: #475569; }
  .model-card.selected { border-color: #7c3aed; background: rgba(124,58,237,0.06); }
  .model-card input[type="radio"] {
    accent-color: #7c3aed; width: 16px; height: 16px; margin: 0; flex-shrink: 0;
  }
  .model-info { flex: 1; display: flex; flex-direction: column; }
  .model-name { font-size: 13px; font-weight: 600; color: #e2e8f0; }
  .model-desc { font-size: 11px; color: #64748b; }
  .model-cost {
    font-size: 10px; color: #94a3b8; background: #0f172a;
    padding: 3px 8px; border-radius: 6px; border: 1px solid #334155;
    white-space: nowrap;
  }

  /* Range */
  .range-input {
    width: 100%; accent-color: #7c3aed; height: 6px;
    background: #334155; border-radius: 3px;
    -webkit-appearance: none; appearance: none; outline: none;
  }
  .range-input::-webkit-slider-thumb {
    -webkit-appearance: none; width: 18px; height: 18px;
    border-radius: 50%; background: #7c3aed; cursor: pointer;
    border: 2px solid #0f172a;
  }
  .range-labels {
    display: flex; justify-content: space-between;
    font-size: 10px; color: #475569; margin-top: 4px;
  }

  /* Preferences */
  .pref-list { display: flex; flex-direction: column; gap: 4px; }
  .pref-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 0; border-bottom: 1px solid #0f172a; cursor: pointer;
  }
  .pref-row:last-child { border-bottom: none; }
  .pref-text { font-size: 13px; color: #cbd5e1; }
  .toggle {
    accent-color: #7c3aed; width: 18px; height: 18px; cursor: pointer;
  }
  .select-sm {
    padding: 4px 8px; background: #0f172a; border: 1px solid #334155;
    border-radius: 6px; color: #94a3b8; font-size: 12px; cursor: pointer; outline: none;
  }

  /* Action bar */
  .action-bar {
    display: flex; gap: 10px; margin-top: 4px;
  }
  .btn-save {
    flex: 1; padding: 10px; background: #7c3aed; color: white;
    border: none; border-radius: 8px; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s;
  }
  .btn-save:hover { background: #6d28d9; }
  .btn-danger {
    padding: 10px 16px; background: transparent; color: #f87171;
    border: 1px solid rgba(239,68,68,0.3); border-radius: 8px;
    font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s;
  }
  .btn-danger:hover { background: rgba(239,68,68,0.1); }

  .footer-hint {
    font-size: 11px; color: #334155; text-align: center; margin: 14px 0 0 0;
  }
</style>
