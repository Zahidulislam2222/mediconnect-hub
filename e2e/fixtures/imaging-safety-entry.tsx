import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import HealthRecords from '@/pages/HealthRecords';
import '@/index.css';

function Fixture() {
  const [visible, setVisible] = useState(true);
  return <MemoryRouter>
    <button className="fixed bottom-4 right-4 z-50 bg-background border p-3" onClick={() => setVisible(false)}>Leave test imaging</button>
    {visible && <HealthRecords />}
  </MemoryRouter>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
