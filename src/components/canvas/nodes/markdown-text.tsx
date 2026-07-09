"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const P: Components["p"] = ({ children }) => (
  <p className="break-words leading-relaxed">{children}</p>
);

const Strong: Components["strong"] = ({ children }) => (
  <strong className="font-semibold">{children}</strong>
);

const Em: Components["em"] = ({ children }) => <em className="italic">{children}</em>;

const A: Components["a"] = ({ href, children }) => (
  <a href={href} target="_blank" rel="noreferrer" className="text-workflow-accent-600 underline">
    {children}
  </a>
);

const Ul: Components["ul"] = ({ children }) => (
  <ul className="ml-4 list-disc space-y-0.5">{children}</ul>
);

const Ol: Components["ol"] = ({ children }) => (
  <ol className="ml-4 list-decimal space-y-0.5">{children}</ol>
);

const Li: Components["li"] = ({ children }) => <li className="break-words">{children}</li>;

const H1: Components["h1"] = ({ children }) => (
  <div className="mt-1.5 text-base font-bold first:mt-0">{children}</div>
);
const H2: Components["h2"] = ({ children }) => (
  <div className="mt-1.5 text-sm font-bold first:mt-0">{children}</div>
);
const H3: Components["h3"] = ({ children }) => (
  <div className="mt-1.5 text-sm font-semibold first:mt-0">{children}</div>
);
const H4: Components["h4"] = ({ children }) => (
  <div className="mt-1.5 text-xs font-semibold first:mt-0">{children}</div>
);
const H5: Components["h5"] = ({ children }) => (
  <div className="mt-1.5 text-xs font-semibold first:mt-0">{children}</div>
);
const H6: Components["h6"] = ({ children }) => (
  <div className="mt-1.5 text-xs font-semibold first:mt-0">{children}</div>
);

const Blockquote: Components["blockquote"] = ({ children }) => (
  <blockquote className="border-l-2 border-gray-300 pl-2 italic text-gray-600">
    {children}
  </blockquote>
);

const Hr: Components["hr"] = () => <hr className="my-1.5 border-gray-200" />;

const Code: Components["code"] = ({ className, children }) => {
  const isBlock = /language-/.test(className ?? "");
  if (isBlock) {
    return (
      <pre className="my-1 overflow-x-auto rounded-lg bg-gray-900 p-2.5 text-[11px] text-gray-100">
        <code>{children}</code>
      </pre>
    );
  }
  return (
    <code className="rounded bg-gray-200 px-1 py-0.5 font-mono text-[11px]">{children}</code>
  );
};

const Pre: Components["pre"] = ({ children }) => <>{children}</>;

const Table: Components["table"] = ({ children }) => (
  <div className="overflow-x-auto">
    <table className="my-1 w-full border-collapse text-left text-[11px]">{children}</table>
  </div>
);

const Thead: Components["thead"] = ({ children }) => (
  <thead className="border-b border-gray-300">{children}</thead>
);

const Th: Components["th"] = ({ children }) => (
  <th className="px-1.5 py-1 font-semibold">{children}</th>
);

const Td: Components["td"] = ({ children }) => (
  <td className="border-t border-gray-100 px-1.5 py-1">{children}</td>
);

const components: Components = {
  p: P,
  strong: Strong,
  em: Em,
  a: A,
  ul: Ul,
  ol: Ol,
  li: Li,
  h1: H1,
  h2: H2,
  h3: H3,
  h4: H4,
  h5: H5,
  h6: H6,
  blockquote: Blockquote,
  hr: Hr,
  code: Code,
  pre: Pre,
  table: Table,
  thead: Thead,
  th: Th,
  td: Td,
};

export function MarkdownText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}