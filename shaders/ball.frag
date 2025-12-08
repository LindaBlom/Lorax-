#version 300 es
precision highp float;

in vec2 vUV;
in float vShellIndex;
in vec3 vNormal;



uniform sampler2D uFurTexture;
uniform vec3 uLightDir; // Samma solriktning som för gräset

out vec4 FragColor;


float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}


void main() {
    const float HAIR_GRID = 1000.0;

    vec2 gridCoord = vUV * HAIR_GRID;
    vec2 cell      = floor(gridCoord);     // heltalscell (vilket hår)
    vec2 cellUV    = fract(gridCoord);


    float hasHair = step(0.90, hash(cell));
    if (hasHair < 0.5)  discard;
    

    float hairLen  = 10000.0;
    float along = vShellIndex / hairLen;

    if (along > 100.0) discard;
    
    vec2 center  = vec2(0.5);                   
    float dist   = length(cellUV - center);     
    
    float baseRadius = 0.5;                    
    float radius     = baseRadius * (1.0 - along); 


    float radiusSmoothing = 1.0 - smoothstep(radius * 0.5, radius, dist);


    vec4 tex = texture(uFurTexture, vUV);

    float alpha = tex.a * radiusSmoothing;

    // kasta bort väldigt tunna fragment
    if (alpha < 0.05) discard;
    
   
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    float NdotL = max(dot(N, L), 0.0);

    float ambient = 0.5;
    float diffuse = 0.7 * NdotL;

    vec3 color = tex.rgb * (ambient + diffuse);

    FragColor = vec4(color, alpha);
}