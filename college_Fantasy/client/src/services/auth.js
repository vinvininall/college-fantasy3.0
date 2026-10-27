import { apiRequest } from "./api.js";

const TOKEN_KEY = "sfl-token";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function registerUser(details) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify(details)
  });
}

export function loginUser(credentials) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials)
  });
}

export function fetchCurrentUser(token) {
  return apiRequest("/auth/me", { token });
}
