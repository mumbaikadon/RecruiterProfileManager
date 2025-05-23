import { Link } from "wouter";
import { Button } from "./ui/button";

interface PublicLayoutProps {
  children: React.ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header/Navigation */}
      <header className="bg-background border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/careers">
            <div className="flex items-center gap-2 cursor-pointer">
              <span className="font-bold text-xl">RQS</span>
              <span className="text-muted-foreground">Careers</span>
            </div>
          </Link>
          
          <nav className="flex items-center gap-6">
            <Link href="/careers">
              <span className="text-sm font-medium hover:text-primary cursor-pointer">Job Listings</span>
            </Link>
            <Button asChild variant="outline">
              <Link href="/">
                <span>Recruiter Login</span>
              </Link>
            </Button>
          </nav>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 bg-slate-50">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="bg-background border-t py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-semibold mb-3">About Us</h3>
              <p className="text-sm text-muted-foreground">
                RQS connects talented professionals with leading organizations worldwide.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-3">Candidates</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/careers"><span className="hover:text-primary cursor-pointer">Browse Jobs</span></Link></li>
                <li><span className="hover:text-primary cursor-pointer">Resume Tips</span></li>
                <li><span className="hover:text-primary cursor-pointer">Career Resources</span></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-3">Employers</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><span className="hover:text-primary cursor-pointer">Post a Job</span></li>
                <li><span className="hover:text-primary cursor-pointer">Recruitment Solutions</span></li>
                <li><span className="hover:text-primary cursor-pointer">Client Success Stories</span></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-3">Contact</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><span className="hover:text-primary cursor-pointer">info@rqs.com</span></li>
                <li><span className="hover:text-primary cursor-pointer">1-800-555-0123</span></li>
                <li><span className="hover:text-primary cursor-pointer">Support</span></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} RQS Recruitment. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}