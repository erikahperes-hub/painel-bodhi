-- Leitura automática do Instagram (agendamento do Supabase). Cole no SQL Editor e clique em Run. Pode rodar de novo.
-- Rode depois do instagram.sql e depois de publicar a função "instagram".
--
-- Duas rotinas (horários em UTC; Brasília = UTC menos 3 horas):
--  * ig-stories: de hora em hora (aos 5 minutos) copia os stories ativos (com os números mais recentes) para a tabela ig_stories.
--    O Instagram só guarda cada story por 24 horas; sem isso eles seriam perdidos para o relatório.
--  * ig-mes: todo dia, às 05:30 em Brasília, atualiza os números do mês atual e do mês anterior de cada cliente conectado.
-- Se uma leitura falhar, o motivo aparece no painel (aba Relatório e sino de alertas).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Recria as rotinas (se já existiam, troca pelas novas).
do $$
begin
  perform cron.unschedule(jobname) from cron.job where jobname in ('ig-stories', 'ig-mes');
end $$;

select cron.schedule('ig-stories', '5 * * * *', $job$
  select net.http_post(
    url := 'https://dmxycyxqfxzmotnlyixz.supabase.co/functions/v1/instagram',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', (select chave from public.ig_cron limit 1)),
    body := '{"acao":"cron-stories"}'::jsonb,
    timeout_milliseconds := 120000);
$job$);

select cron.schedule('ig-mes', '30 8 * * *', $job$
  select net.http_post(
    url := 'https://dmxycyxqfxzmotnlyixz.supabase.co/functions/v1/instagram',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', (select chave from public.ig_cron limit 1)),
    body := '{"acao":"cron-mes"}'::jsonb,
    timeout_milliseconds := 120000);
$job$);
