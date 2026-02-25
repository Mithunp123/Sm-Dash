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


          {/* Page Header */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-2">
            <div>
              <h1 className="page-title">Projects</h1>
              <p className="page-subtitle border-l-4 border-primary/30 pl-3 mt-2">Design and manage community initiatives</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-stretch sm:items-center">
              <Button
                onClick={() => {
                  setFormData({ title: "", description: "", ngo_name: "", status: "active", start_date: "", end_date: "" });
                  setShowCreateDialog(true);
                }}
                className="gap-2 h-10 rounded-md font-semibold text-sm px-4 bg-primary w-full sm:w-auto"
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
                <Button onClick={() => setShowCreateDialog(true)} className="h-10 rounded-md font-semibold text-sm px-4">Create Project</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <Card key={project.id} className="group relative overflow-hidden rounded-[2.5rem] border-border/30 bg-card/40 backdrop-blur-md shadow-lg hover:shadow-2xl transition-all duration-500 flex flex-col h-full border hover:border-primary/40">
                    <div className={`absolute top-0 right-0 w-32 h-32 -mr-12 -mt-12 rounded-full opacity-10 blur-3xl transition-colors duration-500 ${project.status === 'active' ? 'bg-green-500 group-hover:bg-green-400' : 'bg-primary group-hover:bg-primary/80'}`} />

                    <CardHeader className="pb-4 px-8 pt-8 relative z-10">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="w-fit px-3 py-1 rounded-full border-primary/20 bg-primary/5 text-[9px] font-black uppercase tracking-widest text-primary">
                            {project.ngo_name || 'Individual Initiative'}
                          </Badge>
                        </div>
                        <Badge className={`${project.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-primary/10 text-primary border-primary/20'} font-black border px-3 py-1 rounded-full text-[9px] uppercase tracking-widest`}>
                          {project.status}
                        </Badge>
                      </div>
                      <CardTitle className="text-2xl font-black uppercase tracking-tight line-clamp-2 leading-tight mb-3 min-h-[3.5rem] group-hover:text-primary transition-colors">
                        {project.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2 text-[12px] font-medium text-muted-foreground leading-relaxed h-10">
                        {project.description || "Leading transformation through dedicated community engagement and sustainable project goals."}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="px-8 pb-8 flex-grow flex flex-col justify-end relative z-10">
                      <div className="flex items-center gap-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-8 bg-muted/30 p-3 rounded-[1.5rem] border border-border/10">
                        <div className="flex items-center gap-1.5 flex-1">
                          <Users className="w-4 h-4 text-primary" />
                          <span>{project.student_count || 0} Members</span>
                        </div>
                        <div className="w-px h-4 bg-border/50" />
                        <div className="flex items-center gap-1.5 flex-1 justify-end">
                          <Calendar className="w-4 h-4 text-primary" />
                          <span>{project.start_date ? new Date(project.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : "Planned"}</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            onClick={() => navigate(`${basePath}/projects/${project.id}/assign`)}
                            className="h-11 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-[11px] uppercase tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-95"
                          >
                            <Users className="w-4 h-4 mr-2" /> Assign
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => navigate(`${basePath}/projects/${project.id}`)}
                            className="h-11 rounded-2xl border-2 font-black text-[11px] uppercase tracking-widest hover:bg-primary/5 hover:text-primary transition-all active:scale-95"
                          >
                            <Eye className="w-4 h-4 mr-2" /> View
                          </Button>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => openEdit(project)}
                            className="flex-1 h-11 rounded-2xl font-black text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
                          >
                            <Edit className="w-4 h-4 mr-2" /> Quick Edit
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => openDelete(project)}
                            className="h-11 w-11 rounded-2xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all p-0 flex items-center justify-center active:scale-90"
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Button variant="outline" className="h-10 rounded-md font-semibold text-sm px-4 order-2 sm:order-1" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!formData.title} className="h-10 rounded-md bg-primary hover:bg-primary/90 font-semibold text-sm px-4 order-1 sm:order-2">Create Project</Button>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
