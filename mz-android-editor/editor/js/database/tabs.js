// Ordem das abas igual ao menu lateral do Banco de dados do MZ.
import { actorsTab, classesTab } from "./tabs_actors.js";
import { skillsTab, itemsTab, weaponsTab, armorsTab } from "./tabs_items.js";
import { enemiesTab, troopsTab, statesTab } from "./tabs_battle.js";
import { animationsTab, tilesetsTab, commonEventsTab } from "./tabs_misc.js";
import { system1Tab, system2Tab, typesTab, termsTab } from "./tabs_system.js";

export const TABS = [actorsTab, classesTab, skillsTab, itemsTab, weaponsTab, armorsTab, enemiesTab, troopsTab,
    statesTab, animationsTab, tilesetsTab, commonEventsTab, system1Tab, system2Tab, typesTab, termsTab];
