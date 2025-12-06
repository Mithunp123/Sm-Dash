import { useState } from "react";
import principalImg from "../../Images/Dr.R. Gopalakrishnan.jpg";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { Heart, Users, Handshake, Award, ChevronRight, MapPin, Mail, Phone, User2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { auth } from "@/lib/auth";

const LandingPage = () => {
  const navigate = useNavigate();
  const [selectedPrincipal, setSelectedPrincipal] = useState(false);
  const [selectedCoordinator, setSelectedCoordinator] = useState<number | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMessage, setContactMessage] = useState("");

  const isAuthenticated = auth.isAuthenticated();
  const user = auth.getUser();

  const getDashboardPath = () => {
    const role = user?.role;
    if (role === "admin") return "/admin";
    if (role === "office_bearer") return "/office-bearer";
    if (role === "student") return "/student";
    return "/login";
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <DeveloperCredit />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-50 via-white to-rose-50 text-blue-900 py-12 md:py-20 overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-rose-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 max-w-lg">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-100 to-rose-100 rounded-full border border-blue-200/50">
              
                <span className="text-sm font-semibold text-blue-900">Fostering Society </span>
              </div>
              
              <h1 className="text-6xl md:text-7xl font-extrabold leading-tight bg-gradient-to-r from-blue-900 via-blue-700 to-rose-600 bg-clip-text text-transparent animate-fade-in">
                SM Volunteers
              </h1>
              
              <p className="text-2xl md:text-3xl font-bold text-blue-900 leading-relaxed">
                Building Better Communities Through Voluntary Service
              </p>
              
              <p className="text-lg md:text-xl text-blue-800/80 leading-relaxed">
                Join thousands of students making a real difference in society through dedicated volunteer work and community service.
              
              </p>
              
              <div className="flex flex-wrap gap-4 pt-2">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-rose-600 to-rose-700 text-white hover:from-rose-700 hover:to-rose-800 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 px-8 py-6 text-base font-semibold"
                  onClick={() =>
                    isAuthenticated ? navigate(getDashboardPath()) : navigate("/login")
                  }
                >
                  {isAuthenticated ? "Go to Dashboard" : "Get Started"}
                  <ChevronRight className="ml-2 w-5 h-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-blue-600 text-blue-700 hover:bg-blue-600 hover:text-white shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 px-8 py-6 text-base font-semibold"
                >
                  Learn More
                </Button>
                {!isAuthenticated && (
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 px-8 py-6 text-base font-semibold"
                  onClick={() => navigate("/volunteer-registration")}
                >
                  Register
                </Button>
                )}
              </div>
            </div>
            
            <div className="hidden md:block relative">
              <div className="relative rounded-2xl p-8 bg-gradient-to-br from-white/80 to-blue-50/50 backdrop-blur-sm border border-blue-200/50 shadow-2xl transform hover:scale-105 transition-transform duration-300">
                <div className="flex flex-col items-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-rose-400/10 rounded-2xl"></div>
                  <img
                    src="/Images/Picsart_23-05-18_16-47-20-287-removebg-preview.png"
                    alt="SM Volunteers Logo - Fostering Society"
                    className="w-full h-auto max-w-[500px] mb-4 object-contain relative z-10 drop-shadow-2xl"
                    onError={(e) => {
                      const fallback = '/Images/Brand_logo.png';
                      if (!e.currentTarget.src.includes(fallback)) {
                        e.currentTarget.src = fallback;
                      } else {
                        e.currentTarget.style.display = 'none';
                      }
                    }}
                  />
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-900 to-rose-600 bg-clip-text text-transparent mt-2 relative z-10">
                    SM Volunteers
                  </h2>
                  <p className="text-blue-700 text-center mt-2 font-semibold text-lg relative z-10">
                    Dedicated to Community Service
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* About College */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6 text-primary">About KSRCT</h2>
              <p className="text-lg text-muted-foreground mb-4">
                K. S. Rangasamy College of Technology is a leading autonomous institution dedicated to engineering education and research excellence. Located in Tamil Nadu, KSRCT has been fostering technical education for over two decades.
              </p>
              <p className="text-lg text-muted-foreground mb-4">
                The college is committed to developing skilled professionals with strong ethical values and social responsibility. With state-of-the-art infrastructure and dedicated faculty, KSRCT prepares students to be leaders in their respective fields while contributing positively to society.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Award className="w-6 h-6 text-primary mt-1" />
                  <div>
                    <h4 className="font-semibold">Autonomous Status</h4>
                    <p className="text-muted-foreground text-sm">Accredited by NAAC and recognized nationally</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="w-6 h-6 text-primary mt-1" />
                  <div>
                    <h4 className="font-semibold">5000+ Students</h4>
                    <p className="text-muted-foreground text-sm">Across various engineering disciplines</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Handshake className="w-6 h-6 text-primary mt-1" />
                  <div>
                    <h4 className="font-semibold">Industry Partnerships</h4>
                    <p className="text-muted-foreground text-sm">Collaborating with leading companies</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-100 to-red-100 rounded-lg p-8 border-2 border-orange-200">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-orange-600 mb-6">KSRCT Highlights</h3>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-lg shadow">
                    <p className="font-semibold text-gray-800">Academic Excellence</p>
                    <p className="text-sm text-gray-600 mt-1">Comprehensive curriculum with modern teaching methods</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow">
                    <p className="font-semibold text-gray-800">Placements</p>
                    <p className="text-sm text-gray-600 mt-1">95%+ placement rate with top companies</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow">
                    <p className="font-semibold text-gray-800">Research</p>
                    <p className="text-sm text-gray-600 mt-1">Active research centers in emerging technologies</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow">
                    <p className="font-semibold text-gray-800">Social Responsibility</p>
                    <p className="text-sm text-gray-600 mt-1">Strong focus on community service and CSR</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About SM Volunteers */}
      <section className="bg-gray-50 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4 text-primary">About SM Volunteers</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A student-led initiative dedicated to making meaningful contributions to society
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            <Card className="gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-6 h-6 text-red-500" />
                  Our Mission
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  To empower students to become responsible citizens by engaging in meaningful volunteer work and community development activities.
                </p>
                <ul className="space-y-2 text-sm">
                  <li>✓ Build leadership and teamwork skills</li>
                  <li>✓ Create positive social impact</li>
                  <li>✓ Foster civic responsibility</li>
                  <li>✓ Connect with communities in need</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-6 h-6 text-blue-500" />
                  Our Vision
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  To create a sustainable volunteer ecosystem where students, NGOs, and communities work together for holistic development.
                </p>
                <ul className="space-y-2 text-sm">
                  <li>✓ 1000+ active volunteers</li>
                  <li>✓ 100+ projects annually</li>
                  <li>✓ 06+ NGO partnerships</li>
                  <li>✓ Measurable community impact</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-orange-500 hover:shadow-lg transition-shadow">
              <h3 className="text-2xl font-bold text-orange-600 mb-3">Education</h3>
              <p className="text-muted-foreground leading-relaxed">Providing educational support, scholarships, and skill development programs</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
              <h3 className="text-2xl font-bold text-blue-600 mb-3">Healthcare</h3>
              <p className="text-muted-foreground leading-relaxed">Organizing health camps, awareness programs, and medical assistance</p>
            </div>
          </div>
        </div>
      </section>

      {/* Principal Section */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-4xl font-bold mb-12 text-center text-orange-600">Leadership</h2>

          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-start max-w-6xl mx-auto">
            <Card className="bg-white border-border/50 overflow-hidden transition-all flex flex-col shadow-md rounded-lg h-full">
              <div className="flex items-center justify-center mt-6">
                <div
                  className="w-40 h-40 bg-white rounded-full border-2 border-orange-200 overflow-hidden shadow-md"
                  role="img"
                  aria-label="Principal photo"
                  style={{
                    backgroundImage: `url(${principalImg})`,
                    backgroundSize: 'cover',
                    backgroundPosition: '50% 14%'
                  }}
                />
              </div>
              <CardHeader className="text-center border-b bg-white mt-4 pb-4">
                <CardTitle className="text-2xl font-bold text-gray-800">Dr.R.Gopalakrishnan</CardTitle>
                <CardDescription className="text-sm font-semibold text-gray-600 mt-1">Principal, KSRCT</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 flex-grow flex flex-col justify-between pt-6 px-6 pb-6">
                <p className="text-center text-gray-700 leading-relaxed text-base">
                  With over 17 years of experience in higher education, Dr.R.Gopalakrishnan has been instrumental in positioning KSRCT as a leading institution in technical education.
                </p>
                <div className="space-y-3 text-sm bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-orange-600 flex-shrink-0" />
                    <span className="text-gray-700 break-all">principal@ksrct.ac.in</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-orange-600 flex-shrink-0" />
                    <span className="text-gray-700">+91-99941 50505</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">K. S. Rangasamy College of Technology, Tiruchengode</span>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full border-2 border-orange-300 hover:bg-orange-50 hover:text-orange-900 hover:border-orange-400 font-semibold transition-all"
                  onClick={() => setSelectedPrincipal(true)}
                >
                  View Full Profile
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-6 flex flex-col h-full">
              <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-md">
                <h3 className="text-2xl font-bold text-gray-800 mb-4">Principal's Vision</h3>
                <p className="text-base md:text-lg text-gray-700 leading-relaxed">
                  "Our institution is committed to producing engineers who are not just technically competent but also socially responsible. The SM Volunteers program exemplifies this commitment by encouraging our students to contribute meaningfully to society."
                </p>
              </div>
              <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-md flex-grow">
                <h4 className="font-bold text-lg text-orange-600 mb-4">Key Initiatives</h4>
                <ul className="space-y-3 text-base text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-xl">🎯</span>
                    <span>Holistic Development of Students</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-xl">🌍</span>
                    <span>Community Engagement Programs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-xl">💼</span>
                    <span>Industry-Academia Partnerships</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-xl">🏆</span>
                    <span>Excellence in Teaching & Research</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-xl">♻️</span>
                    <span>Sustainable Campus Development</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Coordinators Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-4xl font-bold mb-4 text-center text-blue-700">SM Volunteers Coordinators</h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto font-medium">
            Dedicated faculty members leading the SM Volunteers initiative
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coordinators.map((coord, idx) => (
              <Card key={idx} className="bg-white border-border/50 transition-all hover:shadow-lg hover:scale-105 cursor-pointer overflow-hidden flex flex-col rounded-lg"
                onClick={() => setSelectedCoordinator(idx)}>
                <div className="h-56 flex items-center justify-center overflow-hidden flex-shrink-0 p-3 bg-white rounded-md border border-gray-200">
                  <img 
                    src={coord.photoUrl} 
                    alt={coord.name} 
                    className="max-h-full max-w-full object-contain rounded-md bg-white"
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
                <CardHeader className="text-center border-b bg-white flex-grow">
                  <CardTitle className="text-xl text-gray-800">{coord.name}</CardTitle>
                  <CardDescription className="font-semibold text-gray-600">{coord.designation}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm pt-4 flex-grow">
                  <div className="flex items-center gap-2 justify-center">
                    <Mail className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-gray-700 text-xs">{coord.email}</span>
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <Phone className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-gray-700 text-xs">{coord.phone}</span>
                  </div>
                  <p className="text-xs text-gray-600 pt-2 text-center border-t pt-3">
                    📚 {coord.department} Department
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* NGO Partners Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-4xl font-bold mb-4 text-center text-orange-600">NGO Partners</h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto font-medium">
            Collaborating with leading organizations for community development
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ngoPartners.map((ngo, idx) => (
              <Card key={idx} className="bg-white border-border/50 transition-all hover:shadow-lg hover:scale-105 overflow-hidden flex flex-col rounded-lg">
                {ngo.logoUrl && (
                  <div className="h-36 flex items-center justify-center border-b border-gray-100 overflow-hidden flex-shrink-0 p-4 bg-white">
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
                <CardHeader className="text-center border-b bg-white">
                  <CardTitle className="text-lg text-gray-800">{ngo.name}</CardTitle>
                  <CardDescription className="font-semibold text-gray-600">🎯 {ngo.focus}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-gray-700">{ngo.description}</p>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3 h-3 mt-0.5 text-gray-600" />
                      <span className="text-gray-700">{ngo.location}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Heart className="w-3 h-3 mt-0.5 text-gray-600" />
                      <span className="text-gray-700">{ngo.focus}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-3">
                    {ngo.areas.map((area, i) => (
                      <span key={i} className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                        {area}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-white text-blue-900 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-4xl font-bold">Ready to Make a Difference?</h2>
          <p className="text-xl text-blue-700">
            Join thousands of volunteers contributing to a better society
          </p>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() =>
                isAuthenticated ? navigate(getDashboardPath()) : navigate("/login")
              }
            >
              {isAuthenticated ? "Go to Dashboard" : "Login to Dashboard"}
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="border-blue-900 text-blue-900 hover:bg-blue-50"
              onClick={() => setContactOpen(true)}
            >
              Contact Us
            </Button>
          </div>
        </div>
      </section>

      {/* Contact Dialog */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Contact Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Name</label>
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full mt-2 p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium">Email</label>
              <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full mt-2 p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium">Contact No</label>
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full mt-2 p-2 border rounded" placeholder="+91-" />
            </div>
            <div>
              <label className="block text-sm font-medium">Message</label>
              <textarea value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} className="w-full mt-2 p-2 border rounded" rows={5} />
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

      {/* Principal Modal */}
      <Dialog open={selectedPrincipal} onOpenChange={setSelectedPrincipal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="text-center">
            <DialogTitle className="text-3xl bg-gradient-to-r from-orange-600 to-red-500 bg-clip-text text-transparent">Dr.R.Gopalakrishnan</DialogTitle>
            <p className="text-base font-semibold text-orange-700 mt-2">Principal, KSRCT</p>
          </DialogHeader>
          <div className="space-y-6">
            <div className="h-64 rounded-xl flex items-center justify-center overflow-hidden shadow-lg p-4 bg-white">
              <div
                className="w-full h-full rounded-md"
                role="img"
                aria-label="Principal large photo"
                style={{
                  backgroundImage: `url(${principalImg})`,
                  backgroundSize: 'cover',
                  backgroundPosition: '50% 14%'
                }}
              />
            </div>
            <div className="space-y-5">
              <div className="bg-gradient-to-br from-orange-50 to-red-50 p-5 rounded-lg border border-orange-200/50">
                <h3 className="font-bold text-lg text-orange-700 mb-2">👨‍💼 About</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Dr.R.Gopalakrishnan is the Principal of K. S. Rangasamy College of Technology with over three decades of experience in academic leadership and engineering education. Under his visionary leadership, KSRCT has become one of the premier autonomous engineering institutions in South India.
                </p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-5 rounded-lg border border-blue-200/50">
                <h3 className="font-bold text-lg text-blue-700 mb-3">🏆 Achievements</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2"><span className="text-orange-600 font-bold">✓</span> Led KSRCT to achieve autonomous status</li>
                  <li className="flex items-start gap-2"><span className="text-orange-600 font-bold">✓</span> Established industry partnerships with global companies</li>
                  <li className="flex items-start gap-2"><span className="text-orange-600 font-bold">✓</span> Promoted research and innovation culture</li>
                  <li className="flex items-start gap-2"><span className="text-orange-600 font-bold">✓</span> Implemented student welfare programs</li>
                  <li className="flex items-start gap-2"><span className="text-orange-600 font-bold">✓</span> Enhanced infrastructure and academic facilities</li>
                </ul>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-5 rounded-lg border border-green-200/50">
                <h3 className="font-bold text-lg text-green-700 mb-3">📞 Contact Information</h3>
                <div className="space-y-2 text-sm grid grid-cols-1 md:grid-cols-2 gap-3">
                  <p className="text-gray-700"><span className="font-semibold text-green-700">📧 Email:</span><br/>principal@ksrct.ac.in</p>
                  <p className="text-gray-700"><span className="font-semibold text-green-700">📱 Phone:</span><br/>+91-99941 50505</p>
                  <p className="text-gray-700"><span className="font-semibold text-green-700">🏢 Office:</span><br/>Administrative Building</p>
                  <p className="text-gray-700"><span className="font-semibold text-green-700">📍 Address:</span><br/>KSRCT, Namakkal - 637215</p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Coordinator Modal */}
      <Dialog open={selectedCoordinator !== null} onOpenChange={() => setSelectedCoordinator(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedCoordinator !== null && (
            <>
              <DialogHeader>
                <DialogTitle>{coordinators[selectedCoordinator].name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div className="h-48 rounded-lg flex items-center justify-center overflow-hidden p-3 bg-white border border-gray-200">
                  <img 
                    src={coordinators[selectedCoordinator].photoUrl} 
                    alt={coordinators[selectedCoordinator].name} 
                    className="max-h-full max-w-full object-contain rounded-md bg-white"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Designation</h3>
                    <p className="text-muted-foreground">{coordinators[selectedCoordinator].designation}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Department</h3>
                    <p className="text-muted-foreground">{coordinators[selectedCoordinator].department}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Contact</h3>
                    <div className="space-y-2 text-sm bg-white p-4 rounded-lg border border-gray-200 text-gray-800">
                        <p><strong>Email:</strong> {coordinators[selectedCoordinator].email}</p>
                        <p><strong>Phone:</strong> {coordinators[selectedCoordinator].phone}</p>
                      </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Responsibilities</h3>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {coordinators[selectedCoordinator].responsibilities.map((resp, i) => (
                        <li key={i}>✓ {resp}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

// Coordinator Data
const coordinators = [
  {
    name: "Dr. B. MYTHILI GNANAMANGAI",
    designation: "Faculty Coordinator",
    department: "Bio Technology",
    email: "mythilignanamangai@ksrct.ac.in",
    phone: "+91-9487088678",
  photoUrl: "/Images/MYTHILI MAM.jpg",
    responsibilities: [
      "Overall supervision of SM Volunteers program",
      "Coordination with NGO partners",
      "Planning and organizing volunteer activities",
      "Student welfare and grievance redressal"
    ]
  },
  {
    name: "Mr.S.Raj Kumar",
    designation: "Faculty Coordinator",
    department: "Computer Science Engineering",
    email: "rajkumars@ksrct.ac.in",
    phone: "+91-9003718103",
  photoUrl: "/Images/Rajkumar.png",
    responsibilities: [
      "Event management and coordination",
      "Documentation and record keeping",
      "Student registration and tracking",
      "Communication with volunteers"
    ]
  },
  {
    name: "Dr.A.Palaniappan",
    designation: "Faculty Coordinator",
    department: "Department of English",
    email: "palaniappan@ksrct.ac.in",
    phone: "+91-98943 66121",
  photoUrl: "/Images/Dr.A.Palaniappan.jpg",
    responsibilities: [
      "Strategic planning and development",
      "Quality assurance of programs",
      "Mentor training and development",
      "Impact assessment and reporting"
    ]
  }
];

// NGO Partners Data
const ngoPartners = [
  {
    name: "Atchayam Trust",
    focus: "Begger Free India",
    description: "Providing a Beggar Free India.",
    location: "Erode",
  logoUrl: "/Images/ATCHAYAM TRUST.png",
    areas: ["Beggar Rehabilitation", "Rescuing", "Reintegration"]
  },
  {
    name: "Bhumi",
    focus: "Educational",
    description: "Working towards providing quality education for all.",
    location: "India",
  logoUrl: "/Images/Bhumi logo.png",
    areas: ["Education", "Awareness", "Career Guidance"]
  },
  {
    name: "Talent Quest India",
    focus: "Educational",
    description: "Working towards environmental conservation and sustainable development practices.",
    location: "Tamil Nadu",
  logoUrl: "/Images/TQI logo.png",
    areas: ["Education", "Growth", "Skill Development"]
  },
  
];

export default LandingPage;
