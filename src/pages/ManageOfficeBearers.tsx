import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, Plus, ArrowLeft, Edit, Trash2, Search, Camera, FileText, Activity, FileSpreadsheet } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { BackButton } from "@/components/BackButton";
import { usePermissions } from "@/hooks/usePermissions";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const ManageOfficeBearers = () => {
  const navigate = useNavigate();
  const [officeBearers, setOfficeBearers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedOB, setSelectedOB] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    position: "",
    contact: "",
    email: "",
    academic_year: new Date().getFullYear().toString(),
    year: "IV Year",
    photo: null as File | null
  });

  const { permissions, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }

    if (permissionsLoading) return;

    const isAdmin = auth.hasRole('admin');
    if (!isAdmin) {
      toast.error("Access denied. Admin access required.");
      navigate("/admin");
      return;
    }

    loadOfficeBearers();
  }, [permissionsLoading, permissions]);

  const loadOfficeBearers = async () => {
    try {
      setLoading(true);
      const response = await api.getOfficeBearers();
      if (response.success) {
        setOfficeBearers(response.officeBearers || []);
      }
    } catch (error: any) {
      toast.error("Failed to load office bearers: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, photo: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearForm = () => {
    setFormData({
      name: "",
      position: "",
      contact: "",
      email: "",
      academic_year: new Date().getFullYear().toString(),
      year: "IV Year",
      photo: null
    });
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddOfficeBearer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const fData = new FormData();
      fData.append('name', formData.name);
      fData.append('position', formData.position);
      fData.append('contact', formData.contact);
      fData.append('email', formData.email);
      fData.append('academic_year', formData.academic_year);
      fData.append('year', formData.year);
      if (formData.photo) {
        fData.append('photo', formData.photo);
      }

      const response = await api.createOfficeBearer(fData);
      if (response.success) {
        toast.success("Office Bearer added successfully!");
        setShowAddDialog(false);
        clearForm();
        loadOfficeBearers();
      } else {
        toast.error(response.message || "Failed to add office bearer");
      }
    } catch (error: any) {
      toast.error("Error: " + error.message);
    }
  };

  const handleEditOfficeBearer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOB) return;

    try {
      const fData = new FormData();
      fData.append('name', formData.name);
      fData.append('position', formData.position);
      fData.append('contact', formData.contact);
      fData.append('email', formData.email);
      fData.append('academic_year', formData.academic_year);
      fData.append('year', formData.year);
      if (formData.photo) {
        fData.append('photo', formData.photo);
      }

      const response = await api.updateOfficeBearer(selectedOB.id, fData);
      if (response.success) {
        toast.success("Office Bearer updated successfully!");
        setShowEditDialog(false);
        setSelectedOB(null);
        clearForm();
        loadOfficeBearers();
      } else {
        toast.error(response.message || "Update failed");
      }
    } catch (error: any) {
      toast.error("Error: " + error.message);
    }
  };

  const handleDeleteOfficeBearer = async () => {
    if (!selectedOB) return;

    try {
      const response = await api.deleteOfficeBearer(selectedOB.id);

      if (response.success) {
        toast.success("Office Bearer deleted successfully!");
        setShowDeleteDialog(false);
        setSelectedOB(null);
        loadOfficeBearers();
      } else {
        toast.error(response.message || "Delete failed");
      }
    } catch (error: any) {
      toast.error("Error: " + error.message);
    }
  };

  const openEditDialog = (ob: any) => {
    setSelectedOB(ob);
    setFormData({
      name: ob.name,
      position: ob.position,
      contact: ob.contact || "",
      email: ob.email || "",
      academic_year: ob.academic_year || "",
      year: ob.year || "IV Year",
      photo: null
    });
    setPhotoPreview(ob.photo_url ? `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${ob.photo_url}` : null);
    setShowEditDialog(true);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235);
    doc.text("SM Volunteers - Office Bearers Directory", 14, 20);

    doc.setFontSize(14);
    doc.setTextColor(249, 115, 22);
    doc.text("Motto: To serve society with a passion", 14, 28);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated Date: ${new Date().toLocaleDateString()}`, 14, 35);

    autoTable(doc, {
      startY: 45,
      head: [['Name', 'Position', 'Contact', 'Email', 'Year']],
      body: officeBearers.map(ob => [ob.name, ob.position, ob.contact || '-', ob.email || '-', ob.academic_year || '-']),
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235], fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 5 }
    });

    doc.save("SM_Office_Bearers_Report.pdf");
    toast.success("PDF directory exported!");
  };

  const downloadMasterExcel = async () => {
    try {
      toast.loading("Gathering volunteer data...");



      // Get Volunteer Data (from localStorage where Submissions are stored)
      const subJson = localStorage.getItem("volunteer_submissions");
      const submissionList = subJson ? JSON.parse(subJson) : [];

      const volJson = localStorage.getItem("volunteers");
      const volunteerList = volJson ? JSON.parse(volJson) : [];

      // Create Workbook
      const wb = XLSX.utils.book_new();

      // Office Bearers Sheet
      const obData = officeBearers.map(ob => ({
        Name: ob.name,
        Position: ob.position,
        Contact: ob.contact || '-',
        Email: ob.email || '-',
        Year: ob.academic_year || '-'
      }));
      const wsOB = XLSX.utils.json_to_sheet(obData);
      XLSX.utils.book_append_sheet(wb, wsOB, "Office Bearers");

      // Volunteers Sheet
      const volData = volunteerList.map((v: any) => ({
        Name: v.name,
        Email: v.email,
        "Register No": v.register_no || '-',
        Year: v.year || '-',
        Department: v.department || '-',
        Phone: v.phone || '-',
        Category: v.category || 'Volunteer',
        Status: 'Approved'
      }));
      const wsVol = XLSX.utils.json_to_sheet(volData);
      XLSX.utils.book_append_sheet(wb, wsVol, "Approved Volunteers");

      // Submissions Sheet
      const subData = submissionList.map((s: any) => ({
        Name: s.name,
        Email: s.email,
        "Register No": s.register_no || '-',
        Year: s.year || '-',
        Department: s.department || '-',
        Phone: s.phone || '-',
        Status: s.status || 'Pending'
      }));
      const wsSub = XLSX.utils.json_to_sheet(subData);
      XLSX.utils.book_append_sheet(wb, wsSub, "Volunteer Applications");



      // Download
      XLSX.writeFile(wb, `SM_Volunteers_Community_Directory_${new Date().toISOString().slice(0, 10)}.xlsx`);

      toast.dismiss();
      toast.success("Community Excel Directory downloaded!");
    } catch (error: any) {
      toast.dismiss();
      toast.error("Failed to generate Excel: " + error.message);
    }
  };

  const downloadSampleExcel = () => {
    const wb = XLSX.utils.book_new();
    const sampleData = [
      {
        Name: "John Doe",
        Position: "President",
        Contact: "9876543210",
        Email: "john@example.com",
        "Academic Year": "2024-2025"
      },
      {
        Name: "Jane Smith",
        Position: "Secretary",
        Contact: "9876543211",
        Email: "jane@example.com",
        "Academic Year": "2024-2025"
      }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(wb, ws, "Office Bearers Template");
    XLSX.writeFile(wb, "SM_Office_Bearers_Template.xlsx");
    toast.success("Sample template downloaded!");
  };

  return (
    <main className="flex-1 p-4 md:p-8 bg-background">
      <div className="w-full px-4 md:px-6 lg:px-8">
        <div className="mb-4">
          <BackButton to="/admin" />
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-black text-primary uppercase tracking-tighter">Office Bearers</h1>
            <p className="text-muted-foreground font-medium">Manage student coordinators year by year</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Round Excel Button requested by user */}
            <Button
              onClick={downloadMasterExcel}
              className="w-12 h-12 rounded-full p-0 flex items-center justify-center shadow-lg shadow-green-500/20 bg-green-600 hover:bg-green-700 text-white transition-all transform hover:scale-110"
              title="Download Master Excel"
            >
              <FileSpreadsheet className="w-6 h-6" />
            </Button>

            <Button
              onClick={downloadSampleExcel}
              variant="outline"
              className="px-4 py-2 border-green-500/50 hover:bg-green-50 text-green-600 font-bold gap-2 rounded-xl h-10"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Sample Excel
            </Button>

            <Button variant="outline" onClick={exportPDF} className="gap-2 border-primary/20 hover:bg-primary/5 text-primary font-bold">
              <FileText className="w-5 h-5" />
              Export PDF
            </Button>
            <Button onClick={() => setShowAddDialog(true)} className="gap-2 shadow-lg shadow-primary/20 font-bold px-6">
              <Plus className="w-5 h-5" />
              Add New Bearer
            </Button>
          </div>
        </div>

        <Card className="gradient-card border-border/50 mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by name, position, or year..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary/50 transition-all rounded-xl"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 dark:bg-slate-900/50">
                    <TableHead className="font-bold py-4 w-16 text-center">S.No</TableHead>
                    <TableHead className="font-bold">Bearer Details</TableHead>
                    <TableHead className="font-bold">Position</TableHead>
                    <TableHead className="font-bold">Year</TableHead>
                    <TableHead className="font-bold">Contact Info</TableHead>
                    <TableHead className="font-bold">Academic Year</TableHead>
                    <TableHead className="font-bold text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {officeBearers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium">
                        No office bearers found. Add one to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    officeBearers
                      .filter(ob =>
                        ob.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        ob.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (ob.academic_year && ob.academic_year.includes(searchQuery))
                      )
                      .map((ob, index) => (
                        <TableRow key={ob.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                          <TableCell className="text-center font-bold text-muted-foreground w-16">
                            {index + 1}
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-4 pl-2">
                              <Avatar className="w-12 h-12 rounded-xl border-2 border-primary/10">
                                <AvatarImage src={ob.photo_url ? `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${ob.photo_url}` : undefined} />
                                <AvatarFallback className="bg-primary/5 text-primary font-black uppercase">
                                  {ob.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-bold text-lg leading-none mb-1">{ob.name}</p>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">{ob.email || 'No Email'}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-3 py-1 font-bold">
                              {ob.position}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-bold border-primary/30 text-primary/70">
                              {ob.year || 'IV Year'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-sm font-medium">
                              <p>{ob.contact || 'No Contact'}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-black text-slate-500">{ob.academic_year}</span>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-2">
                              <Button size="icon" variant="ghost" onClick={() => openEditDialog(ob)} className="text-blue-500 hover:text-blue-600 hover:bg-blue-50/50">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => { setSelectedOB(ob); setShowDeleteDialog(true); }} className="text-red-500 hover:text-red-600 hover:bg-red-50/50">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) clearForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Add Office Bearer</DialogTitle>
            <DialogDescription>Add a new student coordinator for the current year</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddOfficeBearer} className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-2xl p-6 bg-slate-50/30 group hover:border-primary/30 transition-all cursor-pointer relative" onClick={() => fileInputRef.current?.click()}>
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-32 h-32 rounded-2xl object-cover shadow-xl" />
                  ) : (
                    <div className="w-32 h-32 rounded-2xl bg-slate-100 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                      <Camera className="w-10 h-10 text-slate-400 group-hover:text-primary transition-colors" />
                    </div>
                  )}
                  <p className="mt-3 text-xs font-bold text-slate-500 uppercase tracking-widest">{photoPreview ? 'Change Photo' : 'Upload Photo'}</p>
                  <input type="file" ref={fileInputRef} onChange={handlePhotoChange} className="hidden" accept="image/*" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Academic Year *</Label>
                  <Input value={formData.academic_year} onChange={e => setFormData({ ...formData, academic_year: e.target.value })} required placeholder="e.g. 2024-2025" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Student Year *</Label>
                  <Select value={formData.year} onValueChange={val => setFormData({ ...formData, year: val })}>
                    <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="I Year">I Year</SelectItem>
                      <SelectItem value="II Year">II Year</SelectItem>
                      <SelectItem value="III Year">III Year</SelectItem>
                      <SelectItem value="IV Year">IV Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-bold">Full Name *</Label>
                  <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="Enter name" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Position *</Label>
                  <Input value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })} required placeholder="e.g. President, Secretary" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Contact Number</Label>
                  <Input value={formData.contact} onChange={e => setFormData({ ...formData, contact: e.target.value })} placeholder="+91 00000 00000" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Email Address</Label>
                  <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="email@example.com" />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowAddDialog(false)} className="font-bold">Cancel</Button>
              <Button type="submit" className="px-8 font-bold shadow-lg shadow-primary/20">Create Bearer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { setShowEditDialog(open); if (!open) { setSelectedOB(null); clearForm(); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Edit Office Bearer</DialogTitle>
            <DialogDescription>Update coordinator details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditOfficeBearer} className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-2xl p-6 bg-slate-50/30 group hover:border-primary/30 transition-all cursor-pointer relative" onClick={() => fileInputRef.current?.click()}>
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-32 h-32 rounded-2xl object-cover shadow-xl" />
                  ) : (
                    <div className="w-32 h-32 rounded-2xl bg-slate-100 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                      <Camera className="w-10 h-10 text-slate-400 group-hover:text-primary transition-colors" />
                    </div>
                  )}
                  <p className="mt-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Change Photo</p>
                  <input type="file" ref={fileInputRef} onChange={handlePhotoChange} className="hidden" accept="image/*" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Academic Year *</Label>
                  <Input value={formData.academic_year} onChange={e => setFormData({ ...formData, academic_year: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Student Year *</Label>
                  <Select value={formData.year} onValueChange={val => setFormData({ ...formData, year: val })}>
                    <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="I Year">I Year</SelectItem>
                      <SelectItem value="II Year">II Year</SelectItem>
                      <SelectItem value="III Year">III Year</SelectItem>
                      <SelectItem value="IV Year">IV Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-bold">Full Name *</Label>
                  <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Position *</Label>
                  <Input value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Contact Number</Label>
                  <Input value={formData.contact} onChange={e => setFormData({ ...formData, contact: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Email Address</Label>
                  <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowEditDialog(false)} className="font-bold">Cancel</Button>
              <Button type="submit" className="px-8 font-bold shadow-lg shadow-primary/20">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <span className="font-bold">{selectedOB?.name}</span>? This will permanently delete their record and photo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-4">
            <Button variant="ghost" onClick={() => { setShowDeleteDialog(false); setSelectedOB(null); }} className="font-bold">Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteOfficeBearer} className="font-bold px-6">Delete Bearer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default ManageOfficeBearers;
