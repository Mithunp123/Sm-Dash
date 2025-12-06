import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import OfficeBearerDashboard from "./pages/OfficeBearerDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import StudentProfile from "./pages/StudentProfile";
import StudentAttendance from "./pages/StudentAttendance";
import OfficeBearerProfile from "./pages/OfficeBearerProfile";
// SPOC pages removed
import ManageUsers from "./pages/ManageUsers";
import ManageMeetings from "./pages/ManageMeetings";
import ManageBills from "./pages/ManageBills";
import Analytics from "./pages/Analytics";
import ManageStudents from "./pages/ManageStudents";
import ManageStudentDatabase from "./pages/ManageStudentDatabase";
import ManageProjects from "./pages/ManageProjects";
import ManageOfficeBearers from "./pages/ManageOfficeBearers";
import ManageAttendance from "./pages/ManageAttendance";
import ManagePermissions from "./pages/ManagePermissions";
import Settings from "./pages/Settings";
import ManageQuestions from "./pages/ManageQuestions";
import StudentFeedback from "./pages/StudentFeedback";
import ViewFeedbackReports from "./pages/ViewFeedbackReports";
import VolunteerRegistration from "./pages/VolunteerRegistration";
import ManageVolunteers from "./pages/ManageVolunteers";
import AdminMessages from "./pages/AdminMessages";
import ManageEvents from "./pages/ManageEvents";
import AdminResources from "./pages/AdminResources";
import Resources from "./pages/Resources";
import Reports from "./pages/Reports";
import ManageTeams from "./pages/ManageTeams";
import StudentTeams from "./pages/StudentTeams";
import NotFound from "./pages/NotFound";
import MentorManagement from "./pages/MentorManagement";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
  <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/home" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/volunteer-registration" element={<VolunteerRegistration />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<ManageUsers />} />
          <Route path="/admin/meetings" element={<ProtectedRoute blockedRoles={['student']}><ManageMeetings /></ProtectedRoute>} />
          <Route path="/admin/bills" element={<ManageBills />} />
          <Route path="/admin/analytics" element={<Analytics />} />
          <Route path="/admin/students" element={<ManageStudents />} />
          <Route path="/admin/student-db" element={<ManageStudentDatabase />} />
          <Route path="/admin/projects" element={<ProtectedRoute blockedRoles={['student']}><ManageProjects /></ProtectedRoute>} />
          <Route path="/admin/office-bearers" element={<ManageOfficeBearers />} />
          <Route path="/admin/attendance" element={<ManageAttendance />} />
          <Route path="/admin/permissions" element={<ManagePermissions />} />
          <Route path="/admin/settings" element={<Settings />} />
          <Route path="/admin/feedback/questions" element={<ManageQuestions />} />
          <Route path="/admin/feedback/reports" element={<ViewFeedbackReports />} />
          <Route path="/admin/volunteers" element={<ManageVolunteers />} />
          <Route path="/admin/resources" element={<AdminResources />} />
          <Route path="/admin/reports" element={<Reports />} />
          <Route path="/admin/teams" element={<ManageTeams />} />
          <Route path="/admin/mentor-management" element={<MentorManagement />} />
          <Route path="/admin/messages" element={<AdminMessages />} />
          <Route path="/admin/events" element={<ManageEvents />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/office-bearer" element={<OfficeBearerDashboard />} />
          <Route path="/office-bearer/profile" element={<OfficeBearerProfile />} />
          <Route path="/office-bearer/settings" element={<Settings />} />
          <Route path="/office-bearer/feedback/questions" element={<ManageQuestions />} />
          <Route path="/office-bearer/feedback/reports" element={<ViewFeedbackReports />} />
          {/* SPOC routes removed */}
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/calendar" element={<StudentDashboard initialTab="calendar" />} />
          <Route path="/student/messages" element={<StudentDashboard initialTab="messages" />} />
          <Route path="/student/profile" element={<StudentProfile />} />
          <Route path="/student/settings" element={<Settings />} />
          <Route path="/student/attendance" element={<StudentAttendance />} />
          <Route path="/student/feedback" element={<StudentFeedback />} />
          <Route path="/student/teams" element={<StudentTeams />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
