
import { Link } from "react-router-dom";

const Header = () => {
  return (
    <header className="container py-6">
      <div className="flex justify-between items-center">
        <Link to="/" className="flex items-center space-x-2">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-violet-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">AT</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-brand-600">N</span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold gradient-text">AudioToTextNow</h1>
          </div>
        </Link>
      </div>
    </header>
  );
};

export default Header;
