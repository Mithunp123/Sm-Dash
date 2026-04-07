import { cn } from "@/lib/utils";
import { Phone, Mail, MapPin, Instagram, Facebook, Linkedin, Youtube, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import brandLogo from '../../../Images/Brand_logo.png';

const Footer = ({ className }: { className?: string }) => {
  return (
    <footer className={cn("bg-[#020617] text-white pt-16 pb-8 mt-auto border-t border-slate-800", className)}>
      <div className="w-full px-6 md:px-12 lg:px-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Col 1: Institution Details */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center p-1 shadow-lg shadow-white/5 shrink-0">
                <img
                  src="/images/Brand_logo.png"
                  alt="KSRCT Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => (e.target as any).style.display = 'none'}
                />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-lg leading-snug">K.S. Rangasamy<br />College of Technology</h3>
                <p className="text-xs text-primary font-bold uppercase tracking-widest">Autonomous</p>
                <p className="text-[10px] text-slate-400 leading-relaxed">Approved by AICTE & Affiliated to Anna University</p>
              </div>
            </div>
          </div>

          {/* Col 2: Address */}
 <div className="space-y-4">
  <h3 className="text-lg font-semibold text-flex items-center gap-2">
    <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
    Address
  </h3>

  <div className="flex items-start gap-3 pt-2">
    
    {/* Icon */}
    <div className="p-2 rounded-lg bg-slate-800 text-blue-500">
      <MapPin className="w-5 h-5" />
    </div>

    {/* Address Text */}
    <p className="text-sm leading-relaxed text">
      KSR Kalvi Nagar, Tiruchengode - 637 215,<br />
      Namakkal District, Tamil Nadu, India.
    </p>

  </div>
</div>

          {/* Col 3: SM Volunteers Identity */}
          <div className="lg:border-l lg:border-r border-slate-800/50 lg:px-8 space-y-6">
            <div className="flex items-center gap-4">
              <img
                src="/images/Picsart_23-05-18_16-47-20-287-removebg-preview.png"
                alt="SM Volunteers"
                className="h-14 w-auto object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]"
              />
              <div>
                <h3 className="font-black text-2xl tracking-tighter text">SM <span className="text">VOLUNTEERS</span></h3>
                <p className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded inline-block font-bold uppercase tracking-wider">Est. 2021</p>
              </div>
            </div>
            <div className="relative p-6 bg-slate-900/50 rounded-2xl border border-slate-800">
              <span className="absolute top-4 left-4 text-4xl text-slate-700 font-serif leading-none">"</span>
              <p className="text-sm text-slate-300 italic text-center relative z-10 font-medium">
                To build the ministry of socially responsible volunteers who can serve society with a passion.
              </p>
              <span className="absolute bottom-4 right-4 text-4xl text-slate-700 font-serif leading-none rotate-180">"</span>
            </div>
          </div>

          {/* Col 3: Connect & Actions */}
          <div className="space-y-6 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font white text mb-6 flex items-center gap-2">
                <span className="w-1 h-6 bg-primary rounded-full"></span>
                Connect With Us
              </h3>
              <div className="flex flex-wrap gap-3">
                {[
                  { Icon: Instagram, href: "https://www.instagram.com/ksrct1994/", color: "hover:bg-pink-600" },
                  { Icon: Facebook, href: "https://www.facebook.com/ksrct1994/", color: "hover:bg-blue-600" },
                  { Icon: Linkedin, href: "https://in.linkedin.com/school/ksrct1994/", color: "hover:bg-blue-700" },
                  { Icon: Youtube, href: "https://www.youtube.com/@ksrct1994", color: "hover:bg-red-600" },
                  { Icon: Twitter, href: "https://x.com/ksrct1994", color: "hover:bg-sky-500" },
                ].map(({ Icon, href, color }, i) => (
                  <a
                    key={i}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 ${color} hover:text-white hover:border-transparent transition-all duration-300 hover:scale-110 shadow-lg`}
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                ))}
              </div>
            </div>


          </div>
        </div>

        {/* Footer Bottom */}
        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-500">
          <p>© {new Date().getFullYear()} K.S.Rangasamy College of Technology. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className="text-slate-500">Privacy Policy</span>
            <span className="text-slate-500">Terms of Service</span>
            <p className="flex items-center gap-1 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
              Dev by <span className="text-primary font-bold">Narendhar D</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
