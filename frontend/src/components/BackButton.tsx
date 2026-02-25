import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";

interface BackButtonProps {
  to?: string;
  label?: string;
  className?: string;
}

export const BackButton = ({ to, label = "Back", className = "" }: BackButtonProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (to) {
      navigate(to);
    } else {
      // Navigate to appropriate dashboard based on user role
      const user = auth.getUser();
      if (user?.role === 'admin') {
        navigate('/admin');
      } else if (user?.role === 'office_bearer') {
        navigate('/office-bearer');
      } else if (user?.role === 'student') {
        navigate('/student');
      } else {
        navigate(-1); // Fallback to browser history
      }
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleBack}
      className={`h-9 px-4 gap-2 rounded-lg mr-2 transition-all duration-200 text-foreground dark:text-white border-border dark:border-white/40 hover:bg-foreground/5 dark:hover:bg-white/20 hover:border-foreground/70 dark:hover:border-white/60 font-medium ${className}`}
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </Button>
  );
};