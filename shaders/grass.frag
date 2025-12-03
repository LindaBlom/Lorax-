#version 300 es
precision highp float;

in vec2 vTexCoord;
in vec3 vNormal;
in vec3 vWorldPos;

out vec4 outColor;

uniform sampler2D uGrass;

void main() {
    vec2 tiledUV = vTexCoord;  // vTexCoord already goes 0→5, so it tiles
    vec4 texColor = texture(uGrass, tiledUV);
    outColor = texColor;
}
