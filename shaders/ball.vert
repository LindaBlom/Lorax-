#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal; 
layout(location = 2) in vec2 aUV;  

uniform mat4 uModel, uView, uProj;

uniform float uShellOffset;
uniform float uShellIndex;

out vec2 vUV;
out float vShellIndex;
out vec3 vNormal;
void main() {

    vec3 vGravity = vec3(-0.0,0.0,-1.0);
    // Om gravity är lokal
    //vec3 worldPos = (uModel * vec4(vGravity,0.0)).xyz;
    float k =  pow(uShellIndex, 3.0);

    // förskjutning av skal utåt längst med normalen

    vec3 modelPos = aPosition + aNormal * (uShellOffset * uShellIndex);
    // Till värld + böjning
    vec3 worldPos = (uModel * vec4(modelPos, 1.0)).xyz + vGravity * k;

    vUV = aUV;
    vShellIndex = uShellIndex;
    vNormal = mat3(uModel) * aNormal;

    gl_Position = uProj * uView * vec4(worldPos, 1.0);
}
