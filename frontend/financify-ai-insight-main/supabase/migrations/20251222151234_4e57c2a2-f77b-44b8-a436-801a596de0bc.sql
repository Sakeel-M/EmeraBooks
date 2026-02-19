-- First, delete any duplicate connections keeping only the most recent per user/type
DELETE FROM public.connections
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, connection_type) id
  FROM public.connections
  ORDER BY user_id, connection_type, updated_at DESC NULLS LAST
);

-- Add unique constraint on (user_id, connection_type) to enable upsert
ALTER TABLE public.connections 
ADD CONSTRAINT connections_user_id_connection_type_key 
UNIQUE (user_id, connection_type);