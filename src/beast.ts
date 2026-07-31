
import { App, FuzzySuggestModal, setIcon } from "obsidian";
import { rollD20, rollDY, rollXDY, rollDiceFormula } from "./utils/rollUtils"
import { ToolsFor5eSettings } from "./settings";
import ToolsFor5e from "./main";

export interface TraitEntry {
    name: string;
    entries: any[];
}

export interface ActionEntry {
    name: string;
    entries: any[];
}

export interface ReactionEntry {
    name: string;
    entries: any[];
}

export interface MyBeast
{
    name: string;
    source: string;
    page?: string;

    str?: string;
    dex?: string;
    con?: string;
    int?: string;
    wis?: string;
    cha?: string;

    raw?: string;
    tags?: string;

    ac?: string | number;

    trait?: any[];

    level?: string;

    skill?: any;
    save?: any;
    immune?: any[];
    senses?: any[];
    passive?: string;
    languages?: any[];
    cr?: any;
    speend?: any;
    size?: string;

    hasFluff?: boolean;
    fluffText?: string | null;
    fluffImage?: string | null;

    [key: string]: any;     // all fields provided
}

const alignmentMap: Record<string, string> = {
    "L": "lawful",
    "C": "chaotic",
    "G": "good",
    "E": "evil",
    "N": "neutral",
    "U": "unaligned",
    "A": "any alignment"
};

const sizeMap: Record<string, string> = {
    "T": "tiny",
    "S": "small",
    "M": "medium",
    "L": "large",
    "H": "huge",
    "G": "gargantuan"
};

interface StatblockOverrides
{
    name?: string;
    hp?: string;
    ac?: string;
    iniBonus?: string;
    conditions?: string;
}

//helper functions
export class BeastUtils
{
    private static settings: ToolsFor5eSettings;


    static initialize(settings: any): void
    {
       BeastUtils.settings = settings;
    }

    static createTable( container: HTMLElement, matrix: string[][], moreClasses: string = "" )
    {
        const columns = matrix[0]?.length ?? 0;
        const rows = matrix.length;

        const table = container.createEl( "div", { cls: `tools-for-5e-table-container ${moreClasses}`  } );

        for( let x = 0; x < columns; x++ )
        {
            const column = table.createEl( "div", { cls: "tools-for-5e-table-column" } );
            for( let y = 0; y < rows; y++ )
            {
                const segment = column.createEl( "div", { cls: "tools-for-5e-table-segment", text: String( matrix[y]?.[x] ?? "" ) } );
            }
        }
    }

    static createStatBlock( container: HTMLElement, monster: MyBeast, plugin: ToolsFor5e, overrides: StatblockOverrides = {} ) : void
    {

        //console.log( monster );
        const statblock = container.createEl( "div", { cls: "tools-for-5e-statblock-container" });
        //handle overrides:
        const name      = overrides.name      ?? monster.name;
        const hp        = overrides.hp        ?? BeastUtils.getHP( monster, false ).value;
        const ac        = overrides.ac        ?? BeastUtils.getArmorClass( monster );
        const acNumStr  = ac.split(" ")[0];
        const iniBon    = overrides.iniBonus ?? BeastUtils.getIniBonus( monster );
        const conditions = overrides.conditions ?? [];

        const speed = BeastUtils.getSpeed( monster ).text;


        const header = statblock.createEl( "div", { cls: "tools-for-5e-statblock-header" });

        const headerLeft = header.createEl( "div",  { cls: "tools-for-5e-statblock-header-left" });

        headerLeft.createEl( "div", { cls: "title", text: monster.name + " " } );
        headerLeft.createEl("hr", { attr: { style: "border-color: #9c2b1b; margin: 5px 0;" } });
        headerLeft.createEl( "div", { cls: "subtitle", text: `${BeastUtils.getSizeString( monster )} ${BeastUtils.getTypeString( monster )}, ${BeastUtils.getAlignmentString( monster )}` });

        const acWrapper = header.createEl("div", { cls: "stat-badge-stacked ac-badge" });
        const acIconContainer  = acWrapper.createEl("div", { cls: "stat-icon-stacked" });
        const acValueBox = acWrapper.createEl("div", { cls: "stat-value-overlay", text: String(acNumStr) });
        setIcon( acIconContainer, "shield" );

        const hpWrapper = header.createEl("div", { cls: "stat-badge-stacked hp-badge" });
        const hpIconContainer  = hpWrapper.createEl("div", { cls: "stat-icon-stacked" });
        const hpValueBox = hpWrapper.createEl("div", { cls: "stat-value-overlay", text: String( hp ) });
        setIcon( hpIconContainer, "heart" );

        //statblock body is 1 or 2 columns

        const body = statblock.createEl( "div", { cls: "tools-for-5e-statblock-body"} );
        const sectionMainStats = body.createEl( "div", { cls: "tools-for-5e-statblock-segment"} );
        BeastUtils.createTable( sectionMainStats, [[ `AC ${ac}`, `Initiative +${iniBon}` ],[`HP ${hp}`,""],[`Speed ${speed}`,""]], "tools-for-5e-statblock-smalltext-emph");

        //attributes
        const sectionAttributes = body.createEl( "div", { cls: "tools-for-5e-statblock-segment"} );
        const attributesContainer = sectionAttributes.createEl( "div", { cls: "" });
        BeastUtils.createSectionTitle( attributesContainer, "Attributes" );

        const attrGrid = attributesContainer.createEl( "div", { cls: "dnd-attributes-grid" } );
        const addAttr = ( label: string, key: string ) =>
        {
            const score = (monster?.[key as keyof MyBeast] as number) ?? 10;
            const mod = Math.floor((score - 10) / 2);

            const card = attrGrid.createEl("div", { cls: "dnd-attribute-card" });
            card.createEl("div", { cls: "dnd-attribute-label", text: label });
            card.createEl("div", { cls: "dnd-attribute-value", text: `${score} (${mod >= 0 ? "+" : ""}${mod})` });
        };

        addAttr("STR", "str");
        addAttr("DEX", "dex");
        addAttr("CON", "con");
        addAttr("INT", "int");
        addAttr("WIS", "wis");
        addAttr("CHA", "cha");


        const sectionSkillsETC = body.createEl( "div", { cls: "tools-for-5e-statblock-segment"} );
        BeastUtils.createSaves( sectionSkillsETC, monster );        // saves --> could move this into Attributes section
        BeastUtils.createSkills( sectionSkillsETC, monster );       // skills
        BeastUtils.createImmunities( sectionSkillsETC, monster );   // Immunities
        BeastUtils.createSenses( sectionSkillsETC, monster );       // senses
        BeastUtils.createLanguages( sectionSkillsETC, monster );    // languages
        BeastUtils.createCR( sectionSkillsETC, monster );           // cr


        // traits
        const traits: TraitEntry[] = [...(monster.trait ?? []) as any[]];
        traits.push(...BeastUtils.getFromSpellcasting("trait", monster ) );
        if( traits.length > 0 )
        {
            const sectionTraits = body.createEl( "div", { cls: "tools-for-5e-statblock-segment"} );
            BeastUtils.createTraits( sectionTraits, traits );
        }

        // actions
        //console.log(monster.action)
        const actions = [...(monster.action ?? [])];
        actions.push(...BeastUtils.getFromSpellcasting("action", monster ) );
        if( actions.length > 0 )
        {
            const sectionActions = body.createEl( "div", { cls: "tools-for-5e-statblock-segment"} );
            BeastUtils.createActions( sectionActions, actions );
        }

        const bonusActions = [...(monster.bonus ?? [])];
        bonusActions.push(...BeastUtils.getFromSpellcasting("bonus", monster ) );
        if( bonusActions.length > 0 )
        {
            const sectionBonusActions = body.createEl( "div", { cls: "tools-for-5e-statblock-segment"} );
            BeastUtils.createBonusActions( sectionBonusActions, bonusActions );
        }

        const reactions = [...(monster.reaction ?? [])];
        reactions.push(...BeastUtils.getFromSpellcasting("reaction", monster ) );
        if( reactions.length > 0 )
        {
            const sectionReactions = body.createEl( "div", { cls: "tools-for-5e-statblock-segment"} );
            BeastUtils.createReactions( sectionReactions, reactions );
        }

        const legendaryActions = [...(monster.legendary ?? [])];
        legendaryActions.push(...BeastUtils.getFromSpellcasting("legendary", monster ) );
        if( legendaryActions.length > 0 )
        {
            // legendary actions
            const sectionLegendaryActions = body.createEl( "div", { cls: "tools-for-5e-statblock-segment"} );
            BeastUtils.createLegendaryActions( sectionLegendaryActions, legendaryActions );
        }

        const srcData = plugin.getBase64ImageAsSrcData( monster?.fluffImage ?? "" )
        if( srcData )
        {
            const sectionImage = body.createEl( "div", { cls: "tools-for-5e-statblock-segment"} );
            const imgContainer = sectionImage.createEl("div", { cls: "dnd-statblock-image-container" });
            imgContainer.createEl("img", {
                    attr: {
                        src: srcData
                    },
                    cls: "dnd-statblock-image"
                });
        }
    }



    //replace 5etools string tags {@...} generates html tags including <strong> etc. --> use on innerHTML, not directly in text:
    static parseEntryTextHTML( text: string ): string
    {
        //return text;
        return text
            .replace( /\{@hit ([^}]+)\}/g, "+$1")
            .replace( /\{@dice ([^}]+)\}/g, "$1")
            .replace( /\{@damage ([^}]+)\}/g, (_,formula) =>
                {
                    return formula.replace(/summonSpellLevel/g, "the spell's level")
                })
            .replace( /\{@dc ([^}]+)\}/g, "DC $1")
            .replace( /\{@atkr? ([^}]+)\}/g, (_,kind) =>
                {
                    const parts = kind.split(",").map((t: string) => t.trim());
                    const kindMap: Record<string, string> = { m: "Melee", r: "Ranged", ms: "Melee Spell", rs: "Ranged Spell", };
                    const label = parts.map( (p: string) => kindMap[p] ?? p ).join( " or " );
                    return `<em>${label} Attack Roll: </em>`;
                })
            .replace( /\{@spell ([^}]+)\|([^}]+)\}/g, "<em>$1 ($2)</em>")
            .replace( /\{@spell ([^}]+)\}/g, "<em>$1</em>")
            .replace( /\{@h}/g, "<em>Hit:</em> ")
            .replace( /{@actSaveFail}/g, "<em>Failure:</em>")
            .replace( /{@actSaveSuccess}/g, "<em>Success</em>:")
            .replace( /{@actSaveSuccessOrFail}/g, "<em>Success or Failure</em>:")
            .replace( /\{@condition ([^}]+)\|([^}]+)\}/g, "<em>$1</em> ($2)")
            .replace( /\{@variantrule ([^}]+)\}/g, ( _, content ) =>
                {
                    const parts = content.split("|");
                    if (parts.length >= 3)
                        return `${parts[parts.length - 1]} (${parts[1]})`;
                    if (parts.length === 2)
                        return `${parts[0]} (${parts[1]})`;
                    return parts[0];
                })
            .replace( /\{@actSave ([^}]+)\}/g, (_, abbr) =>
                {
                    const map: Record<string, string> = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
                    return `<em>${map[abbr] ?? abbr} Saving Throw: </em>`;
                })
            .replace(/{@recharge ([^}]+)\}/g, "(Recharge $1-6)")
            .replace(/{@hitYourSpellAttack ([^}]+)\}/g, "$1")
            .replace( /\{@i ([^}]+)\}/g, "<em>$1</em>")
            .replace( /\{@b ([^}]+)\}/g, "<strong>$1</strong>")
            .replace(/{fdghjvgsdv}/g, "");  //should be the final fallback...
            //.replace( /\{@([A-Za-z0-9])+([^}]+)\}/g, "$1");

    }

//    {@variantrule Emanation [Area of Effect]|XPHB|Emanation}
//"The balor explodes when it dies. {@actSave dex} {@dc 20}, each creature in a 30-foot {@variantrule Emanation [Area of Effect]|XPHB|Emanation} originating from the balor. {@actSaveFail} 31 ({@damage 9d6}) Fire damage plus 31 ({@damage 9d6}) Force damage. {@actSaveSuccess} Half damage. {@actSaveSuccessOrFail} If the balor dies outside the Abyss, it gains a new body instantly, reviving with all its {@variantrule Hit Points|XPHB} somewhere in the Abyss."
    static getFromSpellcasting( kind: string, monster: MyBeast ): TraitEntry[]
    {
        if( !monster.spellcasting )
            return [];

        let returnArray: any[] = [];

        for( const sc of monster.spellcasting )
        {
            if( sc.displayAs === kind )
            {
                const entries: string[] = [];

                if( sc.headerEntries )
                    entries.push( ...sc.headerEntries );

                if( sc.will && sc.will.length > 0 )
                    entries.push( `At will: ${sc.will.join(", ")}`);

                if( sc.daily )
                {
                    for( const [times, spells] of Object.entries( sc.daily ))
                        entries.push( `${times}/day: ${(spells as string[]).join(", ")}`);
                }

                //return { name: sc.};
                returnArray.push( { name: sc.name, entries } );
            }
        }
        return returnArray;
    }

    static createSectionTitle( container: HTMLElement, title: string )
    {
        container.createEl( "div", { cls: "sectiontitle", text: `${title}` } );
        container.createEl("hr", { attr: { style: "border-color: #9c2b1b; margin: 5px 0;" } });
    }

    static createTraits( container: HTMLElement, traits: TraitEntry[] )
    {
        BeastUtils.createSectionTitle( container, "Traits" );
        traits.forEach( (trait) =>
        {
            let traitDiv = container.createEl( "div", { cls: "" } );
            traitDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-emph", text: `${trait.name}. `})
            const span = traitDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-red"})
            span.innerHTML =  BeastUtils.parseEntryTextHTML( trait.entries.join(" "));
        });
    }

    static createActions( container: HTMLElement, actions: ActionEntry[] ): void
    {
        BeastUtils.createSectionTitle( container, "Actions" );
        actions.forEach( (action) =>
        {
            let actionDiv = container.createEl( "div", { cls: "" } );
            actionDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-emph", text: `${action.name}. `});
            const span = actionDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-red"});
            span.innerHTML = BeastUtils.parseEntryTextHTML(action.entries.join(" "));
        });
    }

    static createBonusActions( container: HTMLElement, actions: ActionEntry[] ): void
    {
        BeastUtils.createSectionTitle( container, "Bonus Actions" );
        actions.forEach( (action) =>
        {
            let actionDiv = container.createEl( "div", { cls: "" } );
            actionDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-emph", text: `${action.name}. `});
            const span = actionDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-red"});
            span.innerHTML = BeastUtils.parseEntryTextHTML(action.entries.join(" "));
        });
    }

    static createReactions( container: HTMLElement, reactions: ReactionEntry[] ): void
    {
        BeastUtils.createSectionTitle( container, "Reactions" );
        reactions.forEach( (reaction) =>
        {
            let reactionDiv = container.createEl( "div", { cls: "" } );
            reactionDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-emph", text: `${reaction.name}. `});
            const span = reactionDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-red"});
            span.innerHTML = BeastUtils.parseEntryTextHTML(reaction.entries.join(" "));
        });
    }

    static createLegendaryActions( container: HTMLElement, actions: ActionEntry[] ): void
    {
        BeastUtils.createSectionTitle( container, "Legendary Actions" );
        actions.forEach( (action) =>
        {
            let actionDiv = container.createEl( "div", { cls: "" } );
            actionDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-emph", text: `${action.name}. `});
            const span = actionDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-red"});
            span.innerHTML = BeastUtils.parseEntryTextHTML( action.entries.join(" ") );
        });
    }


    static createSkills( container: HTMLElement, monster: MyBeast )
    {
        const skills = monster.skill;

        if( !skills || Object.keys(skills).length === 0 )  //no entries
            return;

        const skillString = Object.entries(skills).map( ([skillName, modifier]) =>
            {
               const formattedName = skillName.charAt(0).toUpperCase() + skillName.slice(1);
               return `${formattedName} ${modifier}`;
           }).join(", ");

        const skillsDiv = container.createEl( "div", { cls: "" } );
        skillsDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-emph", text: `Skills `})
        skillsDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-red", text: `${skillString}`})
    }

    static createSaves( container: HTMLElement, monster: MyBeast )
    {
        const saves = monster.save;

        if( !saves || Object.keys(saves).length === 0 )  //no entries
            return;

        const abilityMap: Record<string, string> = { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };

        const savesString = Object.entries(saves).map( ([saveName, bonus]) =>
            {
               return `${saveName.charAt(0).toUpperCase()}${saveName.slice(1)} ${bonus}`;
           }).join(", ");

        const skillsDiv = container.createEl( "div", { cls: "" } );
        skillsDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-emph", text: `Saves `})
        skillsDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-red", text: `${savesString}`})
    }

    static createImmunities( container: HTMLElement, monster: MyBeast )
    {
        const immunities = monster.immune;

        if( !immunities || immunities.length === 0 )
            return;

        const immunitiesString = immunities.map( imm =>
        {
            if (typeof imm === "object" && imm !== null)
            {
                return imm.note ? `${imm.immune.join(", ")} ${imm.note}` : imm.immune.join(", ");
            }
            const immStr = String( imm );
            return `${immStr.charAt(0).toUpperCase()}${immStr.slice(1)}`
        }).join( ", " );

        const immunitiesDiv = container.createEl( "div", { cls: "" } );
        immunitiesDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-emph", text: `Immunities `})
        immunitiesDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-red", text: `${immunitiesString}`})
    }

    static createSenses( container: HTMLElement, monster: MyBeast )
    {
        const senses = monster.senses;

        if( !senses || senses.length === 0 )
            return;

        const useMeters = BeastUtils.settings?.useMetricUnits ?? false;

        const sensesString = senses.map(sense =>
            {
                if (useMeters)
                {
                    // Regulärer Ausdruck sucht nach Zahlen gefolgt von "ft." (z.B. "60 ft.")
                    return sense.replace( /(\d+)\s*ft\./gi, (match: string, feetStr: string) => {
                        const feet = parseInt(feetStr, 10);
                        const meters = (feet / 5) * 1.5;
                        return `${Number(meters.toFixed(1))}m`;
                    });
                }
                return sense;
            }).join(", ");

        const sensesDiv = container.createEl( "div", { cls: "" } );
        sensesDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-emph", text: `Senses `})
        sensesDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-red", text: `${sensesString}`})

        if( monster.passive )
        {
            container.createEl( "div", {cls: "tools-for-5e-statblock-smalltext-red", text: `Passive Perception ${monster.passive}`})
        }
    }

    static createLanguages( container: HTMLElement, monster: MyBeast )
    {
        const languages = monster.languages;

        if( !languages || languages.length === 0 )
            return;
        //todo: make uppercase?
        const languagesString = languages.join( ", " );
        const languagesDiv = container.createEl( "div", { cls: "" } );
        languagesDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-emph", text: `Languages `})
        languagesDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-red", text: `${languagesString}`})
    }

    static createCR( container: HTMLElement, monster: MyBeast )
    {
        const cr = monster.cr;

        if( !cr || cr === "" )
            return;

        const crDiv = container.createEl( "div", { cls: "" } );
        crDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-emph", text: `CR `})
        crDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-red", text: `${cr}`})
    }

    static getProficiency( monster: MyBeast )
    {
        const cr = BeastUtils.getCR(monster);
        //console.log( "extracted CR: " + cr)

        return Math.max( 2, Math.floor((cr - 1) / 4) + 2);
    }



    static getCR( monster: MyBeast )
    {
        const crValue = monster?.cr;
        if( crValue === undefined || crValue === null || crValue === "" )
            return 0;       //CR of 1 by default?

        if( typeof crValue === "number" )
            return crValue;

        if( crValue.includes("/") )     //1/2, 1/4 etc
        {
            const parts = crValue.split("/");
            const numerator = parseInt( parts[0] );
            const denominator = parseInt( parts[1] );
            if( !isNaN( numerator ) && !isNaN( denominator ) && denominator !== 0)
                return numerator / denominator;
        }

        if( typeof crValue === "string" )   //but does not include /
            return parseInt( crValue );

        return 0;
    }

    static getSpeed( monster: MyBeast )
    {
        const speed = monster?.speed;

        if( !speed )
            return { text: "unknown" };

        let text: string = "";
        const walk = speed.walk ?? "";
        const swim = speed.swim ?? "";
        const fly = speed.fly ?? "";
        const canHover = speed.canHover ?? false;
        const climb = speed.climb ?? "";
        const burrow  = speed.burrow  ?? "";

        const getDist = (val: number) => BeastUtils.settings?.useMetricUnits
           ? `${(val / 5) * 1.5}m`
           : `${val} ft.`;

        if( walk ){ text += `${getDist(walk)}`; }
        if( swim ){ text += `, Swim ${getDist(swim)}`; }
        if( fly )
        {
            if( typeof fly === "object" )
                text += `, Fly ${getDist(fly.number)}`;
            else
                text += `, Fly ${getDist(fly)}`;
        }
        if( canHover ){ text += ` (hover)`; }
        if( climb ){ text += `, Climb ${getDist(climb)}`; }
        if( burrow ){ text += `, Burrow ${getDist(burrow)}`; }

        return { walk: walk, swim: swim, fly: fly, climb: climb, burrow: burrow, text: text };
    }

    static getIniBonus( monster: MyBeast )
    {
        const dexmod = Math.floor( ( Number(monster?.dex ?? 10) - 10) / 2 );
        const proficiency = BeastUtils.getProficiency( monster );
        const profMultiplier = monster?.initiative?.proficiency ?? 0;
        const initiativeProficiencyBonus = profMultiplier * proficiency;
        const flatBonus = monster?.initiative?.bonus ?? 0;

        return dexmod + initiativeProficiencyBonus + flatBonus;
    }

    static getHP( monster: MyBeast, roll: boolean )
    {
        const hp = monster?.hp;

        if( !hp )
            return { value: 10, note: "10 (no data)" };

        const average = hp.average ?? 0;
        const formula = hp.formula; //(string)
        const special = hp.special;

        if( roll )
        {
            if( formula )
            {
                const txt = special ? `rolled ${formula} (Note: ${special})` : `rolled ${formula}`;
                return { value: rollDiceFormula( formula ), note: txt  }
            }
            //else:
            return { value: average, note: special ?? `${average} (no formula to roll)` };
        }

        let displayText = "average";
        if( special)
        {
            displayText = formula ? `${special} (Formula: ${formula})` : special;
        }
        else if (formula)
        {
            displayText = `average ${average} (${formula})`;
        }

        return { value: average, text: displayText };
    }





    static getArmorClass( monster: MyBeast ): string
    {
        const acField = monster?.ac ?? null;

        if( !acField )
            return "10";

        if( typeof acField === 'number' || typeof acField === 'string' )
            return String( acField );

        if( Array.isArray(acField) && (acField as any).length > 0 )
        {
            const first = acField[0];
            return typeof first === 'object' ? String( (first as any).ac ?? "10" ) : String( first );
        }
        return "10";
    }

    static getSizeString( monster: MyBeast ): string
    {
        if( !monster.size || !Array.isArray(monster.size) || monster.size.length === 0)
        {
           return "undefined size";
        }

        const parsed = monster.size.map( code =>
        {
            if( typeof code !== "string" ) return "";
            const upperCode = code.toUpperCase();
            return sizeMap[ upperCode ] || code.toLowerCase();
        })
        .filter(text => text !== "")
        .join("/");

        return parsed || "undefined size";
    }

    static getAlignmentString( monster: MyBeast ): string
    {
        if( !monster.alignment || !Array.isArray(monster.alignment) || monster.alignment.length === 0)
        {
           return "unaligned";
        }



        const parsed = monster.alignment.map( code =>
        {
            if(typeof code !== "string") return "";
            const upperCode = code.toUpperCase();
            return alignmentMap[ upperCode ] || code.toLowerCase();
        })
        .filter(text => text !== "")
        .join(" ");

        return parsed || "unaligned";
    }

    static getTypeString( monster: MyBeast ): string
    {
        if( !monster.type )
            return "unknown";

        if( typeof monster.type === "string" )
        {
            return monster.type.toLowerCase();
        }

        if( typeof monster.type === "object" && monster.type !== null )
        {
            const mainType = ( monster.type.type || "unknown" ).toLowerCase();
            const tags: string[] = monster.type.tags || [];

            //case swarm:
            if( monster.type.swarmSize )
            {
                const swarmSizeWord = monster.type.swarmSize.map( (code :string) =>
                {
                    if( typeof code !== "string" ) return "";
                    const upperCode = code.toUpperCase();
                    return sizeMap[ upperCode ] || code.toLowerCase();
                })
                .filter( (text: string) => text !== "")
                .join("/");

                return `swarm of ${swarmSizeWord} ${mainType}s`;
            }
            if( tags.length > 0 )
            {
                const joinedTags = tags
                    .map( t => typeof t === "string" ? t.toLowerCase() : "")
                    .filter(t => t !== "")
                    .join(", ");

                return `${mainType} (${joinedTags})`;
            }
            return mainType;
        }
        return "unknown";
    }
}



export class BeastSuggestionModal extends FuzzySuggestModal<MyBeast>
{
    constructor( plugin: App, private beast: MyBeast[], private onPick: (i: MyBeast )=> void)
    {
        super(plugin);
        this.setPlaceholder("Pick a beast...")
    }

    getItemText(beast: MyBeast): string
    {
        return beast.name;
    }

    getItems(): MyBeast[]
    {
        return this.beast;
    }

    onChooseItem( beast: MyBeast ): void
    {
        this.onPick( beast );
    }
}
