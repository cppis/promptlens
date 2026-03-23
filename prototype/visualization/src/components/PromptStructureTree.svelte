<script>
  import { onMount } from 'svelte';
  import { hierarchy, tree } from 'd3-hierarchy';
  import { select } from 'd3-selection';
  import { linkHorizontal } from 'd3-shape';
  import { scaleLinear } from 'd3-scale';
  import 'd3-transition';
  import { interpolateHcl } from 'd3-interpolate';

  export let data;

  let svgEl;
  const margin = { top: 30, right: 180, bottom: 30, left: 60 };
  const width = 900;
  const height = 480;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const typeColors = {
    root: '#e2e8f0',
    role: '#7c3aed',
    context: '#2563eb',
    instruction: '#059669',
    format: '#d97706',
    example: '#f59e0b',
    detail: '#94a3b8',
    warning: '#ef4444'
  };

  const scoreColor = scaleLinear()
    .domain([0, 50, 80, 100])
    .range(['#ef4444', '#f59e0b', '#22c55e', '#10b981'])
    .interpolate(interpolateHcl);

  onMount(() => {
    const root = hierarchy(data);
    const treeLayout = tree().size([innerH, innerW]);
    treeLayout(root);

    const svg = select(svgEl)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // ---------- Links ----------
    svg.selectAll('.link')
      .data(root.links())
      .join('path')
      .attr('class', 'link')
      .attr('d', linkHorizontal().x(d => d.y).y(d => d.x))
      .attr('fill', 'none')
      .attr('stroke', '#334155')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0)
      .transition()
      .duration(800)
      .delay((_, i) => i * 60)
      .attr('opacity', 0.6);

    // ---------- Nodes ----------
    const nodes = svg.selectAll('.node')
      .data(root.descendants())
      .join('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .attr('opacity', 0);

    nodes.transition()
      .duration(600)
      .delay((_, i) => i * 80)
      .attr('opacity', 1);

    // Node circles
    nodes.append('circle')
      .attr('r', d => d.depth === 0 ? 14 : d.data.type === 'warning' ? 10 : 8)
      .attr('fill', d => typeColors[d.data.type] || '#64748b')
      .attr('stroke', d => d.data.score != null ? scoreColor(d.data.score) : '#475569')
      .attr('stroke-width', d => d.data.score != null ? 3 : 1.5);

    // Score badges
    nodes.filter(d => d.data.score != null && d.depth > 0)
      .append('text')
      .attr('dy', -16)
      .attr('text-anchor', 'middle')
      .attr('fill', d => scoreColor(d.data.score))
      .attr('font-size', '11px')
      .attr('font-weight', 700)
      .text(d => d.data.score);

    // Labels
    nodes.append('text')
      .attr('dy', 4)
      .attr('x', d => d.children ? -18 : 16)
      .attr('text-anchor', d => d.children ? 'end' : 'start')
      .attr('fill', d => d.data.type === 'warning' ? '#fbbf24' : '#e2e8f0')
      .attr('font-size', d => d.depth === 0 ? '14px' : '12px')
      .attr('font-weight', d => d.depth <= 1 ? 700 : 400)
      .text(d => d.data.name);

    // Warning icons
    nodes.filter(d => d.data.type === 'warning')
      .append('text')
      .attr('dy', 5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fbbf24')
      .attr('font-size', '13px')
      .text('⚠');

    // Tooltip rects + text for values
    const leafNodes = nodes.filter(d => !d.children && d.data.value);
    leafNodes.append('text')
      .attr('dy', 18)
      .attr('x', 16)
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-style', 'italic')
      .text(d => d.data.value.length > 45 ? d.data.value.slice(0, 45) + '…' : d.data.value);
  });
</script>

<div class="tree-container">
  <h3 class="section-title">Prompt Structure</h3>
  <p class="section-desc">Hierarchical decomposition of prompt elements</p>
  <svg bind:this={svgEl}></svg>
  <div class="legend">
    {#each Object.entries(typeColors).filter(([k]) => !['root','detail'].includes(k)) as [type, color]}
      <span class="legend-item">
        <span class="dot" style="background:{color}"></span>
        {type}
      </span>
    {/each}
  </div>
</div>

<style>
  .tree-container {
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
    margin: 0 0 16px 0;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .legend {
    display: flex;
    gap: 16px;
    margin-top: 12px;
    flex-wrap: wrap;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #94a3b8;
    text-transform: capitalize;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
  }
</style>
