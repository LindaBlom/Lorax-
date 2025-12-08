#version 300 es
precision highp float;

in vec2 vTexCoord;
out vec4 outColor;

uniform sampler2D uScene;

// simple 1D gaussian-ish weights
const float threshold = 0.9;      // how bright something must be to bloom
const float bloomIntensity = 1.5; // overall bloom strength

void main() {
    // base scene color
    vec3 base = texture(uScene, vTexCoord).rgb;

    // pixel size in texture space
    vec2 texel = 1.0 / vec2(textureSize(uScene, 0));

    // gaussian weights for 9 taps (0..4)
    float weights[5];
    weights[0] = 0.227027;
    weights[1] = 0.1945946;
    weights[2] = 0.1216216;
    weights[3] = 0.054054;
    weights[4] = 0.016216;

    vec3 bloom = vec3(0.0);

    // center sample
    vec3 c = texture(uScene, vTexCoord).rgb;
    c = max(c - vec3(threshold), vec3(0.0));  // bright-pass
    bloom += c * weights[0];

    // blur horizontally – good enough for a nice glow
    for (int i = 1; i < 5; ++i) {
        vec2 offset = vec2(texel.x * float(i), 0.0);

        vec3 c1 = texture(uScene, vTexCoord + offset).rgb;
        vec3 c2 = texture(uScene, vTexCoord - offset).rgb;

        c1 = max(c1 - vec3(threshold), vec3(0.0));
        c2 = max(c2 - vec3(threshold), vec3(0.0));

        bloom += (c1 + c2) * weights[i];
    }

    vec3 color = base + bloom * bloomIntensity;
    outColor = vec4(color, 1.0);
}
