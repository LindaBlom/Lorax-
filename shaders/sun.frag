#version 300 es
precision highp float;

in vec2 vUV;
out vec4 outColor;

uniform vec3 uSunColor;

void main() {
    // vUV is 0..1, transform to -1..1
    vec2 p = vUV * 2.0 - 1.0;
    float r = length(p);

    // soft circular disc
    float alpha = smoothstep(1.0, 0.6, r);  // edge from 0.6->1.0
    alpha = clamp(alpha, 0.0, 1.0);

    // fade outside the sun
    if (r > 1.0) {
        alpha = 0.0;
    }

    outColor = vec4(uSunColor, alpha);
}
