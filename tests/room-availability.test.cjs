const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(request) {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/api/modules/facility.api.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(key => {
    if (key === '../client') return { apiClient: { get: request } };
    if (key === '../endpoints') return { ENDPOINTS: { FACILITY: { ROOMS: '/rooms', MAPS: '/maps', ENDPOINTS: '/endpoints', FLOORS: '/floors' } } };
    throw Error('Unexpected import ' + key);
  }, module, module.exports);
  return module.exports.facilityApi;
}

test('mobile room lists and pagination exclude old-map rooms even on the same floor', async () => {
  const catalogs = {
    rooms: [{ roomId: 'old', floorId: 'f', active: true }, { roomId: 'new', floorId: 'f', active: true }],
    maps: [{ mapId: 'a', floorId: 'f', status: 'INACTIVE' }, { mapId: 'b', floorId: 'f', status: 'ACTIVE' }],
    floors: [{ floorId: 'f', active: true }],
    endpoints: [...Array.from({ length: 100 }, (_, i) => ({ endpointId: i, roomId: 'old', mapId: 'a', active: true })), { roomId: 'new', mapId: 'b', active: true }],
  };
  const api = load(async resource => {
    const url = new URL(resource, 'http://fixture'), rows = catalogs[url.pathname.slice(1)];
    const page = Number(url.searchParams.get('page')), size = Number(url.searchParams.get('size'));
    return { content: rows.slice(page * size, (page + 1) * size), totalPages: Math.ceil(rows.length / size) };
  });
  assert.deepEqual((await api.getAllRooms()).map(room => room.roomId), ['new']);
  const page = await api.getRooms(0, 10);
  assert.equal(page.totalElements, 1); assert.equal(page.totalPages, 1); assert.equal(page.last, true);
  catalogs.maps[0].status = 'ACTIVE'; catalogs.maps[1].status = 'INACTIVE';
  assert.deepEqual((await api.getAllRooms()).map(room => room.roomId), ['old']);
});

test('mobile respects backend operational flags without additional catalogs', async () => {
  const api = load(async resource => {
    assert.ok(resource.startsWith('/rooms?'));
    return { content: [{ roomId: 'a', active: true, operational: true }, { roomId: 'b', active: true, operational: false }], totalPages: 1 };
  });
  assert.deepEqual((await api.getAllRooms()).map(room => room.roomId), ['a']);
});
