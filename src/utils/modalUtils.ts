import { App, Modal, Setting } from 'obsidian';

export class ConditionsModal extends Modal
{
    private selected: Set<string>;
    private onSubmit: (conditions: string[]) => void;
    private titleText: string;
    private allConditions: string[];

    constructor( app: App, titleText: string, allConditions: string[], currentConditions: string[], onSubmit: (conditions: string[]) => void )
    {
        super( app );
        this.titleText = titleText;
        this.allConditions = allConditions;
        this.selected = new Set( currentConditions );
        this.onSubmit = onSubmit;
    }

    onOpen()
    {
        const { contentEl } = this;
        this.titleEl.setText( this.titleText );

        for( const condition of this.allConditions )
        {
           new Setting( contentEl )
               .setName( condition )
               .addToggle( ( toggle ) =>
               {
                   toggle.setValue( this.selected.has( condition ) );
                   toggle.onChange( (value) =>
                   {
                       if( value ) this.selected.add( condition );
                       else this.selected.delete( condition );
                   });
               });
        }

        new Setting(contentEl)
            .addButton( (btn) => {
                btn.setButtonText("Cancel")
                    .onClick(() => {
                    this.close(); // Schließt das Modal einfach ohne Aktion
                })
            })
            .addButton( (btn) => {
                btn.setButtonText("OK")
                    .onClick(() =>
                        {
                            this.close();
                            this.onSubmit( Array.from( this.selected ) );
                        })
            })
    }
}

export class TextInputModal extends Modal
{
    //private inputValue: string = "";
    protected inputValue: string = "";
    private onSubmit: (value: string) => void;
    private titleText: string;
    private labelText: string;

    constructor( app: App, titleText: string, labelText: string, onSubmit: (value: string) => void, defaultValue?: string )
    {
        super( app );
        this.titleText = titleText;
        this.labelText = labelText;
        this.onSubmit = onSubmit;
        if( defaultValue !== undefined )
            this.inputValue = defaultValue;
    }

    onOpen()
    {
        const { contentEl } = this;
        this.titleEl.setText( this.titleText );

        new Setting( contentEl )
            .setName( this.labelText )
            .addText( (text) =>
            {
                //text.setValue( this.inputValue ?? "" );   --> not working in obsidian api
                text.inputEl.value = this.inputValue
                text.onChange((value) => this.inputValue = value );

                text.inputEl.addEventListener("keydown", (e) =>
                {
                    if (e.key === "Enter")
                    {
                        e.preventDefault();
                        this.submit();
                    }
                });
                text.inputEl.focus();
                text.inputEl.select();
            });

        new Setting(contentEl)
            .addButton((btn) => {
                btn.setButtonText("Cancel")
                    .onClick(() => {
                    this.close(); // Schließt das Modal einfach ohne Aktion
                })
            })
            .addButton((btn) => {
                btn.setButtonText("OK")
                    .onClick(() => {
                    this.submit(); // Schließt das Modal und ruft submit auf
                })
            })
    }

    protected submit()
    {
        this.close();
        this.onSubmit( this.inputValue );
    }

    onClose()
    {
       this.contentEl.empty();
   }
}

export class NumInputModal extends TextInputModal
{
    private onSubmitNum: (amount: number) => void;

    constructor( app: App, titleText: string, labelText: string, onSubmit: (amount: number) => void, defaultValue?: number )
    {
       super( app, titleText, labelText, () => {}, defaultValue !== undefined ? String( defaultValue ) : "" );
       this.onSubmitNum = onSubmit;
    }

    protected submit()
    {
        const amount = parseInt( this.inputValue );
        if( !isNaN( amount ) && amount > 0 )
        {
            this.onSubmitNum( amount );
        }
        this.close();
    }
}


export class ConfirmModal extends Modal
{
    private titleText: string;
    private messageText: string;
    private onConfirm: () => void;

    constructor(app: App, titleText: string, messageText: string, onConfirm: () => void)
    {
        super(app);
        this.titleText = titleText;
        this.messageText = messageText;
        this.onConfirm = onConfirm;
    }

    onOpen()
    {
        const { contentEl } = this;
        this.titleEl.setText(this.titleText);

        contentEl.createEl("p", { text: this.messageText, cls: "confirm-modal-message" });

        new Setting(contentEl)
            .addButton((btn) => btn
                .setButtonText("Cancel")
                .onClick(() => {
                    this.close();
                })
            )
            .addButton((btn) => btn
                .setButtonText("OK")
                .setCta()
                .onClick(() =>
                {
                    this.onConfirm();
                    this.close();
                })
            );
    }

    onClose()
    {
        this.contentEl.empty();
    }
}
