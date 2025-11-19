import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@store/auth";
import { Spinner } from "./Spinner";

export default function ProtectedRoute() {
  const { user, isBootstrapping } = useAuthStore(state => ({ 
    user: state.user,
    isBootstrapping: state.isBootstrapping 
  }));

  if (isBootstrapping) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-main">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}