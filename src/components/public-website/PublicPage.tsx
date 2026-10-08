import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { publicSite, type PublicPageId } from '@/content/public-site';
import { publicSiteRoutes } from '@/config/public-site-routing';
import '@/styles/public-site.css';

export default function PublicPage({ id }: { id: PublicPageId }) {
  const page = publicSite.pages[id];
  return (
    <main id="main" tabIndex={-1} className="jy-public-page jy-inner jy-section">
      <header className="jy-public-intro">
        <p className="jy-eyebrow">{page.eyebrow}</p>
        <h1>{page.title}</h1>
        <p>{page.intro}</p>
      </header>
      <div className="jy-public-sections">
        {page.sections.map(section => (
          <section key={section.title} className="jy-public-section">
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>
      <aside className="jy-public-next" aria-label={publicSite.learnLabel}>
        <Link className="jy-button" to={publicSiteRoutes[page.related]}>
          {page.actionLabel}<ArrowUpRight aria-hidden="true" size={20} />
        </Link>
        <p>{publicSite.status}</p>
      </aside>
    </main>
  );
}
