import { Capacitor } from '@capacitor/core';
import { isJourneyApplicationPath } from './config/journey-routing';

if (!Capacitor.isNativePlatform() && isJourneyApplicationPath(window.location.pathname)) {
  void import('./public-main');
} else {
  void import('./authenticated-main');
}
