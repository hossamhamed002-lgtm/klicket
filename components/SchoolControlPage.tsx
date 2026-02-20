import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Plus,
  Upload,
  Download,
  Edit,
  Trash2,
  X,
  ChevronDown,
  ArrowDownUp,
  ArrowRight,
} from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';
import { Pagination } from './Pagination';
import { FloatingQuickActions } from './FloatingQuickActions';

interface ParentRow {
  name: string;
  code: string;
  code2: string;
  email: string;
  phone: string;
  secretKey?: string;
}

interface StudentRow {
  name: string;
  studentCode: string;
  grade: string;
  parentCode: string;
  parentName?: string;
  externalId?: string;
  birthDate?: string;
  classification?: string;
}

interface TransactionLiteRow {
  id: string;
  total: string;
  totalNoTax: string;
  status: string;
  currency: string;
  date: string;
  method: string;
  itemName: string;
  academicYear: string;
  provider: string;
  bankReferenceNumber: string;
  merchantOrderId: string;
  fees: string;
  discount: string;
  parentCode: string;
  parentName: string;
  studentId: string;
  studentName: string;
  gradeName: string;
}

interface ParentChildPaymentsGroup {
  key: string;
  name: string;
  studentCode: string;
  grade: string;
  externalId: string;
  transactions: TransactionLiteRow[];
  paidAmount: number;
}

interface ClassSummaryRow {
  key: string;
  className: string;
  displayName: string;
  studentsCount: number;
}

interface ParentEditForm {
  firstName: string;
  familyName: string;
  parentCode: string;
  email: string;
  phone: string;
}

interface ParentAddForm {
  firstName: string;
  familyName: string;
  parentCode: string;
  email: string;
  phone: string;
  secretKey: string;
  autoGenerateCode: boolean;
  addSecondParent: boolean;
  secondParentCode: string;
}

interface StudentAddForm {
  name: string;
  externalId: string;
  birthDate: string;
  studentCode: string;
  autoGenerateCode: boolean;
  classification: string;
  grade: string;
  parentCode: string;
}

type ActiveTab = 'parents' | 'students' | 'classes';

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

const normalizeHeader = (value: any): string => normalizeText(value).replace(/[\s_\-:/\\]+/g, '');

const parseAmount = (value: any): number => {
  const parsed = parseFloat(String(value ?? '').replace(/,/g, '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDateToTimestamp = (value: any): number => {
  const str = String(value ?? '').trim();
  if (!str) return 0;

  const ddmmyyyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10) - 1;
    const year = parseInt(ddmmyyyy[3], 10);
    const parsed = new Date(year, month, day).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = new Date(str).getTime();
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
  secretKey: base.secretKey || incoming.secretKey,
});

const getParentRowKey = (row: ParentRow): string => normalizeKey(row.code || row.code2 || row.name);

const dedupeParents = (rows: ParentRow[]): ParentRow[] => {
  const map = new Map<string, ParentRow>();

  rows.forEach((row) => {
    const key = getParentRowKey(row);
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
  parentName: base.parentName || incoming.parentName,
  externalId: base.externalId || incoming.externalId,
  birthDate: base.birthDate || incoming.birthDate,
  classification: base.classification || incoming.classification,
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

const buildUniqueCode = (prefix: string, usedValues: string[]): string => {
  const used = new Set(usedValues.map((value) => normalizeKey(value)).filter(Boolean));
  let attempts = 0;
  while (attempts < 200) {
    const code = `${prefix}${Math.floor(100000 + Math.random() * 900000)}`;
    if (!used.has(normalizeKey(code))) {
      return code;
    }
    attempts += 1;
  }
  return `${prefix}${Date.now().toString().slice(-8)}`;
};

export const SchoolControlPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('parents');

  const [parentsData, setParentsData] = useState<ParentRow[]>([]);
  const [studentsData, setStudentsData] = useState<StudentRow[]>([]);
  const [transactionsData, setTransactionsData] = useState<TransactionLiteRow[]>([]);

  const [selectedParent, setSelectedParent] = useState<ParentRow | null>(null);
  const [parentSearch, setParentSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [classSearch, setClassSearch] = useState('');
  const [parentChildSearchByKey, setParentChildSearchByKey] = useState<Record<string, string>>({});
  const [expandedParentTransactionKey, setExpandedParentTransactionKey] = useState<string | null>(null);
  const [parentsPage, setParentsPage] = useState(1);
  const [parentsPageSize, setParentsPageSize] = useState(5);
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsPageSize, setStudentsPageSize] = useState(5);
  const [classesPage, setClassesPage] = useState(1);
  const [classesPageSize, setClassesPageSize] = useState(5);
  const [isParentEditOpen, setIsParentEditOpen] = useState(false);
  const [isParentAddOpen, setIsParentAddOpen] = useState(false);
  const [isStudentAddOpen, setIsStudentAddOpen] = useState(false);
  const [parentEditKey, setParentEditKey] = useState('');
  const [isSavingParentEdit, setIsSavingParentEdit] = useState(false);
  const [isSavingParentAdd, setIsSavingParentAdd] = useState(false);
  const [isSavingStudentAdd, setIsSavingStudentAdd] = useState(false);
  const [parentEditForm, setParentEditForm] = useState<ParentEditForm>({
    firstName: '',
    familyName: '',
    parentCode: '',
    email: '',
    phone: '',
  });
  const [parentAddForm, setParentAddForm] = useState<ParentAddForm>({
    firstName: '',
    familyName: '',
    parentCode: '',
    email: '',
    phone: '',
    secretKey: '',
    autoGenerateCode: false,
    addSecondParent: false,
    secondParentCode: '',
  });
  const [studentAddForm, setStudentAddForm] = useState<StudentAddForm>({
    name: '',
    externalId: '',
    birthDate: '',
    studentCode: '',
    autoGenerateCode: false,
    classification: '',
    grade: '',
    parentCode: '',
  });
  const [studentParentSearch, setStudentParentSearch] = useState('');
  const [isStudentParentDropdownOpen, setIsStudentParentDropdownOpen] = useState(false);

  const parentFileInputRef = useRef<HTMLInputElement>(null);
  const studentFileInputRef = useRef<HTMLInputElement>(null);
  const studentParentDropdownRef = useRef<HTMLDivElement>(null);
  const parentsDataRef = useRef<ParentRow[]>([]);
  const studentsDataRef = useRef<StudentRow[]>([]);
  const isAnyDrawerOpen = isParentEditOpen || isParentAddOpen || isStudentAddOpen;

  const buildParentAddInitialForm = (autoGenerateCode = false): ParentAddForm => ({
    firstName: '',
    familyName: '',
    parentCode: autoGenerateCode
      ? buildUniqueCode(
          'P',
          parentsDataRef.current.flatMap((row) => [row.code, row.code2])
        )
      : '',
    email: '',
    phone: '',
    secretKey: '',
    autoGenerateCode,
    addSecondParent: false,
    secondParentCode: '',
  });

  const buildStudentAddInitialForm = (autoGenerateCode = false): StudentAddForm => ({
    name: '',
    externalId: '',
    birthDate: '',
    studentCode: autoGenerateCode
      ? buildUniqueCode(
          'S',
          studentsDataRef.current.map((row) => row.studentCode)
        )
      : '',
    autoGenerateCode,
    classification: '',
    grade: '',
    parentCode: '',
  });

  useEffect(() => {
    if (activeTab !== 'parents') {
      setSelectedParent(null);
      setIsParentEditOpen(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setParentsPage(1);
  }, [parentSearch]);

  useEffect(() => {
    setStudentsPage(1);
  }, [studentSearch]);

  useEffect(() => {
    setClassesPage(1);
  }, [classSearch]);

  useEffect(() => {
    setParentChildSearchByKey({});
    setExpandedParentTransactionKey(null);
  }, [selectedParent?.code, selectedParent?.code2]);

  useEffect(() => {
    if (!isAnyDrawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isAnyDrawerOpen]);

  useEffect(() => {
    if (!isStudentParentDropdownOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (studentParentDropdownRef.current && !studentParentDropdownRef.current.contains(event.target as Node)) {
        setIsStudentParentDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isStudentParentDropdownOpen]);

  useEffect(() => {
    parentsDataRef.current = parentsData;
  }, [parentsData]);

  useEffect(() => {
    studentsDataRef.current = studentsData;
  }, [studentsData]);

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
            totalNoTax: String(row?.totalNoTax ?? '').trim(),
            status: String(row?.status ?? '').trim(),
            currency: String(row?.currency ?? 'EGP').trim(),
            date: String(row?.date ?? '').trim(),
            method: String(row?.method ?? '').trim(),
            itemName: String(row?.itemName ?? '').trim(),
            academicYear: String(row?.academicYear ?? '').trim(),
            provider: String(row?.provider ?? '').trim(),
            bankReferenceNumber: String(row?.bankReferenceNumber ?? '').trim(),
            merchantOrderId: String(row?.merchantOrderId ?? '').trim(),
            fees: String(row?.fees ?? '').trim(),
            discount: String(row?.discount ?? '').trim(),
            parentCode: String(row?.parentCode ?? '').trim(),
            parentName: String(row?.parentName ?? '').trim(),
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

  useEffect(() => {
    let isMounted = true;

    const loadSchoolControlData = async () => {
      try {
        const response = await fetch(SCHOOL_CONTROL_API_ENDPOINT, { cache: 'no-store' });
        if (!response.ok) return;

        const payload = await response.json();
        if (!isMounted) return;

        const loadedParents = Array.isArray(payload?.parents) ? payload.parents : [];
        const loadedStudents = Array.isArray(payload?.students) ? payload.students : [];

        const normalizedParents: ParentRow[] = loadedParents.map((row: any) => ({
          name: String(row?.name ?? '').trim(),
          code: String(row?.code ?? '').trim(),
          code2: String(row?.code2 ?? '').trim(),
          email: String(row?.email ?? '').trim(),
          phone: String(row?.phone ?? '').trim(),
          secretKey: String(row?.secretKey ?? '').trim(),
        }));

        const normalizedStudents: StudentRow[] = loadedStudents.map((row: any) => ({
          name: String(row?.name ?? '').trim(),
          studentCode: String(row?.studentCode ?? '').trim(),
          grade: String(row?.grade ?? '').trim(),
          parentCode: String(row?.parentCode ?? '').trim(),
          parentName: String(row?.parentName ?? '').trim(),
          externalId: String(row?.externalId ?? '').trim(),
          birthDate: String(row?.birthDate ?? '').trim(),
          classification: String(row?.classification ?? '').trim(),
        }));

        setParentsData(dedupeParents(normalizedParents));
        setStudentsData(dedupeStudents(normalizedStudents));
      } catch {
        // keep page usable if school-control API is unavailable
      }
    };

    void loadSchoolControlData();

    return () => {
      isMounted = false;
    };
  }, []);

  const saveSchoolControlToServer = async (
    parents: ParentRow[],
    students: StudentRow[]
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const response = await fetch(SCHOOL_CONTROL_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parents, students }),
      });

      if (response.ok) {
        return { ok: true };
      }

      let errorMessage = 'فشل غير معروف من الخادم';
      try {
        const payload = await response.json();
        errorMessage = payload?.error || payload?.message || errorMessage;
      } catch {
        try {
          const text = await response.text();
          if (text) errorMessage = text;
        } catch {
          // ignore
        }
      }

      return { ok: false, error: errorMessage };
    } catch {
      return { ok: false, error: 'تعذر الاتصال بالخادم' };
    }
  };

  const openParentEditDrawer = (row: ParentRow) => {
    const parts = String(row.name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const firstName = parts.shift() || '';
    const familyName = parts.join(' ');

    setParentEditKey(getParentRowKey(row));
    setParentEditForm({
      firstName,
      familyName,
      parentCode: row.code || '',
      email: row.email || '',
      phone: row.phone || '',
    });
    setIsParentEditOpen(true);
  };

  const handleCloseParentEdit = () => {
    setIsParentEditOpen(false);
    setIsSavingParentEdit(false);
  };

  const handleSaveParentEdit = async () => {
    if (!parentEditKey || isSavingParentEdit) return;

    const fullName = `${parentEditForm.firstName} ${parentEditForm.familyName}`.trim();
    const updatedCode = parentEditForm.parentCode.trim();
    const updatedEmail = parentEditForm.email.trim();
    const updatedPhone = parentEditForm.phone.trim();

    const nextParents = dedupeParents(
      parentsDataRef.current.map((row) => {
        if (getParentRowKey(row) !== parentEditKey) return row;
        return {
          ...row,
          name: fullName || row.name,
          code: updatedCode || row.code,
          email: updatedEmail,
          phone: updatedPhone,
        };
      })
    );

    setIsSavingParentEdit(true);
    setParentsData(nextParents);
    parentsDataRef.current = nextParents;

    if (selectedParent && getParentRowKey(selectedParent) === parentEditKey) {
      const updatedSelected = nextParents.find((row) => getParentRowKey(row) === getParentRowKey(selectedParent));
      if (updatedSelected) {
        setSelectedParent(updatedSelected);
      }
    }

    const saveResult = await saveSchoolControlToServer(nextParents, studentsDataRef.current);
    if (!saveResult.ok) {
      alert(`تم تعديل بيانات ولي الأمر محليًا، لكن فشل الحفظ على الخادم: ${saveResult.error}`);
      setIsSavingParentEdit(false);
      return;
    }

    setIsSavingParentEdit(false);
    handleCloseParentEdit();
  };

  const openParentAddDrawer = () => {
    setSelectedParent(null);
    setActiveTab('parents');
    setParentAddForm(buildParentAddInitialForm(false));
    setIsParentAddOpen(true);
  };

  const handleCloseParentAdd = () => {
    setIsParentAddOpen(false);
    setIsSavingParentAdd(false);
    setParentAddForm(buildParentAddInitialForm(false));
  };

  const handleSaveParentAdd = async () => {
    if (isSavingParentAdd) return;

    const firstName = parentAddForm.firstName.trim();
    const familyName = parentAddForm.familyName.trim();
    const resolvedCode = (parentAddForm.autoGenerateCode
      ? buildUniqueCode(
          'P',
          parentsDataRef.current.flatMap((row) => [row.code, row.code2])
        )
      : parentAddForm.parentCode
    ).trim();

    if (!firstName) {
      alert('من فضلك أدخل الاسم الأول لولي الأمر');
      return;
    }

    if (!resolvedCode) {
      alert('من فضلك أدخل رقم تعريف ولي الأمر');
      return;
    }

    const duplicateParentCode = parentsDataRef.current.some(
      (row) => normalizeKey(row.code) === normalizeKey(resolvedCode)
    );
    if (duplicateParentCode) {
      alert('رقم تعريف ولي الأمر موجود بالفعل');
      return;
    }

    const nextParent: ParentRow = {
      name: `${firstName} ${familyName}`.trim(),
      code: resolvedCode,
      code2: parentAddForm.addSecondParent ? parentAddForm.secondParentCode.trim() : '',
      email: parentAddForm.email.trim(),
      phone: parentAddForm.phone.trim(),
      secretKey: parentAddForm.secretKey.trim(),
    };

    const nextParents = dedupeParents([nextParent, ...parentsDataRef.current]);

    setIsSavingParentAdd(true);
    setParentsData(nextParents);
    parentsDataRef.current = nextParents;

    const saveResult = await saveSchoolControlToServer(nextParents, studentsDataRef.current);
    if (!saveResult.ok) {
      alert(`تم إضافة ولي الأمر محليًا، لكن فشل الحفظ على الخادم: ${saveResult.error}`);
      setIsSavingParentAdd(false);
      return;
    }

    setIsSavingParentAdd(false);
    handleCloseParentAdd();
  };

  const openStudentAddDrawer = () => {
    setSelectedParent(null);
    setActiveTab('students');
    setStudentAddForm(buildStudentAddInitialForm(false));
    setStudentParentSearch('');
    setIsStudentParentDropdownOpen(false);
    setIsStudentAddOpen(true);
  };

  const handleCloseStudentAdd = () => {
    setIsStudentAddOpen(false);
    setIsSavingStudentAdd(false);
    setStudentAddForm(buildStudentAddInitialForm(false));
    setStudentParentSearch('');
    setIsStudentParentDropdownOpen(false);
  };

  const handleSaveStudentAdd = async () => {
    if (isSavingStudentAdd) return;

    const name = studentAddForm.name.trim();
    const resolvedStudentCode = (studentAddForm.autoGenerateCode
      ? buildUniqueCode(
          'S',
          studentsDataRef.current.map((row) => row.studentCode)
        )
      : studentAddForm.studentCode
    ).trim();
    const parentCode = studentAddForm.parentCode.trim();
    const grade = studentAddForm.grade.trim();

    if (!name) {
      alert('من فضلك أدخل اسم الطالب');
      return;
    }

    if (!resolvedStudentCode) {
      alert('من فضلك أدخل رمز تعريف الطالب');
      return;
    }

    if (!parentCode) {
      alert('من فضلك اختر ولي الأمر');
      return;
    }

    if (!grade) {
      alert('من فضلك أدخل الصف الدراسي');
      return;
    }

    const duplicateStudentCode = studentsDataRef.current.some(
      (row) => normalizeKey(row.studentCode) === normalizeKey(resolvedStudentCode)
    );
    if (duplicateStudentCode) {
      alert('كود الطالب موجود بالفعل');
      return;
    }

    const linkedParent = parentsDataRef.current.find((row) => {
      const normalizedSelected = normalizeKey(parentCode);
      return (
        normalizeKey(row.code) === normalizedSelected || normalizeKey(row.code2) === normalizedSelected
      );
    });

    const nextStudent: StudentRow = {
      name,
      studentCode: resolvedStudentCode,
      grade,
      parentCode,
      parentName: linkedParent?.name || '',
      externalId: studentAddForm.externalId.trim(),
      birthDate: studentAddForm.birthDate.trim(),
      classification: studentAddForm.classification.trim(),
    };

    const nextStudents = dedupeStudents([nextStudent, ...studentsDataRef.current]);
    setIsSavingStudentAdd(true);
    setStudentsData(nextStudents);
    studentsDataRef.current = nextStudents;

    const saveResult = await saveSchoolControlToServer(parentsDataRef.current, nextStudents);
    if (!saveResult.ok) {
      alert(`تم إضافة الطالب محليًا، لكن فشل الحفظ على الخادم: ${saveResult.error}`);
      setIsSavingStudentAdd(false);
      return;
    }

    setIsSavingStudentAdd(false);
    handleCloseStudentAdd();
  };

  const handleQuickActionClick = (actionId: string) => {
    if (actionId === 'new-parent') {
      openParentAddDrawer();
      return;
    }
    if (actionId === 'new-student') {
      openStudentAddDrawer();
      return;
    }
    if (actionId === 'new-form') {
      setActiveTab('students');
      return;
    }
    if (actionId === 'new-invoice') {
      setActiveTab('parents');
    }
  };

  const handleClassViewStudents = (className: string) => {
    setActiveTab('students');
    setStudentSearch(className === 'غير محدد' ? '' : className);
    setStudentsPage(1);
  };

  const handleDeleteClass = async (classRow: ClassSummaryRow) => {
    const confirmed = window.confirm(`هل تريد حذف جميع الطلاب في صف "${classRow.className}"؟`);
    if (!confirmed) return;

    const nextStudents = dedupeStudents(
      studentsDataRef.current.filter((student) => {
        const grade = String(student.grade || '').trim() || 'غير محدد';
        return normalizeKey(grade) !== classRow.key;
      })
    );

    setStudentsData(nextStudents);
    studentsDataRef.current = nextStudents;

    const saveResult = await saveSchoolControlToServer(parentsDataRef.current, nextStudents);
    if (!saveResult.ok) {
      alert(`تم حذف الصف محليًا، لكن فشل الحفظ على الخادم: ${saveResult.error}`);
    }
  };

  const handleParentUploadClick = () => {
    if (parentFileInputRef.current) {
      parentFileInputRef.current.click();
    }
  };

  const handleParentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
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
            secretKey: getValueByAliases(row, ['Secret Key', 'SecretKey', 'المفتاح السري']),
          };
        })
        .filter((row) => row.name || row.code);

      const nextParents = dedupeParents([...mappedData, ...parentsDataRef.current]);
      setParentsData(nextParents);
      const saveResult = await saveSchoolControlToServer(nextParents, studentsDataRef.current);
      if (!saveResult.ok) {
        alert(`تم رفع أولياء الأمور محليًا، لكن فشل الحفظ على الخادم: ${saveResult.error}`);
      }

      if (parentFileInputRef.current) {
        parentFileInputRef.current.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleParentDownload = () => {
    if (filteredParentsData.length === 0) {
      alert('لا توجد بيانات في جدول أولياء الأمور لتحميلها');
      return;
    }

    const headers = ['اسم ولي الامر', 'كود ولي الامر', 'كود ولي الامر الثانى', 'البريد الإلكتروني', 'رقم الهاتف'];
    const exportData = filteredParentsData.map((row) => ({
      'اسم ولي الامر': row.name || '',
      'كود ولي الامر': row.code || '',
      'كود ولي الامر الثانى': row.code2 || '',
      'البريد الإلكتروني': row.email || '',
      'رقم الهاتف': row.phone || '',
    }));

    const ws = utils.json_to_sheet(exportData, { header: headers });
    ws['!cols'] = headers.map((header) => ({ wch: Math.max(header.length + 4, 18) }));
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Parents');
    writeFile(wb, 'parents_export.xlsx');
  };

  const handleStudentUploadClick = () => {
    if (studentFileInputRef.current) {
      studentFileInputRef.current.click();
    }
  };

  const handleStudentDownload = () => {
    if (filteredStudentsData.length === 0) {
      alert('لا توجد بيانات في جدول الطلاب لتحميلها');
      return;
    }

    const headers = ['اسم الطالب', 'كود الطالب', 'السنه الدراسيه', 'رقم تعريف ولي الامر'];
    const exportData = filteredStudentsData.map((row) => ({
      'اسم الطالب': row.name || '',
      'كود الطالب': row.studentCode || '',
      'السنه الدراسيه': row.grade || '',
      'رقم تعريف ولي الامر': row.parentCode || '',
    }));

    const ws = utils.json_to_sheet(exportData, { header: headers });
    ws['!cols'] = headers.map((header) => ({ wch: Math.max(header.length + 4, 18) }));
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Students');
    writeFile(wb, 'students_export.xlsx');
  };

  const handleStudentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
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
          parentName: getValueByAliases(row, ['Parent Name', 'اسم ولي الأمر']),
          externalId: getValueByAliases(row, ['External ID', 'رقم التعريف الخارجي']),
          birthDate: getValueByAliases(row, ['Birth Date', 'تاريخ الميلاد']),
          classification: getValueByAliases(row, ['Classification', 'اسم تصنيف الطلاب']),
        }))
        .filter((row) => row.name || row.studentCode || row.parentCode);

      const nextStudents = dedupeStudents([...mappedData, ...studentsDataRef.current]);
      setStudentsData(nextStudents);
      const saveResult = await saveSchoolControlToServer(parentsDataRef.current, nextStudents);
      if (!saveResult.ok) {
        alert(`تم رفع الطلاب محليًا، لكن فشل الحفظ على الخادم: ${saveResult.error}`);
      }

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
      [row.name, row.studentCode, row.grade, row.parentCode, row.parentName, row.externalId]
        .map((value) => normalizeKey(value))
        .some((value) => value.includes(query))
    );
  }, [studentsData, studentSearch]);

  const parentSelectOptions = useMemo(() => {
    const byCode = new Map<string, { code: string; name: string }>();

    parentsData.forEach((row) => {
      const name = row.name || 'ولي أمر';
      [row.code, row.code2].forEach((value) => {
        const code = String(value || '').trim();
        const key = normalizeKey(code);
        if (!code || !key || byCode.has(key)) return;
        byCode.set(key, { code, name });
      });
    });

    return Array.from(byCode.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [parentsData]);

  const filteredParentSelectOptions = useMemo(() => {
    const query = normalizeKey(studentParentSearch);
    if (!query) return parentSelectOptions;

    return parentSelectOptions.filter((parent) =>
      normalizeKey(`${parent.name} ${parent.code}`).includes(query)
    );
  }, [parentSelectOptions, studentParentSearch]);

  useEffect(() => {
    if (!isStudentAddOpen || !studentAddForm.parentCode) return;

    const selectedParent = parentSelectOptions.find(
      (parent) => normalizeKey(parent.code) === normalizeKey(studentAddForm.parentCode)
    );
    if (!selectedParent) return;

    const nextLabel = `${selectedParent.name} - ${selectedParent.code}`;
    if (studentParentSearch !== nextLabel) {
      setStudentParentSearch(nextLabel);
    }
  }, [isStudentAddOpen, parentSelectOptions, studentAddForm.parentCode, studentParentSearch]);

  const studentGradeOptions = useMemo(() => {
    return Array.from(
      new Set(studentsData.map((row) => row.grade.trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [studentsData]);

  const classesData = useMemo(() => {
    const byClass = new Map<string, ClassSummaryRow>();

    studentsData.forEach((student) => {
      const rawGrade = String(student.grade || '').trim();
      const className = rawGrade || 'غير محدد';
      const key = normalizeKey(className) || 'undefined-class';

      const existing = byClass.get(key);
      if (existing) {
        existing.studentsCount += 1;
        return;
      }

      byClass.set(key, {
        key,
        className,
        displayName: className,
        studentsCount: 1,
      });
    });

    return Array.from(byClass.values()).sort((a, b) => {
      if (b.studentsCount !== a.studentsCount) return b.studentsCount - a.studentsCount;
      return a.className.localeCompare(b.className, 'ar');
    });
  }, [studentsData]);

  const filteredClassesData = useMemo(() => {
    const query = normalizeKey(classSearch);
    if (!query) return classesData;

    return classesData.filter((row) =>
      [row.className, row.displayName, String(row.studentsCount)]
        .map((value) => normalizeKey(value))
        .some((value) => value.includes(query))
    );
  }, [classSearch, classesData]);

  const parentsTotalPages = Math.max(1, Math.ceil(filteredParentsData.length / parentsPageSize));
  const studentsTotalPages = Math.max(1, Math.ceil(filteredStudentsData.length / studentsPageSize));
  const classesTotalPages = Math.max(1, Math.ceil(filteredClassesData.length / classesPageSize));

  useEffect(() => {
    setParentsPage((current) => Math.min(Math.max(1, current), parentsTotalPages));
  }, [parentsTotalPages]);

  useEffect(() => {
    setStudentsPage((current) => Math.min(Math.max(1, current), studentsTotalPages));
  }, [studentsTotalPages]);

  useEffect(() => {
    setClassesPage((current) => Math.min(Math.max(1, current), classesTotalPages));
  }, [classesTotalPages]);

  const paginatedParentsData = useMemo(() => {
    const startIndex = (parentsPage - 1) * parentsPageSize;
    return filteredParentsData.slice(startIndex, startIndex + parentsPageSize);
  }, [filteredParentsData, parentsPage, parentsPageSize]);

  const paginatedStudentsData = useMemo(() => {
    const startIndex = (studentsPage - 1) * studentsPageSize;
    return filteredStudentsData.slice(startIndex, startIndex + studentsPageSize);
  }, [filteredStudentsData, studentsPage, studentsPageSize]);

  const paginatedClassesData = useMemo(() => {
    const startIndex = (classesPage - 1) * classesPageSize;
    return filteredClassesData.slice(startIndex, startIndex + classesPageSize);
  }, [filteredClassesData, classesPage, classesPageSize]);

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

  const parentChildrenPayments = useMemo(() => {
    if (!selectedParent || selectedParentCodes.length === 0) return [];

    const byStudent = new Map<string, ParentChildPaymentsGroup>();

    const ensureStudent = (seed: { name?: string; studentCode?: string; grade?: string; externalId?: string }) => {
      const key = normalizeKey(seed.studentCode || seed.name || '');
      if (!key) return null;

      const existing = byStudent.get(key);
      if (existing) {
        existing.name = existing.name || seed.name || '';
        existing.studentCode = existing.studentCode || seed.studentCode || '';
        existing.grade = existing.grade || seed.grade || '';
        existing.externalId = existing.externalId || seed.externalId || '';
        return existing;
      }

      const created: ParentChildPaymentsGroup = {
        key,
        name: seed.name || '-',
        studentCode: seed.studentCode || '-',
        grade: seed.grade || '-',
        externalId: seed.externalId || '-',
        transactions: [],
        paidAmount: 0,
      };
      byStudent.set(key, created);
      return created;
    };

    studentsData
      .filter((row) => selectedParentCodes.includes(normalizeKey(row.parentCode)))
      .forEach((row) => {
        ensureStudent({
          name: row.name,
          studentCode: row.studentCode,
          grade: row.grade,
          externalId: row.externalId,
        });
      });

    parentTransactions.forEach((tx) => {
      const student = ensureStudent({
        name: tx.studentName,
        studentCode: tx.studentId,
        grade: tx.gradeName,
      });

      if (!student) return;

      student.transactions.push(tx);
      if (isSuccessfulStatus(tx.status)) {
        student.paidAmount += parseAmount(tx.total);
      }
    });

    return Array.from(byStudent.values()).sort((a, b) => {
      if (b.paidAmount !== a.paidAmount) return b.paidAmount - a.paidAmount;
      return a.name.localeCompare(b.name, 'ar');
    }).map((child) => ({
      ...child,
      transactions: [...child.transactions].sort((a, b) => {
        const dateDiff = parseDateToTimestamp(b.date) - parseDateToTimestamp(a.date);
        if (dateDiff !== 0) return dateDiff;
        return String(b.id).localeCompare(String(a.id), 'en');
      }),
    }));
  }, [selectedParent, selectedParentCodes, studentsData, parentTransactions]);

  const parentTotalPaid = useMemo(
    () => parentChildrenPayments.reduce((sum, child) => sum + child.paidAmount, 0),
    [parentChildrenPayments]
  );

  const parentTransactionsCount = useMemo(
    () => parentChildrenPayments.reduce((sum, child) => sum + child.transactions.length, 0),
    [parentChildrenPayments]
  );

  return (
    <div className="p-4 md:p-8 space-y-6 min-h-screen relative pb-24">
      <div className="flex justify-end items-center gap-2 mb-2 text-gray-500 hover:text-brand-purple cursor-pointer w-fit ml-auto">
        <h2 className="font-bold text-xl text-gray-600">الفردوس الخاصة بالغربية</h2>
        <ArrowRight className="w-5 h-5" />
      </div>

      <div className="sticky top-24 md:top-28 z-30 -mx-4 md:-mx-8 px-4 md:px-8 bg-[#f5f5f8] flex items-center gap-8 border-b border-gray-200 mb-6 overflow-x-auto">
        <div
          className={`pb-4 px-2 cursor-pointer transition-all flex items-center gap-2 ${
            activeTab === 'classes' ? 'border-b-2 border-brand-purple text-brand-purple' : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('classes')}
        >
          <span className="font-bold">الصفوف</span>
          <span className="bg-purple-100 text-brand-purple text-xs px-2 py-0.5 rounded-full font-bold">
            {classesData.length}
          </span>
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

      {activeTab === 'classes' && (
        <>
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div className="w-full xl:w-auto flex justify-end">
              <div className="relative flex items-center w-full md:w-80 bg-gray-50 rounded-full border border-gray-200 hover:bg-white transition-colors">
                <input
                  type="text"
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  placeholder="بحث"
                  className="w-full py-2 px-4 bg-transparent outline-none text-right placeholder-gray-400"
                />
                <Search className="w-5 h-5 text-gray-400 absolute left-4" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mt-6">
            <table className="w-full min-w-[950px] border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm font-bold">
                  <th className="py-4 px-4 text-right">
                    <div className="flex items-center gap-1 cursor-pointer">
                      اسم الصف
                      <ArrowDownUp className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th className="py-4 px-4 text-right">اسم العرض</th>
                  <th className="py-4 px-4 text-right">
                    <div className="flex items-center gap-1 cursor-pointer">
                      عدد الطلاب
                      <ArrowDownUp className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th className="py-4 px-4 text-right">تحديث البيانات</th>
                  <th className="py-4 px-4 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 text-sm">
                {filteredClassesData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">
                      لا توجد صفوف متاحة من بيانات الطلاب
                    </td>
                  </tr>
                ) : (
                  paginatedClassesData.map((row) => (
                    <tr key={row.key} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4 font-semibold">{row.className}</td>
                      <td className="py-4 px-4 text-gray-500">{row.displayName}</td>
                      <td className="py-4 px-4 text-gray-700 font-semibold">{row.studentsCount}</td>
                      <td className="py-4 px-4">
                        <button
                          type="button"
                          onClick={() => handleClassViewStudents(row.className)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                          title="عرض طلاب الصف"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="py-4 px-4">
                        <button
                          type="button"
                          onClick={() => void handleDeleteClass(row)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                          title="حذف جميع طلاب الصف"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {activeTab === 'parents' && !selectedParent && (
        <>
          <div className="sticky top-[9.25rem] md:top-[10rem] z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-[#f5f5f8] border-b border-gray-200">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3 order-2 xl:order-1">
              <button
                type="button"
                onClick={openParentAddDrawer}
                className="flex items-center gap-2 px-6 py-2 bg-brand-purple text-white rounded-full font-bold hover:bg-purple-700 transition-colors shadow-sm"
              >
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

              <button
                type="button"
                onClick={handleParentDownload}
                className="flex items-center gap-2 px-6 py-2 border border-brand-purple text-brand-purple rounded-full bg-white hover:bg-purple-50 transition-colors font-bold"
              >
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
                  paginatedParentsData.map((row, index) => (
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
                        <button
                          type="button"
                          onClick={() => openParentEditDrawer(row)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                        >
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5 md:col-span-2">
              <div className="text-gray-500 text-lg mb-1">إجمالي المدفوع</div>
              <div className="text-4xl font-bold text-brand-purple" dir="ltr">
                {formatAmount(parentTotalPaid)}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-gray-500 text-lg mb-1">إجمالي العمليات</div>
              <div className="text-4xl font-bold text-brand-purple">{parentTransactionsCount}</div>
            </div>
          </div>

          {parentChildrenPayments.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400 text-2xl font-semibold">
              لا يوجد أبناء مرتبطون بهذا الرقم
            </div>
          ) : (
            <div className="space-y-6">
              {parentChildrenPayments.map((child) => {
                const studentInitial = (child.name || '-').trim().charAt(0) || '-';
                const childSearch = parentChildSearchByKey[child.key] || '';
                const normalizedChildSearch = normalizeKey(childSearch);
                const childTransactions = normalizedChildSearch
                  ? child.transactions.filter((tx) =>
                      normalizeKey(
                        `${tx.itemName} ${tx.id} ${tx.merchantOrderId} ${tx.studentName} ${tx.date} ${tx.method}`
                      ).includes(normalizedChildSearch)
                    )
                  : child.transactions;

                return (
                  <div key={child.key} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                      <h4 className="text-3xl font-bold text-gray-700">{child.name || 'طالب'}</h4>
                      <div className="text-brand-purple text-2xl font-bold flex items-center gap-2">
                        <span>{childTransactions.length}</span>
                        <span>المدفوع</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 p-4 bg-[#fafafb]">
                      <div className="xl:col-span-8 bg-white border border-gray-100 rounded-xl">
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-4">
                          <button
                            type="button"
                            className="px-5 py-2 rounded-full border border-[#9b79e8] text-brand-purple font-bold hover:bg-purple-50 transition-colors"
                          >
                            طلب دفع فوري
                          </button>
                          <div className="relative w-full max-w-md">
                            <input
                              type="text"
                              value={childSearch}
                              onChange={(e) =>
                                setParentChildSearchByKey((prev) => ({ ...prev, [child.key]: e.target.value }))
                              }
                              placeholder="بحث خلال الاسم او رقم العملية"
                              className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pr-4 pl-10 text-sm text-gray-700 outline-none focus:border-brand-purple"
                            />
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          </div>
                        </div>

                        {childTransactions.length === 0 ? (
                          <div className="p-8 text-center text-gray-400">لا توجد عمليات مطابقة</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[840px] border-collapse">
                              <thead>
                                <tr className="text-gray-700 text-sm font-bold border-b border-gray-100">
                                  <th className="py-3 px-4 text-right">Payment Name</th>
                                  <th className="py-3 px-4 text-right">Transaction Number</th>
                                  <th className="py-3 px-4 text-right">Order Date</th>
                                  <th className="py-3 px-4 text-right">Payment Method</th>
                                  <th className="py-3 px-4 text-right">Amount</th>
                                  <th className="py-3 px-4 text-right">Academic Year</th>
                                </tr>
                              </thead>
                              <tbody className="text-gray-600 text-sm">
                                {childTransactions.map((tx, index) => {
                                  const rowKey = `${child.key}-${tx.id}-${index}`;
                                  const isExpanded = expandedParentTransactionKey === rowKey;
                                  return (
                                    <React.Fragment key={rowKey}>
                                      <tr
                                        className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                                        onClick={() =>
                                          setExpandedParentTransactionKey((current) =>
                                            current === rowKey ? null : rowKey
                                          )
                                        }
                                      >
                                        <td className="py-3 px-4">{tx.itemName || 'Tuition Fees'}</td>
                                        <td className="py-3 px-4 font-mono">{tx.id || '-'}</td>
                                        <td className="py-3 px-4 font-mono">{tx.date || '-'}</td>
                                        <td className="py-3 px-4">{tx.method || '-'}</td>
                                        <td className="py-3 px-4 font-semibold" dir="ltr">
                                          {formatAmount(parseAmount(tx.total), tx.currency || 'EGP')}
                                        </td>
                                        <td className="py-3 px-4">{tx.academicYear || child.grade || '-'}</td>
                                      </tr>
                                      {isExpanded && (
                                        <tr className="bg-[#f8f5ff] border-b border-gray-100">
                                          <td colSpan={6} className="px-4 py-4">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                                                <div className="text-gray-500 mb-1">Merchant Order ID</div>
                                                <div className="font-semibold">{tx.merchantOrderId || '-'}</div>
                                              </div>
                                              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                                                <div className="text-gray-500 mb-1">Bank Reference</div>
                                                <div className="font-semibold">{tx.bankReferenceNumber || '-'}</div>
                                              </div>
                                              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                                                <div className="text-gray-500 mb-1">Provider</div>
                                                <div className="font-semibold">{tx.provider || '-'}</div>
                                              </div>
                                              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                                                <div className="text-gray-500 mb-1">Status</div>
                                                <div className="font-semibold">{tx.status || '-'}</div>
                                              </div>
                                              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                                                <div className="text-gray-500 mb-1">Subtotal</div>
                                                <div className="font-semibold" dir="ltr">
                                                  {formatAmount(parseAmount(tx.totalNoTax), tx.currency || 'EGP')}
                                                </div>
                                              </div>
                                              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                                                <div className="text-gray-500 mb-1">Fees / Discount</div>
                                                <div className="font-semibold" dir="ltr">
                                                  {formatAmount(parseAmount(tx.fees), tx.currency || 'EGP')} /{' '}
                                                  {formatAmount(parseAmount(tx.discount), tx.currency || 'EGP')}
                                                </div>
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      <div className="xl:col-span-4 bg-white border border-gray-100 rounded-xl overflow-hidden">
                        <div className="p-6 flex flex-col items-center text-center border-b border-gray-100">
                          <div className="h-16 w-16 rounded-lg bg-purple-100 text-brand-purple text-4xl font-bold flex items-center justify-center mb-4">
                            {studentInitial}
                          </div>
                          <h5 className="text-3xl font-bold text-gray-700 leading-tight">{child.name || '-'}</h5>
                          <div className="mt-3 text-brand-purple text-2xl font-semibold font-mono">
                            {child.studentCode || '-'}
                          </div>
                        </div>
                        <div className="p-4 text-gray-600 text-sm space-y-2">
                          <div className="flex items-center justify-between">
                            <span>الصفوف الدراسية</span>
                            <span className="font-semibold">{child.grade || '-'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>رقم التعريف الخارجي</span>
                            <span className="font-semibold">{child.externalId || '-'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>عدد العمليات</span>
                            <span className="font-semibold">{child.transactions.length}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>إجمالي المدفوع</span>
                            <span className="font-semibold" dir="ltr">
                              {formatAmount(child.paidAmount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'students' && (
        <>
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3 order-2 xl:order-1">
              <button
                type="button"
                onClick={openStudentAddDrawer}
                className="flex items-center gap-2 px-6 py-2 bg-brand-purple text-white rounded-full font-bold hover:bg-purple-700 transition-colors shadow-sm"
              >
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

              <button
                type="button"
                onClick={handleStudentDownload}
                className="flex items-center gap-2 px-6 py-2 border border-brand-purple text-brand-purple rounded-full bg-white hover:bg-purple-50 transition-colors font-bold"
              >
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
                  paginatedStudentsData.map((row, index) => (
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

      {isParentAddOpen && (
        <div className="fixed inset-0 z-[80] bg-black/45" onClick={handleCloseParentAdd}>
          <aside
            className="absolute right-0 top-0 h-full w-full max-w-[700px] bg-[#f4f4f6] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="h-24 bg-gradient-to-r from-[#6f2eea] to-[#8737ff] text-white flex items-center justify-between px-6">
              <button
                type="button"
                onClick={handleCloseParentAdd}
                className="h-10 w-10 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center"
                aria-label="إغلاق"
              >
                <X className="w-7 h-7" />
              </button>
              <h3 className="text-3xl font-bold">اضافه ولي امر</h3>
            </div>

            <div className="flex-1 overflow-auto px-8 py-8 space-y-7">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <label className="block">
                  <span className="text-[#ff4e4e] text-lg font-semibold">* الاسم الاول</span>
                  <input
                    value={parentAddForm.firstName}
                    onChange={(e) => setParentAddForm((prev) => ({ ...prev, firstName: e.target.value }))}
                    className="w-full mt-3 bg-transparent border-b-2 border-gray-300 pb-2 text-2xl font-semibold text-gray-700 focus:outline-none focus:border-[#7e4de0]"
                  />
                </label>

                <label className="block">
                  <span className="text-gray-500 text-lg font-semibold">* اسم العائلة</span>
                  <input
                    value={parentAddForm.familyName}
                    onChange={(e) => setParentAddForm((prev) => ({ ...prev, familyName: e.target.value }))}
                    className="w-full mt-3 bg-transparent border-b-2 border-gray-300 pb-2 text-2xl font-semibold text-gray-700 focus:outline-none focus:border-[#7e4de0]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                <label className="flex items-center justify-start gap-3 pb-2">
                  <input
                    type="checkbox"
                    checked={parentAddForm.autoGenerateCode}
                    onChange={(e) =>
                      setParentAddForm((prev) => ({
                        ...prev,
                        autoGenerateCode: e.target.checked,
                        parentCode: e.target.checked
                          ? buildUniqueCode(
                              'P',
                              parentsDataRef.current.flatMap((row) => [row.code, row.code2])
                            )
                          : prev.parentCode,
                      }))
                    }
                    className="h-7 w-7 rounded border-gray-300 accent-[#7e4de0]"
                  />
                  <span className="text-gray-600 text-3xl font-semibold">انشاء الكود تلقائي</span>
                </label>

                <label className="block">
                  <span className="text-gray-500 text-lg font-semibold">* رقم تعريف ولي الامر</span>
                  <input
                    value={parentAddForm.parentCode}
                    disabled={parentAddForm.autoGenerateCode}
                    onChange={(e) => setParentAddForm((prev) => ({ ...prev, parentCode: e.target.value }))}
                    className="w-full mt-3 bg-transparent border-b-2 border-gray-300 pb-2 text-2xl font-semibold text-gray-700 focus:outline-none focus:border-[#7e4de0] disabled:text-gray-400 disabled:border-gray-200"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-gray-500 text-lg font-semibold">* البريد الالكتروني</span>
                <input
                  value={parentAddForm.email}
                  onChange={(e) => setParentAddForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full mt-3 bg-transparent border-b-2 border-gray-300 pb-2 text-2xl font-semibold text-gray-700 focus:outline-none focus:border-[#7e4de0]"
                  dir="ltr"
                />
              </label>

              <label className="block">
                <span className="text-gray-500 text-lg font-semibold">* رقم الهاتف المحمول</span>
                <input
                  value={parentAddForm.phone}
                  onChange={(e) => setParentAddForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full mt-3 bg-transparent border-b-2 border-gray-300 pb-2 text-2xl font-semibold text-gray-700 focus:outline-none focus:border-[#7e4de0]"
                  dir="ltr"
                />
              </label>

              <label className="block">
                <span className="text-gray-500 text-lg font-semibold">Secret Key</span>
                <input
                  value={parentAddForm.secretKey}
                  onChange={(e) => setParentAddForm((prev) => ({ ...prev, secretKey: e.target.value }))}
                  className="w-full mt-3 bg-transparent border-b-2 border-gray-300 pb-2 text-2xl font-semibold text-gray-700 focus:outline-none focus:border-[#7e4de0]"
                  dir="ltr"
                />
              </label>

              <div className="space-y-4 pt-3">
                <label className="flex items-center justify-start gap-3">
                  <input
                    type="checkbox"
                    checked={parentAddForm.addSecondParent}
                    onChange={(e) =>
                      setParentAddForm((prev) => ({
                        ...prev,
                        addSecondParent: e.target.checked,
                        secondParentCode: e.target.checked ? prev.secondParentCode : '',
                      }))
                    }
                    className="h-7 w-7 rounded border-gray-300 accent-[#7e4de0]"
                  />
                  <span className="text-gray-600 text-3xl font-semibold">إضافة ولي امر اخر</span>
                </label>

                {parentAddForm.addSecondParent && (
                  <label className="block">
                    <span className="text-gray-500 text-lg font-semibold">رقم تعريف ولي الأمر الثاني</span>
                    <input
                      value={parentAddForm.secondParentCode}
                      onChange={(e) => setParentAddForm((prev) => ({ ...prev, secondParentCode: e.target.value }))}
                      className="w-full mt-3 bg-transparent border-b-2 border-gray-300 pb-2 text-2xl font-semibold text-gray-700 focus:outline-none focus:border-[#7e4de0]"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="px-8 py-8">
              <button
                type="button"
                onClick={handleSaveParentAdd}
                disabled={isSavingParentAdd}
                className="min-w-44 h-16 px-8 rounded-full bg-gradient-to-r from-[#6f2eea] to-[#8737ff] text-white text-2xl font-bold hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {isSavingParentAdd ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </aside>
        </div>
      )}

      {isStudentAddOpen && (
        <div className="fixed inset-0 z-[80] bg-black/45" onClick={handleCloseStudentAdd}>
          <aside
            className="absolute right-0 top-0 h-full w-full max-w-[700px] bg-[#f4f4f6] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="h-24 bg-gradient-to-r from-[#6f2eea] to-[#8737ff] text-white flex items-center justify-between px-6">
              <button
                type="button"
                onClick={handleCloseStudentAdd}
                className="h-10 w-10 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center"
                aria-label="إغلاق"
              >
                <X className="w-7 h-7" />
              </button>
              <h3 className="text-3xl font-bold">اضافه طالب</h3>
            </div>

            <div className="flex-1 overflow-auto px-8 py-8 space-y-7">
              <label className="block">
                <span className="text-[#7e4de0] text-lg font-semibold">* اسم</span>
                <input
                  value={studentAddForm.name}
                  onChange={(e) => setStudentAddForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full mt-3 bg-transparent border-b-2 border-[#7e4de0] pb-2 text-2xl font-semibold text-gray-700 focus:outline-none"
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <label className="block">
                  <span className="text-gray-500 text-lg font-semibold">تاريخ الميلاد</span>
                  <input
                    type="date"
                    value={studentAddForm.birthDate}
                    onChange={(e) => setStudentAddForm((prev) => ({ ...prev, birthDate: e.target.value }))}
                    className="w-full mt-3 bg-transparent border-b-2 border-gray-300 pb-2 text-xl font-semibold text-gray-700 focus:outline-none focus:border-[#7e4de0]"
                  />
                </label>

                <label className="block">
                  <span className="text-gray-500 text-lg font-semibold">رقم التعريف الخارجي</span>
                  <input
                    value={studentAddForm.externalId}
                    onChange={(e) => setStudentAddForm((prev) => ({ ...prev, externalId: e.target.value }))}
                    className="w-full mt-3 bg-transparent border-b-2 border-gray-300 pb-2 text-2xl font-semibold text-gray-700 focus:outline-none focus:border-[#7e4de0]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                <label className="flex items-center justify-start gap-3 pb-2">
                  <input
                    type="checkbox"
                    checked={studentAddForm.autoGenerateCode}
                    onChange={(e) =>
                      setStudentAddForm((prev) => ({
                        ...prev,
                        autoGenerateCode: e.target.checked,
                        studentCode: e.target.checked
                          ? buildUniqueCode(
                              'S',
                              studentsDataRef.current.map((row) => row.studentCode)
                            )
                          : prev.studentCode,
                      }))
                    }
                    className="h-7 w-7 rounded border-gray-300 accent-[#7e4de0]"
                  />
                  <span className="text-gray-600 text-3xl font-semibold">انشاء الكود تلقائي</span>
                </label>

                <label className="block">
                  <span className="text-gray-500 text-lg font-semibold">* رمز تعريف الطالب</span>
                  <input
                    value={studentAddForm.studentCode}
                    disabled={studentAddForm.autoGenerateCode}
                    onChange={(e) => setStudentAddForm((prev) => ({ ...prev, studentCode: e.target.value }))}
                    className="w-full mt-3 bg-transparent border-b-2 border-gray-300 pb-2 text-2xl font-semibold text-gray-700 focus:outline-none focus:border-[#7e4de0] disabled:text-gray-400 disabled:border-gray-200"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-gray-500 text-lg font-semibold">اسم تصنيف الطلاب</span>
                <input
                  value={studentAddForm.classification}
                  onChange={(e) => setStudentAddForm((prev) => ({ ...prev, classification: e.target.value }))}
                  className="w-full mt-3 bg-transparent border-b-2 border-gray-300 pb-2 text-2xl font-semibold text-gray-700 focus:outline-none focus:border-[#7e4de0]"
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <label className="block">
                  <span className="text-gray-500 text-lg font-semibold">* الصف الدراسي</span>
                  <input
                    list="student-grade-options"
                    value={studentAddForm.grade}
                    onChange={(e) => setStudentAddForm((prev) => ({ ...prev, grade: e.target.value }))}
                    className="w-full mt-3 bg-transparent border-b-2 border-gray-300 pb-2 text-2xl font-semibold text-gray-700 focus:outline-none focus:border-[#7e4de0]"
                  />
                  <datalist id="student-grade-options">
                    {studentGradeOptions.map((grade) => (
                      <option key={grade} value={grade} />
                    ))}
                  </datalist>
                </label>

                <div className="block relative" ref={studentParentDropdownRef}>
                  <span className="text-gray-500 text-lg font-semibold">* أولياء الأمور</span>
                  <div className="relative mt-3">
                    <input
                      type="text"
                      value={studentParentSearch}
                      onFocus={() => setIsStudentParentDropdownOpen(true)}
                      onChange={(e) => {
                        setStudentParentSearch(e.target.value);
                        setIsStudentParentDropdownOpen(true);
                        setStudentAddForm((prev) => ({ ...prev, parentCode: '' }));
                      }}
                      placeholder="ابحث عن ولي الأمر بالاسم أو الكود"
                      className="w-full bg-transparent border-b-2 border-gray-300 pb-2 pl-10 text-xl font-semibold text-gray-700 focus:outline-none focus:border-[#7e4de0]"
                    />
                    <ChevronDown
                      className={`w-5 h-5 text-gray-500 absolute left-0 top-1 transition-transform ${
                        isStudentParentDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </div>

                  {isStudentParentDropdownOpen && (
                    <div className="absolute right-0 left-0 mt-2 max-h-56 overflow-auto rounded-xl border border-gray-200 bg-white shadow-xl z-30">
                      {filteredParentSelectOptions.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">لا يوجد ولي أمر مطابق للبحث</div>
                      ) : (
                        filteredParentSelectOptions.map((parent) => {
                          const isActive = normalizeKey(studentAddForm.parentCode) === normalizeKey(parent.code);
                          return (
                            <button
                              key={parent.code}
                              type="button"
                              onClick={() => {
                                setStudentAddForm((prev) => ({ ...prev, parentCode: parent.code }));
                                setStudentParentSearch(`${parent.name} - ${parent.code}`);
                                setIsStudentParentDropdownOpen(false);
                              }}
                              className={`w-full text-right px-4 py-2.5 text-sm transition-colors ${
                                isActive ? 'bg-purple-50 text-brand-purple font-semibold' : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {parent.name} - {parent.code}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-8 py-8">
              <button
                type="button"
                onClick={handleSaveStudentAdd}
                disabled={isSavingStudentAdd}
                className="min-w-44 h-16 px-8 rounded-full bg-gradient-to-r from-[#6f2eea] to-[#8737ff] text-white text-2xl font-bold hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {isSavingStudentAdd ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </aside>
        </div>
      )}

      {isParentEditOpen && (
        <div className="fixed inset-0 z-[80] bg-black/45" onClick={handleCloseParentEdit}>
          <aside
            className="absolute right-0 top-0 h-full w-full max-w-[600px] bg-[#f4f4f6] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="h-24 bg-gradient-to-r from-[#6f2eea] to-[#8737ff] text-white flex items-center justify-between px-6">
              <button
                type="button"
                onClick={handleCloseParentEdit}
                className="h-10 w-10 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center"
                aria-label="إغلاق"
              >
                <X className="w-7 h-7" />
              </button>
              <h3 className="text-3xl font-bold">تعديل بيانات ولي الامر</h3>
            </div>

            <div className="flex-1 overflow-auto px-10 py-8 space-y-7">
              <div className="grid grid-cols-2 gap-8">
                <label className="block">
                  <span className="text-[#7e4de0] text-lg font-semibold">* الاسم الاول</span>
                  <input
                    value={parentEditForm.firstName}
                    onChange={(e) => setParentEditForm((prev) => ({ ...prev, firstName: e.target.value }))}
                    className="w-full mt-3 bg-transparent border-b-2 border-[#7e4de0] pb-2 text-2xl font-semibold text-gray-700 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-gray-500 text-lg font-semibold">* اسم العائلة</span>
                  <input
                    value={parentEditForm.familyName}
                    onChange={(e) => setParentEditForm((prev) => ({ ...prev, familyName: e.target.value }))}
                    className="w-full mt-3 bg-transparent border-b-2 border-gray-300 pb-2 text-2xl font-semibold text-gray-700 focus:outline-none focus:border-[#7e4de0]"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-gray-500 text-lg font-semibold">* رقم تعريف ولي الامر</span>
                <input
                  value={parentEditForm.parentCode}
                  onChange={(e) => setParentEditForm((prev) => ({ ...prev, parentCode: e.target.value }))}
                  className="w-full mt-3 bg-transparent border-b-2 border-gray-300 pb-2 text-2xl font-semibold text-gray-700 focus:outline-none focus:border-[#7e4de0]"
                />
              </label>

              <label className="block">
                <span className="text-gray-500 text-lg font-semibold">البريد الالكتروني</span>
                <input
                  value={parentEditForm.email}
                  onChange={(e) => setParentEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full mt-3 bg-transparent border-b-2 border-gray-300 pb-2 text-2xl font-semibold text-gray-700 focus:outline-none focus:border-[#7e4de0]"
                  dir="ltr"
                />
              </label>

              <label className="block">
                <span className="text-gray-500 text-lg font-semibold">رقم الهاتف المحمول</span>
                <input
                  value={parentEditForm.phone}
                  onChange={(e) => setParentEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full mt-3 bg-transparent border-b-2 border-gray-300 pb-2 text-2xl font-semibold text-gray-700 focus:outline-none focus:border-[#7e4de0]"
                  dir="ltr"
                />
              </label>
            </div>

            <div className="px-10 py-8">
              <button
                type="button"
                onClick={handleSaveParentEdit}
                disabled={isSavingParentEdit}
                className="min-w-44 h-16 px-8 rounded-full bg-gradient-to-r from-[#6f2eea] to-[#8737ff] text-white text-2xl font-bold hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {isSavingParentEdit ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </aside>
        </div>
      )}

      {activeTab === 'parents' && !selectedParent && (
        <Pagination
          totalItems={filteredParentsData.length}
          currentPage={parentsPage}
          pageSize={parentsPageSize}
          onPageChange={setParentsPage}
          onPageSizeChange={(size) => {
            setParentsPageSize(size);
            setParentsPage(1);
          }}
        />
      )}

      {activeTab === 'classes' && (
        <Pagination
          totalItems={filteredClassesData.length}
          currentPage={classesPage}
          pageSize={classesPageSize}
          onPageChange={setClassesPage}
          onPageSizeChange={(size) => {
            setClassesPageSize(size);
            setClassesPage(1);
          }}
        />
      )}

      {activeTab === 'students' && (
        <Pagination
          totalItems={filteredStudentsData.length}
          currentPage={studentsPage}
          pageSize={studentsPageSize}
          onPageChange={setStudentsPage}
          onPageSizeChange={(size) => {
            setStudentsPageSize(size);
            setStudentsPage(1);
          }}
        />
      )}

      <FloatingQuickActions onActionClick={handleQuickActionClick} />
    </div>
  );
};
