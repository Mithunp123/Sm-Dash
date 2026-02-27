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

const MinutesOfMeeting = () => {
  const navigate = useNavigate();
  const { permissions, loading: permLoading } = usePermissions();
  const { id } = useParams<{ id?: string }>();

  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState<string>(new Date().toTimeString().slice(0,5));
  const [years, setYears] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [discussionPoints, setDiscussionPoints] = useState<{title:string,details:string}[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<{userId:string, name:string, department:string, year:string}[]>([]);
  const [userOptions, setUserOptions] = useState<any[]>([]);
  const [tempUserIds, setTempUserIds] = useState<string[]>([]);
  const [selectedAttendees, setSelectedAttendees] = useState<boolean[]>([]);
  const [selectedPoints, setSelectedPoints] = useState<boolean[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

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

  const addDiscussionPoint = () => {
    setDiscussionPoints([...discussionPoints, { title: '', details: '' }]);
    setSelectedPoints([...selectedPoints, true]);
  };

  const loadMom = async (momId: string) => {
    try {
      setLoadingData(true);
      const resp = await api.get(`/mom/${momId}`);
      if (resp.success && resp.mom) {
        const m = resp.mom;
        if (m.date) setDate(m.date.split('T')[0]);
        if (m.time) setTime(m.time);
        if (m.years) setYears(m.years.split(','));
        if (m.departments) setDepartments(m.departments.split(','));
        if (resp.attendance) {
          // load attendance entries if present
          const attendees = (resp.attendance || []).map((a:any) => ({
            userId: a.user_id?.toString() || '',
            name: a.name || '',
            department: a.department || '',
            year: a.year || ''
          }));
          setAttendanceRows(attendees);
          setSelectedAttendees(attendees.map(() => true));
        }
        if (resp.points) {
          const points = resp.points.map((p:any) => ({ title: p.title || '', details: Array.isArray(p.discussion) ? p.discussion.join('\n') : p.discussion || '' }));
          setDiscussionPoints(points);
          setSelectedPoints(points.map(() => true));
        }
      }
    } catch (e:any) {
      console.error('Failed to load MOM', e);
      toast.error('Unable to load meeting data');
    } finally {
      setLoadingData(false);
    }
  };

  const handlePointChange = (idx:number, field:keyof typeof discussionPoints[0], value:string) => {
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
        department: user.profile?.department || '',
        year: user.profile?.year || ''
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

  const removeAttendanceRow = (idx:number) => {
    const rows = [...attendanceRows];
    rows.splice(idx,1);
    setAttendanceRows(rows);
    const selected = [...selectedAttendees];
    selected.splice(idx,1);
    setSelectedAttendees(selected);
  };

  const saveDraft = async () => {
    if (saving) return;
    setSaving(true);
    
    // Only include selected attendees and points
    const selectedAttendanceRows = attendanceRows.filter((_, idx) => selectedAttendees[idx]);
    const selectedDiscussionPoints = discussionPoints.filter((_, idx) => selectedPoints[idx]);
    
    const payload: any = {
      date,
      time,
      attendance: selectedAttendanceRows
        .filter(r => r.userId)
        .map(r => ({ userId: r.userId, name: r.name, department: r.department, year: r.year })),
      points: selectedDiscussionPoints.map(p => ({ title: p.title, discussion: p.details.split('\n') })),
      status: 'draft'
    };
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
    } catch (e:any) {
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
        toast('Please wait, saving in progress');
        return;
      }
      setSaving(true);
      // open a placeholder window now to avoid popup blocking
      const win = window.open('', '_blank');
      console.log('opened placeholder', win);
      if (!win) {
        toast('Popup blocked – please allow popups to download the report');
      }
      const payload: any = {
        date,
        time,
        attendance: selectedAttendanceRows
          .filter(r => r.userId)
          .map(r => ({ userId: r.userId, name: r.name, department: r.department, year: r.year })),
        points: selectedDiscussionPoints.map(p => ({ title: p.title, discussion: p.details.split('\n') })),
        status: 'draft'
      };
      try {
        const resp = await api.post('/mom/create', payload);
        console.log('create response', resp);
        if (resp.success && resp.id) {
          navigate(`/mom/${resp.id}`);
          // include auth token so download endpoint can authenticate
          const token = auth.getToken();
          let url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/mom/download/pdf/${resp.id}`;
          if (token) url += `?token=${encodeURIComponent(token)}`;
          console.log('navigating placeholder to', url);
          if (win) {
            win.location.href = url;
          } else {
            window.open(url, '_blank');
          }
        } else {
          toast.error(resp.message || 'Failed to save draft for report');
          if (win) win.close();
        }
      } catch (e:any) {
        console.error(e);
        toast.error('Failed to save draft for report');
        if (win) win.close();
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
          {/* Date and Time row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <PopoverContent className="w-full p-3" align="start">
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
                            {u.profile?.department && (
                              <p className="text-xs text-muted-foreground">{u.profile.department}</p>
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

            {/* List of added attendees as cards */}
            <div className="space-y-2">
              {attendanceRows.map((row, idx) => (
                <div key={idx} className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <Checkbox 
                        checked={selectedAttendees[idx] ?? true}
                        onCheckedChange={(checked) => {
                          const newSelected = [...selectedAttendees];
                          newSelected[idx] = checked;
                          setSelectedAttendees(newSelected);
                        }}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium text-sm">{row.name}</p>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          {row.year && <span>Year: {row.year}</span>}
                          {row.department && <span>Department: {row.department}</span>}
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => removeAttendanceRow(idx)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {attendanceRows.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No attendees added yet</p>
            )}
          </div>

          {/* Discussion Points Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Discussion Points</Label>
            <div className="space-y-3">
              {discussionPoints.map((pt, idx) => (
                <div key={idx} className="space-y-2 p-4 rounded-lg border bg-muted/30">
                  <div className="flex gap-3 items-start">
                    <Checkbox 
                      checked={selectedPoints[idx] ?? true}
                      onCheckedChange={(checked) => {
                        const newSelected = [...selectedPoints];
                        newSelected[idx] = checked;
                        setSelectedPoints(newSelected);
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Input 
                        placeholder="Topic Title" 
                        value={pt.title} 
                        onChange={e => handlePointChange(idx,'title',e.target.value)}
                        className="font-medium"
                      />
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        const pts = [...discussionPoints];
                        pts.splice(idx,1);
                        setDiscussionPoints(pts);
                        const selected = [...selectedPoints];
                        selected.splice(idx,1);
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
                    onChange={e => handlePointChange(idx,'details',e.target.value)}
                    className="min-h-24"
                  />
                </div>
              ))}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={addDiscussionPoint}
              className="gap-2"
            >
              + Add Point
            </Button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 justify-end pt-6 border-t">
            <Button 
              variant="outline"
              onClick={saveDraft} 
              disabled={saving || loadingData}
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={generateReport}
              disabled={saving || loadingData}
            >
              Generate Report
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MinutesOfMeeting;
