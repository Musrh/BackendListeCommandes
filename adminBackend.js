// adminBackend.js
import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

// CORS
app.use(
  cors({
    origin: "https://wellshoppings.com", // ton front-end
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 🔥 Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 🔹 Middleware pour vérifier token Firebase
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token manquant" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Erreur vérification token:", err);
    return res.status(401).json({ error: "Token invalide" });
  }
}

// 🔹 Liste des commandes (admin seulement)
app.get("/list-orders", verifyToken, async (req, res) => {
  try {
    const userDoc = await db.collection("users").doc(req.user.uid).get();
    const userData = userDoc.data();
    if (!userData || userData.role !== "admin") {
      return res.status(403).json({ error: "Accès refusé" });
    }

    const snapshot = await db.collection("commandes").get();
    const commandes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ commandes });
  } catch (err) {
    console.error("Erreur récupération commandes:", err);
    res.status(500).json({ error: "Impossible de récupérer les commandes." });
  }
});

// 🔹 Envoyer une commande à Printful
app.post("/create-order", verifyToken, async (req, res) => {
  try {
    const order = req.body.order;
    if (!order) return res.status(400).json({ error: "Order manquant" });

    // Ici tu peux envoyer vers ton service Printful
    const response = await fetch(
      "https://printfulpasscommandes-production.up.railway.app/create-order",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      }
    );

    const data = await response.json();
    if (!response.ok || !data.success)
      return res.status(500).json({ error: data.message || data });

    res.json({ success: true, data: data.data });
  } catch (err) {
    console.error("Erreur envoi Printful:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Démarrer le serveur
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Admin backend running on port ${PORT}`));
