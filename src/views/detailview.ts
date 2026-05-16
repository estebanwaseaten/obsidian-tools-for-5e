import { ItemView, Notice } from "obsidian";

import { MyBeast } from "../beast";
import { MySpell } from "../spell";
import { MyItem } from "../item";

export const DETAIL_VIEW = "tools-for-5e-detail-pane";

export type DetailData =
    | { kind: "beast"; data: MyBeast }
    | { kind: "spell"; data: MySpell }
    | { kind: "item";  data: MyItem  };

export class MyDetailView extends ItemView
{
    private currentData: DetailData | null = null;

    getViewType()    { return DETAIL_VIEW; }
    getDisplayText() { return "5e Detail"; }
    getIcon()        { return "book-open"; }

    showItem(item: DetailData)
    {
        this.current = item;
        this.render();
    }

    async onOpen()
    {
         this.render();
    }

    async onClose() {}

    update( current: DetailData )
    {
        this.currentData = current;
        this.render();
    }

    private render()
    {
        const root = this.contentEl;
        root.empty();
        root.addClass("tools-for-5e-view-container");

        if (!this.currentData) {
           root.createDiv({
               text: "Select something from a list above.",
               cls: "tools-for-5e-detail-placeholder"
           });
           return;
       }

       const detailEl = root.createDiv({ cls: "tools-for-5e-detail-content" });

        switch( this.currentData.kind )
        {
            case "beast": this.renderBeast( detailEl, this.currentData.data ); break;
            case "spell": this.renderSpell( detailEl, this.currentData.data ); break;
            case "item":  this.renderItem( detailEl, this.currentData.data );  break;
        }
    }

    private renderBeast(el: HTMLElement, beast: MyBeast)
    {
        el.createEl("h3", { text: beast.name });
        // ...
    }

    private renderSpell(el: HTMLElement, spell: MySpell)
    {
        el.createEl("h3", { text: spell.name });
        // ...
    }

    private renderItem(el: HTMLElement, item: MyItem)
    {
        el.createEl("h3", { text: item.name });
        // ...
    }
}
