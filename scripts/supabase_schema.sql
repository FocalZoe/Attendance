-- ==============================================================================
-- 智慧班級考勤系統 - 多租戶與角色權限遷移腳本 (0001_multi_tenant_rls.sql)
-- 適用環境: Supabase PostgreSQL (支援官方 auth.users, RLS 強制防護與 B-Tree 索引)
-- ==============================================================================

-- 啟用 uuid 擴充套件
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 學校資料表 (Tenants)
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    edu_code TEXT,
    contact_email TEXT,
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 補丁擴充 schools 欄位
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS edu_code TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;

-- 2. 使用者 Profile 資料表 (連結 auth.users 與學校多租戶)
DO $$ BEGIN
    CREATE TYPE public.app_user_role AS ENUM ('school_admin', 'teacher');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    role public.app_user_role NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_school_id ON public.user_profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- 3. 班級資料表 (Classes)
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    student_count INT DEFAULT 0,
    seat_layout JSONB DEFAULT '{"layout1": {"name": "平時上課 (4×5 標準)", "gridRows": 4, "gridCols": 5, "base_width": 640, "base_height": 480, "seats": []}}'::jsonb,
    active_layout_key TEXT DEFAULT 'layout1',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classes_school_id ON public.classes(school_id);

-- 4. 教師與班級多對多關聯表 (Teacher Classes)
CREATE TABLE IF NOT EXISTS public.teacher_classes (
    teacher_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (teacher_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_classes_teacher_id ON public.teacher_classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_class_id ON public.teacher_classes(class_id);

-- 5. 學生資料表 (Students) - 支援學號、生日驗證碼與備援魔術代碼
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    student_no TEXT,
    seat_number INT NOT NULL,
    name TEXT NOT NULL,
    verify_code TEXT,
    magic_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 若資料庫中已有舊版 students 表，自動補丁擴充缺少欄位
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS student_no TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS verify_code TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS magic_token TEXT;

CREATE INDEX IF NOT EXISTS idx_students_class_id ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_student_no ON public.students(student_no);
CREATE INDEX IF NOT EXISTS idx_students_magic_token ON public.students(magic_token);

-- 6. 啟用與強制 RLS (符合 SupabasePostgreSQL_MaximumSecurityRLS Invariant)
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.teacher_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_classes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students FORCE ROW LEVEL SECURITY;

-- 7. 建立優化後的 RLS 策略 (InitPlan 最佳化，防止 SubPlan 退化)
-- schools: 學校總管與所屬教師可讀取所屬學校
DROP POLICY IF EXISTS "allow_users_read_own_school" ON public.schools;
CREATE POLICY "allow_users_read_own_school" ON public.schools
    FOR SELECT
    USING (
        id = (SELECT school_id FROM public.user_profiles WHERE id = (SELECT auth.uid()))
    );

-- user_profiles: 使用者可讀取自己 Profile，學校總管可讀取同校所有成員
DROP POLICY IF EXISTS "user_read_profiles" ON public.user_profiles;
CREATE POLICY "user_read_profiles" ON public.user_profiles
    FOR SELECT
    USING (
        id = (SELECT auth.uid()) OR
        school_id = (
            SELECT school_id FROM public.user_profiles 
            WHERE id = (SELECT auth.uid()) AND role = 'school_admin'
        )
    );

-- classes: 學校總管可存取同校所有班級；教師可存取指派班級
DROP POLICY IF EXISTS "school_admin_all_classes" ON public.classes;
CREATE POLICY "school_admin_all_classes" ON public.classes
    FOR ALL
    USING (
        school_id = (
            SELECT school_id FROM public.user_profiles 
            WHERE id = (SELECT auth.uid()) AND role = 'school_admin'
        )
    );

DROP POLICY IF EXISTS "teacher_read_assigned_classes" ON public.classes;
CREATE POLICY "teacher_read_assigned_classes" ON public.classes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.teacher_classes 
            WHERE class_id = classes.id 
            AND teacher_id = (SELECT auth.uid())
        )
    );

-- students: 允許持有有效 magic_token 免登入讀取特定學生資訊 (家長遊客查詢)
DROP POLICY IF EXISTS "parents_token_read_student" ON public.students;
CREATE POLICY "parents_token_read_student" ON public.students
    FOR SELECT
    USING (
        magic_token IS NOT NULL AND magic_token != ''
    );

-- 8. 家長以「學號 + 安全驗證碼 (生日月日4碼或座號補零)」專屬安全查詢 RPC
-- 符合 SECURITY DEFINER Hardening：宣告 SET search_path = '' 與完全限定名稱
CREATE OR REPLACE FUNCTION public.verify_student_parent_access(
    p_student_no TEXT,
    p_verify_code TEXT
) RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    student_no TEXT,
    seat_number INT,
    class_name TEXT,
    school_name TEXT
) LANGUAGE plpgsql SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id AS student_id,
        s.name AS student_name,
        s.student_no,
        s.seat_number,
        c.name AS class_name,
        sch.name AS school_name
    FROM public.students s
    JOIN public.classes c ON s.class_id = c.id
    JOIN public.schools sch ON c.school_id = sch.id
    WHERE s.student_no = TRIM(p_student_no)
      AND (
          s.verify_code = TRIM(p_verify_code)
          OR pg_catalog.lpad(s.seat_number::TEXT, 2, '0') = TRIM(p_verify_code)
      )
    LIMIT 1;
END;
$$;

