import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HashRouter, useLocation } from 'react-router-dom';
import JourneyApp from '@/components/journey/JourneyApp';

function Location() { const location = useLocation(); return <><output data-testid="route">{location.pathname}</output><output data-testid="fragment">{location.hash}</output></>; }
beforeEach(() => {
  window.history.replaceState(null, '', '/#/'); Element.prototype.scrollIntoView = vi.fn(); window.scrollTo = vi.fn();
  // JSDOM has no media engine; the browser gate exercises real film behavior.
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it.each(['Skip to page content', 'Explore MediConnect'])('keeps the current native route when using %s', async name => {
  render(<HashRouter><JourneyApp mode="application" /><Location /></HashRouter>);
  const link = name === 'Explore MediConnect' ? document.querySelector('.jy-mobile-skip')! : screen.getByRole('link', { name });
  fireEvent.click(link);
  await waitFor(() => expect(screen.getByTestId('fragment')).toHaveTextContent(name === 'Explore MediConnect' ? '#explore' : '#main'));
  expect(screen.getByTestId('route')).toHaveTextContent(/^\/$/);
});
