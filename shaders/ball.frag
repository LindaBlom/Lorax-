#version 300 es
precision highp float;

in vec2 vUV;
in float vShellIndex;



uniform sampler2D uFurTexture;
uniform vec3 uLightDir; // Samma solriktning som för gräset

out vec4 FragColor;


void main() {
    
    vec4 tex = texture(uFurTexture, vUV);

    float fade = 1.0 - vShellIndex;
    float alpha = tex.a * fade;

    if (alpha < 0.5) {
        discard;
    }

    vec3 color = tex.rgb;
    FragColor = vec4(color, alpha);
}