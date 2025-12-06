import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Users, ArrowLeft, GraduationCap } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

const ManageAlumni = () => {
  const navigate = useNavigate();
  const [alumni, setAlumni] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  
  const [formData, setFormData] = useState({
    userId: "",
    graduation_year: "",
    current_position: "",
    company: "",
    achievements: "",
    contact_email: "",
    linkedin_url: ""
  });

  const { permissions, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }
    
    const user = auth.getUser();
    const isAdmin = user?.role === 'admin';
    
    // Only admin can access this page
    if (!isAdmin) {
      toast.error("You don't have permission to access alumni management");
      navigate("/admin");
      return;
    }
    
    if (!permissionsLoading) {
      loadData();
    }
  }, [navigate, permissions, permissionsLoading]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [alumniRes, usersRes] = await Promise.all([
        api.getAlumni(),
        api.getUsers()
      ]);
      
      if (alumniRes.success) {
        setAlumni(alumniRes.alumni || []);
      }
      if (usersRes.success) {
        // Filter to show only alumni role users or users without alumni profile
        setUsers(usersRes.users?.filter((u: any) => u.role === 'alumni' || !alumniRes.alumni?.find((a: any) => a.user_id === u.id)) || []);
      }
    } catch (error: any) {
      toast.error("Failed to load data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAlumni = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/alumni`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify({
          ...formData,
          userId: parseInt(formData.userId),
          graduation_year: formData.graduation_year ? parseInt(formData.graduation_year) : null
        })
      }).then(res => res.json());
      if (response.success) {
        toast.success("Alumni profile created successfully!");
        setShowAddDialog(false);
        setFormData({
          userId: "",
          graduation_year: "",
          current_position: "",
          company: "",
          achievements: "",
          contact_email: "",
          linkedin_url: ""
        });
        loadData();
      }
    } catch (error: any) {
      toast.error("Failed to create alumni profile: " + error.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <DeveloperCredit />
      
      <main className="flex-1 p-4 md:p-8 bg-gradient-to-b from-background via-background to-orange-50/20">
          <div className="max-w-7xl mx-auto">
          {/* Hero Header Section */}
          <div className="mb-8 bg-gradient-to-r from-orange-600 via-orange-500 to-red-500 rounded-xl p-8 text-white shadow-lg">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate("/admin")} className="gap-2 hover:bg-white/20 text-white">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </Button>
              </div>
              <Button onClick={() => setShowAddDialog(true)} className="gap-2 bg-white text-orange-600 hover:bg-orange-50">
                <GraduationCap className="w-4 h-4" />
                Add Alumni
              </Button>
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">Alumni Management</h1>
              <p className="text-lg opacity-90">Track alumni achievements and contributions</p>
            </div>
          </div>

          <Card className="gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                All Alumni ({alumni.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alumni.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No alumni found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Graduation Year</TableHead>
                      <TableHead>Current Position</TableHead>
                      <TableHead>Company</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alumni.map((alum) => (
                      <TableRow key={alum.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={alum.photo || alum.photoUrl || alum.user?.photo || '/Images/Brand_logo.png'} alt={alum.name} />
                              <AvatarFallback>{((alum.name || "").split(" ").map(s => s[0]).slice(0,2).join("") || "?")}</AvatarFallback>
                            </Avatar>
                            <span>{alum.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{alum.email}</TableCell>
                        <TableCell>{alum.graduation_year || "N/A"}</TableCell>
                        <TableCell>{alum.current_position || "N/A"}</TableCell>
                        <TableCell>{alum.company || "N/A"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          </div>
        </main>

      {/* Add Alumni Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Alumni Profile</DialogTitle>
            <DialogDescription>
              Create or update an alumni profile
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddAlumni} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User *</Label>
              <Select value={formData.userId} onValueChange={(value) => setFormData({ ...formData, userId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="graduation_year">Graduation Year</Label>
              <Input
                id="graduation_year"
                type="number"
                value={formData.graduation_year}
                onChange={(e) => setFormData({ ...formData, graduation_year: e.target.value })}
                placeholder="e.g., 2023"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="current_position">Current Position</Label>
              <Input
                id="current_position"
                value={formData.current_position}
                onChange={(e) => setFormData({ ...formData, current_position: e.target.value })}
                placeholder="e.g., Software Engineer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="e.g., Google"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="achievements">Achievements</Label>
              <Textarea
                id="achievements"
                value={formData.achievements}
                onChange={(e) => setFormData({ ...formData, achievements: e.target.value })}
                rows={3}
                placeholder="List notable achievements..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="alumni@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin_url">LinkedIn URL</Label>
              <Input
                id="linkedin_url"
                type="url"
                value={formData.linkedin_url}
                onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/in/..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Alumni Profile</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default ManageAlumni;

