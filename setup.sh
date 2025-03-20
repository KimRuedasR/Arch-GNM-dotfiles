#!/bin/bash

# Install necessary packages
sudo pacman -S --needed alacritty zsh gnome-shell-extensions git unzip \
    ttf-nerd-fonts-symbols ttf-jetbrains-mono ttf-fira-code ttf-hack

# Create Repos directory under Downloads
mkdir -p ~/Downloads/Repos

# Clone additional repositories
cd ~/Downloads/Repos
git clone https://github.com/ChrisTitusTech/Top-5-Bootloader-Themes
git clone https://github.com/vinceliuice/WhiteSur-gtk-theme

# Install WhiteSur GTK theme
cd WhiteSur-gtk-theme
./install.sh -l -t blue
cd ~

# Restore GNOME settings
dconf load /org/gnome/ < ./gnome-settings.dconf

# Install GNOME Extensions from ZIP files
mkdir -p ~/.local/share/gnome-shell/extensions
for zip in ./gnome-extensions/*.zip; do
    gnome-extensions install "$zip"
done

# Enable installed extensions
while read extension; do
    gnome-extensions enable "$extension"
done < gnome-extensions-list.txt

# Copy Alacritty config
mkdir -p ~/.config/alacritty
cp ./alacritty.toml ~/.config/alacritty/

# Set up Zsh and Powerlevel10k
cp ./.zshrc ~/
cp ./.p10k.zsh ~/
chsh -s /bin/zsh

# Clone and set up zsh-history-substring-search
if [ ! -d "$HOME/.zsh-history-substring-search" ]; then
    git clone https://github.com/zsh-users/zsh-history-substring-search.git ~/.zsh-history-substring-search
fi

# Restart GNOME Shell (for Xorg) or notify Wayland users
if [[ $XDG_SESSION_TYPE == "x11" ]]; then
    echo "Restarting GNOME Shell..."
    gnome-shell --replace &
elif [[ $XDG_SESSION_TYPE == "wayland" ]]; then
    echo "Extensions installed. Please log out and log back in to apply changes."
fi
