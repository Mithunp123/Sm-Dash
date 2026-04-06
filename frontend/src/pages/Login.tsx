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
        // Auto-correct role if badge is out of sync (don't block login)
        const actualRole = response.user.role;
        if (actualRole !== activeRole) {
          setActiveRole(actualRole as "admin" | "office_bearer" | "student");
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
        whileHover={{ scale: 1.05, x: -5 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 flex items-center gap-2 text-sm font-bold text-white/80 hover:text-white transition-colors bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/20 shadow-xl z-50 hover:bg-white/15 hover:border-white/40 hover:shadow-2xl"
      >
        <motion.div whileHover={{ x: -2 }} transition={{ type: "spring" }}>
          <ArrowLeft className="w-4 h-4" />
        </motion.div>
        Back to Home
      </motion.button>

      {/* Background - clean dark gradient + glow blobs */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-950 via-[#0d1424] to-slate-900">
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-orange-600/20 to-orange-500/0 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-br from-blue-600/20 to-blue-500/0 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-br from-indigo-900/30 to-purple-900/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Main Layout */}
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center relative z-10">

        {/* LEFT — Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="w-full relative rounded-3xl p-[2px] bg-gradient-to-b from-orange-500/80 via-orange-500/20 to-transparent shadow-[0_0_80px_rgba(249,115,22,0.35),0_0_160px_rgba(249,115,22,0.15),inset_0_0_80px_rgba(249,115,22,0.1)] overflow-hidden group">
            {/* Orange top accent bar with animation */}
            <motion.div
              className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-600 via-orange-400 to-yellow-400 rounded-t-3xl z-20"
              animate={{ boxShadow: ["0 0 20px rgba(249,115,22,0.5)", "0 0 40px rgba(249,115,22,0.8)", "0 0 20px rgba(249,115,22,0.5)"] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <motion.div
              className="w-full rounded-3xl p-8 md:p-10 backdrop-blur-2xl bg-gradient-to-b from-slate-800/95 via-slate-900/98 to-slate-950/95 relative border border-white/5"
              whileHover={{ borderColor: "rgba(255,255,255,0.1)" }}
            >

              {/* Logo + Title */}
              <div className="text-center space-y-3 mb-8">
                <motion.div
                  className="flex justify-center mb-4"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                >
                  <motion.div
                    className="relative"
                    whileHover={{ scale: 1.1 }}
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-orange-500/40 via-orange-600/20 to-transparent blur-2xl rounded-full"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    />
                    <img
                      src="/images/Picsart_23-05-18_16-47-20-287-removebg-preview.png"
                      alt="SM Logo"
                      className="w-16 h-16 object-contain relative z-10 drop-shadow-[0_10px_30px_rgba(249,115,22,0.4)]"
                      onError={(e) => { e.currentTarget.src = '/images/Brand_logo.png'; }}
                    />
                  </motion.div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                    <span className="text-orange-600">SM</span>{" "}
                    <span className="bg-gradient-to-r from-orange-400 via-orange-300 to-yellow-300 bg-clip-text text-transparent">Volunteers</span>
                  </h1>
                </motion.div>
                <motion.p
                  className="text-sm text-slate-400"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  Login to manage your <span className="text-orange-300 font-semibold">events, attendance &amp; volunteering</span>
                </motion.p>
              </div>

              {/* Role Badge (auto-detected) */}
              <motion.div
                className="flex justify-center mb-6"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35, type: "spring" }}
              >
                <motion.div
                  layoutId="role-badge"
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border backdrop-blur-sm flex items-center gap-2 transition-all shadow-lg",
                    activeRole === 'admin' ? 'bg-gradient-to-r from-red-500/20 to-red-600/10 border-red-400/50 text-red-200 shadow-red-500/20' :
                      activeRole === 'office_bearer' ? 'bg-gradient-to-r from-blue-500/20 to-blue-600/10 border-blue-400/50 text-blue-200 shadow-blue-500/20' :
                        'bg-gradient-to-r from-orange-500/20 to-orange-600/10 border-orange-400/50 text-orange-200 shadow-orange-500/20'
                  )}
                >
                  <motion.span animate={{ rotate: [0, 10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                    {activeRole === 'office_bearer' ? '🎖' : activeRole === 'admin' ? '🛡' : '🤝'}
                  </motion.span>
                  {activeRole === 'office_bearer' ? 'Office Bearer' : activeRole === 'admin' ? 'Admin' : 'Student Volunteer'}
                </motion.div>
              </motion.div>

              {/* Email / password login */}
              <form onSubmit={handleLogin} className="space-y-5">
                <motion.div className="space-y-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <label htmlFor="email" className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <span className="inline-flex w-5 h-5 rounded-full bg-orange-500/20 items-center justify-center text-xs">@</span>
                    Email Address
                  </label>
                  <motion.div whileHover={{ scale: 1.01 }} className="overflow-hidden rounded-xl">
                    <input
                      id="email"
                      type="email"
                      placeholder="you@ksrct.ac.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full h-12 px-4 rounded-xl bg-gradient-to-r from-white/15 to-white/10 border border-white/40 text-white placeholder-slate-300 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/50 transition-all text-sm backdrop-blur-sm shadow-md hover:border-white/50 hover:bg-gradient-to-r hover:from-white/20 hover:to-white/15"
                    />
                  </motion.div>
                </motion.div>
                <motion.div className="space-y-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                  <label htmlFor="password" className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <span className="inline-flex w-5 h-5 rounded-full bg-orange-500/20 items-center justify-center text-xs">🔒</span>
                    Password
                  </label>
                  <div className="relative overflow-hidden rounded-xl">
                    <motion.input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Enter your password"
                      whileHover={{ scale: 1.01 }}
                      className="w-full h-12 px-4 pr-12 rounded-xl bg-gradient-to-r from-white/15 to-white/10 border border-white/40 text-white placeholder-slate-300 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/50 transition-all text-sm backdrop-blur-sm shadow-md hover:border-white/50 hover:bg-gradient-to-r hover:from-white/20 hover:to-white/15"
                    />
                    <motion.button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.95 }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-orange-400 transition-colors font-semibold"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </motion.button>
                  </div>
                </motion.div>

                <motion.div className="flex justify-end pt-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                  <motion.button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="text-xs text-orange-400 hover:text-orange-300 font-medium transition-all relative group"
                  >
                    Forgot Password?
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-orange-400 to-orange-300 group-hover:w-full transition-all duration-300" />
                  </motion.button>
                </motion.div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.02, boxShadow: "0 20px 40px rgba(249,115,22,0.5)" }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full h-12 rounded-xl font-bold text-base text-white bg-gradient-to-r from-orange-500 via-orange-400 to-yellow-500 shadow-lg shadow-orange-500/30 hover:shadow-orange-500/60 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative group overflow-hidden"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-orange-600 via-orange-500 to-yellow-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    initial={false}
                  />
                  <span className="relative z-10">
                    {loading ? (
                      <><motion.span className="inline-block" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>⏳</motion.span> Signing in...</>
                    ) : "Login →"}
                  </span>
                </motion.button>

                {/* Compliance agreement */}
                <p className="text-center text-[11px] text-slate-500 mt-2 leading-relaxed">
                  By logging in, you agree to our{" "}
                  <a href="/terms" className="text-orange-400 hover:text-orange-300 underline underline-offset-2 transition-colors">Terms of Service</a>
                  {" "}and{" "}
                  <a href="/privacy" className="text-orange-400 hover:text-orange-300 underline underline-offset-2 transition-colors">Privacy Policy</a>.
                </p>
              </form>

              {/* Divider */}
              <motion.div className="relative my-7" initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ delay: 0.25 }}>
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-gradient-to-r from-slate-900/70 via-slate-900/90 to-slate-900/70 px-3 text-slate-500 tracking-widest font-medium">Or continue with</span>
                </div>
              </motion.div>

              {/* Google Login */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98, y: 0 }}
                className="w-full h-12 rounded-xl border-2 border-slate-600/50 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-white font-semibold flex items-center justify-center gap-3 transition-all text-sm shadow-lg backdrop-blur-sm group relative overflow-hidden"
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
                <motion.div whileHover={{ scale: 1.2, rotate: 15 }} whileTap={{ scale: 0.9 }} className="relative z-10">
                  <svg className="w-5 h-5" viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path fill="#4285F4" d="M533.5 278.4c0-18.6-1.5-37.1-4.7-54.8H272v103.6h146.9c-6.3 34-25 62.8-53.5 82.1v68.1h86.3c50.6-46.6 81.8-115.5 81.8-199z" />
                    <path fill="#34A853" d="M272 544.3c72.4 0 133.2-24 177.6-65.1l-86.3-68.1c-24 16.1-54.7 25.6-91.3 25.6-70.2 0-129.7-47.4-151-111.1H34.6v69.8C78.6 483 167 544.3 272 544.3z" />
                    <path fill="#FBBC05" d="M121 323.7c-10.7-31.9-10.7-66.3 0-98.2V155.7H34.6c-38.5 75.6-38.5 164.7 0 240.3L121 323.7z" />
                    <path fill="#EA4335" d="M272 107.7c39.4 0 74.9 13.6 102.8 40.3l77.1-77.1C405.2 24 344.4 0 272 0 167 0 78.6 61.3 34.6 155.7l86.4 69.8C142.3 155.1 201.8 107.7 272 107.7z" />
                  </svg>
                </motion.div>
                <span className="relative z-10 group-hover:text-white transition-colors">Continue with Google</span>
              </motion.button>

            </motion.div>
          </div>
        </motion.div>

        {/* RIGHT — Branding Panel */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="hidden md:flex flex-col items-center justify-center gap-8 text-center relative z-10"
        >
          {/* Logo floating with enhanced animations */}
          <motion.div
            animate={{ y: [0, -16, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-orange-600/50 via-orange-500/30 to-yellow-600/20 blur-3xl rounded-full scale-150"
              animate={{
                scale: [1.2, 1.4, 1.2],
                opacity: [0.4, 0.7, 0.4]
              }}
              transition={{ duration: 4, repeat: Infinity }}
            />
            <img
              src="/images/Picsart_23-05-18_16-47-20-287-removebg-preview.png"
              alt="SM Volunteers Logo"
              className="w-52 h-52 object-contain relative z-10 drop-shadow-[0_30px_80px_rgba(249,115,22,0.6)]"
              onError={(e) => { e.currentTarget.src = '/images/Brand_logo.png'; }}
            />
          </motion.div>

          {/* Text */}
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-5xl font-black tracking-tight">
              <span className="text-orange-600">SM</span>{" "}
              <span className="bg-gradient-to-r from-orange-400 via-orange-300 to-yellow-300 bg-clip-text text-transparent">Volunteers</span>
            </h2>
            <p className="text-slate-400 font-medium tracking-widest uppercase text-sm">
              K.S.Rangasamy College of Technology
            </p>
            <motion.div
              className="pt-2"
              whileHover={{ scale: 1.05 }}
            >
              <span className="text-sm px-6 py-2.5 rounded-full bg-gradient-to-r from-orange-500/20 to-orange-600/10 text-orange-200 border border-orange-500/40 font-bold italic shadow-lg">
                "Service above self"
              </span>
            </motion.div>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {[
              { value: '4+', label: 'Years' },
              { value: '1000+', label: 'Volunteers' },
              { value: '100+', label: 'Events' },
            ].map((s, idx) => (
              <motion.div
                key={s.label}
                className="bg-gradient-to-b from-white/10 to-white/5 backdrop-blur border border-white/10 rounded-2xl p-4 text-center hover:border-orange-400/50 transition-all cursor-pointer group"
                whileHover={{ scale: 1.05, borderColor: "rgba(249,115,22,0.5)" }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + idx * 0.1 }}
              >
                <div className="text-2xl font-black bg-gradient-to-r from-orange-400 via-orange-300 to-yellow-300 bg-clip-text text-transparent group-hover:via-yellow-300 transition-all">{s.value}</div>
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1 group-hover:text-slate-300 transition-colors">{s.label}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* NGO pills */}
          <motion.div
            className="flex flex-wrap justify-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {['Bhumi', 'TQI', 'Atchayam Trust', 'Sittruli'].map((ngo, idx) => (
              <motion.span
                key={ngo}
                className="text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-500/20 to-blue-600/10 text-blue-200 border border-blue-500/40 font-medium hover:border-blue-400/60 transition-all cursor-pointer shadow-md"
                whileHover={{ scale: 1.08, y: -2 }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.75 + idx * 0.05 }}
              >
                {ngo}
              </motion.span>
            ))}
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
