import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HashRouter, useLocation } from 'react-router-dom';
import JourneyApp from '@/components/journey/JourneyApp';
import { journey } from '@/content/journey';

function Location() { const location = useLocation(); return <><output data-testid="route">{location.pathname}</output><output data-testid="fragment">{location.hash}</output></>; }
beforeEach(() => {
  window.history.replaceState(null, '', '/#/'); Element.prototype.scrollIntoView = vi.fn(); window.scrollTo = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it.each(['Skip to page content', journey.hero.secondary])('keeps the current native route when using %s', async name => {
  render(<HashRouter><JourneyApp mode="application" /><Location /></HashRouter>);
  fireEvent.click(screen.getByRole('link', { name }));
  await waitFor(() => expect(screen.getByTestId('fragment')).toHaveTextContent(name === journey.hero.secondary ? '#explore' : '#main'));
  expect(screen.getByTestId('route')).toHaveTextContent(/^\/$/);
});
