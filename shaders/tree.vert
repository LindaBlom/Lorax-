#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal; // Vi behöver normaler för ljus senare
layout(location = 2) in vec3 aColor;  // Färg per vertex (brunt för stam, grönt för löv)

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;

out vec3 vColor;
out vec3 vNormal;

void main() {
    vColor = aColor;
    vNormal = mat3(transpose(inverse(uModel))) * aNormal; // Korrekt normal-transform
    gl_Position = uProj * uView * uModel * vec4(aPosition, 1.0);
}
