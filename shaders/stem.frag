#version 300 es
precision highp float;

in vec2 vUV;
in vec3 vNormal;   // <-- comes from stem.vert

uniform sampler2D uStemTexture;
uniform vec3 uLightDir;      // direction *from* the light (same as grass)
uniform vec3 uLightColor;    // direct sunlight color
uniform vec3 uAmbientColor;  // ambient/sky light

out vec4 FragColor;

void main() {
    // Base texture
    vec4 tex = texture(uStemTexture, vUV);
    if (tex.a < 0.01) {
        discard;
    }

    // Lighting
    vec3 N = normalize(vNormal);
    // If uLightDir is “direction the light travels”, we want opposite
    vec3 L = normalize(uLightDir);

    float NdotL = max(dot(N, L), 0.0);

    // Simple Lambert + ambient
    vec3 litColor = tex.rgb * (uAmbientColor + uLightColor * NdotL);

    FragColor = vec4(litColor, tex.a);
}
