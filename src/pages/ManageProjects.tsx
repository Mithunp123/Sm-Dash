import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/BackButton";
import { Plus, Edit, Trash2, Eye, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

const ManageProjects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog States
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [selectedProject, setSelectedProject] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    ngo_name: "",
    status: "active",
    start_date: "",
    end_date: ""
  });

  const { permissions, loading: permissionsLoading } = usePermissions();
  const user = auth.getUser();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }
    if (!permissionsLoading) {
      if (user?.role !== 'admin' && !permissions?.can_manage_projects) {
        toast.error("Permission denied");
        navigate("/admin");
        return;
      }
      loadProjects();
    }
  }, [permissions, permissionsLoading, navigate]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await api.getProjects();
      if (res.success) {
        setProjects(res.projects || []);
      }
    } catch (e: any) {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      let res;
      if (typeof api.createProject === 'function') {
        res = await api.createProject(formData);
      } else {
        res = await api.post('/projects', formData);
      }

      if (res.success) {
        toast.success("Project created successfully");
        setShowCreateDialog(false);
        setFormData({
          title: "",
          description: "",
          ngo_name: "",
          status: "active",
          start_date: "",
          end_date: ""
        });
        loadProjects();
      } else {
        toast.error(res.message || "Failed to create project");
      }
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const handleEdit = async () => {
    if (!selectedProject) return;
    try {
      let res;
      if (typeof api.updateProject === 'function') {
        res = await api.updateProject(selectedProject.id, formData);
      } else {
        res = await api.put(`/projects/${selectedProject.id}`, formData);
      }

      if (res.success) {
        toast.success("Project updated successfully");
        setShowEditDialog(false);
        loadProjects();
      } else {
        toast.error(res.message || "Failed to update project");
      }
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedProject) return;
    try {
      let res;
      if (typeof api.deleteProject === 'function') {
        res = await api.deleteProject(selectedProject.id);
      } else {
        res = await api.delete(`/projects/${selectedProject.id}`);
      }

      if (res.success) {
        toast.success("Project deleted");
        setShowDeleteDialog(false);
        loadProjects();
      } else {
        toast.error(res.message || "Failed to delete project");
      }
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const openEdit = (project: any) => {
    setSelectedProject(project);
    setFormData({
      title: project.title,
      description: project.description || "",
      ngo_name: project.ngo_name || "",
      status: project.status || "active",
      start_date: project.start_date ? project.start_date.split('T')[0] : "",
      end_date: project.end_date ? project.end_date.split('T')[0] : ""
    });
    setShowEditDialog(true);
  };

  const openDelete = (project: any) => {
    setSelectedProject(project);
    setShowDeleteDialog(true);
  };

  const role = auth.getRole();
  const basePath = '/admin';

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-4">
          <BackButton to={basePath} />
        </div>

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manage Projects</h1>
            <p className="text-muted-foreground">Create and manage your projects</p>
          </div>
          <Button onClick={() => {
            setFormData({ title: "", description: "", ngo_name: "", status: "active", start_date: "", end_date: "" });
            setShowCreateDialog(true);
          }}>
            <Plus className="w-4 h-4 mr-2" /> Create Project
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/20">
            <h3 className="text-lg font-semibold mb-2">No Projects Found</h3>
            <p className="text-muted-foreground mb-4">
              Get started by creating your first project.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>Create Project</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card key={project.id} className="flex flex-col h-full hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-xl line-clamp-1" title={project.title}>
                      {project.title}
                    </CardTitle>
                    <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                      {project.status}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2 min-h-[40px]">
                    {project.description || "No description provided."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><strong>NGO:</strong> {project.ngo_name || "N/A"}</p>
                    <p><strong>Date:</strong> {project.start_date ? new Date(project.start_date).toLocaleDateString() : "N/A"}</p>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2 pt-2 border-t bg-muted/10">
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full gap-1"
                      onClick={() => navigate(`${basePath}/projects/${project.id}/assign`)}
                    >
                      <Users className="w-3.5 h-3.5" /> Assign
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1"
                      onClick={() => navigate(`${basePath}/projects/${project.id}`)}
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full gap-1 hover:bg-muted"
                      onClick={() => openEdit(project)}
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => openDelete(project)}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>Add a new project to the dashboard</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Project Name *</Label>
              <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ngo">NGO Name</Label>
              <Input id="ngo" value={formData.ngo_name} onChange={(e) => setFormData({ ...formData, ngo_name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Date</Label>
                <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>End Date</Label>
                <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!formData.title}>Create Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update project details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Project Name</Label>
              <Input id="edit-title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-ngo">NGO Name</Label>
              <Input id="edit-ngo" value={formData.ngo_name} onChange={(e) => setFormData({ ...formData, ngo_name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea id="edit-desc" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Date</Label>
                <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>End Date</Label>
                <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedProject?.title}</strong>?
              This action cannot be undone and will remove all student assignments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ManageProjects;
