import routes from '/src/config/symptom-routing.json?import';
import timeouts from '/src/config/http-defaults.json?import';
export const symptomRouting = routes;
export const publicEnv = () => 'https://symptoms.example.test';
export const optionalBackupUrl = () => '';
export const requestTimeout = name => timeouts[name];
