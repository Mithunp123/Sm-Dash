// SPOC profile page has been deprecated/removed from the frontend.
// This file remains as a harmless redirect to avoid broken imports/links.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SPOCProfile = () => {
  const navigate = useNavigate();
  useEffect(() => {
    // Redirect users to the main dashboard (landing) since SPOC role is removed
    navigate("/");
  }, [navigate]);
  return null;
};

export default SPOCProfile;
