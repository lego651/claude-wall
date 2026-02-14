"use client";

/**
 * Simple Markdown Renderer for Trading Reports
 * Preserves pre-formatted text (ASCII charts) and tables
 */
export default function MarkdownRenderer({ content }) {
  // Parse markdown and convert to React elements
  const parseMarkdown = (md) => {
    const lines = md.split('\n');
    const elements = [];
    let i = 0;
    let inCodeBlock = false;
    let codeContent = [];
    let inTable = false;
    let tableRows = [];

    while (i < lines.length) {
      const line = lines[i];

      // Code blocks (preserve exactly)
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={`code-${i}`} className="bg-base-300 p-4 rounded-lg overflow-x-auto my-4 font-mono text-sm whitespace-pre">
              {codeContent.join('\n')}
            </pre>
          );
          codeContent = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        i++;
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        i++;
        continue;
      }

      // Tables
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableRows = [];
        }
        // Skip separator lines
        if (!line.match(/^\|[\s-:|]+\|$/)) {
          const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
          tableRows.push(cells);
        }
        i++;
        continue;
      } else if (inTable) {
        // End of table
        const isHeader = tableRows.length > 0;
        elements.push(
          <div key={`table-${i}`} className="overflow-x-auto my-6">
            <table className="table table-sm md:table-md w-full">
              {isHeader && (
                <thead>
                  <tr className="bg-base-200">
                    {tableRows[0].map((cell, idx) => (
                      <th key={idx} className="font-bold text-base-content">
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {tableRows.slice(1).map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-base-200/50">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="text-base-content/90">
                        {parseInlineMarkdown(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        inTable = false;
        tableRows = [];
        continue;
      }

      // Horizontal rules
      if (line.match(/^---+$/)) {
        elements.push(<hr key={`hr-${i}`} className="my-8 border-base-content/10" />);
        i++;
        continue;
      }

      // Headers
      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={`h1-${i}`} className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 text-base-content">
            {line.substring(2)}
          </h1>
        );
        i++;
        continue;
      }
      if (line.startsWith('## ')) {
        elements.push(
          <h2 key={`h2-${i}`} className="text-2xl md:text-3xl font-bold tracking-tight mb-4 mt-8 text-base-content">
            {parseInlineMarkdown(line.substring(3))}
          </h2>
        );
        i++;
        continue;
      }
      if (line.startsWith('### ')) {
        elements.push(
          <h3 key={`h3-${i}`} className="text-xl md:text-2xl font-bold tracking-tight mb-3 mt-6 text-base-content">
            {parseInlineMarkdown(line.substring(4))}
          </h3>
        );
        i++;
        continue;
      }

      // Lists
      if (line.match(/^[-*]\s/)) {
        const listItems = [];
        while (i < lines.length && lines[i].match(/^[-*]\s/)) {
          listItems.push(lines[i].substring(2));
          i++;
        }
        elements.push(
          <ul key={`ul-${i}`} className="list-disc list-inside space-y-2 my-4 text-base-content/90">
            {listItems.map((item, idx) => (
              <li key={idx}>{parseInlineMarkdown(item)}</li>
            ))}
          </ul>
        );
        continue;
      }

      // Bold text paragraph (like **Period:**)
      if (line.startsWith('**') && !line.startsWith('###')) {
        elements.push(
          <p key={`p-${i}`} className="text-base-content/80 my-2">
            {parseInlineMarkdown(line)}
          </p>
        );
        i++;
        continue;
      }

      // Empty lines
      if (line.trim() === '') {
        i++;
        continue;
      }

      // Regular paragraphs
      elements.push(
        <p key={`p-${i}`} className="text-base-content/90 leading-relaxed my-3">
          {parseInlineMarkdown(line)}
        </p>
      );
      i++;
    }

    return elements;
  };

  // Parse inline markdown (bold, italic, code, emojis)
  const parseInlineMarkdown = (text) => {
    const parts = [];
    let current = '';
    let i = 0;

    while (i < text.length) {
      // Bold
      if (text.substring(i, i + 2) === '**') {
        if (current) parts.push(current);
        current = '';
        i += 2;
        let boldText = '';
        while (i < text.length && text.substring(i, i + 2) !== '**') {
          boldText += text[i];
          i++;
        }
        parts.push(<strong key={`bold-${i}`} className="font-bold text-base-content">{boldText}</strong>);
        i += 2;
        continue;
      }

      // Inline code
      if (text[i] === '`') {
        if (current) parts.push(current);
        current = '';
        i++;
        let codeText = '';
        while (i < text.length && text[i] !== '`') {
          codeText += text[i];
          i++;
        }
        parts.push(<code key={`code-${i}`} className="bg-base-300 px-2 py-0.5 rounded text-sm font-mono">{codeText}</code>);
        i++;
        continue;
      }

      current += text[i];
      i++;
    }

    if (current) parts.push(current);
    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
  };

  return (
    <div className="prose prose-lg max-w-none">
      {parseMarkdown(content)}
    </div>
  );
}
