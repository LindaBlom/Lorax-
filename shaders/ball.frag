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
        if (vShellIndex < 0.001) {          // det här är ditt baspass
            vec4 textureColor = texture(uFurTexture, vUV);
            FragColor = vec4(textureColor.rgb, 1.0);
            return;
        }
        const float HAIR_GRID = 10000.0;

        vec2 gridCoord = vUV * HAIR_GRID;
        vec2 cell      = floor(gridCoord);     // heltalscell (vilket hår)
        vec2 cellUV    = fract(gridCoord);


        float hasHair = step(0.90, hash(cell));
        if (hasHair < 0.5)  discard;
        

        float hairLen  = 100000.0;
        float along = vShellIndex;

        if (along > 1.0) discard;
        
        vec2 center  = vec2(0.5);                   
        float dist   = length(cellUV - center);     
        

        float power = pow(along,3.0);
        float baseRadius = 0.5;                    
        float tipRadius  = 0.1; 
        float radius = mix(baseRadius,tipRadius, power);

        float radiusSmoothing = 1.0 - smoothstep(radius * 0.5, radius, dist);

        vec4 tex = texture(uFurTexture, vUV);
        float alpha = tex.a * radiusSmoothing;
      
        if (alpha < 0.05) discard;
        
        vec4 textureColor = texture(uFurTexture, vUV);
        FragColor = vec4(textureColor.rgb, alpha);

    }