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

    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash(i + vec2(0.0, 0.0));
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float getHeightForAO(vec2 pos) {
    float wave = 0.5 * sin(pos.x * 0.18) * cos(pos.y * 0.18);
    return wave * 3.0;
}

float getHeight(vec2 pos) {
    float wave = 0.5 * sin(pos.x * 0.18) * cos(pos.y * 0.18);

    float n = valueNoise(pos * 0.12);
    float noise = (n - 0.5) * 0.25;

    return (wave + noise) * 3.0;
}

float computeHillAO(vec3 worldPos) {
    float s = 0.6;

    float hL = getHeightForAO(worldPos.xy + vec2(-s, 0.0));
    float hR = getHeightForAO(worldPos.xy + vec2( s, 0.0));
    float hD = getHeightForAO(worldPos.xy + vec2(0.0, -s));
    float hU = getHeightForAO(worldPos.xy + vec2(0.0,  s));

    float dx = (hR - hL) / (2.0 * s);
    float dy = (hU - hD) / (2.0 * s);
    float slope = sqrt(dx*dx + dy*dy);

    float ao = 1.0 - clamp(slope * 0.35, 0.0, 0.35);

    return ao;
}

float computeHillLight(vec3 worldPos) {
    vec2 dirXY = (uLightPos - worldPos).xy;
    float len2 = max(length(dirXY), 1e-4);
    dirXY /= len2;

    float s = 2.0;

    float h0 = getHeightForAO(worldPos.xy);
    float h1 = getHeightForAO(worldPos.xy - dirXY * s);    
    float h2 = getHeightForAO(worldPos.xy - dirXY * (2.0*s));

    float rise = (h1 - h0) + 0.5*(h2 - h0);

    float k = 0.25;
    return clamp(1.0 - rise * k, 0.65, 1.05);
}

float computePointShadow() {
    vec3 fragToLight = vWorldPos - uLightPos;
    float currentDist = length(fragToLight);
    vec3 dir = fragToLight / max(currentDist, 0.0001);

    vec3 up = (abs(dir.z) < 0.999) ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
    vec3 tangent   = normalize(cross(up, dir));
    vec3 bitangent = cross(dir, tangent);

    const float SHADOW_MAP_SIZE = 1024.0;
    float radius = (2.0 / SHADOW_MAP_SIZE) * (0.6 + 0.4 * (currentDist / uShadowFar));
    float bias   = 0.4;

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
    float heightAO = mix(0.8, 1.0, h01);

    float hillLight = computeHillLight(vWorldPos);

    float hillAO = computeHillAO(vWorldPos);
    float ao = heightAO * mix(1.0, hillAO, 0.35);
    vec3 light = (uAmbientColor + uLightColor) * ao * hillLight;

    float shadow = computePointShadow();
    shadow = smoothstep(0.15, 0.95, shadow);  
    float shadowMin = 0.72;                   
    light *= mix(shadowMin, 1.0, shadow);

    float n = valueNoise(vWorldPos.xz * 0.05);    
    float tint = mix(0.94, 1.06, n);       

    vec3 finalColor = texColor.rgb * tint * light;

    float edge = uWorldRadius - 3.0; 
    float t = clamp((distFromCenter - edge) / 3.0, 0.0, 1.0);
    vec3 fogColor = vec3(0.45, 0.75, 1.0);
    finalColor = mix(finalColor, fogColor, t);

    // FLUFFY GRASS
    float alpha;
    if(vShellIndex > 0.001){

        const float HAIR_GRID = 500.0;

        vec2 gridCoord =  vTexCoord * HAIR_GRID;
        vec2 cell      = floor(gridCoord);     
        vec2 cellUV    = fract(gridCoord);
        // en step function med step vid 0.90
        // om hash(cell) < step returneras 0
        float hasHair = step(0.90, hash(cell));
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