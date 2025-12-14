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
        // Första skalet.
        // Ingen shading här endast textur.
        float alpha;
        if (vShellIndex < 0.001) {   
            vec4 textureColor = texture(uFurTexture, vUV);
            FragColor = vec4(textureColor.rgb, 1.0);
            alpha = textureColor.a;
        } else {
            // Proceduralt hårmönster
            const float HAIR_GRID = 500.0;

            // uv på tekturen gånger antal grids vi har
            vec2 gridCoord = vUV * HAIR_GRID;
            vec2 cell      = floor(gridCoord);     // heltalscell (vilket hår)
            vec2 cellUV    = fract(gridCoord);
            // en step function med step vid 0.90
            // om hash(cell) < step returneras 0
            float hasHair = step(0.90, hash(cell));

            if (hasHair < 0.5)  discard;
            if (vShellIndex > 1.0) discard;

            vec2 center  = vec2(0.5);                   
            float dist   = length(cellUV - center);     

            float baseRadius = 0.5;                    
            float tipRadius  = 0.1; 
            float radius = mix(baseRadius,tipRadius, pow(vShellIndex,3.0));
            alpha = 1.0 - smoothstep(radius * 0.5, radius, dist);
            if (alpha < 0.05) discard;
        }



    // LET THERE BE LIGHT
        vec3 uAmbientColor = vec3(0.45, 0.55, 0.70); // Mjukare ambient ljus för päls
        vec3 uLightColor = vec3(0.94, 0.75, 0.02); // Varmare solljus för päls


        vec3 N = normalize(vNormal);
        vec3 L = normalize(uLightDir);
        float NdotL = max(dot(N, L), 0.0);

        vec4 textureColor = texture(uFurTexture, vUV);

        vec3 color = textureColor.rgb * (uAmbientColor + uLightColor * NdotL);
        // RGBA
        FragColor = vec4(color.rgb, alpha);

    }