#version 300 es
precision highp float;

in vec2 vUV;

uniform sampler2D uStemTexture;
//uniform vec3 uLightDir; // Samma solriktning som för gräset

out vec4 FragColor;


void main() {
    
    vec4 textureColor = texture(uStemTexture, vUV);
    FragColor = vec4(textureColor.rgb, 1.0);
}