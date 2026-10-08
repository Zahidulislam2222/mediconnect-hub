import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import JourneyApp from './components/journey/JourneyApp';
import { isJourneyApplicationPath } from './config/journey-routing';
import { journey } from './content/journey';
import './index.css';
import './styles/journey.css';

function PublicEntry() {
  const location = useLocation();
  const publicPath = isJourneyApplicationPath(location.pathname);
  useEffect(() => {
    if (!publicPath) window.location.reload();
  }, [publicPath, location.pathname, location.search, location.hash]);
  return publicPath ? <JourneyApp mode="application" /> : <p role="status">{journey.labels.loading}</p>;
}

createRoot(document.getElementById('root')!).render(<BrowserRouter><PublicEntry /></BrowserRouter>);
