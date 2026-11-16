import type * as React from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ClassTeacher, Profile, SchoolClass, Student } from '@/types/database';

/** Data and actions the school admin layout shares with its pages (classes, teachers, periods) */
export interface SchoolAdminContext {
  schoolId: string | null | undefined;
  loading: boolean;
  classes: SchoolClass[];
  teachers: Profile[];
  classTeachers: ClassTeacher[];
  selectedClassId: string;
  setSelectedClassId: (id: string) => void;
  selectedClass: SchoolClass | undefined;
  selectedClassTeachers: ClassTeacher[];
  classStudents: Student[];
  setClassDialogOpen: (open: boolean) => void;
  setTeacherDialogOpen: (open: boolean) => void;
  openAssignDialog: (classId: string, teacherId: string) => void;
  handleRemoveClassTeacher: (ct: ClassTeacher) => void;
  setStudentModalOpen: (open: boolean) => void;
  handleDeleteStudent: (studentId: string, studentName: string) => void;
  setActiveModalClass: (value: { id: string; name: string } | null) => void;
  setSeatingEditorOpen: (open: boolean) => void;
  setTeacherActive: (teacherId: string, active: boolean) => Promise<void>;
  handleDeactivateTeacher: (teacherId: string, teacherName: string) => void;
}

export function useSchoolAdmin() {
  return useOutletContext<SchoolAdminContext>();
}
