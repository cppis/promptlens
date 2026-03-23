<script>
  export let annotatedPrompt;

  let hoveredSegment = null;
  let hoveredMissing = null;

  const typeStyles = {
    role: { bg: 'rgba(124,58,237,0.18)', border: '#7c3aed', label: '#c4b5fd' },
    context: { bg: 'rgba(37,99,235,0.18)', border: '#2563eb', label: '#93c5fd' },
    instruction: { bg: 'rgba(5,150,105,0.18)', border: '#059669', label: '#6ee7b7' },
    format: { bg: 'rgba(217,119,6,0.18)', border: '#d97706', label: '#fcd34d' },
    example: { bg: 'rgba(245,158,11,0.18)', border: '#f59e0b', label: '#fde68a' },
    constraint: { bg: 'rgba(239,68,68,0.18)', border: '#ef4444', label: '#fca5a5' }
  };

  const qualityIcons = {
    good: { icon: '✓', color: '#22c55e' },
    warning: { icon: '!', color: '#f59e0b' },
    bad: { icon: '✗', color: '#ef4444' }
  };
</script>

<div class="annotation-container">
  <h3 class="section-title">Inline Prompt Analysis</h3>
  <p class="section-desc">Hover over highlighted segments for coaching tips</p>

  <div class="prompt-display">
    {#each annotatedPrompt.segments as seg, i}
      {@const style = typeStyles[seg.type]}
      {@const qi = qualityIcons[seg.quality]}
      <span
        class="segment"
        class:hovered={hoveredSegment === i}
        style="
          background: {style.bg};
          border-bottom: 2px solid {style.border};
        "
        on:mouseenter={() => hoveredSegment = i}
        on:mouseleave={() => hoveredSegment = null}
        role="button"
        tabindex="0"
      >
        <span class="segment-label" style="color:{style.label}">
          <span class="quality-dot" style="background:{qi.color}">{qi.icon}</span>
          {seg.label}
        </span>
        {seg.text}

        {#if hoveredSegment === i && seg.tip}
          <span class="tooltip" style="border-color:{style.border}">
            <span class="tooltip-icon">💡</span>
            {seg.tip}
          </span>
        {/if}
      </span>
      {#if i < annotatedPrompt.segments.length - 1}
        <span class="space"> </span>
      {/if}
    {/each}
  </div>

  <!-- Missing elements -->
  <div class="missing-section">
    <div class="missing-header">
      <span class="missing-icon">⚠</span>
      Missing Elements — Add these to improve your prompt
    </div>
    <div class="missing-list">
      {#each annotatedPrompt.missingElements as item, i}
        {@const style = typeStyles[item.type]}
        <div
          class="missing-card"
          class:expanded={hoveredMissing === i}
          on:mouseenter={() => hoveredMissing = i}
          on:mouseleave={() => hoveredMissing = null}
          role="button"
          tabindex="0"
        >
          <div class="missing-tag" style="background:{style.bg}; color:{style.label}; border:1px solid {style.border}">
            {item.label}
          </div>
          {#if hoveredMissing === i}
            <div class="suggestion" style="border-left:3px solid {style.border}">
              {item.suggestion}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .annotation-container {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    padding: 24px;
  }
  .section-title {
    color: #f1f5f9;
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 4px 0;
  }
  .section-desc {
    color: #64748b;
    font-size: 13px;
    margin: 0 0 20px 0;
  }

  /* Prompt display */
  .prompt-display {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 10px;
    padding: 24px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 14px;
    line-height: 2.4;
    color: #e2e8f0;
    position: relative;
  }

  .segment {
    position: relative;
    padding: 4px 6px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline;
  }
  .segment.hovered {
    filter: brightness(1.3);
    box-shadow: 0 0 12px rgba(124,58,237,0.2);
  }

  .segment-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    vertical-align: super;
    margin-right: 4px;
  }

  .quality-dot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    font-size: 9px;
    font-weight: 800;
    color: #0f172a;
  }

  .space {
    display: inline;
  }

  /* Tooltip */
  .tooltip {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background: #1e293b;
    border: 1px solid;
    border-radius: 8px;
    padding: 10px 14px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 12px;
    color: #cbd5e1;
    white-space: nowrap;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: fadeIn 0.2s ease;
  }
  .tooltip-icon {
    margin-right: 6px;
  }

  /* Missing section */
  .missing-section {
    margin-top: 20px;
  }
  .missing-header {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #fbbf24;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 12px;
  }
  .missing-icon {
    font-size: 16px;
  }
  .missing-list {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .missing-card {
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .missing-tag {
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    transition: all 0.2s ease;
  }
  .missing-card.expanded .missing-tag {
    border-radius: 8px 8px 0 0;
  }
  .suggestion {
    background: #1e293b;
    padding: 10px 14px;
    font-size: 12px;
    color: #94a3b8;
    border-radius: 0 0 8px 8px;
    line-height: 1.5;
    max-width: 360px;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
