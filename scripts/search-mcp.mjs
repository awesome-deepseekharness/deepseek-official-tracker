// The hosted Exa MCP is keyless; the Exa REST API is not. Keep this transport
// independent of the LLM so scheduled collection still works during outages.
export function decodeMcp(body) {
  const frames = body.trim().startsWith('{') ? [body] : body.split(/\r?\n\r?\n/)
    .map(frame => frame.split(/\r?\n/).filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart()).join('\n')).filter(Boolean);
  for (const frame of frames) {
    const message = JSON.parse(frame);
    if (message.error) throw new Error(message.error.message || 'MCP request failed');
    if (message.result) return message.result;
  }
  throw new Error('MCP response contained no result');
}

export async function searchExa(query, { since, numResults = 6 } = {}) {
  const response = await fetch('https://mcp.exa.ai/mcp?tools=web_search_advanced_exa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: {
      name: 'web_search_advanced_exa', arguments: {
        query, numResults, startPublishedDate: since, textMaxCharacters: 600,
      },
    } }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`Exa MCP HTTP ${response.status}`);
  const result = decodeMcp(await response.text());
  if (result.isError) throw new Error(result.content?.find(c => c.type === 'text')?.text || 'Exa tool failed');
  const data = result.structuredContent || JSON.parse(result.content.find(c => c.type === 'text').text);
  if (!Array.isArray(data.results)) throw new Error('Exa returned no structured search results');
  return data.results;
}
