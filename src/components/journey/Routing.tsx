import { createContext, useContext } from 'react';
import { journeyRouting, type JourneyRoutes } from '@/config/journey-routing';

export const JourneyRoutingContext = createContext<JourneyRoutes>(journeyRouting.preview);
export const useJourneyRoutes = () => useContext(JourneyRoutingContext);
