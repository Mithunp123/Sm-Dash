import { useState, useEffect, useCallback, useRef } from "react";
import principalImg from "../../../Images/Dr.R. Gopalakrishnan.jpg";
import palaniappanImg from "../../../Images/Dr.A.Palaniappan.jpg";
import mythiliImg from "../../../Images/MYTHILI MAM.png";
import rajkumarImg from "../../../Images/Rajkumar.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Heart, Award, ChevronRight, MapPin, Mail, Phone, Calendar, Sparkles, X, Activity, Users, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { format } from "date-fns";
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import EventCard from "@/components/landing/EventCard";
import AwardCard from "@/components/landing/AwardCard";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { buildImageUrl } from "@/utils/imageUtils";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

// Components extracted to separate files

const RunningNumber = ({ value, duration = 2 }: { value: string, duration?: number }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const numericValue = parseInt(value.replace(/[^0-9]/g, '')) || 0;
  const suffix = value.replace(/[0-9]/g, '');

  useEffect(() => {
    if (isInView) {
      let startTime: number | null = null;
      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
        setCount(Math.floor(progress * numericValue));
        if (progress < 1) {
          window.requestAnimationFrame(animate);
        }
      };
      window.requestAnimationFrame(animate);
    }
  }, [isInView, numericValue, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
};

const openInGmail = (email: string) => {
  window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}`, '_blank');
};

const facultyCoordinators = [
  {
    name: "Dr. B. Mythili Gnanamangai",
    role: "Faculty Coordinator",
    email: "mythilignanamangai@ksrct.ac.in",
    phone: "+91 9487088678",
    image: mythiliImg,
    description: "Dr. B. Mythili Gnanamangai has been a pillar of strength for SM Volunteers, guiding students with her expertise in community service and social impact."
  },
  {
    name: "Mr. S. Rajkumar",
    role: "Faculty Coordinator",
    email: "rajkumars@ksrct.ac.in",
    phone: "+91 9003718103",
    image: rajkumarImg,
    description: "Mr. S. Rajkumar actively coordinates various social initiatives and ensures the smooth functioning of volunteer activities across the campus."
  },
  {
    name: "Dr. A. Palaniappan",
    role: "Faculty Coordinator",
    email: "palaniappan@ksrct.ac.in",
    phone: "+91 9894366121",
    image: palaniappanImg,
    description: "Dr. A. Palaniappan provides strategic guidance and academic leadership for SM Volunteers, fostering an environment of service excellence and student development."
  }
];

// NGO Partners Data
const ngoPartners = [
  {
    name: "Atchayam Trust",
    focus: "Begger Free India",
    description: "Providing a Beggar Free India.",
    location: "Erode",
    logoUrl: "/images/ATCHAYAM TRUST.png",
    areas: ["Beggar Rehabilitation", "Rescuing", "Reintegration"]
  },
  {
    name: "Bhumi",
    focus: "Educational",
    description: "Working towards providing quality education for all.",
    location: "India",
    logoUrl: "/images/Bhumi logo.png",
    areas: ["Education", "Awareness", "Career Guidance"]
  },
  {
    name: "Talent Quest India",
    focus: "Educational",
    description: "Working towards environmental conservation and sustainable development practices.",
    location: "Tamil Nadu",
    logoUrl: "/images/TQI_logo-removebg-preview.png",
    areas: ["Education", "Growth", "Skill Development"]
  },
];

// Canonical order for office bearer positions
// Handles both hyphenated ("Vice - President") and plain ("Vice President") variants
const POSITION_ORDER: Record<string, number> = {
  "President": 1,
  "Vice President": 2,
  "Vice - President": 2,
  "Secretary": 3,
  "Joint - Secretary": 4,
  "Joint Secretary": 4,
  "Treasurer": 5,
  "Joint - Treasurer": 6,
  "Joint Treasurer": 6,
};

const LandingPage = () => {
  const navigate = useNavigate();
  // Fallback departments list (full forms to match profile values)
  const DEFAULT_DEPARTMENTS = [
    "Artificial Intelligence and Data Science",
    "Artificial Intelligence and Machine Learning",
    "Biotechnology",
    "Civil Engineering",
    "Computer Science and Engineering",
    "Electronics and Communication Engineering",
    "Electrical and Electronics Engineering",
    "Mechanical Engineering",
    "Mechatronics Engineering",
    "Food Technology",
    "Information Technology",
    "Textile Technology",
    "Very Large Scale Integration Technology",
    "Computer Science and Business Systems",
    "Master of Business Administration",
    "Master of Computer Applications"
  ];
  const [selectedPrincipal, setSelectedPrincipal] = useState(false);
  // const [selectedCoordinator, setSelectedCoordinator] = useState<number | null>(null); // Removed
  const [contactOpen, setContactOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [awards, setAwards] = useState<any[]>([]);
  const [loadingAwards, setLoadingAwards] = useState(true);
  const [selectedEventImage, setSelectedEventImage] = useState<any>(null);
  const [selectedAwardImage, setSelectedAwardImage] = useState<any>(null);
  const [showVolunteerForm, setShowVolunteerForm] = useState(false);
  const [selectedEventForVolunteer, setSelectedEventForVolunteer] = useState<any>(null);
  const [volunteerForm, setVolunteerForm] = useState({
    name: '',
    department: '',
    year: '',
    phone: ''
  });
  const [submittingVolunteer, setSubmittingVolunteer] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const [pageReady, setPageReady] = useState(false);

  const [officeBearers, setOfficeBearers] = useState<any[]>([]);
  const [selectedOB, setSelectedOB] = useState<any>(null);

  const sortedOfficeBearers = [...officeBearers].sort((a, b) => {
    const orderA = POSITION_ORDER[a.position] ?? 99;
    const orderB = POSITION_ORDER[b.position] ?? 99;
    return orderA - orderB;
  });
  const [showViewDialog, setShowViewDialog] = useState(false);

  useEffect(() => {
    const fetchOfficeBearers = async () => {
      try {
        const response = await api.getPublicOfficeBearers();
        if (response.success) {
          setOfficeBearers(response.officeBearers || []);
        }
      } catch (e) {
        console.error("Failed to load OBs", e);
      }
    };
    fetchOfficeBearers();
  }, []);

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt: any) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        toast.success(`Successfully parsed ${data.length} records! Ready for PDF output.`);
      } catch (err) {
        toast.error("Error reading Excel file.");
      }
    };
    reader.readAsBinaryString(file);
  };

  // Use Embla Carousel for smooth, performant scrolling
  const [eventsRef] = useEmblaCarousel({ loop: true, align: 'center' }, [Autoplay({ delay: 4000, stopOnInteraction: false })]);
  const [awardsRef] = useEmblaCarousel({ loop: true, align: 'center' }, [Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: false })]);

  const isAuthenticated = auth.isAuthenticated();
  const user = auth.getUser();

  // Load upcoming events
  useEffect(() => {
    const loadUpcomingEvents = async () => {
      try {
        setLoadingEvents(true);
        // Use public endpoint so events load even when logged out
        // Don't filter by year - show all upcoming events regardless of year
        const response = await api.getPublicEvents();
        if (response && response.success && response.events) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const validEvents = response.events.filter((event: any) => {
            try {
              const eventDate = new Date(event.date);
              eventDate.setHours(0, 0, 0, 0);
              return eventDate.getTime() >= today.getTime();
            } catch {
              return false;
            }
          });

          // Sort by date: Earliest upcoming event first
          const sortedEvents = validEvents.sort((a: any, b: any) => {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
          });

          setUpcomingEvents(sortedEvents);
        }
      } catch (error) {
        // Silently fail - landing page should work even without auth
        console.log('Events not available:', error);
      } finally {
        setLoadingEvents(false);
      }
    };
    loadUpcomingEvents();
    const t = setTimeout(() => setPageReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  // Load awards
  useEffect(() => {
    const loadAwards = async () => {
      try {
        setLoadingAwards(true);
        const response = await api.getPublicAwards();
        if (response && response.success && response.awards) {
          // Show ALL awards, sorted by date (most recent first)
          const allAwards = [...response.awards].sort((a: any, b: any) => {
            try {
              return new Date(b.award_date).getTime() - new Date(a.award_date).getTime();
            } catch {
              return 0;
            }
          });
          setAwards(allAwards);
        }
      } catch (error) {
        console.log('Awards not available:', error);
      } finally {
        setLoadingAwards(false);
      }
    };
    loadAwards();
  }, []);

  // Placeholder removed as Embla handles scrolling logic

  const getDashboardPath = () => {
    const role = user?.role;
    if (role === "admin") return "/admin";
    if (role === "office_bearer") return "/office-bearer";
    if (role === "student") return "/student";
    return "/login";
  };

  const downloadSampleExcel = () => {
    toast.info("Preparing Coordinator Template...", {
      description: "Your download will start automatically."
    });

    setTimeout(() => {
      const wb = XLSX.utils.book_new();
      const sampleData = [
        {
          Name: "John Doe",
          Position: "President",
          Contact: "9876543210",
          Email: "john@example.com",
          "Academic Year": "2024-2025"
        }
      ];
      const ws = XLSX.utils.json_to_sheet(sampleData);
      XLSX.utils.book_append_sheet(wb, ws, "Office Bearers Template");
      XLSX.writeFile(wb, "SM_Office_Bearers_Template.xlsx");
      toast.success("Template Downloaded!");
    }, 800);
  };

  // Announcement state
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    // Load announcements for the ticker
    const loadAnnouncements = async () => {
      try {
        const res = await api.getAnnouncements?.() || { success: false, announcements: [] };
        if (res.success) {
          setAnnouncements(res.announcements);
        }
      } catch (err) {
        // Fallback or silent fail
      }
    };
    loadAnnouncements();
  }, []);


  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="flex-1 w-full bg-transparent text-foreground relative selection:bg-primary/20"
    >
      <AnimatePresence>
        {!pageReady && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]"
          >
            <div className="relative flex flex-col items-center">
              {/* Animated decorative background elements */}
              <div className="absolute -inset-40 bg-primary/5 blur-[120px] rounded-full animate-pulse" />
              <div className="absolute -inset-20 bg-blue-500/5 blur-[80px] rounded-full animate-pulse delay-700" />

              <div className="relative w-32 h-32 md:w-40 md:h-40 flex items-center justify-center">
                {/* SVG Loading Ring */}
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle
                    cx="50%"
                    cy="50%"
                    r="48%"
                    className="fill-none stroke-white/[0.03] stroke-[2]"
                  />
                  <motion.circle
                    cx="50%"
                    cy="50%"
                    r="48%"
                    className="fill-none stroke-primary stroke-[3]"
                    strokeDasharray="10 100"
                    initial={{ strokeDashoffset: 100 }}
                    animate={{
                      strokeDashoffset: [100, -100],
                      strokeDasharray: ["10 100", "80 100", "10 100"]
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    strokeLinecap="round"
                  />
                </svg>

                {/* Pulsing Logo Container */}
                <motion.div
                  animate={{
                    scale: [0.95, 1.05, 0.95],
                    opacity: [0.8, 1, 0.8]
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="relative z-10 w-20 h-20 md:w-24 md:h-24"
                >
                  <img
                    src="/images/Picsart_23-05-18_16-47-20-287-removebg-preview.png"
                    alt="SM Volunteers Logo"
                    className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                    onError={(e) => {
                      // Fallback if logo fails to load
                      const target = e.target as HTMLImageElement;
                      target.src = "/placeholder.svg";
                    }}
                  />
                </motion.div>

                {/* Orbital dots */}
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute w-full h-0 top-1/2 left-0"
                    animate={{
                      rotate: [0, 360]
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "linear",
                      delay: i * 1.3
                    }}
                  >
                    <motion.div
                      className="absolute right-0 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                      animate={{
                        scale: [1, 1.5, 1]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.5
                      }}
                    />
                  </motion.div>
                ))}
              </div>

              {/* Text Elements */}
              <div className="mt-12 text-center">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-3"
                >
                  <h2 className="text-2xl md:text-3xl font-black tracking-[0.25em] uppercase text-white flex items-center justify-center gap-3">
                    <span className="text-primary">SM</span>
                    <span className="text-white/90">Volunteers</span>
                  </h2>

                  <div className="flex flex-col items-center">
                    <div className="h-[2px] w-48 bg-white/5 relative overflow-hidden rounded-full">
                      <motion.div
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-primary to-transparent"
                      />
                    </div>
                    <motion.p
                      animate={{ opacity: [0.4, 0.7, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-[10px] md:text-xs font-bold tracking-[0.4em] uppercase text-white/40 mt-3"
                    >
                      Building the Ministry of Service
                    </motion.p>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      <br>
      </br>

      <br>

      </br>
     

      
      
      {/* Hero Section - Ultra Modern */}
      <section className="relative w-full min-h-[900px] md:min-h-[900px] overflow-hidden z-10 flex items-center justify-center pt-32 md:pt-0 pb-12">
        {/* Background Image — 100% opacity, no overlays */}
        <div className="absolute inset-0 z-0">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat md:bg-[center_50%]"
            style={{
              backgroundImage: 'url("/images/Home.jpg")',
              opacity: 1,
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-12 text-center text-white">
          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="space-y-6 md:space-y-8"
          >
            <motion.h1
              variants={fadeInUp}
              className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tighter leading-tight drop-shadow-[0_4px_32px_rgba(0,0,0,0.9)]"
            >        <br></br>   <span className="text-orange-500 font-black">SM</span>{" "}
              <br className="sm:hidden" />
              <span className="text-orange-500 font-black">VOLUNTEERS</span>
            </motion.h1>

            <motion.div
              variants={fadeInUp}
              className="relative px-2 md:px-6"
            >
              <span className="block text-lg md:text-2xl font-bold italic text-orange-100 drop-shadow-[0_2px_12px_rgba(0,0,0,1)] uppercase tracking-wide">
                To build the ministry of socially responsible volunteers
              </span>
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "80%", opacity: 1 }}
                transition={{ duration: 1.5, delay: 0.8 }}
                className="h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent mx-auto mt-4 rounded-full"
              />
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="flex flex-wrap gap-4 pt-6 md:pt-12 justify-center"
            >
              <Button
                size="lg"
                className="bg-gradient-to-r from-white to-blue-50 text-slate-900 hover:from-blue-50 hover:to-white shadow-2xl hover:shadow-orange-500/50 transform hover:scale-110 transition-all duration-300 px-8 md:px-12 py-6 md:py-7 text-base md:text-lg font-black rounded-2xl w-full sm:w-auto uppercase tracking-wide"
                onClick={() =>
                  isAuthenticated ? navigate(getDashboardPath()) : window.location.href = "/login"
                }
              >
                {isAuthenticated ? "Enter Dashboard" : "Get Started"}
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* About Section - SM Volunteers Only */}

      <section
        id="about-section"
        className="py-32 relative overflow-hidden z-10 bg-gradient-to-b from-slate-50 via-blue-50 to-white dark:from-slate-950 dark:via-blue-950 dark:to-slate-900"
      >

        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          {/* About SM Volunteers Title */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent">
              About SM Volunteers
            </h2>
            <div className="w-24 h-3 bg-gradient-to-r from-blue-600 to-orange-500 mx-auto rounded-full shadow-lg shadow-blue-500/30"></div>
          </div>

          {/* Stats Grid */}
          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
          >
            {[
              { label: 'Years of Excellence', value: '4+' },
              { label: 'NGOs', value: '4+' },
              { label: 'Events', value: '100+' },
              { label: 'Volunteers', value: '1500+' },
            ].map((stat, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="bg-gradient-to-br from-white to-blue-50 dark:from-slate-800 dark:to-slate-900 border border-blue-200 dark:border-blue-900/50 p-6 rounded-2xl text-center hover:scale-105 transition-transform shadow-lg hover:shadow-xl hover:shadow-blue-500/20"
              >
                <div className="text-3xl md:text-4xl font-black bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent mb-2 tracking-tighter">
                  <RunningNumber value={stat.value} />
                </div>
                <div className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mt-12 md:mt-20 mb-20"
          >
            <div className="grid lg:grid-cols-12 gap-8 md:gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="lg:col-span-7 bg-gradient-to-br from-white to-blue-50 dark:from-slate-800 dark:to-slate-900 text-slate-900 dark:text-white p-6 md:p-10 rounded-3xl shadow-2xl border border-blue-200 dark:border-blue-900 relative h-full flex flex-col justify-center order-2 lg:order-1"
              >
                <h3 className="text-xl md:text-2xl font-black mb-6 text-blue-600 dark:text-blue-400 flex items-center gap-3">
                  <span className="w-8 h-1.5 bg-gradient-to-r from-blue-600 to-orange-500 rounded-full"></span>
                  Service Motto Volunteers
                </h3>
                <div className="space-y-4">
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-sm md:text-lg text-justify font-medium">
                    Service Motto Volunteers (SM Volunteers) began their journey on <strong className="text-blue-600 dark:text-blue-400">October 5, 2021</strong>. What started as a small group of passionate students has grown into a strong and inspiring movement within the KSRCT campus. Our core objective is to bridge the gap between students and social service, nurturing responsibility, compassion, and leadership among young minds.
                  </p>
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-sm md:text-lg text-justify font-medium">
                    Through meaningful collaborations with organizations such as <strong className="text-blue-600 dark:text-blue-400">Bhumi</strong>, <strong className="text-blue-600 dark:text-blue-400">Talent Quest for India</strong>, <strong className="text-blue-600 dark:text-blue-400">Atchayam Trust</strong>, and <strong className="text-blue-600 dark:text-blue-400">Sittruli Foundation</strong>, we actively contribute to education support, women empowerment, environmental protection, and community health initiatives.
                  </p>
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-sm md:text-lg text-justify font-medium">
                    At SM Volunteers, we believe volunteering is more than an activity — it is a pathway to developing <strong className="text-orange-500">empathy</strong>, <strong className="text-orange-500">teamwork</strong>, <strong className="text-orange-500">leadership</strong>, and lifelong values that shape socially responsible citizens.
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="lg:col-span-5 relative group order-1 lg:order-2 flex justify-center items-center"
              >
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-orange-500 blur-2xl rounded-full opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <div className="relative z-10">
                  <motion.img
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    src="/images/Picsart_23-05-18_16-47-20-287-removebg-preview.png"
                    alt="SM Volunteers Logo"
                    className="h-48 sm:h-64 md:h-80 w-auto object-contain drop-shadow-[0_0_40px_rgba(59,130,246,0.4)]"
                  />
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* About KSRCT Section */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mt-20 mb-12"
          >
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent">
                About KSRCT
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                Discover the legacy of excellence and innovation
              </p>
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: 96 }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-1 bg-gradient-to-r from-blue-600 to-orange-500 mx-auto mt-4 rounded-full Shadow-lg shadow-blue-500/30"
              ></motion.div>
            </div>

            {/* Stats Grid */}
            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
            >
              {[
                { label: 'Years of Excellence', value: '30+' },
                { label: 'Students', value: '4000+' },
                { label: 'Programs', value: '21' },
                { label: 'Acers', value: '400+' },
              ].map((stat, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="bg-gradient-to-br from-white to-blue-50 dark:from-slate-800 dark:to-slate-900 border border-blue-200 dark:border-blue-900/50 p-6 rounded-2xl text-center hover:scale-105 transition-transform shadow-lg hover:shadow-xl hover:shadow-blue-500/20"
                >
                  <div className="text-3xl md:text-4xl font-black bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent mb-2 tracking-tighter">
                    <RunningNumber value={stat.value} />
                  </div>
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>

            {/* KSRCT Description & Image */}
            <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="relative group order-1"
              >
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-orange-500 blur-2xl rounded-3xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <img
                  src="/images/Home.jpg"
                  alt="KSRCT Main Building"
                  className="rounded-3xl shadow-2xl relative z-10 w-full object-cover h-[300px] md:h-[450px]"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="bg-gradient-to-br from-slate-900 to-blue-950 text-white p-6 md:p-10 rounded-3xl shadow-2xl border border-blue-800/30 relative h-full flex flex-col justify-center order-2"
              >
                <h3 className="text-xl md:text-2xl font-black mb-4 md:mb-6 bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent flex items-center gap-3">
                  <span className="w-8 h-1.5 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></span>
                  K.S.Rangasamy College of Technology
                </h3>
                <p className="text-slate-200 leading-relaxed text-sm md:text-lg text-justify font-medium">
                  K.S.Rangasamy College of Technology (KSRCT) was started in 1994. Approved by AICTE and affiliated with Anna University, Chennai, KSRCT has Autonomous status from UGC. It ranked 99th in NIRF 2017 and 51-100 band in NIRF Innovation Ranking 2023 for Engineering. Accredited with NAAC A++ grade and NBA Tier 1 departments.
                </p>
              </motion.div>
            </div>
          </motion.div>

        </div>
      </section>

      {/* Events Section */}
      <section
        id="events-section"
        className="py-20 md:py-28 bg-gradient-to-br from-slate-50 via-blue-50 to-white dark:from-slate-950 dark:via-blue-950 dark:to-slate-900 relative overflow-hidden"
      >
        {/* Decorative Elements */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-blue-400/5 dark:bg-blue-600/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-400/5 dark:bg-orange-600/5 rounded-full blur-3xl translate-x-1/4 translate-y-1/4"></div>
        <div className="absolute top-1/2 right-0 w-48 h-48 bg-blue-300/5 dark:bg-blue-500/5 rounded-full blur-3xl translate-x-1/3"></div>

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100/50 dark:bg-blue-900/30 rounded-full border border-blue-200 dark:border-blue-800 mb-4">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-semibold text-blue-900 dark:text-blue-200 uppercase tracking-wide">What's Happening</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent">
              Upcoming Events & Activities
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed font-medium">
              Join us for these exciting opportunities to make a difference. Every event is a chance to connect, learn, and create impact together.
            </p>
          </motion.div>

          {loadingEvents ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[400px] w-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 animate-pulse rounded-3xl shadow-sm"></div>
              ))}
            </div>
          ) : upcomingEvents.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {upcomingEvents.map((event) => (
                <div key={event.id} className="h-full">
                  <EventCard
                    event={event}
                    eventDate={new Date(event.date)}
                    isToday={new Date(event.date).toDateString() === new Date().toDateString()}
                    isThisWeek={new Date(event.date).getTime() - new Date().getTime() <= 7 * 24 * 60 * 60 * 1000}
                    isPast={new Date(event.date).getTime() < new Date().getTime()}
                    onImageClick={setSelectedEventImage}
                    onRegisterClick={(event) => {
                      setSelectedEventForVolunteer(event);
                      setShowVolunteerForm(true);
                    }}
                  />
                </div>
              ))}
            </motion.div>
          ) : (
            <div className="text-center py-20 bg-gradient-to-br from-white to-blue-50 dark:from-slate-800 dark:to-slate-900 backdrop-blur-sm rounded-[3rem] border-4 border-dashed border-blue-200 dark:border-blue-900/50">
              <Activity className="w-20 h-20 mx-auto text-slate-300 dark:text-slate-600 mb-6 animate-bounce" />
              <p className="text-slate-900 dark:text-white text-2xl font-black tracking-tight mb-2">No upcoming events</p>
              <p className="text-slate-500 dark:text-slate-400 font-medium">We're planning something incredible. Stay tuned!</p>
            </div>
          )}
        </div>
      </section>

      {/* Awards Section */}
      <section
        id="awards-section"
        className="py-20 md:py-28 bg-gradient-to-br from-white via-blue-50/30 to-orange-50/20 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden"
      >
        {/* Decorative Elements */}
        <div className="absolute top-1/4 left-0 w-80 h-80 bg-orange-300/8 rounded-full blur-3xl -translate-x-1/2"></div>
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-amber-300/8 rounded-full blur-3xl translate-y-1/2"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-300/8 rounded-full blur-3xl translate-x-1/3 -translate-y-1/4"></div>

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100/60 dark:bg-orange-900/30 rounded-full border border-orange-300 dark:border-orange-600/50 mb-4 backdrop-blur-sm">
              <Award className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <span className="text-sm font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide">Celebrating Success</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent">
              Awards & Recognition
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed font-medium">
              Every award tells a story—a story of dedication, impact, and the incredible difference our volunteers make. These aren't just trophies; they're proof that when students come together, amazing things happen.
            </p>
          </motion.div>

          {loadingAwards ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[350px] w-full bg-gradient-to-br from-orange-200 to-amber-200 dark:from-orange-900 dark:to-amber-900 animate-pulse rounded-3xl shadow-sm"></div>
              ))}
            </div>
          ) : awards.length > 0 ? (
            <div className="relative overflow-hidden py-4">
              <motion.div
                className={`flex gap-6 ${awards.length <= 3 ? 'justify-center flex-wrap' : ''}`}
                animate={awards.length > 3 ? {
                  x: [0, -(awards.length * 350)]
                } : {}}
                transition={{
                  x: {
                    repeat: Infinity,
                    repeatType: "loop",
                    duration: awards.length * 5,
                    ease: "linear"
                  }
                }}
              >
                {awards.map((award, index) => (
                  <div key={`${award.id}-${index}`} className="flex-shrink-0 w-[320px]">
                    <AwardCard
                      award={award}
                      awardDate={new Date(award.award_date)}
                      onImageClick={setSelectedAwardImage}
                    />
                  </div>
                ))}
              </motion.div>
            </div>
          ) : (
            <div className="text-center py-20 bg-gradient-to-br from-white to-orange-50 dark:from-slate-800 dark:to-slate-900 backdrop-blur-sm rounded-[3rem] border-4 border-dashed border-orange-200 dark:border-orange-900/50">
              <Award className="w-20 h-20 mx-auto text-orange-200 dark:text-orange-900 mb-6" />
              <p className="text-slate-900 dark:text-white text-2xl font-black tracking-tight mb-2">Awards arriving soon</p>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Recognition for our incredible community impact.</p>
            </div>
          )}
        </div>
      </section>

      {/* Leadership Section */}
      <section className="w-full py-16 md:py-24 bg-gradient-to-br from-white via-slate-50 to-blue-50 dark:from-slate-800 dark:via-slate-900 dark:to-blue-950 relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute top-0 left-0 w-80 h-80 bg-blue-400/5 dark:bg-blue-600/5 rounded-full blur-3xl -translate-x-1/3 -translate-y-1/2"></div>
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-orange-300/5 dark:bg-orange-600/5 rounded-full blur-3xl translate-x-1/4"></div>

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent">Leadership</h2>
            <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-lg font-medium">
              The visionary leaders guiding K.S.Rangasamy College of Technology and the SM Volunteers forum.
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            {/* Principal Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <Card className="bg-card border-border/50 overflow-hidden transition-all flex flex-col md:flex-row shadow-lg rounded-2xl h-full border-l-8 border-l-primary">
                <div className="md:w-2/5 bg-muted/20 flex items-center justify-center p-8">
                  <div
                    className="w-48 h-48 md:w-64 md:h-64 bg-card rounded-2xl border-4 border-primary/10 overflow-hidden shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500"
                    role="img"
                    aria-label="Principal photo"
                    style={{
                      backgroundImage: `url(${principalImg})`,
                      backgroundSize: 'cover',
                      backgroundPosition: '50% 14%'
                    }}
                  />
                </div>
                <div className="md:w-3/5 flex flex-col">
                  <CardHeader className="border-b border-border/50 bg-card/50 pb-6">
                    <CardTitle className="text-3xl font-black text-foreground">Dr.R.Gopalakrishnan</CardTitle>
                    <CardDescription className="text-lg font-bold text-primary mt-1">Principal, KSRCT</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-8 px-8 pb-8 flex-grow flex flex-col justify-between">
                    <p className="text-muted-foreground leading-relaxed text-lg font-medium italic">
                      "Our Institution is committed to producing engineers who are not just technically competent but also socially responsible."
                    </p>
                    <div className="space-y-4 text-base bg-muted/30 p-5 rounded-xl border border-border/50">
                      <button
                        onClick={() => openInGmail("principal@ksrct.ac.in")}
                        className="flex items-center gap-4 hover:text-primary transition-all text-left group"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20">
                          <Mail className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-foreground font-semibold break-all">principal@ksrct.ac.in</span>
                      </button>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Phone className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-foreground font-semibold">+91-99941 50505</span>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Vision & Initiatives Row */}
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 mt-16 max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="bg-card rounded-2xl p-8 border border-border/50 shadow-md flex flex-col justify-center relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-700"></div>
              <h3 className="text-2xl font-black text-foreground mb-4 relative z-10">Principal's Vision</h3>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed italic relative z-10">
                The SM Volunteers program exemplifies our commitment to encouraging students to contribute meaningfully to society and grow as responsible citizens.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="bg-card rounded-2xl p-8 border border-border/50 shadow-md"
            >
              <h4 className="font-black text-lg text-primary mb-4">Key Initiatives</h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-base text-muted-foreground font-semibold">
                <li className="flex items-start gap-2 hover:translate-x-1 transition-transform">
                  <span className="text-xl">🎯</span>
                  <span>Holistic Growth</span>
                </li>
                <li className="flex items-start gap-2 hover:translate-x-1 transition-transform">
                  <span className="text-xl">🌍</span>
                  <span>Social Impact</span>
                </li>
                <li className="flex items-start gap-2 hover:translate-x-1 transition-transform">
                  <span className="text-xl">💼</span>
                  <span>NGO Connect</span>
                </li>
                <li className="flex items-start gap-2 hover:translate-x-1 transition-transform">
                  <span className="text-xl">🏆</span>
                  <span>Recognition</span>
                </li>
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Faculty Coordinators Section */}
      <section id="coordinators-section" className="w-full py-16 md:py-24 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute top-1/3 right-0 w-96 h-96 bg-blue-400/5 dark:bg-blue-600/5 rounded-full blur-3xl translate-x-1/3"></div>
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-orange-300/5 dark:bg-orange-600/5 rounded-full blur-3xl translate-y-1/3"></div>

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent">Faculty Coordinators</h2>
            <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-medium text-lg">
              Meet our team of dedicated faculty members who coordinate and guide the SM Volunteers mission.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-7xl mx-auto px-2">
            {facultyCoordinators.map((coordinator, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                className="h-[350px] md:h-[400px] perspective-1000 group mx-auto w-full max-w-sm lg:max-w-none"
              >
                <div className="relative w-full h-full transition-transform duration-700 preserve-3d group-hover:rotate-y-180 cursor-pointer active:rotate-y-180">
                  {/* Front Side */}
                  <Card className="absolute inset-0 backface-hidden bg-gradient-to-br from-white to-blue-50 dark:from-slate-800 dark:to-slate-900 border border-blue-200 dark:border-blue-900/50 overflow-hidden shadow-xl flex flex-col items-center text-center rounded-[2rem] h-full hover:shadow-2xl hover:shadow-blue-500/20 transition-shadow">
                    <div className="w-full bg-gradient-to-r from-blue-600/10 to-orange-500/10 flex items-center justify-center p-6 md:p-8 border-b border-blue-200 dark:border-blue-900/50 relative overflow-hidden flex-shrink-0">
                      <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-blue-600/30 overflow-hidden shadow-xl relative z-10 bg-white dark:bg-slate-800">
                        <img
                          src={coordinator.image}
                          alt={coordinator.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            e.currentTarget.src = "/Images/Brand_logo.png";
                          }}
                        />
                      </div>
                    </div>
                    <div className="p-4 md:p-6 space-y-2 md:space-y-3 flex-grow flex flex-col justify-center">
                      <div>
                        <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white mb-1 leading-tight">{coordinator.name}</h3>
                        <p className="text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider text-[10px]">{coordinator.role}</p>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 text-[11px] md:text-xs leading-relaxed font-medium line-clamp-3 md:line-clamp-none">
                        {coordinator.description}
                      </p>
                      <div className="pt-2 mt-auto">
                        <p className="text-[9px] md:text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest animate-pulse">Click for contact</p>
                      </div>
                    </div>
                  </Card>

                  {/* Back Side */}
                  <Card className="absolute inset-0 rotate-y-180 backface-hidden bg-gradient-to-br from-blue-600 to-orange-600 border border-orange-500/30 overflow-hidden shadow-2xl flex flex-col items-center justify-center text-center rounded-[2rem] p-6 h-full">
                    <div className="w-full space-y-4 md:space-y-6">
                      <div className="relative mx-auto w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/20 flex items-center justify-center border border-white/40 shadow-lg">
                        <Mail className="w-6 h-6 md:w-8 md:h-8 text-white" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-lg md:text-xl font-black text-white leading-tight">{coordinator.name}</h3>
                        <p className="text-white/80 font-bold uppercase text-[9px] md:text-[10px] tracking-widest">{coordinator.role}</p>
                      </div>
                      <div className="space-y-2 md:space-y-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); openInGmail(coordinator.email); }}
                          className="flex items-center gap-3 p-2 md:p-3 rounded-xl bg-white/20 border border-white/30 hover:border-white/60 hover:bg-white/30 transition-all w-full group/btn"
                        >
                          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/20 flex items-center justify-center group-hover/btn:bg-white/30">
                            <Mail className="w-4 h-4 md:w-5 md:h-5 text-white" />
                          </div>
                          <div className="text-left overflow-hidden">
                            <p className="text-[7px] md:text-[8px] font-black uppercase text-white/70 tracking-widest">Email Address</p>
                            <p className="text-[10px] md:text-xs font-bold text-white truncate">{coordinator.email}</p>
                          </div>
                        </button>

                        <a
                          href={`tel:${coordinator.phone}`}
                          className="flex items-center gap-3 p-2 md:p-3 rounded-xl bg-white/20 border border-white/30 w-full hover:border-white/60 transition-all group/btn"
                        >
                          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <Phone className="w-4 h-4 md:w-5 md:h-5 text-white" />
                          </div>
                          <div className="text-left">
                            <p className="text-[7px] md:text-[8px] font-black uppercase text-white/70 tracking-widest">Mobile Contact</p>
                            <p className="text-[10px] md:text-xs font-bold text-white">{coordinator.phone}</p>
                          </div>
                        </a>
                      </div>
                    </div>
                  </Card>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="office-bearers-section" className="py-24 bg-gradient-to-br from-white via-blue-50 to-slate-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-300/8 rounded-full blur-3xl translate-x-1/2 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-300/8 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3"></div>
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-orange-300/8 rounded-full blur-3xl"></div>

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-16">
            <div>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent mb-4">
                Student <span>Office Bearers</span>
              </h2>
              <p className="text-slate-600 dark:text-slate-300 max-w-2xl text-lg mt-4 font-medium">
                The dedicated leadership team guiding our volunteer missions and community impact.
              </p>
            </div>
            <div className="px-6 py-3 bg-white/40 dark:bg-white/10 border border-blue-200 dark:border-blue-500/30 rounded-full backdrop-blur-xl shadow-lg">
              <span className="bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent text-sm font-black uppercase tracking-widest">Leadership {new Date().getFullYear()}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {sortedOfficeBearers.map((ob, i) => (
              <motion.div
                key={ob.id || i}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group relative overflow-hidden rounded-3xl border-2 border-cyan-400/40 dark:border-cyan-300/30 bg-gradient-to-br from-white/80 to-cyan-50/60 dark:from-slate-800/80 dark:to-slate-700/60 backdrop-blur-xl shadow-2xl hover:shadow-3xl hover:shadow-cyan-400/30 dark:hover:shadow-cyan-500/20 hover:border-cyan-400/70 dark:hover:border-cyan-500/50 transition-all duration-300 flex flex-col h-full"
              >
                {/* Photo Section - Compact Aspect Ratio */}
                <div className="relative w-full aspect-square overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700">
                  {ob.photo_url ? (
                    <img
                      src={buildImageUrl(ob.photo_url)}
                      alt={ob.name}
                      className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-110"
                      onError={(e) => {
                        (e.target as any).src = '/Images/Brand_logo.png';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-700 text-slate-400">
                      <Users className="w-12 h-12" />
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>

                {/* Content Section */}
                <div className="p-4 flex flex-row items-center justify-between gap-4 relative bg-gradient-to-br from-slate-900/50 to-slate-800/40 dark:from-slate-900/60 dark:to-slate-800/50 backdrop-blur-sm border-t border-white/10">
                  {/* Left Side - Position & Name */}
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-gradient-to-r from-cyan-100 to-blue-100 dark:from-cyan-900/40 dark:to-blue-900/40 border border-cyan-300 dark:border-cyan-600/50 text-[9px] font-black uppercase tracking-widest text-cyan-700 dark:text-cyan-300 w-fit mb-1.5">
                      {ob.position}
                    </span>
                    <h3 className="text-base font-black bg-gradient-to-r from-cyan-300 to-blue-300 dark:from-cyan-200 dark:to-blue-200 bg-clip-text text-transparent leading-tight line-clamp-2" title={ob.name}>
                      {ob.name}
                    </h3>
                  </div>

                  {/* Right Side - Phone */}
                  <div className="flex flex-col items-end">
                    <a href={`tel:${ob.contact}`} className="text-xs font-semibold text-cyan-200 dark:text-cyan-300 flex items-center gap-1.5 hover:text-cyan-100 transition-colors cursor-pointer">
                      <Phone className="w-3.5 h-3.5 text-cyan-400 dark:text-cyan-300 flex-shrink-0" />
                      <span className="truncate text-right">{ob.contact || 'N/A'}</span>
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* NGO Partners Section */}
      <section
        id="ngo-section"
        className="py-16 md:py-24 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 relative overflow-hidden"
      >
        {/* Decorative Elements */}
        <div className="absolute top-0 left-0 w-80 h-80 bg-blue-400/5 dark:bg-blue-600/5 rounded-full blur-3xl -translate-x-1/3 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-400/5 dark:bg-orange-600/5 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <motion.h2
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-black mb-4 text-center bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent"
          >
            NGO Partners
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-center text-slate-600 dark:text-slate-300 mb-12 max-w-2xl mx-auto font-medium text-lg"
          >
            Collaborating with leading organizations for community development
          </motion.p>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {ngoPartners.map((ngo, idx) => (
              <motion.div key={idx} variants={fadeInUp} className="h-full">
                <Card className="bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-900/50 transition-all hover:shadow-2xl hover:shadow-blue-500/20 hover:scale-105 overflow-hidden flex flex-col rounded-3xl hover:border-blue-400 dark:hover:border-blue-700 h-full">
                  {ngo.logoUrl && (
                    <div className="h-36 flex items-center justify-center border-b border-blue-200 dark:border-blue-900/50 overflow-hidden flex-shrink-0 p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-700 dark:to-slate-600">
                      <img
                        src={ngo.logoUrl}
                        alt={ngo.name}
                        className="h-24 w-auto object-contain"
                        onError={(e) => {
                          const fallback = '/Images/Brand_logo.png';
                          if (!e.currentTarget.src.includes(fallback)) {
                            e.currentTarget.src = fallback;
                          } else {
                            e.currentTarget.style.display = 'none';
                          }
                        }}
                      />
                    </div>
                  )}
                  <CardHeader className="text-center border-b border-blue-200 dark:border-blue-900/50 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900">
                    <CardTitle className="text-lg text-slate-900 dark:text-white font-black">{ngo.name}</CardTitle>
                    <CardDescription className="font-bold text-blue-600 dark:text-blue-400 text-base">🎯 {ngo.focus}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4 flex-grow flex flex-col">
                    <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">{ngo.description}</p>
                    <div className="space-y-2 text-xs flex-grow">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3 h-3 mt-0.5 text-blue-600 dark:text-blue-400" />
                        <span className="text-slate-600 dark:text-slate-300 font-medium">{ngo.location}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Heart className="w-3 h-3 mt-0.5 text-orange-500 dark:text-orange-400" />
                        <span className="text-slate-600 dark:text-slate-300 font-medium">{ngo.focus}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-3 flex-wrap">
                      {ngo.areas.map((area, i) => (
                        <span key={i} className="bg-gradient-to-r from-blue-600/10 to-orange-500/10 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded-full border border-blue-600/20 dark:border-blue-900/50 font-semibold">
                          {area}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section
        id="contact-section"
        className="bg-gradient-to-br from-slate-50 via-blue-50 to-white dark:from-slate-900 dark:via-blue-950 dark:to-slate-950 text-slate-900 dark:text-white py-24 relative overflow-hidden"
      >
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-400/5 dark:bg-orange-600/5 rounded-full blur-3xl translate-x-1/4 -translate-y-1/4"></div>
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-blue-400/5 dark:bg-blue-600/5 rounded-full blur-3xl translate-y-1/3"></div>

        <div className="absolute top-0 left-0 w-full h-full opacity-5 dark:opacity-10 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-px h-full bg-blue-600"></div>
          <div className="absolute top-0 right-1/4 w-px h-full bg-orange-500"></div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-6xl mx-auto px-4 text-center space-y-12 relative z-10"
        >
          <div className="space-y-4">
            <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent">Ready to Make a Difference?</h2>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 font-medium max-w-2xl mx-auto px-4">
              Join thousands of volunteers contributing to a better society through meaningful community service.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center px-6">
            <Button
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 font-bold shadow-xl hover:shadow-2xl hover:shadow-blue-500/40 transition-all transform hover:scale-105 px-8 md:px-10 py-6 md:py-7 rounded-2xl text-base md:text-lg w-full sm:w-auto uppercase tracking-wide"
              onClick={() =>
                isAuthenticated ? navigate(getDashboardPath()) : window.location.href = "/login"
              }
            >
              {isAuthenticated ? "Go to Dashboard" : "Login to Dashboard"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-2 border-blue-600 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-slate-700 font-bold shadow-xl hover:shadow-2xl hover:shadow-blue-500/30 transition-all transform hover:scale-105 px-8 md:px-10 py-6 md:py-7 rounded-2xl text-base md:text-lg w-full sm:w-auto uppercase tracking-wide"
              onClick={() => setContactOpen(true)}
            >
              <Mail className="mr-2 w-5 h-5" /> Contact Us
            </Button>
          </div>




        </motion.div>
      </section>

      {/* Contact Dialog */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader className="space-y-3 pb-6 border-b border-border/50">
            <DialogTitle className="text-2xl font-black text-foreground uppercase tracking-tight">Contact Admin</DialogTitle>
            <DialogDescription className="text-base font-semibold text-muted-foreground">
              Send us a message or share your feedback with the SM Volunteers team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-6">
            <div className="flex items-center space-x-3 p-4 rounded-xl bg-primary/10 border border-primary/20">
              <Switch id="anonymous-mode" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
              <Label htmlFor="anonymous-mode" className="text-base font-bold cursor-pointer text-foreground">Send Feedback Anonymously</Label>
            </div>

            <AnimatePresence>
              {!isAnonymous && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div>
                    <label className="block text-sm font-black text-foreground uppercase tracking-wider mb-2">Name</label>
                    <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full px-4 py-3 rounded-lg border-2 border-input bg-background text-base font-semibold text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-foreground uppercase tracking-wider mb-2">Email</label>
                    <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full px-4 py-3 rounded-lg border-2 border-input bg-background text-base font-semibold text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-foreground uppercase tracking-wider mb-2">Contact No</label>
                    <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full px-4 py-3 rounded-lg border-2 border-input bg-background text-base font-semibold text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all" placeholder="+91-" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-sm font-black text-foreground uppercase tracking-wider mb-2">Message</label>
              <textarea value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} className="w-full px-4 py-3 rounded-lg border-2 border-input bg-background text-base font-semibold text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all resize-none" rows={6} placeholder={isAnonymous ? "Share your anonymous feedback or suggestion..." : "How can we help you?"} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setContactOpen(false)} className="font-bold text-base px-6 py-2 h-auto rounded-lg">Cancel</Button>
              <Button onClick={() => {
                const store = localStorage.getItem('admin_messages');
                const arr = store ? JSON.parse(store) : [];
                const msg = {
                  id: Date.now(),
                  name: isAnonymous ? "Anonymous User" : contactName,
                  email: isAnonymous ? "N/A" : contactEmail,
                  phone: isAnonymous ? "N/A" : contactPhone,
                  message: contactMessage,
                  created_at: new Date().toISOString(),
                  read: false,
                  type: isAnonymous ? 'feedback' : 'contact'
                };
                arr.unshift(msg);
                localStorage.setItem('admin_messages', JSON.stringify(arr));
                window.dispatchEvent(new Event('adminMessage'));
                toast.success(isAnonymous ? 'Feedback sent anonymously' : 'Message sent to admin');
                setContactName(''); setContactEmail(''); setContactPhone(''); setContactMessage(''); setIsAnonymous(false); setContactOpen(false);
              }} className="font-bold text-base px-6 py-2 h-auto rounded-lg">Send</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Coordinator Modal Removed */}

      {/* View Office Bearer Details Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-sm p-0 overflow-hidden border-none shadow-2xl bg-card">
          <DialogHeader className="sr-only">
            <DialogTitle>Office Bearer Details</DialogTitle>
            <DialogDescription>Viewing details for {selectedOB?.name}</DialogDescription>
          </DialogHeader>
          <div className="relative w-full aspect-[4/5] bg-muted">
            {selectedOB?.photo_url ? (
              <img
                src={buildImageUrl(selectedOB.photo_url)}
                alt={selectedOB.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-500">
                <Users className="w-20 h-20" />
                <p className="mt-4 font-bold text-xs uppercase tracking-widest text-slate-400">No Photo</p>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-5 pt-20 text-white">
              <h2 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">{selectedOB?.name}</h2>
              <p className="text-white/80 font-medium text-sm border-l-4 border-primary pl-2">{selectedOB?.position}</p>
            </div>
            <Button
              size="icon"
              variant="secondary"
              className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/20 hover:bg-black/40 text-white border-0 backdrop-blur-md"
              onClick={() => setShowViewDialog(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-5 space-y-3 bg-card">
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground">Email</p>
                  <p className="font-medium text-xs truncate select-all">{selectedOB?.email || 'N/A'}</p>
                </div>
                {selectedOB?.email && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-500" onClick={() => openInGmail(selectedOB.email)}>
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground">Mobile</p>
                  <p className="font-medium text-xs truncate select-all">{selectedOB?.contact || 'N/A'}</p>
                </div>
                {selectedOB?.contact && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-500" onClick={() => window.location.href = `tel:${selectedOB.contact}`}>
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>

            <div className="pt-1">
              <Button className="w-full font-bold rounded-lg py-5 text-base" onClick={() => setShowViewDialog(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Award Image Full View Dialog */}
      <Dialog open={selectedAwardImage !== null} onOpenChange={() => setSelectedAwardImage(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 bg-card border-border">
          {selectedAwardImage && (
            <div className="flex flex-col md:flex-row h-full">
              <div className="p-6 md:w-1/3 border-r border-border bg-background">
                <div className="flex justify-between items-start mb-6">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-foreground mb-2">{selectedAwardImage.title}</DialogTitle>
                    <DialogDescription className="flex items-center gap-2 text-muted-foreground">
                      <Award className="w-4 h-4 text-yellow-500" />
                      {format(new Date(selectedAwardImage.award_date), "MMMM do, yyyy")}
                    </DialogDescription>
                  </DialogHeader>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedAwardImage(null)}
                    className="hover:bg-muted rounded-full -mt-2 -mr-2"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                <div className="mt-6 space-y-6">
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Description</h4>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {selectedAwardImage.description || "No description available."}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Details</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        <span className="text-muted-foreground">
                          Impact Level: <span className="font-medium text-foreground">High</span>
                        </span>
                      </div>
                      <span className="text-muted-foreground block">Year: {selectedAwardImage.year}</span>
                      {selectedAwardImage.recipient_name && (
                        <span className="text-muted-foreground block">NGO: {selectedAwardImage.recipient_name}</span>
                      )}
                      {selectedAwardImage.category && (
                        <span className="px-2 py-1 bg-primary/10 text-primary rounded text-sm inline-block">{selectedAwardImage.category}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-muted/10 flex items-center justify-center min-h-[500px] flex-grow">
                {(() => {
                  const buildImageUrl = (imageUrl: string | null | undefined) => {
                    if (!imageUrl) return null;
                    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                      return imageUrl;
                    }
                    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                    const apiRoot = apiBase.replace(/\/api\/?$/, '');
                    return `${apiRoot}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
                  };
                  const imageUrl = buildImageUrl(selectedAwardImage.image_url);
                  return imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={selectedAwardImage.title}
                      className="w-full h-auto max-h-[75vh] object-contain rounded-lg shadow-xl"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="text-muted-foreground text-center">
                      <Award className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>No image available</p>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Volunteer Registration Form Dialog */}
      <Dialog open={showVolunteerForm} onOpenChange={setShowVolunteerForm}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Join as Volunteer</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {selectedEventForVolunteer && `Register to volunteer for "${selectedEventForVolunteer.title}"`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!volunteerForm.name?.trim() || !volunteerForm.department || !volunteerForm.year || !volunteerForm.phone?.trim()) {
              toast.error('Please fill all required fields');
              return;
            }
            if (!/^[0-9]{10}$/.test(volunteerForm.phone.replace(/[\s-]/g, ''))) {
              toast.error('Please enter a valid 10-digit phone number');
              return;
            }
            setSubmittingVolunteer(true);
            try {
              const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
              const response = await fetch(`${API_BASE}/events/${selectedEventForVolunteer?.id}/volunteers`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  name: volunteerForm.name.trim(),
                  department: volunteerForm.department,
                  year: volunteerForm.year,
                  phone: volunteerForm.phone.trim()
                })
              });

              const data = await response.json();

              if (!response.ok) {
                // Handle different error types
                if (data.alreadyRegistered) {
                  toast.error(data.message || 'You have already registered for this event');
                } else if (data.deadlinePassed) {
                  toast.error(data.message || 'Registration deadline has passed');
                  setShowVolunteerForm(false);
                } else if (data.limitReached) {
                  toast.error(data.message || `Registration is full. Maximum ${data.maxVolunteers} volunteers allowed.`);
                  setShowVolunteerForm(false);
                } else {
                  throw new Error(data.message || `Server error: ${response.status}`);
                }
                return;
              }

              if (data.success) {
                toast.success('Registration submitted successfully!');
                setShowVolunteerForm(false);
                setVolunteerForm({ name: '', department: '', year: '', phone: '' });
                setSelectedEventForVolunteer(null);
              } else {
                throw new Error(data.message || 'Registration failed');
              }
            } catch (error: any) {
              console.error('Volunteer registration error:', error);
              toast.error(error.message || 'Failed to submit registration. Please try again later.');
            } finally {
              setSubmittingVolunteer(false);
            }
          }} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="volunteer-name" className="text-foreground">Name *</Label>
              <Input
                id="volunteer-name"
                value={volunteerForm.name}
                onChange={(e) => setVolunteerForm({ ...volunteerForm, name: e.target.value })}
                placeholder="Enter your full name"
                required
                className="border-input bg-background focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="volunteer-department" className="text-foreground">Department *</Label>
              <Select
                value={volunteerForm.department}
                onValueChange={(value) => setVolunteerForm({ ...volunteerForm, department: value })}
                required
              >
                <SelectTrigger id="volunteer-department" className="border-input bg-background focus:border-primary text-foreground">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {departments.length > 0 ? (
                    departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))
                  ) : (
                    DEFAULT_DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="volunteer-year" className="text-foreground">Year *</Label>
              <Select
                value={volunteerForm.year}
                onValueChange={(value) => setVolunteerForm({ ...volunteerForm, year: value })}
                required
              >
                <SelectTrigger id="volunteer-year" className="border-input bg-background focus:border-primary text-foreground">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="I">I Year</SelectItem>
                  <SelectItem value="II">II Year</SelectItem>
                  <SelectItem value="III">III Year</SelectItem>
                  <SelectItem value="IV">IV Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="volunteer-phone" className="text-foreground">Phone Number *</Label>
              <Input
                id="volunteer-phone"
                type="tel"
                value={volunteerForm.phone}
                onChange={(e) => setVolunteerForm({ ...volunteerForm, phone: e.target.value })}
                placeholder="Enter your phone number"
                required
                className="border-input bg-background focus:border-primary"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowVolunteerForm(false);
                  setVolunteerForm({ name: '', department: '', year: '', phone: '' });
                }}
                className="flex-1 border-input"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingVolunteer}
                className="flex-1"
              >
                {submittingVolunteer ? 'Submitting...' : 'Submit'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>


    </motion.div >
  );
};



export default LandingPage;







