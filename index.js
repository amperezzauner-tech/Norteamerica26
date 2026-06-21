/**
 * POLLA FIFA 2026 — Firebase Cloud Functions
 * ============================================
 * Actualización automática de resultados vía API-Football
 *
 * FLUJO:
 *   Cloud Scheduler → actualizarResultados() cada hora
 *   → Consulta API-Football por partidos finalizados
 *   → Actualiza /resultados/{partidoId} en Firestore
 *   → El index.html escucha con onSnapshot → recalcula ranking en vivo
 *
 * INSTALACIÓN:
 *   1. cd firebase-functions/functions
 *   2. npm install
 *   3. firebase functions:config:set apifootball.key="TU_API_KEY"
 *   4. firebase deploy --only functions
 */

const functions  = require("firebase-functions");
const admin      = require("firebase-admin");
const axios      = require("axios");

admin.initializeApp();
const db = admin.firestore();

// ─── Mapeo de partidos: nuestro ID → API-Football fixture ID ───────────────
// Estos IDs los obtendrás la primera vez que corras getFixtureIds()
// Por ahora están vacíos — la función los llena automáticamente
const MATCH_MAP = {
  "p001": null, "p002": null, "p025": null, "p028": null, "p053": null, "p054": null,
  "p003": null, "p008": null, "p026": null, "p027": null, "p051": null, "p052": null,
  "p007": null, "p005": null, "p030": null, "p029": null, "p049": null, "p050": null,
  "p004": null, "p006": null, "p032": null, "p031": null, "p059": null, "p060": null,
  "p010": null, "p009": null, "p033": null, "p034": null, "p055": null, "p056": null,
  "p011": null, "p012": null, "p035": null, "p036": null, "p057": null, "p058": null,
  "p016": null, "p015": null, "p039": null, "p040": null, "p063": null, "p064": null,
  "p014": null, "p013": null, "p038": null, "p037": null, "p065": null, "p066": null,
  "p017": null, "p018": null, "p042": null, "p041": null, "p061": null, "p062": null,
  "p019": null, "p020": null, "p043": null, "p044": null, "p069": null, "p070": null,
  "p023": null, "p024": null, "p047": null, "p048": null, "p071": null, "p072": null,
  "p022": null, "p021": null, "p045": null, "p046": null, "p067": null, "p068": null,
};

// Mapeo de nombres de equipos: API-Football → nuestro nombre
const TEAM_NAMES = {
  "Mexico":           "México",
  "South Africa":     "Sudáfrica",
  "South Korea":      "Corea del Sur",
  "Czech Republic":   "Chequia",
  "Canada":           "Canadá",
  "Bosnia":           "Bosnia",
  "Switzerland":      "Suiza",
  "Brazil":           "Brasil",
  "Morocco":          "Marruecos",
  "Haiti":            "Haití",
  "Scotland":         "Escocia",
  "USA":              "EE.UU.",
  "United States":    "EE.UU.",
  "Paraguay":         "Paraguay",
  "Australia":        "Australia",
  "Turkey":           "Turquía",
  "Germany":          "Alemania",
  "Curacao":          "Curazao",
  "Ivory Coast":      "C. de Marfil",
  "Ecuador":          "Ecuador",
  "Netherlands":      "P. Bajos",
  "Japan":            "Japón",
  "Sweden":           "Suecia",
  "Tunisia":          "Túnez",
  "Belgium":          "Bélgica",
  "Egypt":            "Egipto",
  "Iran":             "Irán",
  "New Zealand":      "N. Zelanda",
  "Spain":            "España",
  "Cape Verde":       "Cabo Verde",
  "Saudi Arabia":     "Arabia Saudita",
  "Uruguay":          "Uruguay",
  "France":           "Francia",
  "Senegal":          "Senegal",
  "Iraq":             "Irak",
  "Norway":           "Noruega",
  "Argentina":        "Argentina",
  "Algeria":          "Argelia",
  "Austria":          "Austria",
  "Jordan":           "Jordania",
  "Portugal":         "Portugal",
  "Congo DR":         "Congo",
  "Uzbekistan":       "Uzbekistán",
  "Colombia":         "Colombia",
  "England":          "Inglaterra",
  "Croatia":          "Croacia",
  "Ghana":            "Ghana",
  "Panama":           "Panamá",
};

// Nuestros partidos con equipos para hacer matching
const OUR_MATCHES = [
  {id:"p001",local:"México",visitante:"Sudáfrica"},
  {id:"p002",local:"Corea del Sur",visitante:"Chequia"},
  {id:"p025",local:"Chequia",visitante:"Sudáfrica"},
  {id:"p028",local:"México",visitante:"Corea del Sur"},
  {id:"p053",local:"Chequia",visitante:"México"},
  {id:"p054",local:"Sudáfrica",visitante:"Corea del Sur"},
  {id:"p003",local:"Canadá",visitante:"Bosnia"},
  {id:"p008",local:"Qatar",visitante:"Suiza"},
  {id:"p026",local:"Suiza",visitante:"Bosnia"},
  {id:"p027",local:"Canadá",visitante:"Qatar"},
  {id:"p051",local:"Bosnia",visitante:"Suiza"},
  {id:"p052",local:"Qatar",visitante:"Bosnia"},
  {id:"p007",local:"Brasil",visitante:"Marruecos"},
  {id:"p005",local:"Haití",visitante:"Escocia"},
  {id:"p030",local:"Escocia",visitante:"Marruecos"},
  {id:"p029",local:"Brasil",visitante:"Haití"},
  {id:"p049",local:"Escocia",visitante:"Brasil"},
  {id:"p050",local:"Marruecos",visitante:"Haití"},
  {id:"p004",local:"EE.UU.",visitante:"Paraguay"},
  {id:"p006",local:"Australia",visitante:"Turquía"},
  {id:"p032",local:"EE.UU.",visitante:"Australia"},
  {id:"p031",local:"Turquía",visitante:"Paraguay"},
  {id:"p059",local:"Turquía",visitante:"EE.UU."},
  {id:"p060",local:"Paraguay",visitante:"Australia"},
  {id:"p010",local:"Alemania",visitante:"Curazao"},
  {id:"p009",local:"C. de Marfil",visitante:"Ecuador"},
  {id:"p033",local:"Alemania",visitante:"C. de Marfil"},
  {id:"p034",local:"Ecuador",visitante:"Curazao"},
  {id:"p055",local:"Curazao",visitante:"C. de Marfil"},
  {id:"p056",local:"Ecuador",visitante:"Alemania"},
  {id:"p011",local:"P. Bajos",visitante:"Japón"},
  {id:"p012",local:"Suecia",visitante:"Túnez"},
  {id:"p035",local:"P. Bajos",visitante:"Suecia"},
  {id:"p036",local:"Túnez",visitante:"Japón"},
  {id:"p057",local:"Japón",visitante:"Suecia"},
  {id:"p058",local:"Túnez",visitante:"P. Bajos"},
  {id:"p016",local:"Bélgica",visitante:"Egipto"},
  {id:"p015",local:"Irán",visitante:"N. Zelanda"},
  {id:"p039",local:"Bélgica",visitante:"Irán"},
  {id:"p040",local:"N. Zelanda",visitante:"Egipto"},
  {id:"p063",local:"Egipto",visitante:"Irán"},
  {id:"p064",local:"N. Zelanda",visitante:"Bélgica"},
  {id:"p014",local:"España",visitante:"Cabo Verde"},
  {id:"p013",local:"Arabia Saudita",visitante:"Uruguay"},
  {id:"p038",local:"España",visitante:"Arabia Saudita"},
  {id:"p037",local:"Uruguay",visitante:"Cabo Verde"},
  {id:"p065",local:"Cabo Verde",visitante:"Arabia Saudita"},
  {id:"p066",local:"Uruguay",visitante:"España"},
  {id:"p017",local:"Francia",visitante:"Senegal"},
  {id:"p018",local:"Irak",visitante:"Noruega"},
  {id:"p042",local:"Francia",visitante:"Irak"},
  {id:"p041",local:"Noruega",visitante:"Senegal"},
  {id:"p061",local:"Noruega",visitante:"Francia"},
  {id:"p062",local:"Senegal",visitante:"Irak"},
  {id:"p019",local:"Argentina",visitante:"Argelia"},
  {id:"p020",local:"Austria",visitante:"Jordania"},
  {id:"p043",local:"Argentina",visitante:"Austria"},
  {id:"p044",local:"Jordania",visitante:"Argelia"},
  {id:"p069",local:"Argelia",visitante:"Austria"},
  {id:"p070",local:"Jordania",visitante:"Argentina"},
  {id:"p023",local:"Portugal",visitante:"Congo"},
  {id:"p024",local:"Uzbekistán",visitante:"Colombia"},
  {id:"p047",local:"Portugal",visitante:"Uzbekistán"},
  {id:"p048",local:"Colombia",visitante:"Congo"},
  {id:"p071",local:"Colombia",visitante:"Portugal"},
  {id:"p072",local:"Congo",visitante:"Uzbekistán"},
  {id:"p022",local:"Inglaterra",visitante:"Croacia"},
  {id:"p021",local:"Ghana",visitante:"Panamá"},
  {id:"p045",local:"Inglaterra",visitante:"Ghana"},
  {id:"p046",local:"Panamá",visitante:"Croacia"},
  {id:"p067",local:"Panamá",visitante:"Inglaterra"},
  {id:"p068",local:"Croacia",visitante:"Ghana"},
];

// ─── Helper: normalizar nombre de equipo ──────────────────────────────────
function normalizeTeam(name) {
  if (!name) return "";
  return (TEAM_NAMES[name] || name).toLowerCase().trim();
}

// ─── Helper: hacer match por nombre ──────────────────────────────────────
function findMatch(apiHome, apiAway) {
  const h = normalizeTeam(apiHome);
  const a = normalizeTeam(apiAway);
  return OUR_MATCHES.find(m =>
    normalizeTeam(m.local) === h && normalizeTeam(m.visitante) === a
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIÓN 1: Actualización automática cada hora
// Trigger: Cloud Scheduler — cada hora durante el Mundial
// ═══════════════════════════════════════════════════════════════════════════
exports.actualizarResultados = functions
  .runWith({ timeoutSeconds: 60, memory: "256MB" })
  .pubsub
  .schedule("every 60 minutes")
  .onRun(async () => {
    const apiKey = functions.config().apifootball.key;
    // League ID 1 = FIFA World Cup (verifica en api-football.com antes del torneo)
    const LEAGUE_ID  = 1;
    const SEASON     = 2026;

    functions.logger.info("🔄 Iniciando actualización de resultados...");

    try {
      const response = await axios.get(
        `https://v3.football.api-sports.io/fixtures`,
        {
          params: { league: LEAGUE_ID, season: SEASON, status: "FT" },
          headers: {
            "x-rapidapi-key":  apiKey,
            "x-rapidapi-host": "v3.football.api-sports.io",
          },
          timeout: 30000,
        }
      );

      const fixtures = response.data.response || [];
      functions.logger.info(`API devolvió ${fixtures.length} partidos finalizados`);

      let updated = 0;
      const batch = db.batch();

      for (const fix of fixtures) {
        const homeTeam  = fix.teams?.home?.name || "";
        const awayTeam  = fix.teams?.away?.name || "";
        const golesL    = fix.goals?.home;
        const golesV    = fix.goals?.away;

        if (golesL === null || golesV === null) continue;

        const match = findMatch(homeTeam, awayTeam);
        if (!match) {
          functions.logger.warn(`Sin match: ${homeTeam} vs ${awayTeam}`);
          continue;
        }

        const ref = db.collection("resultados").doc(match.id);
        batch.set(ref, {
          id:            match.id,
          local:         match.local,
          visitante:     match.visitante,
          golesLocal:    golesL,
          golesVisitante:golesV,
          estado:        "finalizado",
          fixtureId:     fix.fixture?.id || null,
          updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        updated++;
      }

      await batch.commit();
      functions.logger.info(`✅ ${updated} partidos actualizados en Firestore`);

      // Guardar metadata de última actualización
      await db.collection("meta").doc("lastUpdate").set({
        timestamp:    admin.firestore.FieldValue.serverTimestamp(),
        partidosActualizados: updated,
        totalConsultados: fixtures.length,
      });

    } catch (error) {
      functions.logger.error("❌ Error actualizando resultados:", error.message);
      throw error;
    }
  });

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIÓN 2: Actualización manual desde el panel admin
// HTTP trigger — llamado desde el botón "Actualizar ahora" del index.html
// ═══════════════════════════════════════════════════════════════════════════
exports.actualizarManual = functions
  .runWith({ timeoutSeconds: 60 })
  .https.onRequest(async (req, res) => {
    // CORS para GitHub Pages
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST");
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }

    const apiKey = functions.config().apifootball.key;
    const LEAGUE_ID = 1;
    const SEASON    = 2026;

    try {
      const response = await axios.get(
        `https://v3.football.api-sports.io/fixtures`,
        {
          params: { league: LEAGUE_ID, season: SEASON, status: "FT" },
          headers: {
            "x-rapidapi-key":  apiKey,
            "x-rapidapi-host": "v3.football.api-sports.io",
          },
          timeout: 30000,
        }
      );

      const fixtures = response.data.response || [];
      const batch = db.batch();
      const updatedMatches = [];

      for (const fix of fixtures) {
        const homeTeam = fix.teams?.home?.name || "";
        const awayTeam = fix.teams?.away?.name || "";
        const golesL   = fix.goals?.home;
        const golesV   = fix.goals?.away;

        if (golesL === null || golesV === null) continue;
        const match = findMatch(homeTeam, awayTeam);
        if (!match) continue;

        const ref = db.collection("resultados").doc(match.id);
        batch.set(ref, {
          id:            match.id,
          local:         match.local,
          visitante:     match.visitante,
          golesLocal:    golesL,
          golesVisitante:golesV,
          estado:        "finalizado",
          fixtureId:     fix.fixture?.id || null,
          updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        updatedMatches.push({
          id:      match.id,
          partido: `${match.local} ${golesL}-${golesV} ${match.visitante}`,
        });
      }

      await batch.commit();

      res.json({
        ok:      true,
        updated: updatedMatches.length,
        matches: updatedMatches,
      });

    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIÓN 3: Subir predicciones.json a Firestore (una sola vez)
// Corre esto UNA VEZ para migrar de JSON a Firestore
// HTTP trigger — llama desde el browser con ?token=SECRETO
// ═══════════════════════════════════════════════════════════════════════════
exports.migrarPredicciones = functions
  .runWith({ timeoutSeconds: 540, memory: "512MB" })
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");

    // Token de seguridad — cámbialo antes de deployar
    const SECRET_TOKEN = functions.config().admin?.token || "CAMBIA_ESTE_TOKEN";
    if (req.query.token !== SECRET_TOKEN) {
      res.status(403).json({ error: "No autorizado" });
      return;
    }

    // predicciones.json debe estar en el Storage bucket
    // O carga desde el body del request
    const data = req.body;
    if (!data || !data.participantes) {
      res.status(400).json({ error: "Envía predicciones.json como body" });
      return;
    }

    try {
      const participantes = data.participantes;
      functions.logger.info(`Migrando ${participantes.length} participantes...`);

      // Guardar en batches de 500 (límite de Firestore)
      const BATCH_SIZE = 400;
      let count = 0;

      for (let i = 0; i < participantes.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = participantes.slice(i, i + BATCH_SIZE);

        for (const p of chunk) {
          const ref = db.collection("predicciones").doc(p.id);
          batch.set(ref, {
            id:           p.id,
            nombre:       p.nombre,
            predicciones: p.predicciones,
            honor:        p.honor || {},
            migradoAt:    admin.firestore.FieldValue.serverTimestamp(),
          });
          count++;
        }

        await batch.commit();
        functions.logger.info(`Migrados ${count}/${participantes.length}`);
      }

      res.json({ ok: true, migrated: count });

    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
