import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import DeveloperCredit from "@/components/DeveloperCredit";
import { BackButton } from "@/components/BackButton";
import { buildImageUrl } from "@/utils/imageUtils";

interface Event {
  id: number;
  title: string;
  description: string;
  date: string;
  year: string;
  image_url?: string;
  registration_id?: number;
  registration_type?: string;
  registration_status?: string;
  registration_at?: string;
  current_volunteers?: number;
  max_volunteers?: number;
  volunteer_registration_deadline?: string;
  // Properties found in usage
  event_id?: number;
  status?: string;
}

const StudentEvents = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<number | null>(null);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    regNo: "",
    year: "",
    department: "",
    phone: ""
  });

  // Pre-fill user data if available from auth
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const user = auth.getUser();
        if (!user || !user.id) return;

        const res = await api.getProfile(user.id);
        if (res.success && res.profile) {
          const p = res.profile;
          setFormData(prev => ({
            ...prev,
            name: p.name || prev.name,
            regNo: p.register_no || "",
            year: p.year || "",
            department: p.dept || "",
            phone: p.phone || ""
          }));
        }
      } catch (e) {
        console.error("Failed to fetch profile for pre-fill", e);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }

    const userRole = auth.getRole();
    // Allow student, office_bearer, and admin roles
    if (!['student', 'office_bearer', 'admin'].includes(userRole || '')) {
      navigate("/login");
      return;
    }

    loadData();
  }, [navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      // For students: get active events and their registrations
      const [eventsRes, registrationsRes] = await Promise.all([
        api.getActiveEvents(),
        api.getMyEventRegistrations()
      ]);

      if (eventsRes.success) {
        setEvents(eventsRes.events || []);
      }

      if (registrationsRes.success) {
        setMyRegistrations(registrationsRes.registrations || []);
      }
    } catch (error: any) {
      console.error('Failed to load events:', error);
      toast.error("Failed to load events: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const openRegisterDialog = (event: Event) => {
    setSelectedEvent(event);
    setShowRegisterDialog(true);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    if (!formData.name || !formData.regNo || !formData.year || !formData.department || !formData.phone) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      setRegistering(selectedEvent.id);
      const notes = JSON.stringify({
        name: formData.name,
        regNo: formData.regNo,
        year: formData.year,
        department: formData.department,
        phone: formData.phone
      });

      const response = await api.registerForEvent(selectedEvent.id, 'volunteer', notes);

      if (response.success) {
        toast.success(`Successfully registered for "${selectedEvent.title}"!`);
        setShowRegisterDialog(false);
        await loadData();
      } else {
        toast.error(response.message || "Failed to register for event");
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || "Failed to register for event");
    } finally {
      setRegistering(null);
    }
  };

  const isRegistered = (eventId: number) => {
    // Check if the event object itself has a registration_id (from active events list)
    // or if the eventId exists in the myRegistrations list
    return events.some(e => e.id === eventId && e.registration_id) ||
      myRegistrations.some(reg => reg.event_id === eventId);
  };

  const getRegistrationStatus = (eventId: number) => {
    // First check in events array (from active events endpoint)
    const eventWithReg = events.find(e => e.id === eventId && e.registration_id);
    if (eventWithReg) {
      return eventWithReg.registration_status || eventWithReg.status || null;
    }
    // Then check in registrations array
    const registration = myRegistrations.find(reg => (reg.event_id || reg.id) === eventId);
    return registration?.status || registration?.registration_status || null;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const isEventUpcoming = (dateString: string) => {
    try {
      const eventDate = new Date(dateString);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return eventDate >= today;
    } catch {
      return true;
    }
  };

  const isDeadlinePassed = (deadline?: string) => {
    if (!deadline) return false;
    return new Date() > new Date(deadline);
  };

  const isFull = (event: Event) => {
    return !!(event.max_volunteers && (event.current_volunteers || 0) >= event.max_volunteers);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading events...</p>
        </div>
      </div>
    );
  }

  const upcomingEvents = events.filter(e => isEventUpcoming(e.date));
  const pastEvents = events.filter(e => !isEventUpcoming(e.date));

  return (
    <div className="min-h-screen flex flex-col">
      <DeveloperCredit />

      <div className="flex-1 p-6">
        <div className="w-full px-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-4 mb-6">

            <div>
              <h1 className="text-3xl font-bold text-foreground">Events</h1>
              <p className="text-muted-foreground mt-1">
                {['student', 'office_bearer'].includes(auth.getRole() || '')
                  ? "Register for upcoming events and volunteer opportunities"
                  : "View and manage assigned events"}
              </p>
            </div>
          </div>

          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">Upcoming Events</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingEvents.map((event) => {
                  const registered = isRegistered(event.id);
                  const status = getRegistrationStatus(event.id);
                  const deadlinePassed = isDeadlinePassed(event.volunteer_registration_deadline);
                  const registrationFull = isFull(event);
                  const canRegister = !registered && !deadlinePassed && !registrationFull && ['student', 'office_bearer'].includes(auth.getRole() || '');

                  return (
                    <Card
                      key={event.id}
                      className={`overflow-hidden hover:shadow-lg transition-all border-border/50 group ${canRegister ? 'cursor-pointer hover:border-primary/50' : ''}`}
                      onClick={() => {
                        if (canRegister) {
                          openRegisterDialog(event);
                        }
                      }}
                    >
                      {event.image_url && (
                        <div className="h-48 overflow-hidden relative">
                          <img
                            src={buildImageUrl(event.image_url) || '/Images/Brand_logo.png'}
                            alt={event.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          {canRegister && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-foreground font-bold px-4 py-2 border-2 border-white rounded-full">Register Now</span>
                            </div>
                          )}
                        </div>
                      )}
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-xl group-hover:text-primary transition-colors">{event.title}</CardTitle>
                          {registered && (
                            <Badge variant="default" className="flex-shrink-0 bg-green-600 hover:bg-green-700">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Registered
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="line-clamp-2 mt-2">
                          {event.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="w-4 h-4 text-primary" />
                              <span>{formatDate(event.date)}</span>
                            </div>
                            {event.max_volunteers ? (
                              <div className={`font-medium ${registrationFull ? 'text-destructive' : 'text-primary'}`}>
                                {event.current_volunteers || 0} / {event.max_volunteers} Spots
                              </div>
                            ) : null}
                          </div>

                          {registered && status && (
                            <div className="flex items-center gap-2 text-sm mt-2 p-2 bg-muted/50 rounded-lg">
                              <Clock className="w-4 h-4 text-primary" />
                              <span className="text-muted-foreground font-medium">
                                Status: <span className="capitalize text-foreground">{status}</span>
                              </span>
                            </div>
                          )}

                          {/* Only show button if NOT registered (or for admin view). If registered, the badge is enough, or show disabled button as visual confirmation */}
                          {['student', 'office_bearer'].includes(auth.getRole() || '') ? (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (canRegister) openRegisterDialog(event);
                              }}
                              disabled={registered || registering === event.id || deadlinePassed || registrationFull}
                              className={`w-full ${registered ? 'opacity-80' : ''}`}
                              variant={registered ? "secondary" : (deadlinePassed || registrationFull) ? "outline" : "default"}
                            >
                              {registering === event.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Registering...
                                </>
                              ) : registered ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Already Registered
                                </>
                              ) : deadlinePassed ? (
                                <>
                                  <Clock className="w-4 h-4 mr-2" />
                                  Registration Closed
                                </>
                              ) : registrationFull ? (
                                <>
                                  <AlertCircle className="w-4 h-4 mr-2" />
                                  Registration Full
                                </>
                              ) : (
                                <>
                                  <Users className="w-4 h-4 mr-2" />
                                  Register Now
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/admin/events/${event.id}`);
                              }}
                              className="w-full"
                              variant="outline"
                            >
                              <Users className="w-4 h-4 mr-2" />
                              View Registrations
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">Past Events</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pastEvents.map((event) => {
                  const registered = isRegistered(event.id);

                  return (
                    <Card key={event.id} className="opacity-75">
                      {event.image_url && (
                        <div className="h-48 overflow-hidden">
                          <img
                            src={buildImageUrl(event.image_url) || '/Images/Brand_logo.png'}
                            alt={event.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-xl">{event.title}</CardTitle>
                          {registered && (
                            <Badge variant="secondary">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Attended
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="line-clamp-2 mt-2">
                          {event.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(event.date)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {events.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No events available at the moment.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Check back later for upcoming events!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Registration Dialog */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Event Registration</DialogTitle>
            <DialogDescription>
              Please fill in your details to register for <span className="font-semibold text-primary">{selectedEvent?.title}</span>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegisterSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter your full name"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="regNo">Register Number</Label>
                <Input
                  id="regNo"
                  value={formData.regNo}
                  onChange={(e) => setFormData({ ...formData, regNo: e.target.value.toUpperCase() })}
                  placeholder="e.g. 737..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Select value={formData.year} onValueChange={(val) => setFormData({ ...formData, year: val })}>
                  <SelectTrigger id="year">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="I">I Year</SelectItem>
                    <SelectItem value="II">II Year</SelectItem>
                    <SelectItem value="III">III Year</SelectItem>
                    <SelectItem value="IV">IV Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dept">Department</Label>
                <Input
                  id="dept"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value.toUpperCase() })}
                  placeholder="e.g. CSE"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  placeholder="10-digit number"
                  required
                  type="tel"
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setShowRegisterDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={registering === selectedEvent?.id}>
                {registering === selectedEvent?.id ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Registering...
                  </>
                ) : "Confirm Registration"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentEvents;

