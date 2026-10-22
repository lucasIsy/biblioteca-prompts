import type { Category } from "../data/repository";
import { SETTINGS_HREF, UNCATEGORIZED_SLUG, categoryHref, newPromptHref } from "../domain/routes";

interface Props {
  categories: Category[];
  /** slug ativo; `null` = nenhum (detalhe sem categoria destacada) */
  activeSlug: string | null;
  showUncategorized: boolean;
  /** no detalhe o header vai para a metade direita */
  compact?: boolean;
  /** categoria atual, para pré-selecionar no "+" */
  newPromptSlug?: string | null;
  settingsActive?: boolean;
}

export function Logo() {
  return (
    <a href="#/" className="logo">
      Biblioteca<i aria-hidden="true" />
    </a>
  );
}

export function CategoryNav({ categories, activeSlug, showUncategorized }: Omit<Props, "compact">) {
  const items = [
    ...categories.map((c) => ({ key: c.id, slug: c.slug, name: c.name })),
    ...(showUncategorized ? [{ key: "none", slug: UNCATEGORIZED_SLUG, name: "Sem categoria" }] : []),
  ];
  return (
    <nav className="nav" aria-label="Categorias">
      {items.map((i) => (
        <a key={i.key} href={categoryHref(i.slug)} className="hnav" aria-current={i.slug === activeSlug ? "page" : undefined}>
          {i.name}
        </a>
      ))}
    </nav>
  );
}

export function Header({ newPromptSlug, settingsActive, ...props }: Props) {
  return (
    <header className="header">
      <Logo />
      <div className="nav">
        <CategoryNav {...props} />
        <span className="sep" aria-hidden="true" />
        <div className="icons">
          <a href={newPromptHref(newPromptSlug)} className="hico" aria-label="Novo prompt">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </a>
          <a href={SETTINGS_HREF} className="hico" aria-label="Configurações" aria-current={settingsActive ? "page" : undefined}
            style={settingsActive ? { color: "#fff" } : undefined}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
          </a>
        </div>
      </div>
    </header>
  );
}
