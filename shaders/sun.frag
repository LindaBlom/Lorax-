#version 300 es
precision highp float;

in vec2 vUV;
out vec4 outColor;

uniform vec3 uSunColor;

void main() {
    vec2 p = vUV * 2.0 - 1.0;
    float r = length(p);

    float alpha = smoothstep(1.0, 0.6, r);
    alpha = clamp(alpha, 0.0, 1.0);

    if (r > 1.0) {
        alpha = 0.0;
    }

    vec3 HDRColor = uSunColor * alpha * 5.0;

    outColor = vec4(HDRColor, alpha);
}