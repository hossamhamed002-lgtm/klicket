import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown, Calendar, Download, SlidersHorizontal, ArrowDownUp, Upload, X, Check } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';
import { Pagination } from './Pagination';

interface TransactionRow {
  id: string;
  customer: string;
  customerPhone: string;
  customerEmail: string;
  totalNoTax: string;
  total: string;
  date: string;
  dateValue: Date | null;
  status: string;
  branch: string;
  method: string;
  currency: string;
  provider: string;
  bankReferenceNumber: string;
  merchantOrderId: string;
  parentCode: string;
  parentName: string;
  studentId: string;
  studentName: string;
  gradeName: string;
  itemName: string;
  itemAmount: string;
  quantity: string;
  academicYear: string;
  fees: string;
  discount: string;
}

type SearchFieldKey =
  | 'transactionId'
  | 'customerName'
  | 'customerPhone'
  | 'customerEmail'
  | 'parentCode'
  | 'studentCode'
  | 'parentName'
  | 'studentName'
  | 'bankReference'
  | 'merchantOrderId';

interface SearchFieldOption {
  key: SearchFieldKey;
  label: string;
  getValue: (row: TransactionRow) => string;
}

const STATUS_OPTIONS = ['ناجحة', 'منتظرة', 'غير ناجحة', 'مستردة', 'ملغية'] as const;
type StatusOption = (typeof STATUS_OPTIONS)[number];

const SEARCH_FIELD_OPTIONS: SearchFieldOption[] = [
  { key: 'transactionId', label: 'رقم العمليه', getValue: (row) => row.id },
  {
    key: 'customerName',
    label: 'اسم العميل',
    getValue: (row) => `${row.customer} ${row.studentName} ${row.parentName}`.trim(),
  },
  { key: 'customerPhone', label: 'رقم هاتف العميل', getValue: (row) => row.customerPhone },
  { key: 'customerEmail', label: 'البريد الإلكتروني للعميل', getValue: (row) => row.customerEmail },
  { key: 'parentCode', label: 'كود ولي الأمر', getValue: (row) => row.parentCode },
  { key: 'studentCode', label: 'كود الطالب', getValue: (row) => row.studentId },
  { key: 'parentName', label: 'اسم ولي الأمر', getValue: (row) => row.parentName },
  { key: 'studentName', label: 'اسم الطالب', getValue: (row) => row.studentName },
  { key: 'bankReference', label: 'رقم العملية البنكيه', getValue: (row) => row.bankReferenceNumber },
  { key: 'merchantOrderId', label: 'رقم العملية من قبل المؤسسة', getValue: (row) => row.merchantOrderId },
];

const TRANSACTIONS_API_ENDPOINT = '/api/transactions';

export const TransactionsPage: React.FC = () => {
  // State for transaction data
  const [transactionsData, setTransactionsData] = useState<TransactionRow[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<StatusOption[]>(['ناجحة']);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [selectedSearchField, setSelectedSearchField] = useState<SearchFieldKey>('transactionId');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRow | null>(null);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // --- Helper: Clean Number String ---
  const cleanNumber = (val: any): string => {
    if (val === undefined || val === null || val === '') return '0.00';
    const str = String(val);
    const cleaned = str.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  const normalizeText = (val: any): string =>
    String(val ?? '')
      .toLowerCase()
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const findColumnIndex = (headerRow: any[], aliases: string[]): number => {
    const normalizedHeaders = headerRow.map((cell) => normalizeText(cell));
    const normalizedAliases = aliases.map((alias) => normalizeText(alias));

    for (let i = 0; i < normalizedHeaders.length; i += 1) {
      const header = normalizedHeaders[i];
      if (!header) continue;
      if (normalizedAliases.some((alias) => header === alias || header.includes(alias))) {
        return i;
      }
    }
    return -1;
  };

  const excelSerialToDate = (serial: number): Date => {
    const utcDays = Math.floor(serial - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    const fractionalDay = serial - Math.floor(serial) + 0.0000001;
    const totalSeconds = Math.floor(86400 * fractionalDay);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);

    return new Date(
      dateInfo.getUTCFullYear(),
      dateInfo.getUTCMonth(),
      dateInfo.getUTCDate(),
      hours,
      minutes,
      seconds
    );
  };

  const parseTransactionDate = (value: any): Date | null => {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

    const str = String(value).trim();
    if (!str) return null;

    if (/^\d+(\.\d+)?$/.test(str)) {
      const num = parseFloat(str);
      if (num > 20000 && num < 90000) {
        return excelSerialToDate(num);
      }
    }

    const ddmmyyyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1], 10);
      const month = parseInt(ddmmyyyy[2], 10) - 1;
      const year = parseInt(ddmmyyyy[3], 10);
      const hour = parseInt(ddmmyyyy[4] ?? '0', 10);
      const minute = parseInt(ddmmyyyy[5] ?? '0', 10);
      const second = parseInt(ddmmyyyy[6] ?? '0', 10);
      return new Date(year, month, day, hour, minute, second);
    }

    const parsed = new Date(str);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatDateForDisplay = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const parseInputDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map((part) => parseInt(part, 10));
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  };

  const formatInputDateLabel = (dateStr: string): string => {
    const parsed = parseInputDate(dateStr);
    return parsed ? formatDateForDisplay(parsed) : '--/--/----';
  };

  const normalizeSearchValue = (val: any): string =>
    String(val ?? '')
      .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
      .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06ff]+/g, '');

  const normalizeStatus = (status: string): StatusOption | '' => {
    const value = String(status ?? '').toLowerCase().trim();
    if (!value) return '';
    if (value.includes('success') || value === 'ناجحة' || value.includes('تمت')) return 'ناجحة';
    if (value.includes('pending') || value.includes('waiting') || value.includes('منتظرة')) return 'منتظرة';
    if (
      value.includes('failed') ||
      value.includes('declined') ||
      value.includes('error') ||
      value.includes('غير ناجحة')
    ) {
      return 'غير ناجحة';
    }
    if (value.includes('refund') || value.includes('refunded') || value.includes('مستردة')) return 'مستردة';
    if (value.includes('cancel') || value.includes('canceled') || value.includes('cancelled') || value.includes('ملغية')) {
      return 'ملغية';
    }
    return '';
  };

  const mergeTransactionRows = (base: TransactionRow, incoming: TransactionRow): TransactionRow => {
    const choose = (a: string, b: string) => (a && a.trim() ? a : b);
    return {
      ...base,
      customer: choose(base.customer, incoming.customer),
      customerPhone: choose(base.customerPhone, incoming.customerPhone),
      customerEmail: choose(base.customerEmail, incoming.customerEmail),
      status: choose(base.status, incoming.status),
      branch: choose(base.branch, incoming.branch),
      method: choose(base.method, incoming.method),
      currency: choose(base.currency, incoming.currency),
      provider: choose(base.provider, incoming.provider),
      bankReferenceNumber: choose(base.bankReferenceNumber, incoming.bankReferenceNumber),
      merchantOrderId: choose(base.merchantOrderId, incoming.merchantOrderId),
      parentCode: choose(base.parentCode, incoming.parentCode),
      parentName: choose(base.parentName, incoming.parentName),
      studentId: choose(base.studentId, incoming.studentId),
      studentName: choose(base.studentName, incoming.studentName),
      gradeName: choose(base.gradeName, incoming.gradeName),
      itemName: choose(base.itemName, incoming.itemName),
      itemAmount: choose(base.itemAmount, incoming.itemAmount),
      quantity: choose(base.quantity, incoming.quantity),
      academicYear: choose(base.academicYear, incoming.academicYear),
      fees: choose(base.fees, incoming.fees),
      discount: choose(base.discount, incoming.discount),
      totalNoTax: choose(base.totalNoTax, incoming.totalNoTax),
      total: choose(base.total, incoming.total),
      date: choose(base.date, incoming.date),
      dateValue: base.dateValue ?? incoming.dateValue,
    };
  };

  const dedupeTransactions = (rows: TransactionRow[]): TransactionRow[] => {
    const map = new Map<string, TransactionRow>();
    rows.forEach((row) => {
      const key = String(row.id ?? '').trim();
      if (!key) return;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, row);
        return;
      }
      map.set(key, mergeTransactionRows(existing, row));
    });
    return Array.from(map.values());
  };

  const hydrateTransactions = (rows: any[]): TransactionRow[] =>
    dedupeTransactions(
      rows
        .map((row) => {
          const parsedDate = row?.dateValue ? parseTransactionDate(row.dateValue) : parseTransactionDate(row?.date);
          return {
            id: String(row?.id ?? '').trim(),
            customer: String(row?.customer ?? '').trim(),
            customerPhone: String(row?.customerPhone ?? '').trim(),
            customerEmail: String(row?.customerEmail ?? '').trim(),
            totalNoTax: cleanNumber(row?.totalNoTax),
            total: cleanNumber(row?.total),
            date: String(row?.date ?? '').trim(),
            dateValue: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null,
            status: String(row?.status ?? '').trim(),
            branch: String(row?.branch ?? '').trim(),
            method: String(row?.method ?? '').trim(),
            currency: String(row?.currency ?? '').trim(),
            provider: String(row?.provider ?? '').trim(),
            bankReferenceNumber: String(row?.bankReferenceNumber ?? '').trim(),
            merchantOrderId: String(row?.merchantOrderId ?? '').trim(),
            parentCode: String(row?.parentCode ?? '').trim(),
            parentName: String(row?.parentName ?? '').trim(),
            studentId: String(row?.studentId ?? '').trim(),
            studentName: String(row?.studentName ?? '').trim(),
            gradeName: String(row?.gradeName ?? '').trim(),
            itemName: String(row?.itemName ?? '').trim(),
            itemAmount: cleanNumber(row?.itemAmount),
            quantity: String(row?.quantity ?? '').trim() || '1',
            academicYear: String(row?.academicYear ?? '').trim(),
            fees: cleanNumber(row?.fees),
            discount: cleanNumber(row?.discount),
          };
        })
        .filter((row) => row.id)
    );

  const saveTransactionsToServer = async (
    rows: TransactionRow[]
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const response = await fetch(TRANSACTIONS_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: rows }),
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

  useEffect(() => {
    if (!isDatePickerOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isDatePickerOpen]);

  useEffect(() => {
    let isMounted = true;

    const loadTransactionsFromServer = async () => {
      try {
        const response = await fetch(TRANSACTIONS_API_ENDPOINT, { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json();
        if (!Array.isArray(payload?.transactions) || !isMounted) return;
        const hydrated = hydrateTransactions(payload.transactions);
        setTransactionsData(hydrated);

        // Auto-clean old duplicated saved data once after loading.
        if (hydrated.length > 0 && payload.transactions.length !== hydrated.length) {
          void saveTransactionsToServer(hydrated);
        }
      } catch {
        // ignore server read errors to keep page usable
      }
    };

    void loadTransactionsFromServer();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isStatusDropdownOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isStatusDropdownOpen]);

  useEffect(() => {
    if (!isSearchDropdownOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isSearchDropdownOpen]);

  useEffect(() => {
    if (!selectedTransaction) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedTransaction]);

  const filteredTransactions = useMemo(() => {
    const parsedFrom = parseInputDate(fromDate);
    const parsedTo = parseInputDate(toDate);
    const fromTime = parsedFrom
      ? new Date(parsedFrom.getFullYear(), parsedFrom.getMonth(), parsedFrom.getDate(), 0, 0, 0, 0).getTime()
      : null;
    const toTime = parsedTo
      ? new Date(parsedTo.getFullYear(), parsedTo.getMonth(), parsedTo.getDate(), 23, 59, 59, 999).getTime()
      : null;

    if (fromTime === null && toTime === null) return transactionsData;

    return transactionsData.filter((item) => {
      if (!item.dateValue) return false;
      const time = item.dateValue.getTime();
      if (fromTime !== null && time < fromTime) return false;
      if (toTime !== null && time > toTime) return false;
      return true;
    });
  }, [transactionsData, fromDate, toDate]);

  const statusFilteredTransactions = useMemo(() => {
    if (selectedStatuses.length === STATUS_OPTIONS.length) return filteredTransactions;
    return filteredTransactions.filter((row) => {
      const normalized = normalizeStatus(row.status);
      return normalized ? selectedStatuses.includes(normalized) : false;
    });
  }, [filteredTransactions, selectedStatuses]);

  const displayedTransactions = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(searchQuery);
    if (!normalizedQuery) return statusFilteredTransactions;

    const selectedOption = SEARCH_FIELD_OPTIONS.find((option) => option.key === selectedSearchField);
    if (!selectedOption) return statusFilteredTransactions;

    return statusFilteredTransactions.filter((row) =>
      normalizeSearchValue(selectedOption.getValue(row)).includes(normalizedQuery)
    );
  }, [statusFilteredTransactions, searchQuery, selectedSearchField]);

  // --- Handle File Upload ---
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataBuffer = evt.target?.result;
      if (!dataBuffer) return;

      const wb = read(dataBuffer, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      
      // Parse as Array of Arrays to handle template variations safely
      const data = utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as any[][];

      // Find the main header row by transaction identifiers
      const headerRowIndex = data.findIndex((row) => {
        const cells = (row || []).map((cell) => normalizeText(cell));
        return cells.some((cell) => cell.includes('receipt no') || cell.includes('رقم العملية')) &&
               cells.some((cell) => cell.includes('total amount') || cell.includes('sub total') || cell.includes('الاجمالي'));
      });

      if (headerRowIndex === -1) {
        alert('لم يتم العثور على ترويسة صحيحة داخل ملف الإكسيل');
        return;
      }

      const headerRow = data[headerRowIndex] || [];
      const subHeaderRow = data[headerRowIndex + 1] || [];
      const receiptIndex = findColumnIndex(headerRow, ['Receipt No', 'رقم العملية', 'Transaction ID']);
      const customerIndex = findColumnIndex(headerRow, ['Full Name', 'Customer Name', 'اسم العميل', 'Student Name']);
      const mobileIndex = findColumnIndex(headerRow, ['Mobile Number', 'Phone', 'رقم هاتف العميل']);
      const emailIndex = findColumnIndex(headerRow, ['Email', 'Customer Email', 'البريد الإلكتروني']);
      const subTotalIndex = findColumnIndex(headerRow, ['Sub Total', 'Subtotal', 'الاجمالي بدون ضريبه', 'الاجمالي بدون ضريبة']);
      const totalIndex = findColumnIndex(headerRow, ['Total Amount', 'Total', 'الاجمالي', 'إجمالي']);
      const dateIndex = findColumnIndex(headerRow, ['Transaction Date', 'Date', 'التاريخ']);
      const statusIndex = findColumnIndex(headerRow, ['Order Status', 'Status', 'الحالة']);
      const branchIndex = findColumnIndex(headerRow, ['Branch Name', 'Company Name', 'Branch', 'الفرع']);
      const methodIndex = findColumnIndex(headerRow, ['Payment Method', 'Payment Method Name', 'طريقة الدفع']);
      const currencyIndex = findColumnIndex(headerRow, ['Currency', 'العملة']);
      const providerIndex = findColumnIndex(headerRow, ['Provider', 'مزود الخدمة']);
      const bankReferenceIndex = findColumnIndex(headerRow, ['Bank Reference Number', 'Bank Ref', 'الرقم المرجعي']);
      const merchantOrderIndex = findColumnIndex(headerRow, ['Merchant Order ID', 'Order ID', 'رقم الطلب']);
      const parentNameIndex = findColumnIndex(headerRow, ['Parent Name', 'اسم ولي الأمر']);
      const parentCodeIndexMain = findColumnIndex(headerRow, ['Parent ID', 'Parent Code', 'كود ولي الأمر']);
      const parentCodeIndexSub = findColumnIndex(subHeaderRow, ['Parent ID', 'Parent Code', 'كود ولي الأمر']);
      const parentCodeIndex = parentCodeIndexMain !== -1 ? parentCodeIndexMain : parentCodeIndexSub;
      const itemNameIndexMain = findColumnIndex(headerRow, ['Item Name', 'Order Items', 'اسم المدفوع']);
      const itemNameIndexSub = findColumnIndex(subHeaderRow, ['Item Name', 'Order Items', 'اسم المدفوع']);
      const itemNameIndex = itemNameIndexSub !== -1 ? itemNameIndexSub : itemNameIndexMain;
      const itemAmountIndexMain = findColumnIndex(headerRow, ['Amount', 'المبلغ']);
      const itemAmountIndexSub = findColumnIndex(subHeaderRow, ['Amount', 'المبلغ']);
      const itemAmountIndex = itemAmountIndexSub !== -1 ? itemAmountIndexSub : itemAmountIndexMain;
      const quantityIndexMain = findColumnIndex(headerRow, ['Quantity', 'الكمية']);
      const quantityIndexSub = findColumnIndex(subHeaderRow, ['Quantity', 'الكمية']);
      const quantityIndex = quantityIndexSub !== -1 ? quantityIndexSub : quantityIndexMain;
      const studentIdIndexMain = findColumnIndex(headerRow, ['Student ID', 'رقم الطالب']);
      const studentIdIndexSub = findColumnIndex(subHeaderRow, ['Student ID', 'رقم الطالب']);
      const studentIdIndex = studentIdIndexSub !== -1 ? studentIdIndexSub : studentIdIndexMain;
      const studentNameIndexMain = findColumnIndex(headerRow, ['Student Name', 'اسم الطالب']);
      const studentNameIndexSub = findColumnIndex(subHeaderRow, ['Student Name', 'اسم الطالب']);
      const studentNameIndex = studentNameIndexSub !== -1 ? studentNameIndexSub : studentNameIndexMain;
      const gradeNameIndexMain = findColumnIndex(headerRow, ['Grade Name', 'المرحلة', 'الصف']);
      const gradeNameIndexSub = findColumnIndex(subHeaderRow, ['Grade Name', 'المرحلة', 'الصف']);
      const gradeNameIndex = gradeNameIndexSub !== -1 ? gradeNameIndexSub : gradeNameIndexMain;
      const academicYearIndex = findColumnIndex(headerRow, ['Order Form', 'Academic Year', 'السنة الأكاديمية']);
      const discountIndex = findColumnIndex(headerRow, ['Discount', 'الخصم']);
      const feesIndex = findColumnIndex(headerRow, ['Late Fees', 'Fees', 'الرسوم المتأخرة', 'الرسوم المتاخره']);

      if (receiptIndex === -1 || totalIndex === -1) {
        alert('تعذر تحديد الأعمدة الأساسية (رقم العملية / الإجمالي) داخل الملف');
        return;
      }

      const dataRows = data.slice(headerRowIndex + 1);
      const mappedData = dataRows
        .map((row) => {
          const idValue = row[receiptIndex];
          if (!idValue) return null;
          const normalizedId = normalizeText(idValue);
          if (normalizedId.includes('receipt') || normalizedId.includes('رقم العملية')) return null;
          const parsedDate = parseTransactionDate(row[dateIndex]);
          const studentNameValue = String(studentNameIndex !== -1 ? row[studentNameIndex] ?? '' : '').trim();
          const customerValue = String(row[customerIndex] ?? '').trim();
          const normalizedCustomer = normalizeText(customerValue);
          const resolvedCustomer =
            normalizedCustomer === 'btc user' || normalizedCustomer === 'user' || !customerValue
              ? studentNameValue || customerValue
              : customerValue;
          const parentNameValue = String(parentNameIndex !== -1 ? row[parentNameIndex] ?? '' : '').trim();
          const quantityValue = String(quantityIndex !== -1 ? row[quantityIndex] ?? '' : '').trim();
          const itemAmountValue = itemAmountIndex !== -1 ? cleanNumber(row[itemAmountIndex]) : cleanNumber(row[totalIndex]);

          return {
            id: String(idValue).trim(),
            customer: resolvedCustomer,
            customerPhone: String(mobileIndex !== -1 ? row[mobileIndex] ?? '' : '').trim(),
            customerEmail: String(emailIndex !== -1 ? row[emailIndex] ?? '' : '').trim(),
            totalNoTax: cleanNumber(row[subTotalIndex]),
            total: cleanNumber(row[totalIndex]),
            date: parsedDate ? formatDateForDisplay(parsedDate) : String(row[dateIndex] ?? '').trim(),
            dateValue: parsedDate,
            status: String(row[statusIndex] ?? '').trim() || 'ناجحة',
            branch: String(row[branchIndex] ?? '').trim(),
            method: String(row[methodIndex] ?? '').trim(),
            currency: String(currencyIndex !== -1 ? row[currencyIndex] ?? '' : '').trim(),
            provider: String(providerIndex !== -1 ? row[providerIndex] ?? '' : '').trim(),
            bankReferenceNumber: String(bankReferenceIndex !== -1 ? row[bankReferenceIndex] ?? '' : '').trim(),
            merchantOrderId: String(merchantOrderIndex !== -1 ? row[merchantOrderIndex] ?? '' : '').trim(),
            parentCode: parentCodeIndex !== -1 ? String(row[parentCodeIndex] ?? '').trim() : '',
            parentName: parentNameValue || customerValue || studentNameValue,
            studentId: String(studentIdIndex !== -1 ? row[studentIdIndex] ?? '' : '').trim(),
            studentName: studentNameValue || customerValue,
            gradeName: String(gradeNameIndex !== -1 ? row[gradeNameIndex] ?? '' : '').trim(),
            itemName: String(itemNameIndex !== -1 ? row[itemNameIndex] ?? '' : '').trim(),
            itemAmount: itemAmountValue,
            quantity: quantityValue || '1',
            academicYear: String(academicYearIndex !== -1 ? row[academicYearIndex] ?? '' : '').trim(),
            fees: cleanNumber(row[feesIndex]),
            discount: cleanNumber(row[discountIndex]),
          } as TransactionRow;
        })
        .filter((item): item is TransactionRow => item !== null);
      const dedupedData = dedupeTransactions(mappedData);

      if (dedupedData.length === 0) {
        alert('الملف تم قراءته لكن لم يتم العثور على بيانات صالحة للعرض');
      } else {
        setTransactionsData(dedupedData);
        setSelectedTransaction(null);
        setSearchQuery('');
        setFromDate('');
        setToDate('');
        const saveResult = await saveTransactionsToServer(dedupedData);
        const blobHint =
          saveResult.error?.includes('BLOB_READ_WRITE_TOKEN')
            ? '\nتأكد من ربط Vercel Blob وإضافة المتغير BLOB_READ_WRITE_TOKEN في إعدادات المشروع ثم إعادة النشر.'
            : '';
        alert(
          saveResult.ok
            ? `تم تحميل ${dedupedData.length} عملية وحفظها بنجاح`
            : `تم تحميل البيانات، لكن حدث خطأ أثناء الحفظ على الخادم: ${saveResult.error}${blobHint}`
        );
      }
      
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  // --- Handle File Download ---
  const handleDownload = () => {
    if (transactionsData.length === 0) return;

    // Map state back to Arabic headers for the export
    const exportData = transactionsData.map(item => ({
      'اسم العميل': item.customer,
      'رقم العملية': item.id,
      'التاريخ': item.date,
      'الحالة': item.status,
      'الفرع': item.branch,
      'طريقة الدفع': item.method,
      'كود ولي الأمر': item.parentCode,
      'الاجمالي بدون ضريبه': item.totalNoTax,
      'الخصم': item.discount,
      'الرسوم المتأخرة': item.fees,
      'الاجمالي': item.total
    }));

    const ws = utils.json_to_sheet(exportData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Transactions");
    writeFile(wb, "transactions_export.xlsx");
  };

  // Calculate totals for cards
  const totalAmount = displayedTransactions.reduce((acc, curr) => acc + parseFloat(curr.total || '0'), 0);
  const successCount = displayedTransactions.filter(t => 
    String(t.status).toLowerCase().includes('success') || 
    String(t.status) === 'ناجحة'
  ).length;
  
  const successAmount = displayedTransactions
    .filter(t => 
      String(t.status).toLowerCase().includes('success') || 
      String(t.status) === 'ناجحة'
    )
    .reduce((acc, curr) => acc + parseFloat(curr.total || '0'), 0);

  const dateRangeLabel =
    fromDate || toDate
      ? `${formatInputDateLabel(fromDate)} - ${formatInputDateLabel(toDate)}`
      : 'الفترة الزمنية';
  const selectedSearchFieldLabel =
    SEARCH_FIELD_OPTIONS.find((option) => option.key === selectedSearchField)?.label || 'رقم العمليه';
  const allStatusesSelected = selectedStatuses.length === STATUS_OPTIONS.length;
  const selectedStatusLabel = allStatusesSelected
    ? 'الكل'
    : selectedStatuses.length === 1
    ? selectedStatuses[0]
    : `${selectedStatuses[0]} +${selectedStatuses.length - 1}`;

  const toggleAllStatuses = () => {
    if (allStatusesSelected) {
      setSelectedStatuses(['ناجحة']);
      return;
    }
    setSelectedStatuses([...STATUS_OPTIONS]);
  };

  const toggleStatusOption = (status: StatusOption) => {
    setSelectedStatuses((current) => {
      if (current.includes(status)) {
        const next = current.filter((item) => item !== status);
        return next.length > 0 ? next : ['ناجحة'];
      }
      return [...current, status];
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      
      {/* Top Controls: Search (Right) & Filters (Left) */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        
        {/* Right Side: Search */}
        <div className="w-full xl:w-auto flex justify-end order-1 xl:order-2">
            <div className="relative flex items-center w-full md:w-96 bg-white rounded-full border border-gray-200 shadow-sm overflow-visible">
                <div className="relative min-w-fit" ref={searchDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsSearchDropdownOpen((open) => !open)}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-l border-gray-200 text-gray-500 cursor-pointer hover:bg-gray-100 min-w-fit"
                    >
                        <span className="text-sm font-medium">{selectedSearchFieldLabel}</span>
                        <ChevronDown className="w-4 h-4" />
                    </button>

                    {isSearchDropdownOpen && (
                      <div className="absolute right-0 mt-2 z-30 w-64 bg-white border border-gray-200 rounded-xl shadow-xl py-2 max-h-80 overflow-auto">
                        {SEARCH_FIELD_OPTIONS.map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => {
                              setSelectedSearchField(option.key);
                              setSearchQuery('');
                              setIsSearchDropdownOpen(false);
                            }}
                            className={`w-full text-right px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                              selectedSearchField === option.key ? 'text-brand-purple font-semibold bg-purple-50' : 'text-gray-700'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
                <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`بحث بـ ${selectedSearchFieldLabel}`} 
                    className="w-full py-2 px-4 outline-none text-right placeholder-gray-400"
                />
                <Search className="w-5 h-5 text-gray-400 absolute left-4" />
            </div>
        </div>

        {/* Left Side: Actions */}
        <div className="w-full xl:w-auto flex flex-wrap items-center gap-3 order-2 xl:order-1 justify-end xl:justify-start">
            
            {/* Hidden File Input */}
            <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileChange} 
            />

            {/* Upload Button (Arrow Icon Only) */}
            <button 
                onClick={handleUploadClick}
                className="flex items-center justify-center p-2.5 border border-brand-purple text-brand-purple rounded-full bg-white hover:bg-purple-50 transition-colors shadow-sm"
                title="رفع ملف اكسيل"
            >
                <Upload className="w-4 h-4" />
            </button>

            {/* Download Button */}
            <button 
                onClick={handleDownload}
                className="flex items-center gap-2 px-6 py-2 border border-brand-purple text-brand-purple rounded-full bg-white hover:bg-purple-50 transition-colors font-bold"
            >
                <span>تحميل</span>
                <Download className="w-4 h-4" />
            </button>

            {/* Filter Button */}
            <button className="flex items-center gap-2 px-6 py-2 border border-brand-purple text-brand-purple rounded-full bg-white hover:bg-purple-50 transition-colors font-bold">
                <span>تصنيف</span>
                <SlidersHorizontal className="w-4 h-4" />
            </button>

            {/* Currency Dropdown */}
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-md border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50">
                <ChevronDown className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-bold text-gray-700">EGP</span>
                <span className="text-sm text-gray-500">: العمله</span>
            </div>

            {/* Status Dropdown */}
            <div className="relative" ref={statusDropdownRef}>
              <button
                type="button"
                onClick={() => setIsStatusDropdownOpen((open) => !open)}
                className="flex items-center gap-2 bg-white px-4 py-2 rounded-md border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50"
              >
                <ChevronDown className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-bold text-gray-700">{selectedStatusLabel}</span>
                <span className="text-sm text-gray-500">: الحالة</span>
              </button>

              {isStatusDropdownOpen && (
                <div className="absolute right-0 mt-2 z-30 w-64 bg-white border border-gray-200 shadow-xl rounded-xl p-3 space-y-1">
                  <button
                    type="button"
                    onClick={toggleAllStatuses}
                    className="w-full flex items-center justify-between px-2 py-2 rounded-md hover:bg-gray-100 text-gray-700"
                  >
                    <span className="h-8 w-8 rounded-md border-2 border-gray-300 flex items-center justify-center">
                      {allStatusesSelected ? <Check className="w-5 h-5 text-brand-purple" /> : null}
                    </span>
                    <span className="text-xl font-medium">الكل</span>
                  </button>

                  {STATUS_OPTIONS.map((statusOption) => {
                    const checked = selectedStatuses.includes(statusOption);
                    return (
                      <button
                        key={statusOption}
                        type="button"
                        onClick={() => toggleStatusOption(statusOption)}
                        className="w-full flex items-center justify-between px-2 py-2 rounded-md hover:bg-gray-100 text-gray-700"
                      >
                        <span
                          className={`h-8 w-8 rounded-md border-2 flex items-center justify-center ${
                            checked ? 'bg-brand-purple border-brand-purple text-white' : 'border-gray-300'
                          }`}
                        >
                          {checked ? <Check className="w-5 h-5" /> : null}
                        </span>
                        <span className="text-xl font-medium">{statusOption}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Date Range */}
            <div className="relative" ref={datePickerRef}>
              <button
                type="button"
                onClick={() => setIsDatePickerOpen((open) => !open)}
                className="flex items-center gap-2 bg-white px-4 py-2 rounded-md border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50"
              >
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-bold text-gray-700" dir="ltr">{dateRangeLabel}</span>
              </button>

              {isDatePickerOpen && (
                <div className="absolute left-0 mt-2 z-30 w-80 bg-white border border-gray-200 shadow-xl rounded-xl p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 text-right">من</label>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => {
                          const value = e.target.value;
                          setFromDate(value);
                          if (toDate && value && value > toDate) {
                            setToDate(value);
                          }
                        }}
                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-brand-purple"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 text-right">إلى</label>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => {
                          const value = e.target.value;
                          setToDate(value);
                          if (fromDate && value && value < fromDate) {
                            setFromDate(value);
                          }
                        }}
                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-brand-purple"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFromDate('');
                        setToDate('');
                      }}
                      className="px-4 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-100"
                    >
                      مسح
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDatePickerOpen(false)}
                      className="px-4 py-2 rounded-md text-sm text-white bg-brand-purple hover:bg-purple-700"
                    >
                      تم
                    </button>
                  </div>
                </div>
              )}
            </div>
        </div>

      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        
        {/* Blue Card (Total Orders) - Visually Right */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-[#000080] text-white p-3 text-center text-lg font-bold">
                اجمالي عدد الطلبات | {displayedTransactions.length}
            </div>
            <div className="p-8 text-center">
                <p className="text-gray-600 mb-2 font-medium">Total Amount for <span className="text-[#000080] font-bold text-xl">{displayedTransactions.length}</span> Orders</p>
                <div className="text-3xl font-bold text-[#000080]" dir="ltr">EGP {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
        </div>

        {/* Green Card (Successful Orders) - Visually Left */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-[#4CAF50] text-white p-3 text-center text-lg font-bold">
                اجمالي عدد الطلبات الناجحة | {successCount}
            </div>
            <div className="p-8 text-center">
                <p className="text-gray-600 mb-2 font-medium">Total Amount for <span className="text-[#4CAF50] font-bold text-xl">{successCount}</span> Successful Orders</p>
                <div className="text-3xl font-bold text-[#4CAF50]" dir="ltr">EGP {successAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
        </div>

      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mt-6">
        <table className="w-full min-w-[1000px] border-collapse">
            <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm font-bold">
                    <th className="py-4 px-4 text-right">اسم العميل</th>
                    <th className="py-4 px-4 text-right">
                        <div className="flex items-center gap-1 cursor-pointer">
                           رقم العملية
                           <ArrowDownUp className="w-3 h-3" />
                        </div>
                    </th>
                    <th className="py-4 px-4 text-right">
                        <div className="flex items-center gap-1 cursor-pointer">
                           التاريخ
                           <ArrowDownUp className="w-3 h-3" />
                        </div>
                    </th>
                    <th className="py-4 px-4 text-right">الحالة</th>
                    <th className="py-4 px-4 text-right">الفرع</th>
                    <th className="py-4 px-4 text-right">طريقة الدفع</th>
                    <th className="py-4 px-4 text-right">كود ولي الأمر</th>
                    <th className="py-4 px-4 text-right">الاجمالي بدون ضريبه</th>
                    <th className="py-4 px-4 text-right">الخصم</th>
                    <th className="py-4 px-4 text-right">الرسوم المتأخرة</th>
                    <th className="py-4 px-4 text-right">
                         <div className="flex items-center gap-1 cursor-pointer">
                           الاجمالي
                           <ArrowDownUp className="w-3 h-3" />
                        </div>
                    </th>
                </tr>
            </thead>
            <tbody className="text-gray-700 text-sm">
                 {displayedTransactions.length === 0 ? (
                            <tr>
                                <td colSpan={11} className="py-8 text-center text-gray-400">
                                  {transactionsData.length === 0
                                    ? 'لا توجد بيانات متاحة'
                                    : filteredTransactions.length === 0
                                    ? 'لا توجد بيانات ضمن الفترة المحددة'
                                    : statusFilteredTransactions.length === 0
                                    ? 'لا توجد بيانات ضمن الحالة المحددة'
                                    : 'لا توجد نتائج مطابقة للبحث'}
                                </td>
                            </tr>
                        ) : (
                displayedTransactions.map((row, index) => (
                    <tr
                      key={`${row.id}-${index}`}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedTransaction(row)}
                    >
                        <td className="py-4 px-4">{row.customer}</td>
                        <td className="py-4 px-4 font-mono">{row.id}</td>
                        <td className="py-4 px-4 font-mono">{row.date}</td>
                        <td className={`py-4 px-4 font-bold ${String(row.status).toLowerCase().includes('success') || row.status === 'ناجحة' ? 'text-[#4CAF50]' : ''}`}>{row.status}</td>
                        <td className="py-4 px-4 max-w-[150px]">{row.branch}</td>
                        <td className="py-4 px-4">{row.method}</td>
                        <td className="py-4 px-4 font-mono text-gray-500">{row.parentCode}</td>
                        <td className="py-4 px-4 font-bold" dir="ltr">EGP {row.totalNoTax}</td>
                        <td className="py-4 px-4 font-bold" dir="ltr">EGP {row.discount}</td>
                        <td className="py-4 px-4 font-bold" dir="ltr">EGP {row.fees}</td>
                        <td className="py-4 px-4 font-bold text-gray-800" dir="ltr">EGP {row.total}</td>
                    </tr>
                )))}
            </tbody>
        </table>
      </div>

      {selectedTransaction && (
        <div
          className="fixed inset-0 z-50 bg-black/20 p-3 md:p-6"
          onClick={() => setSelectedTransaction(null)}
        >
          <div
            className="h-full w-full bg-[#f3f3f5] rounded-xl border border-gray-200 shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 md:px-8 py-5 border-b border-gray-200">
              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="إغلاق"
              >
                <X className="w-10 h-10" />
              </button>
              <h3 className="text-xl md:text-3xl font-semibold text-gray-700">
                المعاملة {selectedTransaction.id}
              </h3>
            </div>

            <div className="p-3 md:p-6 flex-1 overflow-auto" dir="rtl">
              <div className="bg-white rounded-xl border border-gray-200 min-h-full">
                <div className="px-6 pt-5">
                  <div className="flex items-center justify-end gap-8 text-xl md:text-2xl font-semibold text-gray-600">
                    <span className="text-brand-purple border-b-4 border-brand-purple pb-3">تفاصيل الدفع</span>
                    <span>تفاصيل العملية</span>
                    <span>تفاصيل العميل</span>
                  </div>
                </div>

                <div className="mx-6 mt-1 border-t border-gray-200"></div>

                <div className="px-6 md:px-10 py-6 md:py-10">
                  <h4 className="text-brand-purple text-2xl md:text-4xl font-bold underline mb-8">
                    {selectedTransaction.itemName || `المدفوعة رقم_${selectedTransaction.id}`}
                  </h4>

                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 text-gray-700">
                    <div className="xl:border-l border-gray-200 xl:pl-10 space-y-5 text-lg md:text-2xl">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-gray-500">اسم المدفوع</span>
                        <span className="font-semibold">{selectedTransaction.itemName || '-'}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-gray-500">السنة الأكاديمية</span>
                        <span className="font-semibold">{selectedTransaction.academicYear || '-'}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-gray-500">المبلغ</span>
                        <span className="font-semibold" dir="ltr">
                          {(selectedTransaction.currency || 'EGP') + ' ' + (selectedTransaction.itemAmount || selectedTransaction.total)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-gray-500">الكمية</span>
                        <span className="font-semibold">{selectedTransaction.quantity || '1'}</span>
                      </div>
                    </div>

                    <div className="xl:border-l border-gray-200 xl:pl-10 space-y-5 text-lg md:text-2xl">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-gray-500">Student Name</span>
                        <span className="font-semibold">{selectedTransaction.studentName || '-'}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-gray-500">Student ID</span>
                        <span className="font-semibold">{selectedTransaction.studentId || '-'}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-gray-500">Parent Name</span>
                        <span className="font-semibold">{selectedTransaction.parentName || '-'}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-gray-500">Parent ID</span>
                        <span className="font-semibold">{selectedTransaction.parentCode || '-'}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-gray-500">Grade Name</span>
                        <span className="font-semibold">{selectedTransaction.gradeName || '-'}</span>
                      </div>
                    </div>

                    <div className="space-y-5 text-lg md:text-2xl">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-gray-500">رقم العملية</span>
                        <span className="font-semibold">{selectedTransaction.id}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-gray-500">التاريخ</span>
                        <span className="font-semibold">{selectedTransaction.date || '-'}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-gray-500">الحالة</span>
                        <span className="font-semibold">{selectedTransaction.status || '-'}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-gray-500">طريقة الدفع</span>
                        <span className="font-semibold">{selectedTransaction.method || '-'}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-gray-500">Provider</span>
                        <span className="font-semibold">{selectedTransaction.provider || '-'}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-gray-500">Bank Ref</span>
                        <span className="font-semibold">{selectedTransaction.bankReferenceNumber || '-'}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-gray-500">Merchant Order</span>
                        <span className="font-semibold">{selectedTransaction.merchantOrderId || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Pagination */}
      <Pagination totalPages={Math.ceil(displayedTransactions.length / 5) || 1} />

    </div>
  );
};
