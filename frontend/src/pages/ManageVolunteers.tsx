import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { auth } from "@/lib/auth";
import { usePermissions } from '@/hooks/usePermissions';
import { api } from "@/lib/api";
import { BackButton } from "@/components/BackButton";
import DeveloperCredit from "@/components/DeveloperCredit";
import { ArrowLeft, Trash2, FileText, Search, Printer, FileDown, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const filterStatuses = ["all", "pending"];

const ManageVolunteers = () => {
  const navigate = useNavigate();
  const [subs, setSubs] = useState<any[]>([]);
  const [filterIdx, setFilterIdx] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ name: "", email: "", year: "", department: "", category: "", registration_date: "" });
  const [showTable, setShowTable] = useState<boolean>(true);
  const [showApproved, setShowApproved] = useState<boolean>(false);
  const [approved, setApproved] = useState<any[]>([]);
  const [devBypass, setDevBypass] = useState<boolean>(false);
  const [detailItem, setDetailItem] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { permissions, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    // require admin or permission unless running in dev and user chose bypass
    const isDev = (import.meta && (import.meta as any).env && (import.meta as any).env.DEV) || false;

    if (!auth.isAuthenticated()) {
      navigate('/login');
      return;
    }

    // Wait for permissions to load before checking role/permission
    if (permissionsLoading) return;

    const userIsAdmin = auth.hasRole('admin');
    const userRole = auth.getRole();
    if (!userIsAdmin) {
      toast.error("You don't have permission to access volunteer submissions");
      navigate(userRole === 'office_bearer' ? '/office-bearer' : '/login');
      return;
    }

    load();
    loadApproved();
    // Set filter to show pending submissions by default when coming from notification
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('filter') === 'pending') {
      setFilterIdx(1); // pending is index 1 in filterStatuses
    } else {
      // initial sync from header/localStorage
      try {
        const raw = localStorage.getItem('volunteers_filter_idx');
        if (raw) setFilterIdx(parseInt(raw));
      } catch (e) { }
    }

    const handler = (e: any) => {
      if (!e || typeof e.detail === 'undefined') return;
      setFilterIdx(Number(e.detail));
    };
    window.addEventListener('volunteersFilterChange', handler as EventListener);
    return () => window.removeEventListener('volunteersFilterChange', handler as EventListener);
  }, [devBypass, permissionsLoading]);

  const load = () => {
    try {
      const json = localStorage.getItem("volunteer_submissions");
      const arr = json ? JSON.parse(json) : [];
      setSubs(arr);
    } catch (e) {
      console.error(e);
      setSubs([]);
    }
  };

  const persist = (next: any[]) => {
    setSubs(next);
    localStorage.setItem("volunteer_submissions", JSON.stringify(next));
  };

  const addToVolunteers = (item: any) => {
    try {
      const store = localStorage.getItem('volunteers');
      const arr = store ? JSON.parse(store) : [];
      // avoid duplicates by email
      const exists = arr.find((v: any) => v.email === item.email);
      if (exists) return;
      arr.unshift({
        id: Date.now(),
        name: item.name,
        email: item.email,
        register_no: item.register_no,
        year: item.year,
        department: item.department,
        phone: item.phone,
        parent_phone: item.parent_phone,
        address: item.address,
        dob: item.dob,
        blood_group: item.blood_group,
        skills: item.skills,
        experience: item.experience,
        category: item.category,
        status: 'active',
        undertaking_date: new Date().toISOString(),
        relieved_at: null,
        relieved_reason: "",
        created_at: new Date().toISOString()
      });
      localStorage.setItem('volunteers', JSON.stringify(arr));
      toast.success('Added to volunteers');
      // refresh approved list if visible
      if (showApproved) loadApproved();
    } catch (e) {
      console.error(e);
    }
  };

  const loadApproved = () => {
    try {
      const raw = localStorage.getItem('volunteers');
      const arr = raw ? JSON.parse(raw) : [];
      setApproved(arr);
    } catch (e) {
      console.error(e);
      setApproved([]);
    }
  };

  const removeApproved = (id: number) => {
    try {
      const raw = localStorage.getItem('volunteers');
      const arr = raw ? JSON.parse(raw) : [];
      const updated = arr.filter((v: any) => v.id !== id);
      localStorage.setItem('volunteers', JSON.stringify(updated));
      setApproved(updated);
      toast.success('Removed');
    } catch (e) {
      console.error(e);
    }
  };

  const updateStatus = async (id: number, idx: number) => {
    // Only approve (idx 2) and reject (idx 3) actions are supported
    // idx 2 = approve, idx 3 = reject (for backward compatibility with existing buttons)
    const statusMap: { [key: number]: string } = {
      2: "approved",
      3: "rejected"
    };
    const newStatus = statusMap[idx] || "pending";
    // if approved: add to volunteers store, add to users, and remove from submissions
    if (newStatus === 'approved') {
      const item = subs.find(s => s.id === id);
      if (item) {
        addToVolunteers(item);

        // Auto-add to manage users
        try {
          const userData: any = {
            name: item.name,
            email: item.email,
            role: 'volunteer'
          };

          const response = await api.addUser(userData);
          if (response.success) {
            toast.success(`Volunteer approved and added to users!`);
            if (response.defaultPassword) {
              toast.info(`Default password: ${response.defaultPassword}`);
            }
          } else {
            // If user already exists, that's okay
            if (response.message && response.message.includes('already exists')) {
              toast.info("Volunteer approved (user already exists in system)");
            } else {
              toast.warning("Volunteer approved but failed to add to users: " + (response.message || 'Unknown error'));
            }
          }
        } catch (error: any) {
          // If user already exists, that's okay
          if (error.message && error.message.includes('already exists')) {
            toast.info("Volunteer approved (user already exists in system)");
          } else {
            console.error('Failed to add user:', error);
            toast.warning("Volunteer approved but failed to add to users: " + (error.message || 'Unknown error'));
          }
        }

        // Trigger notification update
        window.dispatchEvent(new Event('volunteerSubmission'));
      }
      const remaining = subs.filter((s) => s.id !== id);
      persist(remaining);
      toast.success("Approved and moved to volunteers");
      return;
    }

    const updated = subs.map((s) => (s.id === id ? { ...s, status: newStatus } : s));
    persist(updated);
    toast.success("Status updated");

    // Trigger notification update
    window.dispatchEvent(new Event('volunteerSubmission'));
  };

  const remove = (id: number) => {
    const updated = subs.filter((s) => s.id !== id);
    persist(updated);
    toast.success("Removed");
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", email: "", year: "", department: "", category: "", registration_date: "" });
    setOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({ ...item });
    setOpen(true);
  };

  const onFile = (_file?: File | null) => {
    // signature no longer used
  };

  const handleFilterChange = (e: any) => {
    setFilterIdx(parseInt(e.target.value || '0'));
  };

  const save = () => {
    if (!form.name || !form.email) {
      toast.error("Name and email required");
      return;
    }
    if (editing) {
      const updated = subs.map((s) => (s.id === editing.id ? { ...editing, ...form } : s));
      persist(updated);
      toast.success("Updated");
    } else {
      const item = { ...form, id: Date.now(), status: "pending", created_at: new Date().toISOString() };
      const updated = [item, ...subs];
      persist(updated);
      toast.success("Added");
    }
    setOpen(false);
  };

  const downloadCSV = (filename: string, rows: any[]) => {
    if (!rows || rows.length === 0) {
      toast.error('No rows to download');
      return;
    }
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => {
      const v = r[h];
      if (v === null || typeof v === 'undefined') return '""';
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    }).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('Download started');
  };

  const handlePrintForm = (item: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const styles = `
      body { font-family: 'Inter', sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.6; }
      .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
      .title { font-size: 24px; font-weight: bold; margin: 0; }
      .subtitle { font-size: 14px; color: #666; margin: 5px 0 0; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 30px; }
      .field { margin-bottom: 15px; }
      .label { font-weight: bold; font-size: 12px; color: #888; text-transform: uppercase; }
      .value { font-size: 16px; color: #333; margin-top: 2px; }
      .undertaking { margin-top: 40px; padding: 20px; background: #f9f9f9; border-radius: 8px; font-size: 14px; }
      .signatures { margin-top: 60px; display: flex; justify-content: space-between; }
      .sig-box { text-align: center; width: 200px; border-top: 1px solid #333; padding-top: 10px; }
      @media print { .no-print { display: none; } }
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Undertaking Form - ${item.name}</title>
          <style>${styles}</style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">VOLUNTEER UNDERTAKING FORM</h1>
            <p class="subtitle">SM Volunteers - Community Empowerment Initiative</p>
          </div>
          <div class="grid">
            <div class="field"><div class="label">Full Name</div><div class="value">${item.name}</div></div>
            <div class="field"><div class="label">Register Number</div><div class="value">${item.register_no || '-'}</div></div>
            <div class="field"><div class="label">Email Address</div><div class="value">${item.email}</div></div>
            <div class="field"><div class="label">Phone Number</div><div class="value">${item.phone || '-'}</div></div>
            <div class="field"><div class="label">Course & Year</div><div class="value">${item.department} / ${item.year}</div></div>
            <div class="field"><div class="label">Category</div><div class="value">${item.category || '-'}</div></div>
            <div class="field"><div class="label">Blood Group</div><div class="value">${item.blood_group || '-'}</div></div>
            <div class="field"><div class="label">DOB</div><div class="value">${item.dob || '-'}</div></div>
            <div class="field"><div class="label">Parent Phone</div><div class="value">${item.parent_phone || '-'}</div></div>
            <div class="field"><div class="label">Registration Date</div><div class="value">${item.registration_date || item.created_at?.slice(0, 10) || '-'}</div></div>
          </div>
          <div class="field" style="margin-top: 20px;"><div class="label">Address</div><div class="value">${item.address || '-'}</div></div>
          <div class="field" style="margin-top: 20px;"><div class="label">Skills & Experience</div><div class="value">${item.skills || 'None listed'}</div></div>
          
          <div class="undertaking">
            <strong>Undertaking:</strong> I hereby declare that the information provided above is true to the best of my knowledge. I commit to volunteering my time and efforts towards the organization's goals and will adhere to the rules and regulations of SM Volunteers.
          </div>
          
          <div class="signatures">
            <div class="sig-box">Volunteer's Signature</div>
            <div class="sig-box">Office Bearer's Signature</div>
          </div>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadSubmissions = () => {
    const rows = subs.filter(s => filterIdx === 0 ? true : (s.status || 'pending') === filterStatuses[filterIdx]);
    // normalize rows to simple columns including all important fields
    const simple = rows.map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      register_no: r.register_no,
      year: r.year,
      department: r.department,
      phone: r.phone,
      parent_phone: r.parent_phone,
      address: r.address,
      dob: r.dob,
      blood_group: r.blood_group,
      skills: r.skills,
      experience: r.experience,
      category: r.category,
      status: r.status || 'pending',
      created_at: r.created_at
    }));
    downloadCSV(`submissions_${new Date().toISOString().slice(0, 10)}.csv`, simple);
  };

  const handleDownloadApproved = () => {
    try {
      const raw = localStorage.getItem('volunteers');
      const arr = raw ? JSON.parse(raw) : [];
      const simple = arr.map((r: any) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        register_no: r.register_no,
        year: r.year,
        department: r.department,
        phone: r.phone,
        parent_phone: r.parent_phone,
        address: r.address,
        dob: r.dob,
        blood_group: r.blood_group,
        skills: r.skills,
        experience: r.experience,
        category: r.category,
        created_at: r.created_at
      }));
      downloadCSV(`approved_volunteers_${new Date().toISOString().slice(0, 10)}.csv`, simple);
    } catch (e) {
      console.error(e);
      toast.error('Unable to read approved volunteers');
    }
  };

  const filteredSubs = subs
    .filter(s => filterIdx === 0 ? true : (s.status || 'pending') === filterStatuses[filterIdx])
    .filter(s => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.register_no?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q)
      );
    });

  const filteredApproved = approved.filter(v => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.name?.toLowerCase().includes(q) ||
      v.email?.toLowerCase().includes(q) ||
      v.register_no?.toLowerCase().includes(q) ||
      v.phone?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen flex flex-col">
      <DeveloperCredit />
      <main className="flex-1 w-full bg-background overflow-x-hidden">
        <div className="w-full px-4 md:px-6 lg:px-8 py-8">
          {/* dev bypass banner ... preserved ... */}
          {(typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname.includes('localhost')) && !(auth.isAuthenticated() && (auth.hasRole('admin') || permissions?.can_manage_volunteers)) && !devBypass && (
            <div className="mb-6">
              <div className="p-4 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-500">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold">Dev mode: Access restricted</div>
                    <div className="text-sm opacity-90">You don't have permission to manage volunteers. For local testing you can bypass this check.</div>
                  </div>
                  <Button onClick={() => setDevBypass(true)} variant="outline" className="border-yellow-500/50 hover:bg-yellow-500/20 w-full md:w-auto">Continue with Dev Bypass</Button>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6">
            <BackButton to="/admin" />
          </div>

          {/* Page Header */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground">Volunteer Submissions</h1>
              <p className="text-xs sm:text-xs md:text-sm font-medium text-muted-foreground opacity-70 border-l-4 border-primary/30 pl-3 mt-1">Manage core community registrations</p>
            </div>
            <div className="flex flex-col items-stretch sm:items-end gap-3 w-full sm:w-auto">
              <div className="inline-flex rounded-2xl bg-muted/30 p-1 border-2 border-border/40 backdrop-blur-sm self-center sm:self-auto">
                <Button
                  type="button"
                  size="sm"
                  variant={!showApproved ? "secondary" : "ghost"}
                  className={`rounded-xl px-4 font-bold text-xs uppercase tracking-widest transition-all ${!showApproved ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground"}`}
                  onClick={() => setShowApproved(false)}
                >
                  Pending ({subs.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={showApproved ? "secondary" : "ghost"}
                  className={`rounded-xl px-4 font-bold text-xs uppercase tracking-widest transition-all ${showApproved ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground"}`}
                  onClick={() => {
                    setShowApproved(true);
                    loadApproved();
                  }}
                >
                  Approved ({approved.length})
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={showApproved ? handleDownloadApproved : handleDownloadSubmissions}
                className="gap-2 h-11 rounded-xl border-2 font-bold w-full"
              >
                <FileDown className="w-4 h-4 text-primary" />
                Export Data
              </Button>
            </div>
          </div>

          {/* Search & Tabs */}
          <div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
            {!showApproved && (
              <div className="flex flex-wrap gap-2 self-start md:self-auto">
                {filterStatuses.map((status, idx) => (
                  <Button
                    key={idx}
                    variant={filterIdx === idx ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setFilterIdx(idx);
                      try { localStorage.setItem('volunteers_filter_idx', idx.toString()); } catch (e) { }
                    }}
                    className={`capitalize rounded-xl px-6 font-bold text-xs ${filterIdx === idx ? 'shadow-lg shadow-primary/20' : 'border-2'}`}
                  >
                    {status}
                  </Button>
                ))}
              </div>
            )}
            {showApproved && <div />}
            <div className="w-full md:w-80 relative group">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors w-5 h-5" />
              <Input
                placeholder="Search by name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 bg-card/60 backdrop-blur-md border-border/50 focus:ring-primary/20 rounded-2xl text-sm font-medium"
              />
            </div>
          </div>

          {showApproved ? (
            <div className="space-y-4">
              {/* Mobile View */}
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {filteredApproved.length === 0 ? (
                  <div className="py-20 text-center font-bold text-muted-foreground italic bg-card/40 rounded-3xl border-2 border-dashed border-border/30">No approved volunteers found</div>
                ) : (
                  filteredApproved.map((v) => (
                    <Card key={v.id} className="rounded-3xl border-border/40 overflow-hidden bg-card/60 backdrop-blur-sm shadow-md active:scale-[0.98] transition-all">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg">
                            {v.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-black text-foreground uppercase tracking-tight truncate">{v.name}</h3>
                            <p className="text-[10px] font-bold text-muted-foreground truncate">{v.email}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          <div className="bg-muted/30 p-2 rounded-xl">
                            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Dept</p>
                            <p className="text-[10px] font-bold text-foreground truncate">{v.department}</p>
                          </div>
                          <div className="bg-muted/30 p-2 rounded-xl">
                            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Category</p>
                            <p className="text-[10px] font-bold text-foreground truncate">{v.category || 'Volunteer'}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-9 rounded-xl font-bold text-[10px] uppercase tracking-widest border-2"
                            onClick={() => { setDetailItem(v); setDetailOpen(true); }}
                          >
                            Form
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-9 w-9 rounded-xl"
                            onClick={() => removeApproved(v.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Desktop Table View */}
              <Card className="hidden md:block bg-card/50 backdrop-blur-sm overflow-hidden border-border/50 rounded-3xl">
                <ScrollArea className="w-full">
                  <div className="min-w-[1000px]">
                    {filteredApproved.length === 0 ? (
                      <div className="py-20 text-center">
                        <p className="text-muted-foreground">No approved volunteers found</p>
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="text-left border-b border-border/50 bg-muted/30">
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground">Volunteer Details</th>
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground">Department & Year</th>
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground">Category</th>
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground">Approved On</th>
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {filteredApproved.map((v) => (
                            <tr key={v.id} className="hover:bg-muted/20 transition-colors group">
                              <td className="px-6 py-4">
                                <div className="font-black text-foreground uppercase tracking-tight">{v.name}</div>
                                <div className="text-[10px] font-medium text-muted-foreground">{v.email}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-sm font-bold">{v.department}</div>
                                <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{v.year} Year</div>
                              </td>
                              <td className="px-6 py-4">
                                <Badge className="bg-primary/5 text-primary border-none font-bold text-[10px] uppercase tracking-widest">{v.category || 'Volunteer'}</Badge>
                              </td>
                              <td className="px-6 py-4 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                {v.created_at ? new Date(v.created_at).toLocaleDateString() : "-"}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setDetailItem(v);
                                      setDetailOpen(true);
                                    }}
                                    className="h-8 text-primary hover:text-primary hover:bg-primary/10 font-bold text-[10px] uppercase tracking-widest rounded-lg"
                                  >
                                    View Form
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeApproved(v.id)}
                                    className="h-8 text-destructive hover:bg-destructive/10 rounded-lg"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </ScrollArea>
              </Card>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mobile Card View */}
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {filteredSubs.length === 0 ? (
                  <div className="py-20 text-center font-bold text-muted-foreground italic bg-card/40 rounded-3xl border-2 border-dashed border-border/30">
                    {filterIdx === 0 ? "No submissions found." : `No ${filterStatuses[filterIdx]} submissions found.`}
                  </div>
                ) : (
                  filteredSubs.map((s) => (
                    <Card key={s.id} className="rounded-3xl border-border/40 overflow-hidden bg-card/60 backdrop-blur-sm shadow-md active:scale-[0.98] transition-all">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-base">
                              {s.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-black text-foreground uppercase tracking-tight truncate max-w-[150px]">{s.name}</h3>
                              <p className="text-[9px] font-bold text-muted-foreground truncate">{s.email}</p>
                            </div>
                          </div>
                          <Badge className={`capitalize font-bold text-[9px] px-2 py-0.5 ${s.status === 'approved' ? 'bg-green-500/10 text-green-500' : s.status === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                            {s.status || 'pending'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          <div className="bg-muted/30 p-2 rounded-xl">
                            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Submitted</p>
                            <p className="text-[10px] font-bold text-foreground truncate">{new Date(s.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="bg-muted/30 p-2 rounded-xl">
                            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Category</p>
                            <p className="text-[10px] font-bold text-foreground truncate">{s.category || 'Volunteer'}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-9 rounded-xl font-bold text-[10px] uppercase tracking-widest border-2"
                            onClick={() => { setDetailItem(s); setDetailOpen(true); }}
                          >
                            Details
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 h-9 rounded-xl font-bold text-[10px] uppercase tracking-widest bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/20"
                            onClick={() => updateStatus(s.id, 2)}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-9 w-9 rounded-xl"
                            onClick={() => updateStatus(s.id, 3)}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Desktop View */}
              <Card className="hidden md:block bg-card/50 backdrop-blur-sm overflow-hidden border-border/50 rounded-3xl">
                <ScrollArea className="w-full">
                  <div className="min-w-[1000px]">
                    {filteredSubs.length === 0 ? (
                      <div className="py-20 text-center">
                        <p className="text-muted-foreground">
                          {filterIdx === 0 ? "No submissions found." : `No ${filterStatuses[filterIdx]} submissions found.`}
                        </p>
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="text-left border-b border-border/50 bg-muted/30">
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground">Applicant</th>
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground">Department & Year</th>
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground">Category</th>
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground">Submitted</th>
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground text-center">Status</th>
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {filteredSubs.map((s) => (
                            <tr key={s.id} className="hover:bg-muted/20 transition-colors group">
                              <td className="px-6 py-4">
                                <div className="font-black text-foreground uppercase tracking-tight">{s.name}</div>
                                <div className="text-[10px] font-medium text-muted-foreground">{s.email}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-sm font-bold">{s.department}</div>
                                <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{s.year} Year</div>
                              </td>
                              <td className="px-6 py-4">
                                <Badge className="bg-primary/5 text-primary border-none font-bold text-[10px] uppercase tracking-widest">{s.category || 'Volunteer'}</Badge>
                              </td>
                              <td className="px-6 py-4 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                {new Date(s.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <Badge
                                  className={`capitalize font-bold text-[9px] border-none px-2 py-0.5 ${s.status === 'approved' ? 'bg-green-500/10 text-green-500' :
                                    s.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                                      'bg-blue-500/10 text-blue-500'
                                    }`}
                                >
                                  {s.status || 'pending'}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setDetailItem(s);
                                      setDetailOpen(true);
                                    }}
                                    className="h-8 text-primary hover:text-primary hover:bg-primary/10 font-bold text-[10px] uppercase tracking-widest rounded-lg"
                                  >
                                    Details
                                  </Button>
                                  <Button onClick={() => updateStatus(s.id, 2)} className="bg-green-500 hover:bg-green-600 text-foreground h-8 text-[9px] font-bold uppercase tracking-widest px-3 rounded-lg" size="sm">
                                    Approve
                                  </Button>
                                  <Button onClick={() => updateStatus(s.id, 3)} variant="ghost" className="text-destructive hover:bg-destructive/10 h-8 font-bold text-[9px] uppercase tracking-widest rounded-lg" size="sm">
                                    Reject
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                    }
                  </div>
                </ScrollArea>
              </Card>
            </div>
          )}

          {/* Details dialog redesigned as "Undertaking Form Summary" */}
          <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
            <DialogContent className="max-w-2xl bg-card border-border/50 max-h-[90vh] overflow-y-auto">
              <DialogHeader className="border-b pb-4 mb-4">
                <div className="flex justify-between items-center pr-8">
                  <DialogTitle className="text-2xl font-bold">Undertaking Form Report</DialogTitle>
                  <Button
                    onClick={() => handlePrintForm(detailItem)}
                    className="gap-2 bg-primary hover:bg-primary/90"
                  >
                    <FileText className="w-4 h-4" />
                    Print Form
                  </Button>
                </div>
              </DialogHeader>

              {detailItem && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Full Name</Label>
                      <p className="font-semibold text-base">{detailItem.name}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Email Address</Label>
                      <p className="font-semibold text-base">{detailItem.email}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Register Number</Label>
                      <p className="font-semibold text-base">{detailItem.register_no || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Phone Number</Label>
                      <p className="font-semibold text-base">{detailItem.phone || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Department / Year</Label>
                      <p className="font-semibold text-base">{detailItem.department} / {detailItem.year} Year</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Category</Label>
                      <p className="font-semibold text-base italic">{detailItem.category || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Date of Birth</Label>
                      <p className="font-semibold text-base">{detailItem.dob || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Blood Group</Label>
                      <p className="font-semibold text-base">{detailItem.blood_group || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Parent's Phone</Label>
                      <p className="font-semibold text-base">{detailItem.parent_phone || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Registration Date</Label>
                      <p className="font-semibold text-base">{detailItem.registration_date || new Date(detailItem.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-border/30">
                    <Label className="text-[10px] uppercase text-muted-foreground">Residential Address</Label>
                    <p className="text-sm bg-muted/20 p-3 rounded-lg border border-border/30 leading-relaxed italic">
                      {detailItem.address || 'No address provided'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground">Skills & Volunteering Experience</Label>
                    <div className="text-sm bg-muted/20 p-3 rounded-lg border border-border/30 min-h-[80px]">
                      {detailItem.skills || detailItem.experience ? (
                        <div className="space-y-2">
                          {detailItem.skills && <div><strong>Skills:</strong> {detailItem.skills}</div>}
                          {detailItem.experience && <div><strong>Experience:</strong> {detailItem.experience}</div>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">None listed</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-border/50">
                    <div className="flex justify-between items-center text-xs text-muted-foreground italic">
                      <div>Report ID: {detailItem.id}</div>
                      <div>Status: {detailItem.status || 'Pending'}</div>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Add/Edit Dialog remains for compatibility but styled */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-xl bg-card border-border/50">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Volunteer Record" : "Add New Volunteer"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="col-span-2 space-y-2">
                  <Label>Full Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-muted/20" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Email Address</Label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-muted/20" />
                </div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className="bg-muted/20" />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="bg-muted/20" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="bg-muted/20" />
                </div>
                <div className="space-y-2">
                  <Label>Registration Date</Label>
                  <Input type="date" value={form.registration_date} onChange={(e) => setForm({ ...form, registration_date: e.target.value })} className="bg-muted/20" />
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-border/50">
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} className="bg-primary hover:bg-primary/90">Save Record</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
};

export default ManageVolunteers;
