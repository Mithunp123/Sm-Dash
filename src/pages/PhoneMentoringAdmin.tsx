import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhoneCall, RefreshCcw, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { api } from "@/lib/api";
import { toast } from "sonner";

type UpdateRow = {
  id: number;
  volunteer_id: number;
  volunteer_name: string;
  volunteer_dept?: string;
  volunteer_year?: string;
  mentee_name: string;
  mentee_department?: string | null;
  mentee_year?: string | null;
  mentee_status?: string | null;
  mentee_school?: string | null;
  mentee_parent_contact?: string | null;
  mentee_address?: string | null;
  mentee_notes?: string | null;
  project_title?: string | null;
  update_date: string;
  status: string;
  explanation?: string;
  attempts?: number;
  attachment_path?: string | null;
};

type AttendanceRow = {
  id: number;
  assignment_id: number;
  project_id?: number | null;
  mentee_name?: string | null;
  attendance_date: string;
  status: string;
  notes?: string | null;
  call_recording_path?: string | null;
  recorded_by?: number | null;
  volunteer_id?: number;
  volunteer_name?: string;
  volunteer_dept?: string;
  volunteer_year?: string;
  mentee_department?: string | null;
  mentee_year?: string | null;
  mentee_school?: string | null;
  mentee_parent_contact?: string | null;
  mentee_address?: string | null;
  mentee_notes?: string | null;
  project_title?: string | null;
};

const PhoneMentoringAdmin = () => {
  const [date, setDate] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("updates");
  const [projects, setProjects] = useState<Array<{ id: number; title: string }>>([]);
  const exportToExcel = () => {
    if (updates.length === 0) {
      toast.error("No records to export");
      return;
    }
    const worksheetData = updates.map((row) => ({
      Date: row.update_date,
      Project: row.project_title || "",
      Volunteer: row.volunteer_name,
      "Volunteer Dept": row.volunteer_dept || "",
      "Volunteer Year": row.volunteer_year || "",
      Mentee: row.mentee_name,
      "Standard": row.mentee_year || "",
      School: row.mentee_school || "",
      "Parent Contact": row.mentee_parent_contact || "",
      Panchayat: row.mentee_address || "",
      District: row.mentee_notes || "",
      Status: row.status,
      Explanation: row.explanation || "",
      Attempts: row.attempts ?? "",
      Attachment: row.attachment_path || ""
    }));
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mentoring Updates");
    const fileName = `phone_mentoring_updates_${date || "all"}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success("Exported mentoring updates");
  };

  const loadUpdates = async () => {
    try {
      setLoading(true);
      const res = await api.getPhoneMentoringUpdates({
        date: date || undefined,
        status: status || undefined,
        projectId: projectFilter ? Number(projectFilter) : undefined
      });
      if (res?.success) {
        setUpdates(res.updates || []);
      } else {
        setUpdates([]);
        if (res?.message) {
          toast.error(res.message);
        }
      }
    } catch (err: any) {
      console.error("Failed to load phone mentoring updates", err);
      toast.error(err?.message || "Failed to load updates");
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendance = async () => {
    try {
      setAttendanceLoading(true);
      const res = await api.getPhoneMentoringAttendance({
        date: date || undefined,
        status: status || undefined,
        projectId: projectFilter ? Number(projectFilter) : undefined
      });
      if (res?.success) {
        setAttendance(res.attendance || []);
      } else {
        setAttendance([]);
        if (res?.message) {
          toast.error(res.message);
        }
      }
    } catch (err: any) {
      console.error("Failed to load attendance", err);
      toast.error(err?.message || "Failed to load attendance");
      setAttendance([]);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const exportAttendanceToExcel = () => {
    if (attendance.length === 0) {
      toast.error("No records to export");
      return;
    }
    const worksheetData = attendance.map((row) => ({
      Date: row.attendance_date,
      Project: row.project_title || "",
      Volunteer: row.volunteer_name || "",
      "Volunteer Dept": row.volunteer_dept || "",
      "Volunteer Year": row.volunteer_year || "",
      Mentee: row.mentee_name || "",
      "Standard": row.mentee_year || "",
      School: row.mentee_school || "",
      "Parent Contact": row.mentee_parent_contact || "",
      Panchayat: row.mentee_address || "",
      District: row.mentee_notes || "",
      Status: row.status,
      Notes: row.notes || "",
      "Call Recording": row.call_recording_path || ""
    }));
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    const fileName = `phone_mentoring_attendance_${date || "all"}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success("Exported attendance records");
  };

  useEffect(() => {
    if (activeTab === "updates") {
      loadUpdates();
    } else {
      loadAttendance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getProjects();
        if (res.success && Array.isArray(res.projects)) {
          setProjects(res.projects.map((p: any) => ({ id: p.id, title: p.title })));
        }
      } catch (err) {
        console.warn("Failed to load projects for mentoring filter", err);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <Header />
      <main className="flex-1 container mx-auto px-4 md:px-8 py-6 md:py-8 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <PhoneCall className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Phone Mentoring Management
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              View all volunteer daily updates and attendance records for phone mentoring.
            </p>
          </div>
        </div>

        <Card className="border-0 shadow-xl bg-gradient-to-br from-slate-900/80 via-slate-900/90 to-slate-950 backdrop-blur-md">
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-emerald-400 text-lg md:text-xl">
                Daily Update Log
              </CardTitle>
              <CardDescription className="text-slate-300">
                Filter by date and status to quickly review mentoring progress.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs uppercase text-slate-300">Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-slate-900/60 border-slate-700 text-slate-100 h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase text-slate-300">Status</Label>
                <Select
                  value={status}
                  onValueChange={(val) => setStatus(val)}
                >
                  <SelectTrigger className="bg-slate-900/60 border-slate-700 text-slate-100 h-9 w-48">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    <SelectItem value="CALL_DONE">Call Done</SelectItem>
                    <SelectItem value="NOT_CALLED">Not Called</SelectItem>
                    <SelectItem value="STUDENT_NOT_PICKED">Student Not Picked</SelectItem>
                    <SelectItem value="CALL_PENDING">Call Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase text-slate-300">Project</Label>
                <Select
                  value={projectFilter}
                  onValueChange={(val) => setProjectFilter(val)}
                >
                  <SelectTrigger className="bg-slate-900/60 border-slate-700 text-slate-100 h-9 w-48">
                    <SelectValue placeholder="All projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                className="mt-5 md:mt-0 gap-2 h-9 border-emerald-500 text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => activeTab === "updates" ? loadUpdates() : loadAttendance()}
                disabled={loading || attendanceLoading}
              >
                <RefreshCcw className="w-4 h-4" />
                {loading || attendanceLoading ? "Loading..." : "Refresh"}
              </Button>
              <Button
                className="mt-5 md:mt-0 gap-2 h-9"
                onClick={() => activeTab === "updates" ? exportToExcel() : exportAttendanceToExcel()}
                disabled={activeTab === "updates" ? updates.length === 0 : attendance.length === 0}
              >
                <Download className="w-4 h-4" />
                Download Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="updates">Daily Updates</TabsTrigger>
                <TabsTrigger value="attendance">Attendance</TabsTrigger>
              </TabsList>
              <TabsContent value="updates" className="mt-0">
                <div className="overflow-x-auto">
                  <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-300">Date</TableHead>
                  <TableHead className="text-slate-300">Project</TableHead>
                  <TableHead className="text-slate-300">Volunteer</TableHead>
                  <TableHead className="text-slate-300">Dept / Year</TableHead>
                  <TableHead className="text-slate-300">Mentee</TableHead>
                  <TableHead className="text-slate-300">Standard</TableHead>
                  <TableHead className="text-slate-300">School</TableHead>
                  <TableHead className="text-slate-300">Parent</TableHead>
                  <TableHead className="text-slate-300">Panchayat</TableHead>
                  <TableHead className="text-slate-300">District</TableHead>
                  <TableHead className="text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-300">Explanation</TableHead>
                  <TableHead className="text-slate-300">Attempts</TableHead>
                  <TableHead className="text-slate-300">Attachment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {updates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-slate-400 py-6">
                      {loading ? "Loading updates..." : "No updates found for the selected filters."}
                    </TableCell>
                  </TableRow>
                )}
                {updates.map((u) => (
                  <TableRow key={u.id} className="border-slate-800">
                    <TableCell className="text-slate-100 text-sm">
                      {u.update_date}
                    </TableCell>
                    <TableCell className="text-slate-200 text-xs">
                      {u.project_title || "—"}
                    </TableCell>
                    <TableCell className="text-slate-100 text-sm">
                      {u.volunteer_name}
                    </TableCell>
                    <TableCell className="text-slate-200 text-xs">
                      {(u.volunteer_dept || "—") + " / " + (u.volunteer_year || "—")}
                    </TableCell>
                    <TableCell className="text-slate-100 text-sm">
                      {u.mentee_name}
                    </TableCell>
                    <TableCell className="text-slate-200 text-xs">
                      {u.mentee_year || "—"}
                    </TableCell>
                    <TableCell className="text-slate-200 text-xs">
                      {u.mentee_school || "—"}
                    </TableCell>
                    <TableCell className="text-slate-200 text-xs">
                      {u.mentee_parent_contact || "—"}
                    </TableCell>
                    <TableCell className="text-slate-200 text-xs">
                      {u.mentee_address || "—"}
                    </TableCell>
                    <TableCell className="text-slate-200 text-xs">
                      {u.mentee_notes || "—"}
                    </TableCell>
                    <TableCell className="text-slate-100 text-xs">
                      {u.status === "CALL_DONE" && "Call Done"}
                      {u.status === "NOT_CALLED" && "Not Called"}
                      {u.status === "STUDENT_NOT_PICKED" && "Student Not Picked"}
                      {u.status === "CALL_PENDING" && "Call Pending"}
                    </TableCell>
                    <TableCell className="text-slate-200 text-xs max-w-xs">
                      {u.explanation}
                    </TableCell>
                    <TableCell className="text-slate-100 text-center text-xs">
                      {u.attempts ?? "—"}
                    </TableCell>
                    <TableCell className="text-slate-100 text-xs">
                      {u.attachment_path ? (
                        <a
                          href={u.attachment_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
                </div>
              </TabsContent>
              <TabsContent value="attendance" className="mt-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-800">
                        <TableHead className="text-slate-300">Date</TableHead>
                        <TableHead className="text-slate-300">Project</TableHead>
                        <TableHead className="text-slate-300">Volunteer</TableHead>
                        <TableHead className="text-slate-300">Dept / Year</TableHead>
                        <TableHead className="text-slate-300">Mentee</TableHead>
                        <TableHead className="text-slate-300">Standard</TableHead>
                        <TableHead className="text-slate-300">School</TableHead>
                        <TableHead className="text-slate-300">Parent</TableHead>
                        <TableHead className="text-slate-300">Panchayat</TableHead>
                        <TableHead className="text-slate-300">District</TableHead>
                        <TableHead className="text-slate-300">Status</TableHead>
                        <TableHead className="text-slate-300">Notes</TableHead>
                        <TableHead className="text-slate-300">Call Recording</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceLoading ? (
                        <TableRow>
                          <TableCell colSpan={13} className="text-center text-slate-400 py-8">
                            Loading attendance records...
                          </TableCell>
                        </TableRow>
                      ) : attendance.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={13} className="text-center text-slate-400 py-8">
                            No attendance records found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        attendance.map((a) => (
                          <TableRow key={a.id} className="border-slate-800">
                            <TableCell className="text-slate-100 text-xs">{a.attendance_date}</TableCell>
                            <TableCell className="text-slate-100 text-xs">{a.project_title || "—"}</TableCell>
                            <TableCell className="text-slate-100 text-xs">{a.volunteer_name || "—"}</TableCell>
                            <TableCell className="text-slate-100 text-xs">
                              {(a.volunteer_dept || "—") + " / " + (a.volunteer_year || "—")}
                            </TableCell>
                            <TableCell className="text-slate-100 text-xs">{a.mentee_name || "—"}</TableCell>
                            <TableCell className="text-slate-100 text-xs">{a.mentee_year || "—"}</TableCell>
                            <TableCell className="text-slate-100 text-xs">{a.mentee_school || "—"}</TableCell>
                            <TableCell className="text-slate-100 text-xs">{a.mentee_parent_contact || "—"}</TableCell>
                            <TableCell className="text-slate-100 text-xs">{a.mentee_address || "—"}</TableCell>
                            <TableCell className="text-slate-100 text-xs">{a.mentee_notes || "—"}</TableCell>
                            <TableCell className="text-slate-100 text-xs">
                              {a.status === "PRESENT" && "Class Taken"}
                              {a.status === "ABSENT" && "Not Taken"}
                              {a.status === "FOLLOW_UP" && "Follow Up"}
                              {a.status === "NOT_REACHABLE" && "Not Reachable"}
                            </TableCell>
                            <TableCell className="text-slate-200 text-xs max-w-xs">{a.notes || "—"}</TableCell>
                            <TableCell className="text-slate-100 text-xs">
                              {a.call_recording_path ? (
                                <a
                                  href={a.call_recording_path}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-400 hover:underline"
                                >
                                  View Recording
                                </a>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default PhoneMentoringAdmin;


