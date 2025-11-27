#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec2 aTexCoord;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;

out vec2 vTexCoord;

void main() {
    vTexCoord = aTexCoord;

    float height =
        0.3 * sin(aPosition.x * 0.4) *
        cos(aPosition.y * 0.4);

    vec3 displaced = vec3(aPosition.x, aPosition.y, aPosition.z + height);

    gl_Position = uProj * uView * uModel * vec4(aPosition, 1.0);
}
