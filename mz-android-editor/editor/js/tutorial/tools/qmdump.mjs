import fs from "node:fs";
import { parseQm } from "file:///C:/Users/jamaa/Downloads/RPG%20AUTORIZADO%20PRO%20LUCAS/.claude/worktrees/mz-mvtut-a6b8a4/mz-android-editor/tools/qm2json.mjs";
for (const f of ["00044f18_qm", "0004f621_qm", "0005bbec_qm"]) {
    const r = parseQm(fs.readFileSync("tut/" + f));
    fs.writeFileSync("tut/" + f + ".json", JSON.stringify(r, null, 1));
    const ctx = r.messages ? Object.keys(r.messages) : Object.keys(r);
    console.log(f, r.language, JSON.stringify(Object.keys(r)).slice(0,200));
}
