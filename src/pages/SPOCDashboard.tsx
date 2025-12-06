// SPOC dashboard removed. Keep a small redirect to avoid broken routes/imports.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SPOCDashboard = () => {
  const navigate = useNavigate();
  useEffect(() => {
    // Redirect to main landing/dashboard
    navigate("/");
  }, [navigate]);
  return null;
};

export default SPOCDashboard;

