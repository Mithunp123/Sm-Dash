import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeRole, setActiveRole] = useState<"admin" | "office_bearer" | "student">("student");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [newResetPassword, setNewResetPassword] = useState("");
  const [confirmResetPassword, setConfirmResetPassword] = useState("");
  const [showNewResetPassword, setShowNewResetPassword] = useState(false);
  const [showConfirmResetPassword, setShowConfirmResetPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Auto-select role based on email
  useEffect(() => {
    if (!email || email.length < 3) return;

    // Debounce email check
    const timeout = setTimeout(async () => {
      try {
        const response = await api.getRoleByEmail(email);
        if (response.success && response.role) {
          // Map backend roles to frontend role types
          if (response.role === 'admin' || response.role === 'office_bearer' || response.role === 'student') {
            setActiveRole(response.role as "admin" | "office_bearer" | "student");
          }
        }
      } catch (error) {
        // Silently fail - don't show error for role lookup
        console.debug('Could not fetch role for email:', error);
      }
    }, 500); // Wait 500ms after user stops typing

    return () => {
      clearTimeout(timeout);
    };
  }, [email]);

  // Handle OAuth redirect token in URL (backend redirects to FRONTEND_URL?token=...&role=...)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const error = params.get("error");
      if (error) {
        toast.error(decodeURIComponent(error));
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        return;
      }

      const token = params.get("token");
      const roleFromUrl = params.get("role");
      if (token) {
        api.setToken(token);

        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          const user = {
            id: payload.userId || null,
            name: payload.name || payload.email || "User",
            email: payload.email || "",
            role: roleFromUrl || payload.role || "student",
          };
          sessionStorage.setItem("auth_user", JSON.stringify(user));
        } catch (err) {
          console.warn("Failed to decode token payload", err);
        }

        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        const finalRole = roleFromUrl || JSON.parse(sessionStorage.getItem("auth_user") || "{}").role;
        if (finalRole) redirectByRole(finalRole);
      }
    } catch (err) {
      console.error("OAuth token handling error", err);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please enter both email and password");
      return;
    }

    setLoading(true);

    try {
      const response = await auth.login(email, password);

      if (response.success && response.user) {
        // Ensure selected role matches actual role
        const actualRole = response.user.role;
        if (actualRole !== activeRole) {
          toast.error(`You are logged in as ${actualRole.replace("_", " ")}. Please select the correct role.`);
          return;
        }

        toast.success("Login successful!");

        if (response.user?.mustChangePassword) {
          setShowChangePassword(true);
        } else {
          setTimeout(() => {
            redirectByRole(response.user.role);
          }, 100);
        }
      } else {
        toast.error(response.message || "Invalid credentials. Please try again.");
      }
    } catch (error: any) {
      console.error("Login error:", error);

      if (error.message.includes("Cannot connect to server")) {
        toast.error("Backend server is not running. Please start the backend server first.");
      } else if (error.message.includes("Invalid email or password") || error.message.includes("Invalid credentials")) {
        toast.error("Invalid email or password. Please check your credentials and try again.");
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

  const redirectByRole = (role: string) => {
    switch (role) {
      case "admin":
        navigate("/admin");
        break;
      case "office_bearer":
        navigate("/office-bearer");
        break;
      case "student":
        navigate("/student");
        break;

      default:
        navigate("/");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error("Please enter your email");
      return;
    }
    setLoading(true);
    try {
      const response = await api.forgotPassword(forgotEmail);
      if (response.success) {
        toast.success("OTP sent to your email!");
        setShowForgotPassword(false);
        setResetEmail(forgotEmail);
        setShowResetPassword(true);
        // Start cooldown timer
        setResendCooldown(60);
      } else {
        toast.error(response.message || "Failed to send OTP");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      const response = await api.forgotPassword(resetEmail);
      if (response.success) {
        toast.success("New OTP sent to your email!");
        setResendCooldown(60);
      } else {
        toast.error(response.message || "Failed to resend OTP");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  // Mask email for privacy
  const maskEmail = (email: string) => {
    if (!email) return "";
    const [username, domain] = email.split("@");
    if (!username || !domain) return email;
    const maskedUsername = username.length > 2
      ? username[0] + "***" + username[username.length - 1]
      : username[0] + "***";
    return `${maskedUsername}@${domain}`;
  };

  // Cooldown timer effect
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newResetPassword !== confirmResetPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newResetPassword.length < 5) {
      toast.error("Password must be at least 5 characters");
      return;
    }
    setLoading(true);
    try {
      const response = await api.resetPassword(resetEmail, otp, newResetPassword);
      if (response.success) {
        toast.success("Password reset successfully! Please login.");
        setShowResetPassword(false);
        setOtp("");
        setNewResetPassword("");
        setConfirmResetPassword("");
      } else {
        toast.error(response.message || "Failed to reset password");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 md:p-8 min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-900 dark:to-slate-900 relative">
      {/* Back Button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate("/")}
        className="absolute top-8 left-8 flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors bg-white/20 dark:bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-xl"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </motion.button>

      {/* Glassmorphism Split Layout */}
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center">

        {/* Left Side - Login Form */}
        <motion.div
          initial={{ opacity: 0, x: -50, rotateY: -10 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ perspective: "1200px" }}
        >
          <Card className="w-full border-border/50 shadow-2xl rounded-3xl p-8 md:p-10 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 hover:shadow-primary/10 transition-shadow">
            <div className="space-y-8">
              <div className="text-center space-y-2 animate-fade-in">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center justify-center gap-2">
                  <span>SM</span>
                  <span className="text-primary">Volunteers</span>
                </h1>
                <p className="text-sm text-muted-foreground">
                  Login to manage your{" "}
                  <span className="font-medium text-foreground">events, attendance & volunteering</span>
                </p>
              </div>

              {/* Role tabs */}
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground text-center uppercase tracking-wider font-semibold">
                  Sign in as
                </p>
                <div className="flex justify-center gap-2">
                  {[
                    { key: "admin", label: "Admin" },
                    { key: "office_bearer", label: "Office Bearer" },
                    { key: "student", label: "Student" },
                  ].map((r) => (
                    <Button
                      key={r.key}
                      type="button"
                      variant={activeRole === r.key ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "rounded-full px-4 text-xs transition-all",
                        activeRole === r.key ? "shadow-md" : "hover:bg-accent hover:text-accent-foreground"
                      )}
                      onClick={() => setActiveRole(r.key as any)}
                    >
                      {r.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Google authentication */}
              <Button
                type="button"
                variant="outline"
                className="w-full gap-3 h-11 border-border/60 hover:bg-accent/50"
                onClick={() => {
                  try {
                    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
                    const authBase = apiBase.replace(/\/api\/?$/, "");
                    window.location.href = `${authBase}/auth/google?role=${activeRole}`;
                  } catch (err) {
                    console.error("Google login redirect failed", err);
                  }
                }}
              >
                <svg className="w-4 h-4" viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path
                    fill="#4285F4"
                    d="M533.5 278.4c0-18.6-1.5-37.1-4.7-54.8H272v103.6h146.9c-6.3 34-25 62.8-53.5 82.1v68.1h86.3c50.6-46.6 81.8-115.5 81.8-199z"
                  />
                  <path
                    fill="#34A853"
                    d="M272 544.3c72.4 0 133.2-24 177.6-65.1l-86.3-68.1c-24 16.1-54.7 25.6-91.3 25.6-70.2 0-129.7-47.4-151-111.1H34.6v69.8C78.6 483 167 544.3 272 544.3z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M121 323.7c-10.7-31.9-10.7-66.3 0-98.2V155.7H34.6c-38.5 75.6-38.5 164.7 0 240.3L121 323.7z"
                  />
                  <path
                    fill="#EA4335"
                    d="M272 107.7c39.4 0 74.9 13.6 102.8 40.3l77.1-77.1C405.2 24 344.4 0 272 0 167 0 78.6 61.3 34.6 155.7l86.4 69.8C142.3 155.1 201.8 107.7 272 107.7z"
                  />
                </svg>
                <span className="font-medium">Continue with Google</span>
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/60" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white/80 dark:bg-slate-900/80 px-2 text-muted-foreground">Or login with email</span>
                </div>
              </div>

              {/* Email / password login */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2 text-left">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-10"
                  />
                </div>
                <div className="space-y-2 text-left">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-end text-xs">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-primary hover:text-primary/80 hover:underline font-medium transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 font-semibold text-base shadow-sm"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span> Signing in...
                    </>
                  ) : "Login"}
                </Button>
              </form>
            </div>
          </Card>
        </motion.div>

        {/* Right Side - SM Logo */}
        <motion.div
          initial={{ opacity: 0, x: 50, rotateY: 20 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="hidden md:flex flex-col items-center justify-center p-12 rounded-3xl backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-white/40 shadow-2xl hover:bg-white/70 dark:hover:bg-slate-900/70 transition-all duration-500 group [perspective:1000px] overflow-hidden"
          style={{ transformStyle: "preserve-3d" }}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse"></div>
            <motion.div
              animate={{ rotateY: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              style={{ transformStyle: "preserve-3d" }}
            >
              <img
                src="/images/Picsart_23-05-18_16-47-20-287-removebg-preview.png"
                alt="SM Volunteers Logo"
                className="w-64 h-64 object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative z-10 group-hover:scale-110 transition-transform duration-500"
                onError={(e) => {
                  const fallback = '/images/Brand_logo.png';
                  if (!e.currentTarget.src.includes(fallback)) {
                    e.currentTarget.src = fallback;
                  }
                }}
              />
            </motion.div>
          </div>
          <motion.div
            className="text-center mt-8 space-y-2"
            animate={{ translateZ: 50 }}
          >
            <h2 className="text-4xl font-black bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent drop-shadow-sm">
              SM Volunteers
            </h2>
            <p className="text-muted-foreground font-bold tracking-widest uppercase text-xs">
              Fostering Society
            </p>
            <div className="pt-4">
              <span className="text-xs px-4 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold italic">
                "Service above self"
              </span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>You must change your password before continuing.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4 mt-4">
            <div className="space-y-2 text-left">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={5}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={5}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Changing..." : "Change Password"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Forgot Password?</DialogTitle>
            <DialogDescription className="text-sm">
              No worries! Enter your registered email address and we'll send you a 6-digit OTP to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-5 mt-4">
            <div className="space-y-2 text-left">
              <Label htmlFor="forgotEmail" className="text-sm font-medium">Email Address</Label>
              <Input
                id="forgotEmail"
                type="email"
                placeholder="you@example.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                className="h-11"
              />
              <p className="text-xs text-muted-foreground mt-1">
                We'll send a one-time password to this email
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowForgotPassword(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Sending...
                  </>
                ) : "Send OTP"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetPassword} onOpenChange={setShowResetPassword}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Reset Your Password</DialogTitle>
            <DialogDescription className="text-sm">
              We've sent a 6-digit OTP to <span className="font-semibold text-foreground">{maskEmail(resetEmail)}</span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-5 mt-4">
            {/* Step Indicator */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  1
                </div>
                <span className="font-medium">Enter OTP from your email</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-border text-xs">
                  2
                </div>
                <span>Set new password</span>
              </div>
            </div>

            <div className="space-y-2 text-left">
              <Label htmlFor="otp" className="text-sm font-medium">One-Time Password (OTP)</Label>
              <Input
                id="otp"
                type="text"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
                className="h-11 text-center text-lg tracking-widest font-mono"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  OTP expires in 10 minutes
                </p>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={handleResendOTP}
                  disabled={resendCooldown > 0 || loading}
                  className="h-auto p-0 text-xs"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                </Button>
              </div>
            </div>

            <div className="space-y-2 text-left">
              <Label htmlFor="newResetPassword" className="text-sm font-medium">New Password</Label>
              <div className="relative">
                <Input
                  id="newResetPassword"
                  type={showNewResetPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newResetPassword}
                  onChange={(e) => setNewResetPassword(e.target.value)}
                  required
                  minLength={5}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewResetPassword(!showNewResetPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Must be at least 5 characters
              </p>
            </div>

            <div className="space-y-2 text-left">
              <Label htmlFor="confirmResetPassword" className="text-sm font-medium">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmResetPassword"
                  type={showConfirmResetPassword ? "text" : "password"}
                  placeholder="Re-enter new password"
                  value={confirmResetPassword}
                  onChange={(e) => setConfirmResetPassword(e.target.value)}
                  required
                  minLength={5}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmResetPassword(!showConfirmResetPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowResetPassword(false);
                  setOtp("");
                  setNewResetPassword("");
                  setConfirmResetPassword("");
                  setResendCooldown(0);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Resetting...
                  </>
                ) : "Reset Password"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
