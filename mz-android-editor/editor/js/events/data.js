// Acesso ao banco de dados do projeto para o módulo events (nomes de switches, itens, atores...).
// Tudo é carregado uma vez em `db.load()` e mantido em memória; `db:changed` recarrega o arquivo.

const FILES = {
    actors: "Actors", classes: "Classes", skills: "Skills", items: "Items", weapons: "Weapons",
    armors: "Armors", enemies: "Enemies", troops: "Troops", states: "States", animations: "Animations",
    tilesets: "Tilesets", commonEvents: "CommonEvents", system: "System", mapInfos: "MapInfos"
};

export const db = {
    api: null,
    actors: [], classes: [], skills: [], items: [], weapons: [], armors: [], enemies: [], troops: [],
    states: [], animations: [], tilesets: [], commonEvents: [], system: null, mapInfos: [],
    plugins: null,

    async load(api) {
        this.api = api;
        await Promise.all(Object.entries(FILES).map(async ([key, file]) => {
            try {
                this[key] = await api.project.readJson("data/" + file + ".json");
            } catch (e) {
                console.warn("events: falha ao ler", file, e);
                this[key] = key === "system" ? {} : [];
            }
        }));
    },

    async reload(file) {
        const name = String(file || "").replace(/^data\//, "").replace(/\.json$/, "");
        const key = Object.keys(FILES).find(k => FILES[k] === name);
        if (key) {
            this[key] = await this.api.project.readJson("data/" + name + ".json", { fresh: true });
        }
    },

    pad(n, len = 4) { return String(n).padStart(len, "0"); },

    // Nome "0001 Nome" de uma lista (atores, itens...) para os textos da lista de comandos.
    name(list, id) {
        const obj = this[list] && this[list][id];
        return obj ? obj.name : "";
    },
    switchName(id) { return (this.system.switches || [])[id] || ""; },
    variableName(id) { return (this.system.variables || [])[id] || ""; },
    mapName(id) {
        const info = this.mapInfos[id];
        return info ? info.name : "MAP" + this.pad(id, 3);
    },
    // Itens de uma lista do banco como opções [{value, label}] com o formato "0001 Nome" do MZ.
    options(list, { none = false, noneLabel = "None" } = {}) {
        const out = none ? [{ value: 0, label: noneLabel }] : [];
        const arr = this[list] || [];
        for (let i = 1; i < arr.length; i++) {
            const o = arr[i];
            out.push({ value: i, label: this.pad(i) + " " + (o ? (o.name || "") : "") });
        }
        return out;
    },
    nameListOptions(names, { none = false } = {}) {
        const out = none ? [{ value: 0, label: "None" }] : [];
        for (let i = 1; i < (names || []).length; i++) {
            out.push({ value: i, label: this.pad(i) + " " + (names[i] || "") });
        }
        return out;
    }
};

export const TEMPLATE = {
    page() {
        return {
            conditions: {
                actorId: 1, actorValid: false, itemId: 1, itemValid: false, selfSwitchCh: "A",
                selfSwitchValid: false, switch1Id: 1, switch1Valid: false, switch2Id: 1, switch2Valid: false,
                variableId: 1, variableValid: false, variableValue: 0
            },
            directionFix: false,
            image: { characterIndex: 0, characterName: "", direction: 2, pattern: 0, tileId: 0 },
            list: [{ code: 0, indent: 0, parameters: [] }],
            moveFrequency: 3,
            moveRoute: { list: [{ code: 0, parameters: [] }], repeat: true, skippable: false, wait: false },
            moveSpeed: 3,
            moveType: 0,
            priorityType: 0,
            stepAnime: false,
            through: false,
            trigger: 0,
            walkAnime: true
        };
    },
    event(id, x, y) {
        return { id, name: "EV" + String(id).padStart(3, "0"), note: "", pages: [this.page()], x, y };
    },
    audio(name = "", volume = 90) {
        return { name, volume, pitch: 100, pan: 0 };
    }
};

export function clone(o) {
    return o === undefined ? undefined : JSON.parse(JSON.stringify(o));
}

export function mapPath(id) {
    return "data/Map" + String(id).padStart(3, "0") + ".json";
}
