/**
 * PromptLens — Claude Data Importer
 *
 * Imports conversation history from:
 * 1. Claude Code  — ~/.claude/projects/<project>/  (.jsonl files)
 * 2. Claude Desktop — Settings > Privacy > Export  (conversations.json)
 *
 * Actual Claude Desktop export format (verified):
 * conversations.json = [
 *   {
 *     uuid, name, summary, created_at, updated_at,
 *     account: { uuid },
 *     chat_messages: [
 *       {
 *         uuid, sender: "human"|"assistant",
 *         text: "...",
 *         content: [{ type: "text", text: "...", citations: [...] }],
 *         created_at, updated_at, attachments, files
 *       }
 *     ]
 *   }
 * ]
 *
 * Import modes:
 * - "single"         : All prompts into one project
 * - "per-conversation": One PromptLens project per Claude conversation
 */

import { addHistoryEntry, createProject, getProjects } from './HistoryManager.js';

// ----------------------------------------------------------------
// 1. Claude Code — JSONL parser
// ----------------------------------------------------------------

export function parseClaudeCodeJsonl(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const messages = [];

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'user' || obj.type === 'assistant') {
        const content = extractContent(obj.message);
        if (content) {
          messages.push({
            type: obj.type,
            content,
            timestamp: obj.timestamp,
            uuid: obj.uuid,
            parentUuid: obj.parentUuid,
            sessionId: obj.sessionId
          });
        }
      }
    } catch {
      // Skip malformed lines
    }
  }

  return pairMessages(messages);
}

/**
 * Extract text content from a Claude message object.
 * Handles: string, array of {type:"text", text}, nested message.content
 */
function extractContent(message) {
  if (!message) return '';
  const content = message.content ?? message;

  if (typeof content === 'string') return content.trim();

  if (Array.isArray(content)) {
    return content
      .filter(block => block.type === 'text' && block.text)
      .map(block => block.text.trim())
      .join('\n')
      .trim();
  }

  return '';
}

/**
 * Pair user messages with following assistant messages.
 */
function pairMessages(messages) {
  const pairs = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.type !== 'user' || !msg.content) continue;

    let response = '';
    for (let j = i + 1; j < messages.length; j++) {
      if (messages[j].type === 'user') break;
      if (messages[j].type === 'assistant' && messages[j].content) {
        response += (response ? '\n' : '') + messages[j].content;
      }
    }

    pairs.push({
      prompt: msg.content,
      response: response.slice(0, 2000),
      timestamp: msg.timestamp,
      sessionId: msg.sessionId
    });
  }
  return pairs;
}

// ----------------------------------------------------------------
// 2. Claude Desktop — JSON export parser (verified with real data)
// ----------------------------------------------------------------

/**
 * Parse Claude Desktop conversations.json.
 * Returns { entries: [...], conversations: [...] }
 *   entries: flat array of prompt-response pairs (for single-project import)
 *   conversations: grouped by conversation (for per-conversation import)
 */
export function parseClaudeDesktopJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON format');
  }

  // Normalize input format
  let conversations = [];
  if (Array.isArray(data)) {
    conversations = data;
  } else if (data.conversations && Array.isArray(data.conversations)) {
    conversations = data.conversations;
  } else if (data.chat_messages) {
    conversations = [data];
  } else {
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key]) && data[key][0]?.chat_messages) {
        conversations = data[key];
        break;
      }
    }
  }

  const allPairs = [];
  const conversationGroups = [];

  for (const conv of conversations) {
    const messages = conv.chat_messages || conv.messages || [];
    const convName = (conv.name || conv.title || '').trim() || 'Untitled';
    const convUuid = conv.uuid || '';
    const convCreatedAt = conv.created_at || '';
    const convSummary = conv.summary || '';

    const pairs = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const sender = msg.sender || msg.role || '';
      if (sender !== 'human' && sender !== 'user') continue;

      // Extract user text: prefer .text, fallback to .content array
      const userText = (msg.text || extractContent(msg) || '').trim();
      if (!userText) continue;

      // Find next assistant message
      let response = '';
      for (let j = i + 1; j < messages.length; j++) {
        const next = messages[j];
        const nextSender = next.sender || next.role || '';
        if (nextSender === 'human' || nextSender === 'user') break;
        if (nextSender === 'assistant') {
          response = (next.text || extractContent(next) || '').trim();
          break;
        }
      }

      const entry = {
        prompt: userText,
        response: response.slice(0, 2000),
        timestamp: msg.created_at || msg.timestamp || conv.created_at || new Date().toISOString(),
        conversationName: convName,
        conversationUuid: convUuid
      };

      pairs.push(entry);
      allPairs.push(entry);
    }

    if (pairs.length > 0) {
      conversationGroups.push({
        uuid: convUuid,
        name: convName,
        summary: convSummary,
        createdAt: convCreatedAt,
        messageCount: messages.length,
        promptCount: pairs.length,
        entries: pairs
      });
    }
  }

  return allPairs;
}

/**
 * Parse and return conversation-grouped data for UI preview.
 * Separate from parseClaudeDesktopJson to keep backward compat.
 */
export function parseClaudeDesktopGrouped(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON format');
  }

  let conversations = [];
  if (Array.isArray(data)) {
    conversations = data;
  } else if (data.conversations && Array.isArray(data.conversations)) {
    conversations = data.conversations;
  } else if (data.chat_messages) {
    conversations = [data];
  } else {
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key]) && data[key][0]?.chat_messages) {
        conversations = data[key];
        break;
      }
    }
  }

  const groups = [];

  for (const conv of conversations) {
    const messages = conv.chat_messages || conv.messages || [];
    const convName = (conv.name || conv.title || '').trim() || 'Untitled';

    const pairs = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const sender = msg.sender || msg.role || '';
      if (sender !== 'human' && sender !== 'user') continue;

      const userText = (msg.text || extractContent(msg) || '').trim();
      if (!userText) continue;

      let response = '';
      for (let j = i + 1; j < messages.length; j++) {
        const next = messages[j];
        const nextSender = next.sender || next.role || '';
        if (nextSender === 'human' || nextSender === 'user') break;
        if (nextSender === 'assistant') {
          response = (next.text || extractContent(next) || '').trim();
          break;
        }
      }

      pairs.push({
        prompt: userText,
        response: response.slice(0, 2000),
        timestamp: msg.created_at || conv.created_at || new Date().toISOString(),
        conversationName: convName,
        conversationUuid: conv.uuid || ''
      });
    }

    if (pairs.length > 0) {
      groups.push({
        uuid: conv.uuid || '',
        name: convName,
        summary: conv.summary || '',
        createdAt: conv.created_at || '',
        messageCount: messages.length,
        promptCount: pairs.length,
        entries: pairs
      });
    }
  }

  return groups;
}

// ----------------------------------------------------------------
// 3. Auto-detect format and parse
// ----------------------------------------------------------------

export function detectAndParse(text, filename = '') {
  const trimmed = text.trim();
  const ext = filename.toLowerCase();

  if (ext.endsWith('.jsonl') || (trimmed.startsWith('{') && trimmed.includes('\n{'))) {
    return { source: 'claude-code', entries: parseClaudeCodeJsonl(text) };
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return { source: 'claude-desktop', entries: parseClaudeDesktopJson(text) };
  }

  throw new Error('Unrecognized file format. Expected .jsonl (Claude Code) or .json (Claude Desktop).');
}

/**
 * Detect, parse, and return grouped conversations (for Claude Desktop).
 * Falls back to flat entries wrapped in a single group for Claude Code.
 */
export function detectAndParseGrouped(text, filename = '') {
  const trimmed = text.trim();
  const ext = filename.toLowerCase();

  if (ext.endsWith('.jsonl') || (trimmed.startsWith('{') && trimmed.includes('\n{'))) {
    const entries = parseClaudeCodeJsonl(text);
    // Group by sessionId
    const sessionMap = new Map();
    for (const e of entries) {
      const sid = e.sessionId || 'default';
      if (!sessionMap.has(sid)) {
        sessionMap.set(sid, {
          uuid: sid,
          name: `Session ${sessionMap.size + 1}`,
          summary: '',
          createdAt: e.timestamp || '',
          messageCount: 0,
          promptCount: 0,
          entries: []
        });
      }
      const g = sessionMap.get(sid);
      g.entries.push(e);
      g.promptCount++;
      g.messageCount += 2;
    }
    return {
      source: 'claude-code',
      groups: Array.from(sessionMap.values()),
      totalEntries: entries.length
    };
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const groups = parseClaudeDesktopGrouped(text);
    const totalEntries = groups.reduce((s, g) => s + g.promptCount, 0);
    return {
      source: 'claude-desktop',
      groups,
      totalEntries
    };
  }

  throw new Error('Unrecognized file format. Expected .jsonl (Claude Code) or .json (Claude Desktop).');
}

// ----------------------------------------------------------------
// 4. Import into PromptCraft History
// ----------------------------------------------------------------

/**
 * Import parsed entries into a single PromptCraft project.
 */
export async function importToHistory(projectId, projectName, entries, options = {}) {
  const {
    source = 'claude-code',
    minLength = 10,
    dedup = true
  } = options;

  if (!projectId) {
    const proj = await createProject(projectName || `Import — ${source}`);
    projectId = proj.id;
  }

  const seen = new Set();
  let imported = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (!entry.prompt || entry.prompt.length < minLength) {
      skipped++;
      continue;
    }

    const key = entry.prompt.trim().toLowerCase().slice(0, 200);
    if (dedup && seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);

    const tags = [source];
    if (entry.conversationName && entry.conversationName !== 'Untitled') {
      tags.push(entry.conversationName.slice(0, 30));
    }

    await addHistoryEntry(projectId, {
      prompt: entry.prompt,
      enhanced: '',
      score: 0,
      axisScores: [0, 0, 0, 0, 0],
      tags,
      note: entry.response
        ? `[Imported from ${source}] Response preview: ${entry.response.slice(0, 300)}...`
        : `[Imported from ${source}]`,
      platform: 'claude',
      createdAt: entry.timestamp || new Date().toISOString()
    });

    imported++;
  }

  return { imported, skipped, projectId };
}

/**
 * Import conversation groups into separate PromptCraft projects.
 * Each Claude conversation becomes its own PromptCraft project.
 */
export async function importGroupedToHistory(groups, options = {}) {
  const {
    source = 'claude-desktop',
    minLength = 10,
    dedup = true,
    selectedGroups = null  // null = all, or Set of group uuids
  } = options;

  let totalImported = 0;
  let totalSkipped = 0;
  const projectIds = [];

  const targetGroups = selectedGroups
    ? groups.filter(g => selectedGroups.has(g.uuid))
    : groups;

  for (const group of targetGroups) {
    const projectName = group.name || 'Untitled Conversation';
    const proj = await createProject(projectName);

    const seen = new Set();
    let imported = 0;
    let skipped = 0;

    for (const entry of group.entries) {
      if (!entry.prompt || entry.prompt.length < minLength) {
        skipped++;
        continue;
      }

      const key = entry.prompt.trim().toLowerCase().slice(0, 200);
      if (dedup && seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);

      const tags = [source];
      if (group.name && group.name !== 'Untitled') {
        tags.push(group.name.slice(0, 30));
      }

      await addHistoryEntry(proj.id, {
        prompt: entry.prompt,
        enhanced: '',
        score: 0,
        axisScores: [0, 0, 0, 0, 0],
        tags,
        note: entry.response
          ? `[${group.name}] ${entry.response.slice(0, 300)}...`
          : `[${group.name}]`,
        platform: 'claude',
        createdAt: entry.timestamp || new Date().toISOString()
      });

      imported++;
    }

    totalImported += imported;
    totalSkipped += skipped;
    projectIds.push(proj.id);
  }

  return {
    imported: totalImported,
    skipped: totalSkipped,
    projectCount: projectIds.length,
    projectIds
  };
}

// ----------------------------------------------------------------
// 5. Stats preview
// ----------------------------------------------------------------

export function previewStats(entries) {
  const total = entries.length;
  const withResponse = entries.filter(e => e.response).length;
  const avgLength = total > 0
    ? Math.round(entries.reduce((s, e) => s + e.prompt.length, 0) / total)
    : 0;
  const dateRange = total > 0
    ? {
        from: entries.reduce((min, e) => e.timestamp < min ? e.timestamp : min, entries[0].timestamp),
        to: entries.reduce((max, e) => e.timestamp > max ? e.timestamp : max, entries[0].timestamp)
      }
    : null;
  const shortPrompts = entries.filter(e => e.prompt.length < 10).length;

  return { total, withResponse, avgLength, dateRange, shortPrompts };
}

/**
 * Preview stats for grouped conversations.
 */
export function previewGroupedStats(groups) {
  const totalConversations = groups.length;
  const totalPrompts = groups.reduce((s, g) => s + g.promptCount, 0);
  const named = groups.filter(g => g.name && g.name !== 'Untitled').length;
  const dateRange = totalConversations > 0
    ? {
        from: groups.reduce((min, g) => g.createdAt && g.createdAt < min ? g.createdAt : min, groups[0].createdAt || ''),
        to: groups.reduce((max, g) => g.createdAt && g.createdAt > max ? g.createdAt : max, groups[0].createdAt || '')
      }
    : null;
  const avgPromptsPerConv = totalConversations > 0
    ? Math.round(totalPrompts / totalConversations * 10) / 10
    : 0;

  return { totalConversations, totalPrompts, named, dateRange, avgPromptsPerConv };
}
