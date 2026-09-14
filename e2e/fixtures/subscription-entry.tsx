import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Subscription from '@/pages/Subscription';
import { SubscriptionProvider, useSubscription } from '@/context/SubscriptionContext';
import { Toaster } from '@/components/ui/toaster';
import { SESSION_CLEARED_EVENT } from '@/lib/secure-storage';
import '@/index.css';
function Fixture() {
  const navigate = useNavigate(); const { subscription } = useSubscription();
  return <><button onClick={() => navigate('/next')}>Leave subscription</button>
    <button onClick={() => window.dispatchEvent(new Event(SESSION_CLEARED_EVENT))}>Clear test session</button>
    <output aria-label="Shared subscription">{JSON.stringify(subscription)}</output>
    <Routes><Route path="/" element={<Subscription />} /><Route path="/next" element={<p>Left subscription</p>} /></Routes>
    <Toaster /></>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter><SubscriptionProvider><Fixture /></SubscriptionProvider></MemoryRouter>);
