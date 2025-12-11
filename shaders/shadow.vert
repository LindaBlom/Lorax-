#version 300 es
layout(location = 0) in vec3 aPosition;

uniform mat4 uModel;
uniform mat4 uLightVP;

void main() {
    gl_Position = uLightVP * uModel * vec4(aPosition, 1.0);
}