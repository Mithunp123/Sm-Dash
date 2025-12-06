import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeveloperCredit from "@/components/DeveloperCredit";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const VolunteerRegistration = () => {
  const navigate = useNavigate();
  // signature upload instead of canvas
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [signatureCollected, setSignatureCollected] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    year: "",
    department: "",
    category: "",
    registration_date: new Date().toISOString().split('T')[0],
    terms_accepted: false,
  });

  const [loading, setLoading] = useState(false);

  const categories = [
    "Event Management",
    "Content Creation",
    "Community Outreach",
    "Fundraising",
    "Technical Support",
    "Mentoring",
    "Administration",
    "Other"
  ];

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      category: value
    }));
  };

  const handleSignatureFile = (file?: File) => {
    if (!file) return;
    const allowed = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowed.includes(file.type)) {
      toast.error("Please upload a PNG or JPEG image for signature");
      return;
    }
    if (file.size > 1024 * 1024 * 2) { // 2MB limit
      toast.error("Signature file too large (max 2MB)");
      return;
    }
    setSignatureFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setSignaturePreview(reader.result as string);
      setSignatureCollected(true);
    };
    reader.readAsDataURL(file);
  };

  const clearSignature = () => {
    setSignatureFile(null);
    setSignaturePreview(null);
    setSignatureCollected(false);
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.year || !formData.department || !formData.category) {
      toast.error("All fields are required");
      return;
    }

    if (!signatureCollected) {
      toast.error("Please provide your signature");
      return;
    }

    if (!formData.terms_accepted) {
      toast.error("You must accept the terms and conditions");
      return;
    }

    try {
      setLoading(true);

      const signature = signaturePreview || null;

      const payload = {
        name: formData.name,
        email: formData.email,
        year: formData.year,
        department: formData.department,
        category: formData.category,
        registration_date: formData.registration_date,
        signature: signature,
      };

      // Save submission to localStorage so admin can review
      try {
        const existingJson = localStorage.getItem('volunteer_submissions');
        const existing = existingJson ? JSON.parse(existingJson) : [];
        const submission = {
          id: Date.now(),
          ...payload,
          status: 'pending',
          created_at: new Date().toISOString(),
        };
        existing.unshift(submission);
        localStorage.setItem('volunteer_submissions', JSON.stringify(existing));
        // Trigger notification update
        window.dispatchEvent(new Event('volunteerSubmission'));
        console.log('✅ Submission saved to localStorage:', submission);
        console.log('📊 Total submissions now:', existing.length);
      } catch (e) {
        console.error('❌ Failed to save submission locally', e);
      }

      toast.success("Successfully registered as a volunteer! ✅");
      setTimeout(() => {
        navigate("/");
      }, 1200);
    } catch (error: any) {
      console.error("Registration error:", error);
      toast.error(error.message || "Failed to register");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />
      
      <div className="flex-1 px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>

          <Card className="shadow-lg">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-lg">
              <CardTitle className="text-2xl">Join SM Volunteers</CardTitle>
              <CardDescription className="text-orange-100">
                Register to become an active member of SM Volunteers
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Information Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-slate-800">Personal Information</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Enter your full name"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="email">Email ID *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="your.email@example.com"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="year">Year *</Label>
                        <Select value={formData.year} onValueChange={(value) => setFormData(prev => ({ ...prev, year: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">First Year</SelectItem>
                            <SelectItem value="2">Second Year</SelectItem>
                            <SelectItem value="3">Third Year</SelectItem>
                            <SelectItem value="4">Fourth Year</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="department">Department *</Label>
                        <Input
                          id="department"
                          name="department"
                          value={formData.department}
                          onChange={handleInputChange}
                          placeholder="e.g., CSE, ECE, Mech"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="registration_date">Registration Date *</Label>
                      <Input
                        id="registration_date"
                        name="registration_date"
                        type="date"
                        value={formData.registration_date}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Category Selection */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4 text-slate-800">Interest Area *</h3>
                  <Label htmlFor="category">Select Category (Max 2 spots available)</Label>
                  <Select value={formData.category} onValueChange={handleSelectChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose your area of interest" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-slate-500 mt-2">
                    Each category has only 2 spots. You need to balance your academic and SM responsibilities.
                  </p>
                </div>

                {/* Signature */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4 text-slate-800">Signature *</h3>
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-slate-50 border border-dashed border-slate-300">
                      <input
                        id="signature-file"
                        type="file"
                        accept="image/png, image/jpeg"
                        onChange={(e) => {
                          const f = e.target.files && e.target.files[0];
                          if (f) handleSignatureFile(f);
                        }}
                        className="w-full"
                      />
                      {signaturePreview && (
                        <div className="mt-3">
                          <img src={signaturePreview} alt="signature preview" className="max-h-40 object-contain border rounded" />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('signature-file')?.click()}
                      >
                        Upload Signature
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={clearSignature}
                      >
                        Clear
                      </Button>
                    </div>
                    {signatureCollected && (
                      <p className="text-sm text-green-600 flex items-center gap-2">
                        ✓ Signature uploaded
                      </p>
                    )}
                  </div>
                </div>

                {/* Terms and Conditions */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4 text-slate-800">Terms & Conditions</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 space-y-2 max-h-64 overflow-y-auto">
                    <p className="font-semibold text-slate-800">By joining SM Volunteers, you agree to:</p>
                    <ul className="list-disc list-inside space-y-2 text-slate-700 text-sm">
                      <li>Attend regular meetings and events as scheduled</li>
                      <li>Actively participate in volunteer activities</li>
                      <li><strong>Balance your academic responsibilities with SM activities</strong></li>
                      <li>Maintain professional conduct during all volunteer work</li>
                      <li>Respect the diversity and values of the organization</li>
                      <li><strong>Inactivity Policy:</strong> Members inactive for 1 month may be relieved from their position</li>
                      <li>You will receive notice if you are about to be marked inactive</li>
                      <li>Inform administration about any leave or absence</li>
                      <li>Each category has maximum 2 members for quality contribution</li>
                    </ul>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="terms"
                      checked={formData.terms_accepted}
                      onCheckedChange={(checked) =>
                        setFormData(prev => ({
                          ...prev,
                          terms_accepted: checked as boolean
                        }))
                      }
                    />
                    <Label htmlFor="terms" className="text-sm cursor-pointer">
                      I have read and agree to the terms and conditions above
                    </Label>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex gap-3 pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/")}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-orange-500 hover:bg-orange-600"
                  >
                    {loading ? "Registering..." : "Register as Volunteer"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
      <DeveloperCredit />
    </div>
  );
};

export default VolunteerRegistration;
