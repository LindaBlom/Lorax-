#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal; 
layout(location = 2) in vec2 aUV;  

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;
uniform float uTime;

uniform float uStemBaseZ;
uniform float uStemTopZ;

out vec3 vNormal;
out vec2 vUV;
out vec3 vWorldPos;

void main() {
    vUV = aUV;
    vNormal = normalize(aNormal);
    vec4 worldPos = uModel * vec4(aPosition, 1.0);


    vec2 windDir = normalize(vec2(1.0,1.0));
    float phase = dot(worldPos.xy, windDir * 0.01) + uTime * 0.0015;
    float sway  = sin(phase) * 0.5;
    // (x-min)/(max-min) 
    // måste va positiv för clamp
    float mulBend = clamp((worldPos.z - uStemBaseZ) / max(0.0001, (uStemTopZ - uStemBaseZ)), 0.0, 1.0);
    //mulBend = pow(mulBend,3.0);
    vec2 offset =  windDir * sway * mulBend; 
    
    worldPos.xyz += vec3(offset, 1.0);


    vWorldPos = worldPos.xyz;
    gl_Position = uProj * uView * worldPos;
}