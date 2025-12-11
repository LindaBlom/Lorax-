#version 300 es
precision highp float;

in vec2 vTexCoord;
in vec3 vNormal;
in vec3 vWorldPos;
in vec4 vLightSpacePos;

out vec4 outColor;

uniform sampler2D uGrass;
uniform sampler2D uShadowMap;
uniform vec2 uShadowTexelSize;

uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform float uWorldRadius;

float remap01(float x, float a, float b) {
    return clamp((x - a) / (b - a), 0.0, 1.0);
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float computeShadowFactor() {
    // perspective divide
    vec3 projCoords = vLightSpacePos.xyz / vLightSpacePos.w;
    // to [0,1]
    projCoords = projCoords * 0.5 + 0.5;

    // outside shadow map? treat as lit
    if (projCoords.x < 0.0 || projCoords.x > 1.0 ||
        projCoords.y < 0.0 || projCoords.y > 1.0) {
        return 1.0;
    }

    float currentDepth = projCoords.z;
    float bias = 0.002;

    float shadow = 0.0;
    // 9x9 PCF (softens shadow, cost = 81 texture samples)
    for (int x = -4; x <= 4; x++) {
        for (int y = -4; y <= 4; y++) {
            vec2 offset = vec2(float(x), float(y)) * uShadowTexelSize;
            float pcfDepth = texture(uShadowMap, projCoords.xy + offset).r;
            shadow += (currentDepth - bias > pcfDepth) ? 0.0 : 1.0;
        }
    }
    shadow /= 81.0;
    return shadow;
}

void main() {
    float distFromCenter = length(vWorldPos.xy);
    if (distFromCenter > uWorldRadius) {
        discard;
    }

    vec2 tiledUV = vTexCoord;
    vec4 texColor = texture(uGrass, tiledUV);

    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);

    float diff = dot(N, L) * 0.5 + 0.5;
    diff = clamp(diff, 0.0, 1.0);

    vec3 light = uAmbientColor + uLightColor * diff;

    float h01 = remap01(vWorldPos.z, -10.0, 40.0);
    float ao  = mix(0.8, 1.0, h01);   // 0.8 in valleys, 1.0 on peaks
    light *= ao;

    float shadow = computeShadowFactor();
    // in shadow: keep 40% of light, in sun: 100%
    light *= mix(0.4, 1.0, shadow);

    float n = hash(vWorldPos.xz * 0.05);      // 0.05 = big patches, 0.2 = smaller
    float tint = mix(0.94, 1.06, n);         // keep it close to 1.0

    vec3 finalColor = texColor.rgb * tint * light;

    float edge = uWorldRadius - 3.0;          // start fading 3 units before the edge
    float t = clamp((distFromCenter - edge) / 3.0, 0.0, 1.0);
    vec3 fogColor = vec3(0.45, 0.75, 1.0);
    finalColor = mix(finalColor, fogColor, t);

    outColor = vec4(finalColor, texColor.a);
}
