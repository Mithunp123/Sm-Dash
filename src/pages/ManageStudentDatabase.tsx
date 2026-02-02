import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { BackButton } from "@/components/BackButton";
import { Users, Edit, Trash2, Search, Plus, ArrowLeft, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { auth } from "@/lib/auth";
import { usePermissions } from '@/hooks/usePermissions';
import { api } from "@/lib/api";
import { toast } from "sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle } from "@/components/ui/dialog";

// Common departments list
const DEPARTMENTS = [
  "Artificial Intelligence and Data Science",
  "Artificial Intelligence and Machine Learning",
  "Biotechnology",
  "Civil Engineering",
  "Computer Science and Engineering",
  "Electronics and Communication Engineering",
  "Electrical and Electronics Engineering",
  "Mechanical Engineering",
  "Mechatronics Engineering",
  "Food Technology",
  "Information Technology",
  "Textile Technology",
  "Very Large Scale Integration Technology",
  "Computer Science and Business Systems",
  "Master of Business Administration",
  "Master of Computer Applications"
];

const ManageStudentDatabase = () => {
  const navigate = useNavigate();
  const { permissions, loading: permissionsLoading } = usePermissions();
  const userIsAdmin = auth.hasRole('admin');
  // Check for _edit permission specifically, not just view permission
  const canEdit = userIsAdmin || permissions?.can_manage_student_db_edit || permissions?.can_manage_students_edit;
  const user = auth.getUser();
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestPending, setRequestPending] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all"); // Filter by role
  const [filterDept, setFilterDept] = useState("all"); // Filter by department
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState({
    register_no: "",
    dept: "",
    year: "",
    academic_year: "",
    phone: "",
    father_number: "",
    blood_group: "",
    gender: "",
    dob: "",
    address: "",
    hosteller_dayscholar: ""
  });
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate('/login');
      return;
    }

    // wait for permissions to load
    if (permissionsLoading) return;

    // allow admins or users with student-db/students permission
    const userIsAdmin = auth.hasRole('admin');
    const allowed = userIsAdmin || permissions?.can_manage_student_db || permissions?.can_manage_students;
    if (!allowed) {
      if (user?.role === 'office_bearer') {
        // Office Bearers should have access, so if check failed, it might be due to initial state
        // double check if permissions are fully loaded/correct role
        // but for now, if 'allowed' is false, we redirect
        navigate('/office-bearer');
      } else {
        navigate('/admin');
      }
      return;
    }

    // If a role is present in query params, use it as initial filter
    const params = new URLSearchParams(window.location.search || '');
    const roleParam = params.get('role');
    if (roleParam) {
      setFilterRole(roleParam);
    }
    loadData();
  }, [navigate, permissionsLoading, permissions]);
  const loadData = async () => {
    try {
      setError(null);
      setLoading(true);
      let usersRes;
      if (user?.role === 'office_bearer') {
        const res = await api.getStudentsScoped();
        if (res.success) {
          usersRes = { success: true, users: res.students || [] };
        } else {
          usersRes = { success: false, message: res.message };
        }
      } else {
        usersRes = await api.getUsers();
      }

      if (usersRes.success) {
        const users = usersRes.users || [];

        // Fetch profiles for students, office bearers, and alumni
        const usersWithProfiles = await Promise.all(
          users.map(async (u: any) => {
            try {
              let profile = null;
              if (u.role === 'student') {
                const p = await api.getStudentProfile(u.id);
                profile = p.success ? p.profile : null;
              } else if (u.role === 'office_bearer') {
                const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/profile/office-bearer/${u.id}`, {
                  headers: { 'Authorization': `Bearer ${auth.getToken()}` }
                });
                const data = await res.json();
                profile = data.success ? data.profile : null;
              } else if (u.role === 'alumni') {
                // For alumni, try to get profile from unified profiles table
                try {
                  const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/${u.id}/profile`, {
                    headers: { 'Authorization': `Bearer ${auth.getToken()}` }
                  });
                  const data = await res.json();
                  profile = data.success ? data.profile : null;
                } catch {
                  profile = null;
                }
              }
              return { ...u, profile };
            } catch {
              return { ...u, profile: null };
            }
          })
        );

        setAllUsers(usersWithProfiles);

        // Extract unique departments
        const depts = Array.from(new Set(
          usersWithProfiles
            .map(u => u.profile?.dept)
            .filter(Boolean) as string[]
        )).sort();
        setDepartments(depts);
      } else {
        setError(usersRes.message || 'Failed to fetch users');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load users');
      toast.error('Failed to load users: ' + (error.message || 'Unknown'));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: any) => {
    if (!canEdit) {
      toast.error('You have view-only access; editing is disabled.');
      return;
    }
    setSelectedUser(user);
    setProfileData({
      register_no: user.profile?.register_no || '',
      dept: user.profile?.dept || '',
      year: user.profile?.year || '',
      academic_year: user.profile?.academic_year || '',
      phone: user.profile?.phone || '',
      father_number: user.profile?.father_number || '',
      blood_group: user.profile?.blood_group || '',
      gender: user.profile?.gender || '',
      dob: user.profile?.dob || '',
      address: user.profile?.address || '',
      hosteller_dayscholar: user.profile?.hosteller_dayscholar || ''
    });
    setShowEditDialog(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      toast.error('You do not have permission to save changes.');
      return;
    }
    if (!selectedUser) return;
    try {
      let res;
      if (selectedUser.role === 'student') {
        res = await api.updateStudentProfile(selectedUser.id, profileData);
      } else if (selectedUser.role === 'office_bearer') {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/profile/office-bearer/${selectedUser.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${auth.getToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(profileData)
        });
        res = await response.json();
      } else if (selectedUser.role === 'alumni') {
        // For alumni, update using unified profiles endpoint
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/${selectedUser.id}/profile`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${auth.getToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(profileData)
        });
        res = await response.json();
      }

      if (res?.success) {
        toast.success('Profile updated');
        setShowEditDialog(false);
        setSelectedUser(null);
        loadData();
      }
    } catch (error: any) {
      toast.error('Failed to update profile: ' + (error.message || 'Unknown'));
    }
  };

  const handleDelete = async (user: any) => {
    if (!canEdit) {
      toast.error('You have view-only access; deleting is disabled.');
      return;
    }
    if (!user) return;
    if (!confirm(`Delete user ${user.name}? This cannot be undone.`)) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/${user.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
      });
      const data = await response.json();
      if (data.success) {
        toast.success('User deleted');
        loadData();
      } else {
        throw new Error(data.message || 'Failed');
      }
    } catch (error: any) {
      toast.error('Failed to delete user: ' + (error.message || 'Unknown'));
    }
  };

  // Close any edit dialogs if the user's edit permission is revoked
  useEffect(() => {
    if (!canEdit) {
      setShowEditDialog(false);
    }
  }, [canEdit]);

  const submitPermissionRequest = async () => {
    if (!user) return;
    try {
      setRequestPending(true);
      const key = 'can_manage_student_db_edit';
      const res = await api.requestPermission(key, requestMessage);
      if (res && res.success) {
        toast.success('Permission request submitted to admin');
        setRequestDialogOpen(false);
        setRequestMessage('');
      } else {
        throw new Error(res?.message || 'Failed to submit request');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to submit request: ' + (err.message || 'Unknown'));
    } finally {
      setRequestPending(false);
    }
  };

  const handleExportExcel = () => {
    try {
      const excelData = filtered.map((u, i) => ({
        'S.No': i + 1,
        'Name': u.name || '',
        'Email': u.email || '',
        'Role': u.role || '',
        'Register No': u.profile?.register_no || '-',
        'Dept': u.profile?.dept || '-',
        'Year': u.profile?.year || '-',
        'Academic Year': u.profile?.academic_year || '-',
        'Phone': u.profile?.phone || '-',
        'Father Number': u.profile?.father_number || '-',
        'Blood': u.profile?.blood_group || '-',
        'Gender': u.profile?.gender || '-',
        'DOB': u.profile?.dob || '-',
        'Hosteller/Dayscholar': u.profile?.hosteller_dayscholar || '-',
        'Address': u.profile?.address || '-'
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

      // Set column widths
      worksheet['!cols'] = [
        { wch: 8 },  // S.No
        { wch: 25 }, // Name
        { wch: 30 }, // Email
        { wch: 12 }, // Role
        { wch: 15 }, // Register No
        { wch: 15 }, // Dept
        { wch: 8 },  // Year
        { wch: 15 }, // Academic Year
        { wch: 15 }, // Phone
        { wch: 15 }, // Father Number
        { wch: 10 }, // Blood
        { wch: 10 }, // Gender
        { wch: 12 }, // DOB
        { wch: 18 }, // Hosteller/Dayscholar
        { wch: 40 }  // Address
      ];

      const fileName = `user_database_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success('Excel file exported successfully');
    } catch (error: any) {
      console.error('Error exporting to Excel:', error);
      toast.error('Failed to export Excel file');
    }
  };

  const filtered = allUsers.filter(u => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.profile?.dept || '').toLowerCase().includes(q);
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    const matchesDept = filterDept === 'all' || u.profile?.dept === filterDept;
    return matchesSearch && matchesRole && matchesDept;
  });

  const roleLabels: Record<string, string> = {
    'admin': 'Admin',
    'student': 'Student',
    'office_bearer': 'Office Bearer',
    'alumni': 'Alumni'
  };

  return (
    <div className="min-h-screen flex flex-col">
      {permissionsLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      )}

      <DeveloperCredit />
      <div className="flex flex-1">
        <main className="flex-1 p-2 md:p-4 bg-background w-full">
          <ErrorBoundary>
            <div className="w-full">
              {/* Back Button */}
              <div className="mb-4">
                <BackButton to="/admin" />
              </div>

              {/* Page Header */}
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-semibold text-foreground mb-1">User Database</h1>
                  <p className="text-sm text-muted-foreground">View, edit, and manage all user records (Students, Office Bearers, Alumni)</p>
                </div>
                {!canEdit && (
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground">View-only access</div>
                    {user?.role === 'office_bearer' && (
                      <Button size="sm" onClick={() => setRequestDialogOpen(true)} variant="outline">Request Edit Access</Button>
                    )}
                  </div>
                )}
              </div>

              {/* Search and Filter Controls */}
              <Card className="gradient-card border-border/50 mb-8 shadow-md bg-white/50 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="search">Search</Label>
                      <Input
                        id="search"
                        placeholder="Search by name, email, dept..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="border-orange-200/50 focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <Label htmlFor="role">Filter by Role</Label>
                      <Select value={filterRole} onValueChange={setFilterRole}>
                        <SelectTrigger id="role" className="border-orange-200/50 focus:border-orange-500 focus:ring-orange-500">
                          <SelectValue placeholder="All roles" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="office_bearer">Office Bearer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="dept">Filter by Department</Label>
                      <Select value={filterDept} onValueChange={setFilterDept}>
                        <SelectTrigger id="dept" className="border-orange-200/50 focus:border-orange-500 focus:ring-orange-500">
                          <SelectValue placeholder="All departments" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Departments</SelectItem>
                          {departments.map(dept => (
                            <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-2">
                      <Button onClick={() => loadData()} variant="outline" className="flex-1 border-orange-200/50 hover:border-orange-300">Refresh</Button>
                      <Button onClick={() => handleExportExcel()} variant="outline" className="gap-2 border-orange-200/50 hover:border-orange-300">
                        <Download className="w-4 h-4" />
                        Export Excel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="gradient-card">
                <CardHeader>
                  <CardTitle>Users ({filtered.length})</CardTitle>
                  <CardDescription>List of all users and their profile details</CardDescription>
                </CardHeader>
                <CardContent>
                  {error ? (
                    <div className="text-center py-8 text-red-500">
                      {error}
                      <div className="mt-4">
                        <Button variant="outline" onClick={() => loadData()}>
                          Retry
                        </Button>
                      </div>
                    </div>
                  ) : loading ? (
                    <div className="text-center py-8">Loading users...</div>
                  ) : filtered.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No users found</div>
                  ) : (
                    <div>
                      {!canEdit && (
                        <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded">
                          You have view-only access to the user database. Editing, adding, and deleting users is disabled.
                        </div>
                      )}
                      <div className="overflow-x-auto border rounded-xl">
                        <Table>
                          <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                            <TableRow>
                              <TableHead className="bg-white">S.No</TableHead>
                              <TableHead className="bg-white">Name</TableHead>
                              <TableHead className="bg-white">Email</TableHead>
                              <TableHead className="bg-white">Role</TableHead>
                              <TableHead className="bg-white">Reg No</TableHead>
                              <TableHead className="bg-white">Dept</TableHead>
                              <TableHead className="bg-white">Year</TableHead>
                              <TableHead className="bg-white">Academic Year</TableHead>
                              <TableHead className="bg-white">Phone</TableHead>
                              <TableHead className="bg-white">Father Number</TableHead>
                              <TableHead className="bg-white">Blood</TableHead>
                              <TableHead className="bg-white">Gender</TableHead>
                              <TableHead className="bg-white">DOB</TableHead>
                              <TableHead className="bg-white">Hosteller/Dayscholar</TableHead>
                              <TableHead className="bg-white">Address</TableHead>
                              <TableHead className="text-right bg-white">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filtered.map((u, i) => (
                              <TableRow key={u.id}>
                                <TableCell>{i + 1}</TableCell>
                                <TableCell className="font-medium">{u.name}</TableCell>
                                <TableCell className="text-sm">{u.email}</TableCell>
                                <TableCell><span className="text-xs bg-primary/20 px-2 py-1 rounded">{roleLabels[u.role] || u.role}</span></TableCell>
                                <TableCell>{u.profile?.register_no || '-'}</TableCell>
                                <TableCell>{u.profile?.dept || '-'}</TableCell>
                                <TableCell>{u.profile?.year || '-'}</TableCell>
                                <TableCell>{u.profile?.academic_year || '-'}</TableCell>
                                <TableCell>{u.profile?.phone || '-'}</TableCell>
                                <TableCell>{u.profile?.father_number || '-'}</TableCell>
                                <TableCell>{u.profile?.blood_group || '-'}</TableCell>
                                <TableCell>{u.profile?.gender || '-'}</TableCell>
                                <TableCell>{u.profile?.dob || '-'}</TableCell>
                                <TableCell>{u.profile?.hosteller_dayscholar || '-'}</TableCell>
                                <TableCell className="text-sm">{u.profile?.address || '-'}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex gap-2 justify-end">
                                    {canEdit ? (
                                      <>
                                        <Button size="sm" variant="outline" onClick={() => handleEdit(u)} className="gap-1">
                                          <Edit className="w-4 h-4" /> Edit
                                        </Button>
                                        <Button size="sm" variant="destructive" onClick={() => handleDelete(u)} className="gap-1">
                                          <Trash2 className="w-4 h-4" /> Delete
                                        </Button>
                                      </>
                                    ) : null}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </ErrorBoundary>
        </main>
      </div>


      {/* Request Edit Access Dialog */}
      <UIDialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <UIDialogContent className="max-w-lg">
          <UIDialogHeader>
            <UIDialogTitle>Request Edit Access</UIDialogTitle>
          </UIDialogHeader>
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">Send a short message to the admin explaining why you need edit access.</p>
            <textarea value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)} className="w-full p-2 border rounded" rows={4} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => submitPermissionRequest()} disabled={requestPending}>{requestPending ? 'Sending...' : 'Send Request'}</Button>
            </div>
          </div>
        </UIDialogContent>
      </UIDialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User Profile</DialogTitle>
            <DialogDescription>Update profile for {selectedUser?.name} ({roleLabels[selectedUser?.role] || selectedUser?.role})</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Register No</Label>
                <Input value={profileData.register_no} onChange={(e) => setProfileData({ ...profileData, register_no: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={profileData.dept || "none"} onValueChange={(val) => setProfileData({ ...profileData, dept: val === "none" ? '' : val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select department</SelectItem>
                    {DEPARTMENTS.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={profileData.year || "none"} onValueChange={(val) => setProfileData({ ...profileData, year: val === "none" ? '' : val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select year</SelectItem>
                    <SelectItem value="I">I Year</SelectItem>
                    <SelectItem value="II">II Year</SelectItem>
                    <SelectItem value="III">III Year</SelectItem>
                    <SelectItem value="IV">IV Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Academic Year</Label>
                <Input value={profileData.academic_year} onChange={(e) => setProfileData({ ...profileData, academic_year: e.target.value })} placeholder="e.g., 2024-2025" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={profileData.phone} onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Father Number</Label>
                <Input value={profileData.father_number} onChange={(e) => setProfileData({ ...profileData, father_number: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>DOB</Label>
                <Input type="date" value={profileData.dob} onChange={(e) => setProfileData({ ...profileData, dob: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <select
                  value={profileData.gender}
                  onChange={(e) => setProfileData({ ...profileData, gender: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Blood Group</Label>
                <select
                  value={profileData.blood_group}
                  onChange={(e) => setProfileData({ ...profileData, blood_group: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select blood group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Hosteller or Dayscholar</Label>
                <select
                  value={profileData.hosteller_dayscholar}
                  onChange={(e) => setProfileData({ ...profileData, hosteller_dayscholar: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select</option>
                  <option value="Hosteller">Hosteller</option>
                  <option value="Dayscholar">Dayscholar</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea value={profileData.address} onChange={(e) => setProfileData({ ...profileData, address: e.target.value })} rows={3} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>


    </div>
  );
};

export default ManageStudentDatabase;
