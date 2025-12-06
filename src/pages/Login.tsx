import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Role selector will use card buttons instead of the Select component
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  // Handle OAuth redirect token in URL (backend redirects to FRONTEND_URL?token=...&role=...)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const roleFromUrl = params.get('role');
      if (token) {
        // Save token to api client/localStorage
        api.setToken(token);

        // Decode JWT payload to create a basic auth_user object
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const user = {
            id: payload.userId || null,
            name: payload.name || payload.email || 'User',
            email: payload.email || '',
            role: roleFromUrl || payload.role || 'student'
          };
          // Store OAuth login user only for this session
          sessionStorage.setItem('auth_user', JSON.stringify(user));
        } catch (err) {
          console.warn('Failed to decode token payload', err);
        }

        // Remove token params from URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        // Redirect based on role
        const finalRole = roleFromUrl || (JSON.parse(sessionStorage.getItem('auth_user') || '{}').role);
        if (finalRole) {
          switch (finalRole) {
            case 'admin': navigate('/admin'); break;
            case 'office_bearer': navigate('/office-bearer'); break;
            case 'student': navigate('/student'); break;
            case 'alumni': navigate('/admin/student-db'); break;
            default: navigate('/');
          }
        }
      }
    } catch (err) {
      console.error('OAuth token handling error', err);
    }
  }, []);
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Availability slider removed from login/landing page — managed via Settings page
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // studentAvailability removed from Login page

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!email || !password) {
      toast.error("Please enter both email and password");
      return;
    }

    setLoading(true);

    try {
      const response = await auth.login(email, password);
      
      if (response.success) {
        toast.success("Login successful!");
        
        // Office bearer availability is managed in Settings; do not set it here.
        
        // Check if user must change password
        if (response.user?.mustChangePassword) {
          setShowChangePassword(true);
        } else {
          // student availability persistence removed from login
          // Redirect based on role - use setTimeout to ensure state is updated
          setTimeout(() => {
            redirectByRole(response.user.role);
          }, 100);
        }
      } else {
        toast.error(response.message || "Invalid credentials. Please try again.");
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Show specific error messages
      if (error.message.includes('Cannot connect to server')) {
        toast.error("Backend server is not running. Please start the backend server first.");
      } else if (error.message.includes('Invalid email or password') || error.message.includes('Invalid credentials')) {
        toast.error("Invalid email or password. Please check your credentials and try again.");
        console.log('Login failed - Email:', email, 'Password length:', password.length);
      } else {
        toast.error(error.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 5) {
      toast.error("Password must be at least 5 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await api.changePassword(currentPassword, newPassword);
      
      if (response.success) {
        toast.success("Password changed successfully!");
        setShowChangePassword(false);
        const user = auth.getUser();
        if (user) {
          redirectByRole(user.role);
        }
      } else {
        toast.error(response.message || "Failed to change password");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  // student availability handler removed

  const redirectByRole = (role: string) => {
    switch (role) {
      case 'admin':
        navigate("/admin");
        break;
      case 'office_bearer':
        navigate("/office-bearer");
        break;
      case 'student':
        navigate("/student");
        break;
      case 'alumni':
        navigate("/admin/student-db");
        break;
      default:
        navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <DeveloperCredit />
      
      <main className="flex-1 flex items-center justify-center p-8 bg-gradient-to-b from-orange-50 to-white">
        <Card className="w-full max-w-lg bg-white border border-orange-100 shadow-2xl rounded-2xl p-8">
          <CardHeader className="space-y-1">
            <CardTitle className="text-3xl text-center text-orange-600 font-bold">Welcome Back</CardTitle>
            <CardDescription className="text-center text-sm text-gray-600">
              Sign in to access your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    aria-pressed={role === 'admin'}
                    className={`p-3 rounded-lg border transition-shadow text-center ${role === 'admin' ? 'bg-orange-50 border-orange-300 shadow-md' : 'bg-white border-gray-200 hover:shadow-sm'}`}>
                    <div className="font-semibold">Admin</div>
                    <div className="text-xs text-muted-foreground">Full access</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    aria-pressed={role === 'student'}
                    className={`p-3 rounded-lg border transition-shadow text-center ${role === 'student' ? 'bg-orange-50 border-orange-300 shadow-md' : 'bg-white border-gray-200 hover:shadow-sm'}`}>
                    <div className="font-semibold">Student</div>
                    <div className="text-xs text-muted-foreground">Volunteer access</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('office_bearer')}
                    aria-pressed={role === 'office_bearer'}
                    className={`p-3 rounded-lg border transition-shadow text-center ${role === 'office_bearer' ? 'bg-orange-50 border-orange-300 shadow-md' : 'bg-white border-gray-200 hover:shadow-sm'}`}>
                    <div className="font-semibold">Office Bearer</div>
                    <div className="text-xs text-muted-foreground">Manage activities</div>
                  </button>
                </div>

                {/* student availability UI removed */}

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                        const authBase = apiBase.replace(/\/api\/?$/, '');
                        const roleState = role ? `?state=${encodeURIComponent(role)}` : '';
                        window.location.href = `${authBase}/auth/google${role ? `?state=${encodeURIComponent(role)}` : ''}`;
                      } catch (err) {
                        console.error('Google login redirect failed', err);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 p-3 mt-2 rounded-lg border border-gray-200 hover:shadow-sm bg-white"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path fill="#4285F4" d="M533.5 278.4c0-18.6-1.5-37.1-4.7-54.8H272v103.6h146.9c-6.3 34-25 62.8-53.5 82.1v68.1h86.3c50.6-46.6 81.8-115.5 81.8-199z"/>
                      <path fill="#34A853" d="M272 544.3c72.4 0 133.2-24 177.6-65.1l-86.3-68.1c-24 16.1-54.7 25.6-91.3 25.6-70.2 0-129.7-47.4-151-111.1H34.6v69.8C78.6 483 167 544.3 272 544.3z"/>
                      <path fill="#FBBC05" d="M121 323.7c-10.7-31.9-10.7-66.3 0-98.2V155.7H34.6c-38.5 75.6-38.5 164.7 0 240.3L121 323.7z"/>
                      <path fill="#EA4335" d="M272 107.7c39.4 0 74.9 13.6 102.8 40.3l77.1-77.1C405.2 24 344.4 0 272 0 167 0 78.6 61.3 34.6 155.7l86.4 69.8C142.3 155.1 201.8 107.7 272 107.7z"/>
                    </svg>
                    <span className="font-medium">Sign in with Google</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@ksrct.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background/50"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-background/50 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white hover:scale-105 transition-transform"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            {/* Removed default admin credentials from UI for security. */}
          </CardContent>
        </Card>
      </main>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              You must change your password before continuing.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                  required
                  minLength={5}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pr-10"
                  required
                  minLength={5}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Changing..." : "Change Password"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default Login;
