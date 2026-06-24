import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArmy } from './armyParser.js';
import { hydrateRoster } from './hydrate.js';
import { getDatasheet, allDatasheetIndex, dbExists, getDetachmentInfo } from './db.js';
import { loadLayouts } from './layouts.js';
import { registerHandlers } from './socketHandlers.js';
import { reapEmptyRooms } from './rooms.js';
import type { ClientToServer, ServerToClient } from '../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(express.json({ limit: '1mb' }));

const httpServer = createServer(app);
const io = new Server<ClientToServer, ServerToClient>(httpServer, {
  cors: { origin: true },
});

// ---------- REST ----------

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, db: dbExists() });
});

app.post('/api/parse-army', (req, res) => {
  const text = (req.body?.text ?? '') as string;
  if (typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'No army text provided' });
    return;
  }
  if (!dbExists()) {
    res.status(503).json({
      error:
        'Stat database not built. Run "npm run seed" (sample) or "npm run ingest" (Wahapedia CSVs) first.',
    });
    return;
  }
  try {
    const raw = parseArmy(text);
    const hydrated = hydrateRoster(raw);
    res.json(hydrated);
  } catch (e: any) {
    console.error('parse-army failed', e);
    res.status(500).json({ error: e?.message ?? 'parse failed' });
  }
});

app.get('/api/datasheet/:id', (req, res) => {
  if (!dbExists()) {
    res.status(503).json({ error: 'Stat database not built.' });
    return;
  }
  const ds = getDatasheet(req.params.id);
  if (!ds) {
    res.status(404).json({ error: 'Datasheet not found' });
    return;
  }
  res.json(ds);
});

app.get('/api/datasheets', (req, res) => {
  if (!dbExists()) {
    res.status(503).json({ error: 'Stat database not built.' });
    return;
  }
  const faction = (req.query.faction as string) || undefined;
  res.json(allDatasheetIndex(faction));
});

app.get('/api/layouts', (_req, res) => {
  res.json(loadLayouts());
});

app.get('/api/detachment', (req, res) => {
  if (!dbExists()) {
    res.status(503).json({ error: 'Stat database not built.' });
    return;
  }
  const faction = (req.query.faction as string) || '';
  const name = (req.query.name as string) || '';
  const info = getDetachmentInfo(faction, name);
  if (!info) {
    res.status(404).json({ error: 'Detachment not found', faction, name });
    return;
  }
  res.json(info);
});

// ---------- Static (production) ----------

// Works in dev (tsx: __dirname=server/) and prod (tsc: __dirname=dist/server/).
const clientDistCandidates = [
  path.resolve(__dirname, '../client/dist'), // dev
  path.resolve(__dirname, '../../client/dist'), // prod (dist/server -> root/client/dist)
  path.resolve(process.cwd(), 'client/dist'),
];
const clientDist = clientDistCandidates.find((p) => fs.existsSync(p)) ?? clientDistCandidates[0];
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ---------- Socket.IO ----------

io.on('connection', (socket) => {
  console.log(`[socket] connected ${socket.id}`);
  registerHandlers(io, socket);
});

setInterval(reapEmptyRooms, 60 * 1000);

httpServer.listen(PORT, () => {
  console.log(`40k-vtt server listening on http://localhost:${PORT}`);
  console.log(`  stat DB present: ${dbExists()}`);
  console.log(`  layouts loaded: ${loadLayouts().length}`);
});
