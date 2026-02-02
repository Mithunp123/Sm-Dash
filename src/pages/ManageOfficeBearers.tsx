import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Users, Plus, ArrowLeft, Edit, Trash2, Search } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { BackButton } from "@/components/BackButton";
import { usePermissions } from "@/hooks/usePermissions";

const ManageOfficeBearers = () => {
  const navigate = useNavigate();
  const [officeBearers, setOfficeBearers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: ""
  });

  const { permissions, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }

    if (permissionsLoading) return;

    const isAdmin = auth.hasRole('admin');
    const hasPermission = isAdmin || permissions.can_manage_users;

    if (!hasPermission) {
      toast.error("Access denied. Management access required.");
      navigate("/admin");
      return;
    }

    loadOfficeBearers();
  }, [permissionsLoading, permissions]);

  const loadOfficeBearers = async () => {
    try {
      setLoading(true);
      const response = await api.getUsers();
      if (response.success) {
        const obUsers = response.users?.filter((u: any) => u.role === 'office_bearer') || [];
        setOfficeBearers(obUsers);
      }
    } catch (error: any) {
      toast.error("Failed to load office bearers: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOfficeBearer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userData: any = {
        name: formData.name,
        email: formData.email,
        role: 'office_bearer'
      };

      if (formData.password && formData.password.trim() !== "") {
        userData.password = formData.password;
      }

      const response = await api.addUser(userData);
      if (response.success) {
        toast.success("Office Bearer added successfully!");
        if (response.defaultPassword) {
          toast.info(`Default password: ${response.defaultPassword}`);
        }
        setShowAddDialog(false);
        setFormData({ name: "", email: "", password: "" });
        loadOfficeBearers();
      }
    } catch (error: any) {
      toast.error("Failed to add office bearer: " + error.message);
    }
  };

  const handleEditOfficeBearer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      // Update user details
      // Update user details
      const response = await api.put(`/users/${selectedUser.id}`, {
        name: formData.name,
        email: formData.email
      });

      // Response structure handling based on api.request return type
      // api.put returns { success: boolean, ... } directly
      if (response && response.success) {
        toast.success("Office Bearer updated successfully!");
        setShowEditDialog(false);
        setSelectedUser(null);
        setFormData({ name: "", email: "", password: "" });
        loadOfficeBearers();
      } else {
        throw new Error(response.message || 'Update failed');
      }
    } catch (error: any) {
      toast.error("Failed to update office bearer: " + error.message);
    }
  };

  const handleDeleteOfficeBearer = async () => {
    if (!selectedUser) return;

    try {
      const response = await api.delete(`/users/${selectedUser.id}`);

      if (response && response.success) {
        toast.success("Office Bearer deleted successfully!");
        setShowDeleteDialog(false);
        setSelectedUser(null);
        loadOfficeBearers();
      } else {
        throw new Error(response.message || 'Delete failed');
      }
    } catch (error: any) {
      toast.error("Failed to delete office bearer: " + error.message);
    }
  };

  const openEditDialog = (user: any) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: ""
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (user: any) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  return (
    <div className="min-h-screen flex flex-col">

      <DeveloperCredit />

      <main className="flex-1 p-2 md:p-4 bg-background">
        <div className="w-full">
          {/* Back Button */}
          <div className="mb-4">
            <BackButton to="/admin" />
          </div>

          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-primary">Manage Office Bearers</h1>
              <p className="text-muted-foreground">Add, edit, or remove office bearers</p>
            </div>
            <Button onClick={() => setShowAddDialog(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Office Bearer
            </Button>
          </div>

          {/* Filter Section */}
          <Card className="gradient-card border-border/50 mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search office bearers by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Office Bearers Table - Compact Layout */}
          <Card className="gradient-card border-border/50">
            <CardContent className="pt-6">
              {officeBearers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No office bearers found</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {officeBearers
                        .filter((user) => {
                          return user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            user.email.toLowerCase().includes(searchQuery.toLowerCase());
                        })
                        .map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarImage src={user.photo || user.photoUrl || '/Images/Brand_logo.png'} alt={user.name} />
                                  <AvatarFallback>{((user.name || "").split(" ").map(s => s[0]).slice(0, 2).join("") || "?")}</AvatarFallback>
                                </Avatar>
                                <span>{user.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{user.email}</TableCell>
                            <TableCell>
                              <Badge variant="default">OFFICE BEARER</Badge>
                            </TableCell>
                            <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditDialog(user)}
                                className="gap-1"
                              >
                                <Edit className="w-4 h-4" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => openDeleteDialog(user)}
                                className="gap-1"
                              >
                                <Trash2 className="w-4 h-4" />
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Add Office Bearer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Office Bearer</DialogTitle>
            <DialogDescription>
              Create a new office bearer account
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddOfficeBearer} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password (Optional)</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Leave empty for default password (OB@123)"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false);
                  setFormData({ name: "", email: "", password: "" });
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Add Office Bearer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Office Bearer Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Office Bearer</DialogTitle>
            <DialogDescription>
              Update office bearer details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditOfficeBearer} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowEditDialog(false);
                  setSelectedUser(null);
                  setFormData({ name: "", email: "", password: "" });
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Office Bearer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedUser?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => {
              setShowDeleteDialog(false);
              setSelectedUser(null);
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteOfficeBearer}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>


    </div>
  );
};

export default ManageOfficeBearers;

