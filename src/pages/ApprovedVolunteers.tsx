import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// This page was removed from the UI; keep a small redirect to the submissions page
// to avoid broken imports during incremental updates.
const ApprovedVolunteers = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/admin/volunteers', { replace: true });
  }, [navigate]);
  return null;
};

export default ApprovedVolunteers;
