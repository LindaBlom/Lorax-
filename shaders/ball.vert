#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal; 
layout(location = 2) in vec2 aUV;  

uniform mat4 uModel, uView, uProj;

uniform float uShellOffset;
uniform float uShellIndex;

out vec2 vUV;
out float vShellIndex;

void main() {
    vec3 displaced = aPosition + aNormal * uShellOffset * uShellIndex;
    vUV = aUV* 10.0;
    vShellIndex = uShellIndex; 
    gl_Position = uProj * uView * uModel * vec4(displaced, 1.0);
}
