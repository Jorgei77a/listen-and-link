
const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="container py-6 mt-10">
      <div className="text-center text-sm text-muted-foreground">
        <p>© {currentYear} AudioToTextNow. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
