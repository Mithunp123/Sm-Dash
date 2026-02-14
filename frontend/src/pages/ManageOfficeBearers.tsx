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

  const filteredOfficeBearers = officeBearers.filter(ob =>
    ob.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ob.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (ob.academic_year && ob.academic_year.includes(searchQuery))
  );

  return (
    <main className="flex-1 w-full bg-background overflow-x-hidden min-h-screen">
      <div className="w-full px-4 md:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            className="gap-2 font-bold text-muted-foreground hover:text-primary transition-colors pl-0"
            onClick={() => navigate("/admin")}
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Button>
        </div>

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground">
              Office Bearers
            </h1>
            <p className="text-muted-foreground font-medium text-sm md:text-base border-l-4 border-primary/30 pl-3">
              Manage student coordinators and leadership directory
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
            <div className="grid grid-cols-2 sm:flex items-center gap-3">


              <Button
                onClick={downloadSampleExcel}
                variant="outline"
                className="flex-1 px-4 py-2 border-green-500/30 hover:bg-green-50 text-green-600 font-bold gap-2 rounded-xl h-11 text-xs sm:text-sm"
              >
                <FileSpreadsheet className="w-4 h-4 hidden sm:block" />
                <span>Sample</span>
              </Button>

              <Button
                variant="outline"
                onClick={exportPDF}
                className="flex-1 gap-2 border-primary/20 hover:bg-primary/5 text-primary font-bold h-11 text-xs sm:text-sm rounded-xl"
              >
                <FileText className="w-4 h-4 hidden sm:block" />
                <span>PDF</span>
              </Button>
            </div>

            <Button
              onClick={() => setShowAddDialog(true)}
              className="gap-2 shadow-xl shadow-primary/30 font-bold px-8 h-12 text-sm w-full sm:w-auto rounded-xl bg-primary hover:bg-primary/90 transition-all hover:translate-y-[-2px] group"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              Add New Bearer
            </Button>
          </div>
        </div>

        <Card className="border-border/50 mb-10 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-md overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none"></div>
          <CardContent className="p-4 md:p-6 relative z-10">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors w-5 h-5" />
              <Input
                placeholder="Search by name, position, year..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 bg-background/50 border-border/50 focus:ring-primary/20 transition-all rounded-2xl text-base md:text-lg shadow-inner"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Responsive Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {loading ? (
              <div className="col-span-full h-40 flex items-center justify-center">
                <p className="text-muted-foreground animate-pulse font-medium">Loading office bearers...</p>
              </div>
            ) : filteredOfficeBearers.length === 0 ? (
              <div className="col-span-full">
                <Card className="p-12 text-center border-dashed">
                  <p className="text-muted-foreground font-medium">No office bearers found.</p>
                </Card>
              </div>
            ) : (
              filteredOfficeBearers.map((ob) => (
                <Card key={ob.id} className="group overflow-hidden border-border/50 shadow-sm hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300 flex flex-col bg-card/60 backdrop-blur-md">
                  <CardContent className="p-4 flex flex-col flex-1">
                    <div className="flex items-start gap-4 mb-4">
                      <Avatar className="w-16 h-16 rounded-2xl border-2 border-primary/10 shrink-0 shadow-sm">
                        <AvatarImage src={ob.photo_url ? `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${ob.photo_url}` : undefined} className="object-cover" />
                        <AvatarFallback className="bg-primary/5 text-primary font-black uppercase text-xl">
                          {ob.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-lg truncate pr-2 leading-tight" title={ob.name}>{ob.name}</h3>
                          <div className="flex gap-1 shrink-0 -mr-2 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="ghost" onClick={() => openEditDialog(ob)} className="w-8 h-8 text-blue-500 hover:bg-blue-50">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => { setSelectedOB(ob); setShowDeleteDialog(true); }} className="w-8 h-8 text-red-500 hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground truncate font-medium">{ob.email || 'No Email'}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-2 py-0.5 font-bold text-[10px] uppercase tracking-wider">
                            {ob.position}
                          </Badge>
                          <Badge variant="outline" className="font-bold border-primary/30 text-primary/70 text-[10px] px-2 py-0.5">
                            {ob.year || 'IV Year'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between text-xs font-bold text-muted-foreground bg-muted/30 -mx-4 -mb-4 px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Academic</span>
                        <span className="text-primary/70">{ob.academic_year}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground/80">{ob.contact || 'N/A'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) clearForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Add Office Bearer</DialogTitle>
            <DialogDescription>Add a new student coordinator for the current year</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddOfficeBearer} className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-primary/20 rounded-3xl p-8 bg-primary/5 group hover:border-primary/40 transition-all cursor-pointer relative overflow-hidden" onClick={() => fileInputRef.current?.click()}>
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-40 h-40 rounded-2xl object-cover shadow-2xl relative z-10" />
                  ) : (
                    <div className="w-40 h-40 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-inner relative z-10">
                      <Camera className="w-12 h-12 text-slate-300 group-hover:text-primary transition-colors" />
                    </div>
                  )}
                  <p className="mt-4 text-[10px] font-black text-primary uppercase tracking-[0.2em] relative z-10">{photoPreview ? 'Change Photo' : 'Upload Photo'}</p>
                  <input type="file" ref={fileInputRef} onChange={handlePhotoChange} className="hidden" accept="image/*" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Academic Year *</Label>
                    <Input value={formData.academic_year} onChange={e => setFormData({ ...formData, academic_year: e.target.value })} required className="h-11 rounded-xl" placeholder="e.g. 2024-2025" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Student Year *</Label>
                    <Select value={formData.year} onValueChange={val => setFormData({ ...formData, year: val })}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select Year" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="I Year">I Year</SelectItem>
                        <SelectItem value="II Year">II Year</SelectItem>
                        <SelectItem value="III Year">III Year</SelectItem>
                        <SelectItem value="IV Year">IV Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name *</Label>
                  <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required className="h-11 rounded-xl" placeholder="Enter name" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Position *</Label>
                  <Input value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })} required className="h-11 rounded-xl" placeholder="e.g. President, Secretary" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contact Number</Label>
                  <Input value={formData.contact} onChange={e => setFormData({ ...formData, contact: e.target.value })} className="h-11 rounded-xl" placeholder="+91 00000 00000" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address</Label>
                  <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="h-11 rounded-xl" placeholder="email@example.com" />
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-primary/20 rounded-3xl p-8 bg-primary/5 group hover:border-primary/40 transition-all cursor-pointer relative overflow-hidden" onClick={() => fileInputRef.current?.click()}>
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-40 h-40 rounded-2xl object-cover shadow-2xl relative z-10" />
                  ) : (
                    <div className="w-40 h-40 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-inner relative z-10">
                      <Camera className="w-12 h-12 text-slate-300 group-hover:text-primary transition-colors" />
                    </div>
                  )}
                  <p className="mt-4 text-[10px] font-black text-primary uppercase tracking-[0.2em] relative z-10">Change Photo</p>
                  <input type="file" ref={fileInputRef} onChange={handlePhotoChange} className="hidden" accept="image/*" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Academic Year *</Label>
                    <Input value={formData.academic_year} onChange={e => setFormData({ ...formData, academic_year: e.target.value })} required className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Student Year *</Label>
                    <Select value={formData.year} onValueChange={val => setFormData({ ...formData, year: val })}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select Year" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="I Year">I Year</SelectItem>
                        <SelectItem value="II Year">II Year</SelectItem>
                        <SelectItem value="III Year">III Year</SelectItem>
                        <SelectItem value="IV Year">IV Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name *</Label>
                  <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Position *</Label>
                  <Input value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })} required className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contact Number</Label>
                  <Input value={formData.contact} onChange={e => setFormData({ ...formData, contact: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address</Label>
                  <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="h-11 rounded-xl" />
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
