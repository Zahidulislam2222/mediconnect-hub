import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Appointments from '@/pages/Appointments';
import { Toaster } from '@/components/ui/toaster';
import '@/index.css';

export function Location() {
  const location = useLocation();
  return <output aria-label="Test location">{location.pathname + location.search}</output>;
}
export function Fixture() {
  const [visible, setVisible] = useState(true);
  return <MemoryRouter initialEntries={['/appointments']}>
    <button className="fixed bottom-4 right-4 z-50 bg-background border p-3" onClick={() => setVisible(false)}>Leave test appointments</button>
    {visible && <Routes><Route path="/appointments" element={<Appointments />} />
      <Route path="/consultation" element={<p>Test consultation destination</p>} /></Routes>}
    <Location /><Toaster />
  </MemoryRouter>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
