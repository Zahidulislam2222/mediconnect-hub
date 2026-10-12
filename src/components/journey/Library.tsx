import { useJourneyRoutes } from './Routing';
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Search } from "lucide-react";
import { journey as c } from "@/content/journey";
import { fetchCmsArticles, fetchCmsArticle } from '@/lib/cms-content';
import { cmsContent } from '@/config/cms';
import { CmsBlocks } from '@/components/CmsBlocks';
import { CmsImage } from '@/components/CmsImage';

type EditorialArticle = Awaited<ReturnType<typeof fetchCmsArticle>>;
type LibraryRequest = { kind: 'knowledge' | 'blog'; slug?: string };

function editorialCard(article: EditorialArticle) {
  return { slug: article.id, title: article.title, summary: article.description,
    category: article.category, audience: cmsContent.sourceLabel, minutes: null,
    sections: [], cms: article };
}

export default function Library({ kind }: { kind: "knowledge" | "blog" }) {
  const routes = useJourneyRoutes();
  const { slug } = useParams();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(c.library.all);
  const copy = kind === "knowledge" ? c.library : c.journal;
  const [editorial, setEditorial] = useState<{ request: LibraryRequest; items: EditorialArticle[] }>();
  const [settled, setSettled] = useState<LibraryRequest>();
  const request = useMemo(() => ({ kind, slug }), [kind, slug]);
  const curated = c.articles.filter((item) => item.kind === kind);
  const curatedArticle = curated.find((item) => item.slug === slug);
  const cmsDetail = kind === 'knowledge' && !!slug?.startsWith(cmsContent.idPrefix) && !curatedArticle;
  useEffect(() => {
    if (kind !== 'knowledge' || (slug && !cmsDetail)) return;
    const controller = new AbortController();
    let active = true;
    const pending = cmsDetail ? fetchCmsArticle(slug!, controller.signal).then(item => [item])
      : fetchCmsArticles(controller.signal);
    pending.then(items => {
      if (active) setEditorial({ request, items });
    }).catch(() => { /* Curated guides remain available during CMS outages. */ })
      .finally(() => { if (active) setSettled(request); });
    return () => { active = false; controller.abort(); };
  }, [kind, slug, cmsDetail, request]);
  const cmsItems = editorial?.request === request ? editorial.items : [];
  const items = [...curated.map(item => ({ ...item, cms: undefined as EditorialArticle | undefined })),
    ...cmsItems.filter(item => !curated.some(guide => guide.slug === item.id)).map(editorialCard)];
  const article = items.find((item) => item.slug === slug);
  if (cmsDetail && settled !== request && !article)
    return <main id="main" tabIndex={-1} className="jy-section jy-inner" aria-busy="true"><p>{c.labels.loading}</p></main>;
  if (slug && !article)
    return (
      <main id="main" tabIndex={-1} className="jy-section jy-inner">
        <h1>{c.footer.notFound}</h1>
        <Link className="jy-text-link" to={routes[kind]}>
          {copy.back}
          <ArrowLeft />
        </Link>
      </main>
    );
  if (article)
    return (
      <main id="main" tabIndex={-1} className="jy-inner">
        <article className="jy-article">
          <Link to={routes[kind]} className="jy-text-link">
            <ArrowLeft size={20} />
            {copy.back}
          </Link>
          <p className="jy-eyebrow">
            {article.category} · {article.cms ? cmsContent.sourceLabel : `${article.minutes} ${c.labels.minutesRead}`}
          </p>
          <h1>{article.title}</h1>
          <p className="jy-article-lead">{article.summary}</p>
          <p className="jy-editorial-note">{copy.disclaimer}</p>
          {article.cms ? <>
            <p className="jy-eyebrow">{cmsContent.authorName} · {cmsContent.authorRole}</p>
            {!!article.cms.unavailableCoverCount && <p className="jy-editorial-note">{cmsContent.unavailableMediaLabel}</p>}
            {article.cms.coverImages.map(src => <CmsImage key={src} src={src} alt={article.title} />)}
            <CmsBlocks content={article.cms.content} />
          </> : article.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))}
          <div className="jy-article-end">
            <span>{c.brand}</span>
            <Link className="jy-text-link" to={routes[kind]}>
              {copy.back}
              <ArrowUpRight />
            </Link>
          </div>
        </article>
      </main>
    );
  const filtered = items.filter(
    (item) =>
      (category === c.library.all || item.category === category) &&
      `${item.title} ${item.summary} ${item.category} ${item.audience}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <main id="main" tabIndex={-1} className="jy-inner jy-section">
      <header className="jy-library-heading">
        <p className="jy-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
      </header>
      {kind === "knowledge" && (
        <div className="jy-library-tools">
          <label className="jy-search">
            <Search />
            <span className="sr-only">{c.library.search}</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={c.library.placeholder}
            />
          </label>
          <div className="jy-filters" aria-label={c.labels.categories}>
            {[
              c.library.all,
              ...new Set(items.map((item) => item.category)),
            ].map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                aria-pressed={category === item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="jy-result-count" role="status">
        {filtered.length}{" "}
        {kind === "knowledge" ? c.labels.guides : c.labels.stories}
      </p>
      <div className={`jy-article-grid ${kind === "blog" ? "is-journal" : ""}`}>
        {filtered.map((item, index) => (
          <Link
            className="jy-article-card"
            key={item.slug}
            to={`${routes[kind]}/${encodeURIComponent(item.slug)}`}
          >
            <div className="jy-article-art" aria-hidden="true">
              {item.cms?.coverImage && <CmsImage src={item.cms.coverImage} alt="" />}
              <span>0{index + 1}</span>
              <div className="jy-art-ring" />
              <div className="jy-art-ring second" />
            </div>
            <div className="jy-article-card-body">
              <span className="jy-eyebrow">
                {item.category} · {item.cms ? cmsContent.sourceLabel : `${item.minutes} ${c.labels.minutes}`}
              </span>
              <h2>{item.title}</h2>
              <p>{item.summary}</p>
              <span className="jy-text-link">
                {copy.read}
                <ArrowUpRight />
              </span>
            </div>
          </Link>
        ))}
      </div>
      {!filtered.length && (
        <div className="jy-empty">
          <h2>{c.library.empty}</h2>
          <button
            className="jy-button"
            onClick={() => {
              setQuery("");
              setCategory(c.library.all);
            }}
          >
            {c.library.clear}
          </button>
        </div>
      )}
      <p className="jy-editorial-note">{copy.disclaimer}</p>
    </main>
  );
}
