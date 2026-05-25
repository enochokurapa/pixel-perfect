
ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS badge_returned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assets_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkout_notes text;
