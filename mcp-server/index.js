#!/usr/bin/env node

/**
 * PromptLens MCP Server (v0.3.0)
 *
 * MCP-only architecture — all PromptLens features accessible via
 * Claude Desktop and Claude Code as native MCP tools.
 *
 * Transport: stdio
 * Storage: ~/.promptlens/data.json (data), ~/.promptlens/settings.json (config)
 *
 * Tools (9):
 *   analyze_prompt          — Prompt quality analysis (local rules or Claude API)
 *   list_projects           — List all projects with stats
 *   create_project          — Create a new project
 *   get_history             — Get prompt history for a project
 *   add_history_entry       — Add a prompt to history
 *   import_claude_conversations — Import Claude Desktop/Code conversations
 *   get_stats               — Overall statistics
 *   set_api_key             — Register Claude API key for API analysis mode
 *   get_settings            — View current settings (API key status, model, etc.)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Storage } from './lib/storage.js';
import { analyzePrompt, analyzePromptWithApi } from './lib/analyzer.js';
import { importClaudeDesktop, importClaudeCode } from './lib/importer.js';

const storage = new Storage();

const server = new McpServer({
  name: 'promptlens',
  version: '0.3.0'
});

// ─────────────────────────────────────────────
// Tool: analyze_prompt
// ─────────────────────────────────────────────
server.tool(
  'analyze_prompt',
  'Analyze a prompt for quality. Two modes: "local" (default, free, instant 5-axis scoring) or "api" (Claude API 3-color report: Referenced/Inferred/Missing — requires API key). Returns scores, missing elements, and improvement suggestions.',
  {
    prompt: z.string().describe('The prompt text to analyze'),
    mode: z.enum(['local', 'api']).optional().describe('Analysis mode: "local" (free, rule-based) or "api" (Claude API 3-color report). Default: local'),
    projectId: z.string().optional().describe('Optional project ID to save the analysis to history'),
    tags: z.array(z.string()).optional().describe('Optional tags for the history entry')
  },
  async ({ prompt, mode, projectId, tags }) => {
    const analysisMode = mode || 'local';
    let result;

    if (analysisMode === 'api') {
      const apiKey = storage.getApiKey();
      if (!apiKey) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'API key not set. Use set_api_key tool first, or use mode: "local" for free analysis.',
              hint: 'Run: set_api_key with your Anthropic API key (sk-ant-...)'
            }, null, 2)
          }]
        };
      }
      const model = storage.getModel();
      try {
        result = await analyzePromptWithApi(prompt, apiKey, model);
      } catch (err) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: `API analysis failed: ${err.message}`,
              hint: 'Check your API key and credit balance. Falling back to local analysis.',
              fallback: analyzePrompt(prompt)
            }, null, 2)
          }]
        };
      }
    } else {
      result = analyzePrompt(prompt);
    }

    // Save to history if projectId provided
    if (projectId) {
      await storage.addHistoryEntry(projectId, {
        prompt,
        enhanced: result.enhancedPrompt || result.enhanced || '',
        score: result.score,
        axisScores: result.axisScores,
        tags: tags || ['mcp', analysisMode],
        note: `[MCP ${analysisMode}] ${result.summary}`,
        platform: 'claude'
      });
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
);

// ─────────────────────────────────────────────
// Tool: list_projects
// ─────────────────────────────────────────────
server.tool(
  'list_projects',
  'List all PromptLens projects with their stats (prompt count, average score, trend).',
  {},
  async () => {
    const projects = await storage.getProjects();
    const result = [];
    for (const p of projects) {
      const entries = await storage.getHistory(p.id);
      const avgScore = entries.length > 0
        ? Math.round(entries.reduce((s, e) => s + e.score, 0) / entries.length)
        : 0;
      result.push({
        id: p.id,
        name: p.name,
        promptCount: entries.length,
        avgScore,
        createdAt: p.createdAt
      });
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
);

// ─────────────────────────────────────────────
// Tool: create_project
// ─────────────────────────────────────────────
server.tool(
  'create_project',
  'Create a new PromptLens project for organizing prompt history.',
  {
    name: z.string().describe('Project name')
  },
  async ({ name }) => {
    const project = await storage.createProject(name);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ message: `Project "${name}" created`, project }, null, 2)
      }]
    };
  }
);

// ─────────────────────────────────────────────
// Tool: get_history
// ─────────────────────────────────────────────
server.tool(
  'get_history',
  'Get prompt history entries for a project. Returns prompts with scores, tags, and timestamps.',
  {
    projectId: z.string().describe('Project ID'),
    limit: z.number().optional().describe('Maximum number of entries to return (default: 20)'),
    search: z.string().optional().describe('Search text to filter entries by prompt content or tags')
  },
  async ({ projectId, limit, search }) => {
    let entries = await storage.getHistory(projectId);

    if (search) {
      const q = search.toLowerCase();
      entries = entries.filter(e =>
        e.prompt.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q)) ||
        e.note.toLowerCase().includes(q)
      );
    }

    // Sort by date descending
    entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (limit) {
      entries = entries.slice(0, limit);
    } else {
      entries = entries.slice(0, 20);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(entries, null, 2)
      }]
    };
  }
);

// ─────────────────────────────────────────────
// Tool: add_history_entry
// ─────────────────────────────────────────────
server.tool(
  'add_history_entry',
  'Add a prompt to history with optional score and tags. Use this to manually record prompts you want to track.',
  {
    projectId: z.string().describe('Project ID'),
    prompt: z.string().describe('The prompt text'),
    score: z.number().min(0).max(100).optional().describe('Quality score (0-100)'),
    tags: z.array(z.string()).optional().describe('Tags for categorization'),
    note: z.string().optional().describe('Note or comment')
  },
  async ({ projectId, prompt, score, tags, note }) => {
    const analysis = analyzePrompt(prompt);
    const entry = await storage.addHistoryEntry(projectId, {
      prompt,
      enhanced: '',
      score: score ?? analysis.score,
      axisScores: analysis.axisScores,
      tags: tags || ['mcp'],
      note: note || '',
      platform: 'claude'
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ message: 'Entry added', entry }, null, 2)
      }]
    };
  }
);

// ─────────────────────────────────────────────
// Tool: import_claude_conversations
// ─────────────────────────────────────────────
server.tool(
  'import_claude_conversations',
  'Import conversations from Claude Desktop (conversations.json) or Claude Code (.jsonl). Creates one project per conversation or merges all into one project.',
  {
    filePath: z.string().describe('Path to conversations.json or .jsonl file'),
    mode: z.enum(['per-conversation', 'single']).optional().describe('Import mode: per-conversation (default) creates one project per conversation, single merges all into one project'),
    projectName: z.string().optional().describe('Project name for single mode')
  },
  async ({ filePath, mode, projectName }) => {
    const fs = await import('fs');
    if (!fs.existsSync(filePath)) {
      return {
        content: [{ type: 'text', text: `Error: File not found: ${filePath}` }]
      };
    }

    const text = fs.readFileSync(filePath, 'utf-8');
    const importMode = mode || 'per-conversation';

    let result;
    if (filePath.endsWith('.jsonl')) {
      result = await importClaudeCode(storage, text, importMode, projectName);
    } else {
      result = await importClaudeDesktop(storage, text, importMode, projectName);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: 'Import complete',
          imported: result.imported,
          skipped: result.skipped,
          projectCount: result.projectCount || 1,
          projectIds: result.projectIds || [result.projectId]
        }, null, 2)
      }]
    };
  }
);

// ─────────────────────────────────────────────
// Tool: get_stats
// ─────────────────────────────────────────────
server.tool(
  'get_stats',
  'Get overall PromptLens statistics: total projects, total prompts, average score, most used tags, score trend.',
  {},
  async () => {
    const projects = await storage.getProjects();
    let totalPrompts = 0;
    let totalScore = 0;
    let scored = 0;
    const tagCounts = {};

    for (const p of projects) {
      const entries = await storage.getHistory(p.id);
      totalPrompts += entries.length;
      for (const e of entries) {
        if (e.score > 0) { totalScore += e.score; scored++; }
        for (const t of e.tags) {
          tagCounts[t] = (tagCounts[t] || 0) + 1;
        }
      }
    }

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          totalProjects: projects.length,
          totalPrompts,
          avgScore: scored > 0 ? Math.round(totalScore / scored) : 0,
          topTags
        }, null, 2)
      }]
    };
  }
);

// ─────────────────────────────────────────────
// Tool: set_api_key
// ─────────────────────────────────────────────
server.tool(
  'set_api_key',
  'Register or update your Anthropic API key for Claude API analysis mode. The key is stored locally in ~/.promptlens/settings.json. You can also set the preferred model.',
  {
    apiKey: z.string().describe('Anthropic API key (sk-ant-...)'),
    model: z.string().optional().describe('Preferred model for API analysis (default: claude-sonnet-4-5-20250514). Options: claude-sonnet-4-5-20250514, claude-3-5-haiku-20241022, claude-opus-4-0-20250514')
  },
  async ({ apiKey, model }) => {
    // Validate key format
    if (!apiKey.startsWith('sk-ant-')) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: 'Invalid API key format. Key should start with "sk-ant-"' }, null, 2)
        }]
      };
    }

    // Test the key with a minimal request
    try {
      const testModel = 'claude-3-5-haiku-20241022';
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: testModel,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      });

      if (!response.ok) {
        const err = await response.text();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: `API key validation failed: ${err}` }, null, 2)
          }]
        };
      }

      storage.setApiKey(apiKey);
      if (model) storage.setModel(model);

      const masked = apiKey.slice(0, 10) + '...' + apiKey.slice(-4);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'API key registered and validated successfully',
            maskedKey: masked,
            model: model || storage.getModel(),
            hint: 'You can now use analyze_prompt with mode: "api" for 3-color reports'
          }, null, 2)
        }]
      };
    } catch (err) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: `Connection failed: ${err.message}` }, null, 2)
        }]
      };
    }
  }
);

// ─────────────────────────────────────────────
// Tool: get_settings
// ─────────────────────────────────────────────
server.tool(
  'get_settings',
  'View current PromptLens settings: API key status, preferred model, storage location.',
  {},
  async () => {
    const apiKey = storage.getApiKey();
    const model = storage.getModel();
    const settings = storage.getSettings();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          apiKeyStatus: apiKey ? 'registered' : 'not set',
          maskedKey: apiKey ? apiKey.slice(0, 10) + '...' + apiKey.slice(-4) : null,
          model,
          storagePath: '~/.promptlens/data.json',
          settingsPath: '~/.promptlens/settings.json',
          availableModes: {
            local: 'Free, instant, rule-based 5-axis scoring (always available)',
            api: apiKey ? 'Claude API 3-color report (Referenced/Inferred/Missing)' : 'Requires API key — use set_api_key first'
          }
        }, null, 2)
      }]
    };
  }
);

// ─────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
