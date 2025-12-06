import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  AlertCircle,
  Upload,
  FileImage,
  X
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const StudentTeams = () => {
  const navigate = useNavigate();
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [selectedTeamForRequest, setSelectedTeamForRequest] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'teams' | 'assignments'>('teams');
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedAssignmentForProof, setSelectedAssignmentForProof] = useState<any>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({
    title: "",
    description: "",
    assigned_to: "",
    due_date: "",
    priority: "medium"
  });
  const [userTeamMembership, setUserTeamMembership] = useState<{[key: number]: any}>({});
  const [showAddMember, setShowAddMember] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [memberForm, setMemberForm] = useState({ user_id: "", role: "member" });

  useEffect(() => {
    if (!auth.isAuthenticated() || !auth.hasRole('student')) {
      navigate('/login');
      return;
    }
    loadMyTeams();
    loadMyAssignments();
    loadUsers();
  }, []);

  useEffect(() => {
    // Load all teams after myTeams is loaded, so we can filter properly
    if (myTeams.length >= 0) {
      loadAllTeams();
    }
  }, [myTeams]);

  const loadMyTeams = async () => {
    try {
      const user = auth.getUser();
      const res = await fetch(`${API_BASE}/teams/my-teams`, {
        headers: { Authorization: `Bearer ${auth.getToken()}` }
      });
      const data = await res.json();
      if (data.success) {
        setMyTeams(data.teams || []);
        // Load member details for each team to check if user is a leader
        const membershipData: {[key: number]: any} = {};
        for (const team of data.teams || []) {
          const teamDetailsRes = await fetch(`${API_BASE}/teams/${team.id}`, {
            headers: { Authorization: `Bearer ${auth.getToken()}` }
          });
          const teamData = await teamDetailsRes.json();
          if (teamData.success && teamData.members) {
            const userMembership = teamData.members.find((m: any) => m.user_id === user?.id);
            membershipData[team.id] = userMembership;
          }
        }
        setUserTeamMembership(membershipData);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadAllTeams = async () => {
    try {
      const res = await fetch(`${API_BASE}/teams`, {
        headers: { Authorization: `Bearer ${auth.getToken()}` }
      });
      const data = await res.json();
      if (data.success) {
        // Filter out teams the student is already a member of
        const myTeamIds = myTeams.map(t => t.id);
        const filtered = (data.teams || []).filter((t: any) => !myTeamIds.includes(t.id));
        setAllTeams(filtered);
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

  const loadUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users/students`, {
        headers: { Authorization: `Bearer ${auth.getToken()}` }
      });
      const data = await res.json();
      if (data.success) {
        // endpoint returns `students` key
        setAllUsers(data.students || data.users || []);
      } else if (res.status === 403) {
        // Not allowed to fetch students — user is not a team leader, silently skip
        console.warn('User is not a team leader or does not have permission to list users');
        setAllUsers([]);
      }
    } catch (err) {
      console.error('Error loading users:', err);
      setAllUsers([]);
    }
  };

  const handleAddMember = async () => {
    if (!memberForm.user_id) {
      toast.error('Please select a user');
      return;
    }
    if (!selectedTeam?.id) {
      toast.error('No team selected');
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

  const handleRequestJoin = async () => {
    if (!requestMessage.trim()) {
      toast.error('Please provide a reason for joining');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/teams/${selectedTeamForRequest.id}/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify({ message: requestMessage.trim() })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Join request sent!');
        setShowRequestModal(false);
        setRequestMessage("");
        setSelectedTeamForRequest(null);
        // Reload teams to update the list
        loadMyTeams(); // Reload my teams in case request was auto-approved
        loadAllTeams(); // Reload available teams
      } else {
        toast.error(data.message || 'Failed to send request');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to send request');
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
        // Reload team details to show new assignment
        if (selectedTeam?.id) {
          loadTeamDetails(selectedTeam.id);
        }
        loadMyAssignments();
      } else {
        toast.error(data.message || 'Failed to create assignment');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to create assignment');
    }
  };

  const handleProofUpload = (assignment: any) => {
    setSelectedAssignmentForProof(assignment);
    setProofFile(null);
    setProofPreview(null);
    setShowProofModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file type (images and PDFs)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload an image (JPG/PNG) or PDF file');
      return;
    }
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }
    
    setProofFile(file);
    
    // Preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setProofPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setProofPreview(null);
    }
  };

  const handleSubmitProof = async () => {
    if (!proofFile || !selectedAssignmentForProof) {
      toast.error('Please select a proof file');
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append('proof', proofFile);
      formData.append('status', 'completed');
      
      const res = await fetch(`${API_BASE}/teams/${selectedAssignmentForProof.team_id}/assignments/${selectedAssignmentForProof.id}/complete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        },
        body: formData
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success('Assignment completed with proof!');
        setShowProofModal(false);
        setProofFile(null);
        setProofPreview(null);
        setSelectedAssignmentForProof(null);
        loadMyAssignments();
        if (selectedTeam) {
          loadTeamDetails(selectedTeam.id);
        }
      } else {
        toast.error(data.message || 'Failed to submit proof');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit proof');
    }
  };

  const handleUpdateAssignment = async (assignmentId: number, status: string) => {
    try {
      const assignment = myAssignments.find(a => a.id === assignmentId);
      if (!assignment) return;
      
      // If marking as completed, require proof
      if (status === 'completed') {
        handleProofUpload(assignment);
        return;
      }
      
      const res = await fetch(`${API_BASE}/teams/${assignment.team_id}/assignments/${assignmentId}`, {
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
        loadMyAssignments();
      } else {
        toast.error(data.message || 'Failed to update assignment');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update assignment');
    }
  };

  const loadTeamDetails = async (teamId: number) => {
    try {
      const res = await fetch(`${API_BASE}/teams/${teamId}`, {
        headers: { Authorization: `Bearer ${auth.getToken()}` }
      });
      const data = await res.json();
      if (data.success) {
        setSelectedTeam({
          ...data.team,
          members: data.members || [],
          assignments: data.assignments || []
        });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load team details');
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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />
      
      <div className="flex flex-1">
        <div className="hidden lg:block sticky top-[57px] h-[calc(100vh-57px)] bg-white shadow-sm">
          <Sidebar />
        </div>
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-violet bg-clip-text text-transparent mb-2">
                My Teams
              </h1>
              <p className="text-muted-foreground text-lg">View your teams and assignments</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b">
              <Button
                variant={activeTab === 'teams' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('teams')}
                className="rounded-b-none"
              >
                My Teams ({myTeams.length})
              </Button>
              <Button
                variant={activeTab === 'assignments' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('assignments')}
                className="rounded-b-none"
              >
                My Assignments ({myAssignments.length})
              </Button>
            </div>

            {activeTab === 'teams' ? (
              <div className="space-y-6">
                {/* My Teams */}
                {selectedTeam ? (
                  <div className="space-y-6">
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
                      {userTeamMembership[selectedTeam.id]?.role === 'leader' && (
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

                    {/* Team Members */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Team Members ({selectedTeam.members?.length || 0})</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedTeam.members?.length === 0 ? (
                          <p className="text-muted-foreground text-center py-4">No members</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedTeam.members?.map((member: any) => (
                              <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                  <p className="font-semibold">{member.name}</p>
                                  <p className="text-sm text-muted-foreground">{member.email}</p>
                                  <Badge variant="secondary" className="mt-1">
                                    {member.role}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Team Assignments */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Team Assignments</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedTeam.assignments?.length === 0 ? (
                          <p className="text-muted-foreground text-center py-4">No assignments</p>
                        ) : (
                          <div className="space-y-4">
                            {selectedTeam.assignments?.map((assignment: any) => (
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
                                      {assignment.due_date && (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Calendar className="w-3 h-3" />
                                          Due: {new Date(assignment.due_date).toLocaleDateString()}
                                        </p>
                                      )}
                                    </div>
                                    {assignment.assigned_to === auth.getUser()?.id && assignment.status !== 'completed' && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleUpdateAssignment(assignment.id, 'completed')}
                                        className="bg-green-500 hover:bg-green-600"
                                      >
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                        Mark Complete
                                      </Button>
                                    )}
                                    {assignment.proof_file_path && (
                                      <Badge variant="outline" className="ml-2">
                                        <FileImage className="w-3 h-3 mr-1" />
                                        Proof Uploaded
                                      </Badge>
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
                    <div>
                      <h2 className="text-2xl font-bold mb-4">My Teams</h2>
                      {myTeams.length === 0 ? (
                        <Card>
                          <CardContent className="p-12 text-center">
                            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                            <p className="text-muted-foreground">You are not a member of any teams yet</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {myTeams.map((team) => (
                            <Card 
                              key={team.id} 
                              className="cursor-pointer hover:shadow-lg transition-all"
                              onClick={() => loadTeamDetails(team.id)}
                            >
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                  <Users className="w-5 h-5 text-primary" />
                                  {team.name}
                                </CardTitle>
                                {team.description && (
                                  <CardDescription>{team.description}</CardDescription>
                                )}
                              </CardHeader>
                              <CardContent>
                                <div className="flex gap-4 text-sm text-muted-foreground">
                                  <span>{team.member_count || 0} Members</span>
                                  <span>{team.assignment_count || 0} Assignments</span>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Available Teams to Request */}
                    <div className="mt-8">
                      <h2 className="text-2xl font-bold mb-4">Available Teams</h2>
                      {allTeams.length === 0 ? (
                        <Card>
                          <CardContent className="p-12 text-center">
                            <p className="text-muted-foreground">No other teams available</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {allTeams.map((team) => (
                            <Card key={team.id}>
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                  <Users className="w-5 h-5 text-primary" />
                                  {team.name}
                                </CardTitle>
                                {team.description && (
                                  <CardDescription>{team.description}</CardDescription>
                                )}
                              </CardHeader>
                              <CardContent>
                                <div className="flex gap-4 text-sm text-muted-foreground mb-4">
                                  <span>{team.member_count || 0} Members</span>
                                  <span>{team.assignment_count || 0} Assignments</span>
                                </div>
                                <Button
                                  className="w-full"
                                  onClick={() => {
                                    setSelectedTeamForRequest(team);
                                    setShowRequestModal(true);
                                  }}
                                >
                                  <UserPlus className="w-4 h-4 mr-2" />
                                  Request to Join
                                </Button>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-bold mb-4">My Assignments</h2>
                {myAssignments.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground">You have no assignments</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {myAssignments.map((assignment) => (
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
                              <div className="flex gap-4 text-xs text-muted-foreground">
                                <span>Team: {assignment.team_name}</span>
                                {assignment.due_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Due: {new Date(assignment.due_date).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            {assignment.status !== 'completed' && (
                              <div className="flex gap-2">
                                {assignment.status === 'pending' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleUpdateAssignment(assignment.id, 'in_progress')}
                                  >
                                    Start
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  onClick={() => handleUpdateAssignment(assignment.id, 'completed')}
                                  className="bg-green-500 hover:bg-green-600"
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Complete
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
            )}
          </div>
        </main>
      </div>

      <Footer />

      {/* Request to Join Modal */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request to Join {selectedTeamForRequest?.name}</DialogTitle>
            <DialogDescription>Explain why you want to join this team</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Why do you want to join this team? *</Label>
              <textarea
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                className="w-full border rounded-md px-3 py-2 min-h-24 mt-2"
                placeholder="Explain why you want to join this team..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowRequestModal(false);
                setRequestMessage("");
                setSelectedTeamForRequest(null);
              }}>
                Cancel
              </Button>
              <Button onClick={handleRequestJoin} disabled={!requestMessage.trim()}>
                <Send className="w-4 h-4 mr-2" />
                Send Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Proof Upload Modal */}
      <Dialog open={showProofModal} onOpenChange={setShowProofModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Proof for Assignment</DialogTitle>
            <DialogDescription>
              Upload proof (image or PDF) to complete this assignment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Assignment: {selectedAssignmentForProof?.title}</Label>
            </div>
            <div>
              <Label>Upload Proof (Image or PDF) *</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileSelect}
                className="mt-2"
              />
              {proofPreview && (
                <div className="mt-4 relative">
                  <img src={proofPreview} alt="Proof preview" className="max-w-full h-48 object-contain border rounded" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setProofFile(null);
                      setProofPreview(null);
                    }}
                    className="absolute top-2 right-2"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
              {proofFile && !proofPreview && (
                <div className="mt-2 p-2 bg-muted rounded flex items-center gap-2">
                  <FileImage className="w-4 h-4" />
                  <span className="text-sm">{proofFile.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setProofFile(null);
                      setProofPreview(null);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowProofModal(false);
                setProofFile(null);
                setProofPreview(null);
                setSelectedAssignmentForProof(null);
              }}>
                Cancel
              </Button>
              <Button onClick={handleSubmitProof} disabled={!proofFile} className="gap-2">
                <Upload className="w-4 h-4" />
                Submit Proof & Complete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Member Modal */}
      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member to Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select User *</Label>
              <select
                value={memberForm.user_id}
                onChange={(e) => setMemberForm({ ...memberForm, user_id: e.target.value })}
                className="w-full h-10 border rounded-md px-3"
              >
                <option value="">Choose a user...</option>
                {allUsers
                  .filter(u => !selectedTeam?.members?.find(m => m.user_id === u.id))
                  .map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email}) - {user.role}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <Label>Role</Label>
              <select
                value={memberForm.role}
                onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                className="w-full h-10 border rounded-md px-3"
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
                placeholder="Assignment title"
              />
            </div>
            <div>
              <Label>Description</Label>
              <textarea
                value={assignmentForm.description}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                className="w-full border rounded-md px-3 py-2 min-h-20"
                placeholder="Assignment description"
              />
            </div>
            <div>
              <Label>Assign To</Label>
              {selectedTeam?.members && selectedTeam.members.length > 0 ? (
                <select
                  value={assignmentForm.assigned_to}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, assigned_to: e.target.value })}
                  className="w-full h-10 border rounded-md px-3"
                >
                  <option value="">Unassigned</option>
                  {selectedTeam.members.map((member: any) => {
                    const currentUser = auth.getUser();
                    const isCurrentUser = member.user_id === currentUser?.id;
                    return (
                      <option key={member.user_id} value={member.user_id}>
                        {member.name} {isCurrentUser ? '(Me)' : ''}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <div className="p-2 text-sm text-muted-foreground bg-muted rounded">
                  No team members available. Please refresh or ensure you have team members.
                </div>
              )}
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
                  value={assignmentForm.priority}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, priority: e.target.value })}
                  className="w-full h-10 border rounded-md px-3"
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

