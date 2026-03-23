<script>
  import PromptStructureTree from './components/PromptStructureTree.svelte';
  import MetricsDashboard from './components/MetricsDashboard.svelte';
  import InlineAnnotation from './components/InlineAnnotation.svelte';
  import HistoryPage from './components/HistoryPage.svelte';
  import SettingsPage from './components/SettingsPage.svelte';
  import {
    promptStructure,
    radarScores,
    tokenDistribution,
    historyTrend,
    annotatedPrompt,
    overallScore
  } from './data/sampleAnalysis.js';

  let activeTab = 'all';
  const tabs = [
    { id: 'all', label: 'All Views' },
    { id: 'structure', label: 'Structure' },
    { id: 'metrics', label: 'Metrics' },
    { id: 'annotation', label: 'Annotation' },
    { id: 'history', label: 'History' },
    { id: 'settings', label: 'Settings' }
  ];
</script>

<main>
  <header>
    <div class="logo">
      <span class="logo-icon">◈</span>
      <h1>PromptLens</h1>
      <span class="badge">Visualization Prototype</span>
    </div>
    <p class="subtitle">Svelte + D3.js + ECharts — High-quality prompt analysis visualization</p>
  </header>

  <nav class="tabs">
    {#each tabs as tab}
      <button
        class="tab"
        class:active={activeTab === tab.id}
        on:click={() => activeTab = tab.id}
      >
        {tab.label}
      </button>
    {/each}
  </nav>

  <div class="content">
    {#if activeTab === 'all' || activeTab === 'annotation'}
      <section>
        <InlineAnnotation {annotatedPrompt} />
      </section>
    {/if}

    {#if activeTab === 'all' || activeTab === 'metrics'}
      <section>
        <MetricsDashboard {radarScores} {tokenDistribution} {historyTrend} {overallScore} />
      </section>
    {/if}

    {#if activeTab === 'all' || activeTab === 'structure'}
      <section>
        <PromptStructureTree data={promptStructure} />
      </section>
    {/if}

    {#if activeTab === 'history'}
      <section>
        <HistoryPage />
      </section>
    {/if}

    {#if activeTab === 'settings'}
      <section>
        <SettingsPage />
      </section>
    {/if}
  </div>

  <footer>
    <span>PromptLens © 2026</span>
    <span class="stack">Svelte · D3.js · ECharts</span>
  </footer>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: #020617;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e2e8f0;
    -webkit-font-smoothing: antialiased;
  }

  main {
    max-width: 1060px;
    margin: 0 auto;
    padding: 32px 24px;
  }

  header { margin-bottom: 28px; }
  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .logo-icon {
    font-size: 28px;
    color: #7c3aed;
  }
  h1 {
    font-size: 26px;
    font-weight: 800;
    margin: 0;
    background: linear-gradient(135deg, #7c3aed, #2563eb);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .badge {
    background: rgba(124,58,237,0.15);
    color: #a78bfa;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 20px;
    border: 1px solid rgba(124,58,237,0.3);
  }
  .subtitle {
    color: #64748b;
    font-size: 14px;
    margin: 8px 0 0 0;
  }

  .tabs {
    display: flex;
    gap: 4px;
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 10px;
    padding: 4px;
    margin-bottom: 24px;
  }
  .tab {
    flex: 1;
    padding: 10px 16px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: #64748b;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .tab:hover { color: #cbd5e1; background: #1e293b; }
  .tab.active { background: #7c3aed; color: #fff; }

  .content {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  section {
    animation: slideUp 0.4s ease;
  }

  footer {
    display: flex;
    justify-content: space-between;
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #1e293b;
    color: #475569;
    font-size: 12px;
  }
  .stack { color: #64748b; }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
