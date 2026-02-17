import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, TrendingUp, Users, BookOpen } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';
import { FloatingQuickActions } from './FloatingQuickActions';

interface TransactionDashboardRow {
  total?: string | number;
  status?: string;
  date?: string;
  method?: string;
  provider?: string;
  itemName?: string;
  parentCode?: string;
  parentName?: string;
  studentId?: string;
  studentName?: string;
}

const TRANSACTIONS_API_ENDPOINT = '/api/transactions';
const SCHOOL_CONTROL_API_ENDPOINT = '/api/school-control';

const normalizeText = (value: any): string =>
  String(value ?? '')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .toLowerCase()
    .trim();

const normalizeKey = (value: any): string =>
  normalizeText(value).replace(/[^a-z0-9\u0600-\u06ff]+/g, '');

const parseAmount = (value: any): number => {
  const parsed = parseFloat(String(value ?? '').replace(/,/g, '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value: number, currency = 'EGP'): string =>
  `${currency.toUpperCase()} ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const isSuccessfulStatus = (status: any): boolean => {
  const value = normalizeText(status);
  return value.includes('success') || value.includes('paid') || value.includes('ناجح') || value.includes('تمت');
};

const parseDateValue = (value: any): Date | null => {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const ddmmyyyy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10) - 1;
    const year = parseInt(ddmmyyyy[3], 10);
    const parsed = new Date(year, month, day);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const classifySystem = (method: any, provider: any): 'online' | 'offline' => {
  const text = `${normalizeText(method)} ${normalizeText(provider)}`;
  const offlineKeywords = ['pos', 'cash', 'branch', 'fawry', 'bank', 'kiosk', 'atm', 'فوري', 'نقدي'];
  return offlineKeywords.some((keyword) => text.includes(keyword)) ? 'offline' : 'online';
};

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
  const [transactionsData, setTransactionsData] = useState<TransactionDashboardRow[]>([]);
  const [schoolCounts, setSchoolCounts] = useState<{ parents: number | null; students: number | null }>({
    parents: null,
    students: null,
  });

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [transactionsResponse, schoolResponse] = await Promise.all([
          fetch(TRANSACTIONS_API_ENDPOINT, { cache: 'no-store' }),
          fetch(SCHOOL_CONTROL_API_ENDPOINT, { cache: 'no-store' }),
        ]);

        if (transactionsResponse.ok) {
          const transactionsPayload = await transactionsResponse.json();
          if (isMounted && Array.isArray(transactionsPayload?.transactions)) {
            setTransactionsData(transactionsPayload.transactions);
          }
        }

        if (schoolResponse.ok) {
          const schoolPayload = await schoolResponse.json();
          if (isMounted) {
            setSchoolCounts({
              parents: Array.isArray(schoolPayload?.parents) ? schoolPayload.parents.length : null,
              students: Array.isArray(schoolPayload?.students) ? schoolPayload.students.length : null,
            });
          }
        }
      } catch {
        // keep dashboard usable if API is unavailable
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const successfulTransactions = useMemo(
    () => transactionsData.filter((row) => isSuccessfulStatus(row.status)),
    [transactionsData]
  );

  const totalTransactions = transactionsData.length;
  const totalCollected = useMemo(
    () => successfulTransactions.reduce((sum, row) => sum + parseAmount(row.total), 0),
    [successfulTransactions]
  );

  const fallbackParentsCount = useMemo(
    () =>
      new Set(
        transactionsData
          .map((row) => normalizeKey(row.parentCode || row.parentName))
          .filter(Boolean)
      ).size,
    [transactionsData]
  );

  const fallbackStudentsCount = useMemo(
    () =>
      new Set(
        transactionsData
          .map((row) => normalizeKey(row.studentId || row.studentName))
          .filter(Boolean)
      ).size,
    [transactionsData]
  );

  const totalParents = schoolCounts.parents ?? fallbackParentsCount;
  const totalStudents = schoolCounts.students ?? fallbackStudentsCount;

  const systemData = useMemo(() => {
    const counts = { online: 0, offline: 0 };
    transactionsData.forEach((row) => {
      const system = classifySystem(row.method, row.provider);
      counts[system] += 1;
    });

    return [
      { name: 'Online', value: counts.online, color: '#8b5cf6' },
      { name: 'Offline', value: counts.offline, color: '#e5e7eb' },
    ];
  }, [transactionsData]);

  const revenueData = useMemo(() => {
    const byItem = new Map<string, number>();
    successfulTransactions.forEach((row) => {
      const key = String(row.itemName || 'Unspecified').trim() || 'Unspecified';
      byItem.set(key, (byItem.get(key) || 0) + parseAmount(row.total));
    });

    return Array.from(byItem.entries())
      .map(([name, value]) => ({
        name: name.length > 18 ? `${name.slice(0, 18)}...` : name,
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [successfulTransactions]);

  const paymentMethodsData = useMemo(() => {
    const byMethod = new Map<string, { name: string; count: number; amount: number }>();
    transactionsData.forEach((row) => {
      const name = String(row.method || row.provider || 'Unknown').trim() || 'Unknown';
      const existing = byMethod.get(name);
      if (!existing) {
        byMethod.set(name, {
          name,
          count: 1,
          amount: parseAmount(row.total),
        });
        return;
      }
      existing.count += 1;
      existing.amount += parseAmount(row.total);
    });

    return Array.from(byMethod.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [transactionsData]);

  const periodData = useMemo(() => {
    const monthMap = new Map<string, { sort: number; name: string; transactions: number; revenue: number }>();

    transactionsData.forEach((row) => {
      const date = parseDateValue(row.date);
      if (!date) return;

      const month = date.getMonth();
      const year = date.getFullYear();
      const key = `${year}-${month}`;
      const sort = year * 12 + month;
      const label = date.toLocaleDateString('en-US', { month: 'short' });

      const existing = monthMap.get(key);
      if (!existing) {
        monthMap.set(key, {
          sort,
          name: label,
          transactions: 1,
          revenue: isSuccessfulStatus(row.status) ? parseAmount(row.total) : 0,
        });
        return;
      }

      existing.transactions += 1;
      if (isSuccessfulStatus(row.status)) {
        existing.revenue += parseAmount(row.total);
      }
    });

    return Array.from(monthMap.values())
      .sort((a, b) => a.sort - b.sort)
      .slice(-8)
      .map(({ name, transactions, revenue }) => ({ name, transactions, revenue }));
  }, [transactionsData]);

  const totalSystemTransactions = systemData.reduce((sum, item) => sum + item.value, 0);

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
             <div className="text-2xl lg:text-3xl font-bold flex items-baseline gap-2" dir="ltr">
                <span>{formatCurrency(totalCollected)}</span>
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
             <div className="text-3xl font-bold">{totalTransactions}</div>
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
             <div className="text-3xl font-bold text-gray-800">{totalParents}</div>
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
             <div className="text-3xl font-bold text-gray-800">{totalStudents}</div>
          </div>
        </div>

      </div>

      {/* --- Middle Row Charts --- */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Chart 1: Payment System (Donut) - Spans 2 cols on very large, 1 on lg */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-1 min-h-[300px]">
          <h3 className="text-lg font-bold text-gray-700 mb-6 text-right">نظام الدفع</h3>
          {totalSystemTransactions === 0 ? (
            <div className="h-[200px] relative flex items-center justify-center">
              <span className="text-gray-400">لا توجد بيانات</span>
            </div>
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={systemData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70}>
                    {systemData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                {systemData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span>{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chart 2: Revenues (Bar) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-1 min-h-[300px]">
          <h3 className="text-lg font-bold text-gray-700 mb-1 text-right">الايرادات خلال كل مدفوعه</h3>
          <p className="text-sm text-gray-400 mb-6 text-right">(اول 10)</p>
          
          {revenueData.length === 0 ? (
            <div className="h-[200px] w-full flex items-center justify-center" dir="ltr">
              <span className="text-gray-400">لا توجد بيانات</span>
            </div>
          ) : (
            <div className="h-[220px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  <Bar dataKey="value" fill="#6f2eea" radius={[5, 5, 5, 5]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
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
            
            {paymentMethodsData.length === 0 ? (
              <div className="flex items-center justify-center h-[200px]">
                <span className="text-gray-400">لا توجد بيانات</span>
              </div>
            ) : (
              <div className="space-y-3 mt-2">
                {paymentMethodsData.map((method) => {
                  const maxCount = paymentMethodsData[0]?.count || 1;
                  const widthPercent = Math.max(8, Math.round((method.count / maxCount) * 100));
                  return (
                    <div key={method.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span className="font-semibold">{method.name}</span>
                        <span>{method.count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#6f2eea]" style={{ width: `${widthPercent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                    <span>{periodData.length === 0 ? 'لا يوجد فترة' : `${periodData[0].name} - ${periodData[periodData.length - 1].name}`}</span>
                </div>
            </div>

            {periodData.length === 0 ? (
              <div className="h-[180px] w-full flex items-center justify-center" dir="ltr">
                <span className="text-gray-400">لا توجد بيانات</span>
              </div>
            ) : (
              <div className="h-[180px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={periodData} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6f2eea" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6f2eea" stopOpacity={0.04} />
                      </linearGradient>
                      <linearGradient id="txFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#31a354" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#31a354" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: any, name: string) =>
                        name === 'revenue' ? formatCurrency(Number(value)) : Number(value).toLocaleString()
                      }
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="transactions"
                      stroke="#31a354"
                      fill="url(#txFill)"
                      name="transactions"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="revenue"
                      stroke="#6f2eea"
                      fill="url(#revenueFill)"
                      name="revenue"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
        </div>

      </div>

      <FloatingQuickActions />

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
