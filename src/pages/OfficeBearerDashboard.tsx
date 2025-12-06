import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Users, Calendar, FileText, LogOut, Briefcase, UserCircle, GraduationCap, BarChart3, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

const OfficeBearerDashboard = () => {
  const navigate = useNavigate();
  const { permissions, loading } = usePermissions();
  const [studentsCount, setStudentsCount] = useState<number | null>(null);

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }
    // If authenticated but not an office bearer, redirect to admin dashboard
    if (!auth.hasRole('office_bearer')) {
      navigate("/admin");
      return;
    }
  }, [navigate]);

  // Load quick counts (students) for dashboard
  useEffect(() => {
    const loadCounts = async () => {
      try {
        // Use a scoped endpoint that returns only students visible to this caller
        const res = await api.getStudentsScoped();
        if (res.success) {
          const students = (res.students || []);
          setStudentsCount(students.length);
        }
      } catch (err) {
        console.error('Failed to load users for counts', err);
      }
    };
    loadCounts();
  }, []);

  const handleLogout = () => {
    auth.logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const hasAnyPermission = permissions.can_manage_meetings || 
                           permissions.can_manage_attendance || 
                           permissions.can_manage_bills ||
                           permissions.can_manage_projects ||
                           permissions.can_manage_students ||
                           permissions.can_view_analytics;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <DeveloperCredit />
        <main className="flex-1 p-4 md:p-8 flex items-center justify-center">
          <div className="text-center">Loading permissions...</div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <DeveloperCredit />
      
      <div className="flex flex-1">
        <main className="flex-1 p-4 md:p-8 bg-background">
          <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-primary mb-2">Office Bearer Dashboard</h1>
                <p className="text-muted-foreground">Manage events and coordinate activities</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => navigate("/office-bearer/profile")}
                  className="gap-2"
                >
                  <UserCircle className="w-4 h-4" />
                  My Profile
                </Button>
                {/* Logout is available in the top header; removed duplicate button here */}
              </div>
            </div>

            {!hasAnyPermission ? (
              <Card className="gradient-card border-border/50">
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <XCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Permissions Granted</h3>
                    <p className="text-muted-foreground">
                      Please contact the administrator to grant you permissions for managing activities.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {permissions.can_manage_meetings && (
                  <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer" onClick={() => navigate("/admin/meetings")}>
                    <div onClick={(e) => e.stopPropagation()} className="w-full h-full">
                      <CardHeader>
                        <Calendar className="w-12 h-12 text-primary mb-2" />
                        <CardTitle>Meetings & Events</CardTitle>
                        <CardDescription>
                          Schedule and manage meetings
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button className="w-full" onClick={() => navigate("/admin/meetings")}>Manage Events</Button>
                      </CardContent>
                    </div>
                  </Card>
                )}

                {permissions.can_manage_attendance && (
                  <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer" onClick={() => navigate("/admin/attendance")}>
                    <div onClick={(e) => e.stopPropagation()} className="w-full h-full">
                      <CardHeader>
                        <Users className="w-12 h-12 text-accent mb-2" />
                        <CardTitle>Attendance</CardTitle>
                        <CardDescription>
                          Track meeting attendance
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button className="w-full" onClick={() => navigate("/admin/attendance")}>View Attendance</Button>
                      </CardContent>
                    </div>
                  </Card>
                )}

                {permissions.can_manage_bills && (
                  <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer" onClick={() => navigate("/admin/bills")}>
                    <div onClick={(e) => e.stopPropagation()} className="w-full h-full">
                      <CardHeader>
                        <FileText className="w-12 h-12 text-violet mb-2" />
                        <CardTitle>Bills & Reports</CardTitle>
                        <CardDescription>
                          Review and approve bills
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button className="w-full" onClick={() => navigate("/admin/bills")}>Review Bills</Button>
                      </CardContent>
                    </div>
                  </Card>
                )}

                {permissions.can_manage_projects && (
                  <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer" onClick={() => navigate("/admin/projects")}>
                    <div onClick={(e) => e.stopPropagation()} className="w-full h-full">
                      <CardHeader>
                        <Briefcase className="w-12 h-12 text-primary mb-2" />
                        <CardTitle>Projects</CardTitle>
                        <CardDescription>
                          Manage projects
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button className="w-full" onClick={() => navigate("/admin/projects")}>Manage Projects</Button>
                      </CardContent>
                    </div>
                  </Card>
                )}

                {permissions.can_manage_students && (
                  <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer" onClick={() => navigate("/admin/students")}>
                    <div onClick={(e) => e.stopPropagation()} className="w-full h-full">
                      <CardHeader>
                        <UserCircle className="w-12 h-12 text-accent mb-2" />
                        <CardTitle>Students</CardTitle>
                        <CardDescription>
                          View and manage students
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <Button className="w-full" onClick={() => navigate("/admin/students")}>Manage Students</Button>
                          <div className="ml-4 text-sm text-muted-foreground">{studentsCount !== null ? `${studentsCount} students` : 'Loading...'}</div>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                )}


                {permissions.can_view_analytics && (
                  <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer" onClick={() => navigate("/admin/analytics")}>
                    <div onClick={(e) => e.stopPropagation()} className="w-full h-full">
                      <CardHeader>
                        <BarChart3 className="w-12 h-12 text-primary mb-2" />
                        <CardTitle>Analytics</CardTitle>
                        <CardDescription>
                          View analytics and reports
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button className="w-full" onClick={() => navigate("/admin/analytics")}>View Analytics</Button>
                      </CardContent>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
};

export default OfficeBearerDashboard;

