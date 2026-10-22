import { useEffect } from "react";
import type { Category, DeleteStrategy } from "../data/repository";

interface Props {
  category: Category;
  promptCount: number;
  onChoose: (strategy: DeleteStrategy) => void;
  onCancel: () => void;
}

/** Pergunta o destino dos prompts ao excluir uma categoria (apagar · mover para Sem categoria · cancelar). */
export function DeleteCategoryDialog({ category, promptCount, onChoose, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const empty = promptCount === 0;
  return (
    <div className="modal-back" onClick={onCancel}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="dlg-title">Excluir “{category.name}”?</h2>
        <p>
          {empty
            ? "A categoria está vazia. As subcategorias dela também serão excluídas."
            : `A categoria tem ${promptCount} ${promptCount === 1 ? "prompt" : "prompts"}. O que fazer com eles? As subcategorias da categoria serão excluídas.`}
        </p>
        <div className="modal-actions">
          {empty ? (
            <button type="button" className="btn-danger" onClick={() => onChoose("block")}>Excluir categoria</button>
          ) : (
            <>
              <button type="button" className="btn-danger" onClick={() => onChoose("delete-items")}>Apagar os prompts</button>
              <button type="button" className="btn-primary" onClick={() => onChoose("move")}>Mover para Sem categoria</button>
            </>
          )}
          <button type="button" className="cancel" onClick={onCancel} autoFocus>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
