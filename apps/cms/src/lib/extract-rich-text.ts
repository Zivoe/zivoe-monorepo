type RichTextNode = {
  type?: string;
  text?: string;
  children?: Array<RichTextNode>;
};

type RichTextDocument = {
  root?: {
    children?: Array<RichTextNode>;
  };
};

export function extractPlainTextFromRichText(document: unknown): string {
  if (!isRichTextDocument(document)) return '';

  const parts: Array<string> = [];
  walk(document.root?.children, parts);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function walk(nodes: Array<RichTextNode> | undefined, parts: Array<string>) {
  if (!nodes) return;

  for (const node of nodes) {
    if (typeof node.text === 'string' && node.text.length > 0) {
      parts.push(node.text);
    }
    if (node.children) walk(node.children, parts);
  }
}

function isRichTextDocument(value: unknown): value is RichTextDocument {
  return typeof value === 'object' && value !== null && 'root' in value;
}
