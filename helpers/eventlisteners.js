



export function addEventListeners(gl, keys,cameraState, gravityEnabled, verticalVelocity, updateViewMatrix) {

	window.addEventListener("keydown", (e) => {
		const key = e.key;
		keys[key.toLowerCase()] = true;   // w, a, s, d etc
		if (key === "f") {
			gravityEnabled = !gravityEnabled;
			if (!gravityEnabled) {
				verticalVelocity = 0; // optional, stops falling instantly
			}
			console.log("Gravity:", gravityEnabled ? "ON" : "OFF");
		}
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

	window.addEventListener("mousedown", (e) => {
		if (e.button === 0) {
			isDragging = true;
			canvas.classList.add("dragging");
			lastMouseX = e.clientX;
			lastMouseY = e.clientY;
		}
	});

	window.addEventListener("mouseup", (e) => {
		if (e.button === 0) {
			isDragging = false;
			canvas.classList.remove("dragging");
		}
	});

	window.addEventListener("mouseleave", () => {
		isDragging = false;
	});

	window.addEventListener("mousemove", (e) => {
		if (!isDragging) return;

		const dx = e.clientX - lastMouseX;
		const dy = e.clientY - lastMouseY;

		lastMouseX = e.clientX;
		lastMouseY = e.clientY;

		// convert pixels → radians
		cameraState.yaw   -= dx * mouseSensitivity; // left/right
		cameraState.pitch -= dy * mouseSensitivity; // up/down

		// clamp pitch so you can’t flip over
		const maxPitch = Math.PI / 2 - 0.1;
		if (cameraState.pitch > maxPitch) cameraState.pitch = maxPitch;
		if (cameraState.pitch < -maxPitch) cameraState.pitch = -maxPitch;
		updateViewMatrix();
	});
}