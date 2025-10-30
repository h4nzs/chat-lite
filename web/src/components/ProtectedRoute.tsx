import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@store/auth";
import { shallow } from "zustand/shallow";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useAuthStore((s) => s.user, shallow);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      await bootstrap();
      setReady(true);
    })();
  }, [bootstrap]);

  if (!ready) return <div className="p-6">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}