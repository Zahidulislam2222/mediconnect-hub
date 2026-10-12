import { createElement, type ReactNode } from 'react';
import type { CmsNode } from '@/lib/cms-content';
import { CmsImage } from '@/components/CmsImage';

function renderNode(node: CmsNode, key: string): ReactNode {
  if (node.type === 'text') {
    let value: ReactNode = node.text;
    if (node.code) value = <code>{value}</code>;
    if (node.bold) value = <strong>{value}</strong>;
    if (node.italic) value = <em>{value}</em>;
    if (node.underline) value = <u>{value}</u>;
    if (node.strikethrough) value = <s>{value}</s>;
    return <span key={key}>{value}</span>;
  }
  const children = node.children?.map((child, index) => renderNode(child, key + '-' + index));
  switch (node.type) {
    case 'paragraph': return <p key={key}>{children}</p>;
    case 'heading': return createElement('h' + (node.level ?? 2), { key }, children);
    case 'list': return node.format === 'ordered' ? <ol key={key}>{children}</ol> : <ul key={key}>{children}</ul>;
    case 'list-item': return <li key={key}>{children}</li>;
    case 'quote': return <blockquote key={key}>{children}</blockquote>;
    case 'code': return <pre key={key}><code>{children}</code></pre>;
    case 'link': return <a key={key} href={node.url} rel="noopener noreferrer">{children}</a>;
    case 'image': return node.image?.url ? <CmsImage key={key} src={node.image.url} alt={node.image.alternativeText ?? ''} /> : null;
    default: return null;
  }
}

export function CmsBlocks({ content }: { content: CmsNode[] }) {
  return <>{content.map((node, index) => renderNode(node, String(index)))}</>;
}
