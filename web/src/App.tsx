import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Tokens from "./pages/Tokens";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tokens" element={<Tokens />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
