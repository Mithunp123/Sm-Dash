import React from "react";
import { Navigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  blockedRoles?: string[];
  requiredPermission?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles = [],
  blockedRoles = [],
  requiredPermission
}) => {
  const user = auth.getUser();
  const { permissions, loading: permissionsLoading } = usePermissions();

  // Not authenticated: redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If we are still loading permissions and we need a permission check, show loader
  if (requiredPermission && permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check blocked roles
  if (blockedRoles.length > 0 && blockedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" />;
  }

  // Check required roles
  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" />;
  }

  // Check required permission
  if (requiredPermission && user.role !== 'admin' && user.role !== 'office_bearer') {
    const hasPermission = (permissions as any)[requiredPermission];
    if (!hasPermission) {
      return <Navigate to="/student" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
