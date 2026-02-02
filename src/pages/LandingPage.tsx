import { useState, useEffect, useCallback } from "react";
import principalImg from "../../Images/Dr.R. Gopalakrishnan.jpg";
import palaniappanImg from "../../Images/Dr.A.Palaniappan.jpg";
import mythiliImg from "../../Images/MYTHILI MAM.png";
import rajkumarImg from "../../Images/Rajkumar.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, Award, ChevronRight, MapPin, Mail, Phone, Calendar, Sparkles, X, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { format } from "date-fns";
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import EventCard from "@/components/landing/EventCard";
import AwardCard from "@/components/landing/AwardCard";
import { motion, AnimatePresence } from "framer-motion";
import { buildImageUrl } from "@/utils/imageUtils";

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
          const allEvents = [...response.events].sort((a: any, b: any) => {
            try {
              return new Date(b.date).getTime() - new Date(a.date).getTime();
            } catch {
              return 0;
            }
          });
          setUpcomingEvents(allEvents);
        }
      } catch (error) {
        // Silently fail - landing page should work even without auth
        console.log('Events not available:', error);
      } finally {
        setLoadingEvents(false);
      }
    };
    loadUpcomingEvents();
    const t = setTimeout(() => setPageReady(true), 250);
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary"
                ></motion.div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Heart className="w-6 h-6 text-primary" />
                  </motion.div>
                </div>
              </div>
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-lg font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"
              >
                Preparing Experience…
              </motion.span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section - Reference Site Style with Background Image */}
      <section className="relative w-full min-h-[600px] md:min-h-[700px] overflow-hidden z-10 flex items-center justify-center">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          {/* Fallback gradient if image doesn't load */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900"></div>

          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
            style={{
              backgroundImage: 'url("/images/Home.jpg")',
              filter: 'brightness(1)',
            }}
          />
          {/* Very light overlay for text contrast - Maximum transparency */}
          <div className="absolute inset-0 bg-black/10"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-20 md:py-32 text-center text-white">
          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="max-w-4xl mx-auto space-y-8"
          >
            <br></br> <br></br><br></br>
            <motion.h1
              variants={fadeInUp}
              className="text-4xl sm:text-6xl md:text-8xl font-black drop-shadow-2xl tracking-tighter px-4"
            >
              <span className="text-[#1a237e] dark:text-[#3f51b5]">SM</span>{" "}
              <span className="bg-gradient-to-r from-[#ff6d00] to-[#ffab40] bg-clip-text text-transparent">
                VOLUNTEERS
              </span>
            </motion.h1>
            <motion.p
              variants={fadeInUp}
              className="text-xl md:text-2xl text-blue-100/90 font-medium italic drop-shadow-lg"
            >
              To build the ministry of socially responsible volunteers who can serve society with a passion
            </motion.p>

            {/* CTA Buttons - Removed for cleaner look matching image */}
            <motion.div
              variants={fadeInUp}
              className="flex flex-wrap gap-5 pt-12 justify-center"
            >
              <Button
                size="lg"
                className="bg-white text-blue-900 hover:bg-blue-50 shadow-2xl hover:shadow-blue-500/50 transform hover:scale-105 transition-all duration-300 px-10 py-7 text-lg font-bold rounded-2xl"
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
        className="py-32 relative overflow-hidden z-10 bg-slate-50 dark:bg-slate-950"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          {/* About SM Volunteers */}



          {/* About SM Volunteers - Styled like KSRCT */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mt-20 mb-20"
          >
            <div className="grid lg:grid-cols-12 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="lg:col-span-7 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-6 sm:p-10 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 relative h-full flex flex-col justify-center order-2 lg:order-1"
              >
                <h3 className="text-xl sm:text-2xl font-bold mb-6 text-blue-600 flex items-center gap-2">
                  <span className="w-8 h-1 bg-blue-600 rounded-full"></span>
                  Service Motto Volunteers
                </h3>
                <div className="space-y-4">
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-base sm:text-lg text-justify font-medium">
                    Service Motto volunteers (SM Volunteers) started their journey on <strong className="text-blue-600">October 5, 2021</strong>. What began as a small group of passionate students has grown into a powerful movement within the KSRCT campus. Our primary objective is to bridge the gap between students and social service, fostering a sense of responsibility and compassion.
                  </p>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-base sm:text-lg text-justify font-medium">
                    Through strategic collaborations with NGOs like <strong className="text-blue-600">Bhumi</strong>, we engage in diverse activities including education support, women empowerment, environmental protection, and community health. We don't just volunteer; we build leadership, empathy, and lifelong skills.
                  </p>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-base sm:text-lg text-justify font-medium">
                    Volunteering is a service which is done to fix the dents of society. SM volunteers main motto is to foster a society.
                  </p>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-base sm:text-lg text-justify font-medium">
                    We have received honourable awards like Leelavati under women and adolescent health for the year 2021 and the Bhumi award for Best Volunteering Engagement for the year 2022.
                  </p>
                </div>
                <div className="absolute top-4 right-4 text-blue-100 dark:text-blue-900/20 opacity-40">
                  <Heart className="w-12 h-12 sm:w-16 sm:h-16 fill-current" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="lg:col-span-5 relative group order-1 lg:order-2 flex justify-center items-center"
              >
                <div className="absolute -inset-4 bg-blue-600/10 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div
                  className="cursor-pointer relative z-10"
                  onClick={() => window.location.reload()}
                >
                  <img
                    src="/Images/Picsart_23-05-18_16-47-20-287-removebg-preview.png"
                    alt="SM Volunteers Logo"
                    className="w-64 h-64 sm:w-80 sm:h-80 object-contain drop-shadow-2xl hover:scale-110 transition-transform duration-500"
                    onError={(e) => {
                      const fallback = '/Images/Brand_logo.png';
                      if (!e.currentTarget.src.includes(fallback)) {
                        e.currentTarget.src = fallback;
                      }
                    }}
                  />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-blue-600/10 z-0 animate-pulse"></div>
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
              <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white mb-4 tracking-tighter">
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
                className="h-1 bg-primary mx-auto mt-4 rounded-full"
              ></motion.div>
            </div>

            {/* Stats Grid */}
            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
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
                  className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-200 dark:border-slate-700 text-center hover:scale-105 transition-transform"
                >
                  <div className="text-3xl md:text-4xl font-black text-primary mb-2 tracking-tighter">{stat.value}</div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>

            {/* KSRCT Description & Image */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="relative group"
              >
                <div className="absolute -inset-4 bg-primary/20 blur-2xl rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <img
                  src="/images/Home.jpg"
                  alt="KSRCT Main Building"
                  className="rounded-3xl shadow-2xl relative z-10 w-full object-cover h-[450px]"
                />
                <div className="absolute inset-0 rounded-3xl border-2 border-primary/30 z-20 pointer-events-none"></div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="bg-slate-900 text-white p-8 md:p-10 rounded-3xl shadow-2xl border border-slate-800 relative h-full flex flex-col justify-center"
              >
                <h3 className="text-2xl font-bold mb-6 text-primary flex items-center gap-2">
                  <span className="w-8 h-1 bg-primary rounded-full"></span>
                  K.S.Rangasamy College of Technology
                </h3>
                <p className="text-slate-300 leading-relaxed text-lg text-justify font-medium">
                  K.S.Rangasamy College of Technology (KSRCT) was started in 1994. Located near Tiruchengode, Tamil Nadu, it offers quality technical education with 14 U.G., 11 P.G. and 12 Ph.D. programs. Approved by AICTE and affiliated with Anna University, Chennai, KSRCT has Autonomous status from UGC. It ranked 99th in NIRF 2017 and 51-100 band in NIRF Innovation Ranking 2023 for Engineering. Accredited with NAAC A++ grade and NBA Tier 1 departments, it features modern infrastructure including AICTE-IDEA Lab, ATAL Community Innovation Centre, and MSME Incubation centre. With NTTM funding of 8.5 crore rupees, it fosters cutting-edge research and collaborates with DST, DBT, DAE, CSIR, DRDO, and ISRO.
                </p>
                <div className="absolute top-4 right-4 text-slate-700 opacity-20">
                  <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" /></svg>
                </div>
              </motion.div>
            </div>
          </motion.div>

        </div>
      </section>

      {/* Events Section */}
      <section
        id="events-section"
        className="py-20 md:py-28 bg-gradient-to-br from-background via-muted/20 to-primary/5"
      >
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full border border-border mb-4">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">What's Happening</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Upcoming Events & Activities
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Join us for these exciting opportunities to make a difference. Every event is a chance to connect, learn, and create impact together.
            </p>
          </motion.div>

          {loadingEvents ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[400px] w-full bg-muted animate-pulse rounded-3xl shadow-sm"></div>
              ))}
            </div>
          ) : upcomingEvents.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="embla overflow-hidden"
              ref={eventsRef}
            >
              <div className="embla__container flex">
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="embla__slide flex-[0_0_100%] md:flex-[0_0_48%] lg:flex-[0_0_32%] min-w-0 px-4">
                    <EventCard
                      event={event}
                      eventDate={new Date(event.date)}
                      isToday={new Date(event.date).toDateString() === new Date().toDateString()}
                      isThisWeek={new Date(event.date).getTime() - new Date().getTime() <= 7 * 24 * 60 * 60 * 1000}
                      isPast={new Date(event.date).getTime() < new Date().getTime()}
                      onImageClick={setSelectedEventImage}
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="text-center py-20 bg-white/50 backdrop-blur-sm rounded-[3rem] border-4 border-dashed border-slate-200">
              <Activity className="w-20 h-20 mx-auto text-slate-300 mb-6 animate-bounce" />
              <p className="text-slate-900 text-2xl font-black tracking-tight mb-2">No upcoming events</p>
              <p className="text-slate-500 font-medium">We're planning something incredible. Stay tuned!</p>
            </div>
          )}
        </div>
      </section>

      {/* Awards Section */}
      <section
        id="awards-section"
        className="py-20 md:py-28 bg-gradient-to-br from-yellow-50/50 via-background to-amber-50/30 dark:from-yellow-950/10 dark:via-background dark:to-amber-900/10"
      >
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100/50 dark:bg-yellow-900/30 rounded-full border border-yellow-200 dark:border-yellow-800 mb-4">
              <Award className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <span className="text-sm font-semibold text-yellow-900 dark:text-yellow-200">Celebrating Success</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Awards & Recognition
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Every award tells a story—a story of dedication, impact, and the incredible difference our volunteers make. These aren't just trophies; they're proof that when students come together, amazing things happen.
            </p>
          </motion.div>

          {loadingAwards ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[350px] w-full bg-muted animate-pulse rounded-3xl shadow-sm"></div>
              ))}
            </div>
          ) : awards.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="overflow-hidden relative group"
            >
              <div className="flex animate-marquee gap-6 py-4">
                {/* Double the items to create a seamless loop */}
                {[...awards, ...awards].map((award, index) => (
                  <div key={`${award.id}-${index}`} className="w-[300px] sm:w-[350px] flex-shrink-0">
                    <AwardCard
                      award={award}
                      awardDate={new Date(award.award_date)}
                      onImageClick={setSelectedAwardImage}
                    />
                  </div>
                ))}
              </div>
              {/* Optional: Add gradient overlays for a smoother fade at edges */}
              <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-background to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-background to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </motion.div>
          ) : (
            <div className="text-center py-20 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-[3rem] border-4 border-dashed border-yellow-200">
              <Award className="w-20 h-20 mx-auto text-yellow-200 mb-6" />
              <p className="text-slate-900 dark:text-white text-2xl font-black tracking-tight mb-2">Awards arriving soon</p>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Recognition for our incredible community impact.</p>
            </div>
          )}
        </div>
      </section>

      {/* Leadership Section */}
      <section className="w-full py-16 md:py-24 bg-muted/10">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4 text-primary">Leadership</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
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
                      "Our institution is committed to producing engineers who are not just technically competent but also socially responsible."
                    </p>
                    <div className="space-y-4 text-base bg-muted/30 p-5 rounded-xl border border-border/50">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Mail className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-foreground font-semibold break-all">principal@ksrct.ac.in</span>
                      </div>
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
      <section id="coordinators-section" className="w-full py-16 md:py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-black mb-4 text-primary tracking-tight">Faculty Coordinators</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto font-medium">
              Meet our team of dedicated faculty members who coordinate and guide the SM Volunteers mission.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {facultyCoordinators.map((coordinator, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                className="h-full"
              >
                <Card className="bg-card border-border/50 overflow-hidden hover:shadow-xl transition-all group h-full flex flex-col items-center text-center rounded-2xl">
                  <div className="w-full bg-muted/20 flex items-center justify-center p-8 border-b border-border/50 relative overflow-hidden">
                    <div className="absolute inset-0 dot-grid opacity-10"></div>
                    <div className="w-40 h-40 rounded-full border-4 border-primary/20 overflow-hidden shadow-xl group-hover:scale-110 transition-transform duration-500 relative z-10">
                      <img
                        src={coordinator.image}
                        alt={coordinator.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "/Images/Brand_logo.png";
                        }}
                      />
                    </div>
                  </div>
                  <div className="p-8 space-y-4 flex-grow flex flex-col">
                    <div>
                      <h3 className="text-2xl font-black text-foreground mb-1">{coordinator.name}</h3>
                      <p className="text-primary font-bold uppercase tracking-wider text-sm">{coordinator.role}</p>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed font-medium flex-grow">
                      {coordinator.description}
                    </p>
                    <div className="pt-4 mt-auto">
                      <a
                        href={`mailto:${coordinator.email}`}
                        className="inline-flex items-center justify-center gap-2 text-sm text-foreground font-semibold bg-primary/5 py-2.5 px-6 rounded-full border border-primary/10 hover:bg-primary/20 transition-colors"
                      >
                        <Mail className="w-4 h-4 text-primary" />
                        <span>{coordinator.email}</span>
                      </a>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* NGO Partners Section */}
      <section
        id="ngo-section"
        className="py-16 md:py-24 bg-card"
      >
        <div className="max-w-7xl mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-4xl font-bold mb-4 text-center text-primary"
          >
            NGO Partners
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto font-medium"
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
                <Card className="bg-background border-border/50 transition-all hover:shadow-lg hover:scale-105 overflow-hidden flex flex-col rounded-lg hover:border-primary/30 h-full">
                  {ngo.logoUrl && (
                    <div className="h-36 flex items-center justify-center border-b border-border/50 overflow-hidden flex-shrink-0 p-4 bg-white/95 dark:bg-white/90">
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
                  <CardHeader className="text-center border-b border-border/50 bg-background">
                    <CardTitle className="text-lg text-foreground">{ngo.name}</CardTitle>
                    <CardDescription className="font-semibold text-muted-foreground">🎯 {ngo.focus}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    <p className="text-sm text-muted-foreground">{ngo.description}</p>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3 h-3 mt-0.5 text-primary" />
                        <span className="text-muted-foreground">{ngo.location}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Heart className="w-3 h-3 mt-0.5 text-primary" />
                        <span className="text-muted-foreground">{ngo.focus}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-3 flex-wrap">
                      {ngo.areas.map((area, i) => (
                        <span key={i} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded border border-primary/20">
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
        className="bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-white py-24 relative overflow-hidden"
      >
        {/* Background elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-px h-full bg-primary/20"></div>
          <div className="absolute top-0 right-1/4 w-px h-full bg-primary/20"></div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-6xl mx-auto px-4 text-center space-y-12 relative z-10"
        >
          <div className="space-y-4">
            <h2 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight">Ready to Make a Difference?</h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 font-medium max-w-2xl mx-auto">
              Join thousands of volunteers contributing to a better society through meaningful community service.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-6 justify-center">
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-xl transition-all transform hover:scale-105 px-10 py-7 rounded-xl text-lg"
              onClick={() =>
                isAuthenticated ? navigate(getDashboardPath()) : window.location.href = "/login"
              }
            >
              {isAuthenticated ? "Go to Dashboard" : "Login to Dashboard"}
            </Button>
            <Button
              size="lg"
              className="bg-orange-600 text-white hover:bg-orange-700 font-bold shadow-xl transition-all transform hover:scale-105 px-10 py-7 rounded-xl text-lg"
              onClick={() => navigate('/volunteer-registration')}
            >
              Register Now
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="bg-background/50 backdrop-blur-sm text-foreground hover:bg-muted border-2 border-primary/20 font-bold shadow-xl transition-all transform hover:scale-105 px-10 py-7 rounded-xl text-lg"
              onClick={() => setContactOpen(true)}
            >
              <Mail className="mr-2 w-5 h-5" /> Contact Us
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12 border-t border-border/50">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-bold text-lg">Location</h4>
              <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                K.S. Rangasamy College of Technology<br />
                Tiruchengode, Tamil Nadu, India - 637215
              </p>
            </div>
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-bold text-lg">Email Us</h4>
              <p className="text-muted-foreground text-sm font-medium">
                <a href="mailto:smvolunteers@ksrct.ac.in" className="hover:text-primary transition-colors">smvolunteers@ksrct.ac.in</a><br />
                <a href="mailto:principal@ksrct.ac.in" className="hover:text-primary transition-colors">principal@ksrct.ac.in</a>
              </p>
            </div>
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Phone className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-bold text-lg">Call Us</h4>
              <p className="text-muted-foreground text-sm font-medium">
                +91-99941 50505<br />
                +91-4288 274741
              </p>
            </div>
          </div>

          <div className="pt-8">
            <p className="text-primary font-black uppercase tracking-[0.3em] text-sm">
              K.S. Rangasamy College of Technology
            </p>
            <p className="text-muted-foreground text-xs mt-1 font-bold italic opacity-70">
              Approved by AICTE | Affiliated to Anna University | (Autonomous)
            </p>
          </div>
        </motion.div>
      </section>

      {/* Contact Dialog */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Contact Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground">Name</label>
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full mt-2 p-2 rounded-md border border-input bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Email</label>
              <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full mt-2 p-2 rounded-md border border-input bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Contact No</label>
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full mt-2 p-2 rounded-md border border-input bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none" placeholder="+91-" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Message</label>
              <textarea value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} className="w-full mt-2 p-2 rounded-md border border-input bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none" rows={5} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setContactOpen(false)}>Cancel</Button>
              <Button onClick={() => {
                // save message to localStorage for admin
                const store = localStorage.getItem('admin_messages');
                const arr = store ? JSON.parse(store) : [];
                const msg = {
                  id: Date.now(),
                  name: contactName,
                  email: contactEmail,
                  phone: contactPhone,
                  message: contactMessage,
                  created_at: new Date().toISOString(),
                  read: false
                };
                arr.unshift(msg);
                localStorage.setItem('admin_messages', JSON.stringify(arr));
                // Trigger notification update
                window.dispatchEvent(new Event('adminMessage'));
                toast.success('Message sent to admin');
                setContactName(''); setContactEmail(''); setContactPhone(''); setContactMessage(''); setContactOpen(false);
              }}>Send</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Coordinator Modal Removed */}

      {/* Event Image Full View Dialog */}
      <Dialog open={selectedEventImage !== null} onOpenChange={() => setSelectedEventImage(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 bg-card border-border">
          {selectedEventImage && (
            <div className="relative">
              <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-border p-6 z-10 shadow-sm flex justify-between items-start">
                <div>
                  <DialogTitle className="text-2xl font-bold text-foreground mb-1">{selectedEventImage.title}</DialogTitle>
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(selectedEventImage.date), "EEEE, MMMM do, yyyy")}
                    {selectedEventImage.location && (
                      <>
                        <span>•</span>
                        <MapPin className="w-4 h-4" />
                        {selectedEventImage.location}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {(() => {
                    const eventDate = new Date(selectedEventImage.date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const isUpcoming = eventDate >= today;

                    return isUpcoming ? (
                      <Button
                        onClick={() => {
                          setSelectedEventForVolunteer(selectedEventImage);
                          setShowVolunteerForm(true);
                        }}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg"
                      >
                        Volunteer
                      </Button>
                    ) : null;
                  })()}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedEventImage(null)}
                    className="hover:bg-muted rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="p-6 space-y-6"
              >
                <div className="prose dark:prose-invert max-w-none">
                  <p className="text-lg leading-relaxed text-foreground/90">{selectedEventImage.description}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-xl border border-border/50">
                  <div>
                    <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      Event Details
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex justify-between border-b border-border/50 pb-2">
                        <span>Category:</span>
                        <span className="font-medium text-foreground">{selectedEventImage.category || 'General'}</span>
                      </li>
                      <li className="flex justify-between border-b border-border/50 pb-2">
                        <span>Time:</span>
                        <span className="font-medium text-foreground">{selectedEventImage.time || 'All Day'}</span>
                      </li>
                      <li className="flex justify-between border-b border-border/50 pb-2">
                        <span>Organizer:</span>
                        <span className="font-medium text-foreground">{selectedEventImage.organizer || 'SM Volunteers'}</span>
                      </li>
                    </ul>
                  </div>

                  {selectedEventImage.image_url && (
                    <div className="flex items-center justify-center bg-background rounded-lg border border-border/50 p-2">
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
                        const imageUrl = buildImageUrl(selectedEventImage.image_url);
                        return imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={selectedEventImage.title}
                            className="max-h-64 rounded shadow-sm object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
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
    </motion.div>
  );
};

const facultyCoordinators = [
  {
    name: "Dr. G. Mythili",
    role: "Faculty Coordinator",
    email: "mythili@ksrct.ac.in",
    image: mythiliImg,
    description: "Dr. G. Mythili has been a pillar of strength for SM Volunteers, guiding students with her expertise in community service and social impact."
  },
  {
    name: "Mr. S. Rajkumar",
    role: "Faculty Coordinator",
    email: "rajkumar@ksrct.ac.in",
    image: rajkumarImg,
    description: "Mr. S. Rajkumar actively coordinates various social initiatives and ensures the smooth functioning of volunteer activities across the campus."
  },
  {
    name: "Dr. A. Palaniappan",
    role: "Faculty Coordinator",
    email: "palaniappan@ksrct.ac.in",
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
export default LandingPage;
