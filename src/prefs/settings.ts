

export class Shortcut {

    private static _shortcutList : Array<string> = [
        'keybinding-rotation',
        'keybinding-resize',
        'keybinding-move',
        'keybinding-close',
        'keybinding-search',
        'keybinding-open-settings',
        'keybinding-minimize',
        'keybinding-maximize'
    ];

    public static getShortcuts() {
        return Shortcut._shortcutList;
    }
}

export class Switches {

    private static _switchList : Array<string> = [
        'display-cursor',
        'header-bar'
    ];

    public static getSwitches() {
        return Switches._switchList;
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
        ];

    public static getRadios() {
        return Radio._radioButtons;
    }
}