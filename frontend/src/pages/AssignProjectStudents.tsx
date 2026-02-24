
import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

import { Search, UserPlus2, Save, FileSpreadsheet, Download, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { api } from "@/lib/api";
import * as XLSX from "xlsx";

const AssignProjectStudents = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<any[]>([]);
    const [assignedStudentIds, setAssignedStudentIds] = useState<Set<number>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [searchQuery, setSearchQuery] = useState("");

    // Excel Import State
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [importLoading, setImportLoading] = useState(false);

    useEffect(() => {
        if (id) loadData();
    }, [id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const projectId = parseInt(id!);
            const [projRes, studentsRes, allStudentsRes] = await Promise.all([
                api.getProjects(),
                api.getProjectStudents(projectId),
                api.getStudentsScoped() // or api.getUsers({ role: 'student' })
            ]);

            if (projRes.success) {
                const p = projRes.projects.find((pr: any) => pr.id === projectId);
                if (p) setProject(p);
                else throw new Error("Project not found");
            }

            const currentAssigned = new Set<number>();
            if (studentsRes.success) {
                studentsRes.students.forEach((s: any) => currentAssigned.add(s.user_id || s.id));
                setAssignedStudentIds(currentAssigned);
            }

            if (allStudentsRes.success) {
                const all = allStudentsRes.users || allStudentsRes.students || [];
                // Filter only students
                setStudents(all.filter((u: any) => u.role === 'student'));
            }

        } catch (e: any) {
            toast.error("Error loading data: " + e.message);
            navigate("/admin/projects");
        } finally {
            setLoading(false);
        }
    };

    const filteredStudents = useMemo(() => {
        return students.filter(s =>
            !assignedStudentIds.has(s.id) &&
            (s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.email.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [students, assignedStudentIds, searchQuery]);

    const handleToggleStudent = (studentId: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(studentId)) {
            newSelected.delete(studentId);
        } else {
            newSelected.add(studentId);
        }
        setSelectedIds(newSelected);
    };

    const handleAssign = async () => {
        if (selectedIds.size === 0) {
            toast.error("Select at least one student");
            return;
        }
        try {
            await api.bulkAssignStudentsToProject(parseInt(id!), Array.from(selectedIds));
            toast.success(`Successfully assigned ${selectedIds.size} students`);
            loadData();
            setSelectedIds(new Set());
        } catch (e: any) {
            toast.error("Failed to assign: " + e.message);
        }
    };

    const downloadTemplate = () => {
        const ws_data = [
            ["Student Email", "Student Name (Optional)"],
            ["student@example.com", "John Doe"],
            ["another@student.com", "Jane Smith"]
        ];
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "student_assign_template.xlsx");
        toast.success("Template downloaded");
    };

    const handleImport = async () => {
        if (!excelFile) return;
        setImportLoading(true);
        try {
            const data = await excelFile.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            const emailsToFind = new Set<string>();
            jsonData.forEach((row: any) => {
                // Look for common email headers
                const email = row['Student Email'] || row['Email'] || row['email'] || row['StudentEmail'];
                if (email) emailsToFind.add(String(email).trim().toLowerCase());
            });

            if (emailsToFind.size === 0) {
                toast.error("No emails found in Excel. Please check column headers.");
                setImportLoading(false);
                return;
            }

            // Match with available students
            let matchCount = 0;
            const newSelected = new Set(selectedIds);

            // Search across ALL students (even explicitly filtered ones not currently visible)
            // But only those NOT already assigned
            students.forEach(s => {
                if (assignedStudentIds.has(s.id)) return;

                if (emailsToFind.has(s.email.toLowerCase())) {
                    newSelected.add(s.id);
                    matchCount++;
                }
            });

            setSelectedIds(newSelected);

            if (matchCount > 0) {
                toast.success(`Found and selected ${matchCount} matching students! Review and click Assign.`);
                setShowImportDialog(false);
                setExcelFile(null);
            } else {
                toast.warning("No matching students found in the system. Are they registered?");
            }

        } catch (e: any) {
            toast.error("Failed to parse Excel: " + e.message);
        } finally {
            setImportLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    if (!project) return <div className="p-8 text-center">Project not found</div>;

    const role = (window.sessionStorage.getItem('auth_user') ? JSON.parse(window.sessionStorage.getItem('auth_user')!).role : 'admin');
    const backPath = '/admin/projects';

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="w-full px-4 md:px-6 lg:px-8 space-y-6">


                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{project.title}</h1>
                        <p className="text-muted-foreground">Assign students to this project</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setShowImportDialog(true)} className="gap-2">
                            <FileSpreadsheet className="w-4 h-4" />
                            Import from Excel
                        </Button>
                        <Button onClick={handleAssign} disabled={selectedIds.size === 0} size="lg" className="gap-2">
                            <Save className="w-4 h-4" />
                            Assign Selected ({selectedIds.size})
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Available Students</CardTitle>
                        <CardDescription>Select students to assign to {project.title}. Selected: {selectedIds.size}</CardDescription>
                        <div className="relative mt-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search students..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 max-w-md"
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {filteredStudents.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                No available students found matching your search.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredStudents.map(student => (
                                    <div
                                        key={student.id}
                                        className={`flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${selectedIds.has(student.id) ? 'bg-primary/10 border-primary' : 'hover:bg-muted'}`}
                                        onClick={() => handleToggleStudent(student.id)}
                                    >
                                        <Checkbox
                                            checked={selectedIds.has(student.id)}
                                            onCheckedChange={() => handleToggleStudent(student.id)}
                                        />
                                        <div className="overflow-hidden">
                                            <p className="font-medium truncate">{student.name}</p>
                                            <p className="text-sm text-muted-foreground truncate">{student.email}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import Students via Excel</DialogTitle>
                        <DialogDescription>
                            Upload an Excel file containing a list of student emails to select them automatically.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                            <span className="text-sm">Need a template?</span>
                            <Button variant="ghost" size="sm" onClick={downloadTemplate} className="gap-1">
                                <Download className="w-3 h-3" /> Download Template
                            </Button>
                        </div>
                        <div className="space-y-2">
                            <Label>Select Excel File</Label>
                            <Input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancel</Button>
                        <Button onClick={handleImport} disabled={!excelFile || importLoading}>
                            {importLoading ? "Processing..." : "Find & Select Students"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AssignProjectStudents;
