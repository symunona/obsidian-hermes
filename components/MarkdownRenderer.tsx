import React from 'react';
import { marked } from 'marked';
import DocumentLink from './DocumentLink';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  // Parse the markdown content and extract links
  const processedContent = React.useMemo(() => {
    if (!content) return [];

    const tokens = marked.lexer(content);
    const elements: React.ReactNode[] = [];

    const processTokens = (tokens: any[], keyPrefix: string = '0'): React.ReactNode[] => {
      const result: React.ReactNode[] = [];
      
      tokens.forEach((token, index) => {
        const key = `${keyPrefix}-${index}`;
        
        switch (token.type) {
          case 'paragraph':
            result.push(
              <p key={key} className="mb-4">
                {processTokens(token.tokens, key)}
              </p>
            );
            break;
            
          case 'text':
            result.push(<React.Fragment key={key}>{token.text}</React.Fragment>);
            break;
            
          case 'link':
            const isFileLink = token.href && !token.href.startsWith('http') && !token.href.startsWith('#') && !token.href.startsWith('mailto:');
            
            if (isFileLink) {
              result.push(
                <DocumentLink key={key} href={token.href}>
                  {token.text || token.href}
                </DocumentLink>
              );
            } else {
              result.push(
                <a 
                  key={key}
                  href={token.href}
                  target={token.href.startsWith('http') ? '_blank' : undefined}
                  rel={token.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="hermes-text-accent hover:hermes-text-accent/80 transition-colors"
                >
                  {token.text || token.href}
                </a>
              );
            }
            break;
            
          case 'strong':
            result.push(
              <strong key={key} className="font-bold">
                {processTokens(token.tokens, key)}
              </strong>
            );
            break;
            
          case 'em':
            result.push(
              <em key={key} className="italic">
                {processTokens(token.tokens, key)}
              </em>
            );
            break;
            
          case 'code':
            result.push(
              <code key={key} className="hermes-bg-tertiary px-1 rounded">
                {token.text}
              </code>
            );
            break;
            
          case 'codespan':
            result.push(
              <code key={key} className="hermes-bg-tertiary px-1 rounded">
                {token.text}
              </code>
            );
            break;
            
          case 'heading':
            const Tag = `h${token.depth}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
            result.push(
              React.createElement(Tag, {
                key: key,
                className: "hermes-text-accent font-bold mb-2 mt-4"
              }, ...processTokens(token.tokens, key))
            );
            break;
            
          case 'list':
            const ListTag = token.ordered ? 'ol' : 'ul';
            result.push(
              React.createElement(ListTag, {
                key: key,
                className: token.ordered ? "list-decimal list-inside mb-4" : "list-disc list-inside mb-4"
              }, ...token.items.map((item: any, itemIndex: number) =>
                React.createElement('li', {
                  key: `${key}-${itemIndex}`,
                  className: "mb-1"
                }, ...processTokens(item.tokens, `${key}-${itemIndex}`))
              ))
            );
            break;
            
          case 'blockquote':
            result.push(
              <blockquote key={key} className="border-l-4 border-hermes-border/50 pl-4 italic hermes-text-muted mb-4">
                {processTokens(token.tokens, key)}
              </blockquote>
            );
            break;
            
          case 'hr':
            result.push(<hr key={key} className="hermes-border/50 my-4" />);
            break;
            
          default:
            // For any token types we haven't handled, try to render as text
            if (token.text) {
              result.push(<React.Fragment key={key}>{token.text}</React.Fragment>);
            }
            break;
        }
      });
      
      return result;
    };

    return processTokens(tokens);
  }, [content]);

  return (
    <div className={`prose prose-invert prose-sm max-w-none prose-headings:hermes-text-accent prose-code:hermes-bg-tertiary prose-code:px-1 prose-code:rounded prose-pre:hermes-bg-tertiary prose-pre:hermes-border prose-pre:hermes-border/10 font-sans leading-relaxed hermes-text-normal ${className}`}
         style={{ userSelect: 'text', WebkitUserSelect: 'text', MozUserSelect: 'text', msUserSelect: 'text' }}>
      {processedContent}
    </div>
  );
};

export default MarkdownRenderer;
