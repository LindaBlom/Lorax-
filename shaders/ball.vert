#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal; 
layout(location = 2) in vec2 aUV;  

uniform mat4 uModel, uView, uProj;

uniform float uShellOffset;
uniform float uShellIndex;
uniform float uTime;


out vec2 vUV;
out float vShellIndex;
out vec3 vNormal;
out vec3 vWorldPos;

void main() {
    vec3 centerModel = vec3(0.1, 3.5, 0.1);

    vec3 radius = normalize(aPosition - centerModel);
    vec3 up = vec3(0.0, 0.0, 1.0);
    vec3 tangent = normalize(cross(up, radius));
    if (length(tangent) < 0.01) tangent = normalize(cross(vec3(1.0, 0.0, 0.0), radius));

    // Bezier
    vec3 d0 = radius;          
    vec3 d1 = tangent;         
    vec3 d2 = normalize(radius + tangent * 0.8);       

    float t = uShellIndex;
    // Bezier   
    vec3 newNormal = mix(mix(d0, d1, t), mix(d1, d2, t), t);
    newNormal = normalize(newNormal);

    // Tip Boost
    float tipsBoost = 1.5;                      
    float lenMul = 1.0 + tipsBoost * (1.0 - abs(radius.z));

    vec3 basePos = aPosition + newNormal * (uShellOffset * uShellIndex* lenMul);
    vec3 worldPos = (uModel * vec4(basePos, 1.0)).xyz;

    // Sway
    vec2 windDir = normalize(vec2(1.0,1.0));
    float phase = dot(worldPos.xy, windDir * 0.01) + uTime * 0.0015;
    float sway  = sin(phase) * 0.5;
    vec2 offset =  windDir * sway;
    worldPos += vec3(offset, 1.0);
    

    vUV = aUV;
    vShellIndex = uShellIndex;
    vNormal = mat3(uModel) * newNormal;
    vWorldPos = worldPos;

    gl_Position = uProj * uView * vec4(worldPos, 1.0);
}