import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { TransactionsPage } from './components/TransactionsPage';
import { SchoolControlPage } from './components/SchoolControlPage';
import { LoginPage } from './components/LoginPage';
import { ChevronsLeft } from 'lucide-react';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Default to 'transactions' to match the user request "like this site" (showing the transactions page)
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'transactions' | 'school-control'>('transactions');

  if (!isAuthenticated) {
    return <LoginPage onLogin={setIsAuthenticated} />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50 text-right" dir="rtl">
      {/* Right Sidebar */}
      <Sidebar
        onNavigate={(page) => setCurrentPage(page as any)}
        currentPage={currentPage}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen((open) => !open)}
      />

      {!isSidebarOpen && (
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="hidden lg:flex fixed right-4 bottom-6 z-40 h-12 w-12 rounded-full bg-white border border-[#d8c9f8] text-[#a681ef] shadow-lg items-center justify-center hover:bg-[#f6f2ff] transition-colors"
          aria-label="إظهار القائمة الجانبية"
        >
          <ChevronsLeft className="w-7 h-7" />
        </button>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'lg:mr-64' : 'lg:mr-0'}`}>
        <Header />
        
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'transactions' && <TransactionsPage />}
        {currentPage === 'school-control' && <SchoolControlPage />}
      </main>
    </div>
  );
}

export default App;
