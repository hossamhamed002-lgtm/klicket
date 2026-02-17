import React from 'react';
import { Bell, Search, Globe, ChevronDown, SlidersHorizontal, Calendar } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 p-4 mb-6 shadow-sm border-b border-gray-100">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        {/* Left Side: User & Actions (RTL: actually visually on the left) */}
        <div className="flex items-center gap-3 order-2 md:order-1 w-full md:w-auto justify-between md:justify-start">
          
           {/* Language Switcher */}
           <div className="flex items-center gap-1 text-gray-500 cursor-pointer hover:text-brand-purple">
            <span className="font-semibold">EN</span>
            <Globe className="w-4 h-4" />
          </div>

          <button className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-brand-purple rounded-full font-bold hover:bg-purple-200 transition-colors">
            <span>مالجديد؟</span>
          </button>

          <div className="relative cursor-pointer">
            <Bell className="w-6 h-6 text-gray-500" />
            <span className="absolute -top-1 -right-1 bg-brand-purple text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
              20
            </span>
          </div>
          
           {/* Mobile Menu Trigger (Hidden on Desktop) */}
           <div className="lg:hidden p-2 rounded-md bg-gray-100">
             <div className="w-5 h-0.5 bg-gray-600 mb-1"></div>
             <div className="w-5 h-0.5 bg-gray-600 mb-1"></div>
             <div className="w-5 h-0.5 bg-gray-600"></div>
           </div>
        </div>

        {/* Right Side: Greeting & Filters (RTL: Visually on the right) */}
        <div className="flex flex-col items-end gap-3 order-1 md:order-2 w-full md:w-auto">
          <div className="flex items-center gap-2">
             <span className="text-gray-400">مرحبا ,</span>
             <h2 className="text-xl font-bold text-gray-800 italic">al fardoos!</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button className="flex items-center gap-2 px-4 py-2 border border-brand-purple text-brand-purple rounded-full bg-white hover:bg-purple-50 transition-colors">
              <SlidersHorizontal className="w-4 h-4" />
              <span>تصنيف</span>
            </button>
            
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-md border border-gray-200">
               <span className="text-sm text-gray-500">العملة : الكل</span>
               <ChevronDown className="w-3 h-3 text-gray-400" />
            </div>

            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-md border border-gray-200">
               <span className="text-sm text-gray-500">السنه الدراسيه : الكل</span>
               <ChevronDown className="w-3 h-3 text-gray-400" />
            </div>

            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-md border border-gray-200">
               <Calendar className="w-3 h-3 text-gray-400" />
               <span className="text-sm text-gray-500">الفترة الزمنية</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};