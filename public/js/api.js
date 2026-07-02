const api = {
  async request(method, url, body) {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
    const responseData = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(responseData.error || "Eroare necunoscuta.");
    return responseData;
  },
  get(url) {
    return this.request("GET", url);
  },
  post(url, body) {
    return this.request("POST", url, body);
  },
  put(url, body) {
    return this.request("PUT", url, body);
  },
  delete(url) {
    return this.request("DELETE", url);
  },
};
