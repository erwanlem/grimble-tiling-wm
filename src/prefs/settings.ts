
export class Shortcut {

    private static _shortcutList : Array<string> = [
        'keybinding-rotation',
        'keybinding-resize',
        'keybinding-move',
        'keybinding-close',
        'keybinding-search',
        'keybinding-open-settings',
        'keybinding-maximize',
        'keybinding-refresh',
        'keybinding-move-left',
        'keybinding-move-right',
        'keybinding-move-top',
        'keybinding-move-bottom',
    ];

    public static getShortcuts() {
        return Shortcut._shortcutList;
    }
}

export class Switches {

    private static _switchList : Array<string> = [
        'header-bar'
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
            {
                key: 'tile-insertion-behavior',
                rowNames: [
                    'insertion_best_fit_row',
                    'insertion_focus_row'
                ]
            },
            {
                key: 'monitor-tile-insertion-behavior',
                rowNames: [
                    'monitors_best_fit_row',
                    'monitors_focus_row'
                ]
            },
        ];

    public static getRadios() {
        return Radio._radioButtons;
    }
}