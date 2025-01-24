# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

# Load Powerlevel10k theme
source ~/powerlevel10k/powerlevel10k.zsh-theme

# Load Powerlevel10k theme configuration
if [[ -r ~/.p10k.zsh ]]; then
  source ~/.p10k.zsh
fi

# Load zsh-syntax-highlighting and zsh-autosuggestions
source ~/.config/zsh/plugins/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
source ~/.config/zsh/plugins/zsh-autosuggestions/zsh-autosuggestions.zsh

# Load history substring search plugin
source ~/.zsh-history-substring-search/zsh-history-substring-search.zsh

# Custom Aliases
alias zshconfig="nano ~/.zshrc"
alias alacrittyconfig="nano ~/.config/alacritty/alacritty.yml"

# User configurations
export LANG=en_US.UTF-8
export PATH="$HOME/bin:/usr/local/bin:$PATH"

# History settings
HISTFILE=~/.zsh_history
HISTSIZE=10000
SAVEHIST=10000
setopt inc_append_history

# Terminal title configurations
precmd() {
  print -Pn "\e]0;%n@%m: %~\a"
}

preexec() {
  echo -ne "\033]0;$1\007"
}

# Case insensitive tab completion
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}'

# Enable completion system
autoload -Uz compinit && compinit
zmodload zsh/complist

# Configure completion style to display menu
zstyle ':completion:*' menu select=2

# Bind keys for history substring search
bindkey '^[[A' history-substring-search-up
bindkey '^[[B' history-substring-search-down

# Enable selection highlight for tab completion
bindkey "^[[3~" delete-char                  # Delete key
bindkey "^[[5~" beginning-of-history         # Page Up
bindkey "^[[6~" end-of-history               # Page Down

# Key bindings for Tab and Shift + Tab to cycle through suggestions
bindkey '^[[Z' reverse-menu-complete   # Shift + Tab (reverse)
bindkey '^I' menu-complete             # Tab (forward)

# Move by words with Ctrl + Left/Right Arrow
bindkey '^[[1;5C' forward-word
bindkey '^[[1;5D' backward-word

# Accept autosuggestions with Ctrl + Space instead of Right Arrow
bindkey '^@' autosuggest-accept

# NodeVersionManager
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # Loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" # Loads nvm bash_completion

# >>> conda initialize >>>
# !! Contents within this block are managed by 'conda init' !!
__conda_setup="$('/usr/bin/conda' 'shell.zsh' 'hook' 2> /dev/null)"
if [ $? -eq 0 ]; then
    eval "$__conda_setup"
else
    if [ -f "/usr/etc/profile.d/conda.sh" ]; then
        . "/usr/etc/profile.d/conda.sh"
    else
        export PATH="/usr/bin:$PATH"
    fi
fi
unset __conda_setup
# <<< conda initialize <<<

