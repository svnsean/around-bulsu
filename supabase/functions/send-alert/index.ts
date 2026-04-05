// supabase/functions/send-alert/index.ts
// Supabase Edge Function – sends push notifications via Expo Push Service
// No service account or FCM credentials needed.
// Deploy with: supabase functions deploy send-alert

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AlertPayload {
  alertId: string
  title: string
  message: string
  severity: string
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { alertId, title, message, severity } = await req.json() as AlertPayload

    if (!title) {
      throw new Error('Alert title is required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: tokens, error: tokensError } = await supabase
      .from('user_fcm_tokens')
      .select('token')

    if (tokensError) {
      throw new Error(`Failed to fetch tokens: ${tokensError.message}`)
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No devices registered', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build one Expo push message per registered token
    const allMessages = tokens.map(({ token }) => ({
      to: token,
      title: `🚨 ${title}`,
      body: message || 'Emergency alert – open app for details',
      sound: 'default',
      priority: 'high',
      channelId: 'emergency_alerts',
      data: {
        type: 'emergency_alert',
        alertId: alertId || '',
        title,
        message: message || '',
        severity: severity || 'critical',
        sent_at: new Date().toISOString(),
      },
    }))

    let successCount = 0
    let failureCount = 0
    const invalidTokens: string[] = []

    // Expo recommends batches of ≤100
    const BATCH_SIZE = 100
    for (let i = 0; i < allMessages.length; i += BATCH_SIZE) {
      const batch = allMessages.slice(i, i + BATCH_SIZE)
      const batchTokens = tokens.slice(i, i + BATCH_SIZE).map(t => t.token)

      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch),
        })

        if (!response.ok) {
          console.error('Expo push batch HTTP error:', response.status)
          failureCount += batch.length
          continue
        }

        const result = await response.json()
        const receipts: any[] = result.data || []

        receipts.forEach((receipt, idx) => {
          if (receipt.status === 'ok') {
            successCount++
          } else {
            failureCount++
            console.error(`Push failed for token ${batchTokens[idx]?.substring(0, 30)}:`, receipt.message)
            // DeviceNotRegistered = stale token, clean it up
            if (receipt.details?.error === 'DeviceNotRegistered') {
              invalidTokens.push(batchTokens[idx])
            }
          }
        })
      } catch (batchErr) {
        console.error('Batch send error:', batchErr)
        failureCount += batch.length
      }
    }

    // Remove stale tokens so they don't accumulate
    if (invalidTokens.length > 0) {
      await supabase
        .from('user_fcm_tokens')
        .delete()
        .in('token', invalidTokens)
      console.log(`Cleaned up ${invalidTokens.length} stale tokens`)
    }

    if (alertId) {
      await supabase
        .from('alerts')
        .update({ recipient_count: successCount })
        .eq('id', alertId)
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failureCount,
        cleaned: invalidTokens.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending alert:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
