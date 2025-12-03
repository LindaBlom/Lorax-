#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec2 aTexCoord;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;

uniform float uSeed;

out vec2 vTexCoord;

float hash(vec2 p) {
    p = vec2(
        dot(p, vec2(127.1, 311.7)),
        dot(p, vec2(269.5, 183.3))
    );
    return fract(sin(p.x + p.y + uSeed) * 43758.5453123);
}

void main() {
    vTexCoord = aTexCoord;

    vec4 worldPos4 = uModel * vec4(aPosition, 1.0);
    vec3 worldPos  = worldPos4.xyz;

    float wave =
        0.3 * sin(worldPos.x * 0.4) *
        cos(worldPos.y * 0.4);

    float n = hash(worldPos.xy * 0.25);
    float noise = (n - 0.5) * 0.4;   // ~[-0.2, 0.2]

    float height = (wave + noise) * 10.0;

    worldPos.z += height;

    gl_Position = uProj * uView * vec4(worldPos, 1.0);
}
