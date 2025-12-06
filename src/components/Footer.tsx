const Footer = () => {
  return (
    <footer className="border-t border-violet/50 bg-[#0A192F] mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-white">
            © {new Date().getFullYear()} SM Volunteers – K.S.Rangasamy College of Technology
          </p>
            <p className="text-sm text-white/90">
            <span className="text-white font-semibold">Fostering Society</span> | Developed by <span className="text-white font-semibold">Narendhar D</span>
            </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
