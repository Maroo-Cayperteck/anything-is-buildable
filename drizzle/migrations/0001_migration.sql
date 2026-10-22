drop policy "auth read student docs" on storage.objects;
create policy "members read student docs" on storage.objects for select to authenticated
  using (bucket_id = 'student-documents' and (public.has_role(auth.uid(),'student') or public.has_role(auth.uid(),'admin')));
drop policy "students read available docs" on public.documents;
create policy "members read docs" on public.documents for select to authenticated
  using ((is_available and public.has_role(auth.uid(),'student')) or public.has_role(auth.uid(),'admin'));