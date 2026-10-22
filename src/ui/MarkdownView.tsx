import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Sem HTML bruto (sem rehype-raw): o markdown é dado do usuário. */
export function MarkdownView({ markdown }: { markdown: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
