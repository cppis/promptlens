import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { importClaudeDesktop, importClaudeCode } from '../lib/importer.js';

// ── Test Storage (in-memory) ──

class MockStorage {
  constructor() {
    this.projects = [];
    this.history = {};
  }
  async getProjects() { return this.projects; }
  async createProject(name) {
    const p = { id: `proj_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, name, promptCount: 0, createdAt: new Date().toISOString() };
    this.projects.push(p);
    this.history[p.id] = [];
    return p;
  }
  async getHistory(pid) { return this.history[pid] || []; }
  async addHistoryEntry(pid, entry) {
    if (!this.history[pid]) this.history[pid] = [];
    const full = {
      id: `h_${Date.now()}`,
      projectId: pid,
      prompt: entry.prompt || '',
      enhanced: entry.enhanced || '',
      score: entry.score || 0,
      axisScores: entry.axisScores || [0,0,0,0,0],
      tags: entry.tags || [],
      note: entry.note || '',
      platform: entry.platform || 'claude',
      createdAt: entry.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.history[pid].push(full);
    const proj = this.projects.find(p => p.id === pid);
    if (proj) proj.promptCount = this.history[pid].length;
    return full;
  }
}

// ── Sample data ──

const SAMPLE_DESKTOP_JSON = JSON.stringify([
  {
    uuid: 'conv-1',
    name: 'React Login Discussion',
    summary: 'Building a login form',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T01:00:00Z',
    chat_messages: [
      { uuid: 'm1', sender: 'human', text: 'React로 로그인 폼을 만들어줘. TypeScript와 Tailwind를 사용해.', created_at: '2025-01-01T00:01:00Z' },
      { uuid: 'm2', sender: 'assistant', text: '네, React로 로그인 폼을 만들어 드리겠습니다...', created_at: '2025-01-01T00:02:00Z' },
      { uuid: 'm3', sender: 'human', text: '비밀번호 찾기 기능도 추가해줘. 이메일로 재설정 링크를 보내는 방식으로.', created_at: '2025-01-01T00:03:00Z' },
      { uuid: 'm4', sender: 'assistant', text: '비밀번호 재설정 기능을 추가하겠습니다...', created_at: '2025-01-01T00:04:00Z' }
    ]
  },
  {
    uuid: 'conv-2',
    name: 'Database Optimization',
    created_at: '2025-01-02T00:00:00Z',
    chat_messages: [
      { uuid: 'm5', sender: 'human', text: 'PostgreSQL 쿼리 최적화를 도와줘. 현재 이 쿼리가 3초 넘게 걸려.', created_at: '2025-01-02T00:01:00Z' },
      { uuid: 'm6', sender: 'assistant', text: '쿼리를 분석해보겠습니다. 먼저 EXPLAIN ANALYZE를 실행해주세요...', created_at: '2025-01-02T00:02:00Z' }
    ]
  },
  {
    uuid: 'conv-3',
    name: 'Quick Chat',
    created_at: '2025-01-03T00:00:00Z',
    chat_messages: [
      { uuid: 'm7', sender: 'human', text: '안녕', created_at: '2025-01-03T00:01:00Z' },
      { uuid: 'm8', sender: 'assistant', text: '안녕하세요!', created_at: '2025-01-03T00:02:00Z' }
    ]
  }
]);

const SAMPLE_JSONL = [
  '{"type":"user","message":{"content":"Express.js에서 미들웨어를 사용해 인증을 구현해줘. JWT 기반으로."},"timestamp":"2025-02-01T00:01:00Z","sessionId":"s1"}',
  '{"type":"assistant","message":{"content":"JWT 기반 인증 미들웨어를 구현하겠습니다..."},"timestamp":"2025-02-01T00:02:00Z","sessionId":"s1"}',
  '{"type":"user","message":{"content":"에러 핸들링도 추가해줘. 만료된 토큰과 잘못된 토큰을 구분해서."},"timestamp":"2025-02-01T00:03:00Z","sessionId":"s1"}',
  '{"type":"assistant","message":{"content":"에러 핸들링을 추가하겠습니다..."},"timestamp":"2025-02-01T00:04:00Z","sessionId":"s1"}',
  '{"type":"user","message":{"content":"Docker로 Node.js 앱 배포하는 방법을 알려줘. multi-stage build로."},"timestamp":"2025-02-02T00:01:00Z","sessionId":"s2"}',
  '{"type":"assistant","message":{"content":"Multi-stage Docker build를 설정하겠습니다..."},"timestamp":"2025-02-02T00:02:00Z","sessionId":"s2"}'
].join('\n');

// ── Claude Desktop Import ──

describe('Importer — Claude Desktop (per-conversation)', () => {
  it('creates one project per conversation', async () => {
    const storage = new MockStorage();
    const result = await importClaudeDesktop(storage, SAMPLE_DESKTOP_JSON, 'per-conversation');
    // conv-3 has only "안녕" (< 10 chars), so its prompts are skipped → but it may still create a project
    // conv-1 has 2 prompts, conv-2 has 1 prompt
    assert.ok(result.projectCount >= 2);
    assert.ok(result.imported >= 3);
  });

  it('skips prompts shorter than 10 characters', async () => {
    const storage = new MockStorage();
    const result = await importClaudeDesktop(storage, SAMPLE_DESKTOP_JSON, 'per-conversation');
    // "안녕" (2 chars) should be skipped
    const allEntries = Object.values(storage.history).flat();
    const hasShort = allEntries.some(e => e.prompt === '안녕');
    assert.ok(!hasShort, 'Short prompt should be skipped');
  });

  it('preserves conversation name as project name', async () => {
    const storage = new MockStorage();
    await importClaudeDesktop(storage, SAMPLE_DESKTOP_JSON, 'per-conversation');
    const names = storage.projects.map(p => p.name);
    assert.ok(names.includes('React Login Discussion'));
    assert.ok(names.includes('Database Optimization'));
  });

  it('tags entries with claude-desktop', async () => {
    const storage = new MockStorage();
    await importClaudeDesktop(storage, SAMPLE_DESKTOP_JSON, 'per-conversation');
    const allEntries = Object.values(storage.history).flat();
    for (const e of allEntries) {
      assert.ok(e.tags.includes('claude-desktop'));
    }
  });

  it('stores response in note', async () => {
    const storage = new MockStorage();
    await importClaudeDesktop(storage, SAMPLE_DESKTOP_JSON, 'per-conversation');
    const allEntries = Object.values(storage.history).flat();
    const first = allEntries.find(e => e.prompt.includes('React로 로그인'));
    assert.ok(first);
    assert.ok(first.note.includes('로그인 폼을 만들어'));
  });
});

describe('Importer — Claude Desktop (single)', () => {
  it('creates exactly one project', async () => {
    const storage = new MockStorage();
    const result = await importClaudeDesktop(storage, SAMPLE_DESKTOP_JSON, 'single', 'All Imports');
    assert.equal(result.projectCount, 1);
    assert.equal(storage.projects[0].name, 'All Imports');
  });

  it('merges all prompts into one project', async () => {
    const storage = new MockStorage();
    const result = await importClaudeDesktop(storage, SAMPLE_DESKTOP_JSON, 'single', 'Merged');
    assert.ok(result.imported >= 3);
    const entries = await storage.getHistory(storage.projects[0].id);
    assert.ok(entries.length >= 3);
  });
});

describe('Importer — Claude Desktop (dedup)', () => {
  it('deduplicates identical prompts', async () => {
    const duped = JSON.stringify([
      {
        uuid: 'c1', name: 'Conv 1', created_at: '2025-01-01T00:00:00Z',
        chat_messages: [
          { uuid: 'm1', sender: 'human', text: 'This is a duplicate prompt for testing dedup logic.', created_at: '2025-01-01T00:01:00Z' }
        ]
      },
      {
        uuid: 'c2', name: 'Conv 2', created_at: '2025-01-02T00:00:00Z',
        chat_messages: [
          { uuid: 'm2', sender: 'human', text: 'This is a duplicate prompt for testing dedup logic.', created_at: '2025-01-02T00:01:00Z' }
        ]
      }
    ]);
    const storage = new MockStorage();
    const result = await importClaudeDesktop(storage, duped, 'single', 'Dedup Test');
    assert.equal(result.imported, 1);
    assert.equal(result.skipped, 1);
  });
});

// ── Claude Code Import ──

describe('Importer — Claude Code (.jsonl)', () => {
  it('imports JSONL format', async () => {
    const storage = new MockStorage();
    const result = await importClaudeCode(storage, SAMPLE_JSONL, 'per-conversation');
    assert.ok(result.imported >= 3);
  });

  it('groups by sessionId in per-conversation mode', async () => {
    const storage = new MockStorage();
    const result = await importClaudeCode(storage, SAMPLE_JSONL, 'per-conversation');
    // 2 sessions → 2 projects
    assert.equal(result.projectCount, 2);
  });

  it('tags entries with claude-code', async () => {
    const storage = new MockStorage();
    await importClaudeCode(storage, SAMPLE_JSONL, 'per-conversation');
    const allEntries = Object.values(storage.history).flat();
    for (const e of allEntries) {
      assert.ok(e.tags.includes('claude-code'));
    }
  });

  it('works in single mode', async () => {
    const storage = new MockStorage();
    const result = await importClaudeCode(storage, SAMPLE_JSONL, 'single', 'Code Import');
    assert.equal(result.projectCount, 1);
    assert.equal(storage.projects[0].name, 'Code Import');
    assert.ok(result.imported >= 3);
  });
});

// ── Edge cases ──

describe('Importer — Edge Cases', () => {
  it('handles empty conversations array', async () => {
    const storage = new MockStorage();
    const result = await importClaudeDesktop(storage, '[]', 'per-conversation');
    assert.equal(result.imported, 0);
  });

  it('throws on invalid JSON', async () => {
    const storage = new MockStorage();
    await assert.rejects(
      () => importClaudeDesktop(storage, 'not json', 'single'),
      { message: /Invalid JSON/ }
    );
  });

  it('handles empty JSONL', async () => {
    const storage = new MockStorage();
    const result = await importClaudeCode(storage, '', 'single', 'Empty');
    assert.equal(result.imported, 0);
  });

  it('handles conversations with content array format', async () => {
    const data = JSON.stringify([{
      uuid: 'c1', name: 'Content Array',
      created_at: '2025-01-01T00:00:00Z',
      chat_messages: [{
        uuid: 'm1', sender: 'human',
        content: [{ type: 'text', text: 'This message uses the content array format instead of text field.' }],
        created_at: '2025-01-01T00:01:00Z'
      }]
    }]);
    const storage = new MockStorage();
    const result = await importClaudeDesktop(storage, data, 'single', 'Content Test');
    assert.equal(result.imported, 1);
  });
});
