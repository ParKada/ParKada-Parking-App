import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SignupLogin from './pages/SignupLogin';
import SignupRegister from './pages/SignupRegister';
import PartnerDashboard from './pages/PartnerDashboard';
import ApplicationForm from './pages/ApplicationForm';
import ApplicationReview from './pages/ApplicationReview';
import ContactPage from './pages/ContactPage';
import ChangePassword from './pages/ChangePassword';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<SignupLogin />} />
        <Route path="/register" element={<SignupRegister />} />
        <Route path="/dashboard" element={<PartnerDashboard />} />
        <Route path="/apply" element={<ApplicationForm />} />
        <Route path="/apply/review" element={<ApplicationReview />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/change-password" element={<ChangePassword />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
