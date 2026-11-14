import { useRef, useState } from 'react';
import { Download, FileUp, ScanLine } from 'lucide-react';
import { useNotify } from '../../app/AppProvider';
import { Button, EmptyState, ProgressBar } from '../../components/common/ui';
import { downloadHandModel, HAND_URL, importHandModel } from '../../services/models/store';
import { tracker } from '../../services/vision/tracker';

/** Shown whenever the MediaPipe hand model is missing. Nothing is downloaded unless the user presses the button. */
export function HandModelSetup() {
  const notify = useNotify();
  const input = useRef<HTMLInputElement>(null);
  const [prog, setProg] = useState<number | null>(null);
  const [err, setErr] = useState('');

  const after = () => { notify('Hand model installed', 'Stored in this browser’s Cache Storage.', 'ok'); tracker.retry(); };
  const onFile = async (f?: File) => {
    if (!f) return;
    setErr('');
    try { await importHandModel(f); after(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  const dl = async () => {
    setErr(''); setProg(0);
    try { await downloadHandModel(setProg); after(); } catch (e) { setErr(`${e instanceof Error ? e.message : String(e)} — you can also import the file manually.`); }
    setProg(null);
  };

  return (
    <EmptyState icon={<ScanLine size={22} />} title="Hand model not installed">
      <p>Real hand tracking needs the MediaPipe <span className="font-mono text-fg">hand_landmarker.task</span> model weights. No recognition is simulated without them.</p>
      <p>Place it at <span className="font-mono text-fg">public/models/hand_landmarker.task</span>, or import it here (kept in your browser’s Cache Storage).</p>
      <div className="flex flex-wrap justify-center gap-2">
        <input ref={input} type="file" accept=".task" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        <Button variant="primary" onClick={() => input.current?.click()}><FileUp size={13} />Import .task file</Button>
        <Button onClick={() => void dl()} disabled={prog !== null}><Download size={13} />Download official model</Button>
      </div>
      {prog !== null && <ProgressBar value={prog} />}
      <p className="text-[11px]">The download is a single static file of model weights from <span className="font-mono">storage.googleapis.com</span> — not an AI API. It only happens when you press the button.</p>
      <p className="select-all break-all font-mono text-[10px]">{HAND_URL}</p>
      {err && <p className="text-red-400">{err}</p>}
    </EmptyState>
  );
}
