import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import SymptomChecker from '@/pages/SymptomChecker';
import { Toaster } from '@/components/ui/toaster';
import '@/index.css';

export function Location() {
  const location = useLocation();
  return <output aria-label="Test location">{location.pathname}</output>;
}
export function Fixture() {
  const [visible, setVisible] = useState(true);
  return <MemoryRouter initialEntries={['/symptom-checker']}>
    <button className="fixed bottom-4 right-4 z-50 bg-background border p-3" onClick={() => setVisible(false)}>Leave test symptoms</button>
    {visible && <Routes><Route path="/symptom-checker" element={<SymptomChecker />} />
      <Route path="/auth" element={<p>Test signed-out destination</p>} /></Routes>}
    <Location /><Toaster />
  </MemoryRouter>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
