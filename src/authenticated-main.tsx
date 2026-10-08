import { createRoot } from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import App from './App';
import './index.css';
import { getAwsConfig } from './aws-config';

Amplify.configure(getAwsConfig());
createRoot(document.getElementById('root')!).render(<App />);
