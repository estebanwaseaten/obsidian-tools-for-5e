import { EventRef, ItemView, WorkspaceLeaf, SearchComponent, Menu, prepareFuzzySearch, setIcon, Notice } from "obsidian";
import type { MenuItem } from "obsidian";
import { getIconSVG } from "./common";

export const BEAST_VIEW = "tools-for-5e-beast-pane";

export class MyBeastView extends ItemView
{
    async onClose()
    {
        console.debug("Tools For 5e: close MyBeastView...")
    }

    getDisplayText(): string {
        // eslint-disable-next-line obsidianmd/ui/sentence-case
        return "D&D Monsters";
    }
    getIcon(): string {
        return "skull";
    }
    getViewType(): string {
        return BEAST_VIEW;
    }
}
