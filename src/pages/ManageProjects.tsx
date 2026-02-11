import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import DeveloperCredit from "@/components/DeveloperCredit";
import { BackButton } from "@/components/BackButton";
import { Plus, Edit, Trash2, Eye, Users, Activity, Calendar } from "lucide-react";
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
    <div className="min-h-screen flex flex-col">
      <DeveloperCredit />
      <main className="flex-1 w-full bg-background overflow-x-hidden">
        <div className="w-full p-2 md:p-4 space-y-6">
          <div className="mb-4">
            <BackButton to="/admin" />
          </div>

          {/* Page Header */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-2">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground">Projects</h1>
              <p className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground opacity-70 border-l-4 border-primary/30 pl-3 mt-1">Design and manage community initiatives</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Button
                onClick={() => {
                  setFormData({ title: "", description: "", ngo_name: "", status: "active", start_date: "", end_date: "" });
                  setShowCreateDialog(true);
                }}
                className="gap-2 h-11 px-6 rounded-2xl font-bold text-[10px] uppercase tracking-widest bg-primary shadow-lg shadow-primary/20 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                Create Project
              </Button>
            </div>
          </div>

          {
            loading ? (
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
                  <Card key={project.id} className="group relative overflow-hidden rounded-3xl border-border/40 bg-card/60 backdrop-blur-md shadow-md hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300 flex flex-col h-full">
                    <div className={`absolute top-0 right-0 w-32 h-32 -mr-12 -mt-12 rounded-full opacity-10 blur-2xl ${project.status === 'active' ? 'bg-green-500' : 'bg-primary'}`} />
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${project.status === 'active' ? 'bg-green-500' : 'bg-primary'}`} />

                    <CardHeader className="pb-4 px-6 pt-6">
                      <div className="flex justify-between items-start mb-3">
                        <Badge variant="outline" className="px-2 py-0.5 rounded-lg border-primary/20 bg-primary/5 text-[9px] font-black uppercase tracking-widest truncate max-w-[140px]">
                          {project.ngo_name || 'Individual'}
                        </Badge>
                        <Badge className={`${project.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-primary/10 text-primary border-primary/20'} font-black border px-2 py-0.5 rounded-lg text-[9px] uppercase tracking-widest`}>
                          {project.status}
                        </Badge>
                      </div>
                      <CardTitle className="text-2xl font-black uppercase tracking-tight line-clamp-1 leading-tight mb-2">
                        {project.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2 min-h-[40px] text-[11px] font-bold text-muted-foreground uppercase tracking-wide leading-relaxed">
                        {project.description || "No description provided."}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="px-6 pb-6 flex-grow flex flex-col justify-end">
                      <div className="flex items-center gap-4 text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-6">
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/5 rounded-lg border border-primary/10">
                          <Users className="w-3.5 h-3.5 text-primary" />
                          <span>Students: {project.student_count || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 rounded-lg border border-border/50">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{project.start_date ? new Date(project.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : "N/A"}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <Button
                          onClick={() => navigate(`${basePath}/projects/${project.id}/assign`)}
                          className="h-10 rounded-xl bg-primary shadow-lg shadow-primary/20 font-black text-[10px] uppercase tracking-widest gap-2"
                        >
                          <Users className="w-3.5 h-3.5" /> Assign
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => navigate(`${basePath}/projects/${project.id}`)}
                          className="h-10 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest hover:bg-primary/5 hover:text-primary transition-all gap-2"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => openEdit(project)}
                          className="flex-1 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest text-blue-600 hover:bg-blue-500/10 hover:text-blue-600 transition-all gap-2"
                        >
                          <Edit className="w-3.5 h-3.5" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => openDelete(project)}
                          className="h-10 w-10 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all p-0 flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          }
        </div >

        {/* Create Dialog */}
        < Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog} >
          <DialogContent className="sm:max-w-[600px] rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">Create New Project</DialogTitle>
              <DialogDescription className="font-medium text-muted-foreground">Add a new project to the dashboard</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="title" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Project Name *</Label>
                  <Input id="title" placeholder="Enter project name" className="h-12 rounded-2xl bg-muted/20 border-border/50 focus:ring-primary/20" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ngo" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">NGO Name</Label>
                  <Input id="ngo" placeholder="Partner NGO (if any)" className="h-12 rounded-2xl bg-muted/20 border-border/50 focus:ring-primary/20" value={formData.ngo_name} onChange={(e) => setFormData({ ...formData, ngo_name: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="desc" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Description</Label>
                <Textarea id="desc" placeholder="Briefly describe the project goals..." className="min-h-[100px] rounded-2xl bg-muted/20 border-border/50 focus:ring-primary/20 resize-none" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Start Date</Label>
                  <Input type="date" className="h-12 rounded-2xl bg-muted/20 border-border/50 focus:ring-primary/20" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">End Date</Label>
                  <Input type="date" className="h-12 rounded-2xl bg-muted/20 border-border/50 focus:ring-primary/20" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-3 flex-col sm:flex-row">
              <Button variant="outline" className="h-12 rounded-2xl font-bold order-2 sm:order-1" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!formData.title} className="h-12 rounded-2xl bg-primary hover:bg-primary/90 font-bold shadow-lg shadow-primary/20 order-1 sm:order-2">Create Project</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog >

        {/* Edit Dialog */}
        < Dialog open={showEditDialog} onOpenChange={setShowEditDialog} >
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
        </Dialog >

        {/* Delete Dialog */}
        < Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} >
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
        </Dialog >
      </main >
    </div >
  );
};

export default ManageProjects;
