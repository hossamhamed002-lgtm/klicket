import React, { useState, useRef } from 'react';
import { Search, Plus, Upload, Download, Edit, ChevronLeft, ChevronRight, ChevronDown, ArrowDownUp, MoveLeft, ArrowRight } from 'lucide-react';
import { read, utils } from 'xlsx';
import { Pagination } from './Pagination';

export const SchoolControlPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('parents'); // 'parents' or 'students' or 'classes'
  
  // Data States - Initialized as empty arrays (No fake data)
  const [parentsData, setParentsData] = useState<any[]>([]);
  const [studentsData, setStudentsData] = useState<any[]>([]);

  // File Refs
  const parentFileInputRef = useRef<HTMLInputElement>(null);
  const studentFileInputRef = useRef<HTMLInputElement>(null);

  // Pagination Logic (Assuming 5 items per page based on UI)
  const ITEMS_PER_PAGE = 5;
  const currentDataLength = activeTab === 'students' ? studentsData.length : activeTab === 'parents' ? parentsData.length : 0;
  const totalPages = currentDataLength > 0 ? Math.ceil(currentDataLength / ITEMS_PER_PAGE) : 1;

  // --- Handlers for Parents ---
  const handleParentUploadClick = () => {
    if (parentFileInputRef.current) parentFileInputRef.current.click();
  };

  const handleParentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = utils.sheet_to_json(ws);

      const mappedData = data.map((row: any) => ({
        name: `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim(),
        code: row['Parent ID'] ? String(row['Parent ID']) : '',
        code2: row['Secondary Parent ID'] ? String(row['Secondary Parent ID']) : '',
        email: row['Email'] || '',
        phone: row['Phone'] ? String(row['Phone']) : '',
      }));

      setParentsData(prev => [...mappedData, ...prev]);
      if (parentFileInputRef.current) parentFileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  // --- Handlers for Students ---
  const handleStudentUploadClick = () => {
    if (studentFileInputRef.current) studentFileInputRef.current.click();
  };

  const handleStudentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = utils.sheet_to_json(ws);

      // Map Excel columns based on the provided student template
      // Headers: ParentID, StudentID, Grade, Name, Payments...
      const mappedData = data.map((row: any) => ({
        name: row['Name'] || '',
        studentCode: row['StudentID'] ? String(row['StudentID']) : '',
        grade: row['Grade'] || '',
        parentCode: row['ParentID'] ? String(row['ParentID']) : '', // Linking to Parent Code
      }));

      setStudentsData(prev => [...mappedData, ...prev]);
      if (studentFileInputRef.current) studentFileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 min-h-screen relative pb-24">
       
       {/* Breadcrumb-like Title */}
       <div className="flex justify-end items-center gap-2 mb-2 text-gray-500 hover:text-brand-purple cursor-pointer w-fit ml-auto">
             <h2 className="font-bold text-xl text-gray-600">الفردوس الخاصة بالغربية</h2>
             <ArrowRight className="w-5 h-5" />
       </div>

       {/* Tabs */}
       <div className="flex items-center gap-8 border-b border-gray-200 mb-6 overflow-x-auto">
          <div 
            className={`pb-4 px-2 cursor-pointer transition-all flex items-center gap-2 ${activeTab === 'classes' ? 'border-b-2 border-brand-purple text-brand-purple' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('classes')}
          >
             <span className="font-bold">الصفوف</span>
             <span className="bg-purple-100 text-brand-purple text-xs px-2 py-0.5 rounded-full font-bold">0</span>
          </div>
          <div 
            className={`pb-4 px-2 cursor-pointer transition-all flex items-center gap-2 ${activeTab === 'students' ? 'border-b-2 border-brand-purple text-brand-purple' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('students')}
          >
             <span className="font-bold">الطلاب</span>
             <span className="bg-purple-100 text-brand-purple text-xs px-2 py-0.5 rounded-full font-bold">{studentsData.length}</span>
          </div>
          <div 
            className={`pb-4 px-2 cursor-pointer transition-all flex items-center gap-2 ${activeTab === 'parents' ? 'border-b-2 border-brand-purple text-brand-purple' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('parents')}
          >
             <span className="font-bold">اولياء الامور</span>
             <span className="bg-brand-purple text-white text-xs px-2 py-0.5 rounded-full font-bold">{parentsData.length}</span>
          </div>
       </div>

      {/* --- CONTENT AREA BASED ON TAB --- */}

      {/* PARENTS TAB CONTENT */}
      {activeTab === 'parents' && (
        <>
            {/* Controls Row */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                
                {/* Left Actions (Buttons) */}
                <div className="flex flex-wrap items-center gap-3 order-2 xl:order-1">
                    <button className="flex items-center gap-2 px-6 py-2 bg-brand-purple text-white rounded-full font-bold hover:bg-purple-700 transition-colors shadow-sm">
                        <Plus className="w-5 h-5" />
                        <span>اضافه ولي امر</span>
                    </button>

                    <input type="file" accept=".xlsx, .xls, .csv" ref={parentFileInputRef} className="hidden" onChange={handleParentFileChange} />
                    <button onClick={handleParentUploadClick} className="flex items-center gap-2 px-6 py-2 border border-brand-purple text-brand-purple rounded-full bg-white hover:bg-purple-50 transition-colors font-bold">
                        <Upload className="w-4 h-4" />
                        <span>رفع الملفات</span>
                    </button>

                    <button className="flex items-center gap-2 px-6 py-2 border border-brand-purple text-brand-purple rounded-full bg-white hover:bg-purple-50 transition-colors font-bold">
                        <Download className="w-4 h-4" />
                        <span>تحميل</span>
                    </button>
                </div>

                {/* Right Action (Search) */}
                <div className="w-full xl:w-auto flex justify-end order-1 xl:order-2">
                    <div className="relative flex items-center w-full md:w-80 bg-gray-50 rounded-full border border-gray-200 hover:bg-white transition-colors">
                        <input type="text" placeholder="بحث" className="w-full py-2 px-4 bg-transparent outline-none text-right placeholder-gray-400" />
                        <Search className="w-5 h-5 text-gray-400 absolute left-4" />
                    </div>
                </div>
            </div>

            {/* Parents Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mt-6">
                <table className="w-full min-w-[1000px] border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm font-bold">
                            <th className="py-4 px-4 text-right">
                                <div className="flex items-center gap-1 cursor-pointer">اسم ولي الامر <ArrowDownUp className="w-3 h-3 text-gray-400" /></div>
                            </th>
                            <th className="py-4 px-4 text-right">
                                <div className="flex items-center gap-1 cursor-pointer">كود ولي الامر <ArrowDownUp className="w-3 h-3 text-gray-400" /></div>
                            </th>
                            <th className="py-4 px-4 text-right">كود ولي الامر الثانى</th>
                            <th className="py-4 px-4 text-right">البريد الإلكتروني</th>
                            <th className="py-4 px-4 text-right">رقم الهاتف</th>
                            <th className="py-4 px-4 text-right">تحديث البيانات</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-700 text-sm">
                        {parentsData.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-8 text-center text-gray-400">لا توجد بيانات، قم برفع ملف للعرض</td>
                            </tr>
                        ) : (
                            parentsData.map((row, index) => (
                                <tr key={index} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                    <td className="py-4 px-4 font-semibold">{row.name}</td>
                                    <td className="py-4 px-4 text-gray-500 font-mono">{row.code}</td>
                                    <td className="py-4 px-4 text-gray-500 font-mono">{row.code2}</td>
                                    <td className="py-4 px-4 text-gray-500">{row.email}</td>
                                    <td className="py-4 px-4 text-gray-500 font-mono">{row.phone}</td>
                                    <td className="py-4 px-4">
                                        <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"><Edit className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </>
      )}

      {/* STUDENTS TAB CONTENT */}
      {activeTab === 'students' && (
         <>
            {/* Controls Row */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                
                {/* Left Actions (Buttons & Filter) */}
                <div className="flex flex-wrap items-center gap-3 order-2 xl:order-1">
                    <button className="flex items-center gap-2 px-6 py-2 bg-brand-purple text-white rounded-full font-bold hover:bg-purple-700 transition-colors shadow-sm">
                        <Plus className="w-5 h-5" />
                        <span>اضافه طالب</span>
                    </button>

                    <input type="file" accept=".xlsx, .xls, .csv" ref={studentFileInputRef} className="hidden" onChange={handleStudentFileChange} />
                    <button onClick={handleStudentUploadClick} className="flex items-center gap-2 px-6 py-2 border border-brand-purple text-brand-purple rounded-full bg-white hover:bg-purple-50 transition-colors font-bold">
                        <Upload className="w-4 h-4" />
                        <span>رفع الملفات</span>
                    </button>

                    <button className="flex items-center gap-2 px-6 py-2 border border-brand-purple text-brand-purple rounded-full bg-white hover:bg-purple-50 transition-colors font-bold">
                        <Download className="w-4 h-4" />
                        <span>تحميل</span>
                    </button>

                    {/* Class Filter Dropdown */}
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-md border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50 mr-2">
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-bold text-gray-700">All</span>
                        <span className="text-sm text-gray-500">: الصف الدراسي</span>
                    </div>
                </div>

                {/* Right Action (Search) */}
                <div className="w-full xl:w-auto flex justify-end order-1 xl:order-2">
                    <div className="relative flex items-center w-full md:w-80 bg-gray-50 rounded-full border border-gray-200 hover:bg-white transition-colors">
                        <input type="text" placeholder="بحث" className="w-full py-2 px-4 bg-transparent outline-none text-right placeholder-gray-400" />
                        <Search className="w-5 h-5 text-gray-400 absolute left-4" />
                    </div>
                </div>
            </div>

            {/* Students Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mt-6">
                <table className="w-full min-w-[1000px] border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm font-bold">
                            <th className="py-4 px-4 text-right">
                                <div className="flex items-center gap-1 cursor-pointer">اسم الطالب <ArrowDownUp className="w-3 h-3 text-gray-400" /></div>
                            </th>
                            <th className="py-4 px-4 text-right">
                                <div className="flex items-center gap-1 cursor-pointer">كود الطالب <ArrowDownUp className="w-3 h-3 text-gray-400" /></div>
                            </th>
                            <th className="py-4 px-4 text-right">
                                <div className="flex items-center gap-1 cursor-pointer">السنه الدراسيه <ArrowDownUp className="w-3 h-3 text-gray-400" /></div>
                            </th>
                            <th className="py-4 px-4 text-right">رقم تعريف ولي الامر</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-700 text-sm">
                         {studentsData.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-8 text-center text-gray-400">لا توجد بيانات، قم برفع ملف للعرض</td>
                            </tr>
                        ) : (
                            studentsData.map((row, index) => (
                                <tr key={index} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                    <td className="py-4 px-4 font-semibold">{row.name}</td>
                                    <td className="py-4 px-4 text-gray-500 font-mono">{row.studentCode}</td>
                                    <td className="py-4 px-4 text-gray-500">{row.grade}</td>
                                    <td className="py-4 px-4 text-gray-500 font-mono">{row.parentCode}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
         </>
      )}

      {/* Reusable Pagination - Dynamic based on uploaded data */}
      <Pagination totalPages={totalPages} />

      {/* Floating Action Button */}
      <button className="fixed bottom-8 left-8 w-14 h-14 bg-brand-purple text-white rounded-full shadow-lg shadow-purple-500/30 flex items-center justify-center hover:bg-purple-700 hover:scale-105 transition-all z-50">
        <Plus className="w-8 h-8" />
      </button>

    </div>
  );
};