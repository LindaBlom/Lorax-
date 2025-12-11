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

void main() {
    float distFromCenter = length(vWorldPos.xy);
    if (distFromCenter > uWorldRadius) {
        discard;
    }

    vec2 tiledUV = vTexCoord;  // vTexCoord already goes 0→5, so it tiles
    vec4 texColor = texture(uGrass, tiledUV);

    // simple Lambert shading
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);   // from surface TO sun

    float diff = dot(N, L) * 0.5 + 0.5;
    diff = clamp(diff, 0.0, 1.0);

    vec3 light = uAmbientColor + uLightColor * diff;

    vec3 finalColor = texColor.rgb * light;

    float edge = uWorldRadius - 3.0;          // start fading 3 units before the edge
    float t = clamp((distFromCenter - edge) / 3.0, 0.0, 1.0);
    vec3 fogColor = vec3(0.45, 0.75, 1.0);
    finalColor = mix(finalColor, fogColor, t);

    outColor = vec4(finalColor, texColor.a);
}
