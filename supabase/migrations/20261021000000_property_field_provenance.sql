-- Per-field provenance for property data: which source set each value, when, and with what confidence.
-- Shape: { "<field>": { "source": text, "confidence": 0..1, "retrievedAt": iso8601 } }
-- properties.provenance remains the record-level source (import/manual); this adds the field-level view.
alter table public.properties
  add column if not exists field_provenance jsonb not null default '{}'::jsonb;
