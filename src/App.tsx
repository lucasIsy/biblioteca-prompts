import { Header } from "./ui/Header";
import { PromptViewer } from "./ui/PromptViewer";
import { CategoryPage } from "./pages/CategoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { PromptForm } from "./ui/PromptForm";
import { useHashRoute } from "./hooks/useHashRoute";
import { useLibrary } from "./hooks/useLibrary";
import { useEffect, useState } from "react";
import { UNCATEGORIZED_SLUG } from "./domain/routes";
import { layoutFor } from "./domain/layout";
import type { Category } from "./data/repository";

// Galeria ocupa exatamente a janela (o carrossel mede o que sobra); grade rola normalmente.
const pageClass = (category: Category | null) => (layoutFor(category) === "gallery" ? "app is-gallery" : "app");

export default function App() {
  const route = useHashRoute();
  const { data, error, reload } = useLibrary();
  // Ao fechar o visualizador a galeria reaparece antes da troca de rota (ver PromptViewer.close).
  const [uncovered, setUncovered] = useState(false);
  useEffect(() => { setUncovered(false); }, [route]);

  if (error) return <p className="loading">Não foi possível abrir a biblioteca: {error}</p>;
  if (!data) return <p className="loading">Carregando…</p>;

  const { categories, prompts } = data;
  const showUncategorized = prompts.some((p) => p.categoryId === null);

  if (route?.name === "prompt") {
    const prompt = prompts.find((p) => p.id === route.id);
    if (prompt) {
      const category = categories.find((c) => c.id === prompt.categoryId) ?? null;
      // A galeria da categoria fica montada por baixo: a mídia voa da carta e volta para ela.
      return (
        <div className={`${pageClass(category)} has-viewer${uncovered ? "" : " is-covered"}`}>
          <Header categories={categories} activeSlug={category?.slug ?? UNCATEGORIZED_SLUG} showUncategorized={showUncategorized} newPromptSlug={category?.slug ?? null} />
          <CategoryPage library={data} category={category} focusId={prompt.id} covered />
          <PromptViewer
            key={prompt.id} prompt={prompt} category={category} categories={categories}
            subcategories={data.subcategories} showUncategorized={showUncategorized} onDeleted={reload}
            onUncover={() => setUncovered(true)}
          />
        </div>
      );
    }
  }

  if (route?.name === "edit" || route?.name === "new") {
    const prompt = route.name === "edit" ? prompts.find((p) => p.id === route.id) ?? null : null;
    if (route.name === "new" || prompt) {
      const initial = route.name === "new"
        ? categories.find((c) => c.slug === route.categorySlug)?.id ?? (route.categorySlug ? null : categories[0]?.id ?? null)
        : null;
      return (
        <div className="app">
          <PromptForm key={prompt?.id ?? "new"} library={data} prompt={prompt} initialCategoryId={initial} onSaved={reload} />
        </div>
      );
    }
  }

  if (route?.name === "settings") {
    return (
      <div className="app">
        <Header categories={categories} activeSlug={null} showUncategorized={showUncategorized} settingsActive />
        <SettingsPage library={data} onChanged={reload} initialCategorySlug={route.categorySlug} />
      </div>
    );
  }

  const category =
    route?.name === "uncategorized" ? null
    : route?.name === "category" ? categories.find((c) => c.slug === route.slug) ?? categories[0]
    : categories[0];
  const activeSlug = category ? category.slug : "sem-categoria";

  return (
    <div className={pageClass(category ?? null)}>
      <Header categories={categories} activeSlug={activeSlug} showUncategorized={showUncategorized} newPromptSlug={category?.slug ?? null} />
      <CategoryPage library={data} category={category ?? null} />
    </div>
  );
}
