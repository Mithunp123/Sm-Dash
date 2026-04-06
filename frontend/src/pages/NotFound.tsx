import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, ArrowLeft, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoHome = () => {
    navigate("/");
  };

  const handleClose = () => {
    navigate(-1);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-muted to-muted/80 relative overflow-hidden">
      {/* Close Button */}
      <Button
        onClick={handleClose}
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 hover:bg-red-100 hover:text-red-600 transition-colors"
      >
        <X className="h-5 w-5" />
      </Button>

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -top-40 -left-40 animate-blob"></div>
        <div className="absolute w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -bottom-40 -right-40 animate-blob animation-delay-2000"></div>
      </div>

      {/* Main Content */}
      <div className="text-center relative z-10 px-4">
        <div className="mb-8">
          <h1 className="mb-4 text-7xl font-bold text-gray-900">404</h1>
          <p className="mb-2 text-2xl font-semibold text-gray-700">Page Not Found</p>
          <p className="text-gray-600 text-base mb-8">
            Sorry, the page you're looking for doesn't exist or has been moved.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Requested path: <code className="bg-gray-100 px-2 py-1 rounded">{location.pathname}</code>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={handleGoBack}
            variant="outline"
            size="lg"
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
          <Button
            onClick={handleGoHome}
            size="lg"
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            Return to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
