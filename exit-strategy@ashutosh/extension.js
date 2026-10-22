import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {QuickToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';

// Tailscale hostname of your exit node (see `tailscale exit-node list`)
const EXIT_NODE = 'my-exit-node';
const ON_ARGS = ['tailscale', 'set', `--exit-node=${EXIT_NODE}`, '--exit-node-allow-lan-access=true', '--accept-dns=false'];
const OFF_ARGS = ['tailscale', 'set', '--exit-node='];
const ICON = 'network-vpn-symbolic';
const POLL_SECONDS = 3;

function run(argv) {
    return new Promise(resolve => {
        try {
            const proc = Gio.Subprocess.new(argv,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
            proc.communicate_utf8_async(null, null, (p, res) => {
                try {
                    const [, out, err] = p.communicate_utf8_finish(res);
                    resolve({ok: p.get_successful(), out, err});
                } catch (e) {
                    resolve({ok: false, out: '', err: e.message});
                }
            });
        } catch (e) {
            resolve({ok: false, out: '', err: e.message});
        }
    });
}

function fmtBytes(n) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i++;
    }
    return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

const VpnIndicator = GObject.registerClass(
class VpnIndicator extends SystemIndicator {
    _init() {
        super._init();
        this._on = false;
        this._base = 0;
        this._firstPoll = true;

        this._icon = this._addIndicator();
        this._icon.icon_name = ICON;
        this._label = new St.Label({style_class: 'exit-strategy-usage', y_align: Clutter.ActorAlign.CENTER});
        this.add_child(this._label);

        this._toggle = new QuickToggle({title: 'Exit VPN', iconName: ICON, toggleMode: false});
        this._toggle.connect('clicked', () => this._set(!this._on));
        this.quickSettingsItems.push(this._toggle);

        this._render(0);
        this._poll();
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, POLL_SECONDS, () => {
            this._poll();
            return GLib.SOURCE_CONTINUE;
        });
    }

    async _set(on) {
        const argv = on ? ON_ARGS : OFF_ARGS;
        this._toggle.subtitle = on ? 'Connecting…' : 'Disconnecting…';
        let r = await run(argv);
        // Not a tailscale operator yet -> ask for the password via polkit instead of sudo
        if (!r.ok && /access denied/i.test(r.err))
            r = await run(['pkexec', ...argv]);
        if (!r.ok)
            Main.notify('Exit Strategy', r.err.trim() || 'tailscale set failed');
        this._poll();
    }

    async _poll() {
        if (this._busy)
            return;
        this._busy = true;
        const r = await run(['tailscale', 'status', '--json']);
        this._busy = false;
        if (this._destroyed || !r.ok)
            return;

        let peer;
        try {
            peer = Object.values(JSON.parse(r.out).Peer ?? {}).find(p => p.ExitNode);
        } catch (e) {
            return;
        }
        const on = !!peer;
        const total = peer ? peer.RxBytes + peer.TxBytes : 0;
        // Counters are cumulative since tailscaled started: show usage since we saw the VPN turn on.
        // If it was already on when the shell started, show the full counter.
        if (on && !this._on)
            this._base = this._firstPoll ? 0 : total;
        if (total < this._base) // tailscaled restarted, counters reset
            this._base = 0;
        this._firstPoll = false;
        this._on = on;
        this._render(total - this._base);
    }

    _render(used) {
        const usage = fmtBytes(used);
        this._toggle.checked = this._on;
        this._toggle.subtitle = this._on ? `On · ${usage}` : 'Off';
        this._icon.visible = this._label.visible = this._on;
        this._label.text = usage;
        if (this._on)
            Main.panel.add_style_class_name('exit-strategy-on');
        else
            Main.panel.remove_style_class_name('exit-strategy-on');
    }

    destroy() {
        this._destroyed = true;
        GLib.source_remove(this._timer);
        Main.panel.remove_style_class_name('exit-strategy-on');
        this.quickSettingsItems.forEach(i => i.destroy());
        super.destroy();
    }
});

export default class ExitStrategyExtension extends Extension {
    enable() {
        this._indicator = new VpnIndicator();
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}
