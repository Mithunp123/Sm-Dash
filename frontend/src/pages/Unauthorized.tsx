import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Unauthorized = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-white">
      <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center shadow-xl">
        <p className="text-xs uppercase tracking-[0.4em] text-rose-400 mb-3">Access Denied</p>
        <h1 className="text-3xl font-bold mb-3">Unauthorized</h1>
        <p className="text-slate-300 mb-6">You are not allowed to access this page. Please contact admin if you believe this is an error.</p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => navigate('/home')} className="px-5">Return Home</Button>
          <Button variant="outline" onClick={() => navigate('/login')} className="px-5">Login</Button>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
