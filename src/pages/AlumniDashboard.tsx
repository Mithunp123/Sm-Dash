import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Award, Users, FileText, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { toast } from "sonner";
import { useEffect } from "react";

const AlumniDashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.isAuthenticated() || !auth.hasRole('alumni')) {
      navigate("/login");
    }
  }, []);

  const handleLogout = () => {
    auth.logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <DeveloperCredit />
      
      <main className="flex-1 p-4 md:p-8">
        <div className="container mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-primary mb-2">Alumni Dashboard</h1>
              <p className="text-muted-foreground">Stay connected with SM Volunteers</p>
            </div>
            {/* Logout is available in the top header; removed duplicate button here */}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer">
              <CardHeader>
                <Award className="w-12 h-12 text-primary mb-2" />
                <CardTitle>My Profile</CardTitle>
                <CardDescription>
                  Update your alumni profile
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">Update Profile</Button>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer">
              <CardHeader>
                <Users className="w-12 h-12 text-accent mb-2" />
                <CardTitle>Alumni Network</CardTitle>
                <CardDescription>
                  Connect with other alumni
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">View Network</Button>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer">
              <CardHeader>
                <FileText className="w-12 h-12 text-violet mb-2" />
                <CardTitle>Achievements</CardTitle>
                <CardDescription>
                  Share your achievements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">Share Achievement</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AlumniDashboard;

