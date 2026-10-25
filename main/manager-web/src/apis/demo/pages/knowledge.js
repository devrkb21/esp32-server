// Demo fixtures of the knowledge base pages (owner: web-knowledge). Synthetic sample data only:
// generic topics, no real people, products or figures. State lives in memory so create, delete,
// upload and parse visibly work in the demo build.
const DAY = 86400000;
const now = Date.now();
const at = (daysAgo) => new Date(now - daysAgo * DAY).toISOString();

const ragModels = [
  { id: 'rag-demo-1', modelName: 'RAGFlow (demo)' },
  { id: 'rag-demo-2', modelName: 'RAGFlow backup (demo)' },
];

let seq = 100;
const bases = [
  { id: 'kb1', datasetId: 'ds-recipes', ragModelId: 'rag-demo-1', name: 'Household recipes', description: 'Everyday Bangladeshi dishes: rice, dal, bhorta and snacks, with cooking times.', status: 1, documentCount: 4, chunkCount: 86, createdAt: at(40), updatedAt: at(2) },
  { id: 'kb2', datasetId: 'ds-science', ragModelId: 'rag-demo-1', name: 'Science class notes', description: 'Notes for a class five science course: plants, water, weather and the solar system.', status: 1, documentCount: 3, chunkCount: 41, createdAt: at(31), updatedAt: at(6) },
  { id: 'kb3', datasetId: 'ds-office', ragModelId: 'rag-demo-2', name: 'Office handbook sample', description: 'A sample office handbook: working hours, leave and meeting rooms.', status: 0, documentCount: 1, chunkCount: 12, createdAt: at(20), updatedAt: at(20) },
  { id: 'kb4', datasetId: 'ds-plants', ragModelId: 'rag-demo-1', name: 'Plant care', description: 'Watering and sunlight notes for common balcony plants.', status: 1, documentCount: 0, chunkCount: 0, createdAt: at(1), updatedAt: at(1), errorMessage: 'The embedding service did not respond. Check the RAG model settings.' },
];

const docs = {
  'ds-recipes': [
    { id: 'doc-r1', name: 'rice-and-dal.pdf', parseStatusCode: 3, createdAt: at(39) },
    { id: 'doc-r2', name: 'bhorta-collection.docx', parseStatusCode: 3, createdAt: at(30) },
    { id: 'doc-r3', name: 'evening-snacks.md', parseStatusCode: 0, createdAt: at(3) },
    { id: 'doc-r4', name: 'cooking-times.xlsx', parseStatusCode: 4, createdAt: at(2) },
  ],
  'ds-science': [
    { id: 'doc-s1', name: 'plants-and-sunlight.pdf', parseStatusCode: 3, createdAt: at(30) },
    { id: 'doc-s2', name: 'water-cycle.pptx', parseStatusCode: 1, chunkNum: 7, totalChunkNum: 20, createdAt: at(6) },
    { id: 'doc-s3', name: 'solar-system.txt', parseStatusCode: 2, createdAt: at(6) },
  ],
  'ds-office': [
    { id: 'doc-o1', name: 'handbook-sample.pdf', parseStatusCode: 3, createdAt: at(20) },
  ],
  'ds-plants': [],
};

const passages = {
  'doc-r1': [
    'Wash the rice two or three times until the water runs almost clear, then soak it for twenty minutes before cooking.',
    'For masoor dal, boil the lentils with turmeric and salt until soft, then finish with a tempering of onion, garlic and dried chilli.',
    'Leftover dal keeps for a day in the fridge; add a little hot water when reheating.',
  ],
  'doc-r2': [
    'আলু ভর্তা: সেদ্ধ আলু চটকে নিন, তারপর সরিষার তেল, পেঁয়াজকুচি, কাঁচা মরিচ আর লবণ দিয়ে মেখে নিন।',
    'Begun bhorta: roast the aubergine directly on the flame until the skin chars, peel it and mash with mustard oil and onion.',
  ],
  'doc-s1': [
    'Plants make their food in their leaves using sunlight, water and air. This is called photosynthesis.',
    'A plant kept away from light grows tall and pale because it is searching for the sun.',
    'Roots hold the plant in the soil and carry water up to the stem and leaves.',
  ],
  'doc-o1': [
    'Meeting rooms are booked through the shared calendar. Please free the room if a meeting is cancelled.',
    'Leave requests should be sent to your team lead at least three working days in advance.',
  ],
};

function chunksOf(docId) {
  const base = passages[docId] || [];
  // Longer documents: repeat the sample passages so pagination has something to page through.
  const out = [];
  for (let i = 0; i < base.length * 5; i += 1) out.push({ id: `${docId}-c${i + 1}`, content: base[i % base.length] });
  return out;
}

const parseStarted = {};
function settle(doc) {
  const t = parseStarted[doc.id];
  if (doc.parseStatusCode === 1 && t && Date.now() - t > 7000) {
    doc.parseStatusCode = 3;
    if (!passages[doc.id]) passages[doc.id] = ['A synthetic passage of the uploaded sample document, shown in the demo build.'];
  } else if (doc.parseStatusCode === 1 && t) {
    doc.chunkNum = Math.min(19, Math.round(((Date.now() - t) / 7000) * 20));
    doc.totalChunkNum = 20;
  }
  return doc;
}

const idFrom = (path, re) => (path.match(re) || [])[1];
const page = (list, q) => {
  const p = Math.max(1, Number(q.page) || 1);
  const size = Math.max(1, Number(q.page_size) || 10);
  return { list: list.slice((p - 1) * size, p * size), total: list.length };
};

export default [
  { method: 'GET', url: /\/datasets\/rag-models$/, reply: () => ragModels },

  { method: 'GET', url: /\/datasets$/, reply: (req) => {
    const name = String(req.query.name || '').trim().toLowerCase();
    const list = bases.filter((b) => !name || b.name.toLowerCase().includes(name));
    return page(list, req.query);
  } },

  { method: 'POST', url: /\/datasets$/, reply: (req) => {
    const body = typeof req.data === 'string' ? JSON.parse(req.data) : (req.data || {});
    seq += 1;
    const kb = { id: `kb${seq}`, datasetId: `ds-new-${seq}`, documentCount: 0, chunkCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...body };
    bases.unshift(kb);
    docs[kb.datasetId] = [];
    return kb;
  } },

  { method: 'DELETE', url: /\/datasets\/batch$/, reply: (req) => {
    const ids = String(req.query.ids || '').split(',');
    for (let i = bases.length - 1; i >= 0; i -= 1) if (ids.includes(bases[i].datasetId)) bases.splice(i, 1);
    return null;
  } },

  { method: 'PUT', url: /\/datasets\/[^/]+$/, reply: (req) => {
    const id = idFrom(req.path, /\/datasets\/([^/]+)$/);
    const body = typeof req.data === 'string' ? JSON.parse(req.data) : (req.data || {});
    const kb = bases.find((b) => b.datasetId === id);
    if (kb) Object.assign(kb, body, { updatedAt: new Date().toISOString() });
    return kb || null;
  } },

  { method: 'DELETE', url: /\/datasets\/[^/]+$/, reply: (req) => {
    const id = idFrom(req.path, /\/datasets\/([^/]+)$/);
    const i = bases.findIndex((b) => b.datasetId === id);
    if (i >= 0) bases.splice(i, 1);
    return null;
  } },

  { method: 'GET', url: /\/datasets\/[^/]+\/documents$/, reply: (req) => {
    const id = idFrom(req.path, /\/datasets\/([^/]+)\/documents$/);
    const name = String(req.query.name || '').trim().toLowerCase();
    const list = (docs[id] || []).map(settle).filter((d) => !name || d.name.toLowerCase().includes(name));
    return page(list, req.query);
  } },

  { method: 'POST', url: /\/datasets\/[^/]+\/documents$/, reply: (req) => {
    const id = idFrom(req.path, /\/datasets\/([^/]+)\/documents$/);
    const file = req.data && typeof req.data.get === 'function' ? req.data.get('file') : null;
    seq += 1;
    const doc = { id: `doc-new-${seq}`, name: (file && file.name) || `upload-${seq}.pdf`, parseStatusCode: 0, createdAt: new Date().toISOString() };
    (docs[id] = docs[id] || []).unshift(doc);
    const kb = bases.find((b) => b.datasetId === id);
    if (kb) kb.documentCount = docs[id].length;
    return doc;
  } },

  { method: 'POST', url: /\/datasets\/[^/]+\/chunks$/, reply: (req) => {
    const id = idFrom(req.path, /\/datasets\/([^/]+)\/chunks$/);
    const body = typeof req.data === 'string' ? JSON.parse(req.data) : (req.data || {});
    (body.document_ids || []).forEach((docId) => {
      const doc = (docs[id] || []).find((d) => d.id === docId);
      if (doc) { doc.parseStatusCode = 1; doc.chunkNum = 0; doc.totalChunkNum = 20; parseStarted[docId] = Date.now(); }
    });
    return null;
  } },

  { method: 'DELETE', url: /\/datasets\/[^/]+\/documents\/[^/]+$/, reply: (req) => {
    const [, ds, docId] = req.path.match(/\/datasets\/([^/]+)\/documents\/([^/]+)$/) || [];
    const list = docs[ds] || [];
    const i = list.findIndex((d) => d.id === docId);
    if (i >= 0) list.splice(i, 1);
    const kb = bases.find((b) => b.datasetId === ds);
    if (kb) kb.documentCount = list.length;
    return null;
  } },

  { method: 'GET', url: /\/datasets\/[^/]+\/documents\/[^/]+\/chunks$/, reply: (req) => {
    const [, , docId] = req.path.match(/\/datasets\/([^/]+)\/documents\/([^/]+)\/chunks$/) || [];
    const doc = Object.values(docs).flat().find((d) => d.id === docId);
    const list = doc && doc.parseStatusCode === 3 ? chunksOf(docId) : [];
    return page(list, req.query);
  } },

  { method: 'POST', url: /\/datasets\/[^/]+\/retrieval-test$/, reply: (req) => {
    const id = idFrom(req.path, /\/datasets\/([^/]+)\/retrieval-test$/);
    const body = typeof req.data === 'string' ? JSON.parse(req.data) : (req.data || {});
    const words = String(body.question || '').toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const hits = [];
    (docs[id] || []).filter((d) => d.parseStatusCode === 3).forEach((d) => {
      (passages[d.id] || []).forEach((content) => {
        const text = content.toLowerCase();
        const match = words.filter((w) => text.includes(w)).length;
        hits.push({ content, document_keyword: d.name, similarity: Math.min(0.97, 0.31 + match * 0.17 + (content.length % 7) / 100) });
      });
    });
    hits.sort((a, b) => b.similarity - a.similarity);
    return { chunks: hits.slice(0, 4), total: Math.min(4, hits.length) };
  } },
];
