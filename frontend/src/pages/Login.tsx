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
    <div className="flex-1 flex items-center justify-center p-4 md:p-8 min-h-screen relative overflow-y-auto overflow-x-hidden no-scrollbar">
      {/* Back Button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 flex items-center gap-2 text-sm font-bold text-white/80 hover:text-white transition-colors bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-xl z-50 hover:bg-white/20"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </motion.button>

      {/* Background - clean dark gradient + glow blobs */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-950 via-[#0d1424] to-slate-900">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-indigo-900/20 rounded-full blur-3xl" />
      </div>

      {/* Main Layout */}
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center relative z-10">

        {/* LEFT — Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="w-full relative rounded-3xl p-[1.5px] bg-gradient-to-b from-orange-500/60 via-orange-500/10 to-transparent shadow-[0_0_60px_rgba(249,115,22,0.25),0_0_120px_rgba(249,115,22,0.1)] overflow-hidden">
            {/* Orange top accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 via-orange-400 to-yellow-400 rounded-t-3xl z-20" />
            <div className="w-full rounded-3xl p-8 md:p-10 backdrop-blur-2xl bg-gradient-to-b from-slate-800/90 via-slate-900/95 to-slate-950/90">

              {/* Logo + Title */}
              <div className="text-center space-y-3 mb-8">
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-orange-500/30 blur-xl rounded-full" />
                    <img
                      src="/images/Picsart_23-05-18_16-47-20-287-removebg-preview.png"
                      alt="SM Logo"
                      className="w-16 h-16 object-contain relative z-10 drop-shadow-lg"
                      onError={(e) => { e.currentTarget.src = '/images/Brand_logo.png'; }}
                    />
                  </div>
                </div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                  <span className="text-orange-600">SM</span>{" "}
                  <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">Volunteers</span>
                </h1>
                <p className="text-sm text-slate-400">
                  Login to manage your <span className="text-orange-300 font-semibold">events, attendance &amp; volunteering</span>
                </p>
              </div>

              {/* Role Badge (auto-detected) */}
              <div className="flex justify-center mb-6">
                <div className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border",
                  activeRole === 'admin' ? 'bg-red-500/20 border-red-400/40 text-red-300' :
                    activeRole === 'office_bearer' ? 'bg-blue-500/20 border-blue-400/40 text-blue-300' :
                      'bg-orange-500/20 border-orange-400/40 text-orange-300'
                )}>
                  {activeRole === 'office_bearer' ? '🎖 Office Bearer' : activeRole === 'admin' ? '🛡 Admin' : '🤝 Student Volunteer'}
                </div>
              </div>

              {/* Email / password login */}
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-semibold text-slate-300">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@ksrct.ac.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-orange-400/60 focus:ring-2 focus:ring-orange-500/20 transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-semibold text-slate-300">Password</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Enter your password"
                      className="w-full h-12 px-4 pr-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-orange-400/60 focus:ring-2 focus:ring-orange-500/20 transition-all text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-400 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs text-orange-400 hover:text-orange-300 hover:underline font-medium transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full h-12 rounded-xl font-bold text-base text-white bg-gradient-to-r from-orange-500 via-orange-400 to-yellow-500 shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><span className="animate-spin">⏳</span> Signing in...</>
                  ) : "Login →"}
                </motion.button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-900/70 px-3 text-slate-500 tracking-widest">Or continue with</span>
                </div>
              </div>

              {/* Google Login */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full h-12 rounded-xl border border-slate-600 bg-white hover:bg-slate-100 text-slate-800 font-semibold flex items-center justify-center gap-3 transition-all text-sm shadow-md"
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
                <svg className="w-5 h-5" viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path fill="#4285F4" d="M533.5 278.4c0-18.6-1.5-37.1-4.7-54.8H272v103.6h146.9c-6.3 34-25 62.8-53.5 82.1v68.1h86.3c50.6-46.6 81.8-115.5 81.8-199z" />
                  <path fill="#34A853" d="M272 544.3c72.4 0 133.2-24 177.6-65.1l-86.3-68.1c-24 16.1-54.7 25.6-91.3 25.6-70.2 0-129.7-47.4-151-111.1H34.6v69.8C78.6 483 167 544.3 272 544.3z" />
                  <path fill="#FBBC05" d="M121 323.7c-10.7-31.9-10.7-66.3 0-98.2V155.7H34.6c-38.5 75.6-38.5 164.7 0 240.3L121 323.7z" />
                  <path fill="#EA4335" d="M272 107.7c39.4 0 74.9 13.6 102.8 40.3l77.1-77.1C405.2 24 344.4 0 272 0 167 0 78.6 61.3 34.6 155.7l86.4 69.8C142.3 155.1 201.8 107.7 272 107.7z" />
                </svg>
                <span>Continue with Google</span>
              </motion.button>

            </div>
          </div>
        </motion.div>

        {/* RIGHT — Branding Panel */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="hidden md:flex flex-col items-center justify-center gap-8 text-center"
        >
          {/* Logo floating */}
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            <div className="absolute inset-0 bg-orange-500/30 blur-3xl rounded-full scale-150" />
            <img
              src="/images/Picsart_23-05-18_16-47-20-287-removebg-preview.png"
              alt="SM Volunteers Logo"
              className="w-52 h-52 object-contain relative z-10 drop-shadow-[0_20px_60px_rgba(249,115,22,0.5)]"
              onError={(e) => { e.currentTarget.src = '/images/Brand_logo.png'; }}
            />
          </motion.div>

          {/* Text */}
          <div className="space-y-3">
            <h2 className="text-5xl font-black tracking-tight">
              <span className="text-orange-600">SM</span>{" "}
              <span className="bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">Volunteers</span>
            </h2>
            <p className="text-slate-400 font-medium tracking-widest uppercase text-sm">
              K.S.Rangasamy College of Technology
            </p>
            <div className="pt-2">
              <span className="text-sm px-6 py-2.5 rounded-full bg-orange-500/10 text-orange-300 border border-orange-500/30 font-bold italic">
                "Service above self"
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-sm">
            {[
              { value: '4+', label: 'Years' },
              { value: '1000+', label: 'Volunteers' },
              { value: '100+', label: 'Events' },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-4 text-center">
                <div className="text-2xl font-black bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">{s.value}</div>
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* NGO pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {['Bhumi', 'TQI', 'Atchayam Trust', 'Sittruli'].map(ngo => (
              <span key={ngo} className="text-xs px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                {ngo}
              </span>
            ))}
          </div>
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
                <Input id="currentPassword" type={showCurrentPassword ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input id="newPassword" type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={5} />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={5} />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Changing..." : "Change Password"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Forgot Password?</DialogTitle>
            <DialogDescription className="text-sm">Enter your registered email and we'll send you a 6-digit OTP.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-5 mt-4">
            <div className="space-y-2 text-left">
              <Label htmlFor="forgotEmail" className="text-sm font-medium">Email Address</Label>
              <Input id="forgotEmail" type="email" placeholder="you@example.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required className="h-11" />
              <p className="text-xs text-muted-foreground mt-1">We'll send a one-time password to this email</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForgotPassword(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={loading}>{loading ? (<><span className="animate-spin mr-2">⏳</span>Sending...</>) : "Send OTP"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetPassword} onOpenChange={setShowResetPassword}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Reset Your Password</DialogTitle>
            <DialogDescription className="text-sm">We've sent a 6-digit OTP to <span className="font-semibold text-foreground">{maskEmail(resetEmail)}</span></DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-5 mt-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm"><div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</div><span className="font-medium">Enter OTP from your email</span></div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-border text-xs">2</div><span>Set new password</span></div>
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="otp" className="text-sm font-medium">One-Time Password (OTP)</Label>
              <Input id="otp" type="text" placeholder="Enter 6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} required maxLength={6} className="h-11 text-center text-lg tracking-widest font-mono" />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">OTP expires in 10 minutes</p>
                <Button type="button" variant="link" size="sm" onClick={handleResendOTP} disabled={resendCooldown > 0 || loading} className="h-auto p-0 text-xs">{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}</Button>
              </div>
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="newResetPassword" className="text-sm font-medium">New Password</Label>
              <div className="relative">
                <Input id="newResetPassword" type={showNewResetPassword ? "text" : "password"} placeholder="Enter new password" value={newResetPassword} onChange={(e) => setNewResetPassword(e.target.value)} required minLength={5} className="h-11 pr-10" />
                <button type="button" onClick={() => setShowNewResetPassword(!showNewResetPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showNewResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
              <p className="text-xs text-muted-foreground">Must be at least 5 characters</p>
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="confirmResetPassword" className="text-sm font-medium">Confirm New Password</Label>
              <div className="relative">
                <Input id="confirmResetPassword" type={showConfirmResetPassword ? "text" : "password"} placeholder="Re-enter new password" value={confirmResetPassword} onChange={(e) => setConfirmResetPassword(e.target.value)} required minLength={5} className="h-11 pr-10" />
                <button type="button" onClick={() => setShowConfirmResetPassword(!showConfirmResetPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showConfirmResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowResetPassword(false); setOtp(""); setNewResetPassword(""); setConfirmResetPassword(""); setResendCooldown(0); }}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={loading}>{loading ? (<><span className="animate-spin mr-2">⏳</span>Resetting...</>) : "Reset Password"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
