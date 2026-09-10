import routes from '/src/config/appointment-routing.json?import';
import timeouts from '/src/config/http-defaults.json?import';
export const appointmentRouting = routes;
export const publicEnv = () => 'https://appointments.example.test';
export const optionalBackupUrl = () => '';
export const optionalStripePublishableKey = () => undefined;
export const requestTimeout = name => timeouts[name];
