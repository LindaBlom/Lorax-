main();
//
// start here
//



function main() {
  const canvas = document.querySelector("#gl-canvas");
  const gl = canvas.getContext("webgl2");

  if (gl === null) {
    alert("Unable to initialize WebGL. Your browser or machine may not support it.");
    return;
  }

  Promise.all([
    fetch("shaders/grass.vert").then(r => r.text()),
    fetch("shaders/grass.frag").then(r => r.text())
  ])
    .then(([vertSource, fragSource]) => {
      initializeScene(gl, vertSource, fragSource);
    })
    .catch(err => console.error("Failed to load shaders:", err));
}

function initializeScene(gl, vertSource, fragSource) {
  const vertShader = compileShader(gl, vertSource, gl.VERTEX_SHADER);
  const fragShader = compileShader(gl, fragSource, gl.FRAGMENT_SHADER);

  if (!vertShader || !fragShader) {
    console.error("Aborting: shader compilation error.");
    return;
  }

  const floorShader = gl.createProgram();
  gl.attachShader(floorShader, vertShader);
  gl.attachShader(floorShader, fragShader);
  gl.linkProgram(floorShader);

  if (!gl.getProgramParameter(floorShader, gl.LINK_STATUS)) {
    console.error("Program linking failed:", gl.getProgramInfoLog(floorShader));
    return;
  }

  // --- Uniform locations ---
  const uModelLoc = gl.getUniformLocation(floorShader, "uModel");
  const uViewLoc = gl.getUniformLocation(floorShader, "uView");
  const uProjLoc = gl.getUniformLocation(floorShader, "uProj");
  const uGrassLoc = gl.getUniformLocation(floorShader, "uGrass");

  // --- Matrices ---
  const modelMatrix = new Float32Array(16);
  const viewMatrix = new Float32Array(16);
  const projMatrix = new Float32Array(16);
  mat4Identity(modelMatrix);
  mat4Identity(viewMatrix);
  mat4Identity(projMatrix);


// ---- perspective and camera setup ----

  // Move plane away from camera
  modelMatrix[14] = -5.0;

  // Camera at z = 20 looking towards -Z
  viewMatrix[12] = 0.0;
  viewMatrix[13] = 0.0;
  viewMatrix[14] = -20.0;

  mat4Perspective(projMatrix, Math.PI / 4, 1000 / 600, 0.1, 100.0);
  let camPos = { x: 0, y: 5, z: 20 };  // startposition
  let yaw = 0;                         // 0 = titta mot -Z
  const keys = {};

  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
  });

  window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  // --- Geometry: x, y, z, u, v ---
  const floorVertices = new Float32Array([
    //  x,   y,  z,   u,  v
    -10, -10, 0,   0, 0,
     10, -10, 0,   5, 0,
     10,  10, 0,   5, 5,
    -10,  10, 0,   0, 5
  ]);

  const floorIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);

  const floorVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, floorVBO);
  gl.bufferData(gl.ARRAY_BUFFER, floorVertices, gl.STATIC_DRAW);

  const floorEBO = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorEBO);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, floorIndices, gl.STATIC_DRAW);

  gl.useProgram(floorShader);
  gl.bindBuffer(gl.ARRAY_BUFFER, floorVBO);

  // Position attribute (location = 0)
  gl.vertexAttribPointer(
    0,        // index
    3,        // x,y,z
    gl.FLOAT,
    false,
    5 * 4,    // stride: 5 floats * 4 bytes
    0         // offset
  );
  gl.enableVertexAttribArray(0);

  // Texcoord attribute (location = 1)
  gl.vertexAttribPointer(
    1,        // index
    2,        // u,v
    gl.FLOAT,
    false,
    5 * 4,
    3 * 4     // offset: after 3 floats
  );
  gl.enableVertexAttribArray(1);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorEBO);

  // --- Texture setup ---
  const grassTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, grassTexture);

  // Temporary 1x1 green pixel so something exists before image loads
  const tempPixel = new Uint8Array([0, 255, 0, 255]);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    tempPixel
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const image = new Image();
  image.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, grassTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      image
    );

    gl.generateMipmap(gl.TEXTURE_2D);

    render();
    //drawScene(); // draw once texture is ready
  };
  image.src = "textures/grass.png"; // <-- put your grass image here

  // Optional: draw once with the 1x1 pixel (solid green) before real texture loads
  // drawScene();
  //render()


function render(){
    updateCamera();     // WASD, mus, etc
    //gl.uniformMatrix4fv(uViewLoc, false, viewMatrix);
    drawScene();
    requestAnimationFrame(render);
  }

function updateCamera(){
    const speed = 0.2;

    // forward riktning (0,0,-1) när yaw = 0
    const forwardX = 1
    const forwardZ = -1
    const rightX   = 1
    const rightZ   = 0

    if (keys["w"]) {
      viewMatrix[14] += speed;
      //camPos.x += forwardX * speed;
      //camPos.z += forwardZ * speed;
    }
    if (keys["s"]) {
      viewMatrix[14] -= speed;
      //camPos.x -= forwardX * speed;
      //camPos.z -= forwardZ * speed;
    }
    if (keys["a"]) {
      viewMatrix[12] += speed;
      //camPos.x -= rightX * speed;
      //camPos.z -= rightZ * speed;
    }
    if (keys["d"]) {
      viewMatrix[12] -= speed;
      //camPos.x += rightX * speed;
      //camPos.z += rightZ * speed;
    }

    // Bygg view-matris så kameran tittar på origo (0,0,0)
    //mat4LookAt(
    //  viewMatrix,
    //  camPos.x, camPos.y, camPos.z,
    //  0.0,      0.0,      0.0,
    //  0.0,      1.0,      0.0
    //);
    //gl.uniformMatrix4fv(uViewLoc, false, viewMatrix);

}

function drawScene() {
    gl.useProgram(floorShader);

    gl.uniformMatrix4fv(uModelLoc, false, modelMatrix);
    gl.uniformMatrix4fv(uViewLoc, false, viewMatrix);
    gl.uniformMatrix4fv(uProjLoc, false, projMatrix);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, grassTexture);
    gl.uniform1i(uGrassLoc, 0);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorEBO);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}  

}



function mat4LookAt(out,
  eyeX, eyeY, eyeZ,
  centerX, centerY, centerZ,
  upX, upY, upZ
) {
  let x0, x1, x2, y0, y1, y2, z0, z1, z2;
  let len;

  // z-axeln = eye - center
  z0 = eyeX - centerX;
  z1 = eyeY - centerY;
  z2 = eyeZ - centerZ;

  len = Math.hypot(z0, z1, z2);
  if (len === 0) {
    z2 = 1;
  } else {
    z0 /= len;
    z1 /= len;
    z2 /= len;
  }

  // x-axeln = up × z
  x0 = upY * z2 - upZ * z1;
  x1 = upZ * z0 - upX * z2;
  x2 = upX * z1 - upY * z0;

  len = Math.hypot(x0, x1, x2);
  if (len === 0) {
    // om up parallell med z, välj alternativ axel
    if (Math.abs(upZ) === 1) {
      x0 = 0; x1 = 1; x2 = 0;
    } else {
      x0 = 0; x1 = 0; x2 = 1;
    }
  } else {
    x0 /= len;
    x1 /= len;
    x2 /= len;
  }

  // y-axeln = z × x
  y0 = z1 * x2 - z2 * x1;
  y1 = z2 * x0 - z0 * x2;
  y2 = z0 * x1 - z1 * x0;

  out[0] = x0; out[1] = y0; out[2]  = z0;  out[3]  = 0;
  out[4] = x1; out[5] = y1; out[6]  = z1;  out[7]  = 0;
  out[8] = x2; out[9] = y2; out[10] = z2;  out[11] = 0;

  out[12] = -(x0 * eyeX + x1 * eyeY + x2 * eyeZ);
  out[13] = -(y0 * eyeX + y1 * eyeY + y2 * eyeZ);
  out[14] = -(z0 * eyeX + z1 * eyeY + z2 * eyeZ);
  out[15] = 1;
}



function compileShader(gl, source, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compilation failed:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function mat4Identity(m) {
  for (let i = 0; i < 16; i++) m[i] = 0.0;
  m[0] = m[5] = m[10] = m[15] = 1.0;
}

function mat4Perspective(out, fovy, aspect, near, far) {
  const f = 1.0 / Math.tan(fovy / 2.0);
  out[0] = f / aspect;
  out[1] = 0.0;
  out[2] = 0.0;
  out[3] = 0.0;

  out[4] = 0.0;
  out[5] = f;
  out[6] = 0.0;
  out[7] = 0.0;

  out[8]  = 0.0;
  out[9]  = 0.0;
  out[10] = (far + near) / (near - far);
  out[11] = -1.0;

  out[12] = 0.0;
  out[13] = 0.0;
  out[14] = (2.0 * far * near) / (near - far);
  out[15] = 0.0;
}



