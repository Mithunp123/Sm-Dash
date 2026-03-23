import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Loader2, Calendar } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const FinanceHome = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }

    const role = auth.getRole();
    if (role === "volunteer") {
      toast.error("Volunteers do not have access to finance modules");
      navigate("/home");
      return;
    }

    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const res = await api.getEvents();
      if (res.success) {
        setEvents(res.events || []);
      } else {
        setEvents([]);
      }
    } catch (err: any) {
      toast.error("Failed to load events");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openFinanceForEvent = (eventId: number) => {
    if (auth.hasRole("admin")) {
      navigate(`/admin/events/${eventId}/funds`);
    } else {
      navigate(`/office-bearer/events/${eventId}/funds`);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-background">
      <DeveloperCredit />
      <main className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-4xl font-bold">Finance</h1>
          <p className="text-muted-foreground">
            Select an event to manage Fund Raising and Bills / Expenses.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Event List
              </CardTitle>
              <CardDescription>Choose the event for finance tracking.</CardDescription>
            </div>
            {auth.hasRole("admin") && (
              <Button variant="outline" onClick={() => navigate("/admin/finance-settings")}>
                Finance Settings
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-muted-foreground">No events found.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{e.title}</span>
                          </div>
                        </TableCell>
                        <TableCell>{e.date ? new Date(e.date).toLocaleDateString() : "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{e.year || "-"}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => openFinanceForEvent(e.id)}>
                            Manage
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default FinanceHome;

