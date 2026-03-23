import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePrompt } from '../lib/analyzer.js';

// ── Score & Grade ──

describe('Analyzer — Score & Grade', () => {
  it('returns score between 0 and 100', () => {
    const r = analyzePrompt('hello');
    assert.ok(r.score >= 0 && r.score <= 100);
  });

  it('returns mode: local', () => {
    const r = analyzePrompt('test prompt');
    assert.equal(r.mode, 'local');
  });

  it('assigns grade based on score', () => {
    const r = analyzePrompt('test');
    assert.ok(['A', 'B+', 'B', 'C+', 'C', 'D'].includes(r.grade));
  });

  it('gives low score to minimal prompt', () => {
    const r = analyzePrompt('React로 로그인 폼 만들어줘');
    assert.ok(r.score < 60, `Expected < 60, got ${r.score}`);
  });

  it('gives higher score to well-structured prompt', () => {
    const prompt = `You are a senior React developer and security expert.

I'm working on an e-commerce project using React 18, TypeScript, and Tailwind CSS.
The project currently uses JWT for authentication.

Create a login form component with the following requirements:
- Email and password fields with validation
- Remember me checkbox
- Error handling for failed logins
- Loading state during API calls

Format the output as a single TypeScript file with inline comments.

Example: Similar to the login form in the Next.js commerce template,
but using our existing useAuth hook.

Constraints: Must not use any class components. Must be accessible (WCAG 2.1 AA).`;

    const r = analyzePrompt(prompt);
    assert.ok(r.score >= 70, `Expected >= 70, got ${r.score}`);
  });
});

// ── 5-Axis Scores ──

describe('Analyzer — 5-Axis Scores', () => {
  it('returns exactly 5 axis scores', () => {
    const r = analyzePrompt('test');
    assert.equal(r.axisScores.length, 5);
    assert.deepEqual(r.axisLabels, ['Clarity', 'Specificity', 'Context', 'Structure', 'Actionability']);
  });

  it('each axis is 0-100', () => {
    const r = analyzePrompt('You are an expert. Background: we have a monolith. List steps.');
    for (const s of r.axisScores) {
      assert.ok(s >= 0 && s <= 100, `Axis score out of range: ${s}`);
    }
  });

  it('detects role → boosts context and actionability', () => {
    const without = analyzePrompt('Write a function');
    const withRole = analyzePrompt('You are a senior Python developer. Write a function');
    // Context axis is index 2, Actionability is index 4
    assert.ok(withRole.axisScores[2] > without.axisScores[2]);
    assert.ok(withRole.axisScores[4] > without.axisScores[4]);
  });

  it('detects format → boosts structure', () => {
    const without = analyzePrompt('Explain microservices');
    const withFormat = analyzePrompt('Explain microservices. Format as a table with columns.');
    // Structure is index 3
    assert.ok(withFormat.axisScores[3] > without.axisScores[3]);
  });
});

// ── Missing Elements Detection ──

describe('Analyzer — Missing Elements', () => {
  it('detects all 5 missing elements for bare prompt', () => {
    const r = analyzePrompt('hello');
    const elements = r.missing.map(m => m.element);
    assert.ok(elements.includes('Role'));
    assert.ok(elements.includes('Context'));
    assert.ok(elements.includes('Output Format'));
    assert.ok(elements.includes('Example'));
    assert.ok(elements.includes('Constraints'));
  });

  it('does not report Role as missing when role pattern exists', () => {
    const r = analyzePrompt('You are a database expert. Optimize this query.');
    const elements = r.missing.map(m => m.element);
    assert.ok(!elements.includes('Role'));
  });

  it('does not report Context as missing when context pattern exists', () => {
    const r = analyzePrompt('Currently we have a legacy monolith. Suggest migration.');
    const elements = r.missing.map(m => m.element);
    assert.ok(!elements.includes('Context'));
  });

  it('does not report Output Format when format pattern exists', () => {
    const r = analyzePrompt('List the steps in markdown format.');
    const elements = r.missing.map(m => m.element);
    assert.ok(!elements.includes('Output Format'));
  });

  it('does not report Example when example pattern exists', () => {
    const r = analyzePrompt('For example, a login page with OAuth.');
    const elements = r.missing.map(m => m.element);
    assert.ok(!elements.includes('Example'));
  });

  it('does not report Constraints when constraint pattern exists', () => {
    const r = analyzePrompt('Must not use jQuery. Limit to 100 lines.');
    const elements = r.missing.map(m => m.element);
    assert.ok(!elements.includes('Constraints'));
  });

  it('each missing element has a suggestion string', () => {
    const r = analyzePrompt('hi');
    for (const m of r.missing) {
      assert.ok(typeof m.suggestion === 'string');
      assert.ok(m.suggestion.length > 0);
    }
  });
});

// ── Korean Pattern Detection ──

describe('Analyzer — Korean patterns', () => {
  it('detects Korean role pattern (전문가)', () => {
    const r = analyzePrompt('데이터베이스 전문가로서 이 쿼리를 최적화해줘');
    const elements = r.missing.map(m => m.element);
    assert.ok(!elements.includes('Role'));
  });

  it('detects Korean context pattern (현재, 배경)', () => {
    const r = analyzePrompt('현재 모놀리스 아키텍처를 사용 중이고 마이그레이션을 계획하고 있어');
    const elements = r.missing.map(m => m.element);
    assert.ok(!elements.includes('Context'));
  });

  it('detects Korean format pattern (표, 단계)', () => {
    const r = analyzePrompt('단계별로 설명해줘');
    const elements = r.missing.map(m => m.element);
    assert.ok(!elements.includes('Output Format'));
  });

  it('detects Korean example pattern (예시, 예를 들)', () => {
    const r = analyzePrompt('예를 들어 로그인 페이지처럼 만들어줘');
    const elements = r.missing.map(m => m.element);
    assert.ok(!elements.includes('Example'));
  });

  it('detects Korean constraint pattern (제한, 하지 마)', () => {
    const r = analyzePrompt('jQuery는 사용하지 마. 100줄 이내로 제한해줘');
    const elements = r.missing.map(m => m.element);
    assert.ok(!elements.includes('Constraints'));
  });
});

// ── Suggestions & Enhanced ──

describe('Analyzer — Suggestions & Enhanced', () => {
  it('provides suggestions array', () => {
    const r = analyzePrompt('hello');
    assert.ok(Array.isArray(r.suggestions));
    assert.ok(r.suggestions.length > 0);
  });

  it('provides enhanced prompt', () => {
    const r = analyzePrompt('hello');
    assert.ok(typeof r.enhanced === 'string');
    assert.ok(r.enhanced.includes('hello'));
  });

  it('provides summary string', () => {
    const r = analyzePrompt('hello');
    assert.ok(r.summary.includes('Score:'));
    assert.ok(r.summary.includes('/100'));
  });
});

// ── Stats ──

describe('Analyzer — Stats', () => {
  it('counts characters, words, sentences', () => {
    const r = analyzePrompt('Hello world. This is a test.');
    assert.equal(r.stats.characters, 28);
    assert.equal(r.stats.words, 6);
    assert.ok(r.stats.sentences >= 2);
  });
});
