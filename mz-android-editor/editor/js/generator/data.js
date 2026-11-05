// Tabelas do gerador de personagens, extraídas do bytecode QML compilado dentro do RPG.exe
// do MZ 1.1.1 (qrc:/qml/CharacterGenerator/CharacterGeneratorData.qml — ver NOTES.md).
// Os valores e a ordem são exatamente os do original.
import { t } from "../i18n.js";

export const LAYERGROUP_LIST = [
    "face", "fronthair", "rearhair", "beard", "ears", "eyes", "eyebrows", "nose", "mouth",
    "facialmark", "beastears", "tail", "wing", "clothing", "cloak", "acca", "accb", "glasses"
];

// Textos (fonte do MZ traduzida por t(), contexto CharacterGeneratorData).
export const LAYERGROUP_TEXT = {
    face: t("Face", "CharacterGeneratorData"), fronthair: t("Front Hair", "CharacterGeneratorData"), rearhair: t("Rear Hair", "CharacterGeneratorData"), beard: t("Beard", "CharacterGeneratorData"), ears: t("Ears", "CharacterGeneratorData"),
    eyes: t("Eyes", "CharacterGeneratorData"), eyebrows: t("Eyebrows", "CharacterGeneratorData"), nose: t("Nose", "CharacterGeneratorData"), mouth: t("Mouth", "CharacterGeneratorData"), facialmark: t("Facial Mark", "CharacterGeneratorData"),
    beastears: t("Beast Ears", "CharacterGeneratorData"), tail: t("Tail", "CharacterGeneratorData"), wing: t("Wing", "CharacterGeneratorData"), clothing: t("Clothing", "CharacterGeneratorData"), cloak: t("Cloak", "CharacterGeneratorData"),
    acca: t("Accessory 1", "CharacterGeneratorData"), accb: t("Accessory 2", "CharacterGeneratorData"), glasses: t("Glasses", "CharacterGeneratorData")
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
    "#F9C19D": t("Skin Color", "CharacterGeneratorData"), "#2C80CB": t("Eye Color", "CharacterGeneratorData"), "#FCCB0A": t("Hair Color", "CharacterGeneratorData"), "#B892C5": t("Sub Color", "CharacterGeneratorData"),
    "#009296": t("Facial Mark Color", "CharacterGeneratorData"), "#D3CEC7": t("Beast Ears Color", "CharacterGeneratorData"),
    "#AE8682": t("Main Color", "CharacterGeneratorData"), "#FE9D1E": t("Sub Color 1", "CharacterGeneratorData"), "#1C76D0": t("Sub Color 2", "CharacterGeneratorData"), "#D9A404": t("Sub Color 3", "CharacterGeneratorData"),
    "#D8AC00": t("Main Color", "CharacterGeneratorData"), "#A30708": t("Sub Color", "CharacterGeneratorData"),
    "#D3CEC2": t("Main Color", "CharacterGeneratorData"), "#DA346E": t("Sub Color 1", "CharacterGeneratorData"), "#A4C911": t("Sub Color 2", "CharacterGeneratorData"),
    "#C78407": t("Main Color", "CharacterGeneratorData"), "#C0D3D2": t("Sub Color 1", "CharacterGeneratorData"), "#4155B6": t("Sub Color 2", "CharacterGeneratorData"), "#BA3B45": t("Sub Color 3", "CharacterGeneratorData"),
    "#999999": t("Main Color", "CharacterGeneratorData"), "#CCBAD2": t("Sub Color 1", "CharacterGeneratorData"), "#607E4B": t("Sub Color 2", "CharacterGeneratorData"),
    "#E6D6BD": t("Tail Color", "CharacterGeneratorData"), "#A7D6D6": t("Wing Color", "CharacterGeneratorData")
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
    face: { title: t("Face Image", "Layout_CharacterGenerator"), folder: "img/faces", overallWidth: 576, overallHeight: 288, imageWidth: 144, imageHeight: 144 },
    tv: { title: t("Walking Character", "Layout_CharacterGenerator"), folder: "img/characters", overallWidth: 576, overallHeight: 384, imageWidth: 144, imageHeight: 192 },
    tvd: { title: t("Damaged Character", "Layout_CharacterGenerator"), folder: "img/characters", overallWidth: 576, overallHeight: 384, imageWidth: 144, imageHeight: 48 },
    sv: { title: t("Battler", "Layout_CharacterGenerator"), folder: "img/sv_actors", overallWidth: 576, overallHeight: 384, imageWidth: 576, imageHeight: 384 }
};

export const GENDERS = [
    { key: "male", text: t("Male", "Dialog_CharacterGenerator") },
    { key: "female", text: t("Female", "Dialog_CharacterGenerator") },
    { key: "kid", text: t("Kid", "Dialog_CharacterGenerator") }
];
