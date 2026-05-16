document.addEventListener("DOMContentLoaded", () => {
  const socket = io("https://commisionaiorme.onrender.com");
  let currentRoom = null;

  // canvas setup
  const canvas = document.getElementById("drawing-canvas");
  const ctx = canvas.getContext("2d");
  function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);
  let drawing = false;

  canvas.addEventListener("mousedown", (e) => {
  drawing = true;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  ctx.beginPath();
  ctx.moveTo(x, y);
});
  canvas.addEventListener("mouseup", () => { drawing = false; ctx.beginPath(); });
  canvas.addEventListener("mousemove", (e) => {
    if (!drawing) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
const scaleY = canvas.height / rect.height;
const x = (e.clientX - rect.left) * scaleX;
const y = (e.clientY - rect.top) * scaleY;
ctx.lineWidth = 4;
ctx.lineCap = "round";
ctx.strokeStyle = "#000000";
ctx.lineTo(x, y);
ctx.stroke();
ctx.beginPath();
ctx.moveTo(x, y);
  });

  function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // botões toggle
  const buttons = document.querySelectorAll(".toggle button");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const isAI = btn.classList.contains("ai-button");
      document.getElementById("ui-ai").style.display        = isAI ? "flex"  : "none";
      document.getElementById("display-area").style.display = isAI ? "none"  : "block";
      document.getElementById("message-app").style.display  = isAI ? "none"  : "block";
      document.querySelector(".toggle").style.display       = "flex";
    });
  });

  // enviar prompt (usuário)
  function handleSend() {
    const input = document.getElementById("message-input");
    const message = input.value;
    if (!currentRoom) { alert("You are not matched yet!"); return; }
    socket.emit("prompt", { room: currentRoom, message });
    input.value = "";
  }

  // enviar desenho (humano-IA)
  function handleRespond() {
    if (!currentRoom) { alert("Not matched yet!"); return; }
    const imageData = canvas.toDataURL("image/png");
    socket.emit("prompt", { room: currentRoom, message: imageData });
    clearCanvas();
  }

  window.handleSend = handleSend;
  window.handleRespond = handleRespond;
  window.clearCanvas = clearCanvas;

  document.getElementById("message-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSend();
  });

  socket.on("matched", (data) => {
    currentRoom = data.room;
    console.log("Matched! Room:", currentRoom);
  });

  socket.on("waiting", () => {
    console.log("Waiting for another player...");
  });

  socket.on("prompt", (data) => {
    const display = document.getElementById("display-area");
    document.getElementById("prompt-recebido").textContent = data;
    if (data.startsWith("data:image")) {
      const img = document.createElement("img");
      img.src = data;
      img.style.maxWidth = "100%";
      img.style.borderRadius = "8px";
      display.appendChild(img);
    } else {
      const p = document.createElement("p");
      p.textContent = data;
      display.appendChild(p);
    }
  });

});





