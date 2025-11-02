
export class Shortcut {

    private static _shortcutList : Array<string> = [
        'keybinding-rotation',
        'keybinding-resize',
        'keybinding-move',
        'keybinding-close',
        'keybinding-search',
        'keybinding-open-settings',
        'keybinding-maximize',
        'keybinding-move-left',
        'keybinding-move-right',
        'keybinding-move-top',
        'keybinding-move-bottom',
        'keybinding-resize-left',
        'keybinding-resize-right',
        'keybinding-resize-top',
        'keybinding-resize-bottom',
        'keybinding-next-monitor',
        'keybinding-next-workspace',
        'keybinding-previous-workspace',
        'keybinding-focus',
        'keybinding-focus-left',
        'keybinding-focus-right',
        'keybinding-focus-top',
        'keybinding-focus-bottom',
        'keybinding-save-environment',
        'keybinding-load-environment'
    ];

    public static getShortcuts() {
        return Shortcut._shortcutList;
    }
}

export class Switches {

    private static _switchList : Array<string> = [
        
    ];

    public static getSwitches() {
        return Switches._switchList;
    }
}

export class Spin {

    private static _spinList : Array<string> = [
        'tile-padding'
    ];

    public static getSpins() {
        return Spin._spinList;
    }
}

export class Radio {

    private static _radioButtons = [
            // {
            //     key: 'tile-insertion-behavior',
            //     rowNames: [
            //         'insertion_best_fit_row',
            //         'insertion_focus_row'
            //     ]
            // },
            {
                key: 'monitor-tile-insertion-behavior',
                rowNames: [
                    'monitors_best_fit_row',
                    'monitors_focus_row'
                ]
            },
            {
                key: 'search-entry-position',
                rowNames: [
                    'search_entry_left',
                    'search_entry_center',
                    'search_entry_right'
                ]
            }
        ];

    public static getRadios() : Array<{key: string, rowNames: Array<string>}> {
        return Radio._radioButtons;
    }
}