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


void main() {

    vec3 centerModel = vec3(0.0,3.5,0.0 );

    vec3 radial = normalize(aPosition - centerModel);
    vec3 up = vec3(0.0, 0.0, 1.0);
    vec3 tangent = normalize(cross(up, radial));
    if (length(tangent) < 0.01) tangent = normalize(cross(vec3(1.0, 0.0, 0.0), radial));

    vec3 d0 = radial;          
    vec3 d1 = tangent;         
    vec3 d2 = radial;          

    float t = clamp(uShellIndex, 0.0, 1.0);
    // Kvadratisk Bezier: lerp(lerp(d0,d1,t), lerp(d1,d2,t), t)
    vec3 newNormal = mix(mix(d0, d1, t), mix(d1, d2, t), t);
    newNormal = normalize(newNormal);

    vec3 basePos = aPosition + newNormal * (uShellOffset * uShellIndex);
    vec3 worldPos = (uModel * vec4(basePos, 1.0)).xyz;

    vUV = aUV;
    vShellIndex = uShellIndex;
    vNormal = mat3(uModel) * newNormal;

    gl_Position = uProj * uView * vec4(worldPos, 1.0);
}
