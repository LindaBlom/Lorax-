#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;

uniform mat4 uModel;
uniform mat4 uLightVP;
uniform float uSeed;

out vec3 vWorldPos;

float hash(vec2 p) {
    p = vec2(
        dot(p, vec2(127.1, 311.7)),
        dot(p, vec2(269.5, 183.3))
    );
    return fract(sin(p.x + p.y + uSeed) * 43758.5453123);
}

float getHeight(vec2 pos) {
    float wave =
        0.5 * sin(pos.x * 0.18) *
        cos(pos.y * 0.18);

    float n = hash(pos * 0.12);
    float noise = (n - 0.5) * 0.25;

    float height = (wave + noise) * 3.0;
    return height;
}

void main() {
    vec4 worldPos4 = uModel * vec4(aPosition, 1.0);
    vec3 worldPos = worldPos4.xyz;

    // keep your grass heightfield casting
    float height = getHeight(worldPos.xy);
    worldPos.z += height;

    vWorldPos = worldPos;
    gl_Position = uLightVP * vec4(worldPos, 1.0);
}