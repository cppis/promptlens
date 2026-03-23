/**
 * PromptLens — History Manager
 * CRUD operations for prompt analysis history, grouped by project.
 * Uses chrome.storage.local in Extension mode, falls back to in-memory store.
 */

// ---------- Storage adapter ----------
const isExtension = typeof chrome !== 'undefined' && chrome.storage?.local;

const memoryStore = {};

async function storageGet(key) {
  if (isExtension) {
    return new Promise(r => chrome.storage.local.get(key, result => r(result[key])));
  }
  return memoryStore[key];
}

async function storageSet(key, value) {
  if (isExtension) {
    return new Promise(r => chrome.storage.local.set({ [key]: value }, r));
  }
  memoryStore[key] = value;
}

// ---------- Key helpers ----------
const PROJECTS_KEY = 'pc_projects';
const historyKey = (projectId) => `pc_history_${projectId}`;

// ---------- Project CRUD ----------

export async function getProjects() {
  const projects = await storageGet(PROJECTS_KEY);
  return projects || [];
}

export async function createProject(name) {
  const projects = await getProjects();
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const project = { id, name, createdAt: new Date().toISOString(), promptCount: 0 };
  projects.push(project);
  await storageSet(PROJECTS_KEY, projects);
  return project;
}

export async function renameProject(projectId, newName) {
  const projects = await getProjects();
  const proj = projects.find(p => p.id === projectId);
  if (proj) {
    proj.name = newName;
    await storageSet(PROJECTS_KEY, projects);
  }
  return proj;
}

export async function deleteProject(projectId) {
  let projects = await getProjects();
  projects = projects.filter(p => p.id !== projectId);
  await storageSet(PROJECTS_KEY, projects);
  // Also delete history entries
  await storageSet(historyKey(projectId), []);
}

// ---------- History entry CRUD ----------

/**
 * @typedef {Object} HistoryEntry
 * @property {string} id
 * @property {string} projectId
 * @property {string} prompt        - Original prompt text
 * @property {string} enhanced      - AI-enhanced prompt text
 * @property {number} score         - Overall quality score (0-100)
 * @property {number[]} axisScores  - [clarity, specificity, context, structure, actionability]
 * @property {string[]} tags        - User tags
 * @property {string} note          - User note / memo
 * @property {string} platform      - Target AI platform (chatgpt, claude, gemini, etc.)
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export async function getHistory(projectId) {
  const entries = await storageGet(historyKey(projectId));
  return entries || [];
}

export async function addHistoryEntry(projectId, entry) {
  const entries = await getHistory(projectId);
  const now = new Date().toISOString();
  const newEntry = {
    id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    projectId,
    prompt: '',
    enhanced: '',
    score: 0,
    axisScores: [0, 0, 0, 0, 0],
    tags: [],
    note: '',
    platform: '',
    createdAt: now,
    updatedAt: now,
    ...entry
  };
  entries.unshift(newEntry);
  await storageSet(historyKey(projectId), entries);

  // Update project prompt count
  const projects = await getProjects();
  const proj = projects.find(p => p.id === projectId);
  if (proj) {
    proj.promptCount = entries.length;
    await storageSet(PROJECTS_KEY, projects);
  }

  return newEntry;
}

export async function updateHistoryEntry(projectId, entryId, updates) {
  const entries = await getHistory(projectId);
  const idx = entries.findIndex(e => e.id === entryId);
  if (idx === -1) return null;
  entries[idx] = { ...entries[idx], ...updates, updatedAt: new Date().toISOString() };
  await storageSet(historyKey(projectId), entries);
  return entries[idx];
}

export async function deleteHistoryEntry(projectId, entryId) {
  let entries = await getHistory(projectId);
  entries = entries.filter(e => e.id !== entryId);
  await storageSet(historyKey(projectId), entries);

  const projects = await getProjects();
  const proj = projects.find(p => p.id === projectId);
  if (proj) {
    proj.promptCount = entries.length;
    await storageSet(PROJECTS_KEY, projects);
  }
}

// ---------- Aggregation helpers ----------

export function calcAvgScore(entries) {
  if (!entries.length) return 0;
  return Math.round(entries.reduce((s, e) => s + e.score, 0) / entries.length);
}

export function calcScoreTrend(entries, days = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const recent = entries.filter(e => new Date(e.createdAt) >= cutoff);
  const older = entries.filter(e => new Date(e.createdAt) < cutoff);
  if (!recent.length || !older.length) return 0;
  return calcAvgScore(recent) - calcAvgScore(older);
}

export function getTagCounts(entries) {
  const map = {};
  entries.forEach(e => e.tags.forEach(t => { map[t] = (map[t] || 0) + 1; }));
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

// ---------- Demo data seeder ----------

export async function seedDemoData() {
  const existing = await getProjects();
  if (existing.length > 0) return; // Don't overwrite

  const projects = [
    { id: 'demo_backend', name: 'Backend Migration', createdAt: '2026-03-15T09:00:00Z', promptCount: 5 },
    { id: 'demo_marketing', name: 'Marketing Campaign', createdAt: '2026-03-18T10:00:00Z', promptCount: 3 }
  ];
  await storageSet(PROJECTS_KEY, projects);

  const backendHistory = [
    {
      id: 'h_demo_1', projectId: 'demo_backend',
      prompt: 'Design a microservices architecture for our e-commerce platform',
      enhanced: 'You are a senior backend architect with 10+ years of distributed systems experience. Our monolithic e-commerce platform (Django, PostgreSQL) handles 50K RPM. Design a microservices decomposition strategy using DDD bounded contexts. Present as a table: Service Name | Responsibility | Data Store | Sync/Async Communication | Dependencies.',
      score: 92, axisScores: [95, 90, 88, 92, 94],
      tags: ['architecture', 'microservices'], note: 'Great result, used for sprint planning',
      platform: 'claude', createdAt: '2026-03-21T09:00:00Z', updatedAt: '2026-03-21T09:00:00Z'
    },
    {
      id: 'h_demo_2', projectId: 'demo_backend',
      prompt: 'Write tests for the order service',
      enhanced: 'You are a senior QA engineer specializing in microservices testing. Write integration tests for the Order Service (Node.js, Express, PostgreSQL). Cover: 1) Order creation with valid/invalid payloads, 2) Inventory reservation via async event, 3) Payment failure rollback. Use Jest + Supertest. Include edge cases for concurrent orders.',
      score: 85, axisScores: [88, 82, 80, 85, 88],
      tags: ['testing', 'backend'], note: '',
      platform: 'chatgpt', createdAt: '2026-03-20T14:00:00Z', updatedAt: '2026-03-20T14:00:00Z'
    },
    {
      id: 'h_demo_3', projectId: 'demo_backend',
      prompt: 'Help me optimize database queries',
      enhanced: 'You are a PostgreSQL performance tuning expert. Analyze and optimize these slow queries for our e-commerce Order table (12M rows, indexed on user_id, created_at). Current avg response: 340ms, target: <50ms. For each query provide: EXPLAIN ANALYZE output interpretation, suggested index changes, and rewritten query.',
      score: 78, axisScores: [80, 75, 82, 72, 78],
      tags: ['database', 'performance'], note: 'Need to add specific query examples next time',
      platform: 'claude', createdAt: '2026-03-19T11:00:00Z', updatedAt: '2026-03-19T15:00:00Z'
    },
    {
      id: 'h_demo_4', projectId: 'demo_backend',
      prompt: 'Explain kubernetes pod networking',
      enhanced: '',
      score: 45, axisScores: [50, 35, 40, 55, 48],
      tags: ['kubernetes'], note: 'Too vague, should specify what aspect of networking',
      platform: 'gemini', createdAt: '2026-03-18T16:00:00Z', updatedAt: '2026-03-18T16:00:00Z'
    },
    {
      id: 'h_demo_5', projectId: 'demo_backend',
      prompt: 'Create CI/CD pipeline configuration',
      enhanced: 'You are a DevOps engineer specializing in AWS and GitHub Actions. Create a CI/CD pipeline for our Node.js microservice that: 1) Runs lint + unit tests on PR, 2) Builds Docker image on merge to main, 3) Deploys to EKS staging with canary strategy (10% → 50% → 100%), 4) Requires manual approval for production. Output as a complete .github/workflows/deploy.yml file.',
      score: 88, axisScores: [90, 85, 82, 92, 90],
      tags: ['devops', 'ci-cd'], note: 'Very detailed output, saved as template',
      platform: 'claude', createdAt: '2026-03-17T10:00:00Z', updatedAt: '2026-03-17T10:00:00Z'
    }
  ];

  const marketingHistory = [
    {
      id: 'h_demo_6', projectId: 'demo_marketing',
      prompt: 'Write social media copy for product launch',
      enhanced: 'You are a B2B SaaS marketing specialist with expertise in developer tools. Write 5 social media posts (LinkedIn + Twitter) for the launch of PromptCraft, an AI prompt analysis Chrome Extension. Target audience: software engineers and AI power users. Tone: professional but approachable. Each post should include: hook, value prop, CTA. Vary formats (question, statistic, testimonial, how-to, announcement).',
      score: 82, axisScores: [85, 80, 78, 82, 84],
      tags: ['social-media', 'launch'], note: '',
      platform: 'claude', createdAt: '2026-03-20T09:00:00Z', updatedAt: '2026-03-20T09:00:00Z'
    },
    {
      id: 'h_demo_7', projectId: 'demo_marketing',
      prompt: 'Create email sequence for beta users',
      enhanced: '',
      score: 55, axisScores: [60, 50, 52, 55, 58],
      tags: ['email'], note: 'Too generic, needs specific sequence length and goals',
      platform: 'chatgpt', createdAt: '2026-03-19T13:00:00Z', updatedAt: '2026-03-19T13:00:00Z'
    },
    {
      id: 'h_demo_8', projectId: 'demo_marketing',
      prompt: 'Analyze competitor positioning for AI prompt tools',
      enhanced: 'You are a competitive intelligence analyst in the developer tools market. Research and compare these AI prompt helper tools: PromptPerfect, AIPRM, Promptheus. For each, analyze: 1) Core value proposition, 2) Pricing model, 3) Target user persona, 4) Key differentiators, 5) Weaknesses. Present as a comparison matrix. Then identify 3 underserved market gaps that PromptCraft could fill.',
      score: 90, axisScores: [92, 88, 85, 90, 92],
      tags: ['competitor', 'research'], note: 'Excellent framework, reuse this pattern',
      platform: 'claude', createdAt: '2026-03-18T11:00:00Z', updatedAt: '2026-03-18T14:00:00Z'
    }
  ];

  await storageSet(historyKey('demo_backend'), backendHistory);
  await storageSet(historyKey('demo_marketing'), marketingHistory);
}
