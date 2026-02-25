import { useEffect, useRef, useState } from "react";
import DeveloperCredit from "@/components/DeveloperCredit";

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
    category: "",
    award_type: "individual"
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
    setForm({ title: "", description: "", recipient_name: "", award_date: "", year: "", category: "", award_type: "individual" });
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
      category: award.category || "",
      award_type: "individual" // Default to individual as we don't persist type separately
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

        </div>

        {/* Page Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <h1 className="page-title">Awards & Honors</h1>
            <p className="page-subtitle border-l-4 border-primary/30 pl-3 mt-2">Recognizing excellence in the community</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2 h-10 px-4 rounded-md font-semibold text-sm text-foreground w-full sm:w-auto">
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
              <Card key={award.id} className="group relative overflow-hidden rounded-[2.5rem] border-border/30 bg-card/40 backdrop-blur-md shadow-lg hover:shadow-2xl transition-all duration-500 flex flex-col h-full border hover:border-primary/40">
                <div className="relative h-56 overflow-hidden">
                  {imgUrl(award) ? (
                    <img
                      src={imgUrl(award)!}
                      alt={award.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/5">
                      <Trophy className="w-16 h-16 text-primary/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-300" />

                  <div className="absolute top-4 left-4">
                    <Badge className="bg-primary hover:bg-primary/90 text-primary-foreground font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg border-0">
                      {award.category || "General"}
                    </Badge>
                  </div>

                  <div className="absolute bottom-4 left-4">
                    <div className="bg-background/90 backdrop-blur-md text-foreground text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border border-border/50 flex items-center gap-2 shadow-lg">
                      <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                      {award.award_date ? new Date(award.award_date).toLocaleDateString() : award.year || "N/A"}
                    </div>
                  </div>
                </div>

                <CardContent className="flex-1 p-6 flex flex-col relative">
                  <div className="mb-4">
                    <h3 className="font-black text-xl text-foreground uppercase tracking-tight line-clamp-2 leading-tight mb-2 min-h-[3rem]" title={award.title}>
                      {award.title}
                    </h3>

                    {award.recipient_name && (
                      <div className="flex items-center gap-2 text-primary font-black text-[11px] uppercase tracking-widest bg-primary/10 w-fit px-3 py-1 rounded-full mb-3">
                        <Trophy className="w-3.5 h-3.5" />
                        {award.recipient_name}
                      </div>
                    )}

                    <p className="text-[12px] text-muted-foreground font-medium line-clamp-3 leading-relaxed">
                      {award.description || "In recognition of outstanding contribution and excellence in community service."}
                    </p>
                  </div>

                  <div className="mt-auto flex gap-2 pt-6 border-t border-border/10">
                    <Button
                      variant="outline"
                      onClick={() => openEdit(award)}
                      className="flex-1 h-11 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest hover:bg-primary/5 hover:text-primary transition-all active:scale-95"
                    >
                      <Pencil className="w-4 h-4 mr-2" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11 w-11 rounded-2xl border-2 flex items-center justify-center p-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all active:scale-90"
                      onClick={() => handleDelete(award)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
              <Label>Award Type</Label>
              <div className="flex bg-muted p-1 rounded-xl">
                <button
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${form.award_type === 'individual' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setForm({ ...form, award_type: 'individual' })}
                >
                  Individual
                </button>
                <button
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${form.award_type === 'organization' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setForm({ ...form, award_type: 'organization' })}
                >
                  Organization / NGO
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{form.award_type === 'organization' ? 'NGO / Organization Name' : 'Recipient Name'}</Label>
              <Input
                value={form.recipient_name}
                onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
                placeholder={form.award_type === 'organization' ? "e.g., Bhumi NGO" : "e.g., John Doe"}
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g., Best Service, Environmental Award"
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
              <Button variant="outline" className="rounded-md h-10 font-semibold text-sm order-2 sm:order-1 text-foreground" onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="rounded-md h-10 font-semibold text-sm gap-2 order-1 sm:order-2 text-foreground">
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
