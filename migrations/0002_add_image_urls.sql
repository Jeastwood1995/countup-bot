-- Migration: 0002_add_image_urls.sql
ALTER TABLE trackers ADD COLUMN image_urls TEXT;
