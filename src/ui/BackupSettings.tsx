import { useState } from "react";
import { backupFileName, exportLibrary, importLibrary } from "../data/backup";
import { backupFiles, pickArchivePath, pickExportPath, readArchive, writeArchive } from "../data/media";
import { getRepository } from "../hooks/useLibrary";
import type { Library } from "../hooks/useLibrary";

interface Props {
  library: Library;
  onChanged: () => Promise<void>;
}

const NONE = -1; // "Sem categoria"

/** Exportar prompts por categoria para .zip e importar um .zip (restaura em outra instalação). */
export function BackupSettings({ library, onChanged }: Props) {
  const { categories, prompts } = library;
  const [picked, setPicked] = useState<Set<number> | null>(null); // null = todas
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const options = [
    ...categories.map((c) => ({ id: c.id, name: c.name, count: prompts.filter((p) => p.categoryId === c.id).length })),
    { id: NONE, name: "Sem categoria", count: prompts.filter((p) => p.categoryId === null).length },
  ];
  const selected = picked ?? new Set(options.map((o) => o.id));
  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPicked(next);
  };

  const run = async (job: () => Promise<string | null>) => {
    setBusy(true); setError(null); setMessage(null);
    try {
      setMessage(await job());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doExport = () => run(async () => {
    const path = await pickExportPath(backupFileName(new Date()));
    if (!path) return null;
    const out = await exportLibrary(await getRepository(), backupFiles, {
      categoryIds: [...selected].filter((id) => id !== NONE),
      includeUncategorized: selected.has(NONE),
    });
    await writeArchive(path, out.files);
    return `${out.promptCount} prompt(s) exportado(s) para ${path}`;
  });

  const doImport = () => run(async () => {
    const path = await pickArchivePath();
    if (!path) return null;
    const r = await importLibrary(await getRepository(), backupFiles, await readArchive(path));
    await onChanged();
    const parts = [`${r.imported} importado(s)`, `${r.skipped} já existia(m)`];
    if (r.createdCategories) parts.push(`${r.createdCategories} categoria(s) criada(s)`);
    if (r.errors.length) throw new Error(`${parts.join(", ")}. Falhas: ${r.errors.join("; ")}`);
    return parts.join(", ");
  });

  return (
    <div>
      <p className="settings-sub">Escolha as categorias, exporte um .zip e importe-o depois (ou em outra instalação) para recuperar tudo.</p>
      <div role="group" aria-label="Categorias a exportar" className="opts center">
        {options.map((o) => (
          <button key={o.id} type="button" className="opt" aria-pressed={selected.has(o.id)} onClick={() => toggle(o.id)}>
            {o.name} ({o.count})
          </button>
        ))}
      </div>
      <div className="opts center">
        <button type="button" className="opt" disabled={busy || selected.size === 0} onClick={() => void doExport()}>Exportar .zip</button>
        <button type="button" className="opt" disabled={busy} onClick={() => void doImport()}>Importar .zip</button>
      </div>
      {busy && <p className="settings-sub">Trabalhando…</p>}
      {message && <p className="settings-sub" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
