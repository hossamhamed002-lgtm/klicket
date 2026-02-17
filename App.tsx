import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { TransactionsPage } from './components/TransactionsPage';
import { SchoolControlPage } from './components/SchoolControlPage';
import { LoginPage } from './components/LoginPage';
import { ChevronsLeft } from 'lucide-react';

type AppPage = 'dashboard' | 'transactions' | 'school-control';

const PAGE_TO_PATH: Record<AppPage, string> = {
  dashboard: '/dashboard',
  transactions: '/transactions',
  'school-control': '/school-control',
};

const normalizePath = (pathname: string): string => {
  if (!pathname) return '/';
  if (pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
};

const getPageFromPath = (pathname: string): AppPage => {
  const normalized = normalizePath(pathname);
  if (normalized === '/dashboard') return 'dashboard';
  if (normalized === '/school-control') return 'school-control';
  return 'transactions';
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState<AppPage>(() => getPageFromPath(window.location.pathname));

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(getPageFromPath(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const normalizedPage = getPageFromPath(window.location.pathname);
    const normalizedPath = PAGE_TO_PATH[normalizedPage];
    if (window.location.pathname !== normalizedPath) {
      window.history.replaceState({}, '', normalizedPath);
    }
    if (currentPage !== normalizedPage) {
      setCurrentPage(normalizedPage);
    }
  }, [isAuthenticated, currentPage]);

  const handleNavigate = (page: AppPage) => {
    setCurrentPage(page);
    const path = PAGE_TO_PATH[page];
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }

    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={setIsAuthenticated} />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50 text-right" dir="rtl">
      {/* Right Sidebar */}
      <Sidebar
        onNavigate={handleNavigate}
        currentPage={currentPage}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen((open) => !open)}
      />

      {isSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="إغلاق القائمة الجانبية"
        />
      )}

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
        <Header onMenuToggle={() => setIsSidebarOpen((open) => !open)} />
        
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'transactions' && <TransactionsPage />}
        {currentPage === 'school-control' && <SchoolControlPage />}
      </main>
    </div>
  );
}

export default App;
