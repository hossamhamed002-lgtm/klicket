import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Plus,
  Upload,
  Download,
  Edit,
  X,
  ChevronDown,
  ArrowDownUp,
  ArrowRight,
} from 'lucide-react';
import { read, utils } from 'xlsx';
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
  const [parentsPage, setParentsPage] = useState(1);
  const [parentsPageSize, setParentsPageSize] = useState(5);
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsPageSize, setStudentsPageSize] = useState(5);
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

  const parentFileInputRef = useRef<HTMLInputElement>(null);
  const studentFileInputRef = useRef<HTMLInputElement>(null);
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
    if (!isAnyDrawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isAnyDrawerOpen]);

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
    setIsStudentAddOpen(true);
  };

  const handleCloseStudentAdd = () => {
    setIsStudentAddOpen(false);
    setIsSavingStudentAdd(false);
    setStudentAddForm(buildStudentAddInitialForm(false));
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

  const handleStudentUploadClick = () => {
    if (studentFileInputRef.current) {
      studentFileInputRef.current.click();
    }
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

  const studentGradeOptions = useMemo(() => {
    return Array.from(
      new Set(studentsData.map((row) => row.grade.trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [studentsData]);

  const parentsTotalPages = Math.max(1, Math.ceil(filteredParentsData.length / parentsPageSize));
  const studentsTotalPages = Math.max(1, Math.ceil(filteredStudentsData.length / studentsPageSize));

  useEffect(() => {
    setParentsPage((current) => Math.min(Math.max(1, current), parentsTotalPages));
  }, [parentsTotalPages]);

  useEffect(() => {
    setStudentsPage((current) => Math.min(Math.max(1, current), studentsTotalPages));
  }, [studentsTotalPages]);

  const paginatedParentsData = useMemo(() => {
    const startIndex = (parentsPage - 1) * parentsPageSize;
    return filteredParentsData.slice(startIndex, startIndex + parentsPageSize);
  }, [filteredParentsData, parentsPage, parentsPageSize]);

  const paginatedStudentsData = useMemo(() => {
    const startIndex = (studentsPage - 1) * studentsPageSize;
    return filteredStudentsData.slice(startIndex, startIndex + studentsPageSize);
  }, [filteredStudentsData, studentsPage, studentsPageSize]);

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

                <label className="block">
                  <span className="text-gray-500 text-lg font-semibold">* أولياء الأمور</span>
                  <select
                    value={studentAddForm.parentCode}
                    onChange={(e) => setStudentAddForm((prev) => ({ ...prev, parentCode: e.target.value }))}
                    className="w-full mt-3 bg-transparent border-b-2 border-gray-300 pb-2 text-xl font-semibold text-gray-700 focus:outline-none focus:border-[#7e4de0]"
                  >
                    <option value="">اختر ولي الأمر</option>
                    {parentSelectOptions.map((parent) => (
                      <option key={parent.code} value={parent.code}>
                        {parent.name} - {parent.code}
                      </option>
                    ))}
                  </select>
                </label>
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
