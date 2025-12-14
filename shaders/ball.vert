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
    vec3 vGravity = vec3(0.0,0.0,-1.0);
    float k = pow(uShellIndex, 2.0);
    float uSpiralTurns = 0.5;

    // vrid runt Z-axeln
    float angle = uSpiralTurns * 6.2831853 * uShellIndex;
    float cosin = cos(angle), sinus = sin(angle);
    mat3 rotZ = mat3(
        cosin, -sinus, 0.0,
        sinus,  cosin, 0.0,
        0.0,0.0,1.0
    );

    vec3 center = vec3(0.0,3.5,0.0 );

    vec3 basePos = aPosition + aNormal * (uShellOffset * uShellIndex);
    vec3 modelPos = rotZ * (basePos-center) + center;
    vec3 worldPos = (uModel * vec4(modelPos, 1.0)).xyz + vGravity * k;

    vUV = aUV;
    vShellIndex = uShellIndex;
    vNormal = mat3(uModel) * (rotZ * aNormal);

    gl_Position = uProj * uView * vec4(worldPos, 1.0);
}
