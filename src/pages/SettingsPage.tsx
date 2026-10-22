import { useEffect, useState } from "react";
import type { Category, DeleteStrategy } from "../data/repository";
import { deleteFiles, libraryPath } from "../data/media";
import { foldersOfMedia } from "../domain/media";
import { getRepository } from "../hooks/useLibrary";
import type { Library } from "../hooks/useLibrary";
import { BackupSettings } from "../ui/BackupSettings";
import { CategorySettings } from "../ui/CategorySettings";
import { DeleteCategoryDialog } from "../ui/DeleteCategoryDialog";

interface Props {
  library: Library;
  onChanged: () => Promise<void>;
}

/** Configurações: categorias (CRUD + exclusão com diálogo) e subcategorias por categoria. */
export function SettingsPage({ library, onChanged }: Props) {
  const { categories, subcategories, prompts } = library;
  const [subCategoryId, setSubCategoryId] = useState<number | null>(categories[0]?.id ?? null);
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [folder, setFolder] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void libraryPath().then(setFolder).catch(() => {}); }, []);
  useEffect(() => {
    if (!categories.some((c) => c.id === subCategoryId)) setSubCategoryId(categories[0]?.id ?? null);
  }, [categories, subCategoryId]);

  const repo = getRepository;
  const subs = subcategories.filter((s) => s.categoryId === subCategoryId);

  const confirmDelete = async (strategy: DeleteStrategy) => {
    const cat = toDelete;
    if (!cat) return;
    setToDelete(null);
    setError(null);
    try {
      const r = await repo();
      // Ler os caminhos antes: depois do delete o banco não sabe mais quais pastas existiam.
      const medias = strategy === "delete-items" ? await r.listMediaOfCategory(cat.id) : [];
      await r.deleteCategory(cat.id, strategy);
      await deleteFiles(foldersOfMedia(medias));
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="settings">
      <section>
        <h1 className="title">Configurações</h1>
        <p className="settings-sub">Categorias aparecem no topo; subcategorias são as etiquetas e filtros de cada uma.</p>
      </section>

      <section>
        <h2 className="settings-h">Categorias</h2>
        <CategorySettings
          items={categories.map((c) => ({
            id: c.id, name: c.name, locked: c.isSystem,
            count: prompts.filter((p) => p.categoryId === c.id).length,
          }))}
          addLabel="Nova categoria"
          onAdd={async (name) => { await (await repo()).createCategory(name); await onChanged(); }}
          onRename={async (id, name) => { await (await repo()).renameCategory(id, name); await onChanged(); }}
          onDelete={(id) => setToDelete(categories.find((c) => c.id === id) ?? null)}
        />
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>

      <section>
        <h2 className="settings-h">Subcategorias</h2>
        <div role="tablist" aria-label="Categoria" className="opts center">
          {categories.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={c.id === subCategoryId} className="opt"
              onClick={() => setSubCategoryId(c.id)}>{c.name}</button>
          ))}
        </div>
        {subCategoryId !== null && (
          <CategorySettings
            items={subs.map((s) => ({
              id: s.id, name: s.name,
              count: prompts.filter((p) => p.subcategoryIds.includes(s.id)).length,
            }))}
            addLabel="Nova subcategoria"
            onAdd={async (name) => { await (await repo()).createSubcategory(subCategoryId, name); await onChanged(); }}
            onRename={async (id, name) => { await (await repo()).renameSubcategory(id, name); await onChanged(); }}
            onDelete={(id) => { void repo().then((r) => r.deleteSubcategory(id)).then(onChanged); }}
          />
        )}
      </section>

      <section>
        <h2 className="settings-h">Backup</h2>
        <BackupSettings library={library} onChanged={onChanged} />
      </section>

      <dl className="meta">
        <div><dt>Pasta da biblioteca</dt><dd>{folder || "—"}</dd></div>
        <div><dt>Previews salvos</dt><dd>Lembrados ao reabrir</dd></div>
      </dl>

      {toDelete && (
        <DeleteCategoryDialog
          category={toDelete}
          promptCount={prompts.filter((p) => p.categoryId === toDelete.id).length}
          onChoose={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
