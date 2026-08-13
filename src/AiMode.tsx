import { useEffect, useState } from 'react';
import { getAiStatus, runAi, type AiStatus } from './lib/aiClient';
import './ai-mode.css';

type Props = { app: string; payload: unknown; label?: string };

export default function AiMode({ app, payload, label = 'Enhance with AI' }: Props) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getAiStatus(controller.signal).then(setStatus).catch(() => setStatus(null)).finally(() => setChecking(false));
    return () => controller.abort();
  }, []);

  async function generate() {
    setRunning(true); setError('');
    try {
      const result = await runAi(app, payload);
      setOutput(result.text);
      setStatus((current) => current ? { ...current, configured: true, model: result.model } : { configured: true, model: result.model, app });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'AI request failed.');
    } finally { setRunning(false); }
  }

  async function copy() {
    await navigator.clipboard.writeText(output);
    setCopied(true); window.setTimeout(() => setCopied(false), 1600);
  }

  const ready = Boolean(status?.configured);
  return <section className="ai-mode-card" data-app={app} aria-label="Optional AI mode">
    <div className="ai-mode-intro">
      <span className={`ai-mode-dot ${ready ? 'is-ready' : ''}`} aria-hidden="true" />
      <div><p>Bring your own API</p><h2>Demo engine + optional AI</h2><small>{checking ? 'Checking the local server…' : ready ? `Private server ready · ${status?.model}` : 'Demo mode active · add your key in .env to unlock AI'}</small></div>
    </div>
    <button className="ai-mode-run" type="button" onClick={() => void generate()} disabled={!ready || running}>{running ? 'Thinking…' : label}</button>
    {!ready && !checking && <p className="ai-mode-help">Downloaded copy? Run <code>npm install</code>, copy <code>.env.example</code> to <code>.env</code>, add <code>AI_API_KEY</code>, then use <code>npm run dev</code>.</p>}
    {error && <p className="ai-mode-error" role="alert">{error}</p>}
    {output && <article className="ai-mode-output"><header><span>AI enhancement · review before use</span><button type="button" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy'}</button></header><pre>{output}</pre></article>}
  </section>;
}
