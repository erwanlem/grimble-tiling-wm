import { Tile } from './tile.js';
import { Position } from "./position.js";
import GLib from 'gi://GLib';
import Mtk from 'gi://Mtk';
import { TileWindowManager } from './tileWindowManager.js';

export var resizeSourceId : number | null = null;

export function resizeE(tile: Tile, rect: Mtk.Rectangle) {
    if (!tile.adjacents[1]) {
        if (resizeSourceId !== null)
            GLib.Source.remove(resizeSourceId);
        resizeSourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            TileWindowManager.getMonitors()[tile.monitor].root?.update();
            resizeSourceId = null;
            return GLib.SOURCE_REMOVE;
        });
        return;
    }

    let p = tile.findParent(
        (el: Tile) =>
            el.position.x + el.position.width === tile.position.x + tile.position.width
    );

    if (!p) {
        return;
    } else {
        let pos: Position = p.position;
        let diff = rect.width - tile.position.width;
        pos.width = pos.width + diff;

        p.resize(pos);
        p.update();

        let sibling: Tile | null = p.getSibling();
        if (sibling) {
            let pos: Position = sibling.position;
            pos.width -= diff;
            pos.x += diff;
            sibling.resize(pos);
            sibling.update();
        }

        if (p.parent && p.parent.child2) {
            p.parent.position.splitProportion = 0.5 * (p.parent.position.width - p.parent.child2.position.width) / p.parent.child2.position.width;
        }
    }
}

export function resizeW(tile: Tile, rect: Mtk.Rectangle) {
    if (!tile.adjacents[0]) {
        if (resizeSourceId !== null)
            GLib.Source.remove(resizeSourceId);
        resizeSourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            TileWindowManager.getMonitors()[tile.monitor].root?.update();
            resizeSourceId = null;
            return GLib.SOURCE_REMOVE;
        });
        return;
    }

    let p = tile.findParent(
        (el: Tile) =>
            el.position.x === tile.position.x
    );

    if (!p) {
        return;
    } else {
        let pos: Position = p.position;
        let diff = rect.width - tile.position.width;
        pos.width = pos.width + diff;
        pos.x -= diff;
        p.resize(pos);
        p.update();

        let sibling: Tile | null = p.getSibling();
        if (sibling) {
            let pos: Position = sibling.position;
            pos.width -= diff;
            sibling.resize(pos);
            sibling.update();
        }

        if (p.parent && p.parent.child2) {
            p.parent.position.splitProportion = 0.5 * (p.parent.position.width - p.parent.child2.position.width) / p.parent.child2.position.width;
        }
    }
}

export function resizeS(tile: Tile, rect: Mtk.Rectangle) {
    if (!tile.adjacents[3]) {
        if (resizeSourceId !== null)
            GLib.Source.remove(resizeSourceId);
        resizeSourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            TileWindowManager.getMonitors()[tile.monitor].root?.update();
            resizeSourceId = null;
            return GLib.SOURCE_REMOVE;
        });
        return;
    }

    let p = tile.findParent(
        (el: Tile) =>
            el.position.y + el.position.height === tile.position.y + tile.position.height
    );

    if (!p) {
        return;
    } else {
        let pos: Position = p.position;
        let diff = rect.height - pos.height;
        pos.height = rect.height;
        p.resize(pos);
        p.update();

        let sibling: Tile | null = p.getSibling();
        if (sibling) {
            let pos: Position = sibling.position;
            pos.height -= diff;
            pos.y += diff;
            sibling.resize(pos);
            sibling.update();
        }

        if (p.parent && p.parent.child2) {
            p.parent.position.splitProportion = 0.5 * (p.parent.position.height - p.parent.child2.position.height) / p.parent.child2.position.height;
        }
    }
}

export function resizeN(tile: Tile, rect: Mtk.Rectangle) {
    if (!tile.adjacents[2]) {
        if (resizeSourceId !== null)
            GLib.Source.remove(resizeSourceId);
        resizeSourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            TileWindowManager.getMonitors()[tile.monitor].root?.update();
            resizeSourceId = null;
            return GLib.SOURCE_REMOVE;
        });
        return;
    }

    let p = tile.findParent(
        (el: Tile) =>
            el.position.y === tile.position.y
    );

    if (!p) {
        return;
    } else {
        let pos: Position = p.position;
        let diff = rect.height - pos.height;
        pos.height += diff;
        pos.y -= diff;
        p.resize(pos);
        p.update();

        let sibling: Tile | null = p.getSibling();
        if (sibling) {
            let pos: Position = sibling.position;
            pos.height -= diff;
            sibling.resize(pos);
            sibling.update();
        }

        if (p.parent && p.parent.child2) {
            p.parent.position.splitProportion = 0.5 * (p.parent.position.height - p.parent.child2.position.height) / p.parent.child2.position.height;
        }
    }
}