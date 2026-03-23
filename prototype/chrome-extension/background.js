// ============================================================
// PromptLens BYOK — Background Service Worker
// Handles Claude API calls to avoid CORS issues from popup
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CLAUDE_API_CALL') {
    handleClaudeApiCall(message.payload)
      .then(data => sendResponse({ data }))
      .catch(err => sendResponse({ error: err.message }));
    // Return true to indicate async response
    return true;
  }
});

async function handleClaudeApiCall({ apiKey, model, systemPrompt, userMessage }) {
  const requestBody = {
    model,
    max_tokens: 1024,
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
