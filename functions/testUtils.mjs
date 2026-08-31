/**
 * Phase 9 — in-memory fakes for the Firestore Admin SDK surface the sync code
 * uses, and for the Google Sheets REST API. Enough to exercise real logic
 * (transactions, batches, queries, retries, cell ranges) without an emulator.
 */

const DELETE = Symbol("FieldValue.delete");
const SERVER_TS = Symbol("FieldValue.serverTimestamp");

export const FieldValue = {
  delete: () => DELETE,
  serverTimestamp: () => SERVER_TS,
};

function applyMerge(target, patch) {
  const out = { ...target };
  for (const [k, v] of Object.entries(patch)) {
    if (v === DELETE) delete out[k];
    else if (v === SERVER_TS) out[k] = new Date();
    else if (v && typeof v === "object" && !Array.isArray(v))
      out[k] = applyMerge(out[k] || {}, v);
    else out[k] = v;
  }
  return out;
}

let idSeq = 0;

export function makeFakeFirestore(seed = {}) {
  /** @type {Map<string, Map<string, object>>} */
  const store = new Map();
  for (const [coll, docs] of Object.entries(seed)) {
    const m = new Map();
    for (const d of docs) m.set(d.id, { ...d });
    store.set(coll, m);
  }
  const coll = (name) => {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name);
  };

  const docRef = (name, id) => ({
    __coll: name,
    id,
    async get() {
      const raw = coll(name).get(id);
      return {
        exists: raw !== undefined,
        id,
        data: () => (raw === undefined ? undefined : { ...raw }),
        ref: this,
      };
    },
    async set(data, opts = {}) {
      const prev = coll(name).get(id) || {};
      coll(name).set(id, opts.merge ? applyMerge(prev, data) : applyMerge({}, data));
    },
  });

  function query(name, ops = []) {
    return {
      where: (f, op, v) => query(name, [...ops, { t: "where", f, op, v }]),
      orderBy: (f, dir = "asc") => query(name, [...ops, { t: "order", f, dir }]),
      limit: (n) => query(name, [...ops, { t: "limit", n }]),
      offset: (n) => query(name, [...ops, { t: "offset", n }]),
      async get() {
        let rows = [...coll(name).entries()].map(([id, data]) => ({ id, data }));
        for (const o of ops) {
          if (o.t === "where")
            rows = rows.filter((r) => {
              const val = r.data[o.f];
              if (o.op === "==") return val === o.v;
              throw new Error(`fake: unsupported op ${o.op}`);
            });
          if (o.t === "order")
            rows.sort((a, b) =>
              (a.data[o.f] > b.data[o.f] ? 1 : -1) * (o.dir === "desc" ? -1 : 1),
            );
        }
        for (const o of ops) {
          if (o.t === "offset") rows = rows.slice(o.n);
          if (o.t === "limit") rows = rows.slice(0, o.n);
        }
        return {
          empty: rows.length === 0,
          size: rows.length,
          docs: rows.map((r) => ({
            id: r.id,
            data: () => ({ ...r.data }),
            ref: docRef(name, r.id),
          })),
        };
      },
    };
  }

  const collectionRef = (name) => ({
    doc: (id) => docRef(name, id ?? `gen-${++idSeq}`),
    async add(data) {
      const id = `gen-${++idSeq}`;
      coll(name).set(id, applyMerge({}, data));
      return docRef(name, id);
    },
    where: (...a) => query(name).where(...a),
    orderBy: (...a) => query(name).orderBy(...a),
    limit: (...a) => query(name).limit(...a),
    offset: (...a) => query(name).offset(...a),
    async get() {
      return query(name).get();
    },
  });

  const db = {
    collection: collectionRef,
    batch() {
      const jobs = [];
      return {
        set: (ref, data, opts) => jobs.push(() => ref.set(data, opts)),
        delete: (ref) =>
          jobs.push(() => {
            coll(ref.__coll).delete(ref.id);
          }),
        async commit() {
          for (const j of jobs) await j();
        },
      };
    },
    async runTransaction(fn) {
      const tx = {
        async get(refOrQuery) {
          return refOrQuery.get();
        },
        set: (ref, data, opts) => {
          const prev = coll(ref.__coll).get(ref.id) || {};
          coll(ref.__coll).set(
            ref.id,
            opts?.merge ? applyMerge(prev, data) : applyMerge({}, data),
          );
        },
        delete: (ref) => {
          coll(ref.__coll).delete(ref.id);
        },
      };
      return fn(tx);
    },
    __dump: (name) =>
      Object.fromEntries([...coll(name).entries()].map(([id, d]) => [id, { ...d }])),
  };
  return db;
}

/**
 * Replace global.fetch with a fake Google Sheets v4 backend.
 * @param {{ sheets?: string[], values?: Record<string,string[][]>, failFirst?: number, failStatus?: number }} cfg
 */
export function installFakeSheets(cfg = {}) {
  const state = {
    sheets: new Set(cfg.sheets || []),
    values: { ...(cfg.values || {}) },
    calls: [],
  };
  let toFail = cfg.failFirst || 0;
  const real = global.fetch;

  const unquote = (s) => s.replace(/^'|'$/g, "").replace(/''/g, "'");
  const parseRange = (raw) => {
    const decoded = decodeURIComponent(raw);
    const bang = decoded.indexOf("!");
    return bang < 0 ? unquote(decoded) : unquote(decoded.slice(0, bang));
  };

  global.fetch = async (url, init = {}) => {
    state.calls.push({ url, method: init.method || "GET" });
    if (toFail > 0) {
      toFail -= 1;
      return {
        ok: false,
        status: cfg.failStatus || 503,
        async json() {
          return { error: { message: "transient" } };
        },
      };
    }
    const u = new URL(url);
    const json = (body, status = 200) => ({
      ok: status < 400,
      status,
      async json() {
        return body;
      },
    });

    // GET spreadsheet metadata
    if (init.method === undefined && u.pathname.match(/\/spreadsheets\/[^/]+$/)) {
      return json({
        sheets: [...state.sheets].map((title) => ({ properties: { title } })),
      });
    }
    // spreadsheet-level batchUpdate — addSheet (NOT /values:batchUpdate)
    if (u.pathname.match(/\/spreadsheets\/[^/]+:batchUpdate$/)) {
      const body = JSON.parse(init.body || "{}");
      for (const r of body.requests || [])
        if (r.addSheet) state.sheets.add(r.addSheet.properties.title);
      return json({ replies: [] });
    }
    // values:batchGet
    if (u.pathname.includes("/values:batchGet")) {
      const ranges = u.searchParams.getAll("ranges");
      return json({
        valueRanges: ranges.map((r) => {
          const tab = parseRange(r);
          return { range: `'${tab}'!A1:ZZ`, values: state.values[tab] || [] };
        }),
      });
    }
    // values:batchUpdate (writeCells)
    if (u.pathname.match(/\/values:batchUpdate$/)) {
      const body = JSON.parse(init.body || "{}");
      for (const d of body.data || []) {
        const tab = parseRange(d.range);
        const m = decodeURIComponent(d.range).match(/!([A-Z]+)(\d+)$/);
        if (!m) continue;
        const colLetters = m[1];
        let col = 0;
        for (const ch of colLetters) col = col * 26 + (ch.charCodeAt(0) - 64);
        col -= 1;
        const row = Number(m[2]) - 1;
        state.values[tab] = state.values[tab] || [];
        state.values[tab][row] = state.values[tab][row] || [];
        state.values[tab][row][col] = d.values[0][0];
      }
      return json({});
    }
    // values/{range}:clear
    if (u.pathname.match(/\/values\/[^/]+:clear$/)) {
      const tab = parseRange(u.pathname.split("/values/")[1].replace(":clear", ""));
      state.values[tab] = [];
      return json({});
    }
    // values/{range}  (PUT full matrix)
    if (init.method === "PUT" && u.pathname.includes("/values/")) {
      const rangePart = u.pathname.split("/values/")[1];
      const tab = parseRange(rangePart);
      const body = JSON.parse(init.body || "{}");
      state.values[tab] = body.values;
      return json({ updatedRows: body.values.length });
    }
    return json({ error: { message: `fake: unhandled ${url}` } }, 500);
  };

  return {
    state,
    restore() {
      global.fetch = real;
    },
  };
}
