import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, ArrowLeft, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { auth } from "@/lib/auth";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { api } from "@/lib/api";

const PREDEFINED_TOPICS = [
  'Welcome & Opening Remarks',
  'Agenda Discussion',
  'Action Items Review',
  'Feedback & Suggestions',
  'Event Planning',
  'Budget Discussion',
  'Team Updates',
  'Project Status',
  'Volunteer Recognition',
  'Next Meeting Plans',
  'General Discussion',
  'Closing Remarks'
];

const MinutesOfMeeting = () => {
  const navigate = useNavigate();
  const { permissions, loading: permLoading } = usePermissions();
  const { id } = useParams<{ id?: string }>();

  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState<string>(new Date().toTimeString().slice(0, 5));
  const [venue, setVenue] = useState<string>('');
  const [years, setYears] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [discussionPoints, setDiscussionPoints] = useState<{ title: string, details: string }[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<{ userId: string, name: string, department: string, year: string }[]>([]);
  const [userOptions, setUserOptions] = useState<any[]>([]);
  const [tempUserIds, setTempUserIds] = useState<string[]>([]);
  const [selectedAttendees, setSelectedAttendees] = useState<boolean[]>([]);
  const [selectedPoints, setSelectedPoints] = useState<boolean[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string>('');

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate('/login');
      return;
    }
    const user = auth.getUser();
    const isAdmin = user?.role === 'admin';
    const isOB = user?.role === 'office_bearer';
    if (!isAdmin && !isOB) {
      toast.error('You are not authorized to view meeting minutes');
      navigate('/');
      return;
    }

    // load list of users for attendance dropdown
    api.getUsers().then(resp => {
      if (resp.success && resp.users) {
        setUserOptions(resp.users);
      }
    }).catch(console.error);

    // if we have a valid id param, load existing MOM
    if (id && !id.includes(':')) {
      loadMom(id);
    }
  }, [navigate, id]);

  const addDiscussionPoint = (topicTitle?: string) => {
    setDiscussionPoints([...discussionPoints, { title: topicTitle || '', details: '' }]);
    setSelectedPoints([...selectedPoints, true]);
    setSelectedTopic(''); // Reset dropdown
  };

  const loadMom = async (momId: string) => {
    try {
      setLoadingData(true);
      const resp = await api.get(`/mom/${momId}`);
      if (resp.success && resp.mom) {
        const m = resp.mom;
        if (m.date) setDate(m.date.split('T')[0]);
        if (m.time) setTime(m.time);
        if (m.venue) setVenue(m.venue);
        if (m.years) setYears(m.years.split(','));
        if (m.departments) setDepartments(m.departments.split(','));
        if (resp.attendance) {
          // load attendance entries if present
          const attendees = (resp.attendance || []).map((a: any) => ({
            userId: a.user_id?.toString() || '',
            name: a.name || '',
            department: a.department || '',
            year: a.year || ''
          }));
          setAttendanceRows(attendees);
          setSelectedAttendees(attendees.map(() => true));
        }
        if (resp.points) {
          const points = resp.points.map((p: any) => ({ title: p.title || '', details: Array.isArray(p.discussion) ? p.discussion.join('\n') : p.discussion || '' }));
          setDiscussionPoints(points);
          setSelectedPoints(points.map(() => true));
        }
      }
    } catch (e: any) {
      console.error('Failed to load MOM', e);
      toast.error('Unable to load meeting data');
    } finally {
      setLoadingData(false);
    }
  };

  const handlePointChange = (idx: number, field: keyof typeof discussionPoints[0], value: string) => {
    const newPoints = [...discussionPoints];
    newPoints[idx][field] = value;
    setDiscussionPoints(newPoints);
  };

  const addAttendanceRow = () => {
    if (tempUserIds.length === 0) {
      toast.error('Please select at least one attendee');
      return;
    }

    const newRows = [];
    const newSelected = [];

    for (const userId of tempUserIds) {
      // Prevent duplicate attendees
      if (attendanceRows.some(row => row.userId === userId)) {
        continue;
      }

      // Get user details from userOptions
      const user = userOptions.find(u => u.id.toString() === userId);
      if (!user) continue;

      // Add the row with name, year, department populated
      newRows.push({
        userId: userId,
        name: user.name || user.email || '',
        department: user.dept || user.profile?.department || '',
        year: user.year || user.profile?.year || ''
      });
      newSelected.push(true);
    }

    if (newRows.length === 0) {
      toast.error('All selected attendees have already been added');
      return;
    }

    setAttendanceRows([...attendanceRows, ...newRows]);
    setSelectedAttendees([...selectedAttendees, ...newSelected]);
    setTempUserIds([]);
    toast.success(`${newRows.length} attendee(s) added`);
  };

  const removeAttendanceRow = (idx: number) => {
    const rows = [...attendanceRows];
    rows.splice(idx, 1);
    setAttendanceRows(rows);
    const selected = [...selectedAttendees];
    selected.splice(idx, 1);
    setSelectedAttendees(selected);
  };

  const saveDraft = async () => {
    if (saving) return;
    setSaving(true);

    // Only include selected attendees and points
    const selectedAttendanceRows = attendanceRows.filter((_, idx) => selectedAttendees[idx]);
    const selectedDiscussionPoints = discussionPoints.filter((_, idx) => selectedPoints[idx]);

    console.log(`💾 Saving draft - ${selectedAttendanceRows.length} attendees, ${selectedDiscussionPoints.length} discussion points`);

    // Filter out empty discussion items and clean up whitespace
    const filteredPoints = selectedDiscussionPoints
      .map(p => ({
        title: p.title?.trim() || '',
        discussion: p.details
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0) // Remove empty lines
      }))
      // Only keep points that have either a title or discussion content
      .filter(p => p.title || p.discussion.length > 0);

    // Filter out empty attendance entries
    const filteredAttendance = selectedAttendanceRows
      .filter(r => r.userId || r.name)
      .map(r => ({ userId: r.userId, name: r.name, department: r.department, year: r.year }));

    const payload: any = {
      date,
      time,
      venue,
      attendance: filteredAttendance,
      points: filteredPoints,
      status: 'draft'
    };

    console.log(`📦 Payload - ${filteredAttendance.length} attendance, ${filteredPoints.length} points`);
    try {
      if (id) {
        const resp = await api.put(`/mom/update/${id}`, payload);
        if (!resp.success) {
          toast.error(resp.message || 'Update failed');
        } else {
          toast.success('Draft updated');
        }
      } else {
        const resp = await api.post('/mom/create', payload);
        if (resp.success && resp.id) {
          toast.success('Draft saved');
          navigate(`/mom/${resp.id}`);
        } else {
          toast.error(resp.message || 'Failed to save draft');
        }
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const generateReport = async () => {
    console.log('generateReport called, id=', id, 'saving=', saving);

    // Only include selected attendees and points
    const selectedAttendanceRows = attendanceRows.filter((_, idx) => selectedAttendees[idx]);
    const selectedDiscussionPoints = discussionPoints.filter((_, idx) => selectedPoints[idx]);

    // if no existing record, create one directly (skip saveDraft nav logic)
    if (!id) {
      if (saving) {
        toast.error('Please wait, saving in progress');
        return;
      }
      setSaving(true);
      
      try {
        // open a placeholder window now to avoid popup blocking
        const win = window.open('', '_blank');
        console.log('opened placeholder', win);
        if (!win) {
          toast.error('Popup blocked – please allow popups to download the report');
          setSaving(false);
          return;
        }

        // Filter out empty discussion items and clean up whitespace
        const filteredPoints = selectedDiscussionPoints
          .map(p => ({
            title: p.title?.trim() || '',
            discussion: p.details
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0) // Remove empty lines
          }))
          // Only keep points that have either a title or discussion content
          .filter(p => p.title || p.discussion.length > 0);

        // Filter out empty attendance entries
        const filteredAttendance = selectedAttendanceRows
          .filter(r => r.userId || r.name)
          .map(r => ({ userId: r.userId, name: r.name, department: r.department, year: r.year }));

        const payload: any = {
          date,
          time,
          venue,
          attendance: filteredAttendance,
          points: filteredPoints,
          status: 'draft'
        };

        console.log(`📊 Generate report - ${filteredAttendance.length} attendance, ${filteredPoints.length} points`);
        
        const resp = await api.post('/mom/create', payload);
        console.log('create response', resp);
        
        if (resp.success && resp.id) {
          toast.success('Report generated! Opening PDF...');
          // include auth token so download endpoint can authenticate
          const token = auth.getToken();
          let url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/mom/download/pdf/${resp.id}`;
          if (token) url += `?token=${encodeURIComponent(token)}`;
          console.log('opening PDF at', url);
          
          win.location.href = url;
          
          // Navigate to page after 1 second
          setTimeout(() => {
            navigate(`/mom/${resp.id}`);
          }, 1000);
        } else {
          toast.error(resp.message || 'Failed to generate report');
          if (win) win.close();
        }
      } catch (e: any) {
        console.error('Generate error:', e);
        toast.error(e.message || 'Failed to generate report');
        // Close the blank window if error
        const win = document.activeElement?.parentElement;
        if (win) {
          try {
            (win as any).close?.();
          } catch (err) {
            console.log('Could not close popup');
          }
        }
      } finally {
        setSaving(false);
      }
      return;
    }

    // if we somehow still don't have an id, bail
    if (!id) {
      toast.error('Cannot generate report: no record id');
      return;
    }

    // append token so file endpoint sees it
    const token = auth.getToken();
    let url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/mom/download/pdf/${id}`;
    if (token) url += `?token=${encodeURIComponent(token)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 w-full overflow-x-hidden">
        <div className="w-full p-6 space-y-8">
          {/* Date, Time and Venue row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Date</Label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Time</Label>
              <Input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Venue</Label>
              <Input
                type="text"
                placeholder="e.g. Seminar Hall"
                value={venue}
                onChange={e => setVenue(e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          {/* Attendance Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Attendance</Label>

            {/* Multi-select for attendees */}
            <div className="flex gap-3 items-end">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-11"
                  >
                    <span>
                      {tempUserIds.length > 0
                        ? `${tempUserIds.length} selected`
                        : 'Select attendees...'}
                    </span>
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-3" align="start">
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {userOptions.map(u => (
                        <label key={u.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer">
                          <Checkbox
                            checked={tempUserIds.includes(u.id.toString())}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setTempUserIds([...tempUserIds, u.id.toString()]);
                              } else {
                                setTempUserIds(tempUserIds.filter(id => id !== u.id.toString()));
                              }
                            }}
                          />
                          <div className="text-sm flex-1">
                            <p className="font-medium">{u.name || u.email}</p>
                            {(u.dept || u.profile?.department) && (
                              <p className="text-xs text-muted-foreground">{u.dept || u.profile?.department} {u.year ? `· ${u.year}` : ''}</p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              <Button
                onClick={addAttendanceRow}
                className="gap-2 whitespace-nowrap h-11"
              >
                + Add
              </Button>
            </div>

            {/* Attendance Table */}
            {attendanceRows.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/60 border-b">
                      <th className="w-10 px-3 py-2 text-center font-semibold text-muted-foreground">#</th>
                      <th className="w-8 px-2 py-2 text-center font-semibold text-muted-foreground"></th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Department</th>
                      <th className="w-28 px-3 py-2 text-left font-semibold text-muted-foreground">Year</th>
                      <th className="w-10 px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`border-b last:border-0 transition-colors ${selectedAttendees[idx] === false
                            ? 'opacity-40 bg-muted/20'
                            : idx % 2 === 0 ? 'bg-card' : 'bg-muted/20'
                          }`}
                      >
                        <td className="px-3 py-2 text-center text-muted-foreground font-mono text-xs">{idx + 1}</td>
                        <td className="px-2 py-2 text-center">
                          <Checkbox
                            checked={selectedAttendees[idx] ?? true}
                            onCheckedChange={(checked) => {
                              const newSelected = [...selectedAttendees];
                              newSelected[idx] = checked === true;
                              setSelectedAttendees(newSelected);
                            }}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium">{row.name}</td>
                        <td className="px-2 py-1.5">
                          <Input
                            value={row.department}
                            onChange={e => {
                              const rows = [...attendanceRows];
                              rows[idx] = { ...rows[idx], department: e.target.value };
                              setAttendanceRows(rows);
                            }}
                            placeholder="e.g. CSE"
                            className="h-7 text-xs px-2 border-muted bg-transparent focus:bg-background"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            value={row.year}
                            onChange={e => {
                              const rows = [...attendanceRows];
                              rows[idx] = { ...rows[idx], year: e.target.value };
                              setAttendanceRows(rows);
                            }}
                            placeholder="e.g. III"
                            className="h-7 text-xs px-2 border-muted bg-transparent focus:bg-background"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button
                            onClick={() => removeAttendanceRow(idx)}
                            className="text-destructive hover:text-destructive/80 text-base leading-none"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {attendanceRows.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No attendees added yet</p>
            )}
          </div>

          {/* Discussion Points Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Discussion Points</Label>
            
            {/* Add Point with Dropdown */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select a predefined topic or create custom..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PREDEFINED_TOPICS.map(topic => (
                      <SelectItem key={topic} value={topic}>
                        {topic}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => {
                  if (selectedTopic) {
                    addDiscussionPoint(selectedTopic);
                  } else {
                    addDiscussionPoint();
                  }
                }}
                className="gap-2 whitespace-nowrap h-11"
              >
                + Add Point
              </Button>
            </div>

            <div className="space-y-3">
              {discussionPoints.map((pt, idx) => (
                <div key={idx} className="space-y-2 p-4 rounded-lg border bg-muted/30">
                  <div className="flex gap-3 items-start">
                    <Checkbox
                      checked={selectedPoints[idx] ?? true}
                      onCheckedChange={(checked) => {
                        const newSelected = [...selectedPoints];
                        newSelected[idx] = checked === true;
                        setSelectedPoints(newSelected);
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Input
                        placeholder="Topic Title"
                        value={pt.title}
                        onChange={e => handlePointChange(idx, 'title', e.target.value)}
                        className="font-medium"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const pts = [...discussionPoints];
                        pts.splice(idx, 1);
                        setDiscussionPoints(pts);
                        const selected = [...selectedPoints];
                        selected.splice(idx, 1);
                        setSelectedPoints(selected);
                      }}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      ✕
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Discussion Details"
                    value={pt.details}
                    onChange={e => handlePointChange(idx, 'details', e.target.value)}
                    className="min-h-24"
                  />
                </div>
              ))}
            </div>
            
            {/* Old button removed - keep the section structure */}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 justify-end pt-6 border-t flex-wrap">
            <Button
              variant="outline"
              onClick={saveDraft}
              disabled={saving || loadingData}
            >
              {saving ? '⏳ Saving...' : '💾 Save Draft'}
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                const hasAttendees = attendanceRows.some((_, idx) => selectedAttendees[idx] !== false);
                const hasPoints = discussionPoints.some((_, idx) => selectedPoints[idx] !== false);
                
                if (!hasAttendees) {
                  toast.error('Please add at least one attendee');
                  return;
                }
                if (!hasPoints) {
                  toast.error('Please add at least one discussion point');
                  return;
                }
                generateReport();
              }}
              disabled={saving || loadingData}
            >
              {saving ? '⏳ Generating...' : id ? '🔄 Refresh Report' : '📄 Create & Generate'}
            </Button>
            
            {/* Download Buttons - always visible and active */}
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  if (!id) {
                    toast.error('Please save/generate the report first to enable PDF downloads');
                    return;
                  }
                  setSaving(true);
                  const token = auth.getToken();
                  let url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/mom/download/pdf/${id}`;
                  if (token) url += `?token=${encodeURIComponent(token)}`;
                  window.open(url, '_blank');
                  toast.success('📥 PDF downloading...');
                  setTimeout(() => setSaving(false), 2000);
                }}
                disabled={saving}
                className="gap-2 bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300"
              >
                {saving ? '⏳' : '📄'} {saving ? 'Downloading...' : 'Download PDF'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (!id) {
                    toast.error('Please save/generate the report first to enable DOCX downloads');
                    return;
                  }
                  setSaving(true);
                  const token = auth.getToken();
                  let url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/mom/download/docx/${id}`;
                  if (token) url += `?token=${encodeURIComponent(token)}`;
                  window.open(url, '_blank');
                  toast.success('📥 DOCX downloading...');
                  setTimeout(() => setSaving(false), 2000);
                }}
                disabled={saving}
                className="gap-2 bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300"
              >
                {saving ? '⏳' : '📋'} {saving ? 'Downloading...' : 'Download DOCX'}
              </Button>
            </>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MinutesOfMeeting;
