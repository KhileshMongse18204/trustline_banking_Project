// JS/Sign_script.js

const container = document.getElementById("container");
const registerBtn = document.getElementById("register");
const loginBtn = document.getElementById("login");

// Toggle panels
registerBtn.addEventListener("click", () => {
  container.classList.add("active");
});
loginBtn.addEventListener("click", () => {
  container.classList.remove("active");
});

// Handle Sign Up
document.getElementById("signUpForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const pass = document.getElementById("signupPassword").value.trim();

  if (!name || !email || !pass) {
    alert("Please fill all fields.");
    return;
  }

  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password: pass }),
  });

  const data = await response.json();
  if (!response.ok) {
    alert(data.error || "Sign up failed");
    return;
  }

  window.location.href = "Home.html";
});

// Handle Sign In
document.getElementById("signInForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const email = document.getElementById("signinEmail").value.trim();
  const pass = document.getElementById("signinPassword").value.trim();

  if (!email || !pass) {
    alert("Please enter email and password.");
    return;
  }

  const response = await fetch("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pass }),
  });

  const data = await response.json();
  if (!response.ok) {
    alert(data.error || "Sign in failed");
    return;
  }

  window.location.href = "Home.html";
});
