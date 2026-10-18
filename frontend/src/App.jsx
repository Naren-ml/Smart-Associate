import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import StaffDashboard from "./pages/StaffDashboard";
import BackendTest from "./pages/BackendTest";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route
            path="/"
            element={
              <>
                <Navbar />
                <Home />
              </>
            }
          />

          <Route path="/login" element={<Login />} />

          <Route path="/backend-test" element={<BackendTest />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <StaffDashboard initialTab="Dashboard" />
              </ProtectedRoute>
            }
          />

          <Route
            path="/attendance"
            element={
              <ProtectedRoute>
                <StaffDashboard initialTab="Attendance" />
              </ProtectedRoute>
            }
          />

          <Route
            path="/my-work"
            element={
              <ProtectedRoute>
                <StaffDashboard initialTab="My Work" />
              </ProtectedRoute>
            }
          />

          <Route
            path="/team-chat"
            element={
              <ProtectedRoute>
                <StaffDashboard initialTab="Team Chat" />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
