# Lista as unidades qv4cdata do RPG.exe e despeja a tabela de strings de unidades escolhidas.
# Qt 5.12 CompiledData::Unit: magic[8] "qv4cdata", version u32, qtVersion u32, sourceTimeStamp i64,
# md5[16], libraryVersionHash[48], unitSize u32, ... stringTableSize u32, offsetToStringTable u32 ...
import sys, struct, re, json, os
exe = sys.argv[1]
want = sys.argv[2:] if len(sys.argv) > 2 else []
data = open(exe, 'rb').read()
out = []
for m in re.finditer(rb'qv4cdata', data):
    base = m.start()
    try:
        version, qtv = struct.unpack_from('<II', data, base + 8)
        # header layout (qv4compileddata_p.h, 5.12): after magic(8) version(4) qtVersion(4) sourceTimeStamp(8)
        # md5Checksum(16) libraryVersionHash(48) unitSize(4) flags(4) stringTableSize(4) offsetToStringTable(4)
        unitSize = struct.unpack_from('<I', data, base + 24)[0]
        flags, stSize, stOff = struct.unpack_from('<III', data, base + 108)
        if unitSize > 50_000_000 or stSize > 100000:
            continue
        strs = []
        for i in range(stSize):
            so = struct.unpack_from('<I', data, base + stOff + 4 * i)[0]
            ln = struct.unpack_from('<i', data, base + so + 4)[0]
            if ln < 0 or ln > 100000:
                strs.append(None); continue
            s = data[base + so + 24: base + so + 24 + 2 * ln].decode('utf-16-le', 'replace')
            strs.append(s)
        src = '|'.join(s for s in strs[:12] if s)[:150]
        out.append((base, unitSize, src, strs))
    except Exception as e:
        pass
print(len(out), 'unidades')
for base, size, src, strs in out:
    if not want:
        print(hex(base), size, src)
    elif any(any(s and w in s for s in strs) for w in want):
        print('=====', hex(base), size, src, len(strs))
        for i, s in enumerate(strs):
            print(i, repr(s))
