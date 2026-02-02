import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { BackButton } from "@/components/BackButton";
import { Plus, ArrowLeft, Edit, Trash2, Search, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

const ManageBills = () => {
  const navigate = useNavigate();


  const [bills, setBills] = useState([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDesc, setNewFolderDesc] = useState('');
  const [newFolderDisabled, setNewFolderDisabled] = useState(false);
  const [editingFolder, setEditingFolder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({ title: "", description: "", bill_date: new Date().toISOString().split('T')[0], bill_type: "transport", amount: "", transport_from: "", transport_to: "", food_breakfast: "", food_lunch: "", food_dinner: "", drive_link: "", transport_trips: [], items: [], itemize: false });
  const [currentTrip, setCurrentTrip] = useState({ from: "", to: "", amount: "" });
  const [currentItem, setCurrentItem] = useState({ category: 'transport', description: '', amount: '', from: '', to: '' });
  const [currentOther, setCurrentOther] = useState({ title: '', description: '', amount: '', link: '' });

  // Image Upload State
  const [imageGroups, setImageGroups] = useState<{ name: string, files: File[] }[]>([]);
  const [currentImageGroup, setCurrentImageGroup] = useState<{ name: string, files: File[] }>({ name: '', files: [] });
  const [existingImages, setExistingImages] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { permissions, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      // ... existing code ...
      const resetForm = () => { setFormData({ title: "", description: "", bill_date: new Date().toISOString().split('T')[0], bill_type: "transport", amount: "", transport_from: "", transport_to: "", food_breakfast: "", food_lunch: "", food_dinner: "", drive_link: "", transport_trips: [], items: [], itemize: false }); setCurrentTrip({ from: "", to: "", amount: "" }); setCurrentItem({ category: 'transport', description: '', amount: '', from: '', to: '' }); setCurrentOther({ title: '', description: '', amount: '', link: '' }); setEditingBill(null); };
      navigate("/login");
      return;
    }

    const user = auth.getUser();

    // Wait for permissions to load
    if (permissionsLoading) return;

    const isAdmin = user?.role === 'admin';
    const canAccess = isAdmin || permissions.can_manage_bills;
    if (!canAccess) {
      toast.error("You don't have permission to access bill management");
      navigate(user?.role === 'office_bearer' ? "/office-bearer" : "/admin");
      return;
    }

    (async () => {
      await loadFolders();
      await loadBills();
    })();
  }, [navigate, permissions, permissionsLoading]);
  const loadBills = async () => {
    try {
      setLoading(true);
      const response = await api.getBills(selectedFolderId ? { folderId: selectedFolderId } : undefined);
      if (response.success) setBills(response.bills || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    try {
      const res = await api.getBillFolders();
      if (res && res.success) setFolders(res.folders || []);
    } catch (err) {
      console.error('Failed to load folders', err);
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) { toast.error('Folder name required'); return; }
    try {
      const description = (newFolderDisabled ? '[DISABLED] ' : '') + newFolderDesc.trim();
      if (editingFolder) {
        const res = await api.updateBillFolder(editingFolder.id, { name: newFolderName.trim(), description: description || undefined });
        if (res && res.success) {
          toast.success('Folder updated');
          setEditingFolder(null);
          setShowFolderDialog(false);
          setNewFolderName(''); setNewFolderDesc('');
          await loadFolders();
          await loadBills();
        } else {
          toast.error(res?.message || 'Failed to update folder');
        }
      } else {
        const description = (newFolderDisabled ? '[DISABLED] ' : '') + newFolderDesc.trim();
        const res = await api.createBillFolder({ name: newFolderName.trim(), description: description || undefined });
        if (res && res.success) {
          toast.success('Folder created');
          setShowFolderDialog(false);
          setNewFolderName(''); setNewFolderDesc('');
          await loadFolders();
        } else {
          toast.error(res?.message || 'Failed to create folder');
        }
      }
    } catch (err: any) {
      toast.error('Error: ' + (err.message || err));
    }
  };

  const handleDeleteFolder = async (id) => {
    if (!confirm('Delete this folder? Bills inside will become Unsorted.')) return;
    try {
      const res = await api.deleteBillFolder(id);
      if (res && res.success) {
        toast.success('Folder deleted');
        if (selectedFolderId === id) setSelectedFolderId(null);
        await loadFolders();
        await loadBills();
      } else {
        toast.error(res?.message || 'Failed to delete folder');
      }
    } catch (err: any) {
      toast.error('Error: ' + (err.message || err));
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // If items are present, compute total from them (itemized bill for any type)
    let totalAmount = 0;
    if (Array.isArray(formData.items) && formData.items.length > 0) {
      totalAmount = formData.items.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);
    } else if (formData.bill_type === 'transport') {
      if (formData.transport_trips.length === 0) {
        toast.error("Add at least one transport trip");
        return;
      }
      totalAmount = formData.transport_trips.reduce((sum, trip) => sum + (parseFloat(trip.amount) || 0), 0);
    } else if (formData.bill_type === 'food') {
      const breakfast = parseFloat(formData.food_breakfast) || 0;
      const lunch = parseFloat(formData.food_lunch) || 0;
      const dinner = parseFloat(formData.food_dinner) || 0;
      if (breakfast === 0 && lunch === 0 && dinner === 0) {
        toast.error("Add at least one meal amount");
        return;
      }
      totalAmount = breakfast + lunch + dinner;
    } else {
      if (!formData.amount) {
        toast.error("Fill all required fields");
        return;
      }
      totalAmount = parseFloat(formData.amount);
    }

    if (!formData.title) {
      toast.error("Bill name is required");
      return;
    }

    try {
      // Map frontend fields to backend expected keys
      const payload: any = {
        title: formData.title,
        amount: totalAmount,
        description: formData.description || null,
        bill_date: formData.bill_date,
        bill_type: formData.bill_type,
        drive_link: formData.drive_link || null,
      };

      if (formData.bill_type === 'food') {
        payload.food_breakfast = parseFloat(formData.food_breakfast) || null;
        payload.food_lunch = parseFloat(formData.food_lunch) || null;
        payload.food_dinner = parseFloat(formData.food_dinner) || null;
      }

      if (formData.bill_type === 'transport') {
        payload.transport_trips = formData.transport_trips;
      }

      // send items if present for any bill type
      if (Array.isArray(formData.items) && formData.items.length > 0) {
        payload.items = formData.items;
      }

      let response;
      let billId;

      if (editingBill) {
        // Preserve folder assignment when editing
        response = await api.updateBill(editingBill.id, {
          ...payload,
          folder_id: editingBill.folder_id !== undefined ? editingBill.folder_id : selectedFolderId || null,
        });
        billId = editingBill.id;
      } else {
        // New bills should be created inside the currently selected folder (if any)
        response = await api.createBill({
          ...payload,
          folder_id: selectedFolderId || null,
        });
        billId = response?.id;
      }

      if (response && response.success) {
        // Handle Image Uploads
        if (imageGroups.length > 0 && billId) {
          for (const group of imageGroups) {
            const fd = new FormData();
            fd.append('folderName', group.name);
            group.files.forEach(f => fd.append('images', f));
            try {
              await api.uploadBillImages(billId, fd);
            } catch (err) {
              console.error("Failed to upload image group:", group.name, err);
              toast.error(`Failed to upload images for ${group.name}`);
            }
          }
        }

        toast.success(editingBill ? "Bill updated successfully!" : "Bill created successfully!");
        setShowDialog(false);
        loadBills();
        resetForm();
      } else {
        toast.error(response?.message || 'Failed to save bill');
      }
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleDelete = async (billId) => { if (!confirm("Delete?")) return; try { const response = await api.deleteBill(billId); if (response.success) { toast.success("Deleted!"); loadBills(); } } catch (e) { toast.error("Error: " + e.message); } };

  const handleDeleteImage = async (imageId) => {
    if (!confirm("Delete this image?")) return;
    try {
      await api.deleteBillImage(imageId);
      setExistingImages(existingImages.filter(img => img.id !== imageId));
      toast.success("Image deleted");
    } catch (err: any) {
      toast.error("Failed to delete image: " + err.message);
    }
  };

  const handleEdit = async (bill) => {
    setEditingBill(bill);
    // Fetch images
    try {
      const res = await api.getBillImages(bill.id);
      if (res.success) setExistingImages(res.images || []);
    } catch (err) {
      console.error(err);
    }

    setFormData({
      title: bill.title || bill.name || "",
      description: bill.description || bill.purpose || "",
      bill_date: bill.bill_date || bill.date || new Date().toISOString().split('T')[0],
      bill_type: bill.bill_type || bill.type || "transport",
      amount: (bill.amount || 0).toString(),
      transport_from: bill.transport_from || bill.from || "",
      transport_to: bill.transport_to || bill.to || "",
      food_breakfast: bill.food_breakfast ? String(bill.food_breakfast) : "",
      food_lunch: bill.food_lunch ? String(bill.food_lunch) : "",
      food_dinner: bill.food_dinner ? String(bill.food_dinner) : "",
      drive_link: bill.drive_link || bill.link || "",
      transport_trips: bill.transport_trips || [],
      items: bill.items || [],
      itemize: Array.isArray(bill.items) && bill.items.length > 0
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setFormData({ title: "", description: "", bill_date: new Date().toISOString().split('T')[0], bill_type: "transport", amount: "", transport_from: "", transport_to: "", food_breakfast: "", food_lunch: "", food_dinner: "", drive_link: "", transport_trips: [], items: [], itemize: false });
    setCurrentTrip({ from: "", to: "", amount: "" });
    setCurrentItem({ category: 'transport', description: '', amount: '', from: '', to: '' });
    setCurrentOther({ title: '', description: '', amount: '', link: '' });
    setEditingBill(null);
    setImageGroups([]);
    setExistingImages([]);
    setCurrentImageGroup({ name: '', files: [] });
  };

  // View State: 'folders' or 'bills'
  const [currentView, setCurrentView] = useState<'folders' | 'bills'>('folders');
  const [viewTitle, setViewTitle] = useState('Bill Folders');

  // Filter bills based on selected folder (if in bills view)
  const filteredBills = bills.filter(bill => {
    // Exact folder match or null match if we implement "Unsorted" concept, 
    // but for now strict folder view means we filter by selectedFolderId
    if (currentView === 'bills' && selectedFolderId !== null) {
      if (bill.folder_id !== selectedFolderId) return false;
    }
    const q = searchQuery.toLowerCase();
    return (bill.title?.toLowerCase().includes(q)) || (bill.description?.toLowerCase().includes(q)) || (bill.name?.toLowerCase().includes(q));
  });

  const handleFolderClick = (folder) => {
    setSelectedFolderId(folder.id);
    setCurrentView('bills');
    setViewTitle(folder.name);
    loadBills(); // Refresh bills might be needed if not fully loaded
  };

  const handleBackToFolders = () => {
    setSelectedFolderId(null);
    setCurrentView('folders');
    setViewTitle('Bill Folders');
    setSearchQuery('');
  };

  const getStatusBadge = (status) => { switch (status) { case 'pending': return <Badge variant="outline">Pending</Badge>; case 'approved': return <Badge className="bg-green-600">Approved</Badge>; case 'rejected': return <Badge variant="destructive">Rejected</Badge>; default: return <Badge variant="outline">{status || "N/A"}</Badge>; } };

  return (
    <div className="min-h-screen flex flex-col">

      <DeveloperCredit />
      <main className="flex-1 p-2 md:p-4 bg-background">
        <div className="max-w-6xl mx-auto">
          {/* Back Button */}
          <div className="mb-4">
            {currentView === 'bills' ? (
              <Button variant="ghost" onClick={handleBackToFolders} className="gap-2 pl-0 hover:pl-2 transition-all">
                <ArrowLeft className="w-4 h-4" /> Back to Folders
              </Button>
            ) : (
              <BackButton to="/admin" />
            )}
          </div>

          {/* Page Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-foreground mb-1">{viewTitle}</h1>
              <p className="text-sm text-muted-foreground">{currentView === 'folders' ? 'Manage folders to organize bills' : 'Manage bills in this folder'}</p>
            </div>
            {currentView === 'folders' ? (
              <Button onClick={() => {
                setEditingFolder(null);
                setNewFolderName('');
                setNewFolderDesc('');
                setNewFolderDisabled(false);
                setShowFolderDialog(true);
              }} className="gap-2">
                <Plus className="w-4 h-4" />
                Create Folder
              </Button>
            ) : (
              <Button onClick={() => { resetForm(); setShowDialog(true); }} className="gap-2">
                <Plus className="w-4 h-4" />
                Create Bill
              </Button>
            )}
          </div>

          {currentView === 'folders' ? (
            // FOLDERS GRID VIEW
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {folders.map(folder => {
                // Calculate bill count for this folder locally or fetch? 
                // For now filtering bills array if loaded, or just show icon
                const count = bills.filter(b => b.folder_id === folder.id).length;
                const isDisabled = folder.description?.includes('[DISABLED]');
                const isAdmin = auth.hasRole('admin');

                // If disabled and not admin, show locked or hide?
                // User requirement: "Disable ... for Office Bearers". 
                // We'll show it as locked visually

                return (
                  <Card key={folder.id} className={`hover:shadow-md transition-shadow bg-card border-border/50 group relative ${isDisabled ? 'opacity-75 border-red-200 bg-red-50/10' : ''}`}>
                    <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                      <div
                        className={`p-4 rounded-full transition-colors ${isDisabled && !isAdmin ? 'bg-muted cursor-not-allowed' : 'bg-primary/10 group-hover:bg-primary/20 cursor-pointer'}`}
                        onClick={() => {
                          if (isDisabled && !isAdmin) {
                            toast.error("This folder is currently disabled");
                            return;
                          }
                          handleFolderClick(folder);
                        }}
                      >
                        <Briefcase className={`w-8 h-8 ${isDisabled ? 'text-muted-foreground' : 'text-primary'}`} />
                      </div>
                      <div
                        className={`w-full ${isDisabled && !isAdmin ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        onClick={() => {
                          if (isDisabled && !isAdmin) return;
                          handleFolderClick(folder);
                        }}
                      >
                        <h3 className="font-semibold text-lg flex items-center justify-center gap-2">
                          {folder.name}
                          {isDisabled && <Badge variant="destructive" className="text-[10px] h-5">Disabled</Badge>}
                        </h3>
                        <p className="text-sm text-muted-foreground">{count} bills</p>
                        {isDisabled && !isAdmin && <p className="text-xs text-destructive mt-1">Access Restricted</p>}
                      </div>

                      {/* Edit/Delete Buttons */}
                      <div className="flex gap-2 w-full pt-2 border-t">
                        {(auth.hasRole('admin')) && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-8 gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingFolder(folder);
                                setNewFolderName(folder.name);
                                const isDisabled = folder.description?.includes('[DISABLED]');
                                setNewFolderDisabled(isDisabled);
                                setNewFolderDesc(folder.description ? folder.description.replace('[DISABLED]', '').trim() : '');
                                setShowFolderDialog(true);
                              }}
                            >
                              <Edit className="w-3 h-3" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFolder(folder.id);
                              }}
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Empty State for Folders */}
              {folders.length === 0 && (
                <div className="col-span-full text-center py-12 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground mb-4">No folders created yet</p>
                  <Button variant="outline" onClick={() => setShowFolderDialog(true)}>Create your first folder</Button>
                </div>
              )}
            </div>
          ) : (
            // BILLS LIST VIEW (Inside a Folder)
            <Card className="border-border/50 bg-card">
              <CardHeader><CardTitle>Bills</CardTitle><CardDescription>{filteredBills.length} records found</CardDescription></CardHeader>
              <CardContent>
                <div className="mb-6"><div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" /><Input placeholder="Search bills..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" /></div></div>

                {filteredBills.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="text-4xl mb-3">📄</div>
                    <h3 className="text-lg font-medium">No bills in this folder</h3>
                    <p className="text-muted-foreground mb-4">Add a new bill to get started</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBills.map((bill) => (
                          <TableRow key={bill.id}>
                            <TableCell className="font-medium">{bill.title || bill.name}</TableCell>
                            <TableCell>₹{(bill.amount || 0).toLocaleString()}</TableCell>
                            <TableCell><Badge variant="secondary" className="capitalize">{(bill.bill_type || bill.type) || 'N/A'}</Badge></TableCell>
                            <TableCell>{(bill.bill_date || bill.date) ? new Date(bill.bill_date || bill.date).toLocaleDateString() : '—'}</TableCell>
                            <TableCell>{getStatusBadge(bill.status)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button className="h-8 w-8 p-0" variant="ghost" title="Edit" onClick={(e) => { e.stopPropagation(); handleEdit(bill); }}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button className="h-8 w-8 p-0" variant="ghost" title="Delete" onClick={(e) => { e.stopPropagation(); handleDelete(bill.id); }}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
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
          )}

        </div>
      </main>
      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFolder ? 'Edit Folder' : 'Create New Folder'}</DialogTitle>
            <DialogDescription>Enter the name for the bill folder.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateFolder} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Folder Name *</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. 2024 Events"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                placeholder="Brief description..."
              />
            </div>
            {auth.hasRole('admin') && (
              <div className="flex items-center space-x-2 py-2">
                <Checkbox
                  id="disable-folder"
                  checked={newFolderDisabled}
                  onCheckedChange={(checked) => setNewFolderDisabled(checked as boolean)}
                />
                <Label htmlFor="disable-folder" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Disable Access for AAGALA (Office Bearers)
                </Label>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowFolderDialog(false)}>Cancel</Button>
              <Button type="submit">{editingFolder ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-2xl font-bold text-foreground">
              {editingBill ? 'Edit Bill' : 'Create New Bill'}
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              {editingBill ? 'Update bill details' : 'Create a new bill with all necessary information'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Name *</Label>
              <Input
                placeholder="Enter bill name"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="h-11 border-2 focus:border-primary transition-colors"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Purpose (optional)</Label>
              <Textarea
                placeholder="Describe the purpose of this bill"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="border-2 focus:border-primary transition-colors resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Date *</Label>
                <Input
                  type="date"
                  value={formData.bill_date}
                  onChange={(e) => setFormData({ ...formData, bill_date: e.target.value })}
                  required
                  className="h-11 border-2 focus:border-primary transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Type *</Label>
                <select
                  value={formData.bill_type}
                  onChange={(e) => setFormData({ ...formData, bill_type: e.target.value })}
                  className="w-full h-11 px-3 py-2 bg-background border border-input rounded-md text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-colors"
                >
                  <option value="transport">Transport</option>
                  <option value="food">Food</option>
                  <option value="stationary">Stationary</option>
                  <option value="refreshment">Refreshment</option>
                  <option value="fuel">Fuel</option>
                  <option value="other">Other</option>
                  <option value="cluster_class">Cluster Class (itemized)</option>
                </select>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-3 p-3 bg-muted rounded-lg border border-border">
              <input
                id="itemize"
                type="checkbox"
                checked={!!formData.itemize}
                onChange={(e) => setFormData({ ...formData, itemize: e.target.checked })}
                className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
              />
              <label htmlFor="itemize" className="text-sm font-medium cursor-pointer">
                Itemize bill (add multiple categories/items)
              </label>
            </div>

            {/* Itemized entries (shown when cluster_class selected or Itemize is checked) */}
            {(formData.bill_type === 'cluster_class' || formData.itemize) && (
              <div className="mt-3 border-t pt-4">
                <Label className="text-base font-semibold mb-3 block">Add Items</Label>
                <div className="bg-muted p-4 rounded-lg mb-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <select
                        value={currentItem.category}
                        onChange={(e) => setCurrentItem({ ...currentItem, category: e.target.value })}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                      >
                        <option value="transport">Transport</option>
                        <option value="food">Food</option>
                        <option value="stationary">Stationary</option>
                        <option value="refreshment">Refreshment</option>
                        <option value="fuel">Fuel</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    {/* For transport items show From/To instead of generic description */}
                    {currentItem.category === 'transport' ? (
                      <>
                        <div className="space-y-2">
                          <Label>From</Label>
                          <Input placeholder="Origin" value={currentItem.from} onChange={(e) => setCurrentItem({ ...currentItem, from: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>To</Label>
                          <Input placeholder="Destination" value={currentItem.to} onChange={(e) => setCurrentItem({ ...currentItem, to: e.target.value })} />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input placeholder="Description" value={currentItem.description} onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })} />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Amount (₹)</Label>
                      <Input type="number" step="0.01" min="0" placeholder="0.00" value={currentItem.amount} onChange={(e) => setCurrentItem({ ...currentItem, amount: e.target.value })} />
                    </div>
                  </div>
                  <Button type="button" onClick={() => {
                    if (!currentItem.category || !currentItem.amount) { toast.error('Fill category and amount'); return; }
                    const item: any = { category: currentItem.category, amount: parseFloat(currentItem.amount) || 0 };
                    if (currentItem.category === 'transport') {
                      item.from = currentItem.from || null;
                      item.to = currentItem.to || null;
                      item.description = null;
                    } else {
                      item.description = currentItem.description || null;
                      item.from = null;
                      item.to = null;
                    }
                    setFormData({ ...formData, items: [...(formData.items || []), item] });
                    setCurrentItem({ category: 'transport', description: '', amount: '', from: '', to: '' });
                  }} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                </div>

                {/* List items */}
                {Array.isArray(formData.items) && formData.items.length > 0 && (
                  <div className="space-y-2">
                    <Label>Items ({formData.items.length})</Label>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-muted p-3 grid grid-cols-5 gap-2 font-semibold text-sm">
                        <div>Category</div>
                        <div>Description</div>
                        <div>Amount</div>
                        <div className="col-span-2 text-right">Action</div>
                      </div>
                      {formData.items.map((it, idx) => (
                        <div key={idx} className="p-3 grid grid-cols-5 gap-2 border-t text-sm items-center">
                          <div className="capitalize">{it.category}</div>
                          <div>{it.category === 'transport' ? `${it.from || '—'} → ${it.to || '—'}` : (it.description || '—')}</div>
                          <div>₹{(it.amount || 0).toFixed(2)}</div>
                          <div className="col-span-2 text-right">
                            <Button type="button" size="sm" variant="destructive" onClick={() => {
                              setFormData({ ...formData, items: formData.items.filter((_, i) => i !== idx) });
                            }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="text-right font-semibold">
                      Total: ₹{(formData.items.reduce((s, it) => s + (it.amount || 0), 0)).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Conditional fields based on type */}
            {formData.bill_type === 'transport' && !formData.itemize && (
              <div className="mt-3 border-t pt-4">
                <Label className="text-base font-semibold mb-3 block">Transport Trips</Label>

                {/* Add trip form */}
                <div className="bg-muted p-4 rounded-lg mb-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>From</Label>
                      <Input placeholder="Origin" value={currentTrip.from} onChange={(e) => setCurrentTrip({ ...currentTrip, from: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>To</Label>
                      <Input placeholder="Destination" value={currentTrip.to} onChange={(e) => setCurrentTrip({ ...currentTrip, to: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount (₹)</Label>
                      <Input type="number" step="0.01" min="0" placeholder="0.00" value={currentTrip.amount} onChange={(e) => setCurrentTrip({ ...currentTrip, amount: e.target.value })} />
                    </div>
                  </div>
                  <Button type="button" onClick={() => {
                    if (!currentTrip.from || !currentTrip.to || !currentTrip.amount) {
                      toast.error("Fill all trip fields");
                      return;
                    }
                    setFormData({ ...formData, transport_trips: [...formData.transport_trips, { ...currentTrip, amount: parseFloat(currentTrip.amount) }] });
                    setCurrentTrip({ from: "", to: "", amount: "" });
                  }} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Trip
                  </Button>
                </div>

                {/* List of added trips */}
                {formData.transport_trips.length > 0 && (
                  <div className="space-y-2">
                    <Label>Added Trips ({formData.transport_trips.length})</Label>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-muted p-3 grid grid-cols-4 gap-2 font-semibold text-sm">
                        <div>From</div>
                        <div>To</div>
                        <div>Amount</div>
                        <div className="text-right">Action</div>
                      </div>
                      {formData.transport_trips.map((trip, idx) => (
                        <div key={idx} className="p-3 grid grid-cols-4 gap-2 border-t text-sm items-center">
                          <div>{trip.from}</div>
                          <div>{trip.to}</div>
                          <div>₹{trip.amount}</div>
                          <div className="text-right">
                            <Button type="button" size="sm" variant="destructive" onClick={() => {
                              setFormData({ ...formData, transport_trips: formData.transport_trips.filter((_, i) => i !== idx) });
                            }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="text-right font-semibold">
                      Total: ₹{formData.transport_trips.reduce((sum, trip) => sum + trip.amount, 0).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {formData.bill_type === 'food' && (
              <div className="mt-3 border-t pt-4 space-y-3">
                <Label className="text-base font-semibold">Food Expenses</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Breakfast (₹)</Label>
                    <Input type="number" step="0.01" min="0" placeholder="0.00" value={formData.food_breakfast} onChange={(e) => setFormData({ ...formData, food_breakfast: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Lunch (₹)</Label>
                    <Input type="number" step="0.01" min="0" placeholder="0.00" value={formData.food_lunch} onChange={(e) => setFormData({ ...formData, food_lunch: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Dinner (₹)</Label>
                    <Input type="number" step="0.01" min="0" placeholder="0.00" value={formData.food_dinner} onChange={(e) => setFormData({ ...formData, food_dinner: e.target.value })} />
                  </div>
                </div>
                {(formData.food_breakfast || formData.food_lunch || formData.food_dinner) && (
                  <div className="bg-muted p-3 rounded text-sm">
                    Total: ₹{((parseFloat(formData.food_breakfast) || 0) + (parseFloat(formData.food_lunch) || 0) + (parseFloat(formData.food_dinner) || 0)).toFixed(2)}
                  </div>
                )}
              </div>
            )}

            {formData.bill_type === 'other' && (
              <div className="mt-3 border-t pt-4 space-y-4">
                <Label className="text-base font-semibold block">Other Expenses</Label>

                {Array.isArray(formData.items) && formData.items.length > 0 ? (
                  <div className="space-y-2">
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-muted p-3 grid grid-cols-12 gap-2 font-semibold text-sm">
                        <div className="col-span-4">Title / Reason</div>
                        <div className="col-span-4">Description</div>
                        <div className="col-span-2">Amount</div>
                        <div className="col-span-2 text-right">Action</div>
                      </div>
                      {formData.items.map((item, idx) => (
                        <div key={idx} className="p-3 grid grid-cols-12 gap-2 border-t text-sm items-center">
                          <div className="col-span-4 font-medium">{item.title || item.description}</div>
                          <div className="col-span-4 text-muted-foreground truncate">{item.notes || '-'}</div>
                          <div className="col-span-2">₹{(item.amount || 0).toFixed(2)}</div>
                          <div className="col-span-2 text-right">
                            <Button type="button" size="sm" variant="ghost" className="text-destructive h-8 w-8 p-0" onClick={() => {
                              setFormData({ ...formData, items: formData.items.filter((_, i) => i !== idx) });
                            }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="text-right font-semibold text-lg">
                      Total: ₹{(formData.items.reduce((s, it) => s + (it.amount || 0), 0)).toFixed(2)}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 border-2 border-dashed rounded-lg bg-muted/30">
                    <p className="text-muted-foreground text-sm">No other expenses added yet</p>
                  </div>
                )}

                <div className="bg-muted p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Title / Reason <span className="text-destructive">*</span></Label>
                      <Input placeholder="e.g. Printing charges" value={currentOther.title} onChange={(e) => setCurrentOther({ ...currentOther, title: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount (₹) <span className="text-destructive">*</span></Label>
                      <Input type="number" step="0.01" min="0" placeholder="0.00" value={currentOther.amount} onChange={(e) => setCurrentOther({ ...currentOther, amount: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
                      <Input placeholder="Additional details..." value={currentOther.description} onChange={(e) => setCurrentOther({ ...currentOther, description: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Proof Link <span className="text-muted-foreground">(optional)</span></Label>
                      <Input placeholder="https://..." value={currentOther.link} onChange={(e) => setCurrentOther({ ...currentOther, link: e.target.value })} />
                    </div>
                  </div>
                  <Button type="button" onClick={() => {
                    if (!currentOther.title || !currentOther.amount) { toast.error("Title and Amount are required"); return; }
                    const newItem = {
                      category: 'other',
                      title: currentOther.title,
                      description: currentOther.title,
                      notes: currentOther.description,
                      amount: parseFloat(currentOther.amount) || 0,
                      link: currentOther.link || null
                    };
                    setFormData({ ...formData, items: [...(formData.items || []), newItem] });
                    setCurrentOther({ title: '', description: '', amount: '', link: '' });
                  }} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Other Expense
                  </Button>
                </div>
              </div>
            )}
            {formData.bill_type !== 'transport' && formData.bill_type !== 'other' && !(Array.isArray(formData.items) && formData.items.length > 0) && (
              <div className="space-y-2"><Label>Amount (₹) *</Label><Input type="number" step="0.01" min="0" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required /></div>
            )}

            <div className="space-y-2 border-t pt-4">
              <Label className="text-sm font-semibold">Drive/Document Link (Optional)</Label>
              <Input
                type="url"
                placeholder="https://drive.google.com/..."
                value={formData.drive_link}
                onChange={(e) => setFormData({ ...formData, drive_link: e.target.value })}
                className="h-11 border-2 focus:border-primary transition-colors"
              />
            </div>
            <DialogFooter className="pt-4 border-t gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDialog(false)}
                className="px-6"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="px-8"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : (editingBill ? 'Update Bill' : 'Create Bill')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ManageBills;
