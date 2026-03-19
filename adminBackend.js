// adminBackend.js
import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

// Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// 🔹 Liste des commandes
app.get("/admin/orders", async (req, res) => {
  try {
    const snapshot = await db.collection("commandes").orderBy("date", "desc").get();
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, orders });
  } catch (err) {
    console.error("❌ Erreur récupération commandes :", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 🔹 Envoyer une commande à Printful
app.post("/admin/send-to-printful/:orderId", async (req, res) => {
  const { orderId } = req.params;

  try {
    const docSnap = await db.collection("commandes").doc(orderId).get();
    if (!docSnap.exists) return res.status(404).json({ success: false, message: "Commande non trouvée" });

    const orderData = docSnap.data();

    // Transformer les items : renommer id → variant_id
    const items = orderData.items.map(i => ({
      variant_id: i.id,
      quantity: i.quantity,
    }));

    const orderForPrintful = {
      nomClient: orderData.email || "Client",
      adresse: orderData.adresseLivraison || "",
      ville: orderData.ville || "",
      pays: orderData.pays || "FR",
      codePostal: orderData.codePostal || "",
      items,
    };

    const response = await fetch("https://printfulpasscommandes-production.up.railway.app/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: orderForPrintful }),
    });

    const data = await response.json();

    if (!data.success) throw new Error(data.message || "Erreur Printful");

    console.log("✅ Commande envoyée à Printful :", data.data);
    res.json({ success: true, data: data.data });
  } catch (err) {
    console.error("❌ Erreur envoi à Printful :", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Admin backend running on port ${PORT}`));
