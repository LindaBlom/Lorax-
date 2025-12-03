main();
console.log("glMatrix:", glMatrix);

const mat4 = glMatrix.mat4;
const vec3 = glMatrix.vec3;

function main() {
	const canvas = document.querySelector("#gl-canvas");
	const gl = canvas.getContext("webgl2");
	if (!gl) {
		alert("No webgl for you!");
		return;
	}

	function resizeCanvas() {
		canvas.width = canvas.clientWidth;
		canvas.height = canvas.clientHeight;
		gl.viewport(0, 0, canvas.width, canvas.height);
	}

	resizeCanvas();
	window.addEventListener("resize", resizeCanvas);

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

	const uLightDirLoc      = gl.getUniformLocation(floorShader, "uLightDir");
	const uLightColorLoc    = gl.getUniformLocation(floorShader, "uLightColor");
	const uAmbientColorLoc  = gl.getUniformLocation(floorShader, "uAmbientColor");

	if (!gl.getProgramParameter(floorShader, gl.LINK_STATUS)) {
		console.error("Program linking failed:", gl.getProgramInfoLog(floorShader));
		return;
	}

	// --- Uniform locations ---
	const uModelLoc = gl.getUniformLocation(floorShader, "uModel");
	const uViewLoc = gl.getUniformLocation(floorShader, "uView");
	const uProjLoc = gl.getUniformLocation(floorShader, "uProj");
	const uGrassLoc = gl.getUniformLocation(floorShader, "uGrass");

	const uSeedLoc = gl.getUniformLocation(floorShader, "uSeed");

	gl.useProgram(floorShader);
	gl.uniform1f(uSeedLoc, Math.random() * 100.0);

	// --- Matrices ---
	const viewMatrix = mat4.create();
	const modelMatrix = mat4.create();
	const projMatrix = mat4.create();
	
	// ---- perspective and camera setup ----
	mat4.lookAt(viewMatrix,
		[0, 0, 10],   // camera position
		[10, 0, 10],  // looking sideways in +X direction
		[0, 0, 1]     // Z-up
	)
	
	const out = projMatrix;
	const fovy = Math.PI / 4; // 45 degrees
	const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
	const near = 0.1;
	const far = 100.0;

	mat4.perspective(out, fovy, aspect, near, far);
	console.log(out);
 
	const keys = {};

	window.addEventListener("keydown", (e) => {
		const key = e.key;
		keys[key.toLowerCase()] = true;   // w, a, s, d etc
	});

	window.addEventListener("keyup", (e) => {
		const key = e.key;
		keys[key.toLowerCase()] = false;  // w, a, s, d etc
	});

	const canvas = gl.canvas; 
	let isDragging = false;
	let lastMouseX = 0;
	let lastMouseY = 0;
	const mouseSensitivity = 0.003; // radians per pixel-ish

	canvas.addEventListener("mousedown", (e) => {
		if (e.button === 0) {
			isDragging = true;
			canvas.classList.add("dragging");
			lastMouseX = e.clientX;
			lastMouseY = e.clientY;
		}
	});

	canvas.addEventListener("mouseup", (e) => {
		if (e.button === 0) {
			isDragging = false;
			canvas.classList.remove("dragging");
		}
	});

	canvas.addEventListener("mouseleave", () => {
		isDragging = false;
	});

	canvas.addEventListener("mousemove", (e) => {
		if (!isDragging) return;

		const dx = e.clientX - lastMouseX;
		const dy = e.clientY - lastMouseY;

		lastMouseX = e.clientX;
		lastMouseY = e.clientY;

		// convert pixels → radians
		const yaw   = dx * mouseSensitivity; // left/right
		const pitch = dy * mouseSensitivity; // up/down

		// === yaw around Z (world up) ===
		if (yaw !== 0) {
			const yawMat = mat4.create();
			mat4.fromRotation(yawMat, yaw, [0, 0, 1]);
			mat4.multiply(viewMatrix, viewMatrix, yawMat); // yaw * view
		}

		// === pitch around X ===
		if (pitch !== 0) {
			const pitchMat = mat4.create();
			mat4.fromRotation(pitchMat, pitch, [1, 0, 0]);
			mat4.multiply(viewMatrix, pitchMat, viewMatrix); // pitch * view
		}
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
	};
	image.src = "textures/grass.png"; 

	function render(){
		updateCamera();     // WASD, mus, etc'
		drawScene();
		requestAnimationFrame(render);
	}

	function updateCamera(){
		let speed = 0.2;
		const rotationSpeed = 0.02;

		if (keys["shift"]) speed = 0.4;
		else speed = 0.2;

		if (keys["w"]) viewMatrix[14] += speed;      
		if (keys["s"]) viewMatrix[14] -= speed;
		if (keys["a"]) viewMatrix[12] += speed;
		if (keys["d"]) viewMatrix[12] -= speed;
		if (keys["e"]) viewMatrix[13] -= speed;
		if (keys["q"]) viewMatrix[13] += speed;

		if (keys["arrowup"]) {
			const rotationMatrix = mat4.create();
			mat4.fromRotation(rotationMatrix, -rotationSpeed, [1, 0, 0]);  
			mat4.multiply(viewMatrix, rotationMatrix, viewMatrix);
		}
		if (keys["arrowdown"]) {
			const rotationMatrix = mat4.create();
			mat4.fromRotation(rotationMatrix, rotationSpeed, [1, 0, 0]);  
			mat4.multiply(viewMatrix, rotationMatrix, viewMatrix);
		}
		if (keys["arrowleft"]) {
			const rotationMatrix = mat4.create();
			mat4.fromRotation(rotationMatrix, -rotationSpeed, [0, 0, 1]);  
			mat4.multiply(viewMatrix, viewMatrix, rotationMatrix);
		}
		if (keys["arrowright"]) {
			const rotationMatrix = mat4.create();
			mat4.fromRotation(rotationMatrix, rotationSpeed, [0, 0, 1]);  
			mat4.multiply(viewMatrix, viewMatrix, rotationMatrix);
		}   
	}

	function drawScene() {
		gl.useProgram(floorShader);

		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
		gl.enable(gl.DEPTH_TEST);
		gl.clearColor(0.45, 0.75, 1.0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		gl.uniformMatrix4fv(uViewLoc, false, viewMatrix);
		gl.uniformMatrix4fv(uProjLoc, false, projMatrix);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, grassTexture);
		gl.uniform1i(uGrassLoc, 0);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorEBO);

		const tileSize = 20.0;     // your quad covers -10..10 ⇒ size 20
		const gridRadius = 4;      // draws (2*4+1)^2 = 81 tiles

		for (let gy = -gridRadius; gy <= gridRadius; gy++) {
			for (let gx = -gridRadius; gx <= gridRadius; gx++) {

				// start from your original modelMatrix (which has z = -5)
				const tileModel = mat4.clone(modelMatrix);

				// offset this tile in X/Y by whole-tile steps
				mat4.translate(tileModel, tileModel, [gx * tileSize, gy * tileSize, 0.0]);

				gl.uniformMatrix4fv(uModelLoc, false, tileModel);

				// draw the same quad geometry at this offset
				gl.drawElements(
					gl.TRIANGLES,
					floorIndices.length,
					gl.UNSIGNED_SHORT,
					0
				);
			}
		}
	}  
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