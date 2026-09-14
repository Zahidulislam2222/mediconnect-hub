import { z } from 'zod';
import { matchPath } from 'react-router-dom';
import source from './journey-routing.json';

const path = z.string().regex(/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/);
const routes = z.object({ home: path, knowledge: path, blog: path, auth: path,
  adminAuth: path, workspace: path, storyboard: path }).strict();
export const journeyRouting = z.object({ preview: routes, application: routes }).strict().parse(source);
export type JourneyRoutes = z.infer<typeof routes>;
export type JourneyMode = keyof typeof journeyRouting;
export function isJourneyApplicationPath(pathname: string): boolean {
  const r = journeyRouting.application;
  return [r.home, `${r.knowledge}/*`, `${r.blog}/*`, `${r.workspace}/:role`, r.storyboard]
    .some(path => matchPath({ path, end: true }, pathname) !== null);
}
