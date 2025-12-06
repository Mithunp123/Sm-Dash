import React from "react";
import { Navigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import NotFound from "@/pages/NotFound";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  blockedRoles?: string[];
}

/**
 * ProtectedRoute enforces role-based access control.
 * - If requiredRoles is set, user must have one of those roles.
 * - If blockedRoles is set, user cannot have any of those roles.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRoles = [], 
  blockedRoles = [] 
}) => {
  const user = auth.getUser();

  // Not authenticated: redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check blocked roles
  if (blockedRoles.length > 0 && blockedRoles.includes(user.role)) {
    return <NotFound />;
  }

  // Check required roles
  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    return <NotFound />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
