// Medição da H4: N agendamentos simultâneos -> latência de confirmação (p95) e entrega do e-mail (SMTP sink).
const crypto = require('crypto'); const fs = require('fs');
const SECRET = 'h4-test-secret', KEY = 'h4-internal-key';
const ELIG = 'http://127.0.0.1:3002', SCHED = 'http://127.0.0.1:3003';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(p) { const h = b64({ alg: 'HS256', typ: 'JWT' }), b = b64({ ...p, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600 });
  return `${h}.${b}.${crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url')}`; }
const N = Number(process.env.N || 50), RUNS = Number(process.env.RUNS || 5), MAIL = process.env.MAILS;
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(p / 100 * s.length) - 1)]; };
const readMails = () => fs.existsSync(MAIL) ? fs.readFileSync(MAIL, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
async function api(url, opt) { const r = await fetch(url, opt); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; }
let seq = 0;
async function mkDonor(tag) {
  const i = ++seq; const userId = crypto.randomUUID();
  const cpf = String(10000000000 + i * 7919 + Date.now() % 1000).slice(0, 11);
  const r = await api(`${ELIG}/donors`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-api-key': KEY },
    body: JSON.stringify({ userId, completeName: `Doador Teste ${tag}-${i}`, cpf, birthDate: '1995-03-10', sex: 'M', phone: '55999990000', email: `d${tag}${i}@teste.local`, weightKg: 75, heightCm: 178 }) });
  if (r.status >= 300) throw new Error('donor ' + r.status + JSON.stringify(r.body));
  return { donorId: r.body.id, userId, email: `d${tag}${i}@teste.local` };
}
(async () => {
  const admin = jwt({ sub: crypto.randomUUID(), email: 'admin@teste.local', role: 'admin', donorId: null });
  const unit = await api(`${SCHED}/collection-units`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${admin}` },
    body: JSON.stringify({ name: 'Hemocentro Teste H4', address: 'Rua de Teste 100', city: 'Ijui', uf: 'RS', phone: '5599999999', simultaneousCapacity: N }) });
  if (unit.status >= 300) throw new Error('unit ' + unit.status + JSON.stringify(unit.body));
  const unitId = unit.body.id;
  const results = [];
  for (let run = 0; run <= RUNS; run++) {
    const sequential = run === 0;                    // run 0 = linha de base sequencial
    const donors = []; for (let k = 0; k < N; k++) donors.push(await mkDonor(`r${run}`));
    const slot = new Date(Math.ceil((Date.now() + (3 + run) * 3600e3) / 3600e3) * 3600e3).toISOString();
    const send = async (d) => {
      const tok = jwt({ sub: d.userId, email: d.email, role: 'donor', donorId: d.donorId });
      const t0 = Date.now();
      const r = await api(`${SCHED}/appointments`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` },
        body: JSON.stringify({ donorId: d.donorId, collectionUnitId: unitId, dateTime: slot }) });
      return { d, t0, ms: Date.now() - t0, status: r.status, st: r.body && r.body.status };
    };
    const before = readMails().length;
    const res = sequential ? await (async () => { const o = []; for (const d of donors) o.push(await send(d)); return o; })() : await Promise.all(donors.map(send));
    const ok = res.filter((x) => x.status === 201 || x.status === 200);
    await new Promise((r) => setTimeout(r, 15000));  // janela para a entrega
    const mails = readMails().slice(before);
    const byTo = new Map(mails.map((m) => [m.to, m.t]));
    const deliv = ok.map((x) => byTo.has(x.d.email) ? byTo.get(x.d.email) - x.t0 : null);
    const got = deliv.filter((v) => v !== null);
    const lat = ok.map((x) => x.ms);
    results.push({ run, mode: sequential ? 'sequencial' : 'simultaneo', n: N, created: ok.length, eligConfirmed: ok.filter((x) => x.st === 'ELIGIBILITY_CONFIRMED').length,
      p50: pct(lat, 50), p95: pct(lat, 95), max: Math.max(...lat), mean: Math.round(lat.reduce((a, b) => a + b, 0) / lat.length),
      mailsReceived: got.length, dup: mails.length - got.length, dP50: got.length ? pct(got, 50) : null, dP95: got.length ? pct(got, 95) : null, dMax: got.length ? Math.max(...got) : null, statuses: [...new Set(res.map((x) => x.status))] });
    console.log(JSON.stringify(results[results.length - 1]));
  }
  fs.writeFileSync(process.env.OUT, JSON.stringify(results, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
