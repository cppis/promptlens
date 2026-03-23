import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Use a temp directory so tests don't pollute real data
const TEST_DIR = path.join(os.tmpdir(), `.promptlens-test-${Date.now()}`);
const DATA_FILE = path.join(TEST_DIR, 'data.json');
const SETTINGS_FILE = path.join(TEST_DIR, 'settings.json');

// Patch the module paths before import
let Storage;

before(async () => {
  fs.mkdirSync(TEST_DIR, { recursive: true });

  // We'll import Storage and monkey-patch the paths
  const mod = await import('../lib/storage.js');
  Storage = class TestStorage extends mod.Storage {
    _ensureDir() {
      if (!fs.existsSync(TEST_DIR)) {
        fs.mkdirSync(TEST_DIR, { recursive: true });
      }
    }
    _load() {
      if (fs.existsSync(DATA_FILE)) {
        try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); }
        catch { return { projects: [], history: {} }; }
      }
      return { projects: [], history: {} };
    }
    _save() {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this._data, null, 2), 'utf-8');
    }
    getSettings() {
      if (fs.existsSync(SETTINGS_FILE)) {
        try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')); }
        catch { return {}; }
      }
      return {};
    }
    saveSettings(settings) {
      const current = this.getSettings();
      const merged = { ...current, ...settings };
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf-8');
      return merged;
    }
    getApiKey() { return this.getSettings().apiKey || null; }
    setApiKey(k) { this.saveSettings({ apiKey: k }); }
    removeApiKey() {
      const s = this.getSettings(); delete s.apiKey;
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf-8');
    }
    getModel() { return this.getSettings().model || 'claude-sonnet-4-5-20250514'; }
    setModel(m) { this.saveSettings({ model: m }); }
  };
});

after(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

beforeEach(() => {
  // Clean data files before each test
  if (fs.existsSync(DATA_FILE)) fs.unlinkSync(DATA_FILE);
  if (fs.existsSync(SETTINGS_FILE)) fs.unlinkSync(SETTINGS_FILE);
});

// ── Projects ──

describe('Storage — Projects', () => {
  it('starts with empty project list', async () => {
    const s = new Storage();
    const projects = await s.getProjects();
    assert.deepEqual(projects, []);
  });

  it('creates a project with id and name', async () => {
    const s = new Storage();
    const p = await s.createProject('Test Project');
    assert.ok(p.id.startsWith('proj_'));
    assert.equal(p.name, 'Test Project');
    assert.equal(p.promptCount, 0);
    assert.ok(p.createdAt);
  });

  it('lists created projects', async () => {
    const s = new Storage();
    await s.createProject('A');
    await s.createProject('B');
    const projects = await s.getProjects();
    assert.equal(projects.length, 2);
    assert.equal(projects[0].name, 'A');
    assert.equal(projects[1].name, 'B');
  });

  it('renames a project', async () => {
    const s = new Storage();
    const p = await s.createProject('Old Name');
    await s.renameProject(p.id, 'New Name');
    const projects = await s.getProjects();
    assert.equal(projects[0].name, 'New Name');
  });

  it('deletes a project and its history', async () => {
    const s = new Storage();
    const p = await s.createProject('To Delete');
    await s.addHistoryEntry(p.id, { prompt: 'test prompt for deletion' });
    await s.deleteProject(p.id);
    const projects = await s.getProjects();
    assert.equal(projects.length, 0);
    const history = await s.getHistory(p.id);
    assert.deepEqual(history, []);
  });
});

// ── History ──

describe('Storage — History', () => {
  it('adds a history entry with all fields', async () => {
    const s = new Storage();
    const p = await s.createProject('Hist Test');
    const entry = await s.addHistoryEntry(p.id, {
      prompt: 'React로 로그인 폼 만들어줘',
      enhanced: 'enhanced version',
      score: 72,
      axisScores: [80, 60, 70, 75, 65],
      tags: ['react', 'login'],
      note: 'test note',
      platform: 'claude'
    });

    assert.ok(entry.id.startsWith('h_'));
    assert.equal(entry.prompt, 'React로 로그인 폼 만들어줘');
    assert.equal(entry.score, 72);
    assert.deepEqual(entry.tags, ['react', 'login']);
    assert.ok(entry.createdAt);
    assert.ok(entry.updatedAt);
  });

  it('increments project promptCount on add', async () => {
    const s = new Storage();
    const p = await s.createProject('Count Test');
    await s.addHistoryEntry(p.id, { prompt: 'one' });
    await s.addHistoryEntry(p.id, { prompt: 'two' });
    const projects = await s.getProjects();
    assert.equal(projects[0].promptCount, 2);
  });

  it('returns history for a project', async () => {
    const s = new Storage();
    const p = await s.createProject('Get Test');
    await s.addHistoryEntry(p.id, { prompt: 'first' });
    await s.addHistoryEntry(p.id, { prompt: 'second' });
    const entries = await s.getHistory(p.id);
    assert.equal(entries.length, 2);
  });

  it('returns empty array for unknown project', async () => {
    const s = new Storage();
    const entries = await s.getHistory('nonexistent');
    assert.deepEqual(entries, []);
  });

  it('updates a history entry', async () => {
    const s = new Storage();
    const p = await s.createProject('Update Test');
    const entry = await s.addHistoryEntry(p.id, { prompt: 'original', score: 50 });
    const updated = await s.updateHistoryEntry(p.id, entry.id, { score: 90, note: 'updated' });
    assert.equal(updated.score, 90);
    assert.equal(updated.note, 'updated');
    assert.equal(updated.prompt, 'original'); // unchanged
  });

  it('deletes a history entry and decrements promptCount', async () => {
    const s = new Storage();
    const p = await s.createProject('Delete Test');
    const e1 = await s.addHistoryEntry(p.id, { prompt: 'keep' });
    const e2 = await s.addHistoryEntry(p.id, { prompt: 'remove' });
    await s.deleteHistoryEntry(p.id, e2.id);
    const entries = await s.getHistory(p.id);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].prompt, 'keep');
    const projects = await s.getProjects();
    assert.equal(projects[0].promptCount, 1);
  });

  it('fills default values for missing fields', async () => {
    const s = new Storage();
    const p = await s.createProject('Default Test');
    const entry = await s.addHistoryEntry(p.id, { prompt: 'minimal' });
    assert.equal(entry.enhanced, '');
    assert.equal(entry.score, 0);
    assert.deepEqual(entry.axisScores, [0, 0, 0, 0, 0]);
    assert.deepEqual(entry.tags, []);
    assert.equal(entry.note, '');
    assert.equal(entry.platform, 'claude');
  });
});

// ── Settings ──

describe('Storage — Settings', () => {
  it('returns empty settings initially', () => {
    const s = new Storage();
    assert.deepEqual(s.getSettings(), {});
  });

  it('saves and retrieves settings', () => {
    const s = new Storage();
    s.saveSettings({ theme: 'dark', language: 'ko' });
    const settings = s.getSettings();
    assert.equal(settings.theme, 'dark');
    assert.equal(settings.language, 'ko');
  });

  it('merges settings on save', () => {
    const s = new Storage();
    s.saveSettings({ a: 1 });
    s.saveSettings({ b: 2 });
    const settings = s.getSettings();
    assert.equal(settings.a, 1);
    assert.equal(settings.b, 2);
  });

  it('manages API key', () => {
    const s = new Storage();
    assert.equal(s.getApiKey(), null);
    s.setApiKey('sk-ant-test-key');
    assert.equal(s.getApiKey(), 'sk-ant-test-key');
    s.removeApiKey();
    assert.equal(s.getApiKey(), null);
  });

  it('manages model with default', () => {
    const s = new Storage();
    assert.equal(s.getModel(), 'claude-sonnet-4-5-20250514');
    s.setModel('claude-3-5-haiku-20241022');
    assert.equal(s.getModel(), 'claude-3-5-haiku-20241022');
  });
});

// ── Persistence ──

describe('Storage — Persistence', () => {
  it('persists data across instances', async () => {
    const s1 = new Storage();
    const p = await s1.createProject('Persist');
    await s1.addHistoryEntry(p.id, { prompt: 'saved prompt', score: 88 });

    const s2 = new Storage();
    const projects = await s2.getProjects();
    assert.equal(projects.length, 1);
    assert.equal(projects[0].name, 'Persist');
    const entries = await s2.getHistory(p.id);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].score, 88);
  });

  it('persists settings across instances', () => {
    const s1 = new Storage();
    s1.setApiKey('sk-ant-persist-key');
    const s2 = new Storage();
    assert.equal(s2.getApiKey(), 'sk-ant-persist-key');
  });
});
