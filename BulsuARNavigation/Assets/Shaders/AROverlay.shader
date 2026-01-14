// Assets/Shaders/AROverlay.shader
Shader "Custom/AROverlay"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Color ("Color", Color) = (0, 0.8, 1, 1)
        _EmissionColor ("Emission Color", Color) = (0, 0.8, 1, 1)
        _EmissionIntensity ("Emission Intensity", Range(0, 5)) = 2
        _FresnelPower ("Fresnel Power", Range(0.1, 5)) = 2
        _PulseSpeed ("Pulse Speed", Range(0, 10)) = 2
    }
    
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent" }
        LOD 100
        Blend SrcAlpha OneMinusSrcAlpha
        ZWrite Off
        Cull Back
        
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            
            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
                float3 normal : NORMAL;
            };
            
            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 vertex : SV_POSITION;
                float3 worldNormal : TEXCOORD1;
                float3 viewDir : TEXCOORD2;
            };
            
            sampler2D _MainTex;
            float4 _MainTex_ST;
            float4 _Color;
            float4 _EmissionColor;
            float _EmissionIntensity;
            float _FresnelPower;
            float _PulseSpeed;
            
            v2f vert (appdata v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.uv, _MainTex);
                o.worldNormal = UnityObjectToWorldNormal(v.normal);
                o.viewDir = normalize(WorldSpaceViewDir(v.vertex));
                return o;
            }
            
            fixed4 frag (v2f i) : SV_Target
            {
                // Base texture
                fixed4 tex = tex2D(_MainTex, i.uv);
                
                // Fresnel effect (edge glow)
                float fresnel = pow(1.0 - saturate(dot(i.worldNormal, i.viewDir)), _FresnelPower);
                
                // Pulse animation
                float pulse = 0.8 + 0.2 * sin(_Time.y * _PulseSpeed);
                
                // Combine
                fixed4 col = _Color * tex;
                col.rgb += _EmissionColor.rgb * _EmissionIntensity * fresnel * pulse;
                col.a = _Color.a * (0.6 + 0.4 * fresnel);
                
                return col;
            }
            ENDCG
        }
    }
}