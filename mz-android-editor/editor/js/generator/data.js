// Tabelas do gerador de personagens, extraídas do bytecode QML compilado dentro do RPG.exe
// do MZ 1.1.1 (qrc:/qml/CharacterGenerator/CharacterGeneratorData.qml — ver NOTES.md).
// Os valores e a ordem são exatamente os do original.

export const LAYERGROUP_LIST = [
    "face", "fronthair", "rearhair", "beard", "ears", "eyes", "eyebrows", "nose", "mouth",
    "facialmark", "beastears", "tail", "wing", "clothing", "cloak", "acca", "accb", "glasses"
];

// Textos (tradução oficial pt_BR do MZ, contexto CharacterGeneratorData).
export const LAYERGROUP_TEXT = {
    face: "Rosto", fronthair: "Franja", rearhair: "Cabelo", beard: "Barba", ears: "Orelhas",
    eyes: "Olhos", eyebrows: "Sobrancelhas", nose: "Nariz", mouth: "Boca", facialmark: "Marca Facial",
    beastears: "Orelhas de Animais", tail: "Cauda", wing: "Asa", clothing: "Vestimenta", cloak: "Capa",
    acca: "Acessório 1", accb: "Acessório 2", glasses: "Óculos"
};

// Ordem de desenho (de baixo para cima) por tipo de imagem.
export const LAYER_ORDERS = {
    tv: ["wing2", "cloak2", "tail2", "fronthair2", "beard2", "body", "facialmark", "rearhair2", "clothing2",
        "beard1", "clothing1", "tail1", "cloak1", "beastears", "ears", "glasses", "rearhair1", "acca",
        "fronthair1", "accb", "wing1"],
    tvd: ["body", "facialmark", "clothing", "beard", "tail", "cloak", "glasses", "wing", "rearhair",
        "beastears", "ears", "acca", "fronthair", "accb"],
    sv: ["wing", "cloak2", "tail", "body", "facialmark", "rearhair1", "clothing2", "beard", "clothing1",
        "cloak1", "beastears", "ears", "glasses", "acca", "fronthair", "accb"],
    face: ["rearhair2", "cloak2", "body", "clothing2", "face", "mouth", "nose", "facialmark", "eyes",
        "eyebrows", "rearhair1", "ears", "clothing1", "beard", "beastears", "acca", "cloak1", "fronthair",
        "glasses", "accb"]
};

// IDs de máscara: cor-chave nas imagens _c.png; o sufixo _mNNN das faces é o índice (1..24) nesta lista.
export const MASK_ID_LIST = [
    "#F9C19D", "#2C80CB", "#FCCB0A", "#B892C5", "#009296", "#D3CEC7", "#AE8682", "#FE9D1E",
    "#1C76D0", "#D9A404", "#D8AC00", "#A30708", "#D3CEC2", "#DA346E", "#A4C911", "#C78407",
    "#C0D3D2", "#4155B6", "#BA3B45", "#999999", "#CCBAD2", "#607E4B", "#E6D6BD", "#A7D6D6"
];

export const SKIN_MASK = "#F9C19D";
export const EYE_MASK = "#2C80CB";

export const COLOR_TEXT = {
    "#F9C19D": "Cor da Pele", "#2C80CB": "Cor dos Olhos", "#FCCB0A": "Cor do Cabelo", "#B892C5": "Cor Secundária",
    "#009296": "Cor da Marca Facial", "#D3CEC7": "Cor Orelhas Animais",
    "#AE8682": "Cor Principal", "#FE9D1E": "Cor Secundária", "#1C76D0": "Cor Terciária", "#D9A404": "Cor Quaternária",
    "#D8AC00": "Cor Principal", "#A30708": "Cor Secundária",
    "#D3CEC2": "Cor Principal", "#DA346E": "Cor Secundária", "#A4C911": "Cor Terciária",
    "#C78407": "Cor Principal", "#C0D3D2": "Cor Secundária", "#4155B6": "Cor Terciária", "#BA3B45": "Cor Quaternária",
    "#999999": "Cor Principal", "#CCBAD2": "Cor Secundária", "#607E4B": "Cor Terciária",
    "#E6D6BD": "Cor da Cauda", "#A7D6D6": "Cor da Asa"
};

// Tipos de paleta: 0 = grad_hair, 1 = grad_eyes, 2 = grad_skin, 3 = grad_common.
export const PALETTE_FILES = ["grad_hair.png", "grad_eyes.png", "grad_skin.png", "grad_common.png"];

export function layergroupToPaletteType(lg) {
    switch (lg) {
        case "fronthair": case "rearhair": case "beard": case "eyebrows": case "beastears": case "tail":
            return 0;
        case "eyes":
            return 1;
        case "body": case "face": case "ears": case "nose": case "mouth":
            return 2;
        default:
            return 3;
    }
}

export function maskIDToPaletteType(maskID) {
    switch (maskID) {
        case "#FCCB0A": case "#B892C5": case "#D3CEC7": case "#E6D6BD":
            return 0;
        case "#2C80CB":
            return 1;
        case "#F9C19D":
            return 2;
        default:
            return 3;
    }
}

export function layergroupToMaskIDs(lg) {
    switch (lg) {
        case "body": return ["#F9C19D", "#2C80CB"];
        case "face": case "ears": case "nose": case "mouth": return ["#F9C19D"];
        case "eyes": return ["#2C80CB"];
        case "fronthair": case "beard": case "eyebrows": return ["#FCCB0A"];
        case "rearhair": return ["#FCCB0A", "#B892C5"];
        case "facialmark": return ["#009296"];
        case "beastears": return ["#D3CEC7"];
        case "tail": return ["#E6D6BD"];
        case "wing": return ["#A7D6D6"];
        case "clothing": return ["#AE8682", "#FE9D1E", "#1C76D0", "#D9A404"];
        case "cloak": return ["#D8AC00", "#A30708"];
        case "acca": return ["#D3CEC2", "#DA346E", "#A4C911"];
        case "accb": return ["#C78407", "#C0D3D2", "#4155B6", "#BA3B45"];
        case "glasses": return ["#999999", "#CCBAD2", "#607E4B"];
        default: return [];
    }
}

// Partes que não podem ficar vazias.
export function isEssential(lg) {
    return ["face", "ears", "eyes", "eyebrows", "nose", "mouth"].includes(lg);
}

// Partes que começam preenchidas (variação 1) ao abrir/redefinir.
export function isDefaultSet(lg) {
    return isEssential(lg) || lg === "fronthair" || lg === "rearhair" || lg === "clothing";
}

// Probabilidade de a parte ficar vazia em "Aleatório".
export function blankProbability(lg) {
    switch (lg) {
        case "cloak": case "acca": case "accb": return 0.8;
        case "beard": case "facialmark": case "glasses": return 0.9;
        case "beastears": case "tail": case "wing": return 0.95;
        default: return 0;
    }
}

// Formato do arquivo "Salvar Configurações" (JSON).
export const SETTINGS_IDENTITY = "CharacterGeneratorSettings";
export const SETTINGS_VERSION = "2.0.0";

// Diálogos de exportação: tamanho da folha e de cada célula; pasta de destino no projeto.
export const EXPORTS = {
    face: { title: "Imagem do rosto", folder: "img/faces", overallWidth: 576, overallHeight: 288, imageWidth: 144, imageHeight: 144 },
    tv: { title: "Personagem Andando", folder: "img/characters", overallWidth: 576, overallHeight: 384, imageWidth: 144, imageHeight: 192 },
    tvd: { title: "Personagem Caído", folder: "img/characters", overallWidth: 576, overallHeight: 384, imageWidth: 144, imageHeight: 48 },
    sv: { title: "Personagem Lutando", folder: "img/sv_actors", overallWidth: 576, overallHeight: 384, imageWidth: 576, imageHeight: 384 }
};

export const GENDERS = [
    { key: "male", text: "Homem" },
    { key: "female", text: "Mulher" },
    { key: "kid", text: "Criança" }
];
