import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Plus, ArrowLeft, Edit, Trash2, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

const ManageBills = () => {
  const navigate = useNavigate();
  

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({ title: "", description: "", bill_date: new Date().toISOString().split('T')[0], bill_type: "transport", amount: "", transport_from: "", transport_to: "", food_breakfast: "", food_lunch: "", food_dinner: "", drive_link: "", transport_trips: [], items: [], itemize: false });
  const [currentTrip, setCurrentTrip] = useState({ from: "", to: "", amount: "" });
  const [currentItem, setCurrentItem] = useState({ category: 'transport', description: '', amount: '', from: '', to: '' });

  const { permissions, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
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

    loadBills();
  }, [navigate, permissions, permissionsLoading]);
  const loadBills = async () => { try { setLoading(true); const response = await api.getBills(); if (response.success) setBills(response.bills || []); } catch (e) { console.error(e); } finally { setLoading(false); } };
  const handleSubmit = async (e) => {
    e.preventDefault();
    
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
      if (editingBill) {
        response = await api.updateBill(editingBill.id, payload);
      } else {
        response = await api.createBill(payload);
      }

      if (response && response.success) {
        toast.success(editingBill ? "Bill updated successfully!" : "Bill created successfully!");
        setShowDialog(false);
        loadBills();
        resetForm();
      } else {
        toast.error(response?.message || 'Failed to save bill');
      }
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };
  const handleDelete = async (billId) => { if (!confirm("Delete?")) return; try { const response = await api.deleteBill(billId); if (response.success) { toast.success("Deleted!"); loadBills(); } } catch (e) { toast.error("Error: " + e.message); } };
  const handleEdit = (bill) => {
    setEditingBill(bill);
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

  const resetForm = () => { setFormData({ title: "", description: "", bill_date: new Date().toISOString().split('T')[0], bill_type: "transport", amount: "", transport_from: "", transport_to: "", food_breakfast: "", food_lunch: "", food_dinner: "", drive_link: "", transport_trips: [], items: [], itemize: false }); setCurrentTrip({ from: "", to: "", amount: "" }); setCurrentItem({ category: 'transport', description: '', amount: '', from: '', to: '' }); setEditingBill(null); };

  const filteredBills = bills.filter(bill => {
    const q = searchQuery.toLowerCase();
    return (bill.title?.toLowerCase().includes(q)) || (bill.description?.toLowerCase().includes(q)) || (bill.name?.toLowerCase().includes(q)) || (bill.purpose?.toLowerCase().includes(q));
  });
  const getStatusBadge = (status) => { switch (status) { case 'pending': return <Badge variant="outline">Pending</Badge>; case 'approved': return <Badge className="bg-green-600">Approved</Badge>; case 'rejected': return <Badge variant="destructive">Rejected</Badge>; default: return <Badge variant="outline">{status || "N/A"}</Badge>; } };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <DeveloperCredit />
      <main className="flex-1 p-4 md:p-8 bg-gradient-to-b from-background via-background to-orange-50/20">
          <div className="max-w-6xl mx-auto">
            {/* Hero Header Section */}
            <div className="mb-8 bg-gradient-to-r from-orange-600 via-orange-500 to-red-500 rounded-xl p-8 text-white shadow-lg">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" onClick={() => navigate("/admin")} className="gap-2 hover:bg-white/20 text-white">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                  </Button>
                </div>
                <Button onClick={() => { resetForm(); setShowDialog(true); }} className="gap-2 bg-white text-orange-600 hover:bg-orange-50">
                  <Plus className="w-4 h-4" />
                  Create Bill
                </Button>
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">Bills</h1>
                <p className="text-lg opacity-90">Manage bills and financial records</p>
              </div>
            </div>
            <Card className="gradient-card border-border/50">
              <CardHeader><CardTitle>Bills ({filteredBills.length})</CardTitle><CardDescription>View and manage bills</CardDescription></CardHeader>
              <CardContent>
                <div className="mb-6"><div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" /><Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" /></div></div>
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : filteredBills.length === 0 ? (
                  <div className="py-12">
                    <div className="max-w-xl mx-auto text-center">
                      <div className="text-6xl mb-4">💸</div>
                      <h3 className="text-xl font-semibold mb-2">No bills yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">You haven't created any bills. Click the button below to create your first bill.</p>
                      <div className="flex justify-center">
                        <Button onClick={() => { resetForm(); setShowDialog(true); }} className="gap-2">
                          <Plus className="w-4 h-4" />
                          Create Bill
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
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
                                  <Button className="h-8 w-8 p-0" variant="ghost" title="Edit" aria-label={`Edit ${bill.title || bill.name}`} onClick={() => handleEdit(bill)}>
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button className="h-8 w-8 p-0" variant="ghost" title="Delete" aria-label={`Delete ${bill.title || bill.name}`} onClick={() => handleDelete(bill.id)}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {filteredBills.length > 0 && <div className="mt-4 pt-4 border-t flex justify-end"><div className="text-right"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold text-primary">₹{filteredBills.reduce((sum, bill) => sum + bill.amount, 0).toLocaleString()}</p></div></div>}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-gradient-to-br from-white to-slate-50">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
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
                  className="w-full h-11 px-3 py-2 border-2 border-input rounded-md bg-background focus:border-primary transition-colors"
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

            <div className="mt-2 flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
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
                <div className="bg-slate-50 p-4 rounded-lg mb-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <select value={currentItem.category} onChange={(e) => setCurrentItem({ ...currentItem, category: e.target.value })} className="w-full px-3 py-2 border border-input rounded-md bg-background">
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
                      <div className="bg-slate-100 p-3 grid grid-cols-5 gap-2 font-semibold text-sm">
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
                <div className="bg-slate-50 p-4 rounded-lg mb-4 space-y-3">
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
                      <div className="bg-slate-100 p-3 grid grid-cols-4 gap-2 font-semibold text-sm">
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
                  <div className="bg-blue-50 p-3 rounded text-sm">
                    Total: ₹{((parseFloat(formData.food_breakfast) || 0) + (parseFloat(formData.food_lunch) || 0) + (parseFloat(formData.food_dinner) || 0)).toFixed(2)}
                  </div>
                )}
              </div>
            )}
            {formData.bill_type !== 'transport' && !(Array.isArray(formData.items) && formData.items.length > 0) && (
              <div className="space-y-2"><Label>Amount (₹) *</Label><Input type="number" step="0.01" min="0" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required /></div>
            )}

            <div className="space-y-2 border-t pt-4">
              <Label className="text-sm font-semibold">Drive/Document Link (optional)</Label>
              <Input 
                type="url" 
                placeholder="https://drive.google.com/..." 
                value={formData.drive_link} 
                onChange={(e) => setFormData({ ...formData, drive_link: e.target.value })} 
                className="h-11 border-2 focus:border-primary transition-colors"
              />
              <p className="text-xs text-muted-foreground mt-1">Paste your Google Drive, receipt, or document link here</p>
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
                className="px-8 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              >
                {editingBill ? 'Update Bill' : 'Create Bill'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
};

export default ManageBills;
