#version 300 es
precision highp float;

in vec2 vUV;
in vec3 vNormal;
in vec3 vWorldPos;

uniform sampler2D uStemTexture;
uniform vec3 uLightPos;
uniform vec3 uLightColor;   
uniform vec3 uAmbientColor;

out vec4 FragColor;

void main() {
    // Base texture
    vec4 tex = texture(uStemTexture, vUV);
    if (tex.a < 0.01) {
        discard;
    }

    // Lighting
    vec3 N = normalize(vNormal);
    vec3 toLight = uLightPos - vWorldPos;
    float dist = length(toLight);
    vec3 L = toLight / max(dist, 0.0001);
    float NdotL = max(dot(N, L), 0.0);

    // Simple Lambert + ambient
    vec3 color = tex.rgb * (uAmbientColor + uLightColor * NdotL);

    FragColor = vec4(color, tex.a);
}