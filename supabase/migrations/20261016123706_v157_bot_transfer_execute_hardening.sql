-- DFL Finance V157
-- bot_record_transfer é RPC server-only.
-- O webhook usa service_role; clientes anon/authenticated não precisam executá-lo.
-- Não altera corpo, assinatura ou semântica financeira da função.

revoke execute on function public.bot_record_transfer(
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  uuid,
  date
) from public;

revoke execute on function public.bot_record_transfer(
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  uuid,
  date
) from anon;

revoke execute on function public.bot_record_transfer(
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  uuid,
  date
) from authenticated;

grant execute on function public.bot_record_transfer(
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  uuid,
  date
) to service_role;
