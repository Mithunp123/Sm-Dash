import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { auth } from "@/lib/auth";
import { usePermissions } from '@/hooks/usePermissions';
import { api } from "@/lib/api";
import { ArrowLeft } from "lucide-react";

const itemStatusMap = ["pending", "reviewed", "approved", "rejected"];
const filterStatuses = ["all", ...itemStatusMap];

const ManageVolunteers = () => {
  const navigate = useNavigate();
  const [subs, setSubs] = useState<any[]>([]);
  const [filterIdx, setFilterIdx] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ name: "", email: "", year: "", department: "", category: "", registration_date: "", signature: "" });
  const [showTable, setShowTable] = useState<boolean>(true);
  const [showApproved, setShowApproved] = useState<boolean>(false);
  const [approved, setApproved] = useState<any[]>([]);
  const [devBypass, setDevBypass] = useState<boolean>(false);
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
    const allowed = userIsAdmin || permissions?.can_manage_volunteers;
    if (!allowed) {
      if (!isDev || !devBypass) {
        navigate('/admin');
        return;
      }
    }

    load();
    // Set filter to show pending submissions by default when coming from notification
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('filter') === 'pending') {
      setFilterIdx(1); // pending is index 1 in filterStatuses
    } else {
      // initial sync from header/localStorage
      try {
        const raw = localStorage.getItem('volunteers_filter_idx');
        if (raw) setFilterIdx(parseInt(raw));
      } catch (e) {}
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
      arr.unshift({ id: Date.now(), name: item.name, email: item.email, year: item.year, department: item.department, category: item.category, signature: item.signature, created_at: new Date().toISOString() });
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
    const newStatus = itemStatusMap[idx] || "pending";
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
    setForm({ name: "", email: "", year: "", department: "", category: "", registration_date: "", signature: "" });
    setOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({ ...item });
    setOpen(true);
  };

  const onFile = (file?: File | null) => {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Only PNG/JPEG allowed");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Max size 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f: any) => ({ ...f, signature: reader.result }));
    reader.readAsDataURL(file);
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

  const handleDownloadSubmissions = () => {
    const rows = subs.filter(s => filterIdx === 0 ? true : (s.status || 'pending') === filterStatuses[filterIdx]);
    // normalize rows to simple columns
    const simple = rows.map(r => ({ id: r.id, name: r.name, email: r.email, year: r.year, department: r.department, category: r.category, status: r.status || 'pending', created_at: r.created_at }));
    downloadCSV(`submissions_${new Date().toISOString().slice(0,10)}.csv`, simple);
  };

  const handleDownloadApproved = () => {
    try {
      const raw = localStorage.getItem('volunteers');
      const arr = raw ? JSON.parse(raw) : [];
      const simple = arr.map((r: any) => ({ id: r.id, name: r.name, email: r.email, year: r.year, department: r.department, category: r.category, created_at: r.created_at }));
      downloadCSV(`approved_volunteers_${new Date().toISOString().slice(0,10)}.csv`, simple);
    } catch (e) {
      console.error(e);
      toast.error('Unable to read approved volunteers');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1">
        <main className="flex-1 p-6 bg-gradient-to-b from-background via-background to-orange-50/20">
          {/* dev bypass banner */}
        {(typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname.includes('localhost')) && !(auth.isAuthenticated() && auth.hasRole('admin')) && !devBypass && (
          <div className="max-w-6xl mx-auto mb-4">
            <div className="p-4 rounded bg-yellow-50 border border-yellow-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Dev mode: admin access required</div>
                  <div className="text-sm text-muted-foreground">You are not logged in as admin. For local testing you can continue as an admin (dev only).</div>
                </div>
                <div>
                  <Button onClick={() => setDevBypass(true)}>Continue as admin (dev)</Button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="max-w-6xl mx-auto">
          {/* Hero Header Section */}
          <div className="mb-8 bg-gradient-to-r from-orange-600 via-orange-500 to-red-500 rounded-xl p-8 text-white shadow-lg">
            <div className="flex justify-between items-start mb-4">
              <Button variant="ghost" onClick={() => navigate('/admin')} className="gap-2 hover:bg-white/20 text-white">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">Manage Volunteers</h1>
              <p className="text-lg opacity-90">Review and manage volunteer submissions</p>
            </div>
          </div>

          {/* Filter Buttons */}
          {!showApproved && (
            <div className="flex flex-wrap gap-2 mb-4">
              {filterStatuses.map((status, idx) => (
                <Button
                  key={idx}
                  variant={filterIdx === idx ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setFilterIdx(idx);
                    try { localStorage.setItem('volunteers_filter_idx', idx.toString()); } catch(e){}
                  }}
                  className="capitalize"
                >
                  {status}
                </Button>
              ))}
            </div>
          )}

          {/* action buttons removed: Show All / Clear All removed per UI request */}

          {subs.length === 0 && filterIdx === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>No submissions yet</CardTitle>
              </CardHeader>
              <CardContent>Waiting for students to register.</CardContent>
            </Card>
          )}
          
          {subs.length > 0 && subs.filter(s => filterIdx === 0 ? true : (s.status || 'pending') === filterStatuses[filterIdx]).length === 0 && filterIdx !== 0 && (
            <Card>
              <CardHeader>
                <CardTitle>No {filterStatuses[filterIdx]} submissions</CardTitle>
              </CardHeader>
              <CardContent>No submissions found with status: {filterStatuses[filterIdx]}</CardContent>
            </Card>
          )}

          {showApproved ? (
            <div className="overflow-x-auto">
              {approved.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>No approved volunteers</CardTitle>
                  </CardHeader>
                  <CardContent>No volunteers have been approved yet.</CardContent>
                </Card>
              ) : (
                <table className="min-w-full table-auto border-collapse">
                <thead>
                  <tr className="text-left border-b">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Year / Dept</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Approved On</th>
                    <th className="px-3 py-2">Signature</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {approved.map((v) => (
                    <tr key={v.id} className="border-b align-top">
                      <td className="px-3 py-3">{v.name}</td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">{v.email}</td>
                      <td className="px-3 py-3">{v.year} / {v.department}</td>
                      <td className="px-3 py-3">{v.category}</td>
                      <td className="px-3 py-3 text-sm">{v.created_at ? new Date(v.created_at).toLocaleString() : '-'}</td>
                      <td className="px-3 py-3">{v.signature ? <img src={v.signature} alt="sig" className="h-12 w-24 object-contain border rounded" /> : '-'}</td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <Button variant="ghost" onClick={() => removeApproved(v.id)}>Remove</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              {subs.filter(s => filterIdx === 0 ? true : (s.status || 'pending') === filterStatuses[filterIdx]).length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>No submissions found</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {filterIdx === 0 
                      ? "No volunteer submissions yet. Waiting for students to register."
                      : `No ${filterStatuses[filterIdx]} submissions found.`
                    }
                  </CardContent>
                </Card>
              ) : (
                <table className="min-w-full table-auto border-collapse">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Year / Dept</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Submitted</th>
                      <th className="px-3 py-2">Signature</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subs.filter(s => filterIdx === 0 ? true : (s.status || 'pending') === filterStatuses[filterIdx]).map((s) => (
                    <tr key={s.id} className="border-b align-top">
                      <td className="px-3 py-3">{s.name}</td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">{s.email}</td>
                      <td className="px-3 py-3">{s.year} / {s.department}</td>
                      <td className="px-3 py-3">{s.category}</td>
                      <td className="px-3 py-3 text-sm">{new Date(s.created_at).toLocaleString()}</td>
                      <td className="px-3 py-3">{s.signature ? <img src={s.signature} alt="sig" className="h-12 w-24 object-contain border rounded" /> : '-'}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-1 rounded text-white text-xs font-semibold ${
                          s.status === 'approved' ? 'bg-green-500' :
                          s.status === 'rejected' ? 'bg-red-500' :
                          s.status === 'reviewed' ? 'bg-blue-500' :
                          'bg-gray-500'
                        }`}>
                          {s.status || 'pending'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <Button onClick={() => updateStatus(s.id, 2)} className="bg-green-500 hover:bg-green-600 text-white">Approve</Button>
                          <Button onClick={() => updateStatus(s.id, 3)} className="bg-red-500 hover:bg-red-600 text-white">Reject</Button>
                          <Button variant="ghost" onClick={() => remove(s.id)}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          )}
          </div>
        </main>
      </div>
      <Footer />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Volunteer" : "Add Volunteer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium">Name</label>
              <input className="w-full mt-1 p-2 border rounded" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium">Email</label>
              <input className="w-full mt-1 p-2 border rounded" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium">Year</label>
                <input className="w-full mt-1 p-2 border rounded" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium">Department</label>
                <input className="w-full mt-1 p-2 border rounded" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium">Category</label>
              <input className="w-full mt-1 p-2 border rounded" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium">Registration Date</label>
              <input type="date" className="w-full mt-1 p-2 border rounded" value={form.registration_date} onChange={(e) => setForm({ ...form, registration_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium">Signature (PNG/JPEG, &lt;2MB)</label>
              <input type="file" accept="image/png,image/jpeg" className="w-full mt-1" onChange={(e) => onFile(e.target.files ? e.target.files[0] : null)} />
              {form.signature && <img src={form.signature} alt="sig" className="mt-2 max-h-28 border rounded" />}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageVolunteers;
