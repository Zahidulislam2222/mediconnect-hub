import { Link } from 'react-router-dom';
import { legalContent } from '@/content/legal';

export function LegalPage({ page }: { page: keyof typeof legalContent.pages }) {
  const content = legalContent.pages[page];
  return <div className="min-h-screen bg-background text-foreground">
    <nav className="border-b border-border px-6 py-4 flex items-center justify-between">
      <Link to="/" className="font-display font-bold">{legalContent.brand}</Link>
      <Link to="/" className="text-primary underline">{legalContent.backLabel}</Link>
    </nav>
    <main className="max-w-4xl mx-auto px-6 py-12 space-y-8">
      <h1 className="text-3xl font-display font-bold">{content.title}</h1>
      <time dateTime={legalContent.updated} className="text-muted-foreground">{legalContent.updated}</time>
      <p className="border border-border rounded-xl bg-secondary p-5">{legalContent.notice}</p>
      {content.sections.map(section => <section key={section.title} className="space-y-3">
        <h2 className="text-xl font-semibold">{section.title}</h2>
        <p className="text-muted-foreground leading-relaxed">{section.body}</p>
      </section>)}
      <ul className="space-y-2">{content.sources.map(source => <li key={source.url}>
        <a href={source.url} className="text-primary underline" rel="noreferrer" target="_blank">{source.label}</a>
      </li>)}</ul>
    </main>
  </div>;
}
