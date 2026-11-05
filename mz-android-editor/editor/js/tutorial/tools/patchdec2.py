import sys, glob, json, struct, os, collections
RPG = sys.argv[1]
P = RPG + '/resource/patch'
ND = RPG + '/newdata/data'
ops = collections.Counter()

def sort_keys(o):
    if isinstance(o, dict):
        return {k: sort_keys(o[k]) for k in sorted(o.keys())}
    if isinstance(o, list):
        return [sort_keys(x) for x in o]
    return o

def js_num(o):
    return o

def compact(o):
    return json.dumps(sort_keys(o), ensure_ascii=False, separators=(',', ':')).encode('utf-8')

def dec(d, base):
    size = struct.unpack_from('<I', d, 0)[0]
    out = bytearray(); i = 4
    while i < len(d):
        op = d[i]; i += 1
        ops[op] += 1
        if op == 0x00:
            n = d[i] + 1; i += 1; out += d[i:i + n]; i += n
        elif op == 0x01:
            n = (d[i] | d[i + 1] << 8) + 1; i += 2; out += d[i:i + n]; i += n
        elif op == 0xff:
            pos = d[i] | d[i + 1] << 8; n = d[i + 2] + 1; i += 3; out += base[pos:pos + n]
        elif op == 0xfe:
            pos = d[i] | d[i + 1] << 8; n = (d[i + 2] | d[i + 3] << 8) + 1; i += 4; out += base[pos:pos + n]
        elif op == 0xfd:
            pos = struct.unpack_from('<I', d, i)[0]; n = d[i + 4] + 1; i += 5; out += base[pos:pos + n]
        elif op == 0xfc:
            pos = struct.unpack_from('<I', d, i)[0]; n = (d[i + 4] | d[i + 5] << 8) + 1; i += 6; out += base[pos:pos + n]
        else:
            raise ValueError(f'op {op:#x} at {i-1}')
    return size, bytes(out)

mode = sys.argv[2]
prev = {}
steps = sorted({int(os.path.basename(os.path.dirname(os.path.dirname(f)))[4:]) for f in glob.glob(P + '/step*/data/*-patch')})
bad = 0; total = 0
for s in steps:
    cur = {}
    for f in sorted(glob.glob(P + f'/step{s}/data/*-patch')):
        name = os.path.basename(f)[:-6]
        if mode == 'chain' and name in prev:
            base = prev[name]
        else:
            nd = os.path.join(ND, name)
            base = compact(json.load(open(nd, encoding='utf-8'))) if os.path.exists(nd) else b''
            if mode == 'raw' and os.path.exists(nd):
                base = open(nd, 'rb').read()
        total += 1
        try:
            size, out = dec(open(f, 'rb').read(), base)
            json.loads(out.decode('utf-8'))
            if size != len(out):
                raise ValueError(f'size {size} != {len(out)}')
            cur[name] = out
        except Exception as e:
            bad += 1
            if bad < 60: print('ERR', s, name, e)
    prev.update(cur)
    if mode == 'dump':
        pass
print(mode, 'bad', bad, 'of', total, ops)
if len(sys.argv) > 3 and bad == 0:
    import pathlib
    outdir = sys.argv[3]
    # regrava cada etapa em outdir/stepN/<arquivo>
    prev = {}
    for s in steps:
        for f in sorted(glob.glob(P + f'/step{s}/data/*-patch')):
            name = os.path.basename(f)[:-6]
            nd = os.path.join(ND, name)
            base = prev.get(name) if mode == 'chain' and name in prev else (compact(json.load(open(nd, encoding='utf-8'))) if os.path.exists(nd) else b'')
            size, out = dec(open(f, 'rb').read(), base)
            prev[name] = out
            pathlib.Path(outdir, f'step{s}').mkdir(parents=True, exist_ok=True)
            open(os.path.join(outdir, f'step{s}', name), 'wb').write(out)
