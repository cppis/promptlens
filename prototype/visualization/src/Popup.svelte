<script>
  import { onMount } from 'svelte';
  import * as echarts from 'echarts';
  import { overallScore, radarScores } from './data/sampleAnalysis.js';
  import { loadSettings, saveSettings, isApiKeySet, MODEL_OPTIONS } from './lib/SettingsManager.js';

  let gaugeEl;
  let radarEl;
  let apiKeySet = false;
  let showSettings = false;
  let settings = {};
  let keyVisible = false;
  let saveMsg = '';

  const gradeColor = (s) => s >= 80 ? '#22c55e' : s >= 60 ? '#f59e0b' : '#ef4444';

  async function savePopupSettings() {
    await saveSettings(settings);
    apiKeySet = await isApiKeySet();
    saveMsg = '✓ Saved';
    setTimeout(() => saveMsg = '', 1500);
  }

  onMount(async () => {
    settings = await loadSettings();
    apiKeySet = await isApiKeySet();

    // Gauge
    const gauge = echarts.init(gaugeEl, null, { renderer: 'canvas' });
    gauge.setOption({
      animation: true,
      animationDuration: 1200,
      series: [{
        type: 'gauge',
        startAngle: 210, endAngle: -30,
        min: 0, max: 100, radius: '88%',
        progress: { show: true, width: 12, roundCap: true,
          itemStyle: { color: gradeColor(overallScore.value) }
        },
        pointer: { show: false },
        axisLine: { lineStyle: { width: 12, color: [[1, '#334155']] } },
        axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
        title: { show: false },
        detail: {
          offsetCenter: [0, 0], fontSize: 28, fontWeight: 700,
          color: gradeColor(overallScore.value),
          formatter: () => `${overallScore.value}`
        },
        data: [{ value: overallScore.value }]
      }]
    });

    // Mini radar
    const radar = echarts.init(radarEl, null, { renderer: 'canvas' });
    radar.setOption({
      animation: true,
      animationDuration: 1000,
      radar: {
        indicator: radarScores.axes.map(a => ({ name: a, max: 100 })),
        shape: 'polygon', splitNumber: 3, radius: '65%',
        axisName: { color: '#94a3b8', fontSize: 10 },
        splitLine: { lineStyle: { color: '#334155' } },
        splitArea: { areaStyle: { color: ['transparent'] } },
        axisLine: { lineStyle: { color: '#334155' } }
      },
      series: [{
        type: 'radar',
        data: [{
          value: radarScores.current, name: 'Current',
          lineStyle: { color: '#f59e0b', width: 2 },
          areaStyle: { color: 'rgba(245,158,11,0.15)' },
          itemStyle: { color: '#f59e0b' }, symbol: 'circle', symbolSize: 4
        }]
      }]
    });

    const obs = new ResizeObserver(() => { gauge.resize(); radar.resize(); });
    obs.observe(gaugeEl);
    return () => { obs.disconnect(); gauge.dispose(); radar.dispose(); };
  });

  function openSidePanel() {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL', tabId: tabs[0].id });
        }
      });
    }
  }
</script>

<div class="popup">
  <header>
    <span class="logo-icon">◈</span>
    <h1>PromptLens</h1>
    <span class="version">v0.2</span>
    <button class="btn-gear" class:active={showSettings} on:click={() => showSettings = !showSettings}>⚙</button>
  </header>

  {#if !apiKeySet && !showSettings}
    <button class="alert alert-btn" on:click={() => showSettings = true}>
      <span>⚠</span> API Key 미설정 — 여기를 눌러 입력하세요
    </button>
  {/if}

  {#if showSettings}
    <div class="popup-settings">
      <div class="ps-group">
        <label class="ps-label">API Key</label>
        <div class="ps-key-row">
          <input
            type={keyVisible ? 'text' : 'password'}
            bind:value={settings.apiKey}
            placeholder="sk-ant-api03-..."
            class="ps-input mono"
          />
          <button class="ps-btn-sm" on:click={() => keyVisible = !keyVisible}>
            {keyVisible ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      <div class="ps-group">
        <label class="ps-label">Model</label>
        <select bind:value={settings.model} class="ps-input">
          {#each MODEL_OPTIONS as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>

      <button class="btn-primary ps-save" on:click={savePopupSettings}>
        {saveMsg || 'Save'}
      </button>
    </div>
  {/if}

  <div class="cards">
    <div class="card">
      <div class="card-label">Overall Score</div>
      <div bind:this={gaugeEl} class="mini-chart"></div>
      <div class="grade" style="color:{gradeColor(overallScore.value)}">{overallScore.grade}</div>
    </div>
    <div class="card">
      <div class="card-label">Quality Radar</div>
      <div bind:this={radarEl} class="mini-chart"></div>
    </div>
  </div>

  <button class="btn-primary" on:click={openSidePanel}>
    📊 Full Analysis (Side Panel)
  </button>

  <div class="quick-stats">
    <div class="stat">
      <span class="stat-value">68</span>
      <span class="stat-label">Avg Score</span>
    </div>
    <div class="stat">
      <span class="stat-value">42</span>
      <span class="stat-label">Prompts</span>
    </div>
    <div class="stat">
      <span class="stat-value">+23%</span>
      <span class="stat-label">7d Growth</span>
    </div>
  </div>
</div>

<style>
  .popup {
    width: 360px;
    background: #020617;
    padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e2e8f0;
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
  .logo-icon { font-size: 20px; color: #7c3aed; }
  h1 {
    font-size: 18px; font-weight: 800; margin: 0;
    background: linear-gradient(135deg, #7c3aed, #2563eb);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  .version {
    font-size: 10px; color: #64748b; background: #1e293b;
    padding: 2px 6px; border-radius: 8px;
  }
  .btn-gear {
    margin-left: auto; width: 28px; height: 28px; border-radius: 6px;
    background: #1e293b; border: 1px solid #334155; color: #94a3b8;
    font-size: 14px; cursor: pointer; transition: all 0.15s;
    display: flex; align-items: center; justify-content: center;
  }
  .btn-gear:hover, .btn-gear.active { background: #7c3aed; color: white; border-color: #7c3aed; }
  .alert {
    background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3);
    border-radius: 8px; padding: 8px 12px; font-size: 12px; color: #fbbf24;
    margin-bottom: 12px;
  }
  .alert-btn {
    width: 100%; cursor: pointer; text-align: left; transition: all 0.15s;
  }
  .alert-btn:hover { background: rgba(245,158,11,0.18); }

  /* Popup settings panel */
  .popup-settings {
    background: #1e293b; border: 1px solid #334155; border-radius: 10px;
    padding: 12px; margin-bottom: 12px;
    animation: slideDown 0.2s ease;
  }
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .ps-group { margin-bottom: 10px; }
  .ps-label {
    display: block; font-size: 11px; font-weight: 600; color: #94a3b8;
    text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;
  }
  .ps-key-row { display: flex; gap: 4px; }
  .ps-input {
    width: 100%; padding: 8px 10px; background: #0f172a;
    border: 1px solid #334155; border-radius: 6px;
    color: #e2e8f0; font-size: 12px; outline: none;
  }
  .ps-input:focus { border-color: #7c3aed; }
  .ps-input.mono { font-family: monospace; flex: 1; }
  .ps-btn-sm {
    background: #0f172a; border: 1px solid #334155; border-radius: 6px;
    color: #94a3b8; cursor: pointer; padding: 4px 8px; font-size: 12px;
  }
  .ps-save { margin-top: 2px; padding: 8px; font-size: 12px; }
  .cards {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;
  }
  .card {
    background: #1e293b; border: 1px solid #334155; border-radius: 10px;
    padding: 10px; text-align: center;
  }
  .card-label {
    font-size: 10px; font-weight: 600; color: #94a3b8;
    text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;
  }
  .mini-chart { height: 120px; }
  .grade { font-size: 16px; font-weight: 800; margin-top: -4px; }
  .btn-primary {
    width: 100%; padding: 10px; background: #7c3aed; color: white;
    border: none; border-radius: 8px; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: background 0.2s;
  }
  .btn-primary:hover { background: #6d28d9; }
  .quick-stats {
    display: flex; justify-content: space-around; margin-top: 12px;
    background: #0f172a; border-radius: 8px; padding: 10px;
  }
  .stat { text-align: center; }
  .stat-value { display: block; font-size: 16px; font-weight: 700; color: #f1f5f9; }
  .stat-label { font-size: 10px; color: #64748b; }
</style>
