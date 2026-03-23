import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Check, X, Clock, FileText, Trash2, FolderPlus, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { toast } from "sonner";
import { motion } from "framer-motion";

// NOTE: Integrated with Event Finance System

const ManageBills: React.FC = () => {
    const navigate = useNavigate();
    const [bills, setBills] = useState<any[]>([]);
    const [folders, setFolders] = useState<any[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showBillDialog, setShowBillDialog] = useState(false);
    const [showFolderDialog, setShowFolderDialog] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Backward-compat alias: some older JSX references `showDialog` / `setShowDialog`
    // (kept to avoid runtime crashes during dev while redirecting away from this legacy page)
    const showDialog = showBillDialog;
    const setShowDialog = setShowBillDialog;
    const [formData, setFormData] = useState({
        title: "",
        amount: "",
        billDate: new Date().toISOString().split('T')[0],
        description: "",
        billType: "expense",
        category: "transport",
        folderId: ""
    });
    const [folderData, setFolderData] = useState({
        folderName: "",
        description: ""
    });

    const loadBills = async () => {
        try {
            setLoading(true);
            const res = await api.getBills();
            if (res.success) {
                setBills(res.bills || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const loadFolders = async () => {
        try {
            // This would load from the new finance system if available
            // For now, grouping bills by category
            const grouped: { [key: string]: any[] } = {};
            bills.forEach(bill => {
                const cat = bill.category || 'other';
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(bill);
            });
            setFolders(Object.entries(grouped).map(([name, items]) => ({
                id: name,
                name: name.charAt(0).toUpperCase() + name.slice(1),
                items
            })));
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        loadBills();
    }, []);

    useEffect(() => {
        loadFolders();
    }, [bills]);

    const handleCreateBill = async () => {
        if (!formData.title || !formData.amount) {
            toast.error("Please fill in all required fields");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await api.createBill({
                title: formData.title,
                amount: parseFloat(formData.amount),
                bill_date: formData.billDate,
                description: formData.description,
                bill_type: formData.billType,
                category: formData.category
            });

            if (res.success) {
                toast.success("Bill created successfully!");
                setShowBillDialog(false);
                setFormData({
                    title: "",
                    amount: "",
                    billDate: new Date().toISOString().split('T')[0],
                    description: "",
                    billType: "expense",
                    category: "transport"
                });
                loadBills();
            } else {
                toast.error(res.message || "Failed to create bill");
            }
        } catch (error: any) {
            toast.error("Error creating bill");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleApproveBill = async (billId: number, status: string) => {
        try {
            const res = await api.updateBill(billId, { bill_status: status });
            if (res.success) {
                toast.success(`Bill ${status}!`);
                loadBills();
            } else {
                toast.error("Failed to update bill");
            }
        } catch (error: any) {
            toast.error("Error updating bill");
        }
    };

    const handleDeleteBill = async (billId: number) => {
        if (window.confirm("Are you sure you want to delete this bill?")) {
            try {
                const res = await api.deleteBill(billId);
                if (res.success) {
                    toast.success("Bill deleted!");
                    loadBills();
                } else {
                    toast.error("Failed to delete bill");
                }
            } catch (error: any) {
                toast.error("Error deleting bill");
            }
        }
    };

    const getStatusBadge = (status: string) => {
        const s = status?.toLowerCase() || 'submitted';
        switch (s) {
            case 'approved':
                return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><Check className="w-3 h-3 mr-1" /> Approved</Badge>;
            case 'rejected':
                return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20"><X className="w-3 h-3 mr-1" /> Rejected</Badge>;
            default:
                return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
        }
    };

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <DeveloperCredit />
            <div className="w-full px-4 md:px-6 lg:px-8 space-y-8">
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center bg-white dark:bg-slate-950 p-6 rounded-3xl border border-border shadow-sm">
                        <div>
                            <h1 className="text-4xl font-black tracking-tight text-foreground">Manage Bills</h1>
                            <p className="text-muted-foreground font-bold italic uppercase tracking-widest text-xs mt-1">Review and approve submitted expense bills</p>
                        </div>
                        <Dialog open={showBillDialog} onOpenChange={setShowBillDialog}>
                            <DialogTrigger asChild>
                                <Button className="rounded-2xl h-12 font-black uppercase tracking-widest text-xs px-6 shadow-lg shadow-primary/20">
                                    <Plus className="w-4 h-4 mr-2" />
                                    New Bill
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px] rounded-3xl p-8">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl font-black tracking-tight">Create Bill</DialogTitle>
                                    <DialogDescription className="font-bold text-muted-foreground">
                                        Submit a new expense bill for review.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-6 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="title" className="font-black uppercase tracking-widest text-xs text-muted-foreground">Title</Label>
                                        <Input
                                            id="title"
                                            placeholder="Bill title"
                                            className="rounded-xl h-12 font-bold border-border"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="amount" className="font-black uppercase tracking-widest text-xs text-muted-foreground">Amount (INR)</Label>
                                        <Input
                                            id="amount"
                                            type="number"
                                            placeholder="0.00"
                                            className="rounded-xl h-12 font-bold border-border"
                                            value={formData.amount}
                                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="date" className="font-black uppercase tracking-widest text-xs text-muted-foreground">Bill Date</Label>
                                        <Input
                                            id="date"
                                            type="date"
                                            className="rounded-xl h-12 font-bold border-border"
                                            value={formData.billDate}
                                            onChange={(e) => setFormData({ ...formData, billDate: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="category" className="font-black uppercase tracking-widest text-xs text-muted-foreground">Category</Label>
                                        <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                                            <SelectTrigger className="rounded-xl h-12 font-bold focus:ring-primary border-border">
                                                <SelectValue placeholder="Select category" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-border">
                                                <SelectItem value="transport" className="font-bold">Transport</SelectItem>
                                                <SelectItem value="food" className="font-bold">Food</SelectItem>
                                                <SelectItem value="supplies" className="font-bold">Supplies</SelectItem>
                                                <SelectItem value="other" className="font-bold">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="desc" className="font-black uppercase tracking-widest text-xs text-muted-foreground">Description</Label>
                                        <Input
                                            id="desc"
                                            placeholder="Bill description"
                                            className="rounded-xl h-12 font-bold border-border"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button
                                        onClick={handleCreateBill}
                                        disabled={isSubmitting}
                                        className="w-full rounded-2xl h-12 font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20"
                                    >
                                        {isSubmitting ? "Creating..." : "Create Bill"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <Card className="border border-border shadow-sm bg-white dark:bg-slate-950 overflow-hidden rounded-3xl">
                    <CardHeader className="bg-muted/40 border-b border-border py-6 px-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                <FileText className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black text-foreground tracking-tight">Bills List</CardTitle>
                                <CardDescription className="font-bold text-muted-foreground">All submitted bills and their approval status</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-12 text-center text-muted-foreground animate-pulse font-bold">Loading bills...</div>
                        ) : bills.length === 0 ? (
                            <div className="text-center py-24 bg-muted/20">
                                <FileText className="w-16 h-16 mx-auto mb-6 text-muted-foreground opacity-20" />
                                <h3 className="text-xl font-black text-foreground mb-1 italic uppercase tracking-tighter opacity-50">No Bills Yet</h3>
                                <p className="text-muted-foreground font-bold">No bills have been submitted.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/50 border-b border-border">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-8">Title</TableHead>
                                            <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-8">Amount</TableHead>
                                            <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-8">Date</TableHead>
                                            <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-8">Category</TableHead>
                                            <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-8">Status</TableHead>
                                            <TableHead className="font-black uppercase tracking-widest text-xs text-muted-foreground py-4 px-8 text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {bills.map((bill) => (
                                            <TableRow key={bill.id} className="hover:bg-muted/30 border-border transition-colors group">
                                                <TableCell className="font-bold text-foreground py-4 px-8">
                                                    {bill.title}
                                                </TableCell>
                                                <TableCell className="font-bold text-foreground py-4 px-8 tabular-nums">
                                                    ₹{bill.amount?.toLocaleString() || '0'}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground py-4 px-8">
                                                    {new Date(bill.bill_date).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell className="uppercase font-bold text-xs text-muted-foreground py-4 px-8">
                                                    {bill.category || 'Other'}
                                                </TableCell>
                                                <TableCell className="py-4 px-8">
                                                    {getStatusBadge(bill.bill_status)}
                                                </TableCell>
                                                <TableCell className="py-4 px-8 text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        {bill.bill_status === 'submitted' && auth.getRole() === 'admin' && (
                                                            <>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="outline" 
                                                                    className="h-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-600"
                                                                    onClick={() => handleApproveBill(bill.id, 'approved')}
                                                                >
                                                                    <Check className="w-4 h-4" />
                                                                </Button>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="outline" 
                                                                    className="h-8 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                                                                    onClick={() => handleApproveBill(bill.id, 'rejected')}
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </Button>
                                                            </>
                                                        )}
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                                                            onClick={() => handleDeleteBill(bill.id)}
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
	);
};

export default ManageBills;

