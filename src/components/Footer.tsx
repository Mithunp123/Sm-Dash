import { cn } from "@/lib/utils";

const Footer = ({ className }: { className?: string }) => {
  return (
    <footer className={cn("bg-card py-6 mt-auto", className)}>
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} SM Volunteers – K.S.Rangasamy College of Technology
          </p>
          <p className="text-sm text-muted-foreground/80">
            <span className="font-semibold text-foreground">Fostering Society</span> | Developed by <span className="font-semibold text-foreground">Narendhar D</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
