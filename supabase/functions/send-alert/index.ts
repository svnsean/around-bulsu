// supabase/functions/send-alert/index.ts
// Supabase Edge Function to send FCM push notifications using FCM V1 API
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

// Generate OAuth 2.0 access token from service account
async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + 3600 // 1 hour expiry

  // Create JWT header and payload
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: exp,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  }

  // Base64url encode
  const encode = (obj: any) => btoa(JSON.stringify(obj))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const headerB64 = encode(header)
  const payloadB64 = encode(payload)
  const signatureInput = `${headerB64}.${payloadB64}`

  // Import private key and sign
  const privateKey = serviceAccount.private_key
  const pemHeader = '-----BEGIN PRIVATE KEY-----'
  const pemFooter = '-----END PRIVATE KEY-----'
  const pemContents = privateKey.replace(pemHeader, '').replace(pemFooter, '').replace(/\s/g, '')
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  )

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const jwt = `${signatureInput}.${signatureB64}`

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  })

  const tokenData = await tokenResponse.json()
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`)
  }

  return tokenData.access_token
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { alertId, title, message, severity } = await req.json() as AlertPayload

    if (!title) {
      throw new Error('Alert title is required')
    }

    // Get Service Account JSON from environment
    const serviceAccountJson = Deno.env.get('FCM_SERVICE_ACCOUNT')
    if (!serviceAccountJson) {
      throw new Error('FCM_SERVICE_ACCOUNT not configured')
    }

    const serviceAccount = JSON.parse(serviceAccountJson)
    const projectId = serviceAccount.project_id

    // Get OAuth access token
    const accessToken = await getAccessToken(serviceAccount)

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get all FCM tokens
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

    let successCount = 0
    let failureCount = 0
    const invalidTokens: string[] = []

    // FCM V1 API endpoint
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`

    // Send to each device (V1 API doesn't support batch sending to multiple tokens)
    for (const { token } of tokens) {
      try {
        const fcmResponse = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: token,
              notification: {
                title: `🚨 ${title}`,
                body: message || 'Emergency alert - Open app for details',
              },
              android: {
                priority: 'high',
                notification: {
                  priority: 'max',
                  default_vibrate_timings: true,
                  default_sound: true,
                }
              },
              data: {
                type: 'emergency_alert',
                alertId: alertId || '',
                title: title,
                message: message || '',
                severity: severity || 'critical',
                sent_at: new Date().toISOString(),
              }
            }
          }),
        })

        if (fcmResponse.ok) {
          successCount++
        } else {
          const errorData = await fcmResponse.json()
          console.error(`FCM error for token ${token.substring(0, 20)}...:`, errorData)
          failureCount++
          
          // Check for invalid token errors
          if (errorData.error?.details?.some((d: any) => 
            d.errorCode === 'UNREGISTERED' || d.errorCode === 'INVALID_ARGUMENT'
          )) {
            invalidTokens.push(token)
          }
        }
      } catch (err) {
        console.error(`Error sending to token:`, err)
        failureCount++
      }
    }

    // Clean up invalid tokens
    if (invalidTokens.length > 0) {
      await supabase
        .from('user_fcm_tokens')
        .delete()
        .in('token', invalidTokens)
      
      console.log(`Cleaned up ${invalidTokens.length} invalid tokens`)
    }

    // Update alert with recipient count
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
