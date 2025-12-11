#version 300 es
// eller mediump
precision highp float;

in vec2 vTexCoord;
in vec3 vNormal;
in vec3 vWorldPos;

out vec4 outColor;

uniform sampler2D uGrass;

/* --- NEW: sun + ambient --- */
uniform vec3 uLightDir;     // direction FROM world towards the sun
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform float uWorldRadius;

float remap01(float x, float a, float b) {
    return clamp((x - a) / (b - a), 0.0, 1.0);
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
    float distFromCenter = length(vWorldPos.xy);
    if (distFromCenter > uWorldRadius) {
        discard;
    }

    vec2 tiledUV = vTexCoord;
    vec4 texColor = texture(uGrass, tiledUV);

    // simple Lambert (your version)
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);

    float diff = dot(N, L) * 0.5 + 0.5;
    diff = clamp(diff, 0.0, 1.0);

    vec3 light = uAmbientColor + uLightColor * diff;

    // --- NEW: very soft “AO” based on height ---
    // adjust -10.0 and 40.0 if your terrain is higher/lower
    float h01 = remap01(vWorldPos.z, -10.0, 40.0);
    float ao  = mix(0.8, 1.0, h01);   // 0.8 in valleys, 1.0 on peaks
    light *= ao;

    float n = hash(vWorldPos.xz * 0.05);      // 0.05 = big patches, 0.2 = smaller
    float tint = mix(0.94, 1.06, n);         // keep it close to 1.0

    vec3 finalColor = texColor.rgb * tint * light;

    float edge = uWorldRadius - 3.0;          // start fading 3 units before the edge
    float t = clamp((distFromCenter - edge) / 3.0, 0.0, 1.0);
    vec3 fogColor = vec3(0.45, 0.75, 1.0);
    finalColor = mix(finalColor, fogColor, t);

    outColor = vec4(finalColor, texColor.a);
}
