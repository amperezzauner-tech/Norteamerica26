# 🚀 Guía de Despliegue — Polla FIFA 2026 con Firebase Functions

## Arquitectura final

```
API-Football ──► Firebase Function ──► Firestore /resultados
                 (cada hora, auto)           │
                                             │ onSnapshot (tiempo real)
GitHub Pages ◄── index.html ────────────────┘
(predicciones.json estático)
```

---

## Paso 1 — Instalar Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

---

## Paso 2 — Inicializar en tu proyecto

```bash
cd firebase-functions
firebase use polla2026-d5b70
```

---

## Paso 3 — Instalar dependencias de las Functions

```bash
cd functions
npm install
cd ..
```

---

## Paso 4 — Configurar tu API key de API-Football

```bash
firebase functions:config:set apifootball.key="TU_API_KEY_AQUI"
firebase functions:config:set admin.token="UN_TOKEN_SECRETO_QUE_TU_ELIJAS"
```

Para obtener tu API key gratuita:
1. Ve a https://www.api-football.com
2. Regístrate (plan Free = 100 requests/día)
3. Copia tu API key del dashboard

---

## Paso 5 — Subir las reglas de Firestore

```bash
firebase deploy --only firestore:rules
```

---

## Paso 6 — Deployar las Functions

```bash
firebase deploy --only functions
```

Después del deploy verás algo como:
```
✔ functions[actualizarResultados]: Deployed
✔ functions[actualizarManual]: Deployed  
✔ functions[migrarPredicciones]: Deployed

Function URL (actualizarManual):
https://us-central1-polla2026-d5b70.cloudfunctions.net/actualizarManual
```

**Copia esa URL** y pégala en `index.html` donde dice `FUNCTION_URL`.

---

## Paso 7 — Migrar predicciones.json a Firestore (UNA SOLA VEZ)

```bash
curl -X POST \
  "https://us-central1-polla2026-d5b70.cloudfunctions.net/migrarPredicciones?token=TU_TOKEN_SECRETO" \
  -H "Content-Type: application/json" \
  -d @predicciones.json
```

Esto sube las predicciones de los 117 participantes a Firestore.
**Solo necesitas hacer esto una vez.**

---

## Paso 8 — Subir archivos a GitHub Pages

Sube estos archivos a tu repositorio:
- `index.html` (con la URL de la Function actualizada)
- `grupos.html`
- `predicciones.json`
- `resultados.json` (como backup)

---

## Verificar que funciona

1. Abre tu página de GitHub Pages
2. El ranking debe cargar desde Firestore (verás "Última actualización: ...")
3. En el panel ⚙️ Admin, presiona "🔄 Actualizar ahora"
4. Si hay partidos nuevos finalizados, el ranking se actualiza en segundos

---

## Cuánto cuesta

| Servicio | Plan Free | Límite |
|---|---|---|
| Firebase Functions | Spark (gratis) | 125K invocaciones/mes |
| Firestore | Spark (gratis) | 50K lecturas/día, 20K escrituras/día |
| Cloud Scheduler | 3 jobs gratis | ✅ Suficiente |
| API-Football | Free | 100 requests/día |

**Costo total: $0** para este volumen de uso.

El único momento que podrías salir del plan gratis es si tienes miles de usuarios activos simultáneos. Con 117 participantes estás muy lejos de ese límite.

---

## Qué pasa después del grupo de 16 (fase eliminatoria)

Las Functions ya están preparadas. Solo necesitas:
1. Verificar que `league_id=1` sigue siendo el correcto para el Mundial 2026
2. Agregar los partidos de eliminatorias a `OUR_MATCHES` en `functions/index.js`
3. Re-deployar: `firebase deploy --only functions`
