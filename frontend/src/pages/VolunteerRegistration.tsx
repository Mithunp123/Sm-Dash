import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import DeveloperCredit from "@/components/DeveloperCredit";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";

// Common departments list (same as Student Profile)
const DEPARTMENTS = [
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

const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-"
];

const VolunteerRegistration = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    register_no: "",
    year: "",
    department: "",
    phone: "",
    parent_phone: "",
    address: "",
    dob: "",
    blood_group: "",
    skills: "",
    experience: "",
    registration_date: new Date().toISOString().split("T")[0],
    terms_accepted: false,
  });

  const [loading, setLoading] = useState(false);

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (
      !formData.name ||
      !formData.email ||
      !formData.register_no ||
      !formData.year ||
      !formData.department ||
      !formData.phone ||
      !formData.parent_phone ||
      !formData.address ||
      !formData.dob ||
      !formData.blood_group ||
      !formData.skills ||
      !formData.experience
    ) {
      toast.error("All fields are required");
      return;
    }

    if (!formData.terms_accepted) {
      toast.error("You must accept the terms and conditions");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        name: formData.name,
        email: formData.email,
        register_no: formData.register_no,
        year: formData.year,
        department: formData.department,
        phone: formData.phone,
        parent_phone: formData.parent_phone,
        address: formData.address,
        dob: formData.dob,
        blood_group: formData.blood_group,
        skills: formData.skills,
        experience: formData.experience,
      };

      // Call API to create/update student account
      const response = await api.volunteerRegister(payload);

      if (response.success) {
        if (response.isNewUser) {
          toast.success("Successfully registered! Student account created. Default password: SMV@123", {
            duration: 5000
          });
        } else {
          toast.success("Registration updated successfully!");
        }
        
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        toast.error(response.message || "Failed to register");
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      toast.error(error.message || "Failed to register");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-transparent">

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
            <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-foreground rounded-t-lg">
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
                      <Label htmlFor="email">Mail ID *</Label>
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

                    <div>
                      <Label htmlFor="register_no">Register Number *</Label>
                      <Input
                        id="register_no"
                        name="register_no"
                        value={formData.register_no}
                        onChange={handleInputChange}
                        placeholder="e.g., 21XXXXXXX"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="year">Year *</Label>
                        <Select
                          value={formData.year}
                          onValueChange={(value) =>
                            setFormData((prev) => ({ ...prev, year: value }))
                          }
                        >
                          <SelectTrigger>
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

                      <div>
                        <Label htmlFor="department">Department *</Label>
                        <Select
                          value={formData.department}
                          onValueChange={(value) =>
                            setFormData((prev) => ({ ...prev, department: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {DEPARTMENTS.map((dept) => (
                              <SelectItem key={dept} value={dept}>
                                {dept}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="phone">Phone Number *</Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="Student mobile number"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="parent_phone">Parent's Number *</Label>
                        <Input
                          id="parent_phone"
                          name="parent_phone"
                          type="tel"
                          value={formData.parent_phone}
                          onChange={handleInputChange}
                          placeholder="Parent / Guardian mobile number"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="address">Address *</Label>
                      <Textarea
                        id="address"
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        placeholder="Enter your full address"
                        rows={3}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Details */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4 text-slate-800">Additional Details</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="dob">Date of Birth *</Label>
                        <Input
                          id="dob"
                          name="dob"
                          type="date"
                          value={formData.dob}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="blood_group">Blood Group *</Label>
                        <Select
                          value={formData.blood_group}
                          onValueChange={(value) =>
                            setFormData((prev) => ({ ...prev, blood_group: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select blood group" />
                          </SelectTrigger>
                          <SelectContent>
                            {BLOOD_GROUPS.map((bg) => (
                              <SelectItem key={bg} value={bg}>
                                {bg}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="skills">Skills you have *</Label>
                      <Textarea
                        id="skills"
                        name="skills"
                        value={formData.skills}
                        onChange={handleInputChange}
                        placeholder="List your skills (e.g., event management, design, communication...)"
                        rows={3}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="experience">Any volunteering experience *</Label>
                      <Textarea
                        id="experience"
                        name="experience"
                        value={formData.experience}
                        onChange={handleInputChange}
                        placeholder="Describe any previous volunteering experience (if none, mention 'No prior experience')"
                        rows={3}
                        required
                      />
                    </div>
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
                      <li><strong>Inactivity Policy:</strong> Members inactive for 1 month may be marked inactive and replaced</li>
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

      <DeveloperCredit />
    </div>
  );
};

export default VolunteerRegistration;
