-- Users may read only their own avatar files. Uploads/deletes happen exclusively
-- through the server (after validation + renaming), so no insert/update/delete
-- policies are granted to end users.
CREATE POLICY "Users can read their own avatar files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);