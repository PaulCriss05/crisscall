const express = require("express");

const database = require("../db/db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, (request, response) => {
  response.json(database.read().contacts);
});

router.post("/", requireAuth, async (request, response) => {
  const { name, phone, email, notes } = request.body || {};
  if (!name || !phone) {
    return response.status(400).json({ error: "Nume si telefon sunt obligatorii." });
  }
  const newContact = {
    id: Date.now().toString(36),
    name,
    phone,
    email: email || "",
    notes: notes || "",
  };
  await database.update((data) => data.contacts.push(newContact));
  response.json(newContact);
});

router.put("/:id", requireAuth, async (request, response) => {
  const { name, phone, email, notes } = request.body || {};
  const updatedContact = await database.update((data) => {
    const contact = data.contacts.find((existingContact) => existingContact.id === request.params.id);
    if (!contact) return null;
    Object.assign(contact, { name, phone, email, notes });
    return contact;
  });
  if (!updatedContact) return response.status(404).json({ error: "Contact inexistent." });
  response.json(updatedContact);
});

router.delete("/:id", requireAuth, async (request, response) => {
  await database.update((data) => {
    data.contacts = data.contacts.filter((existingContact) => existingContact.id !== request.params.id);
  });
  response.json({ ok: true });
});

module.exports = router;
