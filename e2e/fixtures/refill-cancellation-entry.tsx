import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Prescriptions from '@/pages/Prescriptions';
import { Toaster } from '@/components/ui/toaster';
import '@/index.css';
createRoot(document.getElementById('root')!).render(<MemoryRouter><Prescriptions /><Toaster /></MemoryRouter>);
