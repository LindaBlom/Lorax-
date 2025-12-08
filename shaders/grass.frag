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
    float r2 = dot(vWorldPos.xy, vWorldPos.xy);
    float R2 = uWorldRadius * uWorldRadius;
    if (r2 > R2) {
        discard;   // don't draw this pixel at all
    }

    vec2 tiledUV = vTexCoord;  // vTexCoord already goes 0→5, so it tiles
    vec4 texColor = texture(uGrass, tiledUV);

    // simple Lambert shading
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);   // from surface TO sun

    float diff = dot(N, L) * 0.5 + 0.5;
    diff = clamp(diff, 0.0, 1.0);
    
    vec3 light = uAmbientColor + uLightColor * diff;

    outColor = vec4(texColor.rgb * light, texColor.a);
}
