/**
 * Учебный REST API для ПР4 по теме «Онлайн-магазин зоотоваров».
 *
 * Запуск:
 *   node mock-server.js --port 8080 --origin http://localhost:5555
 *
 * Проверка:
 *   GET  http://localhost:8080/api/__health
 *
 * Тестовые переключатели:
 *   ?__delay=1500  — искусственная задержка
 *   ?__fail=500    — принудительная ошибка сервера
 */
const http = require('http');
const { URL } = require('url');

const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const originArg = args.indexOf('--origin');
const ttlArg = args.indexOf('--ttl');
const PORT = portArg >= 0 ? Number(args[portArg + 1]) : 8080;
const ACCESS_TTL_SECONDS = ttlArg >= 0 ? Math.max(10, Number(args[ttlArg + 1]) || 60) : 900;
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
const crypto = require('crypto');
const users = [
  { id: 1, username: 'admin', password: 'admin123', email: 'admin@petshop.local', fullName: 'Администратор', role: 'admin', active: true },
  { id: 2, username: 'manager', password: 'manager123', email: 'manager@petshop.local', fullName: 'Менеджер магазина', role: 'manager', active: true },
  { id: 3, username: 'customer', password: 'customer123', email: 'customer@petshop.local', fullName: 'Покупатель', role: 'customer', active: true },
];
const accessTokens = new Map();
const refreshTokens = new Map();
const newToken = () => crypto.randomBytes(32).toString('hex');
const publicUser = u => ({ id: u.id, username: u.username, email: u.email, fullName: u.fullName, role: u.role, active: u.active });
function authUser(req) { const h = req.headers.authorization || ''; const token = h.startsWith('Bearer ') ? h.slice(7) : ''; const item = accessTokens.get(token); if (!item || item.expiresAt <= Date.now()) { if (token) accessTokens.delete(token); return null; } const user = users.find(u => u.id === item.userId); return user && user.active ? user : null; }
function issueTokens(user, sessionStartedAt = Date.now()) { const accessToken = newToken(), refreshToken = newToken(); accessTokens.set(accessToken, { userId: user.id, expiresAt: Date.now() + ACCESS_TTL_SECONDS * 1000 }); refreshTokens.set(refreshToken, { userId: user.id, expiresAt: Date.now() + REFRESH_TTL_SECONDS * 1000, sessionStartedAt }); return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS, refreshExpiresIn: REFRESH_TTL_SECONDS, user: publicUser(user) }; }
function requireRole(res, user, roles) { if (!user) { error(res, 401, 'Требуется вход в систему'); return false; } if (!roles.includes(user.role)) { error(res, 403, 'Недостаточно прав для выполнения операции'); return false; } return true; }
const ORIGIN = originArg >= 0 ? args[originArg + 1] : 'http://localhost:5555';

const clone = (v) => JSON.parse(JSON.stringify(v));
const now = () => new Date().toISOString();

let db = {};
function seed() {
  db = {
    brands: [
      { id: 1, name: 'Royal Pet', country: 'Нидерланды', description: 'Корма и товары для собак и кошек.', deletedAt: null },
      { id: 2, name: 'Happy Tail', country: 'Германия', description: 'Повседневные товары для домашних животных.', deletedAt: null },
      { id: 3, name: 'PawCare', country: 'Польша', description: 'Гигиена и уход за питомцами.', deletedAt: null },
      { id: 4, name: 'AquaLife', country: 'Чехия', description: 'Аквариумистика и товары для рыб.', deletedAt: null },
      { id: 5, name: 'Feather Home', country: 'Франция', description: 'Корм и аксессуары для птиц.', deletedAt: null },
    ],
    categories: [
      { id: 1, name: 'Корм', brandId: 1, description: 'Полнорационные и специализированные корма.', deletedAt: null },
      { id: 2, name: 'Игрушки', brandId: 1, description: 'Игрушки для домашних животных.', deletedAt: null },
      { id: 3, name: 'Уход', brandId: 3, description: 'Шампуни, средства гигиены и ухода.', deletedAt: null },
      { id: 4, name: 'Аквариумистика', brandId: 4, description: 'Товары для аквариумов и рыб.', deletedAt: null },
      { id: 5, name: 'Птицы', brandId: 5, description: 'Корм и аксессуары для птиц.', deletedAt: null },
      { id: 6, name: 'Лакомства', brandId: 2, description: 'Натуральные лакомства.', deletedAt: null },
    ],
    suppliers: [
      { id: 1, name: 'ZooSupply', brandId: 1, email: 'sales@zoosupply.lv', phone: '+37120000001', description: 'Оптовый поставщик кормов.', deletedAt: null },
      { id: 2, name: 'PetTrade', brandId: 2, email: 'info@pettrade.lv', phone: '+37120000002', description: 'Поставщик товаров повседневного спроса.', deletedAt: null },
      { id: 3, name: 'VetMarket', brandId: 3, email: 'orders@vetmarket.lv', phone: '+37120000003', description: 'Профессиональные средства ухода.', deletedAt: null },
      { id: 4, name: 'AquaPartner', brandId: 4, email: 'sales@aquapartner.lv', phone: '+37120000004', description: 'Товары для аквариумистики.', deletedAt: null },
      { id: 5, name: 'BirdWorld', brandId: 5, email: 'hello@birdworld.lv', phone: '+37120000005', description: 'Товары для птиц.', deletedAt: null },
    ],
    products: [
      { id: 1, name: 'Royal Pet Adult', sku: 'RP-001', brandId: 1, categoryIds: [1], supplierIds: [1], price: 42.9, stock: 18, description: 'Сбалансированный корм для взрослых собак.', deletedAt: null },
      { id: 2, name: 'Royal Pet Toy Ball', sku: 'RP-002', brandId: 1, categoryIds: [2], supplierIds: [1], price: 8.5, stock: 35, description: 'Прочная игрушка для активных игр.', deletedAt: null },
      { id: 3, name: 'Happy Tail Beef', sku: 'HT-003', brandId: 2, categoryIds: [1, 6], supplierIds: [2], price: 18.9, stock: 32, description: 'Сухой корм с говядиной.', deletedAt: null },
      { id: 4, name: 'PawCare Shampoo', sku: 'PC-004', brandId: 3, categoryIds: [3], supplierIds: [3], price: 9.9, stock: 24, description: 'Мягкий шампунь для регулярного ухода.', deletedAt: null },
      { id: 5, name: 'AquaLife Flakes', sku: 'AQ-005', brandId: 4, categoryIds: [4], supplierIds: [4], price: 7.5, stock: 41, description: 'Хлопья для тропических рыб.', deletedAt: null },
      { id: 6, name: 'Feather Home Mix', sku: 'FH-006', brandId: 5, categoryIds: [5], supplierIds: [5], price: 6.9, stock: 37, description: 'Зерновая смесь для попугаев.', deletedAt: null },
      { id: 7, name: 'Happy Tail Dental', sku: 'HT-007', brandId: 2, categoryIds: [3, 6], supplierIds: [2], price: 11.4, stock: 26, description: 'Лакомство для ежедневного ухода.', deletedAt: null },
      { id: 8, name: 'Royal Pet Treats', sku: 'RP-008', brandId: 1, categoryIds: [1, 6], supplierIds: [1], price: 12.3, stock: 44, description: 'Мясные лакомства для собак.', deletedAt: null },
      { id: 9, name: 'AquaLife Granules', sku: 'AQ-009', brandId: 4, categoryIds: [4], supplierIds: [4], price: 10.2, stock: 29, description: 'Гранулированный корм для рыб.', deletedAt: null },
      { id: 10, name: 'PawCare Ear Cleaner', sku: 'PC-010', brandId: 3, categoryIds: [3], supplierIds: [3], price: 8.4, stock: 26, description: 'Средство для деликатной очистки ушей.', deletedAt: null },
      { id: 11, name: 'Feather Home Swing', sku: 'FH-011', brandId: 5, categoryIds: [5, 2], supplierIds: [5], price: 13.2, stock: 17, description: 'Жёрдочка-игрушка для птиц.', deletedAt: null },
      { id: 12, name: 'Happy Tail Cat Snack', sku: 'HT-012', brandId: 2, categoryIds: [6], supplierIds: [2], price: 5.8, stock: 50, description: 'Мягкие лакомства для кошек.', deletedAt: null },
    ],
    customers: [
      { id: 1, name: 'Анна Петрова', email: 'anna@example.com', phone: '+37129000001', card: { number: 'PET-0001', level: 'Gold', bonusPoints: 840 }, deletedAt: null },
      { id: 2, name: 'Иван Смирнов', email: 'ivan@example.com', phone: '+37129000002', card: { number: 'PET-0002', level: 'Silver', bonusPoints: 320 }, deletedAt: null },
      { id: 3, name: 'Мария Озолина', email: 'maria@example.com', phone: '+37129000003', card: { number: 'PET-0003', level: 'Bronze', bonusPoints: 90 }, deletedAt: null },
    ],
  };
}
seed();

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  });
  res.end(JSON.stringify(body));
}
function empty(res, status = 204) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  });
  res.end();
}
function error(res, status, message, errors) {
  json(res, status, { message, ...(errors ? { errors } : {}) });
}
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => raw += chunk);
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (_) { reject(new Error('Некорректный JSON')); }
    });
    req.on('error', reject);
  });
}
function idOf(v) { return Number.parseInt(String(v), 10); }
function activeRows(entity, includeDeleted) { return db[entity].filter(x => includeDeleted || !x.deletedAt); }
function fieldValue(item, field) {
  if (field === 'country') return item.country ?? '';
  if (field === 'email') return item.email ?? '';
  if (field === 'price') return Number(item.price ?? 0);
  if (field === 'stock') return Number(item.stock ?? 0);
  if (field === 'points') return Number(item.card?.bonusPoints ?? 0);
  if (field === 'brandId') return Number(item.brandId ?? 0);
  return String(item.name ?? '').toLowerCase();
}
function searchable(item) {
  return Object.values(item).flatMap(v => Array.isArray(v) ? v : [v]).map(v => typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)).join(' ').toLowerCase();
}
function filtered(entity, url) {
  let rows = activeRows(entity, url.searchParams.get('deleted') === '1');
  const search = (url.searchParams.get('search') || '').trim().toLowerCase();
  if (search) rows = rows.filter(x => searchable(x).includes(search));
  const filter = url.searchParams.get('filter');
  if (filter) {
    const id = idOf(filter);
    if (entity === 'products') rows = rows.filter(x => x.brandId === id || x.categoryIds.includes(id));
    if (entity === 'categories' || entity === 'suppliers') rows = rows.filter(x => x.brandId === id);
  }
  const [sortField, direction] = (url.searchParams.get('sort') || 'name,asc').split(',');
  rows.sort((a, b) => {
    const av = fieldValue(a, sortField), bv = fieldValue(b, sortField);
    const r = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'ru');
    return direction === 'desc' ? -r : r;
  });
  return rows;
}
function list(res, entity, url) {
  const rows = filtered(entity, url);
  const page = Math.max(1, idOf(url.searchParams.get('page') || 1));
  const size = Math.min(100, Math.max(1, idOf(url.searchParams.get('size') || 10)));
  const total = rows.length;
  const start = (page - 1) * size;
  json(res, 200, { items: rows.slice(start, start + size).map(clone), page, size, total, totalPages: Math.max(1, Math.ceil(total / size)) });
}
function validate(entity, data) {
  const e = {};
  if (!String(data.name || '').trim()) e.name = 'Название обязательно';
  if (entity === 'products') {
    if (!String(data.sku || '').trim()) e.sku = 'SKU обязателен';
    if (!(Number(data.price) >= 0)) e.price = 'Цена должна быть неотрицательной';
    if (!Number.isInteger(Number(data.stock)) || Number(data.stock) < 0) e.stock = 'Остаток должен быть целым неотрицательным числом';
    if (!Number.isInteger(Number(data.brandId))) e.brandId = 'Выберите бренд';
    if (!Array.isArray(data.categoryIds) || data.categoryIds.length === 0) e.categoryIds = 'Выберите хотя бы одну категорию';
    if (!Array.isArray(data.supplierIds) || data.supplierIds.length === 0) e.supplierIds = 'Выберите хотя бы одного поставщика';
  }
  if (entity === 'categories' || entity === 'suppliers') if (!Number.isInteger(Number(data.brandId))) e.brandId = 'Выберите бренд';
  if (entity === 'suppliers' && !/^\S+@\S+\.\S+$/.test(String(data.email || ''))) e.email = 'Введите корректный email';
  if (entity === 'customers' && !/^\S+@\S+\.\S+$/.test(String(data.email || ''))) e.email = 'Введите корректный email';
  return e;
}
function uniqueConflict(entity, data, exceptId) {
  if (entity === 'products') return db.products.some(x => x.sku.toLowerCase() === String(data.sku || '').toLowerCase() && x.id !== exceptId);
  if (entity === 'customers') return db.customers.some(x => x.email.toLowerCase() === String(data.email || '').toLowerCase() && x.id !== exceptId);
  return false;
}

async function main(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.searchParams.has('__delay')) await new Promise(r => setTimeout(r, Math.max(0, idOf(url.searchParams.get('__delay')))));
  if (url.searchParams.has('__fail')) return error(res, idOf(url.searchParams.get('__fail')) || 500, 'Принудительная тестовая ошибка');
  if (req.method === 'OPTIONS') return empty(res);
  if (url.pathname === '/api/__health' && req.method === 'GET') return json(res, 200, { status: 'ok', service: 'pet-shop-api', time: now() });
  if (url.pathname === '/api/__reset' && req.method === 'POST') { const resetUser = authUser(req); if (!requireRole(res, resetUser, ['admin'])) return; seed(); return json(res, 200, { ok: true }); }
  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    const b = await parseBody(req); const u = users.find(x => x.username.toLowerCase() === String(b.username || '').toLowerCase() && x.password === String(b.password || '') && x.active);
    return u ? json(res, 200, issueTokens(u)) : error(res, 401, 'Неверный логин или пароль');
  }
  if (url.pathname === '/api/auth/register' && req.method === 'POST') {
    const b = await parseBody(req); const errs = {};
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(String(b.username || ''))) errs.username = 'Логин: 3–32 символа, латиница, цифры, . _ -';
    if (users.some(x => x.username.toLowerCase() === String(b.username || '').toLowerCase())) errs.username = 'Этот логин уже занят';
    if (!/^\S+@\S+\.\S+$/.test(String(b.email || ''))) errs.email = 'Укажите корректный email';
    if (String(b.password || '').length < 8 || !/\d/.test(String(b.password || '')) || !/[^A-Za-z0-9]/.test(String(b.password || ''))) errs.password = 'Не менее 8 символов, цифра и спецсимвол';
    if (!String(b.fullName || '').trim()) errs.fullName = 'Укажите имя';
    if (Object.keys(errs).length) return error(res, 422, 'Проверьте поля регистрации', errs);
    const u = { id: Math.max(0, ...users.map(x => x.id)) + 1, username: String(b.username), password: String(b.password), email: String(b.email), fullName: String(b.fullName), role: 'customer', active: true }; users.push(u); return json(res, 201, { user: publicUser(u) });
  }
  if (url.pathname === '/api/auth/refresh' && req.method === 'POST') {
    const b = await parseBody(req); const r = refreshTokens.get(String(b.refreshToken || ''));
    if (!r || r.expiresAt <= Date.now() || Date.now() - r.sessionStartedAt >= 8 * 60 * 60 * 1000) { refreshTokens.delete(String(b.refreshToken || '')); return error(res, 401, 'Токен обновления недействителен, истёк или превышена максимальная длительность сессии'); }
    refreshTokens.delete(String(b.refreshToken)); for (const [t, v] of accessTokens) if (v.userId === r.userId) accessTokens.delete(t);
    const u = users.find(x => x.id === r.userId); return u ? json(res, 200, issueTokens(u, r.sessionStartedAt)) : error(res, 401, 'Пользователь не найден');
  }
  if (url.pathname === '/api/auth/me' && req.method === 'GET') { const u = authUser(req); return u ? json(res, 200, publicUser(u)) : error(res, 401, 'Сессия истекла'); }
  if (url.pathname === '/api/auth/logout' && req.method === 'POST') { const b = await parseBody(req); const token = (req.headers.authorization || '').replace(/^Bearer /, ''); accessTokens.delete(token); refreshTokens.delete(String(b.refreshToken || '')); return json(res, 200, { ok: true }); }
  if (url.pathname === '/api/admin/users' && req.method === 'GET') { const u = authUser(req); if (!requireRole(res, u, ['admin'])) return; return json(res, 200, { items: users.map(publicUser) }); }
  if (url.pathname === '/api/admin/stats' && req.method === 'GET') { const u = authUser(req); if (!requireRole(res, u, ['admin'])) return; const stats = {}; for (const entity of ['products','brands','categories','suppliers','customers']) stats[entity] = { total: db[entity].length, active: db[entity].filter(x => !x.deletedAt).length, deleted: db[entity].filter(x => x.deletedAt).length }; return json(res, 200, { stats, users: { total: users.length, active: users.filter(x => x.active).length, blocked: users.filter(x => !x.active).length } }); }

  if (url.pathname === '/api/admin/users' && req.method === 'PATCH') { const u = authUser(req); if (!requireRole(res, u, ['admin'])) return; const b = await parseBody(req); const target = users.find(x => x.id === Number(b.id)); if (!target) return error(res, 404, 'Пользователь не найден'); if (['admin','manager','customer'].includes(b.role)) target.role = b.role; if (typeof b.active === 'boolean') target.active = b.active; return json(res, 200, publicUser(target)); }

  const match = url.pathname.match(/^\/api\/(products|brands|categories|suppliers|customers)(?:\/(.*))?$/);
  if (!match) return error(res, 404, 'Маршрут не найден');
  const entity = match[1];
  const tail = match[2] || '';
  const user = authUser(req);
  if (!user) return error(res, 401, 'Для работы с магазином необходимо войти');
  const isRead = req.method === 'GET';
  const isAdmin = user.role === 'admin';
  const isManager = user.role === 'manager' || isAdmin;
  if (isRead) {
    if (entity === 'customers' && !isManager) return error(res, 403, 'Просмотр клиентов доступен менеджеру и администратору');
    if (url.searchParams.get('deleted') === '1' && !isAdmin) return error(res, 403, 'Просмотр удалённых записей доступен только администратору');
  } else {
    if (!isManager) return error(res, 403, 'Изменять каталог может только менеджер или администратор');
    if ((req.method === 'DELETE' && url.searchParams.get('hard') === 'true') || /\/restore$/.test(tail) || tail === 'bulk-delete') { if (!isAdmin) return error(res, 403, 'Физическое удаление, восстановление и массовое удаление доступны только администратору'); }
  }

  if (req.method === 'GET' && !tail) return list(res, entity, url);
  if (req.method === 'GET' && tail === 'exists') {
    const field = url.searchParams.get('field') || '';
    const value = url.searchParams.get('value') || '';
    const exceptId = url.searchParams.get('exceptId') ? idOf(url.searchParams.get('exceptId')) : null;
    const exists = db[entity].some(x => x.deletedAt == null && x.id !== exceptId && String(fieldValue(x, field)).toLowerCase() === value.toLowerCase());
    return json(res, 200, { exists });
  }
  if (req.method === 'POST' && tail === 'bulk-delete') {
    const body = await parseBody(req);
    const ids = Array.isArray(body.ids) ? body.ids.map(idOf) : [];
    let count = 0;
    db[entity].forEach(x => { if (ids.includes(x.id) && !x.deletedAt) { x.deletedAt = now(); count++; } });
    return json(res, 200, { count });
  }
  if (req.method === 'GET' && /^\d+$/.test(tail)) {
    const item = db[entity].find(x => x.id === idOf(tail));
    return item ? json(res, 200, clone(item)) : error(res, 404, 'Запись не найдена');
  }
  if (req.method === 'POST' && !tail) {
    const body = await parseBody(req);
    const errors = validate(entity, body);
    if (Object.keys(errors).length) return error(res, 422, 'Ошибка валидации', errors);
    if (uniqueConflict(entity, body, null)) return error(res, 422, 'Нарушено уникальное ограничение', entity === 'products' ? { sku: 'Товар с таким SKU уже существует' } : { email: 'Клиент с таким email уже существует' });
    const id = Math.max(0, ...db[entity].map(x => x.id)) + 1;
    const item = { ...clone(body), id, deletedAt: null };
    if (entity === 'customers' && !item.card) item.card = { number: `PET-${String(id).padStart(4, '0')}`, level: 'Bronze', bonusPoints: 0 };
    db[entity].push(item);
    return json(res, 201, item);
  }
  if (/^\d+$/.test(tail) && req.method === 'PUT') {
    const id = idOf(tail);
    const index = db[entity].findIndex(x => x.id === id);
    if (index < 0) return error(res, 404, 'Запись не найдена');
    const body = await parseBody(req);
    const errors = validate(entity, body);
    if (Object.keys(errors).length) return error(res, 422, 'Ошибка валидации', errors);
    if (uniqueConflict(entity, body, id)) return error(res, 422, 'Нарушено уникальное ограничение', entity === 'products' ? { sku: 'Товар с таким SKU уже существует' } : { email: 'Клиент с таким email уже существует' });
    db[entity][index] = { ...clone(body), id, deletedAt: db[entity][index].deletedAt ?? null };
    return json(res, 200, clone(db[entity][index]));
  }
  if (/^\d+\/restore$/.test(tail) && req.method === 'PATCH') {
    const id = idOf(tail.split('/')[0]);
    const item = db[entity].find(x => x.id === id);
    if (!item) return error(res, 404, 'Запись не найдена');
    item.deletedAt = null;
    return json(res, 200, clone(item));
  }
  if (/^\d+$/.test(tail) && req.method === 'DELETE') {
    const id = idOf(tail);
    const index = db[entity].findIndex(x => x.id === id);
    if (index < 0) return error(res, 404, 'Запись не найдена');
    if (url.searchParams.get('hard') === 'true') {
      if (entity === 'brands' && db.products.some(p => p.brandId === id)) return error(res, 409, 'Нельзя физически удалить бренд: на него ссылаются товары');
      if (entity === 'categories' && db.products.some(p => p.categoryIds.includes(id))) return error(res, 409, 'Нельзя физически удалить категорию: на неё ссылаются товары');
      if (entity === 'suppliers' && db.products.some(p => p.supplierIds.includes(id))) return error(res, 409, 'Нельзя физически удалить поставщика: на него ссылаются товары');
      db[entity].splice(index, 1);
    } else {
      db[entity][index].deletedAt = now();
    }
    return empty(res, 204);
  }
  return error(res, 405, 'Операция не поддерживается');
}

http.createServer((req, res) => {
  main(req, res).catch(err => error(res, 500, err.message || 'Внутренняя ошибка'));
}).listen(PORT, () => {
  console.log(`Pet Shop API: http://localhost:${PORT}/api`);
  console.log(`CORS origin: ${ORIGIN}`);
  console.log('Health: GET /api/__health');
  console.log('Reset:  POST /api/__reset');
  console.log(`Access token TTL: ${ACCESS_TTL_SECONDS}s`);
  console.log('Demo accounts: admin/admin123, manager/manager123, customer/customer123');
});
