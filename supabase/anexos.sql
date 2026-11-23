-- Anexos da equipe dentro da tarefa (briefing, referência, contrato, print, PDF).
-- Rode UMA vez no SQL Editor do Supabase. Cria o bucket privado "anexos" (limite de 50 MB por arquivo, que é o máximo do plano grátis)
-- e libera só quem está logado (a equipe) para ler, enviar e apagar. O cliente (link de aprovação) não tem acesso.
insert into storage.buckets (id, name, public, file_size_limit)
values ('anexos', 'anexos', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "anexos: equipe lê" on storage.objects;
drop policy if exists "anexos: equipe envia" on storage.objects;
drop policy if exists "anexos: equipe apaga" on storage.objects;

create policy "anexos: equipe lê" on storage.objects for select to authenticated using (bucket_id = 'anexos');
create policy "anexos: equipe envia" on storage.objects for insert to authenticated with check (bucket_id = 'anexos');
create policy "anexos: equipe apaga" on storage.objects for delete to authenticated using (bucket_id = 'anexos');
