import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import { Megaphone, Trash2, History, Sparkles, ChevronRight, Send, Clock, Calendar as CalendarIcon, Edit } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";

const Announcements = () => {
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        title: "",
        content: "",
        priority: "normal" as "normal" | "important",
        linkUrl: "",
        imageUrl: "",
        deadline: ""
    });

    useEffect(() => {
        loadAnnouncements();
    }, []);

    const loadAnnouncements = async () => {
        setLoading(true);
        try {
            const res = await api.getAnnouncements?.();
            if (res?.success) {
                setAnnouncements(res.announcements || []);
            } else {
                console.error("Failed to load announcements:", res?.message);
                toast.error(res?.message || "Failed to load announcements");
            }
        } catch (err: any) {
            console.error("Failed to load announcements:", err);
            toast.error(err.message || "Error loading announcements");
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title || !formData.content) {
            return toast.error("Please fill in both title and content");
        }

        setSending(true);
        try {
            let res;
            if (editingId) {
                res = await api.updateAnnouncement?.(editingId, {
                    ...formData,
                    target: "all"
                });
            } else {
                res = await api.createAnnouncement?.({
                    ...formData,
                    target: "all"
                });
            }

            if (res?.success) {
                toast.success(editingId ? "Announcement updated!" : "Announcement posted!");
                setFormData({ title: "", content: "", priority: "normal", linkUrl: "", imageUrl: "", deadline: "" });
                setEditingId(null);
                // Wait a moment then reload announcements
                await new Promise(resolve => setTimeout(resolve, 300));
                loadAnnouncements();
            } else {
                console.error("Response:", res);
                toast.error(res?.message || "Failed to send announcement");
            }
        } catch (err: any) {
            console.error("Error sending announcement:", err);
            toast.error(err.message || "Error sending announcement");
        } finally {
            setSending(false);
        }
    };

    const handleEdit = (announcement: any) => {
        setFormData({
            title: announcement.title,
            content: announcement.content,
            priority: announcement.priority || "normal",
            linkUrl: announcement.link_url || "",
            imageUrl: announcement.image_url || "",
            deadline: announcement.deadline || ""
        });
        setEditingId(announcement.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setFormData({ title: "", content: "", priority: "normal", linkUrl: "", imageUrl: "", deadline: "" });
        setEditingId(null);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this announcement?")) return;
        try {
            const res = await api.deleteAnnouncement?.(id);
            if (res?.success) {
                toast.success("Announcement deleted");
                loadAnnouncements();
            }
        } catch (err) {
            toast.error("Failed to delete");
        }
    };

    return (
        <div className="w-full px-3 md:px-6 py-4 space-y-6 md:space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3">

                    <div>
                        <h1 className="page-title uppercase flex flex-wrap items-center gap-x-2">
                            Announcement
                            <span className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">Control Center</span>
                        </h1>
                        <p className="page-subtitle uppercase tracking-widest mt-2">Broadcast updates in real-time</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Create Section */}
                <div className="xl:col-span-4 space-y-6">
                    <Card className="border-none bg-card/60 backdrop-blur-xl shadow-2xl rounded-[2rem] md:rounded-[2.5rem] overflow-hidden border border-white/10">
                        <CardHeader className="bg-primary/5 border-b border-primary/10 py-5 md:py-6">
                            <CardTitle className="flex items-center gap-2 text-primary uppercase tracking-tight font-black text-sm md:text-base">
                                <Megaphone className="w-4 h-4 md:w-5 md:h-5" />
                                {editingId ? "Edit Update" : "Post New Update"}
                            </CardTitle>
                            {editingId && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                    className="text-[10px] font-bold h-7 px-2"
                                >
                                    Cancel Edit
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="p-4 md:p-8">
                            <form onSubmit={handleSend} className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Notification Title</Label>
                                    <Input
                                        className="rounded-xl border-border/50 bg-background/50 h-12 focus:ring-primary/20 transition-all font-bold"
                                        placeholder="What's the update?"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Message Content</Label>
                                    <Textarea
                                        className="rounded-2xl border-border/50 bg-background/50 min-h-[140px] resize-none focus:ring-primary/20 transition-all text-sm leading-relaxed"
                                        placeholder="Type your announcement detail here..."
                                        value={formData.content}
                                        onChange={e => setFormData({ ...formData, content: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Link URL (Optional)</Label>
                                        <Input
                                            className="rounded-xl border-border/50 bg-background/50 h-11 text-xs"
                                            placeholder="https://example.com/details"
                                            value={formData.linkUrl}
                                            onChange={e => setFormData({ ...formData, linkUrl: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Featured Image URL (Optional)</Label>
                                        <Input
                                            className="rounded-xl border-border/50 bg-background/50 h-11 text-xs"
                                            placeholder="https://image-link.com/photo.jpg"
                                            value={formData.imageUrl}
                                            onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Deadline (Optional)</Label>
                                        <Input
                                            type="datetime-local"
                                            className="rounded-xl border-border/50 bg-background/50 h-11 text-xs"
                                            value={formData.deadline}
                                            onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <div className="flex items-center space-x-3 bg-muted/20 p-4 rounded-2xl border border-border/50 group transition-all hover:bg-muted/30">
                                        <Checkbox
                                            id="priority"
                                            className="w-5 h-5 rounded-md border-rose-300 data-[state=checked]:bg-rose-500 data-[state=checked]:border-rose-500"
                                            checked={formData.priority === "important"}
                                            onCheckedChange={checked => setFormData({ ...formData, priority: checked ? "important" : "normal" })}
                                        />
                                        <Label htmlFor="priority" className="flex items-center gap-2 cursor-pointer font-bold text-sm text-rose-600 dark:text-rose-400 font-black">
                                            <Sparkles className="w-4 h-4" />
                                            IMPORTANT (Highlight Layout)
                                        </Label>
                                    </div>
                                </div>

                                <Button
                                    disabled={sending}
                                    className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] bg-primary hover:bg-primary/90 text-foreground"
                                >
                                    {sending ? (
                                        <span className="flex items-center gap-2 animate-pulse">
                                            {editingId ? "Updating..." : "Broadcasting..."}
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            {editingId ? "Update" : "Publish & Notify"} <Send className="w-4 h-4 ml-1" />
                                        </span>
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Preview (Small) */}
                    <Card className="border-none bg-gradient-to-br from-primary/5 to-blue-500/5 shadow-xl rounded-[2.5rem] p-1">
                        <div className="bg-background/40 backdrop-blur-md rounded-[2.4rem] p-6 space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/50 text-center">Live Preview</p>
                            <div className="bg-background border border-border/50 rounded-3xl p-5 shadow-sm overflow-hidden relative group">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="space-y-1 pr-4">
                                        <h4 className="text-lg font-black text-foreground group-hover:text-primary transition-colors">{formData.title || "Subject Line"}</h4>
                                        <p className="text-muted-foreground text-xs line-clamp-2">{formData.content || "Messenger preview content..."}</p>
                                    </div>
                                    {formData.priority === 'important' && (
                                        <Badge className="bg-rose-500 font-black text-[8px] px-2 py-0 animate-pulse">ALERT</Badge>
                                    )}
                                </div>
                                {formData.imageUrl && (
                                    <div className="mt-3 h-28 w-full rounded-2xl bg-muted overflow-hidden border border-border/50">
                                        <img src={formData.imageUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Preview" onError={(e) => e.currentTarget.style.display = 'none'} />
                                    </div>
                                )}
                                <div className="mt-3 flex justify-between items-center text-[9px] font-black text-muted-foreground uppercase opacity-60">
                                    <span className="flex items-center gap-1"><CalendarIcon className="w-2.5 h-2.5" /> Just Now</span>
                                    {formData.linkUrl && <span className="text-primary flex items-center gap-1">View Link <ChevronRight className="w-2.5 h-2.5" /></span>}
                                </div>
                                {formData.deadline && (
                                    <div className="mt-2 pt-2 border-t border-border/30">
                                        <span className="text-[9px] font-black text-rose-600 uppercase flex items-center gap-1">
                                            ⏰ Deadline: {new Date(formData.deadline).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* History Section */}
                <div className="xl:col-span-8">
                    <Card className="border-none bg-card/40 backdrop-blur-md shadow-xl rounded-[2rem] md:rounded-[2.5rem] overflow-hidden h-full border border-white/5">
                        <CardHeader className="border-b border-border/50 py-5 md:py-6 px-5 md:px-10 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-foreground uppercase tracking-tight font-black text-lg md:text-xl">
                                    <History className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                                    Broadcast Feed
                                </CardTitle>
                                <CardDescription className="font-medium text-[10px] md:text-sm">Managing the flow of active announcements.</CardDescription>
                            </div>
                            <div className="flex gap-2 items-center">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={loadAnnouncements}
                                    className="rounded-xl font-bold bg-background/50 h-8 md:h-10 text-[10px] md:text-xs"
                                >
                                    Refresh
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="rounded-xl font-bold h-8 md:h-10 text-[10px] md:text-xs"
                                    onClick={async () => {
                                        if (!confirm("Are you sure you want to clear all announcements?")) return;
                                        try {
                                            const res = await api.clearAllAnnouncements?.();
                                            if (res?.success) {
                                                toast.success("All announcements cleared");
                                                await loadAnnouncements();
                                            } else {
                                                toast.error(res?.message || "Failed to clear announcements");
                                            }
                                        } catch (e: any) {
                                            toast.error(e?.message || "Failed to clear announcements");
                                        }
                                    }}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Clear All
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="p-24 text-center">
                                    <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto mb-4"></div>
                                    <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Syncing Hub...</p>
                                </div>
                            ) : announcements.length === 0 ? (
                                <div className="p-24 text-center space-y-4">
                                    <div className="w-20 h-20 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-2">
                                        <Megaphone className="w-10 h-10 text-muted-foreground/20" />
                                    </div>
                                    <p className="text-muted-foreground font-bold">No active broadcasts found.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-muted/30">
                                            <TableRow className="border-none">
                                                <TableHead className="font-black uppercase text-[10px] tracking-widest pl-10 h-14">Announcement Detail</TableHead>
                                                <TableHead className="font-black uppercase text-[10px] tracking-widest h-14">Post Type</TableHead>
                                                <TableHead className="font-black uppercase text-[10px] tracking-widest h-14">Timeline</TableHead>
                                                <TableHead className="text-right pr-10 h-14">Ops</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {announcements.map((a, i) => (
                                                <TableRow key={a.id} className="group transition-all hover:bg-muted/10 border-border/30">
                                                    <TableCell className="py-6 pl-10 max-w-md">
                                                        <div className="flex gap-4">
                                                            {a.image_url && (
                                                                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-border/50 bg-muted">
                                                                    <img src={a.image_url} className="w-full h-full object-cover" alt="" />
                                                                </div>
                                                            )}
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-black text-foreground group-hover:text-primary transition-colors">{a.title}</p>
                                                                    {new Date().getTime() - new Date(a.created_at).getTime() < 24 * 60 * 60 * 1000 && (
                                                                        <Badge className="bg-emerald-500 text-foreground font-black text-[8px] px-2 py-0 animate-pulse">NEW</Badge>
                                                                    )}
                                                                </div>
                                                                <p className="text-sm text-muted-foreground line-clamp-1">{a.content}</p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-2">
                                                            {a.priority === "important" ? (
                                                                <Badge className="bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-none font-black text-[9px] px-3">HIGHLIGHT</Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="font-black text-[9px] border-border/50 text-muted-foreground">REGULAR</Badge>
                                                            )}
                                                            {a.link_url && (
                                                                <Badge className="bg-blue-500/10 text-blue-600 border-none font-black text-[9px] px-3">LINKED</Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-black uppercase tracking-tighter text-muted-foreground">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="flex items-center gap-1 text-foreground/80"><CalendarIcon className="w-3 h-3" /> {format(new Date(a.created_at), "MMM d, yyyy")}</span>
                                                            <span className="flex items-center gap-1 opacity-70"><Clock className="w-3 h-3" /> {format(new Date(a.created_at), "hh:mm aa")}</span>
                                                            {a.deadline && (
                                                                <span className="flex items-center gap-1 text-rose-600 font-bold mt-1">
                                                                    ⏰ Deadline: {format(new Date(a.deadline), "MMM d, hh:mm aa")}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-10">
                                                        <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="rounded-xl text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all"
                                                                onClick={() => handleEdit(a)}
                                                                title="Edit"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                                                                onClick={() => handleDelete(a.id)}
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
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
            </div>
        </div>
    );
};

export default Announcements;
