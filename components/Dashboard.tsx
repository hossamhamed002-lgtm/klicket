import React from 'react';
import { Info, Plus, ArrowLeftRight, TrendingUp, Users, BookOpen } from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, Tooltip, 
  AreaChart, Area, CartesianGrid
} from 'recharts';

// --- Types & Data ---

// Placeholder empty data
const SYSTEM_DATA = [
  { name: 'Online', value: 0, color: '#8b5cf6' },
  { name: 'Offline', value: 0, color: '#e5e7eb' },
];

const REVENUE_DATA = [
  { name: 'Tuition Fees', value: 0 },
  { name: 'Transport', value: 0 },
];

const PERIOD_DATA = [
  { name: 'Jul', uv: 0, pv: 0 },
  { name: 'Aug', uv: 0, pv: 0 },
  { name: 'Sep', uv: 0, pv: 0 },
];

const PAYMENT_METHODS_DATA = [
  { name: 'BTC', value: 0 },
];

// --- Components ---

const InfoIcon = () => (
  <div className="bg-gray-200 rounded-full w-5 h-5 flex items-center justify-center text-gray-500">
    <span className="text-xs font-bold font-serif">i</span>
  </div>
);

const InfoIconPurple = () => (
    <div className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-white">
      <span className="text-xs font-bold font-serif">i</span>
    </div>
  );

export const Dashboard: React.FC = () => {
  return (
    <div className="p-4 md:p-6 space-y-6 pb-24">
      
      {/* --- Top Row Stats --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Stat 1: Total Collected (Purple) */}
        <div className="bg-gradient-to-br from-[#6d00c4] to-[#4c0099] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white/10 rounded-full border border-white/20">
               <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div className="text-xs font-medium opacity-80">اجمالي المبلغ المحصل</div>
          </div>
          <div className="flex items-end justify-between">
             <InfoIconPurple />
             <div className="text-3xl font-bold flex items-baseline gap-1">
                <span>0</span>
                <span className="text-lg font-normal opacity-80">الكل</span>
             </div>
          </div>
        </div>

        {/* Stat 2: Total Transactions (Purple) */}
        <div className="bg-gradient-to-br from-[#6d00c4] to-[#4c0099] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
             <div className="p-3 bg-white/10 rounded-full border border-white/20">
               <ArrowLeftRight className="w-6 h-6 text-white" />
            </div>
            <div className="text-xs font-medium opacity-80">اجمالي المعاملات</div>
          </div>
          <div className="flex items-end justify-between">
             <InfoIconPurple />
             <div className="text-3xl font-bold">0</div>
          </div>
        </div>

        {/* Stat 3: Parents (White) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
           <div className="flex justify-between items-start">
             <div className="p-3 bg-purple-50 rounded-full">
               <Users className="w-6 h-6 text-brand-purple" />
             </div>
             <div className="text-sm text-gray-500 font-semibold">أولياء الأمور</div>
           </div>
           <div className="flex items-end justify-between mt-4">
             <InfoIcon />
             <div className="text-3xl font-bold text-gray-800">0</div>
          </div>
        </div>

        {/* Stat 4: Students (White) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
           <div className="flex justify-between items-start">
             <div className="p-3 bg-purple-50 rounded-full">
               <BookOpen className="w-6 h-6 text-brand-purple" />
             </div>
             <div className="text-sm text-gray-500 font-semibold">الطلاب</div>
           </div>
           <div className="flex items-end justify-between mt-4">
             <InfoIcon />
             <div className="text-3xl font-bold text-gray-800">0</div>
          </div>
        </div>

      </div>

      {/* --- Middle Row Charts --- */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Chart 1: Payment System (Donut) - Spans 2 cols on very large, 1 on lg */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-1 min-h-[300px]">
          <h3 className="text-lg font-bold text-gray-700 mb-6 text-right">نظام الدفع</h3>
          <div className="h-[200px] relative flex items-center justify-center">
             <span className="text-gray-400">لا توجد بيانات</span>
          </div>
        </div>

        {/* Chart 2: Revenues (Bar) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-1 min-h-[300px]">
          <h3 className="text-lg font-bold text-gray-700 mb-1 text-right">الايرادات خلال كل مدفوعه</h3>
          <p className="text-sm text-gray-400 mb-6 text-right">(اول 10)</p>
          
          <div className="h-[200px] w-full flex items-center justify-center" dir="ltr">
             <span className="text-gray-400">لا توجد بيانات</span>
          </div>
        </div>

        {/* Chart 3: Payment Methods (Block) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-1 min-h-[300px]">
            <div className="flex justify-between items-center mb-6">
                 <div className="flex gap-2">
                    <span className="px-2 py-1 bg-purple-100 text-brand-purple text-xs rounded-full font-bold">المعاملات</span>
                    <span className="text-gray-400 text-xs font-medium">إيرادات</span>
                 </div>
                 <h3 className="text-lg font-bold text-gray-700 text-right">طرق الدفع</h3>
            </div>
            
            <div className="flex items-center justify-center h-[200px]">
                 <span className="text-gray-400">لا توجد بيانات</span>
            </div>
        </div>

        {/* Chart 4: Time Period (Area/Line) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-1 min-h-[300px] relative">
            <div className="flex justify-between items-center mb-4">
                <div className="flex gap-2">
                    <span className="px-2 py-1 bg-purple-100 text-brand-purple text-xs rounded-full font-bold">المعاملات</span>
                    <span className="text-gray-400 text-xs font-medium">إيرادات</span>
                 </div>
                 <h3 className="text-lg font-bold text-gray-700 text-right">فترة زمنية</h3>
                 <div className="absolute top-6 left-6 p-1 border rounded-full text-brand-purple border-brand-purple">
                    <ArrowLeftRight className="w-4 h-4 rotate-90" />
                 </div>
            </div>

            <div className="flex justify-end mb-4">
                <div className="bg-gray-50 px-2 py-1 rounded text-xs text-brand-purple flex items-center gap-2">
                    <span className="cursor-pointer text-gray-400 font-bold">×</span>
                    <span>Jul 2025 - Feb 2026</span>
                </div>
            </div>

            <div className="h-[180px] w-full flex items-center justify-center" dir="ltr">
               <span className="text-gray-400">لا توجد بيانات</span>
            </div>
        </div>

      </div>

      {/* Floating Action Button */}
      <button className="fixed bottom-8 left-8 w-14 h-14 bg-brand-purple text-white rounded-full shadow-lg shadow-purple-500/30 flex items-center justify-center hover:bg-purple-700 hover:scale-105 transition-all z-50">
        <Plus className="w-8 h-8" />
      </button>

      {/* Promo Card (Bottom Right) */}
      <div className="fixed bottom-8 right-8 z-50 hidden lg:block">
         <div className="w-72 bg-[#34d399] rounded-2xl p-6 shadow-xl text-white relative overflow-hidden">
            {/* Decor stars */}
            <div className="absolute top-4 right-4 text-white opacity-80 text-2xl">✨</div>
            
            <h3 className="text-xl font-bold mb-1 text-right">خدمات القيمة</h3>
            <h3 className="text-xl font-bold mb-6 text-right">المضافة</h3>

            <button className="w-full bg-white text-brand-purple font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
               <ArrowLeftRight className="w-4 h-4 rotate-180" />
               <span>اعرف المزيد</span>
            </button>
         </div>
      </div>

    </div>
  );
};