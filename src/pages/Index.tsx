import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { useNavigate } from "react-router-dom";
import { Users, Heart, Award, BookOpen, ArrowDown, FileText, BarChart3, Calendar } from "lucide-react";
import { useRef, useEffect } from "react";
import { auth } from "@/lib/auth";

const Index = () => {
  const navigate = useNavigate();
  const aboutRef = useRef<HTMLDivElement>(null);

  // Don't auto-redirect authenticated users - let them stay on landing page if they want
  // They can use the header to navigate to their dashboard

  const scrollToAbout = () => {
    aboutRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <DeveloperCredit />
      
      <main className="flex-1">
        {/* Hero Section with Logos */}
        <section className="relative py-20 px-4 overflow-hidden min-h-[90vh] flex items-center">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0A192F] via-[#121A26] to-[#0A192F]"></div>
          <div className="absolute inset-0 gradient-primary opacity-20"></div>
          
          <div className="container mx-auto text-center relative z-10">
            {/* Logo Section */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12 mb-12 animate-fade-in">
              {/* KSRCT Logo */}
              <div className="logo-container group">
                <div className="w-32 h-32 md:w-40 md:h-40 bg-card/50 rounded-lg flex items-center justify-center border-2 border-primary/30 hover:border-primary transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgb(255,122,0)] overflow-hidden">
                  <img 
                    src="Images/Brand_logo.png" 
                    alt="K.S.Rangasamy College of Technology"
                    className="w-full h-full object-contain p-2"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      if (target.nextElementSibling) {
                        (target.nextElementSibling as HTMLElement).style.display = 'block';
                      }
                    }}
                  />
                  <span className="text-2xl md:text-3xl font-bold text-primary hidden">KSRCT</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">K.S.Rangasamy College</p>
              </div>

              {/* SM Volunteers Logo - Center */}
              <div className="logo-container group">
                <div className="w-40 h-40 md:w-48 md:h-48 bg-card/50 rounded-lg flex items-center justify-center border-2 border-accent/30 hover:border-accent transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgb(0,184,107)] overflow-hidden">
                  <img 
                    src="Images/Picsart_23-05-18_16-47-20-287-removebg-preview.png" 
                    alt="SM Volunteers"
                    className="w-full h-full object-contain p-2"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      if (target.nextElementSibling) {
                        (target.nextElementSibling as HTMLElement).style.display = 'block';
                      }
                    }}
                  />
                  <span className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary via-accent to-violet bg-clip-text text-transparent hidden">SMV</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">SM Volunteers</p>
              </div>

              {/* NGO Logos */}
              <div className="logo-container group">
                <div className="w-32 h-32 md:w-40 md:h-40 bg-card/50 rounded-lg flex items-center justify-center border-2 border-violet/30 hover:border-violet transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgb(156,106,255)] p-2 overflow-hidden relative">
                  <div className="grid grid-cols-3 gap-1 w-full h-full">
                    <div className="flex items-center justify-center">
                      <img 
                        src="Images/original logo.png" 
                        alt="Atchaym Trust"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-center">
                      <img 
                        src="Images/Bhumi logo.png" 
                        alt="Bhumi"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-center">
                      <img 
                        src="Images/TQI_logo-removebg-preview.png" 
                        alt="Talent Quest for India"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-xs md:text-sm font-semibold text-violet text-center space-y-1 absolute opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 p-2 rounded">
                    <div>Atchaym Trust</div>
                    <div>Bhumi</div>
                    <div>TQI</div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">NGO Partners</p>
              </div>
            </div>

            {/* Title and Tagline */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-violet bg-clip-text text-transparent animate-fade-in">
              SM Volunteers
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-4 animate-fade-in">
              K.S.Rangasamy College of Technology
            </p>
            
            {/* Tagline with Glow Animation */}
            <div className="mb-12 animate-fade-in">
              <p className="tagline text-2xl md:text-3xl font-semibold text-accent mb-8">
                🕊 "Fostering Society."
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center animate-fade-in">
              <Button 
                onClick={() => navigate("/login")}
                className="glow-primary hover:scale-105 transition-transform bg-primary text-primary-foreground"
                size="lg"
              >
                Login
              </Button>
              <Button 
                onClick={scrollToAbout}
                variant="outline" 
                size="lg"
                className="border-accent text-accent hover:bg-accent hover:text-background transition-all"
              >
                Know More
                <ArrowDown className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* Portal Features Section - KSRCT DigiPro Style */}
        <section ref={aboutRef} className="py-16 px-4 bg-gradient-to-b from-secondary/30 to-background">
          <div className="container mx-auto">
            <h2 className="text-3xl font-bold text-center mb-4 text-primary">SM Volunteers Portal</h2>
            <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
              A unified portal for volunteer management and community engagement
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer group">
                <CardHeader>
                  <Users className="w-12 h-12 text-primary mb-2 group-hover:scale-110 transition-transform" />
                  <CardTitle>Volunteer Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Manage volunteers and coordinators with role-based access control
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="gradient-card border-border/50 hover:glow-accent transition-all hover:scale-105 cursor-pointer group">
                <CardHeader>
                  <Calendar className="w-12 h-12 text-accent mb-2 group-hover:scale-110 transition-transform" />
                  <CardTitle>Meetings</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Schedule meetings, track attendance, and manage events efficiently
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer group">
                <CardHeader>
                  <FileText className="w-12 h-12 text-violet mb-2 group-hover:scale-110 transition-transform" />
                  <CardTitle>Bills</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Submit bills, track expenses, and generate comprehensive reports
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="gradient-card border-border/50 hover:glow-accent transition-all hover:scale-105 cursor-pointer group">
                <CardHeader>
                  <BarChart3 className="w-12 h-12 text-primary mb-2 group-hover:scale-110 transition-transform" />
                  <CardTitle>Analytics Dashboard</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    View participation statistics, trends, and performance metrics
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 cursor-pointer group">
                <CardHeader>
                  <Award className="w-12 h-12 text-accent mb-2 group-hover:scale-110 transition-transform" />
                  <CardTitle>Alumni Network</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Track alumni achievements, contributions, and maintain connections
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="gradient-card border-border/50 hover:glow-accent transition-all hover:scale-105 cursor-pointer group">
                <CardHeader>
                  <BookOpen className="w-12 h-12 text-violet mb-2 group-hover:scale-110 transition-transform" />
                  <CardTitle>Project Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Manage NGO projects, track time, and coordinate volunteer activities
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section className="py-16 px-4 bg-secondary/30">
          <div className="container mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12 text-primary">About SM Volunteers</h2>
            <div className="max-w-4xl mx-auto mb-12">
              <p className="text-lg text-muted-foreground text-center leading-relaxed">
                SM Volunteers is a dedicated forum at K.S.Rangasamy College of Technology committed to fostering 
                social responsibility and community engagement. We partner with leading NGOs including Atchaym Trust, 
                Bhumi, and Talent Quest for India (TQI) to create meaningful impact in society. Our mission is to 
                empower students to become responsible citizens through volunteer activities, community service, and 
                social initiatives.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="gradient-card border-border/50 hover:glow-accent transition-all hover:scale-105">
                <CardHeader>
                  <Users className="w-12 h-12 text-primary mb-2" />
                  <CardTitle>Community Service</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Engaging students in meaningful community service activities
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="gradient-card border-border/50 hover:glow-accent transition-all hover:scale-105">
                <CardHeader>
                  <Heart className="w-12 h-12 text-accent mb-2" />
                  <CardTitle>NGO Partnerships</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Collaborating with Atchaym Trust, Bhumi, and TQI
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="gradient-card border-border/50 hover:glow-accent transition-all hover:scale-105">
                <CardHeader>
                  <Award className="w-12 h-12 text-violet mb-2" />
                  <CardTitle>Recognition</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Acknowledging outstanding volunteer contributions
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="gradient-card border-border/50 hover:glow-accent transition-all hover:scale-105">
                <CardHeader>
                  <BookOpen className="w-12 h-12 text-primary mb-2" />
                  <CardTitle>Skill Development</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Building leadership and social responsibility
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Leadership Section */}
        <section className="py-16 px-4">
          <div className="container mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12 text-primary">Leadership</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {/* Patron */}
              <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105">
                <CardHeader className="text-center">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border-2 border-primary/30 overflow-hidden">
                    <img 
                      src="Images/Dr.R. Gopalakrishnan.jpg" 
                      alt="Dr.Gopalakrish"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        if (target.parentElement) {
                          const icon = document.createElement('div');
                          icon.innerHTML = '<svg class="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>';
                          target.parentElement.appendChild(icon);
                        }
                      }}
                    />
                  </div>
                  <CardTitle className="text-accent">Patron</CardTitle>
                  <CardDescription className="text-lg font-semibold">Dr. Gopal</CardDescription>
                </CardHeader>
              </Card>

              {/* Coordinator */}
              <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105">
                <CardHeader className="text-center">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-accent/20 to-violet/20 flex items-center justify-center border-2 border-accent/30 overflow-hidden">
                    <img 
                      src="Images/Dr.A.Palaniappan.jpg" 
                      alt="Dr.Palaniappan A"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        if (target.parentElement) {
                          const icon = document.createElement('div');
                          icon.innerHTML = '<svg class="w-12 h-12 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>';
                          target.parentElement.appendChild(icon);
                        }
                      }}
                    />
                  </div>
                  <CardTitle className="text-accent">Coordinator</CardTitle>
                  <CardDescription className="text-lg font-semibold">Mr. Palaniappan</CardDescription>
                </CardHeader>
              </Card>

              {/* Forum Leaders */}
              <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105">
                <CardHeader className="text-center">
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet/20 to-primary/20 flex items-center justify-center border-2 border-violet/30 overflow-hidden">
                      <img 
                        src="/images/coordinators/gopalakrishnan.jpg" 
                        alt="GopalaKrishnan"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet/20 to-primary/20 flex items-center justify-center border-2 border-violet/30 overflow-hidden">
                      <img 
                        src="Images/MYTHILI MAM.jpg" 
                        alt="Dr.Mythili Gnanmangai"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet/20 to-primary/20 flex items-center justify-center border-2 border-violet/30 overflow-hidden">
                      <img 
                        src="" 
                        alt="Mr.Raj Kumar S"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                  <CardTitle className="text-accent">Forum Leaders</CardTitle>
                  <CardDescription className="text-base">
                    <div className="space-y-1">
                      <div>GopalaKrishnan</div>
                      <div>Mythili Gnanmangai</div>
                      <div>Raj Kumar</div>
                    </div>
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* NGO Partners */}
              <Card className="gradient-card border-border/50 hover:glow-primary transition-all hover:scale-105 md:col-span-2 lg:col-span-1">
                <CardHeader className="text-center">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border-2 border-primary/30">
                    <Heart className="w-12 h-12 text-primary" />
                  </div>
                  <CardTitle className="text-accent">NGO Partners</CardTitle>
                  <CardDescription className="text-base">
                    <div className="space-y-1">
                      <div>Atchaym Trust</div>
                      <div>Bhumi</div>
                      <div>Talent Quest for India</div>
                    </div>
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;

