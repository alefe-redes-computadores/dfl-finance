import { secureEqual, readBoundedJson } from '../_shared/requestSecurity.ts'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webPush from "npm:web-push"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (!secureEqual(bearer, serviceKey) && !secureEqual(req.headers.get("x-dfl-push-token"), Deno.env.get("DFL_PUSH_SECRET"))) {
    return new Response("Unauthorized", { status: 401 })
  }
  try {
    const body = await readBoundedJson(req, 32 * 1024)
    const notificationId = body.record?.id || body.notification_id

    if (!notificationId) {
      return new Response(JSON.stringify({ error: "notification_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", notificationId)
      .maybeSingle()

    if (notificationError) throw notificationError
    if (!notification) {
      return new Response(JSON.stringify({ error: "Notificação não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: settings } = await supabase
      .from("user_settings")
      .select("preferences")
      .eq("user_id", notification.user_id)
      .maybeSingle()

    const preferences = settings?.preferences && typeof settings.preferences === "object"
      ? settings.preferences
      : {}

    if (preferences.push_notifications === false) {
      return new Response(JSON.stringify({ success: true, skipped: "push_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", notification.user_id)

    if (subscriptionsError) throw subscriptionsError

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ success: true, skipped: "no_subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    webPush.setVapidDetails(
      "mailto:suporte@dflfinance.com",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!
    )

    const payload = JSON.stringify({
      title: notification.title || "DFL Finance",
      body: notification.subtitle || "",
      url: notification.data?.url || "/notifications",
      tag: notification.id,
      type: notification.type || "generic",
      severity: notification.severity || "info",
      notification_id: notification.id,
    })

    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        let claimed = false
        try {
          const claim = await supabase.rpc("dfl_claim_push_delivery", {
            p_notification_id: notification.id, p_subscription_id: sub.id,
          })
          if (claim.error) throw claim.error
          if (!claim.data) return { status: "skipped" }
          claimed = true
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          )

          await supabase.from("finance_push_deliveries").update({ status: "sent", completed_at: new Date().toISOString() })
            .eq("notification_id", notification.id).eq("subscription_id", sub.id)
          return { status: "sent" }
        } catch (error: any) {
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint)
          }

          if (claimed) await supabase.from("finance_push_deliveries").update({ status: "failed" })
            .eq("notification_id", notification.id).eq("subscription_id", sub.id)
          return {
            status: "failed",
            error: error?.statusCode || error?.message || "unknown",
          }
        }
      })
    )

    return new Response(JSON.stringify({ success: true, sent: results.filter((x:any) => x.status === "fulfilled" && x.value.status === "sent").length,
      failed: results.filter((x:any) => x.status === "rejected" || x.value.status === "failed").length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Erro inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
