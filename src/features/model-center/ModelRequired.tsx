import { useRef, useState } from 'react';
import { FolderUp, PackageOpen } from 'lucide-react';
import { useNotify } from '../../app/AppProvider';
import { Button, EmptyState } from '../../components/common/ui';
import { REQUIRED_FILES, type ModelEntry } from '../../services/models/catalog';
import { hfBase, importHfFolder } from '../../services/models/store';

export function ModelRequired({ model }: { model: ModelEntry }) {
  const notify = useNotify();
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const onFolder = async (list: FileList | null) => {
    if (!list?.length) return;
    setErr(''); setBusy(true);
    try { const n = await importHfFolder(model.id, Array.from(list)); notify('Model imported', `${n} files stored for ${model.label}.`, 'ok'); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  return (
    <EmptyState icon={<PackageOpen size={22} />} title={`${model.label} is not installed`}>
      <p>This feature runs a real model locally, so it stays unavailable until the model files are supplied. Nothing is downloaded automatically and no answer is invented.</p>
      <p>Expected location: <span className="font-mono text-fg">public/{hfBase(model.id)}</span><br />or import the model folder below (stored in Cache Storage).</p>
      <ul className="mx-auto max-w-sm list-disc space-y-0.5 pl-4 text-left text-[11px]">{REQUIRED_FILES.map((f) => <li key={f}>{f}</li>)}</ul>
      <input ref={input} type="file" hidden multiple onChange={(e) => void onFolder(e.target.files)} {...({ webkitdirectory: '' } as Record<string, string>)} />
      <Button variant="primary" disabled={busy} onClick={() => input.current?.click()}><FolderUp size={13} />{busy ? 'Importing…' : 'Import model folder'}</Button>
      <p className="text-[11px]">Pick the folder whose top level holds <span className="font-mono">config.json</span> (e.g. a clone of <span className="font-mono">{model.id}</span>).</p>
      {err && <p className="text-red-400">{err}</p>}
    </EmptyState>
  );
}
