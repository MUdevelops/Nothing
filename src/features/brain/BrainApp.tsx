import { useMemo, useState } from 'react';
import { Download, Loader2, Play, Trash2 } from 'lucide-react';
import { Badge, Button, Field, Panel, ProgressBar, Segmented, Select, Slider } from '../../components/common/ui';
import { downloadText } from '../../lib/format';
import { ai, type Progress } from '../../services/local-ai/client';
import { byTask, type HfTask } from '../../services/models/catalog';
import { useInstalled } from '../../services/models/useInstalled';
import { ModelRequired } from '../model-center/ModelRequired';

type TaskId = 'generate' | 'summarize' | 'sentiment' | 'classify' | 'rewrite' | 'qa';
const TASKS: { id: TaskId; label: string; hf: HfTask; placeholder: string }[] = [
  { id: 'generate', label: 'Generate', hf: 'text-generation', placeholder: 'Start a sentence and the local model continues it…' },
  { id: 'summarize', label: 'Summarize', hf: 'summarization', placeholder: 'Paste a long text to summarize…' },
  { id: 'sentiment', label: 'Sentiment', hf: 'text-classification', placeholder: 'Text to classify as positive / negative…' },
  { id: 'classify', label: 'Classify', hf: 'zero-shot-classification', placeholder: 'Text to classify into your own labels…' },
  { id: 'rewrite', label: 'Rewrite', hf: 'text2text-generation', placeholder: 'Text to rewrite…' },
  { id: 'qa', label: 'Q&A', hf: 'question-answering', placeholder: 'Context passage the answer must come from…' },
];
interface Entry { id: number; task: TaskId; model: string; input: string; output: string; ms: number; backend: string }

function format(task: TaskId, r: unknown): string {
  const first = (Array.isArray(r) ? r[0] : r) as Record<string, unknown>;
  switch (task) {
    case 'generate': case 'rewrite': return String(first.generated_text ?? '');
    case 'summarize': return String(first.summary_text ?? '');
    case 'sentiment': return `${String(first.label)} (${(Number(first.score) * 100).toFixed(1)}%)`;
    case 'classify': { const l = first.labels as string[], s = first.scores as number[]; return l.map((x, i) => `${x}: ${(s[i] * 100).toFixed(1)}%`).join('\n'); }
    case 'qa': return `${String(first.answer)}  (${(Number(first.score) * 100).toFixed(1)}%)`;
  }
}

export default function BrainApp() {
  const [task, setTask] = useState<TaskId>('generate');
  const def = TASKS.find((t) => t.id === task)!;
  const { installed, checking } = useInstalled();
  const models = useMemo(() => byTask(def.hf), [def.hf]);
  const [modelId, setModelId] = useState<Record<string, string>>({});
  const model = models.find((m) => m.id === modelId[task]) ?? models[0];
  const [text, setText] = useState(''); const [extra, setExtra] = useState('');
  const [maxTok, setMaxTok] = useState(64); const [temp, setTemp] = useState(0.7);
  const [busy, setBusy] = useState(false); const [prog, setProg] = useState<Progress | null>(null); const [err, setErr] = useState('');
  const [history, setHistory] = useState<Entry[]>([]);
  const ready = installed[model.id];
  const key = `${def.hf}|${model.id}`; const loadedBackend = ai.loaded.get(key);

  const run = async () => {
    if (!text.trim() || busy) return;
    setBusy(true); setErr(''); setProg(null);
    try {
      let args: unknown[];
      switch (task) {
        case 'generate': args = [text, { max_new_tokens: maxTok, temperature: temp, do_sample: temp > 0 }]; break;
        case 'summarize': args = [text, { max_new_tokens: maxTok + 40 }]; break;
        case 'sentiment': args = [text]; break;
        case 'classify': { const labels = extra.split(',').map((s) => s.trim()).filter(Boolean); if (labels.length < 2) throw new Error('Enter at least two comma-separated labels.'); args = [text, labels]; break; }
        case 'rewrite': args = [`${extra.trim() || 'Rewrite the following text more clearly'}:\n\n${text}`, { max_new_tokens: maxTok + 60 }]; break;
        case 'qa': if (!extra.trim()) throw new Error('Enter a question.'); args = [extra, text]; break;
      }
      const r = await ai.run(def.hf, model.id, args, setProg);
      setHistory((h) => [{ id: Date.now(), task, model: model.id, input: text, output: format(task, r.result), ms: r.ms, backend: r.backend }, ...h]);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false); setProg(null);
  };

  const exportAll = (kind: 'json' | 'md') => {
    if (kind === 'json') downloadText(JSON.stringify(history, null, 2), 'local-brain-results.json', 'application/json');
    else downloadText(history.map((h) => `## ${h.task} — ${h.model}\n\n**Input**\n\n${h.input}\n\n**Output**\n\n${h.output}\n\n_${h.ms.toFixed(0)} ms on ${h.backend}_\n`).join('\n---\n\n'), 'local-brain-results.md', 'text/markdown');
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-auto p-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Local Brain</h1>
          <p className="mt-0.5 text-xs text-muted">Private, on-device text inference</p>
        </div>
        <Badge tone="accent">Nothing leaves this device</Badge>
      </header>
      <div className="max-w-full overflow-x-auto pb-1">
        <Segmented value={task} onChange={(t) => { setTask(t); setErr(''); }} options={TASKS.map((t) => ({ id: t.id, label: t.label }))} />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 xl:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          {!ready && !checking ? (
            <Panel className="min-h-[240px] flex-1 overflow-auto"><ModelRequired model={model} /></Panel>
          ) : (
            <Panel className="flex min-h-[260px] min-w-0 flex-1 flex-col gap-3 p-4">
              <div>
                <h2 className="text-sm font-medium">Your input</h2>
                <p className="mt-1 text-xs text-muted">{def.placeholder}</p>
              </div>
              {(task === 'classify' || task === 'qa' || task === 'rewrite') && (
                <Field label={task === 'classify' ? 'Candidate labels (comma-separated)' : task === 'qa' ? 'Question' : 'Instruction (optional)'}>
                  <input value={extra} onChange={(e) => setExtra(e.target.value)} className="min-h-10 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent" placeholder={task === 'classify' ? 'billing, bug report, feature request' : task === 'qa' ? 'Who wrote it?' : 'Rewrite in a formal tone'} />
                </Field>)}
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={def.placeholder} aria-label="Input text"
                className="min-h-[120px] w-full flex-1 resize-y rounded-lg border border-line bg-surface p-3 text-sm leading-relaxed outline-none transition focus:border-accent" />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" onClick={() => void run()} disabled={busy || !text.trim()}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}{busy ? 'Running locally…' : loadedBackend ? 'Run' : 'Load model & run'}</Button>
                {loadedBackend && <Badge tone="ok">loaded · {loadedBackend}</Badge>}
                {busy && prog && <span className="min-w-0 break-words font-mono text-[11px] text-muted">{prog.status}{prog.file ? ` ${prog.file.split('/').pop()}` : ''}{prog.progress != null ? ` ${prog.progress.toFixed(0)}%` : ''}</span>}
              </div>
              {busy && prog?.progress != null && <ProgressBar value={prog.progress / 100} />}
              {err && <p role="alert" className="break-words rounded-lg border border-red-500/40 bg-red-500/10 p-3 font-mono text-xs text-red-300">{err}</p>}
            </Panel>
          )}
        </div>
        <aside className="flex min-h-0 min-w-0 w-full shrink-0 flex-col gap-3 xl:w-80">
          <Panel className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Model</h2>
              <Badge tone={checking ? 'neutral' : !ready ? 'warn' : loadedBackend ? 'ok' : 'accent'}>
                {checking ? 'checking' : !ready ? 'not installed' : loadedBackend ? 'loaded' : 'ready to load'}
              </Badge>
            </div>
            <Field label="Model"><Select value={model.id} onChange={(e) => setModelId({ ...modelId, [task]: e.target.value })}>{models.map((m) => <option key={m.id} value={m.id}>{m.label}{installed[m.id] ? ' ✓' : ' (not installed)'}</option>)}</Select></Field>
            <p className="text-xs leading-relaxed text-muted">{model.note}</p>
            <p className="break-all font-mono text-[11px] text-fg">{model.id}</p>
            {loadedBackend && <div className="flex items-center justify-between gap-2 border-t border-line pt-3 text-xs"><span className="text-muted">Backend</span><span className="font-mono">{loadedBackend}</span></div>}
            {busy && prog && <div className="space-y-1.5 border-t border-line pt-3">
              <div className="flex items-center justify-between gap-2 text-xs"><span className="text-muted">{prog.status}</span>{prog.progress != null && <span className="font-mono text-muted">{prog.progress.toFixed(0)}%</span>}</div>
              {prog.progress != null && <ProgressBar value={prog.progress / 100} />}
              {prog.file && <p className="break-all font-mono text-[10px] text-muted">{prog.file.split('/').pop()}</p>}
            </div>}
            {(task === 'generate' || task === 'summarize' || task === 'rewrite') && <Slider label="Max new tokens" value={maxTok} min={16} max={256} step={8} onChange={setMaxTok} />}
            {task === 'generate' && <Slider label="Temperature" value={temp} min={0} max={1.5} step={0.1} onChange={setTemp} fmt={(v) => (v === 0 ? 'greedy' : v.toFixed(1))} />}
          </Panel>
          <Panel className="flex min-h-[220px] min-w-0 flex-1 flex-col p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="text-sm font-medium">Results</h2><p className="text-[11px] text-muted">{history.length} {history.length === 1 ? 'result' : 'results'}</p></div>
              <span className="flex flex-wrap gap-1"><Button variant="ghost" onClick={() => exportAll('json')} disabled={!history.length} aria-label="Export JSON"><Download size={12} />JSON</Button><Button variant="ghost" onClick={() => exportAll('md')} disabled={!history.length}>MD</Button><Button variant="ghost" onClick={() => setHistory([])} disabled={!history.length} aria-label="Clear results"><Trash2 size={12} /></Button></span>
            </div>
            <ul className="min-h-0 flex-1 space-y-2 overflow-auto">
              {history.map((h) => (
                <li key={h.id} className="min-w-0 rounded-lg border border-line bg-surface p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <Badge tone="accent">{h.task}</Badge>
                    <span className="font-mono text-[11px] text-muted">{h.ms.toFixed(0)} ms · {h.backend}</span>
                  </div>
                  <p className="mb-2 break-all font-mono text-[11px] text-muted">{h.model}</p>
                  <div className="rounded-md border border-line/70 bg-panel/70 p-3">
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">Output</div>
                    <div className="select-text break-words text-sm leading-7">
                      {h.task === 'sentiment' && h.output.match(/^(.+?) \(([\d.]+)%\)$/) ? (
                        <div className="space-y-2">
                          <Badge tone={h.output.toUpperCase().startsWith('POSITIVE') ? 'ok' : h.output.toUpperCase().startsWith('NEGATIVE') ? 'error' : 'neutral'}>{h.output.match(/^(.+?) \(([\d.]+)%\)$/)?.[1]}</Badge>
                          <div className="flex items-center justify-between gap-2 text-xs"><span className="text-muted">Confidence</span><span className="font-mono">{h.output.match(/^(.+?) \(([\d.]+)%\)$/)?.[2]}%</span></div>
                          <ProgressBar value={Number(h.output.match(/^(.+?) \(([\d.]+)%\)$/)?.[2]) / 100} />
                        </div>
                      ) : h.task === 'classify' && h.output ? (
                        <div className="space-y-3">
                          {h.output.split('\n').map((line, index) => {
                            const separator = line.lastIndexOf(': ');
                            const label = line.slice(0, separator);
                            const score = Number.parseFloat(line.slice(separator + 2));
                            return <div key={index} className="space-y-1">
                              <div className="flex items-center justify-between gap-2"><Badge>{label}</Badge><span className="shrink-0 font-mono text-xs text-muted">{score.toFixed(1)}%</span></div>
                              <ProgressBar value={score / 100} />
                            </div>;
                          })}
                        </div>
                      ) : h.task === 'qa' && h.output.match(/\s+\(([\d.]+)%\)$/) ? (
                        <div className="space-y-2">
                          <div className="rounded-md border border-accent/30 bg-accent/10 p-3 text-sm leading-relaxed">{h.output.replace(/\s+\([\d.]+%\)$/, '')}</div>
                          <div className="flex items-center justify-between gap-2 text-xs"><span className="text-muted">Answer confidence</span><span className="font-mono">{h.output.match(/\s+\(([\d.]+)%\)$/)?.[1]}%</span></div>
                          <ProgressBar value={Number(h.output.match(/\s+\(([\d.]+)%\)$/)?.[1]) / 100} />
                        </div>
                      ) : <div className="select-text whitespace-pre-wrap text-sm leading-7">{h.output || <span className="text-muted">(empty output)</span>}</div>}
                    </div>
                  </div>
                  <div className="mt-3 border-t border-line pt-2">
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">{h.task === 'qa' ? 'Context' : 'Input'}</div>
                    <p className="select-text whitespace-pre-wrap break-words text-xs leading-relaxed text-muted">
                      {h.task === 'qa' && h.output.match(/\s+\([\d.]+%\)$/) ? (() => {
                        const answer = h.output.replace(/\s+\([\d.]+%\)$/, '');
                        const index = h.input.indexOf(answer);
                        return answer && index >= 0 ? <>{h.input.slice(0, index)}<mark className="rounded bg-accent/20 px-0.5 text-fg">{answer}</mark>{h.input.slice(index + answer.length)}</> : h.input;
                      })() : h.input}
                    </p>
                  </div>
                </li>))}
              {!history.length && <li className="grid min-h-32 place-items-center rounded-lg border border-dashed border-line p-4 text-center text-xs leading-relaxed text-muted">Your locally generated outputs will appear here. Run a task to create the first result.</li>}
            </ul>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
