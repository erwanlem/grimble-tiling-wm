import { Tile } from './tile.js';


export class Monitor {
    _root : Tile | null;
    _index : number;

    constructor(index : number) {
        this._index = index;
        this._root = null;
    }

    public set root(root : Tile | null) {
        if (!root && this._root && this._root?._nr_tiles > 1) {
            console.error("Can't remove non empty root");
            return ;
        }
        this._root = root;
    }

    public get root() {
        return this._root;
    }

    public get index() {
        return this._index;
    }

    public size() : number {
        return this._root ? this._root._nr_tiles : 0;
    }

    public static bestFitMonitor(monitors : Array<Monitor>) : Monitor {
        return monitors.reduce(
            (acc, val : Monitor) => val.size() < acc.size() ? val : acc, 
            monitors[0]
        );
    }

    public destroy() {
        this._index = -1;
        this._root = null;
    }

    public static fromObject(obj : Monitor) {
        let monitor = new Monitor(obj._index);
        monitor.root = Tile.fromObject(obj._root);

        return monitor;
    }

}