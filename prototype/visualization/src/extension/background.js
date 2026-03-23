// ============================================================
// PromptLens v0.2 — Background Service Worker
// Handles Claude API calls + Side Panel toggle
// ============================================================

// --- Side Panel toggle on extension icon click ---
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

chrome.action.onClicked.addListener(async (tab) => {
  // If popup is defined, this won't fire. But if we remove popup:
  await chrome.sidePanel.open({ tabId: tab.id });
});

// --- Message handler ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CLAUDE_API_CALL') {
    handleClaudeApiCall(message.payload)
      .then(data => sendResponse({ data }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    chrome.sidePanel.open({ tabId: message.tabId });
    sendResponse({ ok: true });
    return false;
  }
});

async function handleClaudeApiCall({ apiKey, model, systemPrompt, userMessage }) {
  const requestBody = {
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userMessage }
    ]
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  return await response.json();
}
