-- ==============================================================================
-- Migration: 20260903_dartis_master_dataset.sql
-- Master Dataset Schema for DARTIS 2019 & Maritime SAR Forensic Attribution
-- ==============================================================================

-- 1. Table: dataset_imports
CREATE TABLE IF NOT EXISTS public.dataset_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE,
  dataset_name TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT,
  storage_provider TEXT DEFAULT 'supabase', -- 'supabase' or 'local'
  status TEXT NOT NULL DEFAULT 'READY', -- UPLOADING, EXTRACTING, INDEXING, COMPLETED, FAILED
  stage TEXT DEFAULT 'COMPLETED',
  progress INTEGER DEFAULT 100,
  total_images INTEGER DEFAULT 0,
  oil_spill_images INTEGER DEFAULT 0,
  clean_images INTEGER DEFAULT 0,
  total_oil_objects INTEGER DEFAULT 0,
  error_message TEXT,
  geographic_bounds JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Table: dataset_images
CREATE TABLE IF NOT EXISTS public.dataset_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES public.dataset_imports(id) ON DELETE CASCADE,
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  normalized_filename TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  patch_id TEXT NOT NULL,
  sentinel_patch_name TEXT,
  sentinel_product_id TEXT,
  satellite TEXT DEFAULT 'Sentinel-1A SAR',
  acquisition_mode TEXT DEFAULT 'IW',
  polarization TEXT DEFAULT 'VV',
  orbit_number INTEGER,
  data_take_id TEXT,
  acquisition_start_time TIMESTAMPTZ NOT NULL,
  acquisition_end_time TIMESTAMPTZ,
  width INTEGER NOT NULL DEFAULT 256,
  height INTEGER NOT NULL DEFAULT 256,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  corners JSONB, -- { topLeft: [lat, lng], topRight: [lat, lng], ... }
  geo_polygon JSONB, -- GeoJSON polygon
  oil_present BOOLEAN NOT NULL DEFAULT false,
  object_count INTEGER NOT NULL DEFAULT 0,
  storage_path TEXT,
  thumbnail_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Table: oil_objects
CREATE TABLE IF NOT EXISTS public.oil_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID NOT NULL REFERENCES public.dataset_images(id) ON DELETE CASCADE,
  object_index INTEGER NOT NULL DEFAULT 0,
  pixel_bbox JSONB, -- { minX, minY, maxX, maxY }
  geo_coordinates JSONB, -- Array of [lng, lat]
  geo_polygon JSONB, -- GeoJSON polygon
  area_km2 DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  pixel_count INTEGER,
  confidence DOUBLE PRECISION DEFAULT 100.0,
  label TEXT DEFAULT 'OIL_SLICK',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. High-Performance Indexes
CREATE INDEX IF NOT EXISTS idx_dataset_images_normalized_fn ON public.dataset_images(normalized_filename);
CREATE INDEX IF NOT EXISTS idx_dataset_images_file_name ON public.dataset_images(file_name);
CREATE INDEX IF NOT EXISTS idx_dataset_images_patch_id ON public.dataset_images(patch_id);
CREATE INDEX IF NOT EXISTS idx_dataset_images_sentinel_product_id ON public.dataset_images(sentinel_product_id);
CREATE INDEX IF NOT EXISTS idx_dataset_images_oil_present ON public.dataset_images(oil_present);
CREATE INDEX IF NOT EXISTS idx_dataset_images_import_id ON public.dataset_images(import_id);
CREATE INDEX IF NOT EXISTS idx_oil_objects_image_id ON public.oil_objects(image_id);
CREATE INDEX IF NOT EXISTS idx_dataset_imports_status ON public.dataset_imports(status);

-- 5. Row Level Security Policies
ALTER TABLE public.dataset_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oil_objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access dataset imports" ON public.dataset_imports FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "Access dataset images" ON public.dataset_images FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "Access oil objects" ON public.oil_objects FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
