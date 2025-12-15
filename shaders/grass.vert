#version 300 es

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec2 aTexCoord;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;

uniform float uSeed;

out vec2 vTexCoord;
out vec3 vWorldPos;
out vec3 vNormal;

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
    float noise = (n - 0.5) * 0.25;   // ~[-0.2, 0.2]

    float height = (wave + noise) * 3.0;
    return height;
}

void main() {
    vTexCoord = aTexCoord;

    vec4 worldPos4 = uModel * vec4(aPosition, 1.0);
    vec3 worldPos  = worldPos4.xyz;

    // original height logic, now via getHeight()
    float height = getHeight(worldPos.xy);
    worldPos.z += height;

    /* --- NEW: approximate normal from height field --- */
    float eps = 0.1;
    float hL = getHeight(worldPos.xy - vec2(eps, 0.0));
    float hR = getHeight(worldPos.xy + vec2(eps, 0.0));
    float hD = getHeight(worldPos.xy - vec2(0.0, eps));
    float hU = getHeight(worldPos.xy + vec2(0.0, eps));

    vec3 dx = vec3(2.0 * eps, 0.0, hR - hL);
    vec3 dy = vec3(0.0, 2.0 * eps, hU - hD);
    
    vec3 normal = normalize(cross(dy, dx));

    vWorldPos = worldPos;
    vNormal   = normal;

    gl_Position = uProj * uView * vec4(worldPos, 1.0);
}
