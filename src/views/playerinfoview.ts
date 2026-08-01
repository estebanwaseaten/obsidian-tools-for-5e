import { ItemView, WorkspaceLeaf } from "obsidian";


export const PLAYER_INFO_VIEW = "tools-for-5e-player-info-view";

type PlayerInfoMode = "empty" | "image" | "text" | "custom"

export interface PlayerInfoState
{
    mode: PlayerInfoMode;
    imageSrc?: string | null;
    imagePath?: string | null;
    altText?: string;
    text?: string;
    backgroundColor?: string;
    html?: string;
}

export class MyPlayerInfoView extends ItemView
{
    private state: PlayerInfoState = { mode: "empty" };
    private containerInnerEl: HTMLDivElement;

    constructor( leaf: WorkspaceLeaf )
    {
        super( leaf );
    }

    getViewType(): string { return PLAYER_INFO_VIEW; }
    getDisplayText(): string { return "Player Display"; }
    getIcon(): string { return "monitor"; }

    async setState( state: PlayerInfoState, result: any )
    {
        this.state = { ...state, mode: state?.mode ?? "empty" };

        this.render();
        await super.setState( state, result );
    }

    getState(): any
    {
        return this.state as unknown as any;
    }

    async onOpen()
    {
        this.contentEl.style.padding = "0";
        this.contentEl.style.margin = "0";
        this.contentEl.style.overflow = "hidden";

        this.containerInnerEl = this.contentEl.createEl("div", {  cls: "tools-for-5e-player-info-container" });
        this.containerInnerEl.style.width = "100%";
        this.containerInnerEl.style.height = "100%";
        this.containerInnerEl.style.display = "flex";
        this.containerInnerEl.style.flexDirection = "column";

//        this.containerInnerEl.style.margin = "0 0 0 0";

        this.render();
    }

    private render()
    {
        if (!this.containerInnerEl) return;

        const customColor = this.state.backgroundColor || "black";

        const root = this.containerInnerEl;
        root.empty();

        root.style.backgroundColor = customColor;

        switch( this.state.mode )
        {
            case "image":
                this.renderImage();
                break;
            case "text":
                this.renderText();
                break;
            case "custom":
                this.renderCustom();
                break;
            case "empty":
            default:
                break;
        }
    }

    private renderImage()
    {
        let src: string | null = null;

        if( this.state.imageSrc )
        {
            src = this.state.imageSrc;
        }
        else if( this.state.imagePath )
        {
            src = this.app.vault.adapter.getResourcePath( this.state.imagePath );
        }

        if( !src )
        {
            console.error( "no src" );
            return;
        }

        const img = this.containerInnerEl.createEl( "img", { cls: "tools-for-5e-player-info-image" });
        img.src = src;
        img.alt = this.state.altText ?? "";
    }

    private renderText()
    {
        if( !this.state.text ) return;

        this.containerInnerEl.createEl( "div", { cls: "tools-for-5e-player-info-text", text: this.state.text } );
    }

    private renderCustom()
    {
        if( !this.state.html ) return;

        this.containerInnerEl.innerHTML = this.state.html;
    }

    async onClose()
    {
        this.containerInnerEl.empty();
    }
}
