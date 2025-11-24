import fs from 'fs';
import path from 'path';

export type ArtifactRecord = {
  agentId: string;
  version: string; // e.g. v<timestamp> or ppo/v1
  path: string;
  type: 'supervised' | 'rl' | 'unsupervised';
  createdAt: string; // ISO
  stage?: 'latest' | 'best' | 'production';
  metrics?: Record<string, any>;
};

export type RegistryFile = {
  agentId: string;
  artifacts: ArtifactRecord[];
  stages: {
    latest?: string; // version
    best?: string;
    production?: string;
  };
};

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readRegistry(agentId: string): RegistryFile {
  const dir = path.join('data', 'models', 'agents', agentId);
  ensureDir(dir);
  const file = path.join(dir, 'registry.json');
  if (!fs.existsSync(file)) {
    const empty: RegistryFile = { agentId, artifacts: [], stages: {} };
    fs.writeFileSync(file, JSON.stringify(empty, null, 2));
    return empty;
  }
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw) as RegistryFile;
}

function writeRegistry(agentId: string, reg: RegistryFile) {
  const dir = path.join('data', 'models', 'agents', agentId);
  ensureDir(dir);
  const file = path.join(dir, 'registry.json');
  fs.writeFileSync(file, JSON.stringify(reg, null, 2));
}

export function registerArtifact(params: { agentId: string; version: string; dir: string; type: ArtifactRecord['type']; metrics?: Record<string, any> }) {
  const reg = readRegistry(params.agentId);
  const rec: ArtifactRecord = {
    agentId: params.agentId,
    version: params.version,
    path: params.dir,
    type: params.type,
    createdAt: new Date().toISOString(),
    metrics: params.metrics,
  };
  // dedupe by version
  reg.artifacts = reg.artifacts.filter(a => a.version !== rec.version).concat([rec]);
  reg.stages.latest = rec.version;
  writeRegistry(params.agentId, reg);
  return rec;
}

export function promote(params: { agentId: string; version: string; stage: 'latest' | 'best' | 'production' }) {
  const reg = readRegistry(params.agentId);
  const exists = reg.artifacts.some(a => a.version === params.version);
  if (!exists) throw new Error(`version not found: ${params.version}`);
  reg.stages[params.stage] = params.version;
  writeRegistry(params.agentId, reg);
  return reg.stages;
}

export function getStage(params: { agentId: string; stage: 'latest' | 'best' | 'production' }) {
  const reg = readRegistry(params.agentId);
  const v = reg.stages[params.stage];
  if (!v) return null;
  const a = reg.artifacts.find(x => x.version === v) || null;
  return a;
}

export function prune(params: { agentId: string; keep: number }) {
  const reg = readRegistry(params.agentId);
  if (reg.artifacts.length <= params.keep) return reg;
  // keep newest by createdAt
  reg.artifacts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const kept = reg.artifacts.slice(0, params.keep);
  reg.artifacts = kept;
  writeRegistry(params.agentId, reg);
  return reg;
}
