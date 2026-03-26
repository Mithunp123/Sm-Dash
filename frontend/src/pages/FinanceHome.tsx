import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Loader2 } from "lucide-react";

const FinanceHome = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

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

    // Auto redirect to first event's funds management
    redirectToFirstEvent();
  }, []);

  const redirectToFirstEvent = async () => {
    try {
      setLoading(true);
      const res = await api.getEvents();
      if (res.success && res.events && res.events.length > 0) {
        const firstEventId = res.events[0].id;
        if (auth.hasRole("admin")) {
          navigate(`/admin/events/${firstEventId}/funds`);
        } else if (auth.hasRole("office_bearer")) {
          navigate(`/office-bearer/events/${firstEventId}/funds`);
        } else if (auth.hasRole("student")) {
          navigate(`/student/events/${firstEventId}/funds`);
        }
      } else {
        toast.error("No events found");
        navigate("/home");
      }
    } catch (err) {
      toast.error("Failed to load events");
      console.error(err);
      navigate("/home");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-background">
      <DeveloperCredit />
      <div className="w-full min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    </div>
  );
};

export default FinanceHome;

