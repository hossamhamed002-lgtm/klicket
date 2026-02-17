import React, { useState } from 'react';
import { Home, History, School, ChevronDown, ChevronUp, List, Settings, ChevronsRight } from 'lucide-react';

interface SidebarProps {
  onNavigate?: (page: string) => void;
  currentPage?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate, currentPage = 'transactions', isOpen = true, onToggle }) => {
  const [expandedMenu, setExpandedMenu] = useState<string | null>('transactions');

  const handleNavigate = (page: string) => {
    if (onNavigate) onNavigate(page);
  };

  const toggleMenu = (menu: string) => {
    if (expandedMenu === menu) {
      setExpandedMenu(null);
    } else {
      setExpandedMenu(menu);
    }
  };

  return (
    <aside className={`w-64 bg-white h-screen fixed right-0 top-0 border-l border-gray-100 flex flex-col z-20 hidden lg:flex font-cairo shadow-[0_3px_10px_rgb(0,0,0,0.05)] transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      {/* Logo Area */}
      <div className="h-28 flex items-center justify-center mb-2">
        <h1 className="text-[62px] leading-none tracking-[-0.06em] font-semibold select-none">
          <span className="text-[#4f4f56]">kl</span>
          <span className="text-[#6b23db]">i</span>
          <span className="text-[#4f4f56]">ck</span>
          <span className="text-[#6b23db]">i</span>
          <span className="text-[#4f4f56]">t</span>
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">

        {/* Dashboard */}
        <div 
          onClick={() => handleNavigate('dashboard')}
          className={`flex items-center p-3 rounded-xl cursor-pointer transition-colors mb-1 group ${currentPage === 'dashboard' ? 'bg-purple-50 text-brand-purple' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Home className={`w-5 h-5 ml-3 ${currentPage === 'dashboard' ? 'text-brand-purple' : 'text-gray-400 group-hover:text-brand-purple'}`} />
          <span className="font-bold flex-1 text-lg">قائمة التحكم</span>
        </div>

        {/* Transactions (Expanded) */}
        <div className="space-y-1">
            <div 
              className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${currentPage === 'transactions' || expandedMenu === 'transactions' ? 'bg-purple-50 text-brand-purple' : 'text-gray-500 hover:bg-gray-50'}`}
              onClick={() => toggleMenu('transactions')}
            >
              <div className="flex items-center">
                <History className={`w-5 h-5 ml-3 ${currentPage === 'transactions' || expandedMenu === 'transactions' ? 'text-brand-purple' : 'text-gray-400'}`} />
                <span className="font-bold text-lg">المعاملات</span>
              </div>
              {expandedMenu === 'transactions' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>

            {/* Submenu */}
            {expandedMenu === 'transactions' && (
                <div className="pr-4 space-y-1 relative">
                    <div 
                      onClick={() => handleNavigate('transactions')}
                      className={`flex items-center p-2 pr-4 rounded-xl cursor-pointer transition-colors ${currentPage === 'transactions' ? 'text-brand-purple bg-white' : 'text-gray-500 hover:text-brand-purple hover:bg-gray-50'}`}
                    >
                         <List className="w-5 h-5 ml-3" />
                         <span className="font-semibold text-base">عرض الكل</span>
                    </div>
                </div>
            )}
        </div>

        {/* School (Expanded) */}
        <div className="space-y-1">
            <div 
              className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${currentPage === 'school-control' || expandedMenu === 'school' ? 'bg-purple-50 text-brand-purple' : 'text-gray-500 hover:bg-gray-50'}`}
              onClick={() => toggleMenu('school')}
            >
              <div className="flex items-center">
                <School className={`w-5 h-5 ml-3 ${currentPage === 'school-control' || expandedMenu === 'school' ? 'text-brand-purple' : 'text-gray-400'}`} />
                <span className="font-bold text-lg">المدرسة</span>
              </div>
              {expandedMenu === 'school' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>

            {/* Submenu */}
            {expandedMenu === 'school' && (
                <div className="pr-4 space-y-1 relative">
                    <div 
                      onClick={() => handleNavigate('school-control')}
                      className={`flex items-center p-2 pr-4 rounded-xl cursor-pointer transition-colors ${currentPage === 'school-control' ? 'text-brand-purple bg-white' : 'text-gray-500 hover:text-brand-purple hover:bg-gray-50'}`}
                    >
                         <Settings className="w-5 h-5 ml-3" />
                         <span className="font-semibold text-base">التحكم</span>
                    </div>
                </div>
            )}
        </div>

      </nav>

       {/* Collapse Trigger */}
      <div className="p-4 mt-auto mb-4 flex justify-start" dir="ltr">
        <button
          type="button"
          onClick={onToggle}
          className="h-12 w-12 rounded-full bg-white border border-[#d8c9f8] text-[#a681ef] shadow-sm hover:bg-[#f6f2ff] transition-colors flex items-center justify-center"
          aria-label="إخفاء القائمة الجانبية"
        >
          <ChevronsRight className="w-7 h-7" />
        </button>
      </div>
    </aside>
  );
};
