import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Shield, ArrowLeft, CheckCircle2, XCircle, Search, Edit, Trash2, Users, Timer, Plus } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

type ModuleKey =
  | 'can_manage_users'
  | 'can_manage_student_db'
  | 'can_manage_profile_fields'
  | 'can_manage_meetings'
  | 'can_manage_events'
  | 'can_manage_attendance'
  | 'can_manage_bills'
  | 'can_manage_projects'
  | 'can_manage_resources'
  | 'can_manage_teams'
  | 'can_manage_volunteers'
  | 'can_manage_messages'
  | 'can_manage_students'
  | 'can_manage_alumni'
  | 'can_manage_feedback_questions'
  | 'can_manage_feedback_reports'
  | 'can_manage_permissions_module'
  | 'can_manage_settings'
  | 'can_view_analytics';

interface Permission {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role: string;
  [key: string]: any;
}

const moduleDefinitions: Array<{ key: ModuleKey; label: string; description: string }> = [
  { key: 'can_manage_users', label: 'Manage Users', description: 'Add/Edit users' },
  { key: 'can_manage_student_db', label: 'Student Database', description: 'Access student DB' },
  { key: 'can_manage_profile_fields', label: 'Profile Fields', description: 'Configure profile fields' },
  { key: 'can_manage_projects', label: 'Projects', description: 'Manage projects' },
  { key: 'can_manage_meetings', label: 'Meetings', description: 'Create and manage meetings' },
  { key: 'can_manage_events', label: 'Events', description: 'Manage events and OD' },
  { key: 'can_manage_attendance', label: 'Attendance', description: 'Mark attendance' },
  { key: 'can_manage_bills', label: 'Bills', description: 'Submit and approve bills' },
  { key: 'can_manage_resources', label: 'Resources', description: 'Share resources' },
  { key: 'can_manage_teams', label: 'Teams', description: 'Manage teams and members' },
  { key: 'can_manage_volunteers', label: 'Volunteer Submissions', description: 'Review volunteer submissions' },
  { key: 'can_manage_messages', label: 'Messages', description: 'Access messages' },
  { key: 'can_manage_students', label: 'Students', description: 'Manage student access' },
  { key: 'can_manage_alumni', label: 'Alumni', description: 'Manage alumni access' },
  { key: 'can_manage_feedback_questions', label: 'Feedback Questions', description: 'Manage question bank' },
  { key: 'can_manage_feedback_reports', label: 'Feedback Reports', description: 'View feedback reports' },
  { key: 'can_manage_permissions_module', label: 'Permissions', description: 'Manage permissions' },
  { key: 'can_manage_settings', label: 'Settings', description: 'Update settings' },
  { key: 'can_view_analytics', label: 'Analytics', description: 'View analytics dashboard' }
];

type PermissionFormState = Record<string, boolean> & {
  can_manage_time_requests: boolean;
  can_approve_time_extensions: boolean;
  can_reject_time_extensions: boolean;
};

const createEmptyModuleState = (): Record<ModuleKey, boolean> => {
  return moduleDefinitions.reduce((acc, mod) => {
    acc[mod.key] = false;
    return acc;
  }, {} as Record<ModuleKey, boolean>);
};

const createEmptyPermissionData = (): PermissionFormState => {
  const base: Record<string, boolean> = {};
  moduleDefinitions.forEach((mod) => {
    base[`${mod.key}_view`] = false;
    base[`${mod.key}_edit`] = false;
  });
  return {
    ...base,
    can_manage_time_requests: false,
    can_approve_time_extensions: false,
    can_reject_time_extensions: false
  } as PermissionFormState;
};

const ManagePermissions = () => {
  const navigate = useNavigate();
  const { permissions: currentUserPermissions, loading: permissionsLoading } = usePermissions();
  const [users, setUsers] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileFieldsSettings, setProfileFieldsSettings] = useState<any[]>([]);
  const [roleProfileFields, setRoleProfileFields] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyWithPermissions, setShowOnlyWithPermissions] = useState(true); // Default: show only users with permissions
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRoleDetailsDialog, setShowRoleDetailsDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isAlumniEditing, setIsAlumniEditing] = useState(false);
  const [roleProfileFieldsLocal, setRoleProfileFieldsLocal] = useState<any[]>([]);
  const [rolePermissionsLocal, setRolePermissionsLocal] = useState<Record<ModuleKey, boolean>>(() => createEmptyModuleState());
  const [permissionData, setPermissionData] = useState<PermissionFormState>(() => createEmptyPermissionData());
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [accessInitialized, setAccessInitialized] = useState(false);
  const [viewOnlyMode, setViewOnlyMode] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }

    if (permissionsLoading) return;

    const user = auth.getUser();
    const isAdmin = user?.role === 'admin';
    const canViewModule = isAdmin || currentUserPermissions.can_manage_permissions_module;

    if (!canViewModule) {
      toast.error("You don't have permission to view this page.");
      navigate("/admin");
      return;
    }

    setViewOnlyMode(!isAdmin);

    if (!accessInitialized) {
      loadData();
      setAccessInitialized(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, permissionsLoading, currentUserPermissions, accessInitialized]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchParam = params.get('search');
    const userIdParam = params.get('userId');

    if (searchParam) {
      setSearchQuery(searchParam);
    }

    if (userIdParam) {
      const parsed = parseInt(userIdParam, 10);
      if (!isNaN(parsed)) {
        setPendingUserId(parsed);
      }
    }
  }, [location.search]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, permissionsRes, profileFieldsRes, roleProfileRes] = await Promise.all([
        api.getPermissionUsers(),
        api.getPermissions(),
        api.getProfileFieldSettings(),
        api.getRoleProfileFieldSettings()
      ]);
      
      if (usersRes.success) {
        // Load students, office bearers, and alumni for permissions management
        const allUsers = usersRes.users || [];
        const permissionUsers = allUsers.filter((u: any) => 
          u.role === 'student' || u.role === 'office_bearer' || u.role === 'alumni'
        );
        setUsers(permissionUsers);
      }
      
      if (permissionsRes.success) {
        setPermissions(permissionsRes.permissions || []);
      }

      if (profileFieldsRes && profileFieldsRes.success) {
        setProfileFieldsSettings(profileFieldsRes.fields || []);
      }

      if (roleProfileRes && roleProfileRes.success) {
        // rows: { role, field_name, can_view, can_edit }
        setRoleProfileFields(roleProfileRes.rows || []);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error("Failed to load data: " + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && pendingUserId && users.length) {
      const targetUser = users.find((u) => u.id === pendingUserId);
      if (targetUser) {
        handleEditPermission(targetUser);
        setPendingUserId(null);
        const params = new URLSearchParams(location.search);
        params.delete('userId');
        params.delete('search');
        navigate(`${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`, { replace: true });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pendingUserId, users]);

  const handleToggleRoleField = (role: string, fieldName: string, key: 'can_view' | 'can_edit', value: boolean) => {
    setRoleProfileFieldsLocal(prev => {
      const copy = prev.map(r => ({ ...r }));
      const idx = copy.findIndex(r => r.role === role && r.field_name === fieldName);
      if (idx !== -1) {
        copy[idx][key] = value ? 1 : 0;
      } else {
        copy.push({ role, field_name: fieldName, can_view: key === 'can_view' ? (value ? 1 : 0) : 0, can_edit: key === 'can_edit' ? (value ? 1 : 0) : 0 });
      }
      return copy;
    });
  };

  const handleSaveRoleProfileFields = async () => {
    try {
      const rows = roleProfileFieldsLocal.map(r => ({ role: r.role, field_name: r.field_name, can_view: !!r.can_view, can_edit: !!r.can_edit }));
      const res = await api.updateRoleProfileFieldSettings(rows);
      if (res.success) {
        toast.success('Role profile field settings updated');
        const refreshed = await api.getRoleProfileFieldSettings();
        if (refreshed.success) {
          setRoleProfileFields(refreshed.rows || []);
          setRoleProfileFieldsLocal(refreshed.rows || []);
        }
      } else {
        throw new Error(res.message || 'Failed to update role profile fields');
      }
    } catch (error: any) {
      console.error('Error updating role profile fields:', error);
      toast.error('Failed to save role profile field settings: ' + (error.message || 'Unknown error'));
    }
  };

  const handleOpenRoleDetails = (role: string) => {
    setSelectedRole(role);
    setRoleProfileFieldsLocal(roleProfileFields.filter(r => r.role === role));
    setRolePermissionsLocal(createEmptyModuleState());
    setShowRoleDetailsDialog(true);
  };

  const getUserPermission = (userId: number): Permission | null => {
    return permissions.find(p => p.user_id === userId) || null;
  };

  const handleEditPermission = (user: any) => {
    setSelectedUser(user);
    setIsAlumniEditing(user.role === 'alumni');
    const existingPermission = getUserPermission(user.id);
    if (existingPermission) {
      // Initialize new view/edit pairs from the existing single-flag implementation
      const updatedState = createEmptyPermissionData();
      updatedState.can_manage_time_requests = existingPermission.can_manage_time_requests === 1;
      updatedState.can_approve_time_extensions = existingPermission.can_approve_time_extensions === 1;
      updatedState.can_reject_time_extensions = existingPermission.can_reject_time_extensions === 1;
      moduleDefinitions.forEach((mod) => {
        const storedView = existingPermission[`${mod.key}_view`];
        const storedEdit = existingPermission[`${mod.key}_edit`];
        const legacyFlag = existingPermission[mod.key] === 1;
        updatedState[`${mod.key}_view`] = storedView === 1 || storedView === true || legacyFlag;
        updatedState[`${mod.key}_edit`] = storedEdit === 1 || storedEdit === true || (legacyFlag && storedEdit === undefined);
      });
      setPermissionData(updatedState);
    } else {
      setPermissionData(createEmptyPermissionData());
    }
    setShowEditDialog(true);
  };

  const handleSavePermission = async () => {
    if (viewOnlyMode) {
      setShowEditDialog(false);
      return;
    }
    if (!selectedUser) return;
    
    try {
      // Build the permission payload - include base flags based on view/edit
      const payload: any = { ...permissionData };
      
      // For each module, set the base permission flag if either view or edit is true
      moduleDefinitions.forEach((mod) => {
        const hasView = !!permissionData[`${mod.key}_view`];
        const hasEdit = !!permissionData[`${mod.key}_edit`];
        payload[mod.key] = hasView;
        payload[`${mod.key}_view`] = hasView;
        payload[`${mod.key}_edit`] = hasEdit;
      });
      
      const response = await api.updatePermissions(selectedUser.id, payload);
      if (response.success) {
        toast.success("Permissions updated successfully!");
        // Set a flag in localStorage so the user's tab picks up the permission change
        localStorage.setItem('permissions_updated', Date.now().toString());
        // Broadcast via storage event so other tabs refresh too
        window.dispatchEvent(new StorageEvent('storage', { key: 'permissions_updated', newValue: Date.now().toString() }));
        setShowEditDialog(false);
        loadData();
      } else {
        throw new Error(response.message || 'Failed to update permissions');
      }
    } catch (error: any) {
      console.error('Error updating permissions:', error);
      toast.error("Failed to update permissions: " + (error.message || 'Unknown error'));
    }
  };

  const handleDeletePermission = async (userId: number, userName: string) => {
    if (viewOnlyMode) return;
    if (!confirm(`Are you sure you want to delete permissions for ${userName}?`)) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/permissions/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${auth.getToken()}`
        }
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Permissions deleted successfully!");
        loadData();
      } else {
        throw new Error(data.message || 'Failed to delete permissions');
      }
    } catch (error: any) {
      toast.error("Failed to delete permissions: " + error.message);
    }
  };

  const getPermissionBadge = (hasPermission: boolean) => {
    return hasPermission ? (
      <Badge variant="default" className="bg-emerald-600 gap-1">
        <CheckCircle2 className="w-3 h-3" />
        Editable
      </Badge>
    ) : (
      <Badge variant="outline" className="gap-1">
        <XCircle className="w-3 h-3" />
        Hidden
      </Badge>
    );
  };

  const getPermissionBadges = (permission: Permission | null, modKey: ModuleKey) => {
    // Backwards-compatible: if backend only has single flag (modKey), treat that as both view & edit
    const hasSingle = permission ? permission[modKey] === 1 : false;
    const hasView = permission ? Boolean(permission[`${modKey}_view`] === 1 || permission[`${modKey}_view`] === true || hasSingle) : false;
    const hasEdit = permission ? Boolean(permission[`${modKey}_edit`] === 1 || permission[`${modKey}_edit`] === true || hasSingle) : false;

    return (
      <div className="flex items-center gap-1.5">
        {hasView ? (
          <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1 px-2 py-0.5 text-xs font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Visible
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 px-2 py-0.5 text-xs border-gray-300 text-gray-600">
            <XCircle className="w-3 h-3" />
            Hidden
          </Badge>
        )}

        {hasEdit ? (
          <Badge variant="default" className="bg-blue-500 hover:bg-blue-600 text-white gap-1 px-2 py-0.5 text-xs font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Editable
          </Badge>
        ) : hasView ? (
          <Badge variant="outline" className="gap-1 px-2 py-0.5 text-xs border-amber-300 text-amber-700 bg-amber-50">
            <Timer className="w-3 h-3" />
            Read-only
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 px-2 py-0.5 text-xs border-gray-300 text-gray-600">
            <XCircle className="w-3 h-3" />
            Read-only
          </Badge>
        )}
      </div>
    );
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filter by permissions if enabled
    if (showOnlyWithPermissions) {
      const permission = getUserPermission(user.id);
      if (!permission) return false;
    }
    
    return matchesSearch;
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <DeveloperCredit />
      
      <div className="flex flex-1">
        <main className="flex-1 p-4 md:p-8 bg-gradient-to-b from-background via-background to-orange-50/20">
          <div className="max-w-7xl mx-auto">
            {/* Hero Header Section */}
            <div className="mb-8 bg-gradient-to-r from-orange-600 via-orange-500 to-red-500 rounded-xl p-8 text-white shadow-lg">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" onClick={() => navigate("/admin")} className="gap-2 hover:bg-white/20 text-white">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                  </Button>
                </div>
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">Manage Permissions</h1>
                <p className="text-lg opacity-90">Manage permissions and profile fields by role</p>
              </div>
            </div>

            {/* Individual Users Table */}
            <Card className="gradient-card border-border/50 shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                      <Shield className="w-6 h-6 text-primary" />
                      Individual User Permissions
                    </CardTitle>
                    <CardDescription className="mt-1 text-base">
                      Manage specific user permissions and access controls
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <Input
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-11 text-base"
                    />
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2 rounded-lg border bg-card">
                    <Switch
                      checked={showOnlyWithPermissions}
                      onCheckedChange={setShowOnlyWithPermissions}
                      id="filter-permissions"
                    />
                    <Label htmlFor="filter-permissions" className="cursor-pointer text-sm font-medium">
                      Show only users with permissions
                    </Label>
                  </div>
                </div>
                {loading ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="mt-4 text-muted-foreground">Loading permissions...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground text-lg">No users found</p>
                    <p className="text-sm text-muted-foreground mt-1">Try adjusting your search query</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredUsers.map((user, index) => {
                      const permission = getUserPermission(user.id);
                      const hasViewCount = moduleDefinitions.filter(mod => {
                        const hasSingle = permission ? permission[mod.key] === 1 : false;
                        return permission ? Boolean(permission[`${mod.key}_view`] === 1 || permission[`${mod.key}_view`] === true || hasSingle) : false;
                      }).length;
                      const hasEditCount = moduleDefinitions.filter(mod => {
                        const hasSingle = permission ? permission[mod.key] === 1 : false;
                        return permission ? Boolean(permission[`${mod.key}_edit`] === 1 || permission[`${mod.key}_edit`] === true || hasSingle) : false;
                      }).length;
                      
                      return (
                        <Card key={user.id} className="border-2 hover:border-primary/50 transition-all hover:shadow-md">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between gap-4 mb-4">
                              <div className="flex items-center gap-4 flex-1">
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-lg">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                  <h3 className="text-lg font-semibold text-foreground">{user.name}</h3>
                                  <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge 
                                      variant={user.role === 'office_bearer' ? 'default' : 'secondary'}
                                      className={user.role === 'office_bearer' ? 'bg-orange-500 hover:bg-orange-600' : ''}
                                    >
                                      {user.role === 'office_bearer' ? 'Office Bearer' : (user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User')}
                                    </Badge>
                                    {permission && (
                                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                          {hasViewCount} Visible
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <CheckCircle2 className="w-3 h-3 text-blue-500" />
                                          {hasEditCount} Editable
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant={getUserPermission(user.id) ? "outline" : "default"}
                                  onClick={() => handleEditPermission(user)}
                                  className="gap-1.5 hover:bg-primary hover:text-primary-foreground"
                                >
                                  {getUserPermission(user.id) ? (
                                    <>
                                      <Edit className="w-4 h-4" />
                                      {viewOnlyMode ? 'View' : 'Edit'}
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-4 h-4" />
                                      Add Permission
                                    </>
                                  )}
                                </Button>
                                {!viewOnlyMode && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDeletePermission(user.id, user.name)}
                                    className="gap-1.5"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            <div className="border-t pt-4">
                              <h4 className="text-sm font-semibold text-foreground mb-3">Module Permissions</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {moduleDefinitions.map((mod) => (
                                  <div 
                                    key={`${user.id}-${mod.key}`} 
                                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-foreground truncate">{mod.label}</p>
                                      <p className="text-xs text-muted-foreground truncate">{mod.description}</p>
                                    </div>
                                    <div className="ml-2 flex-shrink-0">
                                      {getPermissionBadges(permission, mod.key)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Edit Permission Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              {selectedUser && getUserPermission(selectedUser.id) ? 'Edit Permissions' : 'Add Permissions'}
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              {selectedUser ? (
                <>
                  Configure access permissions for <span className="font-semibold text-foreground">{selectedUser.name}</span>
                  <Badge variant="secondary" className="ml-2">
                    {selectedUser.role === 'office_bearer' ? 'Office Bearer' : selectedUser.role}
                  </Badge>
                </>
              ) : (
                'Configure access permissions for the selected user'
              )}
            </DialogDescription>
          </DialogHeader>
          {(isAlumniEditing || viewOnlyMode) && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <strong>Note:</strong> {viewOnlyMode ? 'You have read-only access to permissions.' : 'Alumni accounts are view-only in this system. You cannot change operational permissions here; only profile fields are editable.'}
            </div>
          )}
          <div className="space-y-4 mt-6">
            <div className="grid gap-3">
              {moduleDefinitions.map((mod) => (
                <div key={mod.key} className="flex items-center justify-between p-4 border-2 rounded-xl hover:border-primary/50 transition-colors bg-card">
                  <div className="flex-1 space-y-1">
                    <Label className="text-base font-semibold text-foreground">{mod.label}</Label>
                    <p className="text-sm text-muted-foreground">{mod.description}</p>
                  </div>
                  <div className="flex items-center gap-6 ml-4">
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <Label className="text-sm font-medium cursor-pointer block mb-1">View</Label>
                        <p className="text-xs text-muted-foreground">Can see</p>
                      </div>
                      <Switch
                        checked={!!permissionData[`${mod.key}_view`]}
                        onCheckedChange={(checked) => {
                          setPermissionData((prev) => ({
                            ...prev,
                            [`${mod.key}_view`]: !!checked,
                            // if view turned off, also turn off edit
                            ...(checked ? {} : { [`${mod.key}_edit`]: false })
                          }));
                        }}
                        disabled={isAlumniEditing || viewOnlyMode}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                      {permissionData[`${mod.key}_view`] && !permissionData[`${mod.key}_edit`] && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Admin can directly grant edit permission
                            if (confirm(`Grant edit permission for ${mod.label}?`)) {
                              setPermissionData((prev) => ({
                                ...prev,
                                [`${mod.key}_edit`]: true
                              }));
                            }
                          }}
                          className="ml-2 text-xs bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700"
                          disabled={isAlumniEditing || viewOnlyMode}
                        >
                          Grant Edit
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <Label className="text-sm font-medium cursor-pointer block mb-1">Edit</Label>
                        <p className="text-xs text-muted-foreground">
                          {permissionData[`${mod.key}_view`] ? 'Request needed' : 'View first'}
                        </p>
                      </div>
                      {permissionData[`${mod.key}_edit`] ? (
                        <Badge className="bg-blue-500 text-white">Editable</Badge>
                      ) : permissionData[`${mod.key}_view`] ? (
                        <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                          Read-only
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-gray-300 text-gray-600">
                          Hidden
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <div className="border-t-2 pt-6 mt-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Timer className="w-5 h-5 text-primary" />
                  Time Management
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 border-2 rounded-xl hover:border-primary/50 transition-colors bg-card">
                    <div className="space-y-1">
                      <Label className="text-base font-semibold text-foreground">Manage Time Requests</Label>
                      <p className="text-sm text-muted-foreground">View and manage time allotment requests</p>
                    </div>
                    <Switch
                      checked={permissionData.can_manage_time_requests}
                      onCheckedChange={(checked) => setPermissionData({ ...permissionData, can_manage_time_requests: checked })}
                      disabled={isAlumniEditing || viewOnlyMode}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border-2 rounded-xl hover:border-primary/50 transition-colors bg-card">
                    <div className="space-y-1">
                      <Label className="text-base font-semibold text-foreground">Approve Time Extensions</Label>
                      <p className="text-sm text-muted-foreground">Approve extension requests from users</p>
                    </div>
                    <Switch
                      checked={permissionData.can_approve_time_extensions}
                      onCheckedChange={(checked) => setPermissionData({ ...permissionData, can_approve_time_extensions: checked })}
                      disabled={isAlumniEditing || viewOnlyMode}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border-2 rounded-xl hover:border-primary/50 transition-colors bg-card">
                    <div className="space-y-1">
                      <Label className="text-base font-semibold text-foreground">Reject Time Extensions</Label>
                      <p className="text-sm text-muted-foreground">Reject extension requests from users</p>
                    </div>
                    <Switch
                      checked={permissionData.can_reject_time_extensions}
                      onCheckedChange={(checked) => setPermissionData({ ...permissionData, can_reject_time_extensions: checked })}
                      disabled={isAlumniEditing || viewOnlyMode}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                </div>
              </div>
            </div>

            {viewOnlyMode ? (
              <div className="flex justify-end pt-6 border-t-2 mt-6">
                <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)} className="min-w-[100px]">
                  Close
                </Button>
              </div>
            ) : (
              <div className="flex gap-3 justify-end pt-6 border-t-2 mt-6">
                <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)} className="min-w-[100px]">
                  Cancel
                </Button>
                <Button onClick={handleSavePermission} className="min-w-[100px] bg-primary hover:bg-primary/90">
                  Save Permissions
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Details Dialog */}
      <Dialog open={showRoleDetailsDialog} onOpenChange={setShowRoleDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedRole === 'student' ? 'Students' : selectedRole === 'office_bearer' ? 'Office Bearers' : selectedRole === 'alumni' ? 'Alumni' : (selectedRole ? selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1) : 'Role')} - Permissions & Profile Fields
            </DialogTitle>
            <DialogDescription>
              Manage what fields this role can view/edit and their general permissions
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="profile-fields" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="profile-fields">
                {selectedRole === 'student' ? 'Profile Fields' : 'Not Applicable'}
              </TabsTrigger>
              <TabsTrigger value="permissions">Role Permissions</TabsTrigger>
            </TabsList>

            {selectedRole === 'student' ? (
              <>
              {/* Profile Fields Tab - Only for Students */}
              <TabsContent value="profile-fields" className="space-y-4">
                <div className="space-y-4">
                  {profileFieldsSettings.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No profile fields configured.</div>
                  ) : (
                    profileFieldsSettings.map((field) => {
                      const row = roleProfileFieldsLocal.find(r => r.field_name === field.field_name) || { can_view: 0, can_edit: 0 };
                      
                      // Determine status
                      let status = 'Not Allowed';
                      let statusColor = 'text-red-500';
                      if (row.can_view) {
                        status = row.can_edit ? 'Editable' : 'Read-only';
                        statusColor = row.can_edit ? 'text-green-500' : 'text-amber-500';
                      }
                      
                      return (
                        <div key={field.field_name} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium">{field.label || field.field_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {field.field_name} {field.is_custom ? '(Custom)' : '(Predefined)'}
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className={`text-sm font-semibold ${statusColor}`}>
                                {status}
                              </div>
                              <div className="text-xs text-muted-foreground">Current</div>
                            </div>
                            <div className="flex items-center gap-4 min-w-fit">
                              <div className="flex items-center gap-2">
                                <Label className="text-sm cursor-pointer">View</Label>
                                <Switch
                                  checked={!!row.can_view}
                                  onCheckedChange={(checked) => {
                                    handleToggleRoleField(selectedRole || '', field.field_name, 'can_view', !!checked);
                                    // If unchecking view, also uncheck edit
                                    if (!checked && row.can_edit) {
                                      handleToggleRoleField(selectedRole || '', field.field_name, 'can_edit', false);
                                    }
                                  }}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Label className="text-sm cursor-pointer">Edit</Label>
                                <Switch
                                  checked={!!row.can_edit}
                                  disabled={!row.can_view}
                                  onCheckedChange={(checked) => handleToggleRoleField(selectedRole || '', field.field_name, 'can_edit', !!checked)}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowRoleDetailsDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveRoleProfileFields}>
                    Save Profile Field Settings
                  </Button>
                </div>
              </TabsContent>
              </>
            ) : (
              /* Profile Fields Tab Disabled - Only for Other Roles */
              <>
              </>
            )}

            {/* Permissions Tab */}
            <TabsContent value="permissions" className="space-y-4">
              <div className="text-sm text-muted-foreground mb-4">
                Configure what operations this role can perform
              </div>
              <div className="space-y-3">
                {moduleDefinitions.map((mod) => (
                  <div key={`role-${mod.key}`} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">{mod.label}</div>
                      <div className="text-sm text-muted-foreground">{mod.description}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${rolePermissionsLocal[mod.key] ? 'text-green-500' : 'text-red-500'}`}>
                        {rolePermissionsLocal[mod.key] ? 'Allowed' : 'Denied'}
                      </span>
                      <Switch
                        checked={rolePermissionsLocal[mod.key]}
                        onCheckedChange={(checked) =>
                          setRolePermissionsLocal((prev) => ({ ...prev, [mod.key]: checked }))
                        }
                        disabled={viewOnlyMode}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setShowRoleDetailsDialog(false)}>
                  Close
                </Button>
                {!viewOnlyMode && (
                  <Button onClick={() => {
                    toast.info('Role permissions save feature will be implemented in future');
                    setShowRoleDetailsDialog(false);
                  }}>
                    Save Role Permissions
                  </Button>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default ManagePermissions;

