#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal; 
layout(location = 2) in vec2 aUV;  

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;

out vec3 vNormal;
out vec2 vUV;

void main() {
    vUV = aUV;
    vNormal = mat3(transpose(inverse(uModel))) * aNormal; // Korrekt normal-transform
    gl_Position = uProj * uView * uModel * vec4(aPosition, 1.0);
}
