#version 300 es
precision highp float;

in vec2 vTexCoord;
out vec4 outColor;

uniform sampler2D uScene;

// How bright something must be (luminance) to bloom.
// Since we're in HDR, this can be > 1.0.
const float threshold      = 1.5;   // try 1.5–3.0
const float bloomIntensity = 1.5;   // how strong the bloom halo is

void main() {
    // HDR scene color
    vec3 base = texture(uScene, vTexCoord).rgb;

    // texel size for blur
    vec2 texel = 1.0 / vec2(
        float(textureSize(uScene, 0).x),
        float(textureSize(uScene, 0).y)
    );

    // Gaussian-ish weights
    float weights[5];
    weights[0] = 0.2270270270;
    weights[1] = 0.1945945946;
    weights[2] = 0.1216216216;
    weights[3] = 0.0540540541;
    weights[4] = 0.0162162162;

    vec3 bloom = vec3(0.0);

    // ---- helper to keep only very bright parts (by luminance) ----
    float lumBase = dot(base, vec3(0.2126, 0.7152, 0.0722));
    vec3 centerBright = (lumBase > threshold) ? base : vec3(0.0);
    bloom += centerBright * weights[0];

    for (int i = 1; i < 5; ++i) {
        vec2 offset = vec2(texel.x * float(i), 0.0);

        vec3 s1 = texture(uScene, vTexCoord + offset).rgb;
        vec3 s2 = texture(uScene, vTexCoord - offset).rgb;

        float lum1 = dot(s1, vec3(0.2126, 0.7152, 0.0722));
        float lum2 = dot(s2, vec3(0.2126, 0.7152, 0.0722));

        if (lum1 > threshold) {
            bloom += s1 * weights[i];
        }
        if (lum2 > threshold) {
            bloom += s2 * weights[i];
        }
    }

    // Combine: base HDR scene + bloom contribution
    vec3 color = base + bloom * bloomIntensity;

    // Clamp to [0,1] for now (no fancy tone mapping yet)
    color = clamp(color, 0.0, 1.0);

    outColor = vec4(color, 1.0);
}
