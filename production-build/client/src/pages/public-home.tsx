import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Job } from "@shared/schema";
import { MapPin, Clock, Briefcase, LogIn, Users, CheckCircle, Zap, Target, Shield, TrendingUp, ChevronRight, Star, Mail, Phone, Bell, Facebook, Twitter, Instagram, Linkedin } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";

// Add custom animations to Tailwind
const fadeInAnimation = `
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fadeIn {
  animation: fadeIn 0.8s ease-out forwards;
}
`;

const floatAnimation = `
@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
}
.animate-float {
  animation: float 4s ease-in-out infinite;
}
`;

export default function PublicHome() {
  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/public/jobs"],
  });

  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Add custom animations to the document
    const style = document.createElement('style');
    style.textContent = fadeInAnimation + floatAnimation;
    document.head.appendChild(style);
    
    // Scroll event listener for header
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
      
      // Determine active section for nav highlighting
      const sections = ['features', 'jobs', 'testimonials'];
      const scrollPosition = window.scrollY + 100;
      
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const offsetTop = element.offsetTop;
          const offsetHeight = element.offsetHeight;
          
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section);
            break;
          }
        }
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.head.removeChild(style);
    };
  }, []);
  
  // Scroll to section smoothly
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 80, // Account for header height
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white shadow-md' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
              <div className="flex items-center space-x-3">
                <Zap className={`w-7 h-7 ${isScrolled ? 'text-blue-600' : 'text-white'} transition-colors duration-300`} />
                <h1 className={`text-2xl font-bold ${isScrolled ? 'text-gray-900' : 'text-white'} transition-colors duration-300`}>Velocity Tech</h1>
              </div>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <button 
                onClick={() => scrollToSection('features')} 
                className={`${isScrolled ? 'text-gray-700' : 'text-white'} ${activeSection === 'features' ? 'text-blue-500' : ''} hover:text-blue-500 transition-colors duration-200 font-medium cursor-pointer`}
              >
                Features
              </button>
              <button 
                onClick={() => scrollToSection('jobs')} 
                className={`${isScrolled ? 'text-gray-700' : 'text-white'} ${activeSection === 'jobs' ? 'text-blue-500' : ''} hover:text-blue-500 transition-colors duration-200 font-medium cursor-pointer`}
              >
                Jobs
              </button>
              <button 
                onClick={() => scrollToSection('testimonials')} 
                className={`${isScrolled ? 'text-gray-700' : 'text-white'} ${activeSection === 'testimonials' ? 'text-blue-500' : ''} hover:text-blue-500 transition-colors duration-200 font-medium cursor-pointer`}
              >
                Testimonials
              </button>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link href="/auth" className="hidden md:block">
                <Button className={`${!isScrolled && 'bg-white text-blue-600 hover:bg-blue-50'} transition-all duration-300`}>
                  <LogIn className="w-4 h-4 mr-2" />
                  Staff Login
                </Button>
              </Link>
              
              {/* Mobile Menu Button */}
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-md focus:outline-none"
                aria-label="Toggle menu"
              >
                <div className={`w-6 h-0.5 mb-1.5 ${isScrolled ? 'bg-gray-800' : 'bg-white'} transition-all ${mobileMenuOpen ? 'transform rotate-45 translate-y-2' : ''}`}></div>
                <div className={`w-6 h-0.5 mb-1.5 ${isScrolled ? 'bg-gray-800' : 'bg-white'} transition-all ${mobileMenuOpen ? 'opacity-0' : 'opacity-100'}`}></div>
                <div className={`w-6 h-0.5 ${isScrolled ? 'bg-gray-800' : 'bg-white'} transition-all ${mobileMenuOpen ? 'transform -rotate-45 -translate-y-2' : ''}`}></div>
              </button>
            </div>
          </div>
          
          {/* Mobile Menu */}
          <div className={`md:hidden transition-all duration-300 overflow-hidden ${mobileMenuOpen ? 'max-h-60 opacity-100 pb-4' : 'max-h-0 opacity-0'}`}>
            <div className="flex flex-col space-y-3 bg-white rounded-lg shadow-lg p-4">
              <button 
                onClick={() => {
                  scrollToSection('features');
                  setMobileMenuOpen(false);
                }} 
                className={`text-gray-700 ${activeSection === 'features' ? 'text-blue-500' : ''} hover:text-blue-500 py-2 px-3 rounded-md transition-colors`}
              >
                Features
              </button>
              <button 
                onClick={() => {
                  scrollToSection('jobs');
                  setMobileMenuOpen(false);
                }} 
                className={`text-gray-700 ${activeSection === 'jobs' ? 'text-blue-500' : ''} hover:text-blue-500 py-2 px-3 rounded-md transition-colors`}
              >
                Jobs
              </button>
              <button 
                onClick={() => {
                  scrollToSection('testimonials');
                  setMobileMenuOpen(false);
                }} 
                className={`text-gray-700 ${activeSection === 'testimonials' ? 'text-blue-500' : ''} hover:text-blue-500 py-2 px-3 rounded-md transition-colors`}
              >
                Testimonials
              </button>
              <Link href="/auth" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full">
                  <LogIn className="w-4 h-4 mr-2" />
                  Staff Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white pt-32 pb-24 relative overflow-hidden">
        {/* Abstract background shapes */}
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 rounded-full"></div>
          <div className="absolute top-60 -left-20 w-60 h-60 bg-indigo-400 rounded-full"></div>
          <div className="absolute bottom-20 right-20 w-40 h-40 bg-purple-400 rounded-full"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="md:flex md:items-center md:justify-between">
            <div className="md:w-1/2 text-center md:text-left md:pr-8">
              <div className="animate-fadeIn">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                  <span className="block">Accelerate Your</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-purple-200">Career Journey</span>
                </h1>
                <p className="text-xl md:text-2xl mb-8 text-blue-100 max-w-xl">
                  Velocity Tech connects top talent with leading companies through intelligent recruitment solutions
                </p>
                <div className="flex flex-col sm:flex-row gap-4 sm:justify-start justify-center">
                  <Button 
                    size="lg" 
                    variant="secondary" 
                    className="group"
                    onClick={() => scrollToSection('jobs')}
                  >
                    <span className="flex items-center">
                      View Available Jobs
                      <ChevronRight className="ml-1 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Button>
                  <Link href="/public/jobs">
                    <Button
                      size="lg"
                      variant="outline"
                      className="text-blue-600 border-blue-600 bg-white hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors duration-300"
                    >
                      Apply Now
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
            
            <div className="hidden md:block md:w-1/2 mt-10 md:mt-0">
              <div className="relative animate-float">
                <div className="absolute -top-4 -left-4 w-full h-full bg-indigo-500 rounded-lg"></div>
                <div className="absolute -bottom-4 -right-4 w-full h-full bg-blue-500 rounded-lg"></div>
                <div className="relative bg-white p-6 rounded-lg shadow-xl">
                  <div className="flex items-center mb-4">
                    <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    <div className="mt-6 grid grid-cols-2 gap-2">
                      <div className="h-16 bg-blue-100 rounded flex items-center justify-center">
                        <Briefcase className="text-blue-500" />
                      </div>
                      <div className="h-16 bg-purple-100 rounded flex items-center justify-center">
                        <Users className="text-purple-500" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg text-center">
              <div className="text-3xl font-bold mb-1">500+</div>
              <div className="text-blue-100">Active Jobs</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg text-center">
              <div className="text-3xl font-bold mb-1">98%</div>
              <div className="text-blue-100">Success Rate</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg text-center">
              <div className="text-3xl font-bold mb-1">200+</div>
              <div className="text-blue-100">Partner Companies</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg text-center">
              <div className="text-3xl font-bold mb-1">24/7</div>
              <div className="text-blue-100">Support</div>
            </div>
          </div>
        </div>
        
        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" className="w-full h-auto">
            <path fill="#f9fafb" fillOpacity="1" d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z"></path>
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-50 to-white z-0"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">Why Choose Us</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-4 mb-4">Why Choose Velocity Tech?</h2>
            <div className="h-1 w-24 bg-blue-600 mx-auto mb-6"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Accelerating careers through intelligent recruitment with cutting-edge technology</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 border border-gray-100 group hover:border-blue-200">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-200 transition-colors">
                <Target className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-center">Precision Matching</h3>
              <p className="text-gray-600 text-center">Advanced AI algorithms connect you with roles that match your exact skills and career goals, ensuring the perfect fit for both candidates and employers.</p>
              <div className="mt-4 flex justify-center">
                <span className="text-blue-600 font-medium text-sm flex items-center hover:text-blue-800 cursor-pointer">
                  Learn more
                  <ChevronRight className="ml-1 w-4 h-4" />
                </span>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 border border-gray-100 group hover:border-green-200">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-green-200 transition-colors">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-center">Trusted Security</h3>
              <p className="text-gray-600 text-center">Enterprise-grade security protects your data throughout the recruitment process, with end-to-end encryption and strict privacy controls.</p>
              <div className="mt-4 flex justify-center">
                <span className="text-green-600 font-medium text-sm flex items-center hover:text-green-800 cursor-pointer">
                  Learn more
                  <ChevronRight className="ml-1 w-4 h-4" />
                </span>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 border border-gray-100 group hover:border-purple-200">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-purple-200 transition-colors">
                <TrendingUp className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-center">Career Acceleration</h3>
              <p className="text-gray-600 text-center">Fast-track your career with opportunities from leading technology companies, complete with personalized career guidance and support.</p>
              <div className="mt-4 flex justify-center">
                <span className="text-purple-600 font-medium text-sm flex items-center hover:text-purple-800 cursor-pointer">
                  Learn more
                  <ChevronRight className="ml-1 w-4 h-4" />
                </span>
              </div>
            </div>
          </div>
          
          <div className="mt-16 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl overflow-hidden shadow-xl">
            <div className="md:flex items-center">
              <div className="md:w-2/3 p-8 md:p-12">
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">Ready to accelerate your hiring?</h3>
                <p className="text-blue-100 mb-6">Our platform helps you find the perfect candidates faster with AI-powered matching.</p>
                <Button 
                  size="lg" 
                  variant="secondary" 
                  className="group"
                  onClick={() => scrollToSection('jobs')}
                >
                  <span className="flex items-center">
                    Get Started Now
                    <ChevronRight className="ml-1 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>
              </div>
              <div className="md:w-1/3 bg-blue-800 p-8 md:p-12 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-5xl font-bold text-white mb-2">93%</div>
                  <div className="text-blue-200">Placement Success Rate</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">Testimonials</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-4 mb-4">What Our Clients Say</h2>
            <div className="h-1 w-24 bg-purple-600 mx-auto mb-6"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Hear from the professionals who found their dream careers through our platform</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="flex mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-600 mb-6 italic">"Velocity Tech helped me find a role that perfectly matched my skills and career aspirations. The process was smooth and the support was exceptional."</p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-blue-600 font-bold">JD</span>
                </div>
                <div>
                  <h4 className="font-semibold">Jane Doe</h4>
                  <p className="text-sm text-gray-500">Software Engineer at TechCorp</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="flex mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-600 mb-6 italic">"As a hiring manager, I've been impressed with the quality of candidates that Velocity Tech connects us with. Their AI matching is spot on!"</p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-green-600 font-bold">MS</span>
                </div>
                <div>
                  <h4 className="font-semibold">Michael Smith</h4>
                  <p className="text-sm text-gray-500">HR Director at InnovateCo</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="flex mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-600 mb-6 italic">"The career acceleration program at Velocity Tech was a game-changer for me. I received personalized guidance that helped me land my dream job."</p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-purple-600 font-bold">AJ</span>
                </div>
                <div>
                  <h4 className="font-semibold">Alex Johnson</h4>
                  <p className="text-sm text-gray-500">Product Manager at FutureTech</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Jobs Section */}
      <section id="jobs" className="py-20 bg-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 opacity-70"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-50 rounded-full -ml-32 -mb-32 opacity-70"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">Opportunities</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-4 mb-4">Latest Opportunities</h2>
            <div className="h-1 w-24 bg-indigo-600 mx-auto mb-6"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Discover exciting career opportunities tailored to your skills and aspirations</p>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center min-h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Loading opportunities...</p>
            </div>
          ) : jobs && jobs.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {jobs.slice(0, 6).map((job) => (
                <Card key={job.id} className="hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden group">
                  <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-600 transform origin-left transition-all duration-300 group-hover:scale-x-100 scale-x-0"></div>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl font-bold text-gray-800 group-hover:text-blue-700 transition-colors">{job.title}</CardTitle>
                      <Badge variant={job.status === "active" ? "default" : "secondary"} className="uppercase text-xs">
                        {job.status}
                      </Badge>
                    </div>
                    <CardDescription className="text-sm text-gray-500 flex items-center">
                      <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                      Job ID: {job.jobId}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-gray-700 line-clamp-3">{job.description}</p>
                    
                    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                      {(job.city || job.state) && (
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mr-2 text-indigo-500" />
                          <span className="font-medium">{[job.city, job.state].filter(Boolean).join(", ")}</span>
                        </div>
                      )}
                      
                      {job.jobType && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Briefcase className="w-4 h-4 mr-2 text-indigo-500" />
                          <span className="font-medium">{job.jobType}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="w-4 h-4 mr-2 text-indigo-500" />
                        <span className="font-medium">Posted {new Date(job.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <Link href="/public/jobs">
                      <Button className="w-full mt-4 group-hover:bg-indigo-700 transition-colors">
                        <span className="mr-2">Apply Now</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="text-center py-16">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Briefcase className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Jobs Available</h3>
                <p className="text-gray-600 mb-6">Check back soon for new opportunities.</p>
                <Button variant="outline" size="lg">
                  <span className="mr-2">Get Notified</span>
                  <Bell className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          {jobs && jobs.length > 6 && (
            <div className="text-center mt-12">
              <Link href="/public/jobs">
                <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 group">
                  <span className="mr-2">View All Jobs</span>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="md:flex">
              <div className="md:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-700 p-8 md:p-12 text-white">
                <h2 className="text-3xl font-bold mb-6">Get in Touch</h2>
                <p className="text-blue-100 mb-8">Have questions about our recruitment services? Our team is here to help you find the perfect opportunity.</p>
                
                <div className="space-y-4">
                  <div className="flex items-start">
                    <Mail className="w-6 h-6 mr-4 text-blue-200" />
                    <div>
                      <h3 className="font-semibold mb-1">Email Us</h3>
                      <p className="text-blue-100">contact@velocitytech.com</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <Phone className="w-6 h-6 mr-4 text-blue-200" />
                    <div>
                      <h3 className="font-semibold mb-1">Call Us</h3>
                      <p className="text-blue-100">+1 (555) 123-4567</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <MapPin className="w-6 h-6 mr-4 text-blue-200" />
                    <div>
                      <h3 className="font-semibold mb-1">Visit Us</h3>
                      <p className="text-blue-100">123 Tech Avenue, San Francisco, CA 94107</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="md:w-1/2 p-8 md:p-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Subscribe to Job Alerts</h2>
                <p className="text-gray-600 mb-8">Stay updated with the latest opportunities matching your skills and preferences.</p>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-grow">
                    <input 
                      type="email" 
                      placeholder="Enter your email" 
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Bell className="w-4 h-4 mr-2" />
                    Subscribe
                  </Button>
                </div>
                
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">Follow Us</h3>
                  <div className="flex space-x-4">
                    <a href="#" className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-colors">
                      <Facebook className="w-5 h-5" />
                    </a>
                    <a href="#" className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-colors">
                      <Twitter className="w-5 h-5" />
                    </a>
                    <a href="#" className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-colors">
                      <Instagram className="w-5 h-5" />
                    </a>
                    <a href="#" className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-colors">
                      <Linkedin className="w-5 h-5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-6">
                <Zap className="w-6 h-6 text-blue-400" />
                <h3 className="text-xl font-bold">Velocity Tech</h3>
              </div>
              <p className="text-gray-400 mb-6">Connecting talent with opportunity through AI-powered matching and intelligent recruitment solutions.</p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Facebook className="w-5 h-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Instagram className="w-5 h-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Linkedin className="w-5 h-5" />
                </a>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-lg mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">About Us</a></li>
                <li><a href="#jobs" className="text-gray-400 hover:text-white transition-colors">Browse Jobs</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">For Employers</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Success Stories</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Career Resources</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-lg mb-4">Support</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">FAQ</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Contact Us</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-lg mb-4">Contact</h4>
              <div className="space-y-3">
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 mr-3 text-gray-400" />
                  <span className="text-gray-400">123 Tech Avenue, San Francisco, CA 94107</span>
                </div>
                <div className="flex items-center">
                  <Phone className="w-5 h-5 mr-3 text-gray-400" />
                  <span className="text-gray-400">+1 (555) 123-4567</span>
                </div>
                <div className="flex items-center">
                  <Mail className="w-5 h-5 mr-3 text-gray-400" />
                  <span className="text-gray-400">contact@velocitytech.com</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">© {new Date().getFullYear()} Velocity Tech. All rights reserved.</p>
            <div className="mt-4 md:mt-0 flex space-x-6">
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Privacy Policy</a>
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Terms of Service</a>
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}