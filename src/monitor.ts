import { Tile } from './tile.js';
import { Direction } from './tileWindowManager.js';


export class Monitor {
    _root : Tile | null;
    _index : number;
    _fullscreenState: boolean = false;

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

    public get fullscreen() {
        return this._fullscreenState;
    }

    public set fullscreen(b : boolean) {
        this._fullscreenState = b;
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

    private static tileDistance(t1 : Tile, t2 : Tile) : number {
        let vector = [t1.position.x - t2.position.x, t1.position.y - t2.position.y];

        return Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
    }

    public closestTile(source : Tile, dir : Direction) : Tile | null {
        // Class to store the result
        class BestTile {
            public tile : Tile | null = null;
            public distance : number | null = null;

            public constructor(tile : Tile | null = null, distance : number | null = null) {
                this.tile = tile;
                this.distance = distance;
            }
        };
        
        // We search for the closest tile in a Direction. We recursively iterate the tree
        let fun = function findClosest(tile : Tile, dir : Direction) : BestTile {
            switch (dir) {
                case Direction.East:
                    if (tile.leaf && tile.position.x > source.position.x) {
                        return new BestTile(tile, Monitor.tileDistance(tile, source));
                    } else if (tile.leaf) {
                        return new BestTile();
                    } else if (tile.child1 && tile.child2) {
                        let res1 = findClosest(tile.child1, dir);
                        let res2 = findClosest(tile.child2, dir);
                        if ((res1.distance && res2.distance && res1.distance > res2.distance) 
                            || (res2.distance && !res1.distance)) {
                            return res2;
                        } else if ((res1.distance && res2.distance && res1.distance < res2.distance) 
                            || (res1.distance && !res2.distance)) {
                            return res1;
                        } else {
                            return new BestTile();
                        }
                    }
                    return new BestTile();
                case Direction.West:
                    if (tile.leaf && tile.position.x < source.position.x) {
                        return new BestTile(tile, Monitor.tileDistance(tile, source));
                    } else if (tile.leaf) {
                        return new BestTile();
                    } else if (tile.child1 && tile.child2) {
                        let res1 = findClosest(tile.child1, dir);
                        let res2 = findClosest(tile.child2, dir);
                        if ((res1.distance && res2.distance && res1.distance > res2.distance) 
                            || (res2.distance && !res1.distance)) {
                            return res2;
                        } else if ((res1.distance && res2.distance && res1.distance < res2.distance) 
                            || (res1.distance && !res2.distance)) {
                            return res1;
                        } else {
                            return new BestTile();
                        }
                    }
                    return new BestTile();
                case Direction.North:
                    if (tile.leaf && tile.position.y < source.position.y) {
                        return new BestTile(tile, Monitor.tileDistance(tile, source));
                    } else if (tile.leaf) {
                        return new BestTile();
                    } else if (tile.child1 && tile.child2) {
                        let res1 = findClosest(tile.child1, dir);
                        let res2 = findClosest(tile.child2, dir);
                        if ((res1.distance && res2.distance && res1.distance > res2.distance) 
                            || (res2.distance && !res1.distance)) {
                            return res2;
                        } else if ((res1.distance && res2.distance && res1.distance < res2.distance) 
                            || (res1.distance && !res2.distance)) {
                            return res1;
                        } else {
                            return new BestTile();
                        }
                    }
                    return new BestTile();
                case Direction.South:
                    if (tile.leaf && tile.position.y > source.position.y) {
                        return new BestTile(tile, Monitor.tileDistance(tile, source));
                    } else if (tile.leaf) {
                        return new BestTile();
                    } else if (tile.child1 && tile.child2) {
                        let res1 = findClosest(tile.child1, dir);
                        let res2 = findClosest(tile.child2, dir);
                        if ((res1.distance && res2.distance && res1.distance > res2.distance) 
                            || (res2.distance && !res1.distance)) {
                            return res2;
                        } else if ((res1.distance && res2.distance && res1.distance < res2.distance) 
                            || (res1.distance && !res2.distance)) {
                            return res1;
                        } else {
                            return new BestTile();
                        }
                    }
                    return new BestTile();
                default:
                    return new BestTile();
            }
        }

        if (this.root) {
            let res = fun(this.root, dir);
            return res.tile;
        }

        return null;
    }

    public destroy() {
        this._index = -1;
        this._root = null;
    }

    public static fromObject(obj : Monitor) {
        let monitor = new Monitor(obj._index);
        monitor.fullscreen = obj.fullscreen;

        if (!obj._root)
            monitor.root = null;
        else
            monitor.root = Tile.fromObject(obj._root);

        return monitor;
    }

}