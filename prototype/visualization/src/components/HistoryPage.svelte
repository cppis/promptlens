<script>
  import { onMount } from 'svelte';
  import * as hm from '../lib/HistoryManager.js';
  import {
    detectAndParse, detectAndParseGrouped,
    importToHistory, importGroupedToHistory,
    previewStats, previewGroupedStats
  } from '../lib/ClaudeImporter.js';

  // State
  let projects = [];
  let selectedProjectId = null;
  let entries = [];
  let searchQuery = '';
  let sortBy = 'date'; // date | score
  let editingEntry = null;
  let showNewProject = false;
  let newProjectName = '';
  let editingProjectId = null;
  let editProjectName = '';

  // Detail / edit modal
  let detailEntry = null;
  let editMode = false;
  let editForm = { prompt: '', enhanced: '', note: '', tags: '', platform: '', score: 0 };

  // Import modal
  let showImport = false;
  let importStep = 'select'; // select | preview | done
  let importSource = '';
  let importFilename = '';
  let importParsed = null;   // flat entries (for single mode)
  let importGroups = null;    // conversation groups (for grouped mode)
  let importStats = null;
  let importGroupedStats = null;
  let importResult = null;
  let importProjectName = '';
  let importTargetProject = 'new'; // 'new' or existing projectId
  let importMode = 'per-conversation'; // 'single' | 'per-conversation'
  let importSelectedGroups = new Set(); // selected conversation uuids
  let importSelectAll = true;
  let importError = '';
  let importing = false;
  let importRawText = '';     // raw file text for re-parsing

  $: filteredEntries = entries
    .filter(e => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return e.prompt.toLowerCase().includes(q)
        || e.enhanced.toLowerCase().includes(q)
        || e.tags.some(t => t.toLowerCase().includes(q))
        || e.note.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  $: selectedProject = projects.find(p => p.id === selectedProjectId);
  $: avgScore = hm.calcAvgScore(entries);
  $: trend = hm.calcScoreTrend(entries);

  onMount(async () => {
    await hm.seedDemoData();
    projects = await hm.getProjects();
    if (projects.length > 0) {
      selectedProjectId = projects[0].id;
      entries = await hm.getHistory(selectedProjectId);
    }
  });

  async function selectProject(id) {
    selectedProjectId = id;
    entries = await hm.getHistory(id);
    detailEntry = null;
    editMode = false;
  }

  async function createProject() {
    if (!newProjectName.trim()) return;
    const proj = await hm.createProject(newProjectName.trim());
    projects = await hm.getProjects();
    showNewProject = false;
    newProjectName = '';
    await selectProject(proj.id);
  }

  async function startRenameProject(proj) {
    editingProjectId = proj.id;
    editProjectName = proj.name;
  }

  async function saveRenameProject() {
    if (editProjectName.trim() && editingProjectId) {
      await hm.renameProject(editingProjectId, editProjectName.trim());
      projects = await hm.getProjects();
    }
    editingProjectId = null;
  }

  async function deleteProject(id) {
    await hm.deleteProject(id);
    projects = await hm.getProjects();
    if (selectedProjectId === id) {
      selectedProjectId = projects.length > 0 ? projects[0].id : null;
      entries = selectedProjectId ? await hm.getHistory(selectedProjectId) : [];
    }
    detailEntry = null;
  }

  function openDetail(entry) {
    detailEntry = entry;
    editMode = false;
  }

  function startEdit(entry) {
    editForm = {
      prompt: entry.prompt,
      enhanced: entry.enhanced,
      note: entry.note,
      tags: entry.tags.join(', '),
      platform: entry.platform,
      score: entry.score
    };
    editMode = true;
  }

  async function saveEdit() {
    if (!detailEntry) return;
    const updates = {
      prompt: editForm.prompt,
      enhanced: editForm.enhanced,
      note: editForm.note,
      tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      platform: editForm.platform,
      score: Number(editForm.score)
    };
    await hm.updateHistoryEntry(selectedProjectId, detailEntry.id, updates);
    entries = await hm.getHistory(selectedProjectId);
    detailEntry = entries.find(e => e.id === detailEntry.id);
    editMode = false;
  }

  async function deleteEntry(entryId) {
    await hm.deleteHistoryEntry(selectedProjectId, entryId);
    entries = await hm.getHistory(selectedProjectId);
    projects = await hm.getProjects();
    detailEntry = null;
  }

  function scoreColor(s) {
    if (s >= 80) return '#22c55e';
    if (s >= 60) return '#f59e0b';
    return '#ef4444';
  }

  function platformIcon(p) {
    const icons = { claude: '🟣', chatgpt: '🟢', gemini: '🔵' };
    return icons[p] || '⚪';
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  // --- Import functions ---
  function openImport() {
    showImport = true;
    importStep = 'select';
    importParsed = null;
    importGroups = null;
    importStats = null;
    importGroupedStats = null;
    importResult = null;
    importError = '';
    importProjectName = '';
    importTargetProject = 'new';
    importMode = 'per-conversation';
    importSelectedGroups = new Set();
    importSelectAll = true;
    importRawText = '';
  }

  function closeImport() {
    showImport = false;
    importStep = 'select';
    importParsed = null;
    importGroups = null;
    importError = '';
    importRawText = '';
  }

  async function handleFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    importError = '';
    importFilename = file.name;

    try {
      const text = await file.text();
      importRawText = text;

      // Parse flat entries
      const result = detectAndParse(text, file.name);
      importSource = result.source;
      importParsed = result.entries;
      importStats = previewStats(result.entries);

      // Parse grouped conversations
      const grouped = detectAndParseGrouped(text, file.name);
      importGroups = grouped.groups;
      importGroupedStats = previewGroupedStats(grouped.groups);

      // Select all groups by default
      importSelectedGroups = new Set(importGroups.map(g => g.uuid));
      importSelectAll = true;

      importProjectName = importSource === 'claude-code'
        ? `Claude Code Import (${new Date().toLocaleDateString()})`
        : `Claude Desktop Import (${new Date().toLocaleDateString()})`;
      importStep = 'preview';
    } catch (err) {
      importError = err.message;
    }
  }

  function toggleGroupSelection(uuid) {
    if (importSelectedGroups.has(uuid)) {
      importSelectedGroups.delete(uuid);
    } else {
      importSelectedGroups.add(uuid);
    }
    importSelectedGroups = new Set(importSelectedGroups); // trigger reactivity
    importSelectAll = importGroups && importSelectedGroups.size === importGroups.length;
  }

  function toggleSelectAll() {
    if (importSelectAll) {
      importSelectedGroups = new Set();
      importSelectAll = false;
    } else {
      importSelectedGroups = new Set(importGroups.map(g => g.uuid));
      importSelectAll = true;
    }
  }

  $: importSelectedCount = importGroups
    ? importGroups.filter(g => importSelectedGroups.has(g.uuid)).reduce((s, g) => s + g.promptCount, 0)
    : 0;

  async function executeImport() {
    if (!importParsed && !importGroups) return;
    importing = true;
    importError = '';

    try {
      if (importMode === 'per-conversation' && importGroups) {
        // Per-conversation: each conversation becomes its own project
        importResult = await importGroupedToHistory(importGroups, {
          source: importSource,
          minLength: 10,
          dedup: true,
          selectedGroups: importSelectedGroups.size > 0 ? importSelectedGroups : null
        });

        projects = await hm.getProjects();
        if (importResult.projectIds?.length > 0) {
          await selectProject(importResult.projectIds[0]);
        }
      } else {
        // Single project mode
        const targetId = importTargetProject === 'new' ? null : importTargetProject;
        const name = importTargetProject === 'new' ? importProjectName : null;

        importResult = await importToHistory(targetId, name, importParsed, {
          source: importSource,
          minLength: 10,
          dedup: true
        });

        projects = await hm.getProjects();
        await selectProject(importResult.projectId);
      }
      importStep = 'done';
    } catch (err) {
      importError = err.message;
    }
    importing = false;
  }
</script>

<div class="history-page">
  <!-- Sidebar: Projects -->
  <aside class="sidebar">
    <div class="sidebar-header">
      <h3>Projects</h3>
      <button class="btn-icon" on:click={openImport} title="Import from Claude">↓</button>
      <button class="btn-icon" on:click={() => showNewProject = !showNewProject} title="New project">+</button>
    </div>

    {#if showNewProject}
      <div class="new-project">
        <input
          type="text"
          bind:value={newProjectName}
          placeholder="Project name..."
          on:keydown={(e) => e.key === 'Enter' && createProject()}
        />
        <button class="btn-sm" on:click={createProject}>Create</button>
      </div>
    {/if}

    <ul class="project-list">
      {#each projects as proj}
        <li class="project-item" class:active={selectedProjectId === proj.id}>
          {#if editingProjectId === proj.id}
            <input
              type="text"
              class="rename-input"
              bind:value={editProjectName}
              on:keydown={(e) => e.key === 'Enter' && saveRenameProject()}
              on:blur={saveRenameProject}
            />
          {:else}
            <button class="project-btn" on:click={() => selectProject(proj.id)}>
              <span class="project-name">{proj.name}</span>
              <span class="project-count">{proj.promptCount}</span>
            </button>
            <div class="project-actions">
              <button class="btn-tiny" on:click|stopPropagation={() => startRenameProject(proj)} title="Rename">✎</button>
              <button class="btn-tiny danger" on:click|stopPropagation={() => deleteProject(proj.id)} title="Delete">×</button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>

    {#if selectedProject}
      <div class="sidebar-stats">
        <div class="stat-row">
          <span>Avg Score</span>
          <span class="stat-val" style="color:{scoreColor(avgScore)}">{avgScore}</span>
        </div>
        <div class="stat-row">
          <span>7d Trend</span>
          <span class="stat-val" style="color:{trend >= 0 ? '#22c55e' : '#ef4444'}">
            {trend >= 0 ? '+' : ''}{trend}
          </span>
        </div>
        <div class="stat-row">
          <span>Total</span>
          <span class="stat-val">{entries.length}</span>
        </div>
      </div>
    {/if}
  </aside>

  <!-- Main: Entry list or Detail -->
  <main class="main-area">
    {#if detailEntry}
      <!-- Detail / Edit view -->
      <div class="detail-panel">
        <div class="detail-header">
          <button class="btn-back" on:click={() => { detailEntry = null; editMode = false; }}>← Back</button>
          <div class="detail-actions">
            {#if editMode}
              <button class="btn-sm accent" on:click={saveEdit}>Save</button>
              <button class="btn-sm" on:click={() => editMode = false}>Cancel</button>
            {:else}
              <button class="btn-sm" on:click={() => startEdit(detailEntry)}>Edit</button>
              <button class="btn-sm danger" on:click={() => deleteEntry(detailEntry.id)}>Delete</button>
            {/if}
          </div>
        </div>

        {#if editMode}
          <!-- Edit form -->
          <div class="edit-form">
            <label>
              <span class="label-text">Original Prompt</span>
              <textarea bind:value={editForm.prompt} rows="4"></textarea>
            </label>
            <label>
              <span class="label-text">Enhanced Prompt</span>
              <textarea bind:value={editForm.enhanced} rows="6"></textarea>
            </label>
            <div class="form-row">
              <label class="flex-1">
                <span class="label-text">Score (0-100)</span>
                <input type="number" min="0" max="100" bind:value={editForm.score} />
              </label>
              <label class="flex-1">
                <span class="label-text">Platform</span>
                <select bind:value={editForm.platform}>
                  <option value="claude">Claude</option>
                  <option value="chatgpt">ChatGPT</option>
                  <option value="gemini">Gemini</option>
                  <option value="">Other</option>
                </select>
              </label>
            </div>
            <label>
              <span class="label-text">Tags (comma-separated)</span>
              <input type="text" bind:value={editForm.tags} placeholder="backend, testing, ..." />
            </label>
            <label>
              <span class="label-text">Note</span>
              <textarea bind:value={editForm.note} rows="2"></textarea>
            </label>
          </div>
        {:else}
          <!-- Read-only detail -->
          <div class="detail-content">
            <div class="detail-meta">
              <span class="score-badge" style="background:{scoreColor(detailEntry.score)}">{detailEntry.score}</span>
              <span>{platformIcon(detailEntry.platform)} {detailEntry.platform || 'Unknown'}</span>
              <span class="time">{new Date(detailEntry.createdAt).toLocaleString()}</span>
            </div>

            <div class="prompt-section">
              <h4>Original Prompt</h4>
              <div class="prompt-text">{detailEntry.prompt}</div>
            </div>

            {#if detailEntry.enhanced}
              <div class="prompt-section enhanced">
                <h4>Enhanced Prompt</h4>
                <div class="prompt-text">{detailEntry.enhanced}</div>
              </div>
            {/if}

            {#if detailEntry.axisScores?.length}
              <div class="axis-scores">
                <h4>Axis Scores</h4>
                <div class="axis-bars">
                  {#each ['Clarity', 'Specificity', 'Context', 'Structure', 'Actionability'] as axis, i}
                    <div class="axis-bar-row">
                      <span class="axis-label">{axis}</span>
                      <div class="bar-track">
                        <div class="bar-fill" style="width:{detailEntry.axisScores[i]}%; background:{scoreColor(detailEntry.axisScores[i])}"></div>
                      </div>
                      <span class="axis-val" style="color:{scoreColor(detailEntry.axisScores[i])}">{detailEntry.axisScores[i]}</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            {#if detailEntry.tags.length}
              <div class="tags-row">
                {#each detailEntry.tags as tag}
                  <span class="tag">{tag}</span>
                {/each}
              </div>
            {/if}

            {#if detailEntry.note}
              <div class="note-section">
                <h4>Note</h4>
                <p>{detailEntry.note}</p>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {:else}
      <!-- Entry list -->
      <div class="list-header">
        <input
          type="text"
          class="search-input"
          placeholder="Search prompts, tags, notes..."
          bind:value={searchQuery}
        />
        <select class="sort-select" bind:value={sortBy}>
          <option value="date">Latest first</option>
          <option value="score">Highest score</option>
        </select>
      </div>

      {#if filteredEntries.length === 0}
        <div class="empty-state">
          <p>No prompt history yet.</p>
          <p class="empty-hint">Analyze prompts to build your history.</p>
        </div>
      {:else}
        <ul class="entry-list">
          {#each filteredEntries as entry}
            <li class="entry-card" on:click={() => openDetail(entry)}>
              <div class="entry-top">
                <span class="score-pill" style="background:{scoreColor(entry.score)}">{entry.score}</span>
                <span class="entry-platform">{platformIcon(entry.platform)}</span>
                <span class="entry-prompt">{entry.prompt}</span>
                <span class="entry-time">{timeAgo(entry.createdAt)}</span>
              </div>
              {#if entry.enhanced}
                <div class="entry-enhanced">{entry.enhanced.slice(0, 120)}…</div>
              {/if}
              <div class="entry-bottom">
                {#each entry.tags.slice(0, 3) as tag}
                  <span class="tag-sm">{tag}</span>
                {/each}
                {#if entry.note}
                  <span class="note-indicator" title={entry.note}>📝</span>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </main>

  <!-- Import Modal -->
  {#if showImport}
    <div class="modal-overlay" on:click|self={closeImport}>
      <div class="modal import-modal">
        <div class="modal-header">
          <h3>Import from Claude</h3>
          <button class="btn-close" on:click={closeImport}>×</button>
        </div>

        {#if importStep === 'select'}
          <div class="modal-body">
            <p class="import-desc">
              Import your conversation history from Claude Code or Claude Desktop.
            </p>

            <div class="import-sources">
              <div class="source-card">
                <span class="source-icon">⌨</span>
                <strong>Claude Code</strong>
                <span class="source-hint">.jsonl files from<br/>~/.claude/projects/</span>
              </div>
              <div class="source-card">
                <span class="source-icon">💬</span>
                <strong>Claude Desktop</strong>
                <span class="source-hint">.json from Settings ><br/>Privacy > Export Data</span>
              </div>
            </div>

            <label class="file-drop">
              <input
                type="file"
                accept=".jsonl,.json"
                on:change={handleFileSelect}
                style="display:none"
              />
              <div class="drop-content">
                <span class="drop-icon">📂</span>
                <span>Click to select a .jsonl or .json file</span>
                <span class="drop-hint">Format is auto-detected</span>
              </div>
            </label>

            {#if importError}
              <div class="import-error">{importError}</div>
            {/if}
          </div>

        {:else if importStep === 'preview'}
          <div class="modal-body">
            <div class="preview-header">
              <span class="source-badge">
                {importSource === 'claude-code' ? '⌨ Claude Code' : '💬 Claude Desktop'}
              </span>
              <span class="file-name">{importFilename}</span>
            </div>

            <!-- Summary stats -->
            {#if importStats}
              <div class="stats-grid">
                <div class="stat-card">
                  <span class="stat-number">{importGroups?.length || 0}</span>
                  <span class="stat-label">Conversations</span>
                </div>
                <div class="stat-card">
                  <span class="stat-number">{importStats.total}</span>
                  <span class="stat-label">Prompts</span>
                </div>
                <div class="stat-card">
                  <span class="stat-number">{importStats.withResponse}</span>
                  <span class="stat-label">With responses</span>
                </div>
                <div class="stat-card">
                  <span class="stat-number">{importStats.avgLength}</span>
                  <span class="stat-label">Avg length</span>
                </div>
              </div>

              {#if importStats.dateRange}
                <div class="date-range">
                  {new Date(importStats.dateRange.from).toLocaleDateString()} — {new Date(importStats.dateRange.to).toLocaleDateString()}
                </div>
              {/if}
            {/if}

            <!-- Import mode selector -->
            <div class="mode-section">
              <label class="label-text">Import mode</label>
              <div class="mode-options">
                <label class="mode-option" class:selected={importMode === 'per-conversation'}>
                  <input type="radio" bind:group={importMode} value="per-conversation" />
                  <div class="mode-info">
                    <strong>Per conversation</strong>
                    <span>Each conversation becomes a separate PromptLens project</span>
                  </div>
                </label>
                <label class="mode-option" class:selected={importMode === 'single'}>
                  <input type="radio" bind:group={importMode} value="single" />
                  <div class="mode-info">
                    <strong>Single project</strong>
                    <span>All prompts merged into one project</span>
                  </div>
                </label>
              </div>
            </div>

            <!-- Per-conversation: conversation picker -->
            {#if importMode === 'per-conversation' && importGroups}
              <div class="conv-section">
                <div class="conv-header">
                  <label class="label-text">Select conversations ({importSelectedGroups.size}/{importGroups.length})</label>
                  <button class="btn-tiny-text" on:click={toggleSelectAll}>
                    {importSelectAll ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div class="conv-list">
                  {#each importGroups as group}
                    <label class="conv-item" class:selected={importSelectedGroups.has(group.uuid)}>
                      <input
                        type="checkbox"
                        checked={importSelectedGroups.has(group.uuid)}
                        on:change={() => toggleGroupSelection(group.uuid)}
                      />
                      <div class="conv-info">
                        <span class="conv-name">{group.name}</span>
                        <span class="conv-meta">
                          {group.promptCount} prompts · {group.messageCount} msgs
                          {#if group.createdAt}
                            · {new Date(group.createdAt).toLocaleDateString()}
                          {/if}
                        </span>
                      </div>
                    </label>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Single mode: project target -->
            {#if importMode === 'single'}
              <div class="target-section">
                <label class="label-text">Import into project</label>
                <div class="target-options">
                  <label class="radio-option" class:selected={importTargetProject === 'new'}>
                    <input type="radio" bind:group={importTargetProject} value="new" />
                    <span>New project</span>
                  </label>
                  {#each projects as proj}
                    <label class="radio-option" class:selected={importTargetProject === proj.id}>
                      <input type="radio" bind:group={importTargetProject} value={proj.id} />
                      <span>{proj.name}</span>
                    </label>
                  {/each}
                </div>

                {#if importTargetProject === 'new'}
                  <input
                    type="text"
                    class="project-name-input"
                    bind:value={importProjectName}
                    placeholder="Project name..."
                  />
                {/if}
              </div>
            {/if}

            {#if importError}
              <div class="import-error">{importError}</div>
            {/if}

            <div class="modal-actions">
              <button class="btn-sm" on:click={() => { importStep = 'select'; importParsed = null; importGroups = null; }}>Back</button>
              <button class="btn-sm accent" on:click={executeImport} disabled={importing}>
                {#if importing}
                  Importing...
                {:else if importMode === 'per-conversation'}
                  Import {importSelectedGroups.size} conversations ({importSelectedCount} prompts)
                {:else}
                  Import {importStats?.total - importStats?.shortPrompts || 0} prompts
                {/if}
              </button>
            </div>
          </div>

        {:else if importStep === 'done'}
          <div class="modal-body done-body">
            <div class="done-icon">✓</div>
            <h4>Import Complete</h4>
            {#if importResult}
              <div class="done-stats">
                <span class="done-imported">{importResult.imported} imported</span>
                <span class="done-skipped">{importResult.skipped} skipped</span>
                {#if importResult.projectCount}
                  <span class="done-projects">{importResult.projectCount} projects created</span>
                {/if}
              </div>
            {/if}
            <button class="btn-sm accent" on:click={closeImport}>Done</button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .history-page {
    display: flex;
    gap: 0;
    height: 100%;
    min-height: 500px;
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    overflow: hidden;
  }

  /* Sidebar */
  .sidebar {
    width: 220px;
    background: #0b1120;
    border-right: 1px solid #1e293b;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }
  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid #1e293b;
  }
  .sidebar-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: #f1f5f9;
  }
  .btn-icon {
    width: 28px; height: 28px; border-radius: 6px;
    background: #1e293b; border: 1px solid #334155;
    color: #94a3b8; font-size: 16px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
  }
  .btn-icon:hover { background: #7c3aed; color: white; border-color: #7c3aed; }

  .new-project {
    padding: 8px 12px;
    display: flex; gap: 6px;
    border-bottom: 1px solid #1e293b;
  }
  .new-project input {
    flex: 1; padding: 6px 8px; background: #1e293b;
    border: 1px solid #334155; border-radius: 6px;
    color: #e2e8f0; font-size: 12px; outline: none;
  }
  .new-project input:focus { border-color: #7c3aed; }

  .project-list {
    list-style: none; margin: 0; padding: 8px;
    flex: 1; overflow-y: auto;
  }
  .project-item {
    border-radius: 8px;
    margin-bottom: 2px;
    display: flex; align-items: center;
    position: relative;
  }
  .project-item.active { background: rgba(124,58,237,0.15); }
  .project-item:hover { background: #1e293b; }
  .project-btn {
    flex: 1; display: flex; justify-content: space-between; align-items: center;
    padding: 8px 10px; background: none; border: none;
    color: #cbd5e1; font-size: 13px; cursor: pointer; text-align: left;
  }
  .project-item.active .project-btn { color: #e2e8f0; font-weight: 600; }
  .project-count {
    background: #334155; padding: 1px 7px; border-radius: 10px;
    font-size: 10px; color: #94a3b8;
  }
  .project-actions {
    display: none; gap: 2px; padding-right: 6px;
  }
  .project-item:hover .project-actions { display: flex; }
  .btn-tiny {
    width: 22px; height: 22px; border-radius: 4px;
    background: transparent; border: none;
    color: #64748b; font-size: 13px; cursor: pointer;
  }
  .btn-tiny:hover { background: #334155; color: #e2e8f0; }
  .btn-tiny.danger:hover { background: #7f1d1d; color: #fca5a5; }
  .rename-input {
    width: 100%; margin: 4px 8px; padding: 4px 8px;
    background: #1e293b; border: 1px solid #7c3aed; border-radius: 4px;
    color: #e2e8f0; font-size: 12px; outline: none;
  }

  .sidebar-stats {
    padding: 12px 16px;
    border-top: 1px solid #1e293b;
  }
  .stat-row {
    display: flex; justify-content: space-between;
    font-size: 12px; color: #94a3b8; margin-bottom: 4px;
  }
  .stat-val { font-weight: 700; }

  /* Main area */
  .main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .list-header {
    display: flex; gap: 8px; padding: 12px 16px;
    border-bottom: 1px solid #1e293b;
  }
  .search-input {
    flex: 1; padding: 8px 12px; background: #1e293b;
    border: 1px solid #334155; border-radius: 8px;
    color: #e2e8f0; font-size: 13px; outline: none;
  }
  .search-input:focus { border-color: #7c3aed; }
  .search-input::placeholder { color: #475569; }
  .sort-select {
    padding: 6px 10px; background: #1e293b;
    border: 1px solid #334155; border-radius: 8px;
    color: #94a3b8; font-size: 12px; outline: none; cursor: pointer;
  }

  /* Entry list */
  .entry-list {
    list-style: none; margin: 0; padding: 8px 12px;
    overflow-y: auto; flex: 1;
  }
  .entry-card {
    padding: 12px 14px; background: #1e293b;
    border: 1px solid #334155; border-radius: 10px;
    margin-bottom: 8px; cursor: pointer;
    transition: all 0.15s;
  }
  .entry-card:hover {
    border-color: #7c3aed;
    box-shadow: 0 0 0 1px rgba(124,58,237,0.2);
  }
  .entry-top {
    display: flex; align-items: center; gap: 8px;
  }
  .score-pill {
    padding: 2px 8px; border-radius: 10px;
    font-size: 11px; font-weight: 700; color: #0f172a;
    flex-shrink: 0;
  }
  .entry-platform { flex-shrink: 0; }
  .entry-prompt {
    flex: 1; font-size: 13px; color: #e2e8f0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .entry-time {
    font-size: 11px; color: #475569; flex-shrink: 0;
  }
  .entry-enhanced {
    font-size: 11px; color: #64748b; margin-top: 6px;
    line-height: 1.4;
  }
  .entry-bottom {
    display: flex; gap: 6px; margin-top: 8px; align-items: center;
  }
  .tag-sm {
    padding: 2px 8px; background: rgba(124,58,237,0.12);
    border: 1px solid rgba(124,58,237,0.25);
    border-radius: 10px; font-size: 10px; color: #a78bfa;
  }
  .note-indicator { font-size: 12px; }

  /* Empty state */
  .empty-state {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; flex: 1; color: #475569;
  }
  .empty-state p { margin: 4px; }
  .empty-hint { font-size: 13px; }

  /* Detail panel */
  .detail-panel {
    flex: 1; overflow-y: auto; padding: 16px;
  }
  .detail-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 16px;
  }
  .btn-back {
    background: none; border: none; color: #94a3b8;
    font-size: 13px; cursor: pointer; padding: 4px 0;
  }
  .btn-back:hover { color: #e2e8f0; }
  .detail-actions { display: flex; gap: 6px; }

  .btn-sm {
    padding: 6px 14px; border-radius: 6px; border: 1px solid #334155;
    background: #1e293b; color: #cbd5e1; font-size: 12px;
    font-weight: 600; cursor: pointer; transition: all 0.15s;
  }
  .btn-sm:hover { background: #334155; }
  .btn-sm.accent { background: #7c3aed; border-color: #7c3aed; color: white; }
  .btn-sm.accent:hover { background: #6d28d9; }
  .btn-sm.danger { color: #fca5a5; }
  .btn-sm.danger:hover { background: #7f1d1d; border-color: #7f1d1d; }

  .detail-meta {
    display: flex; gap: 10px; align-items: center; margin-bottom: 16px;
  }
  .score-badge {
    padding: 4px 12px; border-radius: 8px;
    font-size: 16px; font-weight: 800; color: #0f172a;
  }
  .time { color: #475569; font-size: 12px; }

  .prompt-section { margin-bottom: 16px; }
  .prompt-section h4 {
    color: #94a3b8; font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 6px 0;
  }
  .prompt-text {
    background: #1e293b; border: 1px solid #334155; border-radius: 8px;
    padding: 12px; font-size: 13px; color: #e2e8f0; line-height: 1.6;
  }
  .enhanced .prompt-text {
    border-color: rgba(124,58,237,0.3);
    background: rgba(124,58,237,0.05);
  }

  .axis-scores { margin-bottom: 16px; }
  .axis-scores h4 {
    color: #94a3b8; font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px 0;
  }
  .axis-bar-row {
    display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
  }
  .axis-label { width: 90px; font-size: 12px; color: #94a3b8; text-align: right; }
  .bar-track {
    flex: 1; height: 8px; background: #1e293b;
    border-radius: 4px; overflow: hidden;
  }
  .bar-fill {
    height: 100%; border-radius: 4px;
    transition: width 0.6s ease;
  }
  .axis-val { width: 30px; font-size: 12px; font-weight: 700; }

  .tags-row { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
  .tag {
    padding: 4px 12px; background: rgba(124,58,237,0.12);
    border: 1px solid rgba(124,58,237,0.25);
    border-radius: 14px; font-size: 12px; color: #a78bfa;
  }

  .note-section p {
    font-size: 13px; color: #94a3b8; line-height: 1.5;
    margin: 0; font-style: italic;
  }
  .note-section h4 {
    color: #94a3b8; font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 4px 0;
  }

  /* Edit form */
  .edit-form { display: flex; flex-direction: column; gap: 12px; }
  .edit-form label { display: flex; flex-direction: column; gap: 4px; }
  .label-text {
    font-size: 11px; font-weight: 600; color: #94a3b8;
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .edit-form textarea, .edit-form input, .edit-form select {
    padding: 8px 10px; background: #1e293b;
    border: 1px solid #334155; border-radius: 6px;
    color: #e2e8f0; font-size: 13px; outline: none;
    font-family: inherit;
  }
  .edit-form textarea { resize: vertical; }
  .edit-form textarea:focus, .edit-form input:focus, .edit-form select:focus {
    border-color: #7c3aed;
  }
  .form-row { display: flex; gap: 12px; }
  .flex-1 { flex: 1; }

  /* Import Modal */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
  }
  .import-modal {
    background: #0f172a; border: 1px solid #334155;
    border-radius: 16px; width: 480px; max-height: 80vh;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    overflow: hidden; display: flex; flex-direction: column;
  }
  .modal-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 16px 20px; border-bottom: 1px solid #1e293b;
  }
  .modal-header h3 { margin: 0; font-size: 16px; color: #f1f5f9; }
  .btn-close {
    width: 28px; height: 28px; border-radius: 6px;
    background: transparent; border: none; color: #64748b;
    font-size: 18px; cursor: pointer;
  }
  .btn-close:hover { background: #1e293b; color: #e2e8f0; }
  .modal-body { padding: 20px; overflow-y: auto; }

  .import-desc { color: #94a3b8; font-size: 13px; margin: 0 0 16px 0; line-height: 1.5; }

  .import-sources {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
    margin-bottom: 16px;
  }
  .source-card {
    display: flex; flex-direction: column; align-items: center;
    gap: 6px; padding: 14px; background: #1e293b;
    border: 1px solid #334155; border-radius: 10px; text-align: center;
  }
  .source-icon { font-size: 24px; }
  .source-card strong { color: #e2e8f0; font-size: 13px; }
  .source-hint { color: #64748b; font-size: 11px; line-height: 1.4; }

  .file-drop {
    display: block; cursor: pointer;
    border: 2px dashed #334155; border-radius: 10px;
    padding: 24px; text-align: center;
    transition: all 0.2s;
  }
  .file-drop:hover { border-color: #7c3aed; background: rgba(124,58,237,0.05); }
  .drop-content {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    color: #94a3b8; font-size: 13px;
  }
  .drop-icon { font-size: 28px; }
  .drop-hint { font-size: 11px; color: #64748b; }

  .import-error {
    margin-top: 12px; padding: 10px 14px;
    background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
    border-radius: 8px; color: #fca5a5; font-size: 12px;
  }

  /* Preview step */
  .preview-header {
    display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
  }
  .source-badge {
    padding: 4px 12px; background: rgba(124,58,237,0.15);
    border: 1px solid rgba(124,58,237,0.3); border-radius: 8px;
    font-size: 12px; color: #a78bfa; font-weight: 600;
  }
  .file-name { color: #64748b; font-size: 12px; }

  .stats-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
    margin-bottom: 12px;
  }
  .stat-card {
    display: flex; flex-direction: column; align-items: center;
    padding: 12px 8px; background: #1e293b;
    border: 1px solid #334155; border-radius: 8px;
  }
  .stat-number { font-size: 20px; font-weight: 800; color: #e2e8f0; }
  .stat-label { font-size: 10px; color: #64748b; text-align: center; margin-top: 4px; }

  .date-range {
    text-align: center; font-size: 11px; color: #64748b;
    margin-bottom: 16px;
  }

  .target-section { margin-bottom: 16px; }
  .target-section .label-text {
    display: block; margin-bottom: 8px;
    font-size: 11px; font-weight: 600; color: #94a3b8;
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .target-options {
    display: flex; flex-direction: column; gap: 4px;
    max-height: 120px; overflow-y: auto;
    margin-bottom: 8px;
  }
  .radio-option {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 10px; border-radius: 6px; cursor: pointer;
    font-size: 13px; color: #cbd5e1;
    transition: background 0.15s;
  }
  .radio-option:hover { background: #1e293b; }
  .radio-option.selected { background: rgba(124,58,237,0.12); color: #a78bfa; }
  .radio-option input { accent-color: #7c3aed; }
  .project-name-input {
    width: 100%; padding: 8px 10px; background: #1e293b;
    border: 1px solid #334155; border-radius: 6px;
    color: #e2e8f0; font-size: 13px; outline: none;
    box-sizing: border-box;
  }
  .project-name-input:focus { border-color: #7c3aed; }

  .modal-actions {
    display: flex; justify-content: flex-end; gap: 8px;
    padding-top: 12px; border-top: 1px solid #1e293b;
  }
  .modal-actions button:disabled {
    opacity: 0.5; cursor: not-allowed;
  }

  /* Done step */
  .done-body {
    display: flex; flex-direction: column; align-items: center;
    gap: 12px; padding: 32px 20px;
  }
  .done-icon {
    width: 56px; height: 56px; border-radius: 50%;
    background: rgba(34,197,94,0.15); border: 2px solid #22c55e;
    display: flex; align-items: center; justify-content: center;
    font-size: 28px; color: #22c55e; font-weight: 800;
  }
  .done-body h4 { margin: 0; color: #e2e8f0; font-size: 18px; }
  .done-stats { display: flex; gap: 16px; }
  .done-imported { color: #22c55e; font-weight: 700; font-size: 14px; }
  .done-skipped { color: #64748b; font-size: 14px; }
  .done-projects { color: #a78bfa; font-weight: 600; font-size: 14px; }

  /* Import mode selector */
  .mode-section { margin-bottom: 16px; }
  .mode-section .label-text {
    display: block; margin-bottom: 8px;
    font-size: 11px; font-weight: 600; color: #94a3b8;
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .mode-options { display: flex; gap: 8px; }
  .mode-option {
    flex: 1; display: flex; align-items: flex-start; gap: 8px;
    padding: 10px 12px; border-radius: 8px; cursor: pointer;
    background: #1e293b; border: 1px solid #334155;
    transition: all 0.15s;
  }
  .mode-option:hover { border-color: #475569; }
  .mode-option.selected { border-color: #7c3aed; background: rgba(124,58,237,0.08); }
  .mode-option input { accent-color: #7c3aed; margin-top: 3px; }
  .mode-info { display: flex; flex-direction: column; gap: 2px; }
  .mode-info strong { font-size: 12px; color: #e2e8f0; }
  .mode-info span { font-size: 11px; color: #64748b; line-height: 1.4; }

  /* Conversation picker */
  .conv-section { margin-bottom: 16px; }
  .conv-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 8px;
  }
  .conv-header .label-text { margin-bottom: 0; }
  .btn-tiny-text {
    background: none; border: none; color: #7c3aed;
    font-size: 11px; cursor: pointer; padding: 2px 4px;
  }
  .btn-tiny-text:hover { color: #a78bfa; text-decoration: underline; }
  .conv-list {
    max-height: 200px; overflow-y: auto;
    border: 1px solid #1e293b; border-radius: 8px;
    background: #0b1120;
  }
  .conv-item {
    display: flex; align-items: flex-start; gap: 8px;
    padding: 8px 12px; cursor: pointer;
    border-bottom: 1px solid #1e293b;
    transition: background 0.12s;
  }
  .conv-item:last-child { border-bottom: none; }
  .conv-item:hover { background: rgba(124,58,237,0.05); }
  .conv-item.selected { background: rgba(124,58,237,0.08); }
  .conv-item input { accent-color: #7c3aed; margin-top: 2px; flex-shrink: 0; }
  .conv-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .conv-name {
    font-size: 12px; color: #e2e8f0; font-weight: 500;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .conv-meta { font-size: 10px; color: #64748b; }
</style>
