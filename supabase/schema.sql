-- ==============================================================================
-- 視覺化智慧點名系統 (Attendance AI System)
-- PostgreSQL / Supabase Cloud Database Schema & RLS Policies
-- ==============================================================================

-- 啟用必要的擴充功能
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. 學校實體 (Schools)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 2. 使用者個人資訊 (Profiles) - 整合 Supabase Auth
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('sys_admin', 'school_admin', 'teacher')),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 帳號停用旗標：離職人員以軟停用處理，保留其歷史點名紀錄（見 deactivate_user / reactivate_user）
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ------------------------------------------------------------------------------
-- 3. 班級實體 (Classes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    grade TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 4. 班級與任課教師關聯 (Class Teachers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'subject' CHECK (role IN ('homeroom', 'subject')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (class_id, teacher_id)
);

-- 向後相容補丁：若 class_teachers 於舊版建立而缺少 role 欄位，自動補齊
ALTER TABLE public.class_teachers 
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'subject' CHECK (role IN ('homeroom', 'subject'));

-- ------------------------------------------------------------------------------
-- 5. 學生名冊 (Students)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    student_number TEXT NOT NULL,
    name TEXT NOT NULL,
    seat_number INTEGER NOT NULL,
    gender TEXT,
    parent_phone TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (school_id, student_number)
);

-- ------------------------------------------------------------------------------
-- 6. 教室座位表 (Seating Charts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seating_charts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '預設座位表',
    aspect_ratio TEXT NOT NULL DEFAULT '16:9',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 7. 座位座標框 (Seating Boxes) - 正規化比例 0.0 ~ 1.0
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seating_boxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chart_id UUID NOT NULL REFERENCES public.seating_charts(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    seat_label TEXT NOT NULL,
    x_ratio DOUBLE PRECISION NOT NULL,
    y_ratio DOUBLE PRECISION NOT NULL,
    w_ratio DOUBLE PRECISION NOT NULL,
    h_ratio DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 8. 點名場次紀錄 (Attendance Sessions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    chart_id UUID REFERENCES public.seating_charts(id) ON DELETE SET NULL,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period TEXT,
    snapshot_path TEXT,
    detection_raw_json JSONB,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 向後相容：舊版 teacher_id 為 NOT NULL + ON DELETE CASCADE，刪除教師會連帶刪除點名歷史，改為 SET NULL 保留紀錄
ALTER TABLE public.attendance_sessions ALTER COLUMN teacher_id DROP NOT NULL;
ALTER TABLE public.attendance_sessions DROP CONSTRAINT IF EXISTS attendance_sessions_teacher_id_fkey;
ALTER TABLE public.attendance_sessions
    ADD CONSTRAINT attendance_sessions_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- 9. 學生個別出勤紀錄 (Attendance Records)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'leave')),
    ai_detected_status TEXT CHECK (ai_detected_status IN ('present', 'absent')),
    is_overridden BOOLEAN NOT NULL DEFAULT false,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (session_id, student_id)
);

-- 9b. 全校統一點名時間表（學校主管建立一次，全校班級與教師每週一到週五套用）
-- 取代舊的逐班課表 class_schedules
DROP TABLE IF EXISTS public.class_schedules CASCADE;

CREATE TABLE IF NOT EXISTS public.school_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    start_time TIME NOT NULL,
    remind_before_min INTEGER NOT NULL DEFAULT 5 CHECK (remind_before_min BETWEEN 0 AND 60),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (school_id, period)
);

-- ------------------------------------------------------------------------------
-- 10. 輔助函式：取得目前使用者之角色與學校識別碼
-- 已停用帳號 (is_active = false) 回傳 NULL，所有依賴此函式的 RLS 政策即自動拒絕
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active;
$$;

CREATE OR REPLACE FUNCTION public.current_user_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid() AND is_active;
$$;

-- ------------------------------------------------------------------------------
-- 11. 家長免登入雙重校驗查詢 RPC (Security Definer)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.query_student_attendance(
    p_student_number TEXT,
    p_parent_phone_last4 TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_student RECORD;
    v_records JSONB;
BEGIN
    -- 1. 查找符合學號且家長電話後四碼一致之學生
    SELECT s.id, s.name, s.student_number, s.seat_number, c.name AS class_name, sch.name AS school_name
    INTO v_student
    FROM public.students s
    JOIN public.classes c ON c.id = s.class_id
    JOIN public.schools sch ON sch.id = s.school_id
    WHERE s.student_number = p_student_number
      AND RIGHT(REPLACE(s.parent_phone, '-', ''), 4) = p_parent_phone_last4
    LIMIT 1;

    IF v_student.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', '學號或家長電話後四碼校驗不符合');
    END IF;

    -- 2. 獲取近 30 筆出勤歷史
    SELECT jsonb_agg(
        jsonb_build_object(
            'record_id', r.id,
            'date', sess.session_date,
            'period', sess.period,
            'status', r.status,
            'ai_detected_status', r.ai_detected_status,
            'is_overridden', r.is_overridden,
            'note', r.note,
            'snapshot_path', sess.snapshot_path,
            'created_at', r.created_at
        ) ORDER BY sess.session_date DESC, sess.created_at DESC
    )
    INTO v_records
    FROM public.attendance_records r
    JOIN public.attendance_sessions sess ON sess.id = r.session_id
    WHERE r.student_id = v_student.id;

    RETURN jsonb_build_object(
        'success', true,
        'student', jsonb_build_object(
            'id', v_student.id,
            'name', v_student.name,
            'student_number', v_student.student_number,
            'seat_number', v_student.seat_number,
            'class_name', v_student.class_name,
            'school_name', v_student.school_name
        ),
        'records', COALESCE(v_records, '[]'::jsonb)
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 12. 行級安全策略 (Row Level Security - RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_periods ENABLE ROW LEVEL SECURITY;

-- School Periods 權限：系統總管與本校主管可管理；本校教師唯讀（供提醒使用）
DROP POLICY IF EXISTS "School periods read" ON public.school_periods;
DROP POLICY IF EXISTS "School periods admin write" ON public.school_periods;

CREATE POLICY "School periods read" ON public.school_periods
    FOR SELECT TO authenticated
    USING (
        public.current_user_role() = 'sys_admin'
        OR school_id = public.current_user_school_id()
    );

CREATE POLICY "School periods admin write" ON public.school_periods
    FOR ALL TO authenticated
    USING (
        public.current_user_role() = 'sys_admin'
        OR (public.current_user_role() = 'school_admin' AND school_id = public.current_user_school_id())
    )
    WITH CHECK (
        public.current_user_role() = 'sys_admin'
        OR (public.current_user_role() = 'school_admin' AND school_id = public.current_user_school_id())
    );

-- Schools 權限
DROP POLICY IF EXISTS "Schools sys_admin full access" ON public.schools;
CREATE POLICY "Schools sys_admin full access" ON public.schools
    FOR ALL USING (public.current_user_role() = 'sys_admin');

DROP POLICY IF EXISTS "Schools authenticated read access" ON public.schools;
CREATE POLICY "Schools authenticated read access" ON public.schools
    FOR SELECT TO authenticated USING (true);

-- Profiles 權限
-- 自身僅可讀取與更新（欄位限制由 guard_profile_privileged_columns 觸發器強制），不可自行 INSERT/DELETE
DROP POLICY IF EXISTS "Profiles self access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles self select" ON public.profiles;
CREATE POLICY "Profiles self select" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles self update" ON public.profiles;
CREATE POLICY "Profiles self update" ON public.profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 特權欄位保護：一般客戶端 (authenticated / anon) 不得變更 role、school_id、email、id，
-- 且非系統總管新增 profile 時僅能為 teacher。SECURITY DEFINER RPC 與 service_role 以資料庫擁有者身分執行，不受影響。
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    IF public.current_user_role() = 'sys_admin' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.role <> 'teacher' THEN
            RAISE EXCEPTION '權限不足，無法建立此角色之個人資料';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.school_id IS DISTINCT FROM OLD.school_id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
        RAISE EXCEPTION '權限不足，無法變更角色、所屬學校、信箱或停用狀態';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER guard_profile_privileged_columns
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

DROP POLICY IF EXISTS "Profiles sys_admin full access" ON public.profiles;
CREATE POLICY "Profiles sys_admin full access" ON public.profiles
    FOR ALL USING (public.current_user_role() = 'sys_admin');

DROP POLICY IF EXISTS "Profiles school_admin read/manage in school" ON public.profiles;
CREATE POLICY "Profiles school_admin read/manage in school" ON public.profiles
    FOR ALL USING (
        public.current_user_role() = 'school_admin'
        AND school_id = public.current_user_school_id()
    );

DROP POLICY IF EXISTS "Profiles read in same school" ON public.profiles;
CREATE POLICY "Profiles read in same school" ON public.profiles
    FOR SELECT TO authenticated USING (
        school_id = public.current_user_school_id()
    );

-- Classes 權限
DROP POLICY IF EXISTS "Classes sys_admin full" ON public.classes;
CREATE POLICY "Classes sys_admin full" ON public.classes
    FOR ALL USING (public.current_user_role() = 'sys_admin');

DROP POLICY IF EXISTS "Classes school_admin manage" ON public.classes;
CREATE POLICY "Classes school_admin manage" ON public.classes
    FOR ALL USING (
        public.current_user_role() = 'school_admin'
        AND school_id = public.current_user_school_id()
    );

DROP POLICY IF EXISTS "Classes teacher read" ON public.classes;
CREATE POLICY "Classes teacher read" ON public.classes
    FOR SELECT TO authenticated USING (
        school_id = public.current_user_school_id()
    );

-- Class Teachers 權限
DROP POLICY IF EXISTS "Class teachers manage" ON public.class_teachers;
CREATE POLICY "Class teachers manage" ON public.class_teachers
    FOR ALL TO authenticated USING (
        public.current_user_role() = 'sys_admin'
        OR (
            public.current_user_role() = 'school_admin'
            AND class_id IN (
                SELECT c.id FROM public.classes c WHERE c.school_id = public.current_user_school_id()
            )
        )
        OR (
            teacher_id = auth.uid()
            AND class_id IN (
                SELECT c.id FROM public.classes c WHERE c.school_id = public.current_user_school_id()
            )
        )
    );

-- Students 權限
DROP POLICY IF EXISTS "Students manage" ON public.students;
CREATE POLICY "Students manage" ON public.students
    FOR ALL TO authenticated USING (
        public.current_user_role() = 'sys_admin'
        OR (
            school_id = public.current_user_school_id()
            AND public.current_user_role() IN ('school_admin', 'teacher')
        )
    );

-- Seating Charts & Boxes 權限
DROP POLICY IF EXISTS "Seating charts access" ON public.seating_charts;
CREATE POLICY "Seating charts access" ON public.seating_charts
    FOR ALL TO authenticated USING (
        public.current_user_role() = 'sys_admin'
        OR class_id IN (
            SELECT c.id FROM public.classes c WHERE c.school_id = public.current_user_school_id()
        )
    );

DROP POLICY IF EXISTS "Seating boxes access" ON public.seating_boxes;
CREATE POLICY "Seating boxes access" ON public.seating_boxes
    FOR ALL TO authenticated USING (
        public.current_user_role() = 'sys_admin'
        OR chart_id IN (
            SELECT sc.id FROM public.seating_charts sc
            JOIN public.classes c ON c.id = sc.class_id
            WHERE c.school_id = public.current_user_school_id()
        )
    );

-- Attendance Sessions & Records 權限
DROP POLICY IF EXISTS "Attendance sessions access" ON public.attendance_sessions;
CREATE POLICY "Attendance sessions access" ON public.attendance_sessions
    FOR ALL TO authenticated USING (
        public.current_user_role() = 'sys_admin'
        OR class_id IN (
            SELECT c.id FROM public.classes c WHERE c.school_id = public.current_user_school_id()
        )
    );

DROP POLICY IF EXISTS "Attendance records access" ON public.attendance_records;
CREATE POLICY "Attendance records access" ON public.attendance_records
    FOR ALL TO authenticated USING (
        public.current_user_role() = 'sys_admin'
        OR session_id IN (
            SELECT s.id FROM public.attendance_sessions s
            JOIN public.classes c ON c.id = s.class_id
            WHERE c.school_id = public.current_user_school_id()
        )
    );

-- ------------------------------------------------------------------------------
-- 13. 自動化觸發器：在 auth.users 註冊時同步建立 profiles 記錄
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- role / school_id 絕不信任客戶端 metadata：一律建立為未綁定學校的 teacher，
    -- 提升權限僅能透過 register_school_admin / assign_school_admin / assign_teacher_to_school RPC
    INSERT INTO public.profiles (id, school_id, role, name, email, phone)
    VALUES (
        NEW.id,
        NULL,
        'teacher',
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.email,
        NEW.raw_user_meta_data->>'phone'
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 14. 安全預存程序：學校單位開通與多主管綁定 (register_school_admin)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_school_admin(
    p_school_name TEXT,
    p_school_code TEXT,
    p_admin_name TEXT,
    p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_school_id UUID;
    v_clean_code TEXT;
    v_user_email TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '未經身分驗證，無法執行學校主管開通';
    END IF;

    v_clean_code := UPPER(TRIM(p_school_code));

    -- 已停用帳號不得自行重新開通
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND NOT is_active) THEN
        RAISE EXCEPTION '此帳號已停用，無法開通學校';
    END IF;

    -- 取得呼叫者信箱
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

    -- 檢查學校是否已存在（防止越權竄改非所屬學校）
    SELECT id INTO v_school_id FROM public.schools WHERE code = v_clean_code;

    IF v_school_id IS NOT NULL THEN
        -- 若學校代碼已存在，僅允許本校既有成員更新，禁止任意帳號直接接管
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = v_user_id AND school_id = v_school_id
        ) THEN
            RAISE EXCEPTION '此學校代碼已被註冊，如需加入該校主管團隊，請聯繫系統總管指派';
        END IF;
    ELSE
        -- 學校不存在，建立新學校
        INSERT INTO public.schools (name, code)
        VALUES (TRIM(p_school_name), v_clean_code)
        RETURNING id INTO v_school_id;
    END IF;

    -- 配置或更新呼叫者的 Profile 為該校主管
    INSERT INTO public.profiles (id, school_id, role, name, email, phone)
    VALUES (
        v_user_id,
        v_school_id,
        'school_admin',
        TRIM(p_admin_name),
        v_user_email,
        p_phone
    )
    ON CONFLICT (id) DO UPDATE SET
        school_id = v_school_id,
        role = 'school_admin',
        name = TRIM(p_admin_name),
        phone = p_phone,
        updated_at = TIMEZONE('utc'::text, NOW());

    RETURN jsonb_build_object(
        'success', true,
        'school_id', v_school_id,
        'school_code', v_clean_code
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 15. 系統總管安全預存程序：主管解任與指派 (remove_school_admin / assign_school_admin)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_school_admin(p_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.current_user_role() != 'sys_admin' THEN
        RAISE EXCEPTION '權限不足，僅系統總管可執行解任操作';
    END IF;

    UPDATE public.profiles
    SET school_id = NULL, role = 'teacher', updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_profile_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_school_admin(
    p_school_id UUID,
    p_email TEXT,
    p_name TEXT,
    p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_id UUID;
BEGIN
    IF public.current_user_role() != 'sys_admin' THEN
        RAISE EXCEPTION '權限不足，僅系統總管可指派學校主管';
    END IF;

    SELECT id INTO v_target_id FROM public.profiles WHERE LOWER(email) = LOWER(TRIM(p_email));

    IF v_target_id IS NOT NULL THEN
        UPDATE public.profiles
        SET school_id = p_school_id,
            role = 'school_admin',
            name = COALESCE(NULLIF(TRIM(p_name), ''), name),
            phone = COALESCE(p_phone, phone),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_target_id;

        RETURN jsonb_build_object('success', true, 'action', 'updated');
    ELSE
        RETURN jsonb_build_object('success', false, 'error', '查無此信箱之帳號，請請該員先進行註冊');
    END IF;
END;
$$;

-- 停用 / 啟用帳號（離職移除，保留歷史紀錄）
-- sys_admin：可處理 school_admin 與 teacher；school_admin：僅可處理本校 teacher；不可處理自己
CREATE OR REPLACE FUNCTION public.set_user_active(p_profile_id UUID, p_active BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_role TEXT := public.current_user_role();
    v_caller_school UUID := public.current_user_school_id();
    v_target_role TEXT;
    v_target_school UUID;
BEGIN
    IF v_caller_role IS NULL OR v_caller_role NOT IN ('sys_admin', 'school_admin') THEN
        RAISE EXCEPTION '權限不足，無法停用或啟用帳號';
    END IF;

    IF p_profile_id = auth.uid() THEN
        RAISE EXCEPTION '不可停用或啟用自己的帳號';
    END IF;

    SELECT role, school_id INTO v_target_role, v_target_school
    FROM public.profiles WHERE id = p_profile_id;

    IF v_target_role IS NULL THEN
        RAISE EXCEPTION '查無此帳號';
    END IF;

    IF v_caller_role = 'sys_admin' THEN
        IF v_target_role = 'sys_admin' THEN
            RAISE EXCEPTION '不可變更系統總管帳號';
        END IF;
    ELSE
        IF v_target_role <> 'teacher' OR v_target_school IS DISTINCT FROM v_caller_school THEN
            RAISE EXCEPTION '權限不足，僅可處理本校教師帳號';
        END IF;
    END IF;

    UPDATE public.profiles
    SET is_active = p_active,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_profile_id;

    IF NOT p_active THEN
        DELETE FROM public.class_teachers WHERE teacher_id = p_profile_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'is_active', p_active);
END;
$$;

-- 學校主管將新建立（尚未綁定學校）的教師帳號納入本校
CREATE OR REPLACE FUNCTION public.assign_teacher_to_school(
    p_teacher_id UUID,
    p_name TEXT,
    p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_school_id UUID;
    v_updated INTEGER;
BEGIN
    IF public.current_user_role() != 'school_admin' THEN
        RAISE EXCEPTION '權限不足，僅學校主管可開通教師帳號';
    END IF;

    v_school_id := public.current_user_school_id();
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION '呼叫者尚未綁定學校';
    END IF;

    UPDATE public.profiles
    SET school_id = v_school_id,
        name = COALESCE(NULLIF(TRIM(p_name), ''), name),
        phone = COALESCE(p_phone, phone),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_teacher_id
      AND role = 'teacher'
      AND is_active
      AND (school_id IS NULL OR school_id = v_school_id);

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
        RAISE EXCEPTION '查無可指派之教師帳號';
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ------------------------------------------------------------------------------
-- 15b. 平台系統總管：永久刪除（帳號、學校）與稽核紀錄
-- 刪除不可復原。照片檔案由前端以 Storage API 先行清除，再呼叫這些函式。
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deletion_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    kind TEXT NOT NULL,
    target_label TEXT NOT NULL,
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.deletion_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deletion log sys_admin read" ON public.deletion_log;
CREATE POLICY "Deletion log sys_admin read" ON public.deletion_log
    FOR SELECT TO authenticated USING (public.current_user_role() = 'sys_admin');

-- 永久刪除單一帳號（含登入身分）。不可刪除自己或其他系統總管。
CREATE OR REPLACE FUNCTION public.delete_user_account(p_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target public.profiles%ROWTYPE;
BEGIN
    IF public.current_user_role() IS DISTINCT FROM 'sys_admin' THEN
        RAISE EXCEPTION '權限不足，僅系統總管可永久刪除帳號';
    END IF;

    IF p_profile_id = auth.uid() THEN
        RAISE EXCEPTION '不可刪除自己的帳號';
    END IF;

    SELECT * INTO v_target FROM public.profiles WHERE id = p_profile_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION '查無此帳號';
    END IF;

    IF v_target.role = 'sys_admin' THEN
        RAISE EXCEPTION '不可刪除系統總管帳號';
    END IF;

    INSERT INTO public.deletion_log (actor_id, kind, target_label, detail)
    VALUES (
        auth.uid(),
        'account',
        v_target.email,
        jsonb_build_object('name', v_target.name, 'role', v_target.role, 'school_id', v_target.school_id)
    );

    -- profiles.id 以 ON DELETE CASCADE 參照 auth.users，連帶刪除 profile、class_teachers；
    -- attendance_sessions.teacher_id 與 seating_charts.created_by 為 SET NULL，歷史紀錄保留
    DELETE FROM auth.users WHERE id = p_profile_id;

    RETURN jsonb_build_object('success', true, 'email', v_target.email);
END;
$$;

-- 永久刪除整間學校：班級、學生、座位表、點名紀錄、課表；可選擇連同該校所有帳號一併刪除
CREATE OR REPLACE FUNCTION public.delete_school_cascade(p_school_id UUID, p_delete_accounts BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_school public.schools%ROWTYPE;
    v_classes INTEGER;
    v_students INTEGER;
    v_accounts INTEGER := 0;
BEGIN
    IF public.current_user_role() IS DISTINCT FROM 'sys_admin' THEN
        RAISE EXCEPTION '權限不足，僅系統總管可永久刪除學校';
    END IF;

    SELECT * INTO v_school FROM public.schools WHERE id = p_school_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION '查無此學校';
    END IF;

    SELECT COUNT(*) INTO v_classes FROM public.classes WHERE school_id = p_school_id;
    SELECT COUNT(*) INTO v_students FROM public.students WHERE school_id = p_school_id;

    IF p_delete_accounts THEN
        SELECT COUNT(*) INTO v_accounts
        FROM public.profiles
        WHERE school_id = p_school_id AND role <> 'sys_admin' AND id <> auth.uid();

        DELETE FROM auth.users
        WHERE id IN (
            SELECT id FROM public.profiles
            WHERE school_id = p_school_id AND role <> 'sys_admin' AND id <> auth.uid()
        );
    END IF;

    INSERT INTO public.deletion_log (actor_id, kind, target_label, detail)
    VALUES (
        auth.uid(),
        'school',
        v_school.name,
        jsonb_build_object(
            'code', v_school.code,
            'classes', v_classes,
            'students', v_students,
            'accounts', v_accounts,
            'accounts_deleted', p_delete_accounts
        )
    );

    DELETE FROM public.schools WHERE id = p_school_id;

    RETURN jsonb_build_object(
        'success', true,
        'classes', v_classes,
        'students', v_students,
        'accounts', v_accounts
    );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_school_cascade(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_school_cascade(UUID, BOOLEAN) TO authenticated;

-- ------------------------------------------------------------------------------
-- 16. 雲端存證照片儲存庫 (Storage Bucket)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-snapshots', 'attendance-snapshots', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Allow authenticated staff to upload attendance snapshots" ON storage.objects;
CREATE POLICY "Allow authenticated staff to upload attendance snapshots"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'attendance-snapshots'
    AND (
        public.current_user_role() = 'sys_admin'
        OR (
            public.current_user_role() IN ('school_admin', 'teacher')
            AND (storage.foldername(name))[1] IN (
                SELECT c.id::text FROM public.classes c
                WHERE c.school_id = public.current_user_school_id()
            )
        )
    )
);

DROP POLICY IF EXISTS "Allow school staff to read attendance snapshots" ON storage.objects;
CREATE POLICY "Allow school staff to read attendance snapshots"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'attendance-snapshots'
    AND (
        public.current_user_role() = 'sys_admin'
        OR (
            public.current_user_role() IN ('school_admin', 'teacher')
            AND (storage.foldername(name))[1] IN (
                SELECT c.id::text FROM public.classes c
                WHERE c.school_id = public.current_user_school_id()
            )
        )
    )
);

-- 系統總管可刪除照片檔案（永久刪除班級或學校時，由前端以 Storage API 清除）
DROP POLICY IF EXISTS "Allow sys_admin to delete attendance snapshots" ON storage.objects;
CREATE POLICY "Allow sys_admin to delete attendance snapshots"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'attendance-snapshots'
    AND public.current_user_role() = 'sys_admin'
);

-- ------------------------------------------------------------------------------
-- 17. 重新載入 PostgREST 快取 (Schema Cache Reload)
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
