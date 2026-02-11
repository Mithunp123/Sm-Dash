import { useEffect, useRef, useState } from "react";
import DeveloperCredit from "@/components/DeveloperCredit";
import { BackButton } from "@/components/BackButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Upload, Trophy, Calendar as CalendarIcon, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { auth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";

type Award = {
  id: number;
  title: string;
  description?: string;
  recipient_name?: string;
  award_date?: string;
  year?: string;
  category?: string;
  image_url?: string;
};

const ManageAwards = () => {
  const navigate = useNavigate();
  const [awards, setAwards] = useState<Award[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAward, setEditingAward] = useState<Award | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    recipient_name: "",
    award_date: "",
    year: "",
    category: ""
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const { permissions, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }

    if (permissionsLoading) return;

    const isAdmin = auth.hasRole("admin");
    if (!isAdmin) {
      toast.error("Access denied. Management access required.");
      const userRole = auth.getRole();
      navigate(userRole === 'office_bearer' ? "/office-bearer" : "/login");
      return;
    }

    loadAwards();
  }, [permissionsLoading, permissions]);

  const loadAwards = async () => {
    try {
      setLoading(true);
      const res = await api.getAwards();
      if (res.success) {
        setAwards(res.awards || []);
      } else {
        toast.error(res.message || "Failed to load awards");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load awards");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ title: "", description: "", recipient_name: "", award_date: "", year: "", category: "" });
    setImageFile(null);
    setEditingAward(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (award: Award) => {
    setEditingAward(award);
    setForm({
      title: award.title || "",
      description: award.description || "",
      recipient_name: award.recipient_name || "",
      award_date: award.award_date || "",
      year: award.year || "",
      category: award.category || ""
    });
    setImageFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }

    // Auto-fill year from award_date if not provided, so awards always appear in year filters
    let yearToSave = form.year;
    if (!yearToSave && form.award_date) {
      yearToSave = form.award_date.slice(0, 4);
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("description", form.description || "");
      fd.append("recipient_name", form.recipient_name || "");
      fd.append("award_date", form.award_date || "");
      fd.append("year", yearToSave || "");
      fd.append("category", form.category || "");
      if (imageFile) fd.append("image", imageFile);

      if (editingAward) {
        await api.updateAward(editingAward.id, fd);
        toast.success("Award updated");
      } else {
        await api.createAward(fd);
        toast.success("Award created");
      }
      setShowForm(false);
      resetForm();
      loadAwards();
    } catch (e: any) {
      toast.error(e.message || "Failed to save award");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (award: Award) => {
    if (!confirm(`Delete award "${award.title}"?`)) return;
    try {
      await api.deleteAward(award.id);
      toast.success("Award deleted");
      loadAwards();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete award");
    }
  };

  const imgUrl = (a: Award) => {
    if (!a.image_url) return null;
    const base = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/api\/?$/, "");
    return `${base}${a.image_url.startsWith("/") ? a.image_url : `/${a.image_url}`}`;
  };

  return (
    <div className="min-h-full w-full">
      <DeveloperCredit />
      <div className="w-full p-2 md:p-4 space-y-6">
        {/* Back Button */}
        <div className="mb-4">
          <BackButton to="/admin" />
        </div>

        {/* Page Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground">Awards & Honors</h1>
            <p className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground opacity-70 border-l-4 border-primary/30 pl-3 mt-1">Recognizing excellence in the community</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2 h-11 px-6 rounded-2xl shadow-lg shadow-primary/20 font-bold w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            Add Award
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : awards.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No awards found. Click “Add Award” to create one.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {awards.map((award) => (
              <Card key={award.id} className="group relative overflow-hidden rounded-3xl border-border/40 bg-card/60 backdrop-blur-md shadow-md hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300">
                <div className="relative h-48 overflow-hidden bg-muted">
                  {imgUrl(award) ? (
                    <img
                      src={imgUrl(award)!}
                      alt={award.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/5">
                      <Trophy className="w-16 h-16 text-primary/20" />
                    </div>
                  )}
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-primary text-primary-foreground font-bold text-[9px] uppercase tracking-widest px-3 py-1 rounded-lg shadow-lg">
                      {award.category || "General"}
                    </Badge>
                  </div>
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl font-black text-foreground uppercase tracking-tight line-clamp-1">{award.title}</CardTitle>
                  {award.recipient_name && (
                    <CardDescription className="font-bold text-primary flex items-center gap-1 mt-1">
                      <Trophy className="w-3 h-3" />
                      {award.recipient_name}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed h-8">
                    {award.description || "No description provided."}
                  </p>
                  <div className="flex items-center gap-4 text-[10px] font-black uppercase text-muted-foreground tracking-widest bg-muted/30 p-2 rounded-xl">
                    <div className="flex items-center gap-1 text-primary">
                      <CalendarIcon className="w-3 h-3" />
                      {award.award_date ? new Date(award.award_date).toLocaleDateString() : award.year || "N/A"}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 rounded-xl font-bold text-[10px] uppercase tracking-widest border-2"
                      onClick={() => { setEditingAward(award); setForm({ ...award, description: award.description || "", recipient_name: award.recipient_name || "", award_date: award.award_date || "", year: award.year || "", category: award.category || "" }); setShowForm(true); }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-9 w-9 rounded-xl p-0 flex items-center justify-center"
                      onClick={() => handleDelete(award)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div >
        )}
      </div >

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingAward ? "Edit Award" : "Add Award"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Recipient / NGO Name</Label>
              <Input
                value={form.recipient_name}
                onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Award Date</Label>
              <Input type="date" value={form.award_date} onChange={(e) => setForm({ ...form, award_date: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Image</Label>
              <Input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
              <Button variant="outline" className="rounded-xl h-11 font-bold order-2 sm:order-1" onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="rounded-xl h-11 font-bold gap-2 order-1 sm:order-2">
                <Upload className="w-4 h-4" />
                {saving ? "Saving..." : editingAward ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
};

export default ManageAwards;
