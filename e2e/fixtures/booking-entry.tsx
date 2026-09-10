import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppointmentBookingForm } from '@/components/appointments/AppointmentBookingForm';
import '@/index.css';

function Fixture() {
  const [visible, setVisible] = useState(true);
  const [result, setResult] = useState('pending');
  return <main><button onClick={() => setVisible(false)}>Leave test booking</button>
    {visible && <AppointmentBookingForm doctors={[{ doctorId: 'test-doctor', name: 'Test Doctor',
      specialization: 'Test Specialty', consultationFee: 75.5 }]} onCancel={() => setVisible(false)}
      onSuccess={() => { setResult('confirmed'); setVisible(false); }} />}
    <output aria-label="Test booking result">{result}</output>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
