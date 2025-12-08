



export function addEventListeners(gl, keys,cameraState, gravityEnabled, verticalVelocity, updateViewMatrix) {

	window.addEventListener("keydown", (e) => {
		const key = e.key;
		keys[key.toLowerCase()] = true;   // w, a, s, d etc

		if (key === "l" || key === "L") {
			const canvas = gl.canvas;
			if (document.pointerLockElement === canvas) {
				document.exitPointerLock();
			} else {
				canvas.requestPointerLock();
			}
		}
	});

	window.addEventListener("keyup", (e) => {
		const key = e.key;
		keys[key.toLowerCase()] = false;  // w, a, s, d etc
	});

	const canvas = gl.canvas; 
	let isDragging = false;
	let isPointerLocked = false;
	let lastMouseX = 0;
	let lastMouseY = 0;
	const mouseSensitivity = 0.003; // radians per pixel-ish

	document.addEventListener("pointerlockchange", () => {
		isPointerLocked = (document.pointerLockElement === canvas);
	});

	window.addEventListener("mousedown", (e) => {
		if (e.button === 0 && !isPointerLocked) {
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
		canvas.classList.remove("dragging");
	});

	window.addEventListener("mousemove", (e) => {
		let dx, dy;

		if (isPointerLocked) {
			// Pointer locked: browser gives relative movement
			dx = e.movementX;
			dy = e.movementY;
		} else if (isDragging) {
			// Old behaviour: drag with left mouse pressed
			dx = e.clientX - lastMouseX;
			dy = e.clientY - lastMouseY;

			lastMouseX = e.clientX;
			lastMouseY = e.clientY;
		} else {
			// Not dragging and not locked → ignore
			return;
		}

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