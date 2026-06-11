DELETE FROM public.visits v WHERE v.branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = v.branch_id);
ALTER TABLE public.visits ADD CONSTRAINT visits_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
UPDATE public.attendance_logs SET branch_id = NULL WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = attendance_logs.branch_id);
ALTER TABLE public.attendance_logs ADD CONSTRAINT attendance_logs_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
NOTIFY pgrst, 'reload schema';