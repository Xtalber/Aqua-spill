-- ==============================================================================
-- SpillScan Maritime Intelligence Platform - Complete Supabase Database Schema
-- Migration: 20260830_initial_schema.sql
-- Covers: Projects, Datasets, SAR Rasters, Analyses, Slicks, Metocean, AIS, Drift, Candidates, Reports
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable PostGIS if available on the Postgres instance
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "postgis";
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'PostGIS not available or permission denied, fallback to JSONB/Float geometry.';
END $$;

-- ==============================================================================
-- 2. Schema Definition
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Table: projects
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, ARCHIVED, INVESTIGATING
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table: datasets
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  original_filename TEXT,
  storage_path TEXT,
  file_type TEXT DEFAULT 'ZIP', -- ZIP, FOLDER, TAR_GZ, DIRECT_FILES
  file_size BIGINT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'READY', -- UPLOADING, EXTRACTING, INDEXING, READY, FAILED
  total_files INTEGER DEFAULT 0,
  sar_files INTEGER DEFAULT 0,
  ais_files INTEGER DEFAULT 0,
  metadata_files INTEGER DEFAULT 0,
  geo_files INTEGER DEFAULT 0,
  weather_files INTEGER DEFAULT 0,
  ocean_files INTEGER DEFAULT 0,
  geographic_bounds JSONB,
  time_range JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table: dataset_files
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dataset_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT DEFAULT 0,
  storage_path TEXT,
  category TEXT NOT NULL DEFAULT 'other', -- sar, ais, metadata, geo, weather, ocean, other
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table: sar_images
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sar_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  storage_path TEXT,
  satellite TEXT DEFAULT 'Sentinel-1A SAR',
  scene_id TEXT,
  acquisition_time TIMESTAMPTZ,
  width INTEGER,
  height INTEGER,
  crs TEXT DEFAULT 'WGS 84 (EPSG:4326)',
  bounds JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table: analyses
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE SET NULL,
  sar_image_id UUID REFERENCES public.sar_images(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Oil Slick Detection & Attribution Analysis',
  location_name TEXT,
  status TEXT NOT NULL DEFAULT 'COMPLETED', -- PENDING, PROCESSING, COMPLETED, FAILED
  progress INTEGER DEFAULT 100,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table: spill_detections
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spill_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  geometry JSONB NOT NULL,
  centroid_lat DOUBLE PRECISION,
  centroid_lon DOUBLE PRECISION,
  area_km2 DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  perimeter_km DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  length_km DOUBLE PRECISION,
  width_km DOUBLE PRECISION,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  confidence_level TEXT DEFAULT 'HIGH', -- HIGH, MEDIUM, LOW
  segmentation_method TEXT DEFAULT 'Multi-scale CFAR + Adaptive Damping Threshold',
  bounding_box JSONB,
  pixel_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table: spill_metrics
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spill_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  evaporation_percent DOUBLE PRECISION DEFAULT 0.0,
  emulsification_percent DOUBLE PRECISION DEFAULT 0.0,
  estimated_age_hours DOUBLE PRECISION DEFAULT 0.0,
  backscatter_deficit_db DOUBLE PRECISION DEFAULT 0.0,
  weathering_model TEXT DEFAULT 'ADIOS2 / Fay-Mackay Leeway Model',
  metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table: drift_tracks
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.drift_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  track_type TEXT NOT NULL, -- observed, hindcast, forecast
  geometry JSONB NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  origin_lat DOUBLE PRECISION,
  origin_lon DOUBLE PRECISION,
  uncertainty_geometry JSONB,
  uncertainty_radius_km DOUBLE PRECISION DEFAULT 1.5,
  model_name TEXT DEFAULT 'Lagrangian Leeway Model (CMEMS + ERA5)',
  model_parameters JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table: environmental_data
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.environmental_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  wind_speed DOUBLE PRECISION,
  wind_direction DOUBLE PRECISION,
  current_speed DOUBLE PRECISION,
  current_direction DOUBLE PRECISION,
  wave_height DOUBLE PRECISION,
  sea_temperature DOUBLE PRECISION,
  source TEXT DEFAULT 'Copernicus ERA5 & CMEMS',
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table: ais_vessels
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ais_vessels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE,
  mmsi TEXT NOT NULL,
  imo TEXT,
  vessel_name TEXT NOT NULL,
  vessel_type TEXT,
  flag TEXT,
  flag_code TEXT,
  callsign TEXT,
  length_m DOUBLE PRECISION,
  beam_m DOUBLE PRECISION,
  draught_m DOUBLE PRECISION,
  destination TEXT,
  eta TIMESTAMPTZ,
  data_quality JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table: ais_positions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ais_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE,
  vessel_id UUID REFERENCES public.ais_vessels(id) ON DELETE CASCADE,
  mmsi TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION,
  course DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  draught DOUBLE PRECISION,
  navigation_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table: vessel_tracks
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vessel_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES public.analyses(id) ON DELETE CASCADE,
  vessel_id UUID REFERENCES public.ais_vessels(id) ON DELETE CASCADE,
  mmsi TEXT NOT NULL,
  geometry JSONB NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table: vessel_candidates
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vessel_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  vessel_id UUID REFERENCES public.ais_vessels(id) ON DELETE CASCADE,
  mmsi TEXT NOT NULL,
  vessel_name TEXT NOT NULL,
  rank INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL DEFAULT 'PRIMARY SOURCE CANDIDATE', -- PRIMARY SOURCE CANDIDATE, SOURCE CANDIDATE, LOW PROBABILITY, EXCLUDED
  attribution_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  proximity_score DOUBLE PRECISION DEFAULT 0.0,
  temporal_score DOUBLE PRECISION DEFAULT 0.0,
  trajectory_score DOUBLE PRECISION DEFAULT 0.0,
  course_score DOUBLE PRECISION DEFAULT 0.0,
  speed_score DOUBLE PRECISION DEFAULT 0.0,
  corridor_score DOUBLE PRECISION DEFAULT 0.0,
  ais_quality_score DOUBLE PRECISION DEFAULT 0.0,
  minimum_distance_km DOUBLE PRECISION,
  time_difference_minutes DOUBLE PRECISION,
  trajectory_alignment DOUBLE PRECISION,
  cpa_position JSONB,
  reasoning JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table: analysis_events (Realtime Progress Feed)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analysis_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  progress INTEGER NOT NULL,
  message TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table: reports
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL DEFAULT 'MARPOL_ANNEX_I_FORENSIC_DOSSIER',
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  pdf_storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. Indexes for Optimized Query Performance
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_datasets_user_id ON public.datasets(user_id);
CREATE INDEX IF NOT EXISTS idx_datasets_project_id ON public.datasets(project_id);
CREATE INDEX IF NOT EXISTS idx_dataset_files_dataset_id ON public.dataset_files(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_files_category ON public.dataset_files(category);
CREATE INDEX IF NOT EXISTS idx_sar_images_dataset_id ON public.sar_images(dataset_id);
CREATE INDEX IF NOT EXISTS idx_analyses_project_id ON public.analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_analyses_dataset_id ON public.analyses(dataset_id);
CREATE INDEX IF NOT EXISTS idx_spill_detections_analysis_id ON public.spill_detections(analysis_id);
CREATE INDEX IF NOT EXISTS idx_spill_metrics_analysis_id ON public.spill_metrics(analysis_id);
CREATE INDEX IF NOT EXISTS idx_drift_tracks_analysis_id ON public.drift_tracks(analysis_id);
CREATE INDEX IF NOT EXISTS idx_environmental_data_dataset_id ON public.environmental_data(dataset_id);
CREATE INDEX IF NOT EXISTS idx_environmental_data_timestamp ON public.environmental_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_ais_vessels_dataset_id ON public.ais_vessels(dataset_id);
CREATE INDEX IF NOT EXISTS idx_ais_vessels_mmsi ON public.ais_vessels(mmsi);
CREATE INDEX IF NOT EXISTS idx_ais_positions_dataset_id ON public.ais_positions(dataset_id);
CREATE INDEX IF NOT EXISTS idx_ais_positions_vessel_id ON public.ais_positions(vessel_id);
CREATE INDEX IF NOT EXISTS idx_ais_positions_mmsi ON public.ais_positions(mmsi);
CREATE INDEX IF NOT EXISTS idx_ais_positions_timestamp ON public.ais_positions(timestamp);
CREATE INDEX IF NOT EXISTS idx_vessel_tracks_analysis_id ON public.vessel_tracks(analysis_id);
CREATE INDEX IF NOT EXISTS idx_vessel_candidates_analysis_id ON public.vessel_candidates(analysis_id);
CREATE INDEX IF NOT EXISTS idx_vessel_candidates_rank ON public.vessel_candidates(rank);
CREATE INDEX IF NOT EXISTS idx_analysis_events_analysis_id ON public.analysis_events(analysis_id);
CREATE INDEX IF NOT EXISTS idx_reports_analysis_id ON public.reports(analysis_id);

-- ==============================================================================
-- 4. Supabase Storage Buckets
-- ==============================================================================

-- Create Storage Buckets if storage schema exists
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('spillscan-datasets', 'spillscan-datasets', false),
  ('spillscan-sar', 'spillscan-sar', false),
  ('spillscan-results', 'spillscan-results', false),
  ('spillscan-reports', 'spillscan-reports', false)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 5. Row Level Security (RLS) Policies
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sar_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spill_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spill_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drift_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environmental_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ais_vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ais_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vessel_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vessel_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 1) Projects RLS: User can CRUD their own projects or public projects
CREATE POLICY "Users can manage own projects" ON public.projects
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Anon can view public projects" ON public.projects
  FOR SELECT TO anon
  USING (user_id IS NULL);

-- 2) Datasets RLS
CREATE POLICY "Users can manage own datasets" ON public.datasets
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Anon can view public datasets" ON public.datasets
  FOR SELECT TO anon
  USING (user_id IS NULL);

-- 3) Dataset Files RLS
CREATE POLICY "Users can view dataset files" ON public.dataset_files
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = dataset_id AND (d.user_id = auth.uid() OR d.user_id IS NULL)
    )
  );

CREATE POLICY "Anon can view public dataset files" ON public.dataset_files
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = dataset_id AND d.user_id IS NULL
    )
  );

-- 4) Analyses RLS
CREATE POLICY "Users can manage own analyses" ON public.analyses
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND (p.user_id = auth.uid() OR p.user_id IS NULL)
    )
  );

CREATE POLICY "Anon can view analyses" ON public.analyses
  FOR SELECT TO anon
  USING (
    project_id IS NULL OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id IS NULL
    )
  );

-- 5) Cascade Permissions for Detections, Metrics, Drift, AIS, Candidates, Reports, and Events
CREATE POLICY "Access spill detections" ON public.spill_detections
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

CREATE POLICY "Access spill metrics" ON public.spill_metrics
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

CREATE POLICY "Access drift tracks" ON public.drift_tracks
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

CREATE POLICY "Access environmental data" ON public.environmental_data
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

CREATE POLICY "Access ais vessels" ON public.ais_vessels
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

CREATE POLICY "Access ais positions" ON public.ais_positions
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

CREATE POLICY "Access vessel tracks" ON public.vessel_tracks
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

CREATE POLICY "Access vessel candidates" ON public.vessel_candidates
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

CREATE POLICY "Access analysis events" ON public.analysis_events
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

CREATE POLICY "Access reports" ON public.reports
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

CREATE POLICY "Access sar images" ON public.sar_images
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Storage bucket access policies
CREATE POLICY "Allow authenticated and anon select on spillscan buckets" ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (bucket_id IN ('spillscan-datasets', 'spillscan-sar', 'spillscan-results', 'spillscan-reports'));

CREATE POLICY "Allow authenticated insert on spillscan buckets" ON storage.objects
  FOR INSERT TO authenticated, anon
  WITH CHECK (bucket_id IN ('spillscan-datasets', 'spillscan-sar', 'spillscan-results', 'spillscan-reports'));

-- ==============================================================================
-- 6. Seed Data for Instant Manual & Pre-loaded Multi-Region Readiness
-- ==============================================================================

-- Seed Project
INSERT INTO public.projects (id, name, description, status)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Global Maritime Oil Spill Surveillance & Attribution Project',
  'Operational monitoring of major international shipping straits and traffic separation schemes.',
  'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

-- Seed Datasets for Malacca Strait, Persian Gulf, Singapore Strait, North Sea, Gulf of Mexico
INSERT INTO public.datasets (id, project_id, name, original_filename, file_type, file_size, status, total_files, sar_files, ais_files, metadata_files, geo_files, weather_files, ocean_files, geographic_bounds)
VALUES 
(
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Malacca Strait TSS Southbound Sentinel-1A & AIS Corridor Dataset',
  'malacca_strait_s1a_ais_full.zip',
  'ZIP',
  14859200,
  'READY',
  128,
  18,
  12,
  24,
  8,
  36,
  30,
  '{"minLat": 1.80, "maxLat": 3.50, "minLng": 100.80, "maxLng": 103.10}'::jsonb
),
(
  'b0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'Persian Gulf / Strait of Hormuz Tanker Approach Archive',
  'persian_gulf_hormuz_s1b_ais.zip',
  'ZIP',
  9842100,
  'READY',
  94,
  12,
  8,
  18,
  6,
  28,
  22,
  '{"minLat": 25.00, "maxLat": 26.60, "minLng": 54.50, "maxLng": 56.40}'::jsonb
),
(
  'b0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000001',
  'Singapore Strait Eastern Anchorage & Traffic Lane Monitor',
  'singapore_strait_sar_ais_feed.zip',
  'ZIP',
  12480000,
  'READY',
  112,
  16,
  15,
  20,
  5,
  32,
  24,
  '{"minLat": 1.15, "maxLat": 1.45, "minLng": 103.60, "maxLng": 104.20}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Complete.
