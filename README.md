# Exit Strategy 🚪🔴

> Always have a way out.

A GNOME Shell extension that turns your Tailscale exit node on and off with one click from Quick Settings. No more typing `tailscale set --exit-node=...` in a terminal.

- **Exit Strategy** toggle in Quick Settings. The subtitle shows `Off` or `On · <data used>`.
- While the VPN is on, the top bar turns **red** and shows a VPN icon plus data used, so you can't forget it's on.
- If you toggle from the terminal, the extension picks it up (it checks `tailscale status` every 3s).

Data used counts traffic through the exit node since you turned the VPN on. If the VPN was already on when you logged in, it counts everything since `tailscaled` started. The count resets when `tailscaled` restarts.

## Requirements

- GNOME Shell 46 (Wayland or X11)
- [Tailscale](https://tailscale.com/download), logged in, with access to an exit node

Before installing, set `EXIT_NODE` at the top of `exit-strategy@ashutosh/extension.js` to your exit node's hostname (from `tailscale exit-node list`).

## Install

```bash
./install.sh
```

This links `exit-strategy@ashutosh` into `~/.local/share/gnome-shell/extensions/`, turns user extensions on, and enables the extension.

On Wayland, GNOME only finds new extensions at login. If the script says so, log out, log back in, and run:

```bash
gnome-extensions enable exit-strategy@ashutosh
```

Run this once so toggling doesn't ask for a password:

```bash
sudo tailscale set --operator=$USER
```

If you skip it, each toggle asks for your password through polkit instead.

<details>
<summary>Manual install</summary>

```bash
ln -sfn "$PWD/exit-strategy@ashutosh" ~/.local/share/gnome-shell/extensions/exit-strategy@ashutosh
# log out and back in
gsettings set org.gnome.shell disable-user-extensions false
gnome-extensions enable exit-strategy@ashutosh
```
</details>

## Uninstall

```bash
./install.sh uninstall
```

## Upgrading from "VPN Toggle"

This project used to be called **VPN Toggle** (`vpn-toggle@ashutosh`). To move over:

```bash
gnome-extensions disable vpn-toggle@ashutosh
rm ~/.local/share/gnome-shell/extensions/vpn-toggle@ashutosh
./install.sh
```

Then log out and back in.

## Configuration

Settings are at the top of `exit-strategy@ashutosh/extension.js`:

| Setting | What it does |
| --- | --- |
| `EXIT_NODE` | Hostname of the exit node to use. |
| `ON_ARGS` / `OFF_ARGS` | The `tailscale set` commands run on toggle. |
| `POLL_SECONDS` | How often status is refreshed. |
| `ICON` | Icon used in Quick Settings and the top bar. |

The red top bar colour is in `exit-strategy@ashutosh/stylesheet.css` (`#panel.exit-strategy-on`).

After any change, log out and back in. GNOME caches extension code, so turning the extension off and on again isn't enough.

## Project layout

```
exit-strategy/
├── install.sh                  # install / uninstall helper
├── README.md
└── exit-strategy@ashutosh/
    ├── extension.js            # toggle, polling, data usage
    ├── metadata.json           # extension name, uuid, supported shell versions
    └── stylesheet.css          # red top bar + usage label
```

## Troubleshooting

```bash
gnome-extensions info exit-strategy@ashutosh
journalctl --user -b | grep -iE "exit-strategy|JS ERROR"
```

| Symptom | Fix |
| --- | --- |
| `Extension "exit-strategy@ashutosh" does not exist` | You haven't logged out since installing. |
| `Enabled: No` | User extensions are off. Run `gsettings set org.gnome.shell disable-user-extensions false`. |
| A password prompt on every toggle | Run `sudo tailscale set --operator=$USER` once. |
| The toggle never turns on | Check `tailscale exit-node list` and make sure `EXIT_NODE` matches a listed hostname. |
