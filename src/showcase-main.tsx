import { isJourneyApplicationPath } from './config/journey-routing';

if (isJourneyApplicationPath(window.location.pathname)) {
  void import('./public-main');
} else {
  void import("./main");
}
