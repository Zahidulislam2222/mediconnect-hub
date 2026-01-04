// Mock Data for MediConnect Telehealth Platform

export const patientVitals = {
  heartRate: {
    current: 72,
    unit: "bpm",
    status: "normal",
    trend: [68, 70, 72, 71, 73, 72, 70, 72],
    change: "+2%",
  },
  bloodPressure: {
    systolic: 120,
    diastolic: 80,
    unit: "mmHg",
    status: "normal",
    trend: [118, 122, 120, 119, 121, 120, 118, 120],
    change: "-1%",
  },
  glucose: {
    current: 95,
    unit: "mg/dL",
    status: "normal",
    trend: [92, 98, 95, 94, 96, 95, 93, 95],
    change: "+1%",
  },
  spO2: {
    current: 98,
    unit: "%",
    status: "excellent",
    trend: [97, 98, 98, 99, 98, 97, 98, 98],
    change: "0%",
  },
};

export const upcomingAppointments = [
  {
    id: "apt-1",
    doctor: "Dr. Sarah Chen",
    specialty: "Cardiologist",
    date: "Today",
    time: "2:30 PM",
    type: "Video Call",
    avatar: "SC",
    status: "upcoming",
  },
  {
    id: "apt-2",
    doctor: "Dr. Michael Roberts",
    specialty: "General Physician",
    date: "Tomorrow",
    time: "10:00 AM",
    type: "In-Person",
    avatar: "MR",
    status: "scheduled",
  },
  {
    id: "apt-3",
    doctor: "Dr. Emily Watson",
    specialty: "Dermatologist",
    date: "Jan 8, 2026",
    time: "3:45 PM",
    type: "Video Call",
    avatar: "EW",
    status: "scheduled",
  },
];

export const notifications = [
  {
    id: "notif-1",
    type: "prescription",
    title: "Prescription Ready",
    message: "Your Lisinopril prescription is ready for pickup at CVS Pharmacy",
    time: "10 min ago",
    read: false,
  },
  {
    id: "notif-2",
    type: "lab",
    title: "Lab Results Available",
    message: "Your blood panel results from Jan 2 are now available",
    time: "2 hours ago",
    read: false,
  },
  {
    id: "notif-3",
    type: "appointment",
    title: "Appointment Reminder",
    message: "Video call with Dr. Chen in 30 minutes",
    time: "5 hours ago",
    read: true,
  },
];

export const patientQueue = [
  {
    id: "patient-1",
    name: "John Doe",
    age: 45,
    condition: "Chest Pain - Follow up",
    waitTime: "5 min",
    priority: "high",
    avatar: "JD",
    vitals: { hr: 78, bp: "130/85" },
  },
  {
    id: "patient-2",
    name: "Sarah Smith",
    age: 32,
    condition: "Anxiety Management",
    waitTime: "12 min",
    priority: "medium",
    avatar: "SS",
    vitals: { hr: 72, bp: "118/76" },
  },
  {
    id: "patient-3",
    name: "Robert Johnson",
    age: 58,
    condition: "Diabetes Check-up",
    waitTime: "20 min",
    priority: "low",
    avatar: "RJ",
    vitals: { hr: 68, bp: "125/82" },
  },
  {
    id: "patient-4",
    name: "Maria Garcia",
    age: 28,
    condition: "Skin Rash Evaluation",
    waitTime: "25 min",
    priority: "low",
    avatar: "MG",
    vitals: { hr: 70, bp: "115/75" },
  },
];

export const revenueData = [
  { month: "Aug", consultations: 145, revenue: 18200 },
  { month: "Sep", consultations: 162, revenue: 20400 },
  { month: "Oct", consultations: 158, revenue: 19800 },
  { month: "Nov", consultations: 175, revenue: 22100 },
  { month: "Dec", consultations: 189, revenue: 24500 },
  { month: "Jan", consultations: 198, revenue: 25800 },
];

export const aiSymptomMessages = [
  {
    id: "msg-1",
    role: "assistant",
    content: "Hello! I'm your AI Health Assistant. I can help you understand your symptoms and guide you to the right care. What symptoms are you experiencing today?",
  },
  {
    id: "msg-2",
    role: "user",
    content: "I've been having headaches for the past 3 days, mostly in the afternoon. Also feeling a bit tired.",
  },
  {
    id: "msg-3",
    role: "assistant",
    content: "I understand you're experiencing headaches for 3 days, primarily in the afternoon, along with fatigue. Let me ask a few questions:\n\n1. On a scale of 1-10, how severe is the pain?\n2. Is the headache on one side or both sides?\n3. Have you noticed any triggers like screen time, stress, or lack of sleep?",
  },
];

export const ehrTimeline = [
  {
    id: "ehr-1",
    type: "visit",
    title: "Annual Physical Exam",
    doctor: "Dr. Michael Roberts",
    date: "Dec 15, 2025",
    summary: "Routine checkup. All vitals normal. Recommended vitamin D supplement.",
    documents: ["Physical Exam Report.pdf"],
  },
  {
    id: "ehr-2",
    type: "lab",
    title: "Complete Blood Panel",
    facility: "LabCorp",
    date: "Dec 10, 2025",
    summary: "Cholesterol slightly elevated (215 mg/dL). All other values within range.",
    documents: ["Blood Panel Results.pdf"],
  },
  {
    id: "ehr-3",
    type: "prescription",
    title: "Prescription Issued",
    doctor: "Dr. Sarah Chen",
    date: "Nov 28, 2025",
    summary: "Lisinopril 10mg - Take once daily for blood pressure management.",
    documents: [],
  },
  {
    id: "ehr-4",
    type: "imaging",
    title: "Chest X-Ray",
    facility: "City Medical Imaging",
    date: "Nov 15, 2025",
    summary: "No abnormalities detected. Clear lung fields.",
    documents: ["Chest_XRay_Nov2025.pdf", "Radiology_Report.pdf"],
  },
];

export const documents = [
  { id: "doc-1", name: "Insurance Card", type: "insurance", date: "2025" },
  { id: "doc-2", name: "Blood Panel Report", type: "lab", date: "Dec 2025" },
  { id: "doc-3", name: "Chest X-Ray", type: "imaging", date: "Nov 2025" },
  { id: "doc-4", name: "Vaccination Record", type: "record", date: "2025" },
  { id: "doc-5", name: "Referral Letter", type: "referral", date: "Oct 2025" },
  { id: "doc-6", name: "ECG Report", type: "lab", date: "Sep 2025" },
];

export const prescriptions = [
  {
    id: "rx-1",
    name: "Lisinopril",
    dosage: "10mg",
    frequency: "Once daily",
    refillsLeft: 2,
    lastFilled: "Dec 28, 2025",
    prescriber: "Dr. Sarah Chen",
    pharmacy: "CVS Pharmacy",
    status: "active",
  },
  {
    id: "rx-2",
    name: "Metformin",
    dosage: "500mg",
    frequency: "Twice daily with meals",
    refillsLeft: 5,
    lastFilled: "Dec 15, 2025",
    prescriber: "Dr. Michael Roberts",
    pharmacy: "Walgreens",
    status: "active",
  },
  {
    id: "rx-3",
    name: "Vitamin D3",
    dosage: "2000 IU",
    frequency: "Once daily",
    refillsLeft: 3,
    lastFilled: "Dec 20, 2025",
    prescriber: "Dr. Michael Roberts",
    pharmacy: "CVS Pharmacy",
    status: "active",
  },
];

export const knowledgeArticles = [
  {
    id: "article-1",
    title: "Understanding Blood Pressure",
    category: "Heart Health",
    readTime: "5 min",
    image: "heart",
    excerpt: "Learn about what blood pressure readings mean and how to maintain healthy levels.",
  },
  {
    id: "article-2",
    title: "Managing Type 2 Diabetes",
    category: "Diabetes",
    readTime: "8 min",
    image: "diabetes",
    excerpt: "Comprehensive guide to lifestyle changes and medication management for diabetes.",
  },
  {
    id: "article-3",
    title: "Sleep & Mental Health",
    category: "Wellness",
    readTime: "4 min",
    image: "sleep",
    excerpt: "Discover the connection between quality sleep and mental wellbeing.",
  },
  {
    id: "article-4",
    title: "COVID-19 Vaccine FAQ",
    category: "Vaccines",
    readTime: "6 min",
    image: "vaccine",
    excerpt: "Answers to common questions about COVID-19 vaccines and boosters.",
  },
  {
    id: "article-5",
    title: "Healthy Eating Guidelines",
    category: "Nutrition",
    readTime: "7 min",
    image: "nutrition",
    excerpt: "Evidence-based nutrition advice for a balanced and healthy diet.",
  },
  {
    id: "article-6",
    title: "Medication Interactions",
    category: "Pharmacy",
    readTime: "5 min",
    image: "pills",
    excerpt: "Important information about drug interactions you should know.",
  },
];

export const currentUser = {
  name: "Alex Thompson",
  email: "alex.thompson@email.com",
  role: "patient" as const,
  avatar: "AT",
  memberId: "MED-2025-48291",
};

export const currentDoctor = {
  name: "Dr. Sarah Chen",
  email: "dr.chen@mediconnect.com",
  role: "doctor" as const,
  specialty: "Cardiologist",
  avatar: "SC",
  licenseStatus: "verified",
  licenseNumber: "CA-MED-284719",
};
