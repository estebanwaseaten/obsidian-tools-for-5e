import { ItemView, WorkspaceLeaf, convertFileSrc } from "obsidian";


export const PLAYER_INFO_VIEW = "tools-for-5e-player-info-view";

type PlayerInfoMode = "empty" | "image" | "text"

interface PlayerInfoState
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

    constructor( leaf: WorkspaceLeaf )
    {
        super( leaf );
    }

    getViewType(): string { return PLAYER_INFO_VIEW; }
    getDisplayText(): string { return "Player Display"; }
    getIcon(): string { return "monitor"; }

    async setState( state: PlayerInfoState, result: any )
    {
        this.state = { mode: "empty", ...state };
        this.render();
        await super.setState( state, result );
    }

    getState(): PlayerInfoState
    {
        return this.state;
    }

    async onOpen()
    {
        this.render();
    }

    private render()
    {
        const root = this.contentEl;
        root.empty();
        root.addClass( "tools-for-5e-player-info-container" );

        if( this.state.backgroundColor )
        {
            root.style.backgroundColor = this.state.backgroundColor;
        }
        else
        {
            root.style.backgroundColor = "black";
        }

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
            src = convertFileSrc( this.state.imagePath );
        }

        if( !src )
        {
            console.error( "no src" );
            return;
        }

        const img = this.contentEl.createEl( "img", { cls: "tools-for-5e-player-info-image" });
        img.src = src;
        img.alt = this.state.altText ?? "";
    }

    private renderText()
    {
        if( !this.state.text ) return;

        this.contentEl.createEl( "div", { cls: "tools-for-5e-player-info-text", text: this.state.text } );
    }

    private renderCustom()
    {
        if( !this.state.html ) return;

        this.contentEl.innerHTML = this.state.html;
    }

    async onClose()
    {
        this.contentEl.empty();
    }
}
