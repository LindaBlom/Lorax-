#version 300 es
precision highp float;

in vec2 vTexCoord;
in vec3 vNormal;
in vec3 vWorldPos;
in float vShellIndex;

out vec4 outColor;

uniform sampler2D uGrass;
uniform samplerCube uShadowCube;

uniform vec3 uLightPos;
uniform float uShadowFar;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform float uWorldRadius;

float remap01(float x, float a, float b) {
    return clamp((x - a) / (b - a), 0.0, 1.0);
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    // smoothstep curve for interpolation
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash(i + vec2(0.0, 0.0));
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float getHeightForAO(vec2 pos) {
    float wave = 0.5 * sin(pos.x * 0.18) * cos(pos.y * 0.18);
    return wave * 3.0; // no noise here
}

float getHeight(vec2 pos) {
    float wave = 0.5 * sin(pos.x * 0.18) * cos(pos.y * 0.18);

    float n = valueNoise(pos * 0.12);
    float noise = (n - 0.5) * 0.25;

    return (wave + noise) * 3.0;
}

float computeHillAO(vec3 worldPos) {
    // sample spacing in world units (smaller = sharper detail)
    float s = 0.6;

    float hL = getHeightForAO(worldPos.xy + vec2(-s, 0.0));
    float hR = getHeightForAO(worldPos.xy + vec2( s, 0.0));
    float hD = getHeightForAO(worldPos.xy + vec2(0.0, -s));
    float hU = getHeightForAO(worldPos.xy + vec2(0.0,  s));

    // gradient magnitude (how steep the terrain is)
    float dx = (hR - hL) / (2.0 * s);
    float dy = (hU - hD) / (2.0 * s);
    float slope = sqrt(dx*dx + dy*dy);

    // Turn slope into an AO-ish factor:
    // steep areas get a bit darker => hills become readable, but NOT blurry
    float ao = 1.0 - clamp(slope * 0.35, 0.0, 0.35);

    return ao;
}

float computeHillLight(vec3 worldPos) {
    // “sun direction” on the ground plane (like old directional look)
    vec2 dirXY = (uLightPos - worldPos).xy;
    float len2 = max(length(dirXY), 1e-4);
    dirXY /= len2;

    // sample distance in world units (bigger = smoother hills)
    float s = 2.0;

    float h0 = getHeightForAO(worldPos.xy);
    float h1 = getHeightForAO(worldPos.xy - dirXY * s);      // toward “incoming light”
    float h2 = getHeightForAO(worldPos.xy - dirXY * (2.0*s));

    // if terrain rises toward the light => darker (reads as hill shadowing)
    float rise = (h1 - h0) + 0.5*(h2 - h0);

    // map to factor (tweak k + clamp range)
    float k = 0.25;
    return clamp(1.0 - rise * k, 0.65, 1.05);
}

float computePointShadow() {
    vec3 fragToLight = vWorldPos - uLightPos;
    float currentDist = length(fragToLight);
    vec3 dir = fragToLight / max(currentDist, 0.0001);

    // Orthonormal basis around dir (prevents drift / seams bias)
    vec3 up = (abs(dir.z) < 0.999) ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
    vec3 tangent   = normalize(cross(up, dir));
    vec3 bitangent = cross(dir, tangent);

    // Radius controls softness. Bigger = softer but more “washy”
    const float SHADOW_MAP_SIZE = 1024.0;
    float radius = (2.0 / SHADOW_MAP_SIZE) * (0.6 + 0.4 * (currentDist / uShadowFar));;   // ~0.00244
    float bias   = 0.4;      // tweak 0.4..1.0 depending on acne/panning

    vec2 disk[16];
    disk[0]  = vec2( 0.00,  0.00);
    disk[1]  = vec2( 0.35,  0.12);
    disk[2]  = vec2(-0.12,  0.41);
    disk[3]  = vec2(-0.44, -0.14);
    disk[4]  = vec2( 0.15, -0.47);
    disk[5]  = vec2( 0.62, -0.22);
    disk[6]  = vec2(-0.25,  0.70);
    disk[7]  = vec2(-0.72,  0.20);
    disk[8]  = vec2( 0.80,  0.25);
    disk[9]  = vec2( 0.25,  0.85);
    disk[10] = vec2(-0.30, -0.80);
    disk[11] = vec2( 0.75, -0.55);
    disk[12] = vec2(-0.85, -0.35);
    disk[13] = vec2(-0.55,  0.75);
    disk[14] = vec2( 0.10,  0.95);
    disk[15] = vec2(-0.95,  0.05);

    float lit = 0.0;
    for (int i = 0; i < 16; i++) {
        vec3 offset = (tangent * disk[i].x + bitangent * disk[i].y) * radius;
        vec3 sampleDir = normalize(dir + offset);

        float closestDist = texture(uShadowCube, sampleDir).r * uShadowFar;
        lit += (currentDist - bias > closestDist) ? 0.0 : 1.0;
    }

    return lit / 16.0;
}

void main() {
    float distFromCenter = length(vWorldPos.xy);
    if (distFromCenter > uWorldRadius) discard;
    
    vec2 tiledUV = vTexCoord;
    vec4 texColor = texture(uGrass, tiledUV);

    float h01 = remap01(vWorldPos.z, -10.0, 40.0);
    float heightAO = mix(0.8, 1.0, h01);   // same vibe as old shader

    // hill readability term (directional, but driven by point light position)
    float hillLight = computeHillLight(vWorldPos);

    // keep your earlier hillAO if you want, but make it subtle:
    float hillAO = computeHillAO(vWorldPos);         // your slope-based one
    float ao = heightAO * mix(1.0, hillAO, 0.35);    // subtle
    //float hill = mix(1.0, hillLight, 0.25);
    vec3 light = (uAmbientColor + uLightColor) * ao * hillLight;

    float shadow = computePointShadow();
    // in shadow: keep 40% of light, in sun: 100%
    shadow = smoothstep(0.15, 0.95, shadow);    // softer penumbra
    float shadowMin = 0.72;                     // was 0.55
    light *= mix(shadowMin, 1.0, shadow);
    //light *= mix(0.55, 1.0, shadow);

    float n = valueNoise(vWorldPos.xz * 0.05);      // 0.05 = big patches, 0.2 = smaller
    float tint = mix(0.94, 1.06, n);         // keep it close to 1.0

    vec3 finalColor = texColor.rgb * tint * light;

    float edge = uWorldRadius - 3.0;          // start fading 3 units before the edge
    float t = clamp((distFromCenter - edge) / 3.0, 0.0, 1.0);
    vec3 fogColor = vec3(0.45, 0.75, 1.0);
    finalColor = mix(finalColor, fogColor, t);

    // FLUFFY GRASS
    float alpha;
    if(vShellIndex > 0.001){

        const float HAIR_GRID = 100.0;

        vec2 gridCoord =  vTexCoord * HAIR_GRID;
        vec2 cell      = floor(gridCoord);     
        vec2 cellUV    = fract(gridCoord);
        // en step function med step vid 0.90
        // om hash(cell) < step returneras 0
        float hasHair = step(0.95, hash(cell));
        if (hasHair < 0.5)  discard;   
        vec2 center = vec2(0.5, 0.5);               
        float dist  = length(cellUV - center);

        float baseRadius = 0.1;                    
        float tipRadius  = 0.001; 

        float radius = mix(baseRadius,tipRadius, pow(vShellIndex,4.0));
        alpha = 1.0 - smoothstep(radius * 0.5, radius, dist);

    } else 
        alpha = texColor.a;
    


    outColor = vec4(finalColor, alpha);
}
