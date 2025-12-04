#version 300 es
precision highp float;

in vec3 vColor;
in vec3 vNormal;

out vec4 FragColor;

uniform vec3 uLightDir; // Samma solriktning som för gräset

void main() {
    // Enkel ljusberäkning (Lambertian)
    vec3 normal = normalize(vNormal);
    float diff = max(dot(normal, normalize(uLightDir)), 0.2); // 0.2 är ambient ljus
    
    vec3 finalColor = vColor * diff;
    FragColor = vec4(finalColor, 1.0);
}