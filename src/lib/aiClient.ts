export type AiStatus = { configured: boolean; model: string; app: string };
export type AiResult = { text: string; model: string };

async function readResponse<T>(response: Response): Promise<T> {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new Error('Local AI server is not running. Start the downloadable app with npm run dev.');
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `Request failed with HTTP ${response.status}.`);
  return data;
}

export async function getAiStatus(signal?: AbortSignal): Promise<AiStatus> {
  return readResponse<AiStatus>(await fetch('/api/status', { signal }));
}

export async function runAi(app: string, payload: unknown): Promise<AiResult> {
  return readResponse<AiResult>(await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app, payload }),
  }));
}
