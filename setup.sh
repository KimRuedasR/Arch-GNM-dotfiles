#!/bin/bash
# Install necessary packages
sudo pacman -S --needed alacritty zsh gnome-shell-extensions git
# Restore GNOME settings
dconf load /org/gnome/ < ./gnome-settings.dconf
# Copy Alacritty config
mkdir -p ~/.config/alacritty
cp ./alacritty.toml ~/.config/alacritty/
# Set up Zsh and Powerlevel10k
cp ./.zshrc ~/
cp ./.p10k.zsh ~/
chsh -s /bin/zsh
