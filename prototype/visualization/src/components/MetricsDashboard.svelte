<script>
  import { onMount } from 'svelte';
  import * as echarts from 'echarts';

  export let radarScores;
  export let tokenDistribution;
  export let historyTrend;
  export let overallScore;

  let radarEl, gaugeEl, tokenEl, trendEl;

  const theme = {
    bg: '#0f172a',
    cardBg: '#1e293b',
    text: '#e2e8f0',
    subtext: '#94a3b8',
    border: '#334155',
    accent: '#7c3aed',
    good: '#22c55e',
    warn: '#f59e0b',
    bad: '#ef4444'
  };

  function gradeColor(score) {
    if (score >= 80) return theme.good;
    if (score >= 60) return theme.warn;
    return theme.bad;
  }

  onMount(() => {
    // ---------- 1. Radar Chart ----------
    const radar = echarts.init(radarEl, null, { renderer: 'canvas' });
    radar.setOption({
      animation: true,
      animationDuration: 1200,
      radar: {
        indicator: radarScores.axes.map(a => ({ name: a, max: 100 })),
        shape: 'polygon',
        splitNumber: 4,
        axisName: { color: theme.subtext, fontSize: 12 },
        splitLine: { lineStyle: { color: theme.border } },
        splitArea: { areaStyle: { color: ['transparent', 'rgba(124,58,237,0.04)'] } },
        axisLine: { lineStyle: { color: theme.border } }
      },
      series: [{
        type: 'radar',
        data: [
          {
            value: radarScores.current,
            name: 'Current',
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { color: theme.warn, width: 2 },
            areaStyle: { color: 'rgba(245,158,11,0.15)' },
            itemStyle: { color: theme.warn }
          },
          {
            value: radarScores.improved,
            name: 'After Improvement',
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { color: theme.accent, width: 2, type: 'dashed' },
            areaStyle: { color: 'rgba(124,58,237,0.10)' },
            itemStyle: { color: theme.accent }
          }
        ]
      }],
      legend: {
        bottom: 0,
        textStyle: { color: theme.subtext, fontSize: 11 },
        data: ['Current', 'After Improvement']
      }
    });

    // ---------- 2. Gauge Chart ----------
    const gauge = echarts.init(gaugeEl, null, { renderer: 'canvas' });
    gauge.setOption({
      animation: true,
      animationDuration: 1500,
      series: [{
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        radius: '90%',
        progress: { show: true, width: 14, roundCap: true,
          itemStyle: { color: gradeColor(overallScore.value) }
        },
        pointer: { show: false },
        axisLine: { lineStyle: { width: 14, color: [[1, theme.border]] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        title: { show: false },
        detail: {
          offsetCenter: [0, 0],
          fontSize: 32,
          fontWeight: 700,
          color: gradeColor(overallScore.value),
          formatter: () => `${overallScore.value}`
        },
        data: [{ value: overallScore.value }]
      }]
    });

    // ---------- 3. Token Distribution ----------
    const tokenChart = echarts.init(tokenEl, null, { renderer: 'canvas' });
    tokenChart.setOption({
      animation: true,
      animationDuration: 1000,
      tooltip: {
        trigger: 'item',
        backgroundColor: theme.cardBg,
        borderColor: theme.border,
        textStyle: { color: theme.text, fontSize: 12 },
        formatter: (p) => `${p.name}: ${p.data.tokens} tokens (${p.data.pct}%)`
      },
      series: [{
        type: 'pie',
        radius: ['45%', '72%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        padAngle: 2,
        itemStyle: { borderRadius: 6, borderColor: theme.bg, borderWidth: 2 },
        label: {
          color: theme.subtext,
          fontSize: 11,
          formatter: '{b}\n{d}%'
        },
        labelLine: { lineStyle: { color: theme.border } },
        emphasis: {
          label: { fontSize: 13, fontWeight: 700, color: theme.text },
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' }
        },
        data: tokenDistribution.map(d => ({
          name: d.name, value: d.tokens, tokens: d.tokens, pct: d.pct,
          itemStyle: { color: d.color }
        }))
      }]
    });

    // ---------- 4. History Trend ----------
    const trend = echarts.init(trendEl, null, { renderer: 'canvas' });
    trend.setOption({
      animation: true,
      animationDuration: 1000,
      tooltip: {
        trigger: 'axis',
        backgroundColor: theme.cardBg,
        borderColor: theme.border,
        textStyle: { color: theme.text, fontSize: 12 }
      },
      grid: { top: 30, right: 40, bottom: 30, left: 45 },
      xAxis: {
        type: 'category',
        data: historyTrend.map(d => d.date),
        axisLine: { lineStyle: { color: theme.border } },
        axisLabel: { color: theme.subtext, fontSize: 11 },
        axisTick: { show: false }
      },
      yAxis: [
        {
          type: 'value', name: 'Score', min: 40, max: 100, position: 'left',
          nameTextStyle: { color: theme.subtext, fontSize: 11 },
          axisLine: { show: false },
          axisLabel: { color: theme.subtext, fontSize: 11 },
          splitLine: { lineStyle: { color: theme.border, type: 'dashed' } }
        },
        {
          type: 'value', name: 'Prompts', min: 0, max: 12, position: 'right',
          nameTextStyle: { color: theme.subtext, fontSize: 11 },
          axisLine: { show: false },
          axisLabel: { color: theme.subtext, fontSize: 11 },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: 'Prompt Score',
          type: 'line',
          yAxisIndex: 0,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { color: theme.accent, width: 3 },
          itemStyle: { color: theme.accent },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(124,58,237,0.25)' },
              { offset: 1, color: 'rgba(124,58,237,0.02)' }
            ])
          },
          data: historyTrend.map(d => d.score)
        },
        {
          name: 'Prompts Written',
          type: 'bar',
          yAxisIndex: 1,
          barWidth: 20,
          itemStyle: {
            color: 'rgba(37,99,235,0.35)',
            borderRadius: [4, 4, 0, 0]
          },
          data: historyTrend.map(d => d.prompts)
        }
      ],
      legend: {
        bottom: 0,
        textStyle: { color: theme.subtext, fontSize: 11 },
        data: ['Prompt Score', 'Prompts Written']
      }
    });

    // Responsive
    const observer = new ResizeObserver(() => {
      radar.resize();
      gauge.resize();
      tokenChart.resize();
      trend.resize();
    });
    observer.observe(radarEl.parentElement);

    return () => {
      observer.disconnect();
      radar.dispose();
      gauge.dispose();
      tokenChart.dispose();
      trend.dispose();
    };
  });
</script>

<div class="dashboard">
  <h3 class="section-title">Analysis Metrics</h3>
  <p class="section-desc">Multi-dimensional prompt quality assessment</p>

  <div class="grid">
    <!-- Top row: Gauge + Radar -->
    <div class="card gauge-card">
      <div class="card-header">Overall Score</div>
      <div bind:this={gaugeEl} class="chart gauge-chart"></div>
      <div class="grade" style="color:{gradeColor(overallScore.value)}">
        {overallScore.grade}
      </div>
      <div class="grade-label">{overallScore.label}</div>
    </div>

    <div class="card">
      <div class="card-header">5-Axis Quality Radar</div>
      <div bind:this={radarEl} class="chart"></div>
    </div>

    <!-- Bottom row: Token Distribution + Trend -->
    <div class="card">
      <div class="card-header">Token Distribution</div>
      <div bind:this={tokenEl} class="chart"></div>
    </div>

    <div class="card">
      <div class="card-header">7-Day Trend</div>
      <div bind:this={trendEl} class="chart"></div>
    </div>
  </div>
</div>

<style>
  .dashboard {
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
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 10px;
    padding: 16px;
    min-height: 280px;
    display: flex;
    flex-direction: column;
  }
  .card-header {
    color: #cbd5e1;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .chart {
    flex: 1;
    min-height: 240px;
  }
  .gauge-card {
    text-align: center;
    position: relative;
  }
  .gauge-chart {
    min-height: 180px;
  }
  .grade {
    font-size: 24px;
    font-weight: 800;
    margin-top: -8px;
  }
  .grade-label {
    color: #94a3b8;
    font-size: 12px;
    margin-top: 4px;
  }

  @media (max-width: 700px) {
    .grid { grid-template-columns: 1fr; }
  }
</style>
