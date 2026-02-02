import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import MainLayout from "@/components/layout/MainLayout";
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
import StudentProjects from "./pages/StudentProjects";
import StudentBills from "./pages/StudentBills";
import StudentReports from "./pages/StudentReports";
import ManageUsers from "./pages/ManageUsers";
import ManageMeetings from "./pages/ManageMeetings";
import ManageBills from "./pages/ManageBills";
import Analytics from "./pages/Analytics";
import ManageStudents from "./pages/ManageStudents";
import StudentDetails from "./pages/StudentDetails";
import ManageStudentDatabase from "./pages/ManageStudentDatabase";
import ManageProjects from "./pages/ManageProjects";
import AssignProjectStudents from "./pages/AssignProjectStudents";
import ProjectDetails from "./pages/ProjectDetails";
import ManageOfficeBearers from "./pages/ManageOfficeBearers";
import ManageAttendance from "./pages/ManageAttendance";
import AttendanceDetails from "./pages/AttendanceDetails";
import AttendanceProjects from "./pages/AttendanceProjects";
import AttendanceMeetings from "./pages/AttendanceMeetings";
import AttendanceEvents from "./pages/AttendanceEvents";
import ManageMentors from "./pages/MentorManagement";
import MenteeDetails from "./pages/MenteeDetails";
import Settings from "./pages/Settings";
import ManageQuestions from "./pages/ManageQuestions";
import StudentFeedback from "./pages/StudentFeedback";
import ViewFeedbackReports from "./pages/ViewFeedbackReports";
import VolunteerRegistration from "./pages/VolunteerRegistration";
import ManageVolunteers from "./pages/ManageVolunteers";
import AdminMessages from "./pages/AdminMessages";
import ManageEvents from "./pages/ManageEvents";
import EventDetails from "./pages/EventDetails";
import ManageAwards from "./pages/ManageAwards";
import AdminResources from "./pages/AdminResources";
import Resources from "./pages/Resources";
import Reports from "./pages/Reports";
import ManageTeams from "./pages/ManageTeams";
import StudentTeams from "./pages/StudentTeams";
import NotFound from "./pages/NotFound";
import MentorManagement from "./pages/MentorManagement";
import PhoneMentoringUpdate from "./pages/PhoneMentoringUpdate";
import StudentMessages from "./pages/StudentMessages";
import StudentEvents from "./pages/StudentEvents";
import Announcements from "./pages/Announcements";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Routes>
          {/* Public Routes wrapped in MainLayout (Public Variant) */}
          <Route element={<MainLayout showSidebar={false} />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/volunteer-registration" element={<VolunteerRegistration />} />
          </Route>

          {/* Authenticated Routes wrapped in MainLayout (Private Variant) */}
          <Route element={<MainLayout />}>
            <Route path="/home" element={<Index />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<ProtectedRoute requiredPermission="can_manage_users"><ManageUsers /></ProtectedRoute>} />
            <Route path="/admin/meetings" element={<ProtectedRoute requiredPermission="can_manage_meetings"><ManageMeetings /></ProtectedRoute>} />
            <Route path="/admin/bills" element={<ProtectedRoute requiredPermission="can_manage_bills"><ManageBills /></ProtectedRoute>} />
            <Route path="/admin/analytics" element={<ProtectedRoute requiredPermission="can_view_analytics"><Analytics /></ProtectedRoute>} />
            <Route path="/admin/students" element={<ProtectedRoute requiredPermission="can_manage_students"><ManageStudents /></ProtectedRoute>} />
            <Route path="/admin/students/:id" element={<ProtectedRoute requiredPermission="can_manage_students"><StudentDetails /></ProtectedRoute>} />
            <Route path="/admin/student-db" element={<ProtectedRoute requiredPermission="can_manage_student_db"><ManageStudentDatabase /></ProtectedRoute>} />
            <Route path="/admin/projects" element={<ProtectedRoute requiredPermission="can_manage_projects"><ManageProjects /></ProtectedRoute>} />
            <Route path="/admin/projects/:id/assign" element={<ProtectedRoute requiredPermission="can_manage_projects"><AssignProjectStudents /></ProtectedRoute>} />
            <Route path="/admin/projects/:id" element={<ProtectedRoute blockedRoles={['student']}><ProjectDetails /></ProtectedRoute>} />
            <Route path="/admin/office-bearers" element={<ProtectedRoute requiredRoles={['admin']}><ManageOfficeBearers /></ProtectedRoute>} />
            <Route path="/admin/attendance" element={<ProtectedRoute requiredPermission="can_manage_attendance"><ManageAttendance /></ProtectedRoute>} />
            <Route path="/admin/attendance/projects" element={<ProtectedRoute requiredPermission="can_manage_attendance"><AttendanceProjects /></ProtectedRoute>} />
            <Route path="/admin/attendance/meetings" element={<ProtectedRoute requiredPermission="can_manage_attendance"><AttendanceMeetings /></ProtectedRoute>} />
            <Route path="/admin/attendance/events" element={<ProtectedRoute requiredPermission="can_manage_attendance"><AttendanceEvents /></ProtectedRoute>} />
            <Route path="/admin/attendance/:type/:id" element={<ProtectedRoute requiredPermission="can_manage_attendance"><AttendanceDetails /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute requiredPermission="can_manage_settings"><Settings /></ProtectedRoute>} />
            <Route path="/admin/feedback/questions" element={<ProtectedRoute requiredPermission="can_manage_feedback_questions"><ManageQuestions /></ProtectedRoute>} />
            <Route path="/admin/feedback/reports" element={<ProtectedRoute requiredPermission="can_manage_feedback_reports"><ViewFeedbackReports /></ProtectedRoute>} />
            <Route path="/admin/volunteers" element={<ProtectedRoute requiredPermission="can_manage_volunteers"><ManageVolunteers /></ProtectedRoute>} />
            <Route path="/admin/resources" element={<ProtectedRoute requiredPermission="can_manage_resources"><AdminResources /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute requiredPermission="can_view_reports"><Reports /></ProtectedRoute>} />
            <Route path="/admin/teams" element={<ProtectedRoute requiredPermission="can_manage_teams"><ManageTeams /></ProtectedRoute>} />
            <Route path="/admin/mentor-management" element={<ProtectedRoute requiredRoles={['admin']}><MentorManagement /></ProtectedRoute>} />
            <Route path="/admin/mentees/:projectId/:id" element={<ProtectedRoute requiredRoles={['admin']}><MenteeDetails /></ProtectedRoute>} />
            <Route path="/admin/messages" element={<ProtectedRoute requiredPermission="can_manage_messages"><AdminMessages /></ProtectedRoute>} />
            <Route path="/admin/events" element={<ProtectedRoute requiredPermission="can_manage_events"><ManageEvents /></ProtectedRoute>} />
            <Route path="/admin/events/:id" element={<EventDetails />} />
            <Route path="/admin/awards" element={<ProtectedRoute requiredPermission="can_manage_events"><ManageAwards /></ProtectedRoute>} />
            <Route path="/admin/announcements" element={<ProtectedRoute requiredPermission="can_manage_announcements"><Announcements /></ProtectedRoute>} />
            {/* Student Assignments removed */}
            <Route path="/resources" element={<Resources />} />
            <Route path="/office-bearer" element={<OfficeBearerDashboard />} />
            <Route path="/office-bearer/profile" element={<OfficeBearerProfile />} />
            <Route path="/office-bearer/settings" element={<Settings />} />
            <Route path="/office-bearer/feedback/questions" element={<ManageQuestions />} />
            <Route path="/office-bearer/feedback/reports" element={<ViewFeedbackReports />} />
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/calendar" element={<StudentDashboard initialTab="calendar" />} />
            <Route path="/student/messages" element={<StudentMessages />} />
            <Route path="/student/profile" element={<StudentProfile />} />
            <Route path="/student/mentees" element={<PhoneMentoringUpdate />} />
            <Route path="/mentor/mentees" element={<PhoneMentoringUpdate />} />
            <Route path="/student/settings" element={<Settings />} />
            <Route path="/student/attendance" element={<StudentAttendance />} />
            <Route path="/student/feedback" element={<StudentFeedback />} />
            <Route path="/student/teams" element={<StudentTeams />} />
            <Route path="/student/events" element={<StudentEvents />} />
            {/* Student management modules removed */}
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
