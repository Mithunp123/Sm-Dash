import { cn } from "@/lib/utils";
import { Phone, Mail, MapPin, Instagram, Facebook, Linkedin, Youtube, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import brandLogo from '../../Images/Brand_logo.png';

const Footer = ({ className }: { className?: string }) => {
  return (
    <footer className={cn("bg-slate-950 text-white py-12 mt-auto border-t border-slate-800", className)}>
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1: College Info */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center overflow-hidden p-1">
                <img src="/images/Brand_logo.png" alt="KSRCT" className="w-full h-full object-contain" onError={(e) => (e.target as any).style.display = 'none'} />
                <span className="text-black font-bold text-[10px] absolute" style={{ display: 'none' }}>KSRCT</span>
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">K.S.Rangasamy<br />College of Technology</h3>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">Autonomous | Tiruchengode</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 pl-16">Excellence in Technical Education</p>
          </div>

          {/* Col 2: Student Coordinators */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-cyan-400 border-b border-cyan-400/30 pb-2 inline-block">Student Coordinators</h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-cyan-900/30 flex items-center justify-center text-cyan-400">
                  <Phone className="w-4 h-4" />
                </div>
                <span>9751673398 - Narendhar D</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-cyan-900/30 flex items-center justify-center text-cyan-400">
                  <Mail className="w-4 h-4" />
                </div>
                <a href="mailto:smvolunteers@ksrct.ac.in" className="hover:text-cyan-400 transition-colors">smvolunteers@ksrct.ac.in</a>
              </div>
            </div>
          </div>

          {/* Col 3: Address */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-cyan-400 border-b border-cyan-400/30 pb-2 inline-block">Address</h3>
            <div className="flex gap-3 text-sm text-slate-300">
              <div className="w-8 h-8 rounded bg-cyan-900/30 flex-shrink-0 flex items-center justify-center text-cyan-400 mt-1">
                <MapPin className="w-4 h-4" />
              </div>
              <p className="leading-relaxed">
                K.S.Rangasamy College of Technology,<br />
                KSR Kalvi Nagar, Tiruchengode - 637 215,<br />
                Tamil Nadu, India.
              </p>
            </div>
          </div>

          {/* Col 4: Connect */}
          <div className="flex flex-col items-center md:items-end gap-6">
            <div className="flex flex-col items-center md:items-end">
              <img src="/images/Picsart_23-05-18_16-47-20-287-removebg-preview.png" alt="SM Volunteers" className="h-20 w-auto mb-4 object-contain" />
              <div className="text-center md:text-right space-y-2 mb-4">
                <h3 className="font-black text-xl tracking-wider text-white">SM VOLUNTEERS</h3>
                <p className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed italic">
                  "To build the ministry of socially responsible volunteers who can serve society with a passion"
                </p>
              </div>
              <p className="text-xs font-bold text-cyan-400 uppercase tracking-widest mt-2">Connect With Us</p>
            </div>

            <div className="flex gap-3">
              {[
                { Icon: Instagram, href: "https://www.instagram.com/ksrct_official/" },
                { Icon: Facebook, href: "https://www.facebook.com/ksrctofficial/" },
                { Icon: Linkedin, href: "https://www.linkedin.com/school/ksrct/" },
                { Icon: Youtube, href: "https://www.youtube.com/@ksrct1994" },
                { Icon: Twitter, href: "https://twitter.com/ksrctofficial" },
              ].map(({ Icon, href }, i) => (
                <a
                  key={i}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 hover:bg-cyan-500 hover:text-white hover:border-cyan-500 transition-all duration-300"
                >
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>

            <Button variant="outline" className="rounded-full border-cyan-500/50 text-cyan-400 hover:bg-cyan-950 hover:text-cyan-300 hover:border-cyan-400 w-full md:w-auto">
              Give Feedback
            </Button>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} SM Volunteers – K.S.Rangasamy College of Technology</p>
          <p>Developed by <span className="font-semibold text-slate-400">Narendhar D</span></p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
