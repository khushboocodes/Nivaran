import { Link } from 'react-router-dom';
import { FileSearch } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-[#EEF2FF] flex items-center justify-center mb-4">
          <FileSearch className="w-8 h-8 text-[#2952E3]" strokeWidth={1.5} />
        </div>
        <div className="text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold mb-1">404</div>
        <h1 className="text-2xl font-bold text-[#0B1220] mb-2">Page not found</h1>
        <p className="text-sm text-[#6B7280] mb-6">The page you’re looking for doesn’t exist or was moved.</p>
        <Link to="/">
          <Button className="bg-[#2952E3] hover:bg-[#1e3a8a]">Back to home</Button>
        </Link>
      </div>
    </div>
  );
}
