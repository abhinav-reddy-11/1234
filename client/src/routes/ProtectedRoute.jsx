import { Navigate, Outlet } from "react-router-dom";
import { useAuth, homePathFor } from "../context/AuthContext";
import { Loading } from "../components/ui";

// Blocks pages for logged-out users and for the wrong role.
// The backend enforces the same rules; this just keeps the UI tidy.
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading text="Checking your session..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePathFor(user.role)} replace />;
  return <Outlet />;
}
