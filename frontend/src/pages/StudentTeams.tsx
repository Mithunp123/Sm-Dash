import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { auth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import {
  Users,
  UserPlus,
  ClipboardList,
  CheckCircle2,
  Clock,
  Calendar,
  Send,
  Upload,
  FileImage,
  X,
  Plus,
  AlertCircle,
  Bell,
  RefreshCw,
  ChevronRight,
  ArrowLeft
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Team {
  id: number;
  name: string;
  description?: string;
  member_count?: number;
  assignment_count?: number;
  created_at?: string;
}

interface TeamRequest {
  id: number;
  team_id: number;
  team_name: string;
  status: 'pending' | 'approved' | 'rejected';
  message?: string;
  created_at: string;
}

interface Assignment {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  team_id: number;
  team_name?: string;
  assigned_to?: number;
  due_date?: string;
  proof_file_path?: string;
}

interface TeamDetail extends Team {
  members?: any[];
  assignments?: Assignment[];
}

// ─── Main Component ───────────────────────────────────────────────────────────
const StudentTeams = () => {
  const navigate = useNavigate();
  const currentUser = auth.getUser();

  // ── Tab & View State
  const [activeTab, setActiveTab] = useState<'myteams' | 'available' | 'assignments'>('myteams');
  const [selectedTeam, setSelectedTeam] = useState<TeamDetail | null>(null);

  // ── Data State
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [myAssignments, setMyAssignments] = useState<Assignment[]>([]);
  const [myRequests, setMyRequests] = useState<TeamRequest[]>([]);
  const [userTeamMembership, setUserTeamMembership] = useState<{ [key: number]: any }>({});
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedTeamForRequest, setSelectedTeamForRequest] = useState<Team | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestingTeamId, setRequestingTeamId] = useState<number | null>(null);

  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedAssignmentForProof, setSelectedAssignmentForProof] = useState<Assignment | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({ title: "", description: "", assigned_to: "", due_date: "", priority: "medium" });

  const [showAddMember, setShowAddMember] = useState(false);
  const [memberForm, setMemberForm] = useState({ user_id: "", role: "member" });

  // ─── Auth check ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate('/login');
      return;
    }
    loadAll();
    loadUsers();
  }, []);

  // ─── Load All Data ───────────────────────────────────────────────────────────
  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadMyTeams(), loadAvailableTeams(), loadMyAssignments(), loadMyRequests()]);
    setLoading(false);
  };

  const loadMyTeams = async () => {
    try {
      const res = await fetch(`${API_BASE}/teams/my-teams`, {
        headers: { Authorization: `Bearer ${auth.getToken()}` }
      });
      const data = await res.json();
      if (data.success) {
        setMyTeams(data.teams || []);
        // Load membership roles
        const membershipData: { [key: number]: any } = {};
        for (const team of data.teams || []) {
          try {
            const teamRes = await fetch(`${API_BASE}/teams/${team.id}`, {
              headers: { Authorization: `Bearer ${auth.getToken()}` }
            });
            const teamData = await teamRes.json();
            if (teamData.success && teamData.members) {
              const userM = teamData.members.find((m: any) => m.user_id === currentUser?.id);
              membershipData[team.id] = userM;
            }
          } catch { /* skip */ }
        }
        setUserTeamMembership(membershipData);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadAvailableTeams = async () => {
    try {
      const res = await fetch(`${API_BASE}/teams/available`, {
        headers: { Authorization: `Bearer ${auth.getToken()}` }
      });
      const data = await res.json();
      if (data.success) {
        setAvailableTeams(data.teams || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadMyAssignments = async () => {
    try {
      const res = await fetch(`${API_BASE}/teams/my-assignments`, {
        headers: { Authorization: `Bearer ${auth.getToken()}` }
      });
      const data = await res.json();
      if (data.success) {
        setMyAssignments(data.assignments || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadMyRequests = async () => {
    try {
      const res = await fetch(`${API_BASE}/teams/my-requests`, {
        headers: { Authorization: `Bearer ${auth.getToken()}` }
      });
      const data = await res.json();
      if (data.success) {
        setMyRequests(data.requests || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users/students`, {
        headers: { Authorization: `Bearer ${auth.getToken()}` }
      });
      const data = await res.json();
      if (data.success) setAllUsers(data.students || data.users || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadTeamDetails = async (teamId: number) => {
    try {
      const res = await fetch(`${API_BASE}/teams/${teamId}`, {
        headers: { Authorization: `Bearer ${auth.getToken()}` }
      });
      const data = await res.json();
      if (data.success) {
        setSelectedTeam({ ...data.team, members: data.members || [], assignments: data.assignments || [] });
      }
    } catch (err) {
      toast.error('Failed to load team details');
    }
  };

  // ─── Request to Join ──────────────────────────────────────────────────────────
  const getPendingRequest = (teamId: number) =>
    myRequests.find(r => r.team_id === teamId && r.status === 'pending');

  const handleRequestJoin = async () => {
    if (!selectedTeamForRequest) return;
    setRequestingTeamId(selectedTeamForRequest.id);
    try {
      const res = await fetch(`${API_BASE}/teams/${selectedTeamForRequest.id}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.getToken()}` },
        body: JSON.stringify({ message: requestMessage.trim() || 'I would like to join this team.' })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Join request sent! Waiting for approval.');
        setShowRequestModal(false);
        setRequestMessage("");
        setSelectedTeamForRequest(null);
        await Promise.all([loadMyRequests(), loadAvailableTeams()]);
      } else {
        toast.error(data.message || 'Failed to send request');
      }
    } catch (err) {
      toast.error('Failed to send request');
    } finally {
      setRequestingTeamId(null);
    }
  };

  // ─── Proof Upload ─────────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'].includes(file.type)) {
      toast.error('Please upload an image (JPG/PNG) or PDF file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) { toast.error('File must be < 5MB'); return; }
    setProofFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setProofPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else { setProofPreview(null); }
  };

  const handleSubmitProof = async () => {
    if (!proofFile || !selectedAssignmentForProof) { toast.error('Please select a proof file'); return; }
    try {
      const formData = new FormData();
      formData.append('proof', proofFile);
      const res = await fetch(`${API_BASE}/teams/${selectedAssignmentForProof.team_id}/assignments/${selectedAssignmentForProof.id}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.getToken()}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Assignment completed!');
        setShowProofModal(false); setProofFile(null); setProofPreview(null); setSelectedAssignmentForProof(null);
        loadMyAssignments();
        if (selectedTeam) loadTeamDetails(selectedTeam.id);
      } else { toast.error(data.message || 'Failed to submit proof'); }
    } catch (err) { toast.error('Failed to submit proof'); }
  };

  // ─── Assignment actions ───────────────────────────────────────────────────────
  const handleUpdateAssignment = async (assignmentId: number, status: string) => {
    const assignment = myAssignments.find(a => a.id === assignmentId) || selectedTeam?.assignments?.find((a: any) => a.id === assignmentId);
    if (!assignment) return;
    if (status === 'completed') { setSelectedAssignmentForProof(assignment); setShowProofModal(true); return; }
    try {
      const res = await fetch(`${API_BASE}/teams/${assignment.team_id}/assignments/${assignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.getToken()}` },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Assignment marked as ${status}`);
        loadMyAssignments();
        if (selectedTeam) loadTeamDetails(selectedTeam.id);
      } else { toast.error(data.message || 'Failed to update assignment'); }
    } catch (err) { toast.error('Failed to update assignment'); }
  };

  const handleCreateAssignment = async () => {
    if (!assignmentForm.title.trim() || !selectedTeam) { toast.error('Assignment title is required'); return; }
    try {
      const res = await fetch(`${API_BASE}/teams/${selectedTeam.id}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.getToken()}` },
        body: JSON.stringify({ ...assignmentForm, assigned_to: assignmentForm.assigned_to ? parseInt(assignmentForm.assigned_to) : null })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Assignment created!');
        setShowCreateAssignment(false);
        setAssignmentForm({ title: "", description: "", assigned_to: "", due_date: "", priority: "medium" });
        loadTeamDetails(selectedTeam.id);
        loadMyAssignments();
      } else { toast.error(data.message || 'Failed to create assignment'); }
    } catch (err) { toast.error('Failed to create assignment'); }
  };

  const handleAddMember = async () => {
    if (!memberForm.user_id || !selectedTeam) { toast.error('Please select a user'); return; }
    try {
      const res = await fetch(`${API_BASE}/teams/${selectedTeam.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.getToken()}` },
        body: JSON.stringify(memberForm)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Member added!');
        setShowAddMember(false); setMemberForm({ user_id: "", role: "member" });
        loadTeamDetails(selectedTeam.id);
      } else { toast.error(data.message || 'Failed to add member'); }
    } catch (err) { toast.error('Failed to add member'); }
  };

  // ─── Utility Colors ───────────────────────────────────────────────────────────
  const statusColor = (s: string) => ({ completed: 'bg-green-500', in_progress: 'bg-blue-500', cancelled: 'bg-red-500' }[s] || 'bg-gray-400');
  const statusBorder = (s: string) => ({ completed: '#10b981', in_progress: '#3b82f6', cancelled: '#ef4444' }[s] || '#6b7280');
  const priorityColor = (p: string) => ({ urgent: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-gray-400' }[p] || 'bg-gray-400');

  const isLeaderOf = (teamId: number) => userTeamMembership[teamId]?.role === 'leader';
  const canManage = ['admin', 'office_bearer'].includes(currentUser?.role || '');

  // ─── Pending Requests banner ──────────────────────────────────────────────────
  const pendingRequests = myRequests.filter(r => r.status === 'pending');

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col bg-transparent">
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">My Teams</h1>
            <p className="text-muted-foreground mt-1">Manage your team memberships and assignments</p>
          </div>

          {/* Pending request status strip */}
          {pendingRequests.length > 0 && !selectedTeam && (
            <div className="mb-4 p-3 rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 flex items-start gap-3">
              <Clock className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
              <div className="flex-1 text-sm">
                <span className="font-semibold text-yellow-800 dark:text-yellow-300">Pending Approval: </span>
                <span className="text-yellow-700 dark:text-yellow-400">
                  {pendingRequests.map(r => r.team_name).join(', ')}
                </span>
              </div>
            </div>
          )}

          {/* Tabs */}
          {!selectedTeam && (
            <div className="flex gap-1 mb-6 border-b">
              {[
                { key: 'myteams', label: `My Teams`, count: myTeams.length },
                { key: 'available', label: 'Available Teams', count: availableTeams.length },
                { key: 'assignments', label: 'My Assignments', count: myAssignments.length },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
              <div className="ml-auto flex items-center pb-1">
                <Button size="sm" variant="ghost" onClick={loadAll} className="gap-1 text-xs h-7">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </Button>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* ── TEAM DETAIL VIEW ─────────────────────────────────────────── */}
              {selectedTeam ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedTeam(null)} className="mb-2 gap-2">
                        <ArrowLeft className="w-4 h-4" /> Back to Teams
                      </Button>
                      <h2 className="text-2xl font-bold">{selectedTeam.name}</h2>
                      {selectedTeam.description && <p className="text-muted-foreground mt-1">{selectedTeam.description}</p>}
                    </div>
                    {(canManage || isLeaderOf(selectedTeam.id)) && (
                      <div className="flex gap-2 flex-wrap">
                        <Button onClick={() => setShowAddMember(true)} variant="outline" size="sm" className="gap-2">
                          <UserPlus className="w-4 h-4" /> Add Member
                        </Button>
                        <Button onClick={() => setShowCreateAssignment(true)} size="sm" className="gap-2">
                          <ClipboardList className="w-4 h-4" /> Create Assignment
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Members */}
                  <Card>
                    <CardHeader><CardTitle>Team Members ({selectedTeam.members?.length || 0})</CardTitle></CardHeader>
                    <CardContent>
                      {!selectedTeam.members?.length ? (
                        <p className="text-muted-foreground text-center py-4">No members</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedTeam.members.map((m: any) => (
                            <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                {m.name?.[0]?.toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{m.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                              </div>
                              <Badge variant={m.role === 'leader' ? 'default' : 'secondary'} className="shrink-0">{m.role}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Team Assignments */}
                  <Card>
                    <CardHeader><CardTitle>Team Assignments ({selectedTeam.assignments?.length || 0})</CardTitle></CardHeader>
                    <CardContent>
                      {!selectedTeam.assignments?.length ? (
                        <p className="text-muted-foreground text-center py-8">No assignments yet</p>
                      ) : (
                        <div className="space-y-3">
                          {selectedTeam.assignments.map((a: any) => (
                            <Card key={a.id} className="border-l-4" style={{ borderLeftColor: statusBorder(a.status) }}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                      <h3 className="font-semibold">{a.title}</h3>
                                      <Badge className={statusColor(a.status)} style={{ color: 'white', fontSize: '10px' }}>{a.status}</Badge>
                                      <Badge variant="outline" className="text-[10px]">{a.priority}</Badge>
                                    </div>
                                    {a.description && <p className="text-sm text-muted-foreground mb-1">{a.description}</p>}
                                    {a.due_date && (
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />Due: {new Date(a.due_date).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                  {a.assigned_to === currentUser?.id && a.status !== 'completed' && (
                                    <Button size="sm" onClick={() => handleUpdateAssignment(a.id, 'completed')} className="bg-green-500 hover:bg-green-600 shrink-0">
                                      <CheckCircle2 className="w-4 h-4 mr-1" /> Complete
                                    </Button>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

              ) : (
                <>
                  {/* ── MY TEAMS TAB ──────────────────────────────────────────── */}
                  {activeTab === 'myteams' && (
                    <div>
                      {myTeams.length === 0 ? (
                        <Card>
                          <CardContent className="p-12 text-center">
                            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
                            <p className="text-lg font-medium mb-2">No teams yet</p>
                            <p className="text-muted-foreground text-sm mb-4">Request to join a team to get started</p>
                            <Button onClick={() => setActiveTab('available')} className="gap-2">
                              <UserPlus className="w-4 h-4" /> Browse Available Teams
                            </Button>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                          {myTeams.map(team => (
                            <Card
                              key={team.id}
                              className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/30 group"
                              onClick={() => loadTeamDetails(team.id)}
                            >
                              <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                  <div className="p-2 bg-primary/10 rounded-lg">
                                    <Users className="w-4 h-4 text-primary" />
                                  </div>
                                  <span className="truncate">{team.name}</span>
                                </CardTitle>
                                {team.description && (
                                  <CardDescription className="line-clamp-2">{team.description}</CardDescription>
                                )}
                              </CardHeader>
                              <CardContent>
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                  <div className="flex gap-3">
                                    <span>{team.member_count || 0} Members</span>
                                    <span>{team.assignment_count || 0} Tasks</span>
                                  </div>
                                  {isLeaderOf(team.id) && (
                                    <Badge variant="default" className="text-[10px]">Leader</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 mt-3 text-xs text-primary group-hover:text-primary/80 transition-colors">
                                  <span>View team</span>
                                  <ChevronRight className="w-3 h-3" />
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── AVAILABLE TEAMS TAB ───────────────────────────────────── */}
                  {activeTab === 'available' && (
                    <div>
                      {/* Pending requests info */}
                      {pendingRequests.length > 0 && (
                        <div className="mb-4 space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">Your Pending Requests:</p>
                          {pendingRequests.map(r => (
                            <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700">
                              <Clock className="w-4 h-4 text-yellow-600 shrink-0" />
                              <div className="flex-1">
                                <span className="font-medium text-sm">{r.team_name}</span>
                                <span className="text-xs text-muted-foreground ml-2">— Waiting for approval</span>
                              </div>
                              <Badge className="bg-yellow-500 text-white text-[10px]">Pending</Badge>
                            </div>
                          ))}
                        </div>
                      )}

                      {availableTeams.length === 0 ? (
                        <Card>
                          <CardContent className="p-12 text-center">
                            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
                            <p className="text-lg font-medium mb-2">No teams available</p>
                            <p className="text-muted-foreground text-sm">
                              {pendingRequests.length > 0
                                ? "You have pending requests. Check back after approval."
                                : "All teams have been joined or no new teams exist."}
                            </p>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                          {availableTeams.map(team => {
                            const pending = getPendingRequest(team.id);
                            return (
                              <Card key={team.id} className="transition-all hover:shadow-md">
                                <CardHeader className="pb-3">
                                  <CardTitle className="flex items-center gap-2 text-base">
                                    <div className="p-2 bg-muted rounded-lg">
                                      <Users className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                    <span className="truncate">{team.name}</span>
                                  </CardTitle>
                                  {team.description && (
                                    <CardDescription className="line-clamp-2">{team.description}</CardDescription>
                                  )}
                                </CardHeader>
                                <CardContent>
                                  <div className="flex gap-3 text-sm text-muted-foreground mb-4">
                                    <span>{team.member_count || 0} Members</span>
                                    <span>{team.assignment_count || 0} Tasks</span>
                                  </div>
                                  {pending ? (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700">
                                      <Clock className="w-4 h-4 text-yellow-600 shrink-0" />
                                      <span className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">Pending Approval</span>
                                    </div>
                                  ) : (
                                    <Button
                                      className="w-full gap-2"
                                      onClick={() => { setSelectedTeamForRequest(team); setShowRequestModal(true); }}
                                      disabled={requestingTeamId === team.id}
                                    >
                                      {requestingTeamId === team.id ? (
                                        <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Sending...</>
                                      ) : (
                                        <><UserPlus className="w-4 h-4" /> Request to Join</>
                                      )}
                                    </Button>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── MY ASSIGNMENTS TAB ────────────────────────────────────── */}
                  {activeTab === 'assignments' && (
                    <div>
                      {myAssignments.length === 0 ? (
                        <Card>
                          <CardContent className="p-12 text-center">
                            <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
                            <p className="text-lg font-medium mb-2">No assignments yet</p>
                            <p className="text-muted-foreground text-sm">
                              {myTeams.length === 0
                                ? "Request to join a team to get started"
                                : "Your team leaders haven't assigned any tasks to you yet"}
                            </p>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="space-y-3">
                          {myAssignments.map(a => (
                            <Card key={a.id} className="border-l-4" style={{ borderLeftColor: statusBorder(a.status) }}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                      <h3 className="font-semibold">{a.title}</h3>
                                      <Badge className={statusColor(a.status)} style={{ color: 'white', fontSize: '10px' }}>{a.status?.replace('_', ' ')}</Badge>
                                      <Badge variant="outline" className="text-[10px]">{a.priority}</Badge>
                                    </div>
                                    {a.description && <p className="text-sm text-muted-foreground mb-1">{a.description}</p>}
                                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                      <span>Team: {a.team_name}</span>
                                      {a.due_date && (
                                        <span className="flex items-center gap-1">
                                          <Calendar className="w-3 h-3" />Due: {new Date(a.due_date).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {a.status !== 'completed' && (
                                    <div className="flex gap-2 shrink-0">
                                      {a.status === 'pending' && (
                                        <Button variant="outline" size="sm" onClick={() => handleUpdateAssignment(a.id, 'in_progress')}>Start</Button>
                                      )}
                                      <Button size="sm" onClick={() => handleUpdateAssignment(a.id, 'completed')} className="bg-green-500 hover:bg-green-600">
                                        <CheckCircle2 className="w-4 h-4 mr-1" /> Complete
                                      </Button>
                                    </div>
                                  )}
                                  {a.status === 'completed' && (
                                    <div className="flex items-center gap-1 text-green-600 text-sm shrink-0">
                                      <CheckCircle2 className="w-4 h-4" /> Done
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* ── Request to Join Modal ─────────────────────────────────────────────── */}
      <Dialog open={showRequestModal} onOpenChange={(open) => { setShowRequestModal(open); if (!open) { setRequestMessage(""); setSelectedTeamForRequest(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request to Join {selectedTeamForRequest?.name}</DialogTitle>
            <DialogDescription>Send a request to the team leader. They will review and approve or reject it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Message (optional)</Label>
              <textarea
                value={requestMessage}
                onChange={e => setRequestMessage(e.target.value)}
                className="w-full mt-1.5 border rounded-md px-3 py-2 min-h-24 bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Tell the team leader why you want to join..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRequestModal(false)}>Cancel</Button>
              <Button onClick={handleRequestJoin} className="gap-2">
                <Send className="w-4 h-4" /> Send Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Proof Upload Modal ────────────────────────────────────────────────── */}
      <Dialog open={showProofModal} onOpenChange={(open) => { setShowProofModal(open); if (!open) { setProofFile(null); setProofPreview(null); setSelectedAssignmentForProof(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Proof of Completion</DialogTitle>
            <DialogDescription>Upload an image or PDF as proof to complete this assignment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm font-medium">{selectedAssignmentForProof?.title}</p>
            <div>
              <Label>Proof File (Image / PDF) *</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={handleFileSelect} className="mt-1.5" />
              {proofPreview && (
                <div className="mt-3 relative">
                  <img src={proofPreview} alt="Preview" className="max-w-full h-40 object-contain border rounded" />
                  <Button variant="ghost" size="sm" onClick={() => { setProofFile(null); setProofPreview(null); }} className="absolute top-1 right-1">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
              {proofFile && !proofPreview && (
                <div className="mt-2 p-2 bg-muted rounded flex items-center gap-2 text-sm">
                  <FileImage className="w-4 h-4" /> {proofFile.name}
                  <Button variant="ghost" size="sm" onClick={() => setProofFile(null)} className="ml-auto h-6 w-6 p-0">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowProofModal(false)}>Cancel</Button>
              <Button onClick={handleSubmitProof} disabled={!proofFile} className="gap-2">
                <Upload className="w-4 h-4" /> Submit & Complete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Member Modal ──────────────────────────────────────────────────── */}
      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Member to {selectedTeam?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select User *</Label>
              <select
                value={memberForm.user_id}
                onChange={e => setMemberForm({ ...memberForm, user_id: e.target.value })}
                className="w-full mt-1.5 h-10 bg-background border rounded-md px-3 text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">Choose a user...</option>
                {allUsers.filter(u => !selectedTeam?.members?.find((m: any) => m.user_id === u.id)).map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Role</Label>
              <select
                value={memberForm.role}
                onChange={e => setMemberForm({ ...memberForm, role: e.target.value })}
                className="w-full mt-1.5 h-10 bg-background border rounded-md px-3 text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="member">Member</option>
                <option value="leader">Leader</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddMember(false)}>Cancel</Button>
              <Button onClick={handleAddMember}>Add Member</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create Assignment Modal ───────────────────────────────────────────── */}
      <Dialog open={showCreateAssignment} onOpenChange={setShowCreateAssignment}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Assignment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={assignmentForm.title} onChange={e => setAssignmentForm({ ...assignmentForm, title: e.target.value })} placeholder="Assignment title" className="mt-1.5" />
            </div>
            <div>
              <Label>Description</Label>
              <textarea
                value={assignmentForm.description}
                onChange={e => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                className="w-full mt-1.5 border rounded-md px-3 py-2 min-h-20 bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Assignment description"
              />
            </div>
            <div>
              <Label>Assign To</Label>
              <select
                value={assignmentForm.assigned_to}
                onChange={e => setAssignmentForm({ ...assignmentForm, assigned_to: e.target.value })}
                className="w-full mt-1.5 h-10 bg-background border rounded-md px-3 text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">Unassigned</option>
                {selectedTeam?.members?.map((m: any) => (
                  <option key={m.user_id} value={m.user_id}>{m.name}{m.user_id === currentUser?.id ? ' (Me)' : ''}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={assignmentForm.due_date} onChange={e => setAssignmentForm({ ...assignmentForm, due_date: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label>Priority</Label>
                <select
                  value={assignmentForm.priority}
                  onChange={e => setAssignmentForm({ ...assignmentForm, priority: e.target.value })}
                  className="w-full mt-1.5 h-10 bg-background border rounded-md px-3 text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateAssignment(false)}>Cancel</Button>
              <Button onClick={handleCreateAssignment}>Create Assignment</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentTeams;
