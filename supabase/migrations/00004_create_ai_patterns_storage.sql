insert into storage.buckets (id, name, public) values ('ai-patterns', 'ai-patterns', true);

create policy "ai_patterns_read" on storage.objects for select to anon, authenticated using (bucket_id = 'ai-patterns');
create policy "ai_patterns_insert" on storage.objects for insert to authenticated with check (bucket_id = 'ai-patterns');