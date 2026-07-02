'use client';

import { useEffect } from 'react';

import {
  createClientFeature,
  slashMenuBasicGroupWithItems,
  toolbarTextDropdownGroupWithItems
} from '@payloadcms/richtext-lexical/client';
import type { BaseSelection, LexicalEditor, LexicalNode } from '@payloadcms/richtext-lexical/lexical';
import {
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $getState,
  $isParagraphNode,
  $isRangeSelection,
  $setState,
  ParagraphNode,
  createState
} from '@payloadcms/richtext-lexical/lexical';
import { useLexicalComposerContext } from '@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext';
import { $setBlocksType } from '@payloadcms/richtext-lexical/lexical/selection';

import {
  INSIGHTS_RICH_TEXT_PARAGRAPH_STYLES,
  type InsightsRichTextParagraphStyle
} from '@zivoe/cms-types/insights-rich-text';

type StyledParagraphStyle = Exclude<InsightsRichTextParagraphStyle, 'body'>;

const paragraphStyleState = createState('insightsParagraphStyle', {
  parse: (value) => (isStyledParagraphStyle(value) ? value : undefined)
});

const paragraphStyleOptions: Array<{
  keywords: Array<string>;
  label: string;
  style: StyledParagraphStyle;
}> = [
  {
    keywords: ['intro', 'lede', 'large', 'paragraph'],
    label: 'Lead',
    style: 'lead'
  },
  {
    keywords: ['small', 'aside', 'note'],
    label: 'Note',
    style: 'note'
  },
  {
    keywords: ['extra small', 'disclaimer', 'source', 'footnote'],
    label: 'Footnote',
    style: 'footnote'
  }
];

const editorPreviewStyles: Record<StyledParagraphStyle, Partial<CSSStyleDeclaration>> = {
  footnote: {
    fontSize: '0.75rem',
    lineHeight: '1rem'
  },
  lead: {
    fontSize: '1.125rem',
    lineHeight: '1.875rem'
  },
  note: {
    fontSize: '0.875rem',
    lineHeight: '1.5rem'
  }
};

const ParagraphStyleIcon = () => <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>T</span>;

export const ParagraphStyleFeatureClient = createClientFeature({
  plugins: [
    {
      Component: ParagraphStylePlugin,
      position: 'normal'
    }
  ],
  slashMenu: {
    groups: [
      slashMenuBasicGroupWithItems(
        paragraphStyleOptions.map(({ keywords, label, style }) => ({
          Icon: ParagraphStyleIcon,
          key: `paragraph-${style}`,
          keywords,
          label,
          onSelect: ({ editor }) => {
            setSelectedParagraphStyle(editor, style);
          }
        }))
      )
    ]
  },
  toolbarFixed: {
    groups: [
      toolbarTextDropdownGroupWithItems(
        paragraphStyleOptions.map(({ label, style }, index) => ({
          ChildComponent: ParagraphStyleIcon,
          isActive: ({ selection }) => isParagraphStyleActive(selection, style),
          key: `paragraph-${style}`,
          label,
          onSelect: ({ editor }) => {
            setSelectedParagraphStyle(editor, style);
          },
          order: index + 5
        }))
      )
    ]
  },
  toolbarInline: {
    groups: [
      toolbarTextDropdownGroupWithItems(
        paragraphStyleOptions.map(({ label, style }, index) => ({
          ChildComponent: ParagraphStyleIcon,
          isActive: ({ selection }) => isParagraphStyleActive(selection, style),
          key: `paragraph-${style}`,
          label,
          onSelect: ({ editor }) => {
            setSelectedParagraphStyle(editor, style);
          },
          order: index + 5
        }))
      )
    ]
  }
});

function ParagraphStylePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerMutationListener(ParagraphNode, (mutatedNodes) => {
      editor.getEditorState().read(() => {
        for (const [nodeKey, mutation] of mutatedNodes) {
          if (mutation === 'destroyed') continue;

          const node = $getNodeByKey(nodeKey);
          const dom = editor.getElementByKey(nodeKey);
          if (!node || !dom) continue;

          const paragraphStyle = readParagraphStyle(node);
          resetPreviewStyles(dom);

          if (!paragraphStyle) {
            delete dom.dataset.insightsParagraphStyle;
            continue;
          }

          dom.dataset.insightsParagraphStyle = paragraphStyle;
          Object.assign(dom.style, editorPreviewStyles[paragraphStyle]);
        }
      });
    });
  }, [editor]);

  return null;
}

function isStyledParagraphStyle(value: unknown): value is StyledParagraphStyle {
  return (
    typeof value === 'string' &&
    value !== 'body' &&
    INSIGHTS_RICH_TEXT_PARAGRAPH_STYLES.includes(value as InsightsRichTextParagraphStyle)
  );
}

function isParagraphStyleActive(selection: BaseSelection, style: StyledParagraphStyle) {
  if (!$isRangeSelection(selection)) return false;

  for (const node of selection.getNodes()) {
    const paragraphNode = getParagraphNode(node);
    if (!paragraphNode || readParagraphStyle(paragraphNode) !== style) return false;
  }

  return true;
}

function getParagraphNode(node: LexicalNode) {
  if ($isParagraphNode(node)) return node;

  const parent = node.getParent();
  return $isParagraphNode(parent) ? parent : null;
}

function readParagraphStyle(node: LexicalNode) {
  return $getState(node, paragraphStyleState);
}

function resetPreviewStyles(dom: HTMLElement) {
  dom.style.fontSize = '';
  dom.style.lineHeight = '';
}

function setSelectedParagraphStyle(editor: LexicalEditor, style: StyledParagraphStyle) {
  editor.update(() => {
    const selection = $getSelection();

    $setBlocksType(selection, () => {
      const paragraphNode = $createParagraphNode();
      $setState(paragraphNode, paragraphStyleState, style);
      return paragraphNode;
    });
  });
}
