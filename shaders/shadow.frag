#version 300 es
precision highp float;

in vec3 vWorldPos;

uniform vec3 uLightPos;
uniform float uShadowFar;

out vec4 outColor;

void main() {
    float dist = length(vWorldPos - uLightPos);  // world units
    float depth = dist / uShadowFar;             // normalize to 0..1
    outColor = vec4(depth, 0.0, 0.0, 1.0);       // store in red channel
}