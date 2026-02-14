import { useEffect, useState } from "react";
import DeveloperCredit from "@/components/DeveloperCredit";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { auth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Plus,
  UserPlus,
  ClipboardList,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
  Edit,
  Calendar,
  AlertCircle,
  Bell,
  Check,
  X,
  ArrowLeft,
  RefreshCw
} from "lucide-react";
import { api } from "@/lib/api";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const ManageTeams = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [showAssignmentDetails, setShowAssignmentDetails] = useState(false);

  // Forms
  const [teamForm, setTeamForm] = useState({ name: "", description: "" });
  const [memberForm, setMemberForm] = useState({ user_id: "", role: "member" });
  const [assignmentForm, setAssignmentForm] = useState({
    title: "",
    description: "",
    assigned_to: "",
    due_date: "",
    priority: "medium"
  });
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [tracking, setTracking] = useState<any[]>([]);
  const [teamRequests, setTeamRequests] = useState<any[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [requestFilter, setRequestFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate('/login');
      return;
    }

    // Allow admin or office_bearer to manage teams, and team leaders to manage their own teams
    const user = auth.getUser();
    const role = user?.role;
    if (role !== 'admin' && role !== 'office_bearer' && role !== 'student') {
      navigate('/login');
      return;
    }

    loadTeams();
    loadUsers();
    loadTeamRequests('pending');
  }, []);

  const loadTeamRequests = async (filter?: string) => {
    try {
      const status = filter || requestFilter;
      const url = status === 'all'
        ? `${API_BASE}/teams/requests/all`
        : `${API_BASE}/teams/requests/all?status=${status}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${auth.getToken()}` }
      });
      const data = await res.json();
      if (data.success) {
        setTeamRequests(data.requests || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveRequest = async (requestId: number) => {
    try {
      const res = await fetch(`${API_BASE}/teams/requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify({ status: 'approved' })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Request approved! Student has been added to the team.');
        loadTeamRequests();
        if (selectedTeam) {
          loadTeamDetails(selectedTeam.id);
        }
      } else {
        toast.error(data.message || 'Failed to approve request');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to approve request');
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    if (!confirm('Are you sure you want to reject this request?')) return;
    try {
      const res = await fetch(`${API_BASE}/teams/requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify({ status: 'rejected' })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Request rejected');
        loadTeamRequests();
      } else {
        toast.error(data.message || 'Failed to reject request');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to reject request');
    }
  };

  const loadTeams = async () => {
    try {
      setLoading(true);
      const user = auth.getUser();
      let url = `${API_BASE}/teams`;

      // If user is a student (team leader), only get their teams
      if (user?.role === 'student') {
        url = `${API_BASE}/teams/my-teams`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${auth.getToken()}` }
      });
      const data = await res.json();
      if (data.success) setTeams(data.teams || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.getUsers();
      if (response.success) {
        setAllUsers(response.users || []);
      }
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
        setTeamMembers(data.members || []);
        setAssignments(data.assignments || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load team details');
    }
  };

  const handleCreateTeam = async () => {
    if (!teamForm.name.trim()) {
      toast.error('Team name is required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify(teamForm)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Team created successfully!');
        setShowCreateTeam(false);
        setTeamForm({ name: "", description: "" });
        loadTeams();
      } else {
        toast.error(data.message || 'Failed to create team');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to create team');
    }
  };

  const handleAddMember = async () => {
    if (!memberForm.user_id) {
      toast.error('Please select a user');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/teams/${selectedTeam.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify(memberForm)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Member added to team!');
        setShowAddMember(false);
        setMemberForm({ user_id: "", role: "member" });
        loadTeamDetails(selectedTeam.id);
      } else {
        toast.error(data.message || 'Failed to add member');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to add member');
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!confirm('Remove this member from the team?')) return;
    try {
      const res = await fetch(`${API_BASE}/teams/${selectedTeam.id}/members/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.getToken()}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Member removed');
        loadTeamDetails(selectedTeam.id);
      } else {
        toast.error(data.message || 'Failed to remove member');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to remove member');
    }
  };

  const handleCreateAssignment = async () => {
    if (!assignmentForm.title.trim()) {
      toast.error('Assignment title is required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/teams/${selectedTeam.id}/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify({
          ...assignmentForm,
          assigned_to: assignmentForm.assigned_to ? parseInt(assignmentForm.assigned_to) : null
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Assignment created!');
        setShowCreateAssignment(false);
        setAssignmentForm({
          title: "",
          description: "",
          assigned_to: "",
          due_date: "",
          priority: "medium"
        });
        loadTeamDetails(selectedTeam.id);
      } else {
        toast.error(data.message || 'Failed to create assignment');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to create assignment');
    }
  };

  const handleUpdateAssignment = async (assignmentId: number, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/teams/${selectedTeam.id}/assignments/${assignmentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Assignment marked as ${status}`);
        loadTeamDetails(selectedTeam.id);
        if (selectedAssignment?.id === assignmentId) {
          loadAssignmentTracking(assignmentId);
        }
      } else {
        toast.error(data.message || 'Failed to update assignment');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update assignment');
    }
  };

  const loadAssignmentTracking = async (assignmentId: number) => {
    try {
      const res = await fetch(`${API_BASE}/teams/${selectedTeam.id}/assignments/${assignmentId}/tracking`, {
        headers: { Authorization: `Bearer ${auth.getToken()}` }
      });
      const data = await res.json();
      if (data.success) {
        setTracking(data.tracking || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTeam = async (teamId: number) => {
    if (!confirm('Are you sure you want to delete this team? All members and assignments will be removed.')) return;
    try {
      const res = await fetch(`${API_BASE}/teams/${teamId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.getToken()}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Team deleted');
        if (selectedTeam?.id === teamId) {
          setSelectedTeam(null);
        }
        loadTeams();
      } else {
        toast.error(data.message || 'Failed to delete team');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete team');
    }
  };

  const handleDeleteAssignment = async (assignmentId: number) => {
    if (!confirm('Delete this assignment?')) return;
    try {
      const res = await fetch(`${API_BASE}/teams/${selectedTeam.id}/assignments/${assignmentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.getToken()}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Assignment deleted');
        loadTeamDetails(selectedTeam.id);
      } else {
        toast.error(data.message || 'Failed to delete assignment');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete assignment');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBorderColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'in_progress': return '#3b82f6';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <DeveloperCredit />
      <main className="flex-1 w-full bg-background overflow-x-hidden">
        <div className="w-full px-4 md:px-6 lg:px-8 py-8">
          <div className="mb-2">
            <Button variant="ghost" className="gap-2 font-bold text-muted-foreground hover:text-primary transition-colors" onClick={() => window.history.back()}>
              <RefreshCw className="w-4 h-4" /> Back to Dashboard
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground">Manage Teams</h1>
              <p className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground opacity-70 border-l-4 border-primary/30 pl-3 mt-1">Coordinate volunteers and project workflows</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
              <Button
                onClick={() => {
                  setShowRequests(!showRequests);
                  if (!showRequests) loadTeamRequests();
                }}
                variant={showRequests ? "default" : "outline"}
                className="gap-2 h-10 px-4 text-sm w-full sm:w-auto shadow-sm"
              >
                <Bell className="w-4 h-4" />
                Requests
                {teamRequests.filter(r => r.status === 'pending').length > 0 && (
                  <Badge className="ml-1 bg-red-500 hover:bg-red-600">
                    {teamRequests.filter(r => r.status === 'pending').length}
                  </Badge>
                )}
              </Button>
              <Button onClick={() => setShowCreateTeam(true)} className="gap-2 h-10 px-4 text-sm w-full sm:w-auto shadow-sm">
                <Plus className="w-4 h-4" />
                Create Team
              </Button>
            </div>
          </div>
        </div>

        {showRequests ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Team Join Requests</h2>
              <div className="flex gap-2">
                <Button
                  variant={requestFilter === 'pending' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setRequestFilter('pending');
                    loadTeamRequests('pending');
                  }}
                >
                  Pending
                </Button>
                <Button
                  variant={requestFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setRequestFilter('all');
                    loadTeamRequests('all');
                  }}
                >
                  All
                </Button>
              </div>
            </div>

            {teamRequests.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No {requestFilter === 'all' ? '' : requestFilter} requests</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {teamRequests.map((request) => (
                  <Card key={request.id} className="border-l-4" style={{
                    borderLeftColor: request.status === 'approved' ? '#10b981' :
                      request.status === 'rejected' ? '#ef4444' : '#3b82f6'
                  }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{request.user_name}</h3>
                            <Badge className={
                              request.status === 'approved' ? 'bg-green-500' :
                                request.status === 'rejected' ? 'bg-red-500' : 'bg-blue-500'
                            }>
                              {request.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Requesting to join: <span className="font-semibold">{request.team_name}</span>
                          </p>
                          {request.message && (
                            <p className="text-sm mb-2 p-2 bg-muted rounded">{request.message}</p>
                          )}
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>Requested: {new Date(request.created_at).toLocaleString()}</span>
                            {request.reviewed_at && (
                              <span>Reviewed: {new Date(request.reviewed_at).toLocaleString()}</span>
                            )}
                            {request.reviewer_name && (
                              <span>By: {request.reviewer_name}</span>
                            )}
                          </div>
                        </div>
                        {request.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApproveRequest(request.id)}
                              className="bg-green-500 hover:bg-green-600"
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRejectRequest(request.id)}
                            >
                              <X className="w-4 h-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !selectedTeam ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {teams.map((team) => (
              <Card
                key={team.id}
                className="group relative overflow-hidden rounded-3xl border-border/40 bg-card/60 backdrop-blur-md shadow-md hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300 cursor-pointer"
                onClick={() => {
                  setSelectedTeam(team);
                  loadTeamDetails(team.id);
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-xl">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <CardTitle className="text-xl font-black text-foreground uppercase tracking-tight">{team.name}</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTeam(team.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed h-8 mb-4">
                    {team.description || "No description provided."}
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-border/50">
                    <div className="flex -space-x-2">
                      {/* Placeholder for member count or avatars */}
                      <Badge className="bg-primary/5 text-primary border-none font-bold text-[9px] uppercase tracking-widest px-2 py-0.5">
                        Click to View Details
                      </Badge>
                    </div>
                    <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest group-hover:text-primary transition-colors">
                      Open Team
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Team Header */}
            <div className="flex items-center justify-between">
              <div>
                <Button variant="ghost" onClick={() => setSelectedTeam(null)} className="mb-4">
                  ← Back to Teams
                </Button>
                <h2 className="text-3xl font-bold">{selectedTeam.name}</h2>
                {selectedTeam.description && (
                  <p className="text-muted-foreground mt-1">{selectedTeam.description}</p>
                )}
              </div>
              {(auth.hasRole('admin', 'office_bearer') || teamMembers.some(m => m.user_id === auth.getUser()?.id && m.role === 'leader')) && (
                <div className="flex gap-2">
                  <Button onClick={() => setShowAddMember(true)} variant="outline" className="gap-2">
                    <UserPlus className="w-4 h-4" />
                    Add Member
                  </Button>
                  <Button onClick={() => setShowCreateAssignment(true)} className="gap-2">
                    <ClipboardList className="w-4 h-4" />
                    Create Assignment
                  </Button>
                </div>
              )}
            </div>

            {/* Members Section */}
            <Card>
              <CardHeader>
                <CardTitle>Team Members ({teamMembers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {teamMembers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No members yet</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-semibold">{member.name}</p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                          <Badge variant="secondary" className="mt-1">
                            {member.role}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.user_id)}
                        >
                          <XCircle className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Assignments Section */}
            <Card>
              <CardHeader>
                <CardTitle>Assignments ({assignments.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {assignments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No assignments yet</p>
                ) : (
                  <div className="space-y-4">
                    {assignments.map((assignment) => (
                      <Card key={assignment.id} className="border-l-4" style={{ borderLeftColor: getStatusBorderColor(assignment.status) }}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold">{assignment.title}</h3>
                                <Badge className={getStatusColor(assignment.status)}>
                                  {assignment.status}
                                </Badge>
                                <Badge variant="outline" className={getPriorityColor(assignment.priority)}>
                                  {assignment.priority}
                                </Badge>
                              </div>
                              {assignment.description && (
                                <p className="text-sm text-muted-foreground mb-2">{assignment.description}</p>
                              )}
                              <div className="space-y-2 text-xs text-muted-foreground">
                                <div className="flex gap-4">
                                  {assignment.assigned_to_name ? (
                                    <span className="bg-blue-50 px-2 py-1 rounded text-blue-700 font-medium">
                                      👤 {assignment.assigned_to_name}
                                    </span>
                                  ) : (
                                    <span className="bg-gray-100 px-2 py-1 rounded text-gray-600">
                                      ⚠️ Unassigned
                                    </span>
                                  )}
                                  {assignment.assigned_by_name && (
                                    <span className="text-muted-foreground">by {assignment.assigned_by_name}</span>
                                  )}
                                </div>
                                {assignment.due_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Due: {new Date(assignment.due_date).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedAssignment(assignment);
                                  loadAssignmentTracking(assignment.id);
                                  setShowAssignmentDetails(true);
                                }}
                              >
                                View
                              </Button>
                              {(auth.hasRole('admin', 'office_bearer') || teamMembers.some(m => m.user_id === auth.getUser()?.id && m.role === 'leader')) && (
                                <>
                                  {assignment.status !== 'completed' && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleUpdateAssignment(assignment.id, 'completed')}
                                      className="bg-green-500 hover:bg-green-600"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                  {assignment.status === 'pending' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleUpdateAssignment(assignment.id, 'in_progress')}
                                    >
                                      Start
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteAssignment(assignment.id)}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Create Team Modal */}
        <Dialog open={showCreateTeam} onOpenChange={setShowCreateTeam}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Team Name *</Label>
                <Input
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  placeholder="e.g., Content Team"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={teamForm.description}
                  onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                  placeholder="Team description"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateTeam(false)}>Cancel</Button>
                <Button onClick={handleCreateTeam}>Create Team</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Member Modal */}
        <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Select User</Label>
                <select
                  className="w-full p-2 border rounded bg-background"
                  value={memberForm.user_id}
                  onChange={(e) => setMemberForm({ ...memberForm, user_id: e.target.value })}
                >
                  <option value="">Select a student...</option>
                  {allUsers.filter(u => u.role === 'student').map(user => (
                    <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Role</Label>
                <select
                  className="w-full p-2 border rounded bg-background"
                  value={memberForm.role}
                  onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                >
                  <option value="member">Member</option>
                  <option value="leader">Leader</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                < Button variant="outline" onClick={() => setShowAddMember(false)}>Cancel</Button>
                <Button onClick={handleAddMember}>Add Member</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Assignment Modal */}
        <Dialog open={showCreateAssignment} onOpenChange={setShowCreateAssignment}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Assignment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={assignmentForm.title}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={assignmentForm.description}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Assign To</Label>
                <select
                  className="w-full p-2 border rounded bg-background"
                  value={assignmentForm.assigned_to}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, assigned_to: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map(member => (
                    <option key={member.id} value={member.user_id}>{member.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={assignmentForm.due_date}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, due_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Priority</Label>
                  <select
                    className="w-full p-2 border rounded bg-background"
                    value={assignmentForm.priority}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, priority: e.target.value })}
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

        {/* Assignment Details Modal */}
        <Dialog open={showAssignmentDetails} onOpenChange={setShowAssignmentDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Assignment Details</DialogTitle>
            </DialogHeader>
            {selectedAssignment && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Title</Label>
                    <p className="font-semibold">{selectedAssignment.title}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge className={getStatusColor(selectedAssignment.status)}>
                      {selectedAssignment.status}
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p>{selectedAssignment.description || 'No description'}</p>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Activity Log</h4>
                  <div className="space-y-3">
                    {tracking.map((log, i) => (
                      <div key={i} className="flex gap-3 text-sm border-l-2 pl-3 ml-1">
                        <div className="flex-1">
                          <p>
                            <span className="font-medium">{log.user_name}</span> marked as{" "}
                            <Badge variant="outline" className="text-[10px] h-4">
                              {log.new_status}
                            </Badge>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(log.changed_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    {tracking.length === 0 && (
                      <p className="text-sm text-muted-foreground italic">No activity recorded</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowAssignmentDetails(false)}>Close</Button>
                  {selectedAssignment.status === 'pending' && (
                    <Button
                      onClick={() => {
                        handleUpdateAssignment(selectedAssignment.id, 'in_progress');
                        setShowAssignmentDetails(false);
                      }}
                    >
                      Start Assignment
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main >
    </div >
  );
};

export default ManageTeams;
