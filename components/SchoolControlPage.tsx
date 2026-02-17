import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Plus,
  Upload,
  Download,
  Edit,
  ChevronDown,
  ArrowDownUp,
  ArrowRight,
} from 'lucide-react';
import { read, utils } from 'xlsx';
import { Pagination } from './Pagination';

interface ParentRow {
  name: string;
  code: string;
  code2: string;
  email: string;
  phone: string;
}

interface StudentRow {
  name: string;
  studentCode: string;
  grade: string;
  parentCode: string;
}

interface TransactionLiteRow {
  id: string;
  total: string;
  status: string;
  currency: string;
  parentCode: string;
  studentId: string;
  studentName: string;
  gradeName: string;
}

interface ParentChildSummary {
  name: string;
  studentCode: string;
  grade: string;
  paidAmount: number;
}

type ActiveTab = 'parents' | 'students' | 'classes';

const TRANSACTIONS_API_ENDPOINT = '/api/transactions';

const normalizeText = (value: any): string =>
  String(value ?? '')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .toLowerCase()
    .trim();

const normalizeKey = (value: any): string =>
  normalizeText(value).replace(/[^a-z0-9\u0600-\u06ff]+/g, '');

const normalizeHeader = (value: any): string => normalizeText(value).replace(/[\s_\-:/\\]+/g, '');

const parseAmount = (value: any): number => {
  const parsed = parseFloat(String(value ?? '').replace(/,/g, '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatAmount = (value: number, currency = 'EGP'): string =>
  `${currency.toUpperCase()} ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const isSuccessfulStatus = (status: string): boolean => {
  const value = normalizeText(status);
  return value.includes('success') || value.includes('paid') || value.includes('ناجحة') || value.includes('تمت');
};

const getValueByAliases = (row: Record<string, any>, aliases: string[]): string => {
  const entries = Object.entries(row || {});
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const found = entries.find(([key]) => {
      const normalizedKey = normalizeHeader(key);
      return (
        normalizedKey === normalizedAlias ||
        normalizedKey.includes(normalizedAlias) ||
        normalizedAlias.includes(normalizedKey)
      );
    });

    if (found) {
      const value = found[1];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
  }
  return '';
};

const mergeParent = (base: ParentRow, incoming: ParentRow): ParentRow => ({
  name: base.name || incoming.name,
  code: base.code || incoming.code,
  code2: base.code2 || incoming.code2,
  email: base.email || incoming.email,
  phone: base.phone || incoming.phone,
});

const dedupeParents = (rows: ParentRow[]): ParentRow[] => {
  const map = new Map<string, ParentRow>();

  rows.forEach((row) => {
    const key = normalizeKey(row.code || row.code2 || row.name);
    if (!key) return;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, row);
      return;
    }
    map.set(key, mergeParent(existing, row));
  });

  return Array.from(map.values());
};

const mergeStudent = (base: StudentRow, incoming: StudentRow): StudentRow => ({
  name: base.name || incoming.name,
  studentCode: base.studentCode || incoming.studentCode,
  grade: base.grade || incoming.grade,
  parentCode: base.parentCode || incoming.parentCode,
});

const dedupeStudents = (rows: StudentRow[]): StudentRow[] => {
  const map = new Map<string, StudentRow>();

  rows.forEach((row) => {
    const key = normalizeKey(row.studentCode || `${row.name}-${row.parentCode}`);
    if (!key) return;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, row);
      return;
    }
    map.set(key, mergeStudent(existing, row));
  });

  return Array.from(map.values());
};

export const SchoolControlPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('parents');

  const [parentsData, setParentsData] = useState<ParentRow[]>([]);
  const [studentsData, setStudentsData] = useState<StudentRow[]>([]);
  const [transactionsData, setTransactionsData] = useState<TransactionLiteRow[]>([]);

  const [selectedParent, setSelectedParent] = useState<ParentRow | null>(null);
  const [parentSearch, setParentSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  const parentFileInputRef = useRef<HTMLInputElement>(null);
  const studentFileInputRef = useRef<HTMLInputElement>(null);

  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    if (activeTab !== 'parents') {
      setSelectedParent(null);
    }
  }, [activeTab]);

  useEffect(() => {
    let isMounted = true;

    const loadTransactions = async () => {
      try {
        const response = await fetch(TRANSACTIONS_API_ENDPOINT, { cache: 'no-store' });
        if (!response.ok) return;

        const payload = await response.json();
        if (!Array.isArray(payload?.transactions) || !isMounted) return;

        const mapped: TransactionLiteRow[] = payload.transactions
          .map((row: any) => ({
            id: String(row?.id ?? '').trim(),
            total: String(row?.total ?? '').trim(),
            status: String(row?.status ?? '').trim(),
            currency: String(row?.currency ?? 'EGP').trim(),
            parentCode: String(row?.parentCode ?? '').trim(),
            studentId: String(row?.studentId ?? '').trim(),
            studentName: String(row?.studentName ?? '').trim(),
            gradeName: String(row?.gradeName ?? '').trim(),
          }))
          .filter((row) => row.id);

        setTransactionsData(mapped);
      } catch {
        // keep page usable if API is unavailable
      }
    };

    void loadTransactions();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleParentUploadClick = () => {
    if (parentFileInputRef.current) {
      parentFileInputRef.current.click();
    }
  };

  const handleParentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (!bstr) return;

      const wb = read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = utils.sheet_to_json(ws) as Record<string, any>[];

      const mappedData: ParentRow[] = data
        .map((row) => {
          const firstName = getValueByAliases(row, ['First Name', 'الاسم الاول']);
          const lastName = getValueByAliases(row, ['Last Name', 'اسم العائلة']);
          const fullName = getValueByAliases(row, ['Parent Name', 'اسم ولي الأمر', 'Name', 'Full Name']);
          const name = fullName || `${firstName} ${lastName}`.trim();

          return {
            name,
            code: getValueByAliases(row, [
              'Parent ID',
              'ParentID',
              'Parent Code',
              'National ID',
              'رقم تعريف ولي الامر',
              'كود ولي الامر',
            ]),
            code2: getValueByAliases(row, [
              'Secondary Parent ID',
              'SecondaryParentID',
              'Parent ID 2',
              'كود ولي الامر الثانى',
              'كود ولي الامر الثاني',
            ]),
            email: getValueByAliases(row, ['Email', 'البريد الإلكتروني', 'البريد الالكتروني']),
            phone: getValueByAliases(row, ['Phone', 'Mobile', 'رقم الهاتف', 'رقم الهاتف المحمول']),
          };
        })
        .filter((row) => row.name || row.code);

      setParentsData((prev) => dedupeParents([...mappedData, ...prev]));
      if (parentFileInputRef.current) {
        parentFileInputRef.current.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleStudentUploadClick = () => {
    if (studentFileInputRef.current) {
      studentFileInputRef.current.click();
    }
  };

  const handleStudentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (!bstr) return;

      const wb = read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = utils.sheet_to_json(ws) as Record<string, any>[];

      const mappedData: StudentRow[] = data
        .map((row) => ({
          name: getValueByAliases(row, ['Name', 'Student Name', 'اسم الطالب']),
          studentCode: getValueByAliases(row, ['StudentID', 'Student ID', 'كود الطالب', 'رقم الطالب']),
          grade: getValueByAliases(row, ['Grade', 'Grade Name', 'الصف', 'المرحلة']),
          parentCode: getValueByAliases(row, [
            'ParentID',
            'Parent ID',
            'Parent Code',
            'رقم تعريف ولي الامر',
            'كود ولي الامر',
          ]),
        }))
        .filter((row) => row.name || row.studentCode || row.parentCode);

      setStudentsData((prev) => dedupeStudents([...mappedData, ...prev]));
      if (studentFileInputRef.current) {
        studentFileInputRef.current.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  const filteredParentsData = useMemo(() => {
    const query = normalizeKey(parentSearch);
    if (!query) return parentsData;

    return parentsData.filter((row) =>
      [row.name, row.code, row.code2, row.email, row.phone]
        .map((value) => normalizeKey(value))
        .some((value) => value.includes(query))
    );
  }, [parentsData, parentSearch]);

  const filteredStudentsData = useMemo(() => {
    const query = normalizeKey(studentSearch);
    if (!query) return studentsData;

    return studentsData.filter((row) =>
      [row.name, row.studentCode, row.grade, row.parentCode]
        .map((value) => normalizeKey(value))
        .some((value) => value.includes(query))
    );
  }, [studentsData, studentSearch]);

  const selectedParentCodes = useMemo(() => {
    if (!selectedParent) return [];

    const candidates = [selectedParent.code, selectedParent.code2]
      .map((value) => normalizeKey(value))
      .filter(Boolean);

    return Array.from(new Set(candidates));
  }, [selectedParent]);

  const parentTransactions = useMemo(() => {
    if (!selectedParent || selectedParentCodes.length === 0) return [];

    return transactionsData.filter((row) => selectedParentCodes.includes(normalizeKey(row.parentCode)));
  }, [selectedParent, selectedParentCodes, transactionsData]);

  const parentChildrenSummary = useMemo(() => {
    if (!selectedParent || selectedParentCodes.length === 0) return [];

    const byStudent = new Map<string, ParentChildSummary>();

    const ensureStudent = (seed: { name?: string; studentCode?: string; grade?: string }) => {
      const key = normalizeKey(seed.studentCode || seed.name || '');
      if (!key) return null;

      const existing = byStudent.get(key);
      if (existing) {
        existing.name = existing.name || seed.name || '';
        existing.studentCode = existing.studentCode || seed.studentCode || '';
        existing.grade = existing.grade || seed.grade || '';
        return existing;
      }

      const created: ParentChildSummary = {
        name: seed.name || '-',
        studentCode: seed.studentCode || '-',
        grade: seed.grade || '-',
        paidAmount: 0,
      };
      byStudent.set(key, created);
      return created;
    };

    studentsData
      .filter((row) => selectedParentCodes.includes(normalizeKey(row.parentCode)))
      .forEach((row) => {
        ensureStudent({ name: row.name, studentCode: row.studentCode, grade: row.grade });
      });

    parentTransactions.forEach((tx) => {
      const student = ensureStudent({
        name: tx.studentName,
        studentCode: tx.studentId,
        grade: tx.gradeName,
      });

      if (student && isSuccessfulStatus(tx.status)) {
        student.paidAmount += parseAmount(tx.total);
      }
    });

    return Array.from(byStudent.values()).sort((a, b) => {
      if (b.paidAmount !== a.paidAmount) return b.paidAmount - a.paidAmount;
      return a.name.localeCompare(b.name, 'ar');
    });
  }, [selectedParent, selectedParentCodes, studentsData, parentTransactions]);

  const parentTotalPaid = useMemo(
    () => parentChildrenSummary.reduce((sum, child) => sum + child.paidAmount, 0),
    [parentChildrenSummary]
  );

  const paidStudentsCount = useMemo(
    () => parentChildrenSummary.filter((child) => child.paidAmount > 0).length,
    [parentChildrenSummary]
  );

  const currentDataLength =
    activeTab === 'students'
      ? filteredStudentsData.length
      : activeTab === 'parents' && !selectedParent
      ? filteredParentsData.length
      : 0;
  const totalPages = currentDataLength > 0 ? Math.ceil(currentDataLength / ITEMS_PER_PAGE) : 1;

  return (
    <div className="p-4 md:p-8 space-y-6 min-h-screen relative pb-24">
      <div className="flex justify-end items-center gap-2 mb-2 text-gray-500 hover:text-brand-purple cursor-pointer w-fit ml-auto">
        <h2 className="font-bold text-xl text-gray-600">الفردوس الخاصة بالغربية</h2>
        <ArrowRight className="w-5 h-5" />
      </div>

      <div className="flex items-center gap-8 border-b border-gray-200 mb-6 overflow-x-auto">
        <div
          className={`pb-4 px-2 cursor-pointer transition-all flex items-center gap-2 ${
            activeTab === 'classes' ? 'border-b-2 border-brand-purple text-brand-purple' : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('classes')}
        >
          <span className="font-bold">الصفوف</span>
          <span className="bg-purple-100 text-brand-purple text-xs px-2 py-0.5 rounded-full font-bold">0</span>
        </div>

        <div
          className={`pb-4 px-2 cursor-pointer transition-all flex items-center gap-2 ${
            activeTab === 'students' ? 'border-b-2 border-brand-purple text-brand-purple' : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('students')}
        >
          <span className="font-bold">الطلاب</span>
          <span className="bg-purple-100 text-brand-purple text-xs px-2 py-0.5 rounded-full font-bold">{studentsData.length}</span>
        </div>

        <div
          className={`pb-4 px-2 cursor-pointer transition-all flex items-center gap-2 ${
            activeTab === 'parents' ? 'border-b-2 border-brand-purple text-brand-purple' : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('parents')}
        >
          <span className="font-bold">اولياء الامور</span>
          <span className="bg-brand-purple text-white text-xs px-2 py-0.5 rounded-full font-bold">{parentsData.length}</span>
        </div>
      </div>

      {activeTab === 'parents' && !selectedParent && (
        <>
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3 order-2 xl:order-1">
              <button className="flex items-center gap-2 px-6 py-2 bg-brand-purple text-white rounded-full font-bold hover:bg-purple-700 transition-colors shadow-sm">
                <Plus className="w-5 h-5" />
                <span>اضافه ولي امر</span>
              </button>

              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                ref={parentFileInputRef}
                className="hidden"
                onChange={handleParentFileChange}
              />
              <button
                onClick={handleParentUploadClick}
                className="flex items-center gap-2 px-6 py-2 border border-brand-purple text-brand-purple rounded-full bg-white hover:bg-purple-50 transition-colors font-bold"
              >
                <Upload className="w-4 h-4" />
                <span>رفع الملفات</span>
              </button>

              <button className="flex items-center gap-2 px-6 py-2 border border-brand-purple text-brand-purple rounded-full bg-white hover:bg-purple-50 transition-colors font-bold">
                <Download className="w-4 h-4" />
                <span>تحميل</span>
              </button>
            </div>

            <div className="w-full xl:w-auto flex justify-end order-1 xl:order-2">
              <div className="relative flex items-center w-full md:w-80 bg-gray-50 rounded-full border border-gray-200 hover:bg-white transition-colors">
                <input
                  type="text"
                  value={parentSearch}
                  onChange={(e) => setParentSearch(e.target.value)}
                  placeholder="بحث"
                  className="w-full py-2 px-4 bg-transparent outline-none text-right placeholder-gray-400"
                />
                <Search className="w-5 h-5 text-gray-400 absolute left-4" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mt-6">
            <table className="w-full min-w-[1000px] border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm font-bold">
                  <th className="py-4 px-4 text-right">
                    <div className="flex items-center gap-1 cursor-pointer">
                      اسم ولي الامر
                      <ArrowDownUp className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th className="py-4 px-4 text-right">
                    <div className="flex items-center gap-1 cursor-pointer">
                      كود ولي الامر
                      <ArrowDownUp className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th className="py-4 px-4 text-right">كود ولي الامر الثانى</th>
                  <th className="py-4 px-4 text-right">البريد الإلكتروني</th>
                  <th className="py-4 px-4 text-right">رقم الهاتف</th>
                  <th className="py-4 px-4 text-right">تحديث البيانات</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 text-sm">
                {filteredParentsData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      لا توجد بيانات، قم برفع ملف للعرض
                    </td>
                  </tr>
                ) : (
                  filteredParentsData.map((row, index) => (
                    <tr key={`${row.code}-${index}`} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4 font-semibold">
                        <button
                          type="button"
                          onClick={() => setSelectedParent(row)}
                          className="text-right text-brand-purple hover:underline"
                        >
                          {row.name || '-'}
                        </button>
                      </td>
                      <td className="py-4 px-4 text-gray-500 font-mono">{row.code || '-'}</td>
                      <td className="py-4 px-4 text-gray-500 font-mono">{row.code2 || '-'}</td>
                      <td className="py-4 px-4 text-gray-500">{row.email || '-'}</td>
                      <td className="py-4 px-4 text-gray-500 font-mono">{row.phone || '-'}</td>
                      <td className="py-4 px-4">
                        <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'parents' && selectedParent && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-3xl font-bold text-gray-700">{selectedParent.name || 'ولي الأمر'}</h3>
            <button
              type="button"
              onClick={() => setSelectedParent(null)}
              className="flex items-center gap-2 px-4 py-2 border border-brand-purple text-brand-purple rounded-full hover:bg-purple-50 transition-colors"
            >
              <span>رجوع</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5 xl:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-md border border-gray-200">
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-bold text-gray-700">EGP</span>
                  <span className="text-sm text-gray-500">: العملة</span>
                </div>
                <h4 className="text-2xl font-bold text-gray-700">مدفوعات الوالد</h4>
              </div>

              <div className="text-center py-4">
                <div className="text-gray-500 text-lg mb-1">المدفوع</div>
                <div className="text-4xl font-bold text-brand-purple" dir="ltr">
                  {formatAmount(parentTotalPaid)}
                </div>
                <div className="text-gray-500 mt-2">عدد الأبناء الذين لديهم مدفوعات: {paidStudentsCount}</div>
              </div>

              <div className="w-full h-3 bg-gray-200 rounded-full mt-5" />
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h4 className="text-xl font-bold text-gray-700 mb-4">بيانات ولي الأمر</h4>
              <div className="space-y-3 text-gray-700">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">اسم ولي الأمر</span>
                  <span className="font-semibold">{selectedParent.name || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">رقم تعريف ولي الأمر</span>
                  <span className="font-semibold font-mono">{selectedParent.code || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">رقم تعريف إضافي</span>
                  <span className="font-semibold font-mono">{selectedParent.code2 || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">البريد الإلكتروني</span>
                  <span className="font-semibold" dir="ltr">{selectedParent.email || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">رقم الهاتف</span>
                  <span className="font-semibold font-mono">{selectedParent.phone || '-'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h4 className="text-2xl font-bold text-gray-700">الأبناء المرتبطون بولي الأمر</h4>
              <div className="text-brand-purple font-bold text-xl">المدفوع {paidStudentsCount}</div>
            </div>

            {parentChildrenSummary.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-2xl font-semibold">لا يوجد أبناء مرتبطون بهذا الرقم</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm font-bold">
                      <th className="py-4 px-4 text-right">اسم الطالب</th>
                      <th className="py-4 px-4 text-right">كود الطالب</th>
                      <th className="py-4 px-4 text-right">الصف الدراسي</th>
                      <th className="py-4 px-4 text-right">المدفوعات</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    {parentChildrenSummary.map((child, index) => (
                      <tr key={`${child.studentCode}-${index}`} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4 font-semibold">{child.name || '-'}</td>
                        <td className="py-4 px-4 font-mono text-gray-500">{child.studentCode || '-'}</td>
                        <td className="py-4 px-4 text-gray-600">{child.grade || '-'}</td>
                        <td className="py-4 px-4 font-bold" dir="ltr">
                          {child.paidAmount > 0 ? formatAmount(child.paidAmount) : 'EGP 0.00'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'students' && (
        <>
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3 order-2 xl:order-1">
              <button className="flex items-center gap-2 px-6 py-2 bg-brand-purple text-white rounded-full font-bold hover:bg-purple-700 transition-colors shadow-sm">
                <Plus className="w-5 h-5" />
                <span>اضافه طالب</span>
              </button>

              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                ref={studentFileInputRef}
                className="hidden"
                onChange={handleStudentFileChange}
              />
              <button
                onClick={handleStudentUploadClick}
                className="flex items-center gap-2 px-6 py-2 border border-brand-purple text-brand-purple rounded-full bg-white hover:bg-purple-50 transition-colors font-bold"
              >
                <Upload className="w-4 h-4" />
                <span>رفع الملفات</span>
              </button>

              <button className="flex items-center gap-2 px-6 py-2 border border-brand-purple text-brand-purple rounded-full bg-white hover:bg-purple-50 transition-colors font-bold">
                <Download className="w-4 h-4" />
                <span>تحميل</span>
              </button>

              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-md border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50 mr-2">
                <ChevronDown className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-bold text-gray-700">All</span>
                <span className="text-sm text-gray-500">: الصف الدراسي</span>
              </div>
            </div>

            <div className="w-full xl:w-auto flex justify-end order-1 xl:order-2">
              <div className="relative flex items-center w-full md:w-80 bg-gray-50 rounded-full border border-gray-200 hover:bg-white transition-colors">
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="بحث"
                  className="w-full py-2 px-4 bg-transparent outline-none text-right placeholder-gray-400"
                />
                <Search className="w-5 h-5 text-gray-400 absolute left-4" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mt-6">
            <table className="w-full min-w-[1000px] border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm font-bold">
                  <th className="py-4 px-4 text-right">
                    <div className="flex items-center gap-1 cursor-pointer">
                      اسم الطالب
                      <ArrowDownUp className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th className="py-4 px-4 text-right">
                    <div className="flex items-center gap-1 cursor-pointer">
                      كود الطالب
                      <ArrowDownUp className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th className="py-4 px-4 text-right">
                    <div className="flex items-center gap-1 cursor-pointer">
                      السنه الدراسيه
                      <ArrowDownUp className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th className="py-4 px-4 text-right">رقم تعريف ولي الامر</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 text-sm">
                {filteredStudentsData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400">
                      لا توجد بيانات، قم برفع ملف للعرض
                    </td>
                  </tr>
                ) : (
                  filteredStudentsData.map((row, index) => (
                    <tr key={`${row.studentCode}-${index}`} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4 font-semibold">{row.name || '-'}</td>
                      <td className="py-4 px-4 text-gray-500 font-mono">{row.studentCode || '-'}</td>
                      <td className="py-4 px-4 text-gray-500">{row.grade || '-'}</td>
                      <td className="py-4 px-4 text-gray-500 font-mono">{row.parentCode || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(activeTab === 'students' || (activeTab === 'parents' && !selectedParent)) && <Pagination totalPages={totalPages} />}

      <button className="fixed bottom-8 left-8 w-14 h-14 bg-brand-purple text-white rounded-full shadow-lg shadow-purple-500/30 flex items-center justify-center hover:bg-purple-700 hover:scale-105 transition-all z-50">
        <Plus className="w-8 h-8" />
      </button>
    </div>
  );
};
